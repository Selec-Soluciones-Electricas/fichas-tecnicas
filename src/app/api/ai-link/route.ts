import { NextRequest, NextResponse } from "next/server";
import { fichaDesdeLink, limpiarFicha } from "@/lib/claude";

export const maxDuration = 120;

const MAX_IMAGEN_BYTES = 4 * 1024 * 1024;

/** Evita que el servidor descargue imágenes desde la red interna (localhost, IPs privadas). */
function urlPublicaSegura(texto: string): URL | null {
  try {
    const url = new URL(texto);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    const host = url.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host.endsWith(".local") ||
      host.endsWith(".internal") ||
      /^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
      host.includes(":") // IPv6 literal
    ) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

/** Descarga la imagen y la devuelve como data URL (así queda dentro del PDF exportado). */
async function imagenComoDataUrl(direccion: string): Promise<string | null> {
  const url = urlPublicaSegura(direccion);
  if (!url) return null;
  try {
    const resp = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Fichas Tecnicas SELEC)" },
      signal: AbortSignal.timeout(10000),
      redirect: "follow",
    });
    const tipo = resp.headers.get("content-type") || "";
    if (!resp.ok || !tipo.startsWith("image/") || tipo.includes("svg")) return null;
    const buffer = Buffer.from(await resp.arrayBuffer());
    if (buffer.length > MAX_IMAGEN_BYTES || buffer.length < 2000) return null; // descarta íconos
    return `data:${tipo.split(";")[0]};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * POST { url, indicaciones? }
 * Claude lee el link (página del fabricante o PDF) y devuelve los datos de la ficha
 * más las fotos del producto ya descargadas.
 */
export async function POST(req: NextRequest) {
  try {
    const { url, indicaciones } = await req.json();
    const destino = urlPublicaSegura(String(url || "").trim());
    if (!destino) {
      return NextResponse.json({ error: "Ingresa un link válido (https://...)." }, { status: 400 });
    }

    const ficha = limpiarFicha(await fichaDesdeLink(destino.toString(), String(indicaciones || "").slice(0, 500)));
        if (!ficha.desc && !ficha.specs.length) {
      // No hay nada útil: no se sobrescribe la ficha del usuario, solo se informa el motivo.
      return NextResponse.json(
        { error: ficha.problema || "No se encontró información técnica del producto en ese link." },
        { status: 422 }
      );
    }
    const photos = (await Promise.all((ficha.imagenes || []).map(imagenComoDataUrl))).filter(
      (p): p is string => Boolean(p)
    );

    return NextResponse.json({ ...ficha, photos, fuente: destino.toString() });
  } catch (error) {
    console.warn("[ai-link]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo leer el link." },
      { status: 502 }
    );
  }
}