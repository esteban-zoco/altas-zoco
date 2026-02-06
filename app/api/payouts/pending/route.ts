import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

import { getDb, ensureIndexes } from "@/lib/db/mongo";
import { fromCents } from "@/lib/liquidaciones/money";
import { toId } from "@/lib/liquidaciones/serialize";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await ensureIndexes();
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const cardBrand = searchParams.get("cardBrand");
    const organizerId = searchParams.get("organizerId");

    const db = await getDb();

    const baseMatch: Record<string, any> = { status: "reconciled" };

    const settlementMatch: Record<string, any> = {};
    if (from || to) {
      settlementMatch.liquidationDate = {};
      if (from) settlementMatch.liquidationDate.$gte = from;
      if (to) settlementMatch.liquidationDate.$lte = to;
    }
    if (cardBrand) settlementMatch.cardBrand = cardBrand;

    if (organizerId) {
      baseMatch.organizerId = organizerId;
      const settlementFilter: Record<string, any> = {};
      if (cardBrand) settlementFilter["settlement.cardBrand"] = cardBrand;
      if (settlementMatch.liquidationDate) {
        settlementFilter["settlement.liquidationDate"] = settlementMatch.liquidationDate;
      }
      settlementFilter["settlement.status"] = { $in: ["ready_to_pay", "partial"] };

      const results = await db
        .collection("reconciliations")
        .aggregate([
          { $match: baseMatch },
          {
            $lookup: {
              from: "settlements",
              localField: "settlementId",
              foreignField: "_id",
              as: "settlement",
            },
          },
          { $unwind: "$settlement" },
          ...(Object.keys(settlementFilter).length ? [{ $match: settlementFilter }] : []),
          {
            $project: {
              _id: 1,
              settlementId: 1,
              amountCents: 1,
              opDate: 1,
              last4: 1,
              cupon: 1,
              orderId: 1,
              transactionId: 1,
              organizerId: 1,
              organizerName: 1,
              settlementCardBrand: "$settlement.cardBrand",
              settlementLiquidationDate: "$settlement.liquidationDate",
            },
          },
          { $sort: { opDate: -1 } },
        ])
        .toArray();

      const mapped = results.map((item: any) => ({
        id: toId(item._id),
        settlementId: toId(item.settlementId),
        amountCents: item.amountCents,
        amount: fromCents(item.amountCents),
        opDate: item.opDate,
        last4: item.last4,
        cupon: item.cupon ?? null,
        orderId: item.orderId ?? null,
        transactionId: item.transactionId ?? null,
        organizerId: item.organizerId ?? null,
        organizerName: item.organizerName ?? null,
        cardBrand: item.settlementCardBrand ?? null,
        liquidationDate: item.settlementLiquidationDate ?? null,
      }));

      return NextResponse.json({ success: true, pending: mapped });
    }

    const pipeline: any[] = [
      { $match: baseMatch },
      {
        $lookup: {
          from: "settlements",
          localField: "settlementId",
          foreignField: "_id",
          as: "settlement",
        },
      },
      { $unwind: "$settlement" },
      {
        $match: {
          ...(cardBrand ? { "settlement.cardBrand": cardBrand } : {}),
          ...(settlementMatch.liquidationDate
            ? { "settlement.liquidationDate": settlementMatch.liquidationDate }
            : {}),
          "settlement.status": { $in: ["ready_to_pay", "partial"] },
        },
      },
    ];

    pipeline.push(
      {
        $group: {
          _id: "$organizerId",
          organizerName: { $first: "$organizerName" },
          totalCents: { $sum: "$amountCents" },
          count: { $sum: 1 },
          reconciliationIds: { $addToSet: "$_id" },
          settlementIds: { $addToSet: "$settlementId" },
        },
      },
      { $sort: { totalCents: -1 } },
    );

    const results = await db.collection("reconciliations").aggregate(pipeline).toArray();

    const mapped = results.map((item: any) => ({
      organizerId: item._id,
      organizerName: item.organizerName ?? "Organizador sin definir",
      totalCents: item.totalCents,
      total: fromCents(item.totalCents),
      count: item.count,
      reconciliationIds: item.reconciliationIds.map((id: ObjectId) => id.toString()),
      settlementIds: item.settlementIds.map((id: ObjectId) => id.toString()),
    }));

    return NextResponse.json({ success: true, pending: mapped });
  } catch (error) {
    console.error("[payouts][pending]", error);
    return NextResponse.json(
      { success: false, error: "No pudimos obtener pendientes" },
      { status: 500 },
    );
  }
}
