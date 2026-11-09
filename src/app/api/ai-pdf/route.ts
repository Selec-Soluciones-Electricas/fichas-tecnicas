import { NextRequest, NextResponse } from "next/server";
import { fichaDesdePdf, limpiarFicha } from "@/lib/claude";

export const maxDuration = 120;

/** Tamaño máximo del PDF. La API de Claude acepta hasta 32 MB por solicitud (el PDF va en base64, +33 %). */
const MAX_PDF_BYTES = 20 * 1024 * 1024;
/** Imágenes candidatas que manda el navegador para que Claude elija las fotos del producto. */
const MAX_CANDIDATAS = 10;
const MAX_CANDIDATA_BYTES = 1.5 * 1024 * 1024;

/** "data:image/jpeg;base64,...." -> { media_type, data }, solo formatos que acepta Claude. */
function leerCandidata(valor: FormDataEntryValue): { media_type: string; data: string } | null {
  const m = String(valor).match(/^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/);
  if (!m || m[2].length * 0.75 > MAX_CANDIDATA_BYTES) return null;
  return { media_type: m[1], data: m[2] };
}

/**
 * POST multipart/form-data { archivo: PDF, candidatas?: data URL (varias), indicaciones? }
 * Claude lee el PDF completo (texto e imágenes) y devuelve los datos de la ficha.
 * Las imágenes las extrae el navegador del PDF (pdf.js) y las manda como "candidatas";
 * Claude devuelve en "fotosProducto" cuáles son fotos del producto (descarta logos y marcas).
 */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const archivo = form.get("archivo");
    const indicaciones = String(form.get("indicaciones") || "").slice(0, 500);

    if (!(archivo instanceof File) || archivo.size === 0) {
      return NextResponse.json({ error: "No se recibió ningún PDF." }, { status: 400 });
    }
    if (archivo.size > MAX_PDF_BYTES) {
      return NextResponse.json(
        { error: `El PDF pesa ${(archivo.size / 1024 / 1024).toFixed(1)} MB; el máximo es 20 MB.` },
        { status: 413 }
      );
    }

    const buffer = Buffer.from(await archivo.arrayBuffer());
    // Se valida el contenido real (los PDF empiezan con "%PDF"), no solo la extensión
    if (buffer.subarray(0, 1024).indexOf("%PDF") === -1) {
      return NextResponse.json({ error: "El archivo no es un PDF válido." }, { status: 400 });
    }

    // Se conserva la posición original de cada candidata (la usa el navegador para elegir las fotos)
    const entradas = form.getAll("candidatas").slice(0, MAX_CANDIDATAS);
    const validas = entradas
      .map((v, i) => ({ img: leerCandidata(v), numeroOriginal: i + 1 }))
      .filter((c): c is { img: { media_type: string; data: string }; numeroOriginal: number } => c.img !== null);

    const ficha = limpiarFicha(
      await fichaDesdePdf(buffer.toString("base64"), archivo.name.slice(0, 120), indicaciones, validas.map((c) => c.img))
    );
    // Claude numera las válidas desde 1: se traducen al número original que envió el navegador
    ficha.fotosProducto = (ficha.fotosProducto || [])
      .map((n) => validas[n - 1]?.numeroOriginal)
      .filter((n): n is number => typeof n === "number");
    if (!ficha.desc && !ficha.specs.length) {
      // Nada útil: no se sobrescribe la ficha del usuario, solo se informa el motivo
      return NextResponse.json(
        { error: ficha.problema || "No se encontró información técnica del producto en el PDF." },
        { status: 422 }
      );
    }
    return NextResponse.json(ficha);
  } catch (error) {
    console.warn("[ai-pdf]", error);
    const mensaje = error instanceof Error ? error.message : "No se pudo analizar el PDF.";
    // Mensajes típicos de la API para PDFs con contraseña, dañados o con demasiadas páginas
    const amigable = /password|encrypt/i.test(mensaje)
      ? "El PDF tiene contraseña: quítasela y vuelve a subirlo."
      : /page|páginas/i.test(mensaje)
        ? `El PDF tiene demasiadas páginas para analizarlo (${mensaje}).`
        : mensaje;
    return NextResponse.json({ error: amigable }, { status: 502 });
  }
}