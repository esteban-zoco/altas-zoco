import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

import { getDb, ensureIndexes } from "@/lib/db/mongo";
import { fromCents } from "@/lib/liquidaciones/money";
import { toId, toIso } from "@/lib/liquidaciones/serialize";
import { PayoutBatchDoc, ReconciliationDoc, SettlementDoc } from "@/lib/liquidaciones/dbTypes";

export const runtime = "nodejs";

const parseDateInput = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

export async function GET(request: Request) {
  try {
    await ensureIndexes();
    const { searchParams } = new URL(request.url);
    const organizerId = searchParams.get("organizerId");
    const from = parseDateInput(searchParams.get("from"));
    const to = parseDateInput(searchParams.get("to"));

    const filter: Record<string, any> = {};
    if (organizerId) filter.organizerId = organizerId;
    if (from || to) {
      filter.paidAt = {};
      if (from) filter.paidAt.$gte = from;
      if (to) filter.paidAt.$lte = to;
    }

    const db = await getDb();
    const payouts = await db
      .collection<PayoutBatchDoc>("payout_batches")
      .find(filter)
      .sort({ paidAt: -1 })
      .toArray();

    const payload = payouts.map((item) => ({
      id: toId(item._id),
      organizerId: item.organizerId,
      organizerName: item.organizerName,
      totalCents: item.totalCents,
      total: fromCents(item.totalCents),
      currency: item.currency,
      settlementIds: item.settlementIds.map((id) => toId(id)),
      reconciliationIds: item.reconciliationIds.map((id) => toId(id)),
      bankReference: item.bankReference,
      note: item.note ?? null,
      paidAt: toIso(item.paidAt),
      paidBy: item.paidBy,
      createdAt: toIso(item.createdAt),
    }));

    return NextResponse.json({ success: true, payouts: payload });
  } catch (error) {
    console.error("[payouts][GET]", error);
    return NextResponse.json(
      { success: false, error: "No pudimos obtener los pagos" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    await ensureIndexes();
    const payload = await request.json();
    const organizerId = String(payload.organizerId ?? "").trim();
    const reconciliationIds = Array.isArray(payload.reconciliationIds)
      ? payload.reconciliationIds.map((id: string) => id.trim()).filter(Boolean)
      : [];
    const bankReference = String(payload.bankReference ?? "").trim();
    const note = payload.note ? String(payload.note) : "";
    const paidAtInput = payload.paidAt ? String(payload.paidAt) : null;
    const paidAt = paidAtInput ? new Date(paidAtInput) : new Date();
    const paidBy =
      String(payload.paidBy ?? request.headers.get("x-user") ?? "").trim() ||
      "unknown";

    if (!organizerId || reconciliationIds.length === 0 || !bankReference) {
      return NextResponse.json(
        { success: false, error: "Faltan datos para registrar pago" },
        { status: 400 },
      );
    }

    const db = await getDb();
    const invalidIds = reconciliationIds.filter((id: string) => !ObjectId.isValid(id));
    if (invalidIds.length) {
      return NextResponse.json(
        { success: false, error: "Ids de reconciliacion invalidos" },
        { status: 400 },
      );
    }
    const recObjectIds = reconciliationIds.map((id) => new ObjectId(id));
    const reconciliations = await db
      .collection<ReconciliationDoc>("reconciliations")
      .find({
        _id: { $in: recObjectIds },
        organizerId,
        status: "reconciled",
      })
      .toArray();

    if (reconciliations.length !== recObjectIds.length) {
      return NextResponse.json(
        {
          success: false,
          error: "Algunas operaciones no estan reconciliadas o ya fueron pagadas",
        },
        { status: 409 },
      );
    }

    const totalCents = reconciliations.reduce(
      (sum, item) => sum + item.amountCents,
      0,
    );
    const settlementIds = Array.from(
      new Set(reconciliations.map((item) => item.settlementId.toString())),
    ).map((id) => new ObjectId(id));

    const settlements = await db
      .collection<SettlementDoc>("settlements")
      .find({ _id: { $in: settlementIds } })
      .toArray();
    const blocked = settlements.filter(
      (item) => item.status !== "ready_to_pay" && item.status !== "partial",
    );
    if (blocked.length) {
      return NextResponse.json(
        {
          success: false,
          error: "La liquidación no está lista para pagar.",
        },
        { status: 409 },
      );
    }

    const payout: PayoutBatchDoc = {
      _id: new ObjectId(),
      organizerId,
      organizerName: reconciliations[0]?.organizerName ?? "Organizador sin definir",
      totalCents,
      currency: "ARS",
      settlementIds,
      reconciliationIds: recObjectIds,
      bankReference,
      note: note || undefined,
      paidAt,
      paidBy,
      createdAt: new Date(),
    };

    const updateResult = await db.collection<ReconciliationDoc>("reconciliations").updateMany(
      { _id: { $in: recObjectIds }, status: "reconciled" },
      { $set: { status: "paid" } },
    );

    if (updateResult.modifiedCount !== recObjectIds.length) {
      return NextResponse.json(
        {
          success: false,
          error: "No pudimos marcar todas las operaciones como pagadas",
        },
        { status: 409 },
      );
    }

    await db.collection<PayoutBatchDoc>("payout_batches").insertOne(payout);

    const settlementsCollection = db.collection<SettlementDoc>("settlements");
    for (const settlementId of settlementIds) {
      const total = await db
        .collection<ReconciliationDoc>("reconciliations")
        .countDocuments({ settlementId });
      const paid = await db
        .collection<ReconciliationDoc>("reconciliations")
        .countDocuments({ settlementId, status: "paid" });

      if (paid === 0) continue;
      const newStatus = paid === total ? "paid" : "partial";
      await settlementsCollection.updateOne(
        { _id: settlementId },
        { $set: { status: newStatus } },
      );
    }

    return NextResponse.json({
      success: true,
      payoutId: payout._id.toString(),
      totalCents,
      total: fromCents(totalCents),
    });
  } catch (error) {
    console.error("[payouts][POST]", error);
    return NextResponse.json(
      { success: false, error: "No pudimos registrar el pago" },
      { status: 500 },
    );
  }
}
