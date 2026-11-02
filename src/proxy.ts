import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, SessionUser, verifyToken } from "@/lib/session";

/**
 * Protege toda la app: sin sesión válida de Microsoft 365 (cuenta de SELEC) no se ve
 * ninguna página ni se puede llamar a la API de IA.
 *
 * Quedan abiertas solo: el flujo de login (/api/auth/*), la página de acceso denegado
 * y los archivos estáticos de Next.
 *
 * AUTH_DISABLED=on desactiva la protección (SOLO para desarrollo local).
 */
export async function proxy(req: NextRequest) {
  if (process.env.AUTH_DISABLED === "on" && process.env.NODE_ENV !== "production") {
    return NextResponse.next();
  }

  const user = await verifyToken<SessionUser>(req.cookies.get(SESSION_COOKIE)?.value);
  if (user) {
    const res = NextResponse.next();
    res.headers.set("Cache-Control", "private, no-store");
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
    return res;
  }

  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Sesión requerida. Vuelve a ingresar con tu cuenta de SELEC." }, { status: 401 });
  }
  const login = new URL("/api/auth/login", req.nextUrl.origin);
  login.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: [
    // Todo, excepto login, página de acceso denegado, estáticos de Next y archivos públicos
    "/((?!api/auth|acceso-denegado|_next/static|_next/image|favicon.ico|robots.txt|pdf.worker.min.mjs|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};