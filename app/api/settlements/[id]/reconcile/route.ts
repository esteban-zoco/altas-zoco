import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

import { getDb, ensureIndexes } from "@/lib/db/mongo";
import { reconcileSettlement } from "@/lib/liquidaciones/reconcileService";
import {
  FiservTransactionDoc,
  ReconciliationDoc,
  SettlementDoc,
  SettlementLineDoc,
} from "@/lib/liquidaciones/dbTypes";

export const runtime = "nodejs";

const isObjectId = (value: string) => ObjectId.isValid(value);

export async function POST(
  request: Request,
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

    const matchedBy =
      request.headers.get("x-user")?.trim() ||
      request.headers.get("x-user-email")?.trim() ||
      "unknown";

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

    const [lines, transactions] = await Promise.all([
      db
        .collection<SettlementLineDoc>("settlement_lines")
        .find({ settlementId })
        .toArray(),
      db
        .collection<FiservTransactionDoc>("fiserv_transactions")
        .find({ settlementId })
        .toArray(),
    ]);

    await db.collection<ReconciliationDoc>("reconciliations").deleteMany({
      settlementId,
    });

    const reconciliations = await reconcileSettlement({
      settlementId,
      lines,
      transactions,
      matchedBy,
    });

    if (reconciliations.length) {
      await db.collection<ReconciliationDoc>("reconciliations").insertMany(reconciliations);
    }

    const hasReview =
      reconciliations.some((item) => item.status === "needs_review") ||
      lines.length === 0 ||
      transactions.length === 0;
    const status = hasReview ? "needs_review" : "ready_to_pay";
    await db
      .collection<SettlementDoc>("settlements")
      .updateOne({ _id: settlementId }, { $set: { status } });

    return NextResponse.json({
      success: true,
      status,
      totals: {
        settlementLines: reconciliations.length,
        reconciled: reconciliations.filter((item) => item.status === "reconciled")
          .length,
        sinMatch: reconciliations.filter(
          (item) => item.status === "needs_review" && item.reason === "sin_match",
        ).length,
        ambiguo: reconciliations.filter(
          (item) =>
            item.status === "needs_review" &&
            item.reason?.toString().toLowerCase().includes("ambiguo"),
        ).length,
        csvTransactions: transactions.length,
      },
    });
  } catch (error) {
    console.error("[settlements][POST:reconcile]", error);
    return NextResponse.json(
      { success: false, error: "No pudimos reconciliar" },
      { status: 500 },
    );
  }
}
