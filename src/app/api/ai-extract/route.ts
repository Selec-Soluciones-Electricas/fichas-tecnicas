import { NextRequest, NextResponse } from "next/server";

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
                content: "Eres un extractor fiable de información técnica desde PDFs. Responde solo con JSON válido.",
              },
              {
                role: "user",
                content: `Extrae del siguiente texto un JSON con empresa, titulo, marca, modelo, docCode, desc, notas, contacto. Si no aparece algo, usa cadena vacía. Texto:\n${text}`,
              },
            ],
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const content = data?.message?.content || "{}";
          const parsed = JSON.parse(content);
          return NextResponse.json({ ...fallback, ...parsed });
        }
      } catch {
        // Caer al fallback local si Ollama no está disponible.
      }

      return NextResponse.json({ ...fallback, ...currentData });
    }

    const prompt = `
Eres un extractor experto de fichas técnicas en español.
Tu tarea es leer el texto de un PDF y devolver un JSON con los campos más precisos posibles.

Texto del PDF:
${text}

Datos actuales del usuario (si existen):
${JSON.stringify(currentData || {}, null, 2)}

Requisitos:
- Devuelve SOLO un JSON válido.
- No agregues explicaciones.
- Extrae: empresa, titulo, marca, modelo, docCode, desc, notas, contacto.
- Si no encuentras un valor, usa cadena vacía.
- Para modelo, prioriza el código o referencia del producto.
- Para desc, escribe una descripción breve y clara del producto.
- Para notas, usa texto adicional si existe.
- Para contacto, usa email o web si aparece.

Formato:
{
  "empresa": "",
  "titulo": "",
  "marca": "",
  "modelo": "",
  "docCode": "",
  "desc": "",
  "notas": "",
  "contacto": ""
}
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
        messages: [
          {
            role: "system",
            content: "Eres un extractor fiable de información técnica desde PDFs.",
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
    const parsed = JSON.parse(content);

    return NextResponse.json({ ...fallback, ...parsed });
  } catch (error) {
    console.warn(error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "No se pudo procesar la solicitud.",
    }, { status: 200 });
  }
}
