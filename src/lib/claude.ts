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
  fuente?: string;
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
async function llamarClaude(contenido: unknown, conWebFetch: boolean): Promise<FichaIA> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Falta configurar ANTHROPIC_API_KEY en el servidor.");

  const tools: unknown[] = [HERRAMIENTA_FICHA];
  if (conWebFetch) {
    tools.unshift({ type: "web_fetch_20250910", name: "web_fetch", max_uses: 4, max_content_tokens: 60000 });
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
      throw new Error(data?.error?.message || `Error de la API de Claude (${resp.status}).`);
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
${REGLAS_FICHA}
- "imagenes": URLs absolutas de fotos del producto que aparezcan en la página (máximo 4).
${indicaciones ? `\nIndicaciones del usuario: ${indicaciones}` : ""}`,
    true
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
    notas: txt(f.notas, 1500),
    contacto: txt(f.contacto, 200),
    specs,
    imagenes: (Array.isArray(f.imagenes) ? f.imagenes : []).map((u) => txt(u, 1000)).filter(Boolean).slice(0, 4),
  };
}