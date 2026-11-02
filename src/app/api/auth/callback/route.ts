import { NextRequest, NextResponse } from "next/server";
import {
  OAUTH_COOKIE,
  SESSION_COOKIE,
  SESSION_HOURS,
  appUrl,
  decodeJwtPayload,
  signToken,
  verifyToken,
} from "@/lib/session";

type OAuthState = { state: string; verifier: string; next: string; exp: number };

function denegado(req: NextRequest, motivo: string) {
  console.warn(`[auth] acceso denegado: ${motivo}`);
  const url = new URL("/acceso-denegado", appUrl(req.nextUrl.origin));
  url.searchParams.set("motivo", motivo);
  const res = NextResponse.redirect(url);
  res.cookies.delete({ name: OAUTH_COOKIE, path: "/api/auth" });
  return res;
}

/**
 * Microsoft vuelve aquí con el "code". Se canjea por el id_token, se valida que la cuenta
 * sea del tenant de SELEC (y del dominio permitido) y se crea la sesión.
 */
export async function GET(req: NextRequest) {
  const tenant = process.env.AZURE_AD_TENANT_ID || "";
  const clientId = process.env.AZURE_AD_CLIENT_ID || "";
  const clientSecret = process.env.AZURE_AD_CLIENT_SECRET || "";
  const params = req.nextUrl.searchParams;

  if (params.get("error")) {
    return denegado(req, params.get("error_description") || params.get("error") || "error de Microsoft");
  }

  const saved = await verifyToken<OAuthState>(req.cookies.get(OAUTH_COOKIE)?.value);
  const code = params.get("code");
  if (!saved || !code || params.get("state") !== saved.state) {
    return denegado(req, "la sesión de inicio expiró o no es válida; vuelve a intentarlo");
  }

  const tokenResp = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: `${appUrl(req.nextUrl.origin)}/api/auth/callback`,
      code_verifier: saved.verifier,
      scope: "openid profile email",
    }),
  });
  const tokens = await tokenResp.json().catch(() => ({}));
  if (!tokenResp.ok || !tokens.id_token) {
    return denegado(req, tokens.error_description || "no se pudo validar la cuenta con Microsoft");
  }

  // El id_token llega directo desde Microsoft por HTTPS (flujo con client secret): se validan sus claims.
  const claims = decodeJwtPayload(tokens.id_token);
  const email = String(claims.preferred_username || claims.email || claims.upn || "").toLowerCase();
  const name = String(claims.name || email);
  const dominios = (process.env.AUTH_ALLOWED_DOMAINS || "selec.cl")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);

  if (claims.aud !== clientId) return denegado(req, "token emitido para otra aplicación");
  if (claims.tid !== tenant) return denegado(req, "la cuenta no pertenece a la organización");
  if (Number(claims.exp || 0) * 1000 < Date.now()) return denegado(req, "token expirado");
  if (!dominios.some((d) => email.endsWith(`@${d}`))) {
    return denegado(req, `la cuenta ${email || "sin correo"} no es de un dominio permitido`);
  }

  console.log(`[auth] ingreso: ${email}`);
  const res = NextResponse.redirect(new URL(saved.next || "/", appUrl(req.nextUrl.origin)));
  res.cookies.set(SESSION_COOKIE, await signToken({
    name,
    email,
    exp: Math.floor(Date.now() / 1000) + SESSION_HOURS * 3600,
  }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
  res.cookies.delete({ name: OAUTH_COOKIE, path: "/api/auth" });
  return res;
}