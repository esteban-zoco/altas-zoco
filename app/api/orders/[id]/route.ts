import { NextResponse } from "next/server";

import { getOrder } from "@/lib/liquidaciones/orders";

interface RouteContext {
  params: { id: string };
}

export async function GET(_: Request, context: RouteContext) {
  const orderId = context.params.id;
  if (!orderId) {
    return NextResponse.json(
      { success: false, error: "Orden invalida" },
      { status: 400 },
    );
  }

  const order = await getOrder(orderId);
  if (!order) {
    return NextResponse.json(
      { success: false, error: "Orden no encontrada" },
      { status: 404 },
    );
  }

  return NextResponse.json(order);
}

