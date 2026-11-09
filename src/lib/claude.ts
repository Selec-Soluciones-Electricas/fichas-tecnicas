/**
 * Llamadas a Claude (API de Anthropic) para armar la ficha técnica.
 *
 * Variables de entorno:
 *   ANTHROPIC_API_KEY   clave de la API (solo en el servidor, nunca llega al navegador)
 *   AI_MODEL            modelo a usar (por defecto claude-sonnet-5-5)
 *
 * La respuesta siempre se obtiene como "tool use" (herramienta registrar_ficha), así llega
 * como JSON con la forma exacta que espera el generador.
 */

export type Spec = { k: string; v: string };

export type FichaIA = {
  empresa?: string;
  titulo: string;
  marca: string;
  modelo: string;
  docCode: string;
  desc: string;
  notas: string;
  contacto?: string;
  specs: Spec[];
  imagenes?: string[];
  fuenteUsada?: string;
  problema?: string;
};

const API_URL = "https://api.anthropic.com/v1/messages";
const MODELO = process.env.AI_MODEL || "claude-sonnet-5-5";

export const REGLAS_FICHA = `
Reglas para la ficha:
- No inventes datos. Si un dato no aparece en la fuente, déjalo vacío ("" o []).
- "titulo": nombre comercial del producto (no el nombre del fabricante ni del distribuidor).
- "marca": fabricante del producto.
- "modelo": código o referencia exacta (part number, referencia de catálogo).
- "docCode": código interno del documento si aparece (ej. FT-1234); no es el código del producto.
- "desc": 2 a 4 frases en español neutro: qué es, para qué sirve y sus características principales.
- "notas": advertencias u observaciones relevantes que no sean una especificación puntual.
- "specs": especificaciones técnicas reales como pares {k, v} (eléctricas, mecánicas, dimensiones,
  certificaciones, etc.), máximo 15, cada "k" y "v" concisos (menos de 60 caracteres), en español.
- Traduce al español neutro lo que venga en otro idioma (sin traducir códigos, modelos ni unidades).
- Nunca escribas en "desc" ni en "notas" explicaciones sobre cómo obtuviste los datos o qué no pudiste leer:
  eso va solo en "problema". "desc" y "notas" se imprimen tal cual en la ficha que verá el cliente.
`;

const HERRAMIENTA_FICHA = {
  name: "registrar_ficha",
  description: "Registra los datos de la ficha técnica del producto.",
  input_schema: {
    type: "object",
    properties: {
      titulo: { type: "string" },
      marca: { type: "string" },
      modelo: { type: "string" },
      docCode: { type: "string" },
      desc: { type: "string" },
      notas: { type: "string" },
      contacto: { type: "string", description: "Email o sitio web de contacto si aparece" },
      specs: {
        type: "array",
        items: {
          type: "object",
          properties: { k: { type: "string" }, v: { type: "string" } },
          required: ["k", "v"],
        },
      },
      fuenteUsada: { type: "string", description: "URL de donde salieron finalmente los datos" },
      problema: {
        type: "string",
        description: "Solo si no pudiste obtener los datos completos: explicación breve para el usuario. Vacío si todo salió bien.",
      },
      imagenes: {
        type: "array",
        items: { type: "string" },
        description: "URLs absolutas (https) de fotos del producto que aparezcan en la página, máximo 4. Sin logos, íconos ni banners.",
      },
    },
    required: ["titulo", "marca", "modelo", "desc", "specs"],
  },
};

type Bloque = { type: string; name?: string; input?: unknown; text?: string };

/** Envía la conversación a Claude, siguiendo turnos pausados (pause_turn) de herramientas del servidor. */
async function llamarClaude(contenido: unknown, conWeb: boolean, conBusqueda = conWeb): Promise<FichaIA> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Falta configurar ANTHROPIC_API_KEY en el servidor.");

  const tools: unknown[] = [HERRAMIENTA_FICHA];
  if (conWeb) {
    tools.unshift({ type: "web_fetch_20250910", name: "web_fetch", max_uses: 5, max_content_tokens: 60000 });
  }
  if (conWeb && conBusqueda && process.env.AI_WEB_SEARCH !== "off") {
    // Para tiendas que cargan el producto con JavaScript: busca la página oficial o el datasheet.
    tools.unshift({ type: "web_search_20250305", name: "web_search", max_uses: 3 });
  }

  const mensajes: { role: string; content: unknown }[] = [{ role: "user", content: contenido }];
  for (let intento = 0; intento < 4; intento++) {
    const resp = await fetch(API_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODELO,
        max_tokens: 4000,
        system:
          "Eres un especialista en productos eléctricos e industriales de SELEC. Preparas fichas técnicas " +
          "precisas en español neutro a partir de la información que se te entrega. Respondes SIEMPRE " +
          "llamando a la herramienta registrar_ficha una sola vez.",
        tools,
        tool_choice: { type: "auto" },
        messages: mensajes,
      }),
    });
    const data = await resp.json();
    if (!resp.ok) {
      const mensaje: string = data?.error?.message || `Error de la API de Claude (${resp.status}).`;
      // Si la búsqueda web no está habilitada en la organización, se reintenta solo con web_fetch.
      if (conBusqueda && /web_search/i.test(mensaje)) return llamarClaude(contenido, conWeb, false);
      throw new Error(mensaje);
    }
    const bloques: Bloque[] = data.content || [];
    const ficha = bloques.find((b) => b.type === "tool_use" && b.name === "registrar_ficha");
    if (ficha) return ficha.input as FichaIA;

    if (data.stop_reason === "pause_turn") {
      // Claude sigue trabajando con web_fetch: se reenvía para que continúe.
      mensajes.push({ role: "assistant", content: bloques });
      continue;
    }
    const texto = bloques.filter((b) => b.type === "text").map((b) => b.text).join(" ").slice(0, 300);
    throw new Error(texto || "Claude no devolvió la ficha.");
  }
  throw new Error("Claude no terminó de leer la fuente. Intenta de nuevo.");
}

/** Ficha a partir del texto extraído de un PDF (o pegado por el usuario). */
export function fichaDesdeTexto(texto: string, datosActuales?: unknown): Promise<FichaIA> {
  return llamarClaude(
    `Arma la ficha técnica con el siguiente texto (puede venir desordenado porque se extrajo de un PDF).
${REGLAS_FICHA}
Datos que el usuario ya ingresó (úsalos solo como referencia; prioriza lo que diga el texto):
${JSON.stringify(datosActuales || {}, null, 2)}

Texto:
${texto.slice(0, 120000)}`,
    false
  );
}

/** Ficha a partir de un link (página del fabricante o PDF). Claude lo lee con web_fetch. */
export function fichaDesdeLink(url: string, indicaciones = ""): Promise<FichaIA> {
  return llamarClaude(
    `Lee este link del producto y arma su ficha técnica: ${url}
Si la página tiene un link a la ficha técnica o datasheet en PDF del mismo producto, léelo también para completar las especificaciones.
Muchas tiendas (ej. pcfactory, falabella, mercadolibre) cargan el producto con JavaScript y web_fetch solo trae
el encabezado del sitio. Si eso pasa, o la página no trae especificaciones: identifica marca y modelo exacto
(desde el título, la URL o el código), búscalos con web_search y lee con web_fetch la página oficial del
fabricante o su datasheet. Prefiere siempre fuentes del fabricante. Indica en "fuenteUsada" de dónde salieron los datos.
${REGLAS_FICHA}
- "imagenes": URLs absolutas de fotos del producto que aparezcan en la página (máximo 4).
${indicaciones ? `\nIndicaciones del usuario: ${indicaciones}` : ""}`,
    true
  );
}


/**
 * Ficha a partir de un archivo PDF subido por el usuario (base64, sin el prefijo data:).
 * Claude recibe el PDF completo (texto e imágenes de cada página), así que también
 * lee tablas, PDFs escaneados y fichas en otro idioma.
 */
export function fichaDesdePdf(pdfBase64: string, nombreArchivo = "", indicaciones = ""): Promise<FichaIA> {
  return llamarClaude(
    [
      {
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: pdfBase64 },
      },
      {
        type: "text",
        text: `Este PDF${nombreArchivo ? ` ("${nombreArchivo}")` : ""} es la ficha técnica, catálogo o datasheet de un producto.
Arma su ficha técnica con lo que dice el documento (incluye tablas e imágenes con texto).
Si el PDF trae varios modelos o variantes, usa el modelo principal o el que indique el usuario, y pon en "specs" solo los valores de ese modelo.
Si el documento no es de un producto o no se puede leer, deja los campos vacíos y explica el motivo en "problema".
${REGLAS_FICHA}
- "imagenes": déjalo vacío (las fotos se extraen del PDF por separado).
${indicaciones ? `\nIndicaciones del usuario: ${indicaciones}` : ""}`,
      },
    ],
    false
  );
}


/** Deja la ficha con la forma y los largos que espera el generador. */
export function limpiarFicha(f: Partial<FichaIA>): FichaIA {
  const txt = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
  const specs = (Array.isArray(f.specs) ? f.specs : [])
    .map((s) => ({ k: txt(s?.k, 80), v: txt(s?.v, 200) }))
    .filter((s) => s.k || s.v)
    .slice(0, 15);
  return {
    titulo: txt(f.titulo, 200),
    marca: txt(f.marca, 120),
    modelo: txt(f.modelo, 120),
    docCode: txt(f.docCode, 60),
    desc: txt(f.desc, 2000),
    // Las notas las escribe el usuario; la IA solo las completa si AI_NOTAS=on
    notas: process.env.AI_NOTAS === "on" ? txt(f.notas, 1500) : "",    contacto: txt(f.contacto, 200),
    fuenteUsada: txt(f.fuenteUsada, 1000),
    problema: txt(f.problema, 250),
    specs,
    imagenes: (Array.isArray(f.imagenes) ? f.imagenes : []).map((u) => txt(u, 1000)).filter(Boolean).slice(0, 4),
  };
}