import { NextRequest, NextResponse } from "next/server";

type Spec = { k: string; v: string };

const RESPONSE_SCHEMA = `{
  "empresa": "",
  "titulo": "",
  "marca": "",
  "modelo": "",
  "docCode": "",
  "desc": "",
  "notas": "",
  "contacto": "",
  "specs": [{ "k": "", "v": "" }]
}`;

const EXTRACTION_RULES = `
Reglas:
- Devuelve SOLO un JSON válido con exactamente estas claves: empresa, titulo, marca, modelo, docCode, desc, notas, contacto, specs.
- No agregues explicaciones, comentarios ni marcado (nada de \`\`\`).
- No inventes datos que no estén respaldados por el texto. Si no encuentras un valor, usa cadena vacía ("") o arreglo vacío ([]).
- "titulo": nombre comercial del producto (no el nombre de la empresa fabricante ni del distribuidor).
- "marca": fabricante del producto.
- "modelo": código o referencia exacta del producto (part number, referencia, código de catálogo).
- "docCode": código interno del documento/ficha si aparece (ej: FT-1234), no el código del producto.
- "desc": 2 a 4 frases claras describiendo qué es el producto, su aplicación y características principales.
- "notas": observaciones, advertencias o información adicional relevante que no sea una característica técnica puntual.
- "contacto": email o sitio web de contacto si aparece.
- "specs": lista de características técnicas del producto como pares clave-valor (ej: {"k":"Tensión bobina","v":"24V AC"}). Incluye únicamente especificaciones reales y concretas (eléctricas, mecánicas, dimensiones, certificaciones, etc.), máximo 15 elementos, cada "k" y "v" concisos (menos de 60 caracteres).
`;

function sanitizeSpecs(rawSpecs: unknown): Spec[] {
  if (!Array.isArray(rawSpecs)) return [];
  return rawSpecs
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const k = String((item as Record<string, unknown>).k ?? "").trim().slice(0, 80);
      const v = String((item as Record<string, unknown>).v ?? "").trim().slice(0, 200);
      if (!k && !v) return null;
      return { k, v };
    })
    .filter((item): item is Spec => item !== null)
    .slice(0, 15);
}

function extractJsonObject(raw: string): Record<string, unknown> {
  const withoutFences = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = withoutFences.indexOf("{");
  const end = withoutFences.lastIndexOf("}");
  const candidate = start >= 0 && end > start ? withoutFences.slice(start, end + 1) : withoutFences;
  return JSON.parse(candidate);
}

function buildFallbackExtraction(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const findLine = (regex: RegExp) => lines.find((line) => regex.test(line)) || "";
  const takeValue = (line: string, regex: RegExp) => line.replace(regex, "").replace(/^[:\-–—\s]+/, "").trim();

  const title = lines.find((line) => line.length > 10 && !/^(marca|modelo|código|codigo|referencia|descripción|descripcion|características|caracteristicas|notas|observaciones|ficha|selec|www\.|@)/i.test(line)) || "";
  const marca = takeValue(findLine(/\bmarca\b/i), /\bmarca\b/i);
  const modelo = takeValue(findLine(/\bmodelo\b/i), /\bmodelo\b/i) || takeValue(findLine(/\breferencia\b/i), /\breferencia\b/i);
  const docCode = findLine(/\bft[-\s]?\d+\b/i).match(/(FT[-\s]?\d+)/i)?.[1]?.toUpperCase().replace(/\s+/g, "-") || "";
  const contacto = findLine(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/) || findLine(/\b(?:selec\.cl|www\.selec\.cl)\b/i) || "";
  const desc = lines
    .slice(0, Math.min(lines.length, 8))
    .filter((line) => !/^(marca|modelo|código|codigo|referencia|descripción|descripcion|características|caracteristicas|notas|observaciones|ficha|selec|www\.|@)/i.test(line))
    .join(" ")
    .trim();
  const notas = lines.find((line) => /\bnotas\b/i.test(line)) || "";

  return {
    empresa: "SELEC",
    titulo: title,
    marca,
    modelo,
    docCode,
    desc,
    notas,
    contacto,
  };
}

export async function POST(req: NextRequest) {
  try {
    const { text, currentData } = await req.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "No se recibió texto del PDF." }, { status: 400 });
    }

    const fallback = buildFallbackExtraction(text);
    const apiKey = process.env.OPENAI_API_KEY;
    const ollamaModel = process.env.OLLAMA_MODEL || "llama3.2";
    const ollamaBaseUrl = (process.env.OLLAMA_HOST || "http://127.0.0.1:11434").replace(/\/$/, "");

    if (!apiKey) {
      try {
        const response = await fetch(`${ollamaBaseUrl}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: ollamaModel,
            stream: false,
            messages: [
              {
                role: "system",
                content: "Eres un extractor fiable de información técnica de productos desde PDFs. Respondes solo con JSON válido.",
              },
              {
                role: "user",
                content: `Extrae del siguiente texto de una ficha técnica un JSON con la información del producto.\n${EXTRACTION_RULES}\nFormato:\n${RESPONSE_SCHEMA}\n\nTexto:\n${text}`,
              },
            ],
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const content = data?.message?.content || "{}";
          const parsed = extractJsonObject(content);
          return NextResponse.json({
            ...fallback,
            ...parsed,
            specs: sanitizeSpecs(parsed.specs),
          });
        }
      } catch {
        // Caer al fallback local si Ollama no está disponible.
      }

      return NextResponse.json({ ...fallback, ...currentData });
    }

    const prompt = `
Eres un extractor experto de fichas técnicas de productos eléctricos/industriales en español.
Tu tarea es leer el texto de un PDF (puede venir desordenado por la extracción de texto) y devolver un JSON con los campos más precisos posibles para rellenar un generador de fichas técnicas.
${EXTRACTION_RULES}
Formato:
${RESPONSE_SCHEMA}

Datos actuales del usuario (úsalos solo como contexto de referencia, prioriza lo que encuentres en el texto):
${JSON.stringify(currentData || {}, null, 2)}

Texto del PDF:
${text}
`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "Eres un extractor fiable de información técnica de productos desde PDFs.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || "Error al contactar con OpenAI.");
    }

    const content = data.choices?.[0]?.message?.content || "{}";
    const parsed = extractJsonObject(content);

    return NextResponse.json({
      ...fallback,
      ...parsed,
      specs: sanitizeSpecs(parsed.specs),
    });
  } catch (error) {
    console.warn(error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "No se pudo procesar la solicitud.",
    }, { status: 200 });
  }
}
