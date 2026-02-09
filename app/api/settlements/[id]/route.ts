import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

import { getDb, ensureIndexes } from "@/lib/db/mongo";
import { fromCents } from "@/lib/liquidaciones/money";
import { toId, toIso } from "@/lib/liquidaciones/serialize";
import {
  FiservTransactionDoc,
  ReconciliationDoc,
  SettlementDoc,
  SettlementLineDoc,
} from "@/lib/liquidaciones/dbTypes";

export const runtime = "nodejs";

const isObjectId = (value: string) => ObjectId.isValid(value);
const CUOTA_TOKEN_REGEX = /\b(\d{1,2})\/(\d{1,2})\b(?!\/\d{4})/g;

const extractCuotaInfo = (line: SettlementLineDoc | undefined) => {
  if (!line) {
    return {
      cuotaNumero: null,
      cuotaTotal: null,
      planCuota: null,
      isInstallment: false,
    };
  }

  if (line.cuotaTotal && line.cuotaTotal > 1) {
    return {
      cuotaNumero: line.cuotaNumero ?? null,
      cuotaTotal: line.cuotaTotal ?? null,
      planCuota: line.planCuota ?? null,
      isInstallment: true,
    };
  }

  const raw = line.rawLine ?? "";
  CUOTA_TOKEN_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  let best:
    | { numero: number; total: number; token: string; score: number }
    | null = null;
  while ((match = CUOTA_TOKEN_REGEX.exec(raw)) !== null) {
    const numero = Number(match[1]);
    const total = Number(match[2]);
    if (!Number.isFinite(numero) || !Number.isFinite(total)) continue;
    if (total <= 1 || total > 60) continue;
    if (numero < 0 || numero > total) continue;
    const score = total * 100 + (60 - Math.abs(numero - 1));
    if (!best || score > best.score) {
      best = { numero, total, token: match[0], score };
    }
  }

  if (!best) {
    return {
      cuotaNumero: null,
      cuotaTotal: null,
      planCuota: line.planCuota ?? null,
      isInstallment:
        line.trxType === "plan_cuota" || /plan\s*cuota/i.test(raw),
    };
  }

  return {
    cuotaNumero: best.numero,
    cuotaTotal: best.total,
    planCuota: line.planCuota ?? best.token,
    isInstallment: true,
  };
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await ensureIndexes();
    const { id } = await context.params;
    if (!isObjectId(id)) {
      return NextResponse.json(
        { success: false, error: "ID invalido" },
        { status: 400 },
      );
    }

    const db = await getDb();
    const settlementId = new ObjectId(id);
    const settlement = await db
      .collection<SettlementDoc>("settlements")
      .findOne({ _id: settlementId });

    if (!settlement) {
      return NextResponse.json(
        { success: false, error: "Liquidacion no encontrada" },
        { status: 404 },
      );
    }

    const [lines, reconciliations, transactions] = await Promise.all([
      db
        .collection<SettlementLineDoc>("settlement_lines")
        .find({ settlementId })
        .toArray(),
      db
        .collection<ReconciliationDoc>("reconciliations")
        .find({ settlementId })
        .toArray(),
      db
        .collection<FiservTransactionDoc>("fiserv_transactions")
        .find({ settlementId })
        .toArray(),
    ]);

    const reconciled = reconciliations.filter((item) => item.status === "reconciled");
    const needsReview = reconciliations.filter((item) => item.status === "needs_review");
    const sinMatch = needsReview.filter((item) => item.reason === "sin_match");
    const ambiguo = needsReview.filter((item) =>
      item.reason?.toString().toLowerCase().includes("ambiguo"),
    );

    const reconciledTotalCents = reconciled.reduce(
      (sum, item) => sum + item.amountCents,
      0,
    );
    const currencyARS =
      transactions.length === 0 ||
      transactions.every((item) => (item.currency || "ARS") === "ARS");

    const pdfTotal = settlement.totals?.grossCents ?? null;
    const pdfTotalMatches =
      pdfTotal !== null ? Math.abs(pdfTotal - reconciledTotalCents) < 1 : null;

    const responseSettlement = {
      id: toId(settlement._id),
      provider: settlement.provider,
      cardBrand: settlement.cardBrand,
      liquidationDate: settlement.liquidationDate,
      liquidationNumber: settlement.liquidationNumber,
      sourcePdfFilename: settlement.sourcePdfFilename,
      sourceCsvFilename: settlement.sourceCsvFilename,
      status: settlement.status,
      totals: settlement.totals,
      createdAt: toIso(settlement.createdAt),
      createdBy: settlement.createdBy,
    };

    const lineById = new Map(
      lines.map((line) => [line._id.toString(), line]),
    );

    const responseReconciliations = reconciliations.map((item) => {
      const line = lineById.get(item.settlementLineId.toString());
      const cuotaInfo = extractCuotaInfo(line);
      const pdfAmountCents = line?.amountCents ?? null;
      let cuotaTotal = cuotaInfo.cuotaTotal;
      let cuotaNumero = cuotaInfo.cuotaNumero;
      let isInstallment = cuotaInfo.isInstallment;

      if (
        !cuotaTotal &&
        pdfAmountCents &&
        item.amountCents &&
        item.amountCents > pdfAmountCents
      ) {
        const ratio = item.amountCents / pdfAmountCents;
        if (Number.isInteger(ratio) && ratio > 1 && ratio <= 60) {
          cuotaTotal = ratio;
          cuotaNumero = cuotaNumero ?? null;
          isInstallment = true;
        }
      }

      return {
        id: toId(item._id),
        settlementId: toId(item.settlementId),
        settlementLineId: toId(item.settlementLineId),
        fiservTransactionId: item.fiservTransactionId ? toId(item.fiservTransactionId) : null,
      orderId: item.orderId ?? null,
      organizerId: item.organizerId ?? null,
      organizerName: item.organizerName ?? null,
      eventId: item.eventId ?? null,
      transactionId: item.transactionId ?? null,
      matchType: item.matchType,
      matchKey: item.matchKey,
      status: item.status,
      reason: item.reason ?? null,
      amountCents: item.amountCents,
      amount: fromCents(item.amountCents),
      opDate: item.opDate,
      last4: item.last4,
      cupon: item.cupon ?? null,
      trxType: line?.trxType ?? null,
      planCuota: cuotaInfo.planCuota,
      cuotaNumero,
      cuotaTotal,
      pdfAmountCents,
      isInstallment,
      terminal: line?.terminal ?? null,
      lote: line?.lote ?? null,
      createdAt: toIso(item.createdAt),
      };
    });

    return NextResponse.json({
      success: true,
      settlement: responseSettlement,
      linesCount: lines.length,
      csvTransactions: transactions.length,
      reconciliations: responseReconciliations,
      totals: {
        settlementLines: lines.length,
        csvTransactions: transactions.length,
        reconciled: reconciled.length,
        sinMatch: sinMatch.length,
        ambiguo: ambiguo.length,
      },
      validations: {
        currencyARS,
        pdfTotal,
        reconciledTotal: reconciledTotalCents,
        pdfTotalMatches,
      },
      canGeneratePayments: reconciliations.length > 0 && needsReview.length === 0,
    });
  } catch (error) {
    console.error("[settlements][GET:id]", error);
    return NextResponse.json(
      { success: false, error: "No pudimos obtener la liquidacion" },
      { status: 500 },
    );
  }
}
