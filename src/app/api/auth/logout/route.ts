import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, appUrl } from "@/lib/session";

/** Cierra la sesión de la app y también la de Microsoft en este navegador. */
export async function GET(req: NextRequest) {
  const tenant = process.env.AZURE_AD_TENANT_ID || "common";
  const logout = new URL(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/logout`);
  logout.searchParams.set("post_logout_redirect_uri", `${appUrl(req.nextUrl.origin)}/`);
  const res = NextResponse.redirect(logout);
  res.cookies.delete({ name: SESSION_COOKIE, path: "/" });
  return res;
}