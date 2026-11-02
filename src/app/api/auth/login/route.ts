import { NextRequest, NextResponse } from "next/server";
import { OAUTH_COOKIE, appUrl, pkceChallenge, randomString, signToken } from "@/lib/session";

/**
 * Inicia el login con Microsoft 365 (Entra ID, solo el tenant de SELEC).
 * Guarda state + PKCE en una cookie firmada de 10 minutos y redirige a Microsoft.
 */
export async function GET(req: NextRequest) {
  const tenant = process.env.AZURE_AD_TENANT_ID;
  const clientId = process.env.AZURE_AD_CLIENT_ID;
  if (!tenant || !clientId) {
    return new NextResponse("Falta configurar AZURE_AD_TENANT_ID / AZURE_AD_CLIENT_ID.", { status: 500 });
  }

  const next = req.nextUrl.searchParams.get("next") || "/";
  const state = randomString(24);
  const verifier = randomString(48);
  const redirectUri = `${appUrl(req.nextUrl.origin)}/api/auth/callback`;

  const authorize = new URL(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`);
  authorize.searchParams.set("client_id", clientId);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("redirect_uri", redirectUri);
  authorize.searchParams.set("response_mode", "query");
  authorize.searchParams.set("scope", "openid profile email");
  authorize.searchParams.set("state", state);
  authorize.searchParams.set("code_challenge", await pkceChallenge(verifier));
  authorize.searchParams.set("code_challenge_method", "S256");
  authorize.searchParams.set("prompt", "select_account");

  const res = NextResponse.redirect(authorize);
  res.cookies.set(OAUTH_COOKIE, await signToken({
    state,
    verifier,
    next: next.startsWith("/") && !next.startsWith("//") ? next : "/",
    exp: Math.floor(Date.now() / 1000) + 600,
  }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth",
    maxAge: 600,
  });
  return res;
}