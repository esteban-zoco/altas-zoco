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

    const responseReconciliations = reconciliations.map((item) => ({
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
      createdAt: toIso(item.createdAt),
    }));

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
