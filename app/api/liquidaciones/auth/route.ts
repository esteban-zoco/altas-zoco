import { createHash } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const hashToken = (value: string) =>
  createHash("sha256").update(value).digest("hex");

export async function POST(request: Request) {
  const expected = process.env.LIQUIDACIONES_PASSWORD;
  if (!expected) {
    return NextResponse.json(
      { success: false, error: "Clave no configurada" },
      { status: 500 },
    );
  }

  const payload = (await request.json().catch(() => ({}))) as { password?: string };
  const provided = String(payload.password ?? "");
  if (!provided || provided !== expected) {
    return NextResponse.json(
      { success: false, error: "Clave incorrecta" },
      { status: 401 },
    );
  }

  const token = hashToken(expected);
  const cookieStore = await cookies();
  cookieStore.set({
    name: "liq_auth",
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });

  return NextResponse.json({ success: true });
}
