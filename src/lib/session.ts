/**
 * Sesión firmada en una cookie (sin base de datos).
 *
 * El token es  base64url(JSON) + "." + base64url(HMAC-SHA256)  firmado con AUTH_SECRET.
 * Usa solo Web Crypto, así funciona igual en las rutas de la API y en el proxy (src/proxy.ts).
 */

export const SESSION_COOKIE = "ft_session";
export const OAUTH_COOKIE = "ft_oauth";
export const SESSION_HOURS = Number(process.env.SESSION_HOURS || 10);

export type SessionUser = { name: string; email: string; exp: number };

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array {
  const base64 = text.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((text.length + 3) % 4);
  const binary = atob(base64);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function hmacKey(): Promise<CryptoKey> {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("Falta AUTH_SECRET (mínimo 32 caracteres).");
  }
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

/** Firma cualquier objeto con fecha de expiración (segundos Unix en "exp"). */
export async function signToken(payload: Record<string, unknown>): Promise<string> {
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(), encoder.encode(body));
  return `${body}.${toBase64Url(new Uint8Array(signature))}`;
}

/** Devuelve el contenido si la firma es válida y no expiró; si no, null. */
export async function verifyToken<T extends { exp: number }>(token: string | undefined): Promise<T | null> {
  if (!token || !token.includes(".")) return null;
  const [body, signature] = token.split(".");
  try {
    const ok = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(),
      fromBase64Url(signature) as BufferSource,
      encoder.encode(body)
    );
    if (!ok) return null;
    const payload = JSON.parse(decoder.decode(fromBase64Url(body))) as T;
    if (!payload.exp || payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function randomString(bytes = 32): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(verifier));
  return toBase64Url(new Uint8Array(digest));
}

/** Decodifica el payload de un JWT (sin verificar firma: solo para el id_token recibido
 *  directamente del endpoint de token de Microsoft por HTTPS, como permite OpenID Connect). */
export function decodeJwtPayload(jwt: string): Record<string, unknown> {
  const part = jwt.split(".")[1] || "";
  return JSON.parse(decoder.decode(fromBase64Url(part)));
}

/** URL pública de la app (para el redirect de Microsoft). */
export function appUrl(fallbackOrigin: string): string {
  return (process.env.APP_URL || fallbackOrigin).replace(/\/$/, "");
}