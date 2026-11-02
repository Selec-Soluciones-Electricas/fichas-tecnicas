import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, SessionUser, verifyToken } from "@/lib/session";

/** Usuario de la sesión actual (para mostrar el nombre y el botón "Cerrar sesión"). */
export async function GET(req: NextRequest) {
  const user = await verifyToken<SessionUser>(req.cookies.get(SESSION_COOKIE)?.value);
  if (!user) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  return NextResponse.json({ name: user.name, email: user.email });
}