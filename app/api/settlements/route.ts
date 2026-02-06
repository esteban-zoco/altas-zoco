import { ObjectId } from "mongodb";
import pdf from "pdf-parse";
import { NextResponse } from "next/server";

import { getDb, ensureIndexes } from "@/lib/db/mongo";
import { parseFiservCsv } from "@/lib/liquidaciones/csvParser";
import { parseFiservPdfText } from "@/lib/liquidaciones/pdfParser";
import { sha256, sha256Text } from "@/lib/liquidaciones/hash";
import { normalizeDate } from "@/lib/liquidaciones/utils";
import { parseCsvDateTime } from "@/lib/liquidaciones/dates";
import { toCents } from "@/lib/liquidaciones/money";
import { reconcileSettlement } from "@/lib/liquidaciones/reconcileService";
import { toId, toIso } from "@/lib/liquidaciones/serialize";
import {
  FiservTransactionDoc,
  SettlementDoc,
  SettlementLineDoc,
} from "@/lib/liquidaciones/dbTypes";

export const runtime = "nodejs";

const extractLiquidationDate = (text: string, lines: SettlementLineDoc[]) => {
  const paymentMatch = text.match(
    /Fecha\s+de\s+Pago[:\s]*([0-9]{2}\/[0-9]{2}\/[0-9]{4})/i,
  );
  if (paymentMatch) {
    const normalized = normalizeDate(paymentMatch[1]);
    if (normalized) return normalized;
  }

  if (lines.length === 0) return null;
  const dates = Array.from(new Set(lines.map((line) => line.opDate).filter(Boolean)));
  if (dates.length === 1) return dates[0];
  dates.sort();
  return dates[0] ?? null;
};

const extractLiquidationNumber = (text: string) => {
  const match =
    text.match(/Nro\.?\s+Liquidaci[oó]n[:\s]*([0-9]+)/i) ??
    text.match(/Nro\.?\s+Liq[:\s]*([0-9]+)/i);
  return match ? match[1] : null;
};

const buildSummary = (reconciliations: any[], transactions: any[]) => {
  const totals = {
    settlementLines: reconciliations.length,
    reconciled: reconciliations.filter((item) => item.status === "reconciled").length,
    sinMatch: reconciliations.filter(
      (item) => item.status === "needs_review" && item.reason === "sin_match",
    ).length,
    ambiguo: reconciliations.filter(
      (item) =>
        item.status === "needs_review" &&
        item.reason?.toString().toLowerCase().includes("ambiguo"),
    ).length,
    csvTransactions: transactions.length,
  };
  return totals;
};

export async function GET(request: Request) {
  try {
    await ensureIndexes();
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const cardBrand = searchParams.get("cardBrand");
    const status = searchParams.get("status");

    const filter: Record<string, any> = { provider: "fiserv" };
    if (cardBrand) filter.cardBrand = cardBrand;
    if (status) filter.status = status;
    if (from || to) {
      filter.liquidationDate = {};
      if (from) filter.liquidationDate.$gte = from;
      if (to) filter.liquidationDate.$lte = to;
    }

    const db = await getDb();
    const settlements = await db
      .collection<SettlementDoc>("settlements")
      .find(filter)
      .sort({ createdAt: -1 })
      .toArray();

    const payload = settlements.map((item) => ({
      id: toId(item._id),
      provider: item.provider,
      cardBrand: item.cardBrand,
      liquidationDate: item.liquidationDate,
      liquidationNumber: item.liquidationNumber,
      sourcePdfFilename: item.sourcePdfFilename,
      sourceCsvFilename: item.sourceCsvFilename,
      status: item.status,
      totals: item.totals,
      createdAt: toIso(item.createdAt),
      createdBy: item.createdBy,
    }));

    return NextResponse.json({ success: true, settlements: payload });
  } catch (error) {
    console.error("[settlements][GET]", error);
    return NextResponse.json(
      { success: false, error: "No pudimos obtener las liquidaciones" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    await ensureIndexes();
    const formData = await request.formData();
    const cardBrand = String(formData.get("cardBrand") ?? "").trim().toLowerCase();
    const pdfFile = formData.get("pdfFile") as File | null;
    const csvFile = formData.get("csvFile") as File | null;
    const createdBy =
      String(formData.get("createdBy") ?? request.headers.get("x-user") ?? "").trim() ||
      "unknown";

    if (!cardBrand || !pdfFile || !csvFile) {
      return NextResponse.json(
        { success: false, error: "Faltan archivos o cardBrand" },
        { status: 400 },
      );
    }

    const [pdfBuffer, csvBuffer] = await Promise.all([
      pdfFile.arrayBuffer().then((buffer) => Buffer.from(buffer)),
      csvFile.arrayBuffer().then((buffer) => Buffer.from(buffer)),
    ]);

    const hashPdf = sha256(pdfBuffer);
    const hashCsv = sha256(csvBuffer);

    const db = await getDb();
    const settlementsCollection = db.collection<SettlementDoc>("settlements");
    const existingSettlement = await settlementsCollection.findOne({
      provider: "fiserv",
      hashPdf,
      hashCsv,
    });

    const csvResult = parseFiservCsv(csvBuffer, "import");
    const parsedPdf = await pdf(pdfBuffer);
    const pdfResult = parseFiservPdfText(parsedPdf.text, "import");

    const settlementId = new ObjectId();
    const now = new Date();

    const buildLineKey = (line: SettlementLineDoc) =>
      [
        cardBrand,
        line.opDate,
        line.last4,
        line.amountCents,
        line.cupon ?? "",
        line.terminal ?? "",
        line.lote ?? "",
        line.trxType ?? "",
        line.planCuota ?? "",
      ].join("|");

    const lineDocs: SettlementLineDoc[] = pdfResult.lines.map((line) => {
      const amountCents = toCents(line.amount);
      const draft: SettlementLineDoc = {
        _id: new ObjectId(),
        settlementId,
        opDate: line.fechaOperacion,
        terminal: line.terminal || null,
        lote: line.lote || null,
        cupon: line.cupon || null,
        last4: line.last4,
        amountCents,
        lineHash: "",
        trxType: line.trxType,
        planCuota: line.planCuota || null,
        cuotaNumero: line.cuotaNumero ?? null,
        cuotaTotal: line.cuotaTotal ?? null,
        rawLine: line.rawLine,
        createdAt: now,
      };
      draft.lineHash = sha256Text(buildLineKey(draft));
      return draft;
    });
    const lineDocsUnique = Array.from(
      new Map(lineDocs.map((item) => [item.lineHash, item])).values(),
    );

    const buildTxKey = (tx: FiservTransactionDoc) =>
      [
        cardBrand,
        tx.opDate,
        tx.last4,
        tx.amountCents,
        tx.transactionId,
        tx.orderId,
        tx.cupon ?? "",
      ].join("|");

    const transactionDocs: FiservTransactionDoc[] = csvResult.transactions.map(
      (transaction) => {
        const draft: FiservTransactionDoc = {
          _id: new ObjectId(),
          settlementId,
          orderId: transaction.orderId,
          transactionId: transaction.transactionId,
          approval: transaction.approval,
          last4: transaction.last4,
          amountCents: toCents(transaction.amount),
          opDate: transaction.date,
          opDateTime: parseCsvDateTime(transaction.dateTime ?? "") ?? null,
          currency: transaction.currency || "ARS",
          terminal: transaction.terminal || null,
          lote: transaction.lote || null,
          cupon: transaction.cupon || null,
          txHash: "",
          createdAt: now,
        };
        draft.txHash = sha256Text(buildTxKey(draft));
        return draft;
      },
    );
    const transactionDocsUnique = Array.from(
      new Map(transactionDocs.map((item) => [item.txHash, item])).values(),
    );

    const liquidationDate = extractLiquidationDate(parsedPdf.text, lineDocs);
    const liquidationNumber = extractLiquidationNumber(parsedPdf.text);

    const totals = {
      grossCents: pdfResult.totalAmount ? toCents(pdfResult.totalAmount) : null,
      feesCents: null,
      taxesCents: null,
      netCents: null,
    };

    const existingLineHashes = new Set(
      (
        await db
          .collection<SettlementLineDoc>("settlement_lines")
          .find({ lineHash: { $in: lineDocsUnique.map((line) => line.lineHash) } })
          .project({ lineHash: 1 })
          .toArray()
      ).map((item) => item.lineHash),
    );

    const existingTxHashes = new Set(
      (
        await db
          .collection<FiservTransactionDoc>("fiserv_transactions")
          .find({ txHash: { $in: transactionDocsUnique.map((tx) => tx.txHash) } })
          .project({ txHash: 1 })
          .toArray()
      ).map((item) => item.txHash),
    );

    const uniqueLineDocs = lineDocsUnique.filter(
      (line) => !existingLineHashes.has(line.lineHash),
    );
    const uniqueTransactionDocs = transactionDocsUnique.filter(
      (tx) => !existingTxHashes.has(tx.txHash),
    );

    if (uniqueLineDocs.length === 0 && uniqueTransactionDocs.length === 0) {
      return NextResponse.json({
        success: true,
        duplicate: true,
        settlementId: existingSettlement ? toId(existingSettlement._id) : undefined,
        message: "No hay operaciones nuevas para importar.",
      });
    }

    const existingTxDocs = await db
      .collection<FiservTransactionDoc>("fiserv_transactions")
      .find({ txHash: { $in: transactionDocsUnique.map((tx) => tx.txHash) } })
      .toArray();
    const existingTxIds = existingTxDocs.map((tx) => tx._id);
    const usedTxIds = new Set(
      (
        await db
          .collection("reconciliations")
          .find({ fiservTransactionId: { $in: existingTxIds } })
          .project({ fiservTransactionId: 1, status: 1 })
          .toArray()
      )
        .filter((item: any) => item.status === "reconciled" || item.status === "paid")
        .map((item: any) => item.fiservTransactionId?.toString()),
    );
    const availableExistingTxDocs = existingTxDocs.filter(
      (tx) => !usedTxIds.has(tx._id.toString()),
    );
    const transactionsForReconcile = [
      ...uniqueTransactionDocs,
      ...availableExistingTxDocs,
    ];

    const settlementDoc: SettlementDoc = {
      _id: settlementId,
      provider: "fiserv",
      cardBrand,
      liquidationDate,
      liquidationNumber,
      sourcePdfFilename: pdfFile.name,
      sourceCsvFilename: csvFile.name,
      hashPdf,
      hashCsv,
      status: "imported",
      totals,
      createdAt: now,
      createdBy,
    };

    await settlementsCollection.insertOne(settlementDoc);

    if (uniqueLineDocs.length) {
      await db
        .collection<SettlementLineDoc>("settlement_lines")
        .insertMany(uniqueLineDocs, { ordered: false });
    }
    if (uniqueTransactionDocs.length) {
      await db
        .collection<FiservTransactionDoc>("fiserv_transactions")
        .insertMany(uniqueTransactionDocs, { ordered: false });
    }

    const reconciliations = await reconcileSettlement({
      settlementId,
      lines: uniqueLineDocs,
      transactions: transactionsForReconcile,
      matchedBy: createdBy,
    });

    if (reconciliations.length) {
      await db.collection("reconciliations").insertMany(reconciliations);
    }

    const hasReview =
      reconciliations.some((item) => item.status === "needs_review") ||
      lineDocsUnique.length === 0 ||
      transactionDocsUnique.length === 0;
    const status = hasReview ? "needs_review" : "ready_to_pay";
    await settlementsCollection.updateOne(
      { _id: settlementId },
      { $set: { status } },
    );

    const totalsSummary = buildSummary(reconciliations, transactionDocsUnique);

    return NextResponse.json({
      success: true,
      settlementId: settlementId.toString(),
      status,
      totals: totalsSummary,
    });
  } catch (error: any) {
    if (error?.code === 11000) {
      return NextResponse.json({
        success: true,
        duplicate: true,
        message: "Operaciones duplicadas detectadas, no se importaron.",
      });
    }
    console.error("[settlements][POST]", error);
    return NextResponse.json(
      { success: false, error: "No pudimos procesar la liquidacion" },
      { status: 500 },
    );
  }
}
