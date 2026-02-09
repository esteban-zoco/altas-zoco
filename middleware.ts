import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_PATHS: RegExp[] = [
  /^\/liquidaciones(\/|$)/,
  /^\/pagos(\/|$)/,
  /^\/api\/liquidaciones(\/|$)/,
  /^\/api\/settlements(\/|$)/,
  /^\/api\/payouts(\/|$)/,
  /^\/api\/orders(\/|$)/,
];

const PUBLIC_PATHS: RegExp[] = [
  /^\/liquidaciones\/clave(\/|$)/,
  /^\/api\/liquidaciones\/auth(\/|$)/,
];

const encoder = new TextEncoder();

const sha256Hex = async (value: string) => {
  const data = encoder.encode(value);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isProtected = PROTECTED_PATHS.some((pattern) => pattern.test(pathname));
  if (!isProtected) return NextResponse.next();

  const isPublic = PUBLIC_PATHS.some((pattern) => pattern.test(pathname));
  if (isPublic) return NextResponse.next();

  const password = process.env.LIQUIDACIONES_PASSWORD;
  if (!password) return NextResponse.next();

  const expected = await sha256Hex(password);
  const token = request.cookies.get("liq_auth")?.value;
  if (token === expected) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { success: false, error: "No autorizado" },
      { status: 401 },
    );
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/liquidaciones/clave";
  loginUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
