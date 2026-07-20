"use client";

import { useEffect, useMemo, useState } from "react";
import defaultLogo from "@/img/Alta resolución.jpg";
import FichaHeader from "./FichaHeader";
import FichaBody from "./FichaBody";
import FichaFooter from "./FichaFooter";

type Spec = { k: string; v: string; img: string | null };

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const CONTACTO_DEFAULT = "info@selec.cl · selec.cl";
const EMPRESA_DEFAULT = "SELEC";

export default function FichaTecnicaGenerator() {
  const [empresa, setEmpresa] = useState(EMPRESA_DEFAULT);
  const [titulo, setTitulo] = useState("");
  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");
  const [docCode, setDocCode] = useState("");
  const [desc, setDesc] = useState("");
  const [notas, setNotas] = useState("");
  const [contacto, setContacto] = useState(CONTACTO_DEFAULT);

  const [logo, setLogo] = useState<string | null>(defaultLogo.src);
  const [photos, setPhotos] = useState<string[]>([]);
  const [specs, setSpecs] = useState<Spec[]>([
    { k: "", v: "", img: null },
    { k: "", v: "", img: null },
    { k: "", v: "", img: null },
  ]);
  const [lastPdfText, setLastPdfText] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiNotice, setAiNotice] = useState("");

  const fecha = useMemo(() => {
    const d = new Date();
    return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
  }, []);

  // ---------- Utilidades ----------
  const readFile = (f: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(f);
    });

  const addPhoto = (dataUrl: string) => setPhotos((prev) => [...prev, dataUrl]);

  // ---------- Pegar (Ctrl+V) imágenes ----------
  // Si el foco está en un campo "Valor" de una spec -> la imagen va a esa spec.
  // En cualquier otro caso -> se agrega a las fotos.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items ?? [];
      let file: File | null = null;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image")) {
          file = items[i].getAsFile();
          break;
        }
      }
      if (!file) return;
      e.preventDefault();

      const active = document.activeElement as HTMLElement | null;
      const specIdxAttr = active?.dataset?.specIdx;

      readFile(file).then((dataUrl) => {
        if (specIdxAttr !== undefined) {
          const idx = parseInt(specIdxAttr, 10);
          setSpecs((prev) =>
            prev.map((s, i) => (i === idx ? { ...s, img: dataUrl } : s))
          );
        } else {
          addPhoto(dataUrl);
        }
      });
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, []);

  // ---------- Handlers de archivos ----------
  const onLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setLogo(await readFile(f));
  };

  const onPhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    for (const f of files) addPhoto(await readFile(f));
    e.target.value = "";
  };

  // ---------- Specs ----------
  const updateSpec = (idx: number, patch: Partial<Spec>) =>
    setSpecs((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  const removeSpec = (idx: number) =>
    setSpecs((prev) => prev.filter((_, i) => i !== idx));
  const addSpec = () =>
    setSpecs((prev) => [...prev, { k: "", v: "", img: null }]);

  // ---------- PDF ----------
  const downloadPdf = () => setTimeout(() => window.print(), 50);

  // ---------- Exportar / importar ----------
  const exportJson = () => {
    const data = {
      empresa, titulo, marca, modelo, docCode, desc, notas, contacto,
      specs, logo, photos,
    };
    const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    const nm = (modelo.trim() || "ficha-tecnica").replace(/[^a-zA-Z0-9_-]+/g, "-");
    a.download = `FT-${nm}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const readArrayBuffer = (f: File): Promise<ArrayBuffer> =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as ArrayBuffer);
      r.onerror = reject;
      r.readAsArrayBuffer(f);
    });

  const applyFichaData = (d: Partial<{
    empresa: string;
    titulo: string;
    marca: string;
    modelo: string;
    docCode: string;
    desc: string;
    notas: string;
    contacto: string;
    specs: Spec[];
    logo: string | null;
    photos: string[];
  }>) => {
    setEmpresa(d.empresa || EMPRESA_DEFAULT);
    setTitulo(d.titulo || "");
    setMarca(d.marca || "");
    setModelo(d.modelo || "");
    setDocCode(d.docCode || "");
    setDesc(d.desc || "");
    setNotas(d.notas || "");
    setContacto(d.contacto || CONTACTO_DEFAULT);
    setSpecs(
      Array.isArray(d.specs) && d.specs.length
        ? d.specs.map((s) => ({ k: s.k || "", v: s.v || "", img: s.img || null }))
        : [{ k: "", v: "", img: null }]
    );
    setPhotos(Array.isArray(d.photos) ? d.photos.slice() : []);
    setLogo(d.logo ?? defaultLogo.src);
  };

  const importJsonFile = (f: File) => {
    const r = new FileReader();
    r.onload = () => {
      try {
        const d = JSON.parse(r.result as string);
        applyFichaData(d);
      } catch {
        alert("El archivo no es un JSON válido de ficha técnica.");
      }
    };
    r.readAsText(f);
  };

  const cleanPdfLine = (line: string) => {
    let normalized = line.replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();
    normalized = normalized.replace(/^[•·▪*-]\s*/, "");
    normalized = normalized.replace(/^(p[áa]gina|page)\s*\d+$/i, "");
    return normalized;
  };

  const extractCoreFieldsFromText = (text: string) => {
    const normalizedText = text.replace(/\s+/g, " ").trim();
    const lines = text
      .split(/\r?\n/)
      .map(cleanPdfLine)
      .filter((line) => !isNoiseLine(line));

    const findValueFromText = (regex: RegExp) => {
      const match = normalizedText.match(regex);
      return match?.[1]?.trim() || "";
    };

    const marca = findValueFromText(/\b(?:marca|fabricante|brand)\b[^A-Za-zÁÉÍÓÚÑáéíóúñ0-9]{0,6}([A-Za-zÁÉÍÓÚÑáéíóúñ0-9/._-]{1,60})/i) ||
      extractFieldValueFromLines(lines, [/^marca\b/i, /^fabricante\b/i, /^brand\b/i]);

    const modelo = findValueFromText(/\b(?:modelo|referencia|part\s*number|código|codigo)\b[^A-Za-zÁÉÍÓÚÑáéíóúñ0-9]{0,6}([A-Za-zÁÉÍÓÚÑáéíóúñ0-9/._-]{1,60})/i) ||
      extractFieldValueFromLines(lines, [/^modelo\b/i, /^referencia\b/i, /^part\s*number\b/i, /^c[oó]digo\b/i, /^codigo\b/i]);

    const docCode = normalizedText.match(/\b(FT[-\s]?\d+)\b/i)?.[1]?.toUpperCase().replace(/\s+/g, "-") ||
      extractCodeValueFromLines(lines);

    const title = pickBestCandidate(
      lines.filter((line) => line.length > 8 && !/^(marca|modelo|fabricante|referencia|código|codigo|descripción|descripcion|características|caracteristicas|notas|observaciones|ficha|selec|www\.|@)/i.test(line)),
      scoreTitleCandidate
    ) || lines.find((line) => line.length > 12) || "";

    const desc = lines
      .filter((line) => line.length > 12 && !/^(marca|modelo|fabricante|referencia|código|codigo|descripción|descripcion|características|caracteristicas|notas|observaciones|ficha|selec|www\.|@)/i.test(line))
      .slice(0, 6)
      .join(" ") ||
      lines.find((line) => line.length > 20) || "";

    const contacto = normalizedText.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/)?.[0] ||
      normalizedText.match(/\b(?:selec\.cl|www\.selec\.cl)\b/i)?.[0] || "";

    return {
      titulo: title,
      marca,
      modelo: modelo || docCode,
      docCode,
      desc,
      contacto,
    };
  };

  const isNoiseLine = (line: string) => {
    const normalized = line.toLowerCase();
    return (
      !normalized ||
      /^(p[áa]gina|page)\s*\d+$/i.test(normalized) ||
      /^(ficha\s*t[eé]cnica|características técnicas|caracteristicas tecnicas|descripción|descripcion|notas|observaciones|observación)$/i.test(normalized)
    );
  };

  const findBestLine = (lines: string[], predicate: (line: string) => boolean) =>
    lines.find((line) => predicate(line)) || "";

  const extractFieldValue = (line: string, regex: RegExp) => {
    const match = line.match(regex);
    if (!match) return "";
    const value = (match[1] ?? line.replace(regex, "")).trim();
    return value.replace(/^[:\-–—]\s*/, "").trim();
  };

  const scoreTitleCandidate = (line: string, index: number, total: number) => {
    const normalized = line.toLowerCase();
    let score = 0;

    if (line.length >= 10) score += 3;
    if (line.length >= 25) score += 3;
    if (index <= 4) score += 3;
    if (index <= Math.max(0, total - 2)) score += 1;
    if (!/[.:;]/.test(line)) score += 2;
    if (!/\b(marca|modelo|fabricante|referencia|código|codigo|descripción|descripcion|características|caracteristicas|notas|observaciones|ficha|empresa|selec|www\.|@)\b/i.test(normalized)) score += 4;
    if (/^[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ0-9\s/\-]+$/.test(line)) score += 2;
    if (/\d/.test(line)) score -= 2;

    return score;
  };

  const pickBestCandidate = (lines: string[], scorer: (line: string, index: number, total: number) => number) => {
    const scored = lines
      .map((line, index) => ({ line, score: scorer(line, index, lines.length) }))
      .filter((item) => item.line.length > 3 && item.score > 0)
      .sort((a, b) => b.score - a.score);

    return scored[0]?.line || "";
  };

  const isValueLike = (line: string) => {
    const normalized = line.trim();
    if (!normalized) return false;
    if (/^(marca|modelo|código|codigo|referencia|descripción|descripcion|características|caracteristicas|notas|observaciones|ficha técnica|selec|www\.|@)/i.test(normalized)) return false;
    if (normalized.length > 120) return false;
    return !/[;:]{2,}/.test(normalized);
  };

  const extractFieldValueFromLines = (lines: string[], labelPatterns: RegExp[]) => {
    const candidates: Array<{ value: string; score: number }> = [];

    lines.forEach((line, index) => {
      const normalized = cleanPdfLine(line);
      if (!normalized) return;

      const labelMatch = labelPatterns.find((pattern) => pattern.test(normalized));
      if (!labelMatch) return;

      const valueFromInline = normalized
        .replace(labelMatch, "")
        .replace(/^[:\-–—\s]+/, "")
        .trim();

      if (valueFromInline && isValueLike(valueFromInline)) {
        candidates.push({ value: valueFromInline, score: 18 + (index <= 8 ? 4 : 0) });
      }

      if (normalized.match(labelMatch) && index + 1 < lines.length) {
        const nextLine = cleanPdfLine(lines[index + 1]);
        if (nextLine && isValueLike(nextLine) && nextLine.length < 80) {
          candidates.push({ value: nextLine, score: 22 + (index <= 8 ? 4 : 0) });
        }
      }
    });

    const ranked = candidates.sort((a, b) => b.score - a.score);
    return ranked[0]?.value || "";
  };

  const extractCodeValueFromLines = (lines: string[]) => {
    const candidates: Array<{ value: string; score: number }> = [];
    lines.forEach((line, index) => {
      const normalized = cleanPdfLine(line);
      if (!normalized) return;

      const directMatch = normalized.match(/\b(FT[-\s]?\d+)\b/i);
      if (directMatch) {
        candidates.push({ value: directMatch[1].toUpperCase().replace(/\s+/g, "-"), score: 20 + (index <= 6 ? 4 : 0) });
      }

      const codeLabelMatch = normalized.match(/^(?:c[oó]digo|codigo|ref(?:erencia)?|n[°º]?)\b[^\w]*(.*)$/i);
      if (codeLabelMatch?.[2]) {
        const value = codeLabelMatch[2].trim().replace(/^[:\-–—\s]+/, "");
        if (value && isValueLike(value)) {
          candidates.push({ value, score: 16 + (index <= 6 ? 3 : 0) });
        }
      }

      if (index + 1 < lines.length) {
        const nextLine = cleanPdfLine(lines[index + 1]);
        const looksLikeCode = /^(ft[-\s]?\d+|[A-Z0-9._/-]{2,})$/i.test(nextLine);
        if (codeLabelMatch && nextLine && looksLikeCode) {
          candidates.push({ value: nextLine, score: 22 });
        }
      }
    });

    const ranked = candidates.sort((a, b) => b.score - a.score);
    return ranked[0]?.value || "";
  };

  const extractSpecLine = (line: string): Spec | null => {
    const normalized = cleanPdfLine(line);
    if (!normalized || normalized.length < 3) return null;

    const labelValueMatch = normalized.match(/^([^:–—-]{1,60})\s*[:–—-]\s*(.+)$/);
    if (labelValueMatch) {
      const key = labelValueMatch[1].trim();
      const value = labelValueMatch[2].trim();
      if (key && value && !/^(marca|modelo|código|codigo|descripción|descripcion|notas|observaciones)$/i.test(key)) {
        return { k: key, v: value, img: null };
      }
    }

    const parts = normalized.split(/\s{2,}/).map((item) => item.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const [key, ...rest] = parts;
      return { k: key, v: rest.join(" "), img: null };
    }

    const words = normalized.split(/\s+/);
    if (words.length > 2) {
      return { k: words.slice(0, -1).join(" "), v: words.at(-1) ?? "", img: null };
    }

    return null;
  };

  const parsePdfText = async (buffer: ArrayBuffer): Promise<string> => {
    const pdfjsLib: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
    pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    const doc = await pdfjsLib.getDocument({ data: buffer }).promise;

    const pageLines: string[] = [];
    for (let i = 1; i <= doc.numPages; i += 1) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const items = (content.items ?? [])
        .filter((item: any) => typeof item.str === "string" && item.str.trim())
        .map((item: any) => ({
          str: item.str.trim(),
          x: item.transform?.[4] ?? 0,
          y: item.transform?.[5] ?? 0,
        }));

      const grouped = new Map<number, Array<{ str: string; x: number }>>();
      items.forEach((item: { str: string; x: number; y: number }) => {
        const key = Math.round(item.y / 4) * 4;
        const bucket = grouped.get(key) ?? [];
        bucket.push(item);
        grouped.set(key, bucket);
      });

      const pageText = Array.from(grouped.entries())
        .sort((a, b) => b[0] - a[0])
        .map(([, bucket]) =>
          bucket
            .sort((a, b) => a.x - b.x)
            .map((entry) => entry.str)
            .join(" ")
        )
        .filter(Boolean);

      pageLines.push(...pageText);
    }

    return pageLines.join("\n");
  };

  const extractWithAi = async (
    sourceText = lastPdfText,
    baseData?: Partial<{
      empresa: string;
      titulo: string;
      marca: string;
      modelo: string;
      docCode: string;
      desc: string;
      notas: string;
      contacto: string;
      specs: Spec[];
      logo: string | null;
      photos: string[];
    }>
  ) => {
    const text = sourceText?.trim();
    if (!text) return;

    const currentData = {
      empresa: baseData?.empresa ?? empresa,
      titulo: baseData?.titulo ?? titulo,
      marca: baseData?.marca ?? marca,
      modelo: baseData?.modelo ?? modelo,
      docCode: baseData?.docCode ?? docCode,
      desc: baseData?.desc ?? desc,
      notas: baseData?.notas ?? notas,
      contacto: baseData?.contacto ?? contacto,
      specs: baseData?.specs ?? specs,
      logo: baseData?.logo ?? logo,
      photos: baseData?.photos ?? photos,
    };

    setIsAiLoading(true);
    setAiNotice("Analizando el PDF y completando los datos...");

    try {
      const response = await fetch("/api/ai-extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, currentData }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "No se pudo analizar el PDF con IA.");
      }

      const nextData = {
        empresa: payload.empresa || currentData.empresa || EMPRESA_DEFAULT,
        titulo: payload.titulo || currentData.titulo || "",
        marca: payload.marca || currentData.marca || "",
        modelo: payload.modelo || currentData.modelo || "",
        docCode: payload.docCode || currentData.docCode || "",
        desc: payload.desc || currentData.desc || "",
        notas: payload.notas || currentData.notas || "",
        contacto: payload.contacto || currentData.contacto || CONTACTO_DEFAULT,
        specs: Array.isArray(payload.specs) && payload.specs.length
          ? payload.specs.map((s: { k?: string; v?: string; img?: string | null }) => ({ k: s.k || "", v: s.v || "", img: s.img || null }))
          : currentData.specs,
        logo: payload.logo ?? currentData.logo ?? defaultLogo.src,
        photos: Array.isArray(payload.photos) ? payload.photos : currentData.photos,
      };

      applyFichaData(nextData);
      setAiNotice("Datos completados automáticamente.");
    } catch (error) {
      console.warn(error);
      setAiNotice("Se aplicó la extracción automática con los datos detectados.");
    } finally {
      setIsAiLoading(false);
    }
  };

  const importPdfFile = async (f: File) => {
    try {
      const buffer = await readArrayBuffer(f);
      const rawText = await parsePdfText(buffer);
      setLastPdfText(rawText);
      const lines = rawText
        .split(/\r?\n/)
        .map(cleanPdfLine)
        .filter((line) => !isNoiseLine(line));

      const titleMarker = lines.findIndex((line) => /ficha\s*t[eé]cnica/i.test(line));
      const titleCandidates = titleMarker >= 0
        ? lines.slice(titleMarker + 1)
        : lines;
      const title = pickBestCandidate(
        titleCandidates,
        scoreTitleCandidate
      ) || (titleMarker >= 0 ? lines[titleMarker + 1] || "" : "");

      const extractedFromText = extractCoreFieldsFromText(rawText);
      const marca = extractedFromText.marca || extractFieldValueFromLines(lines, [/^marca\b/i, /^fabricante\b/i, /^brand\b/i]);
      const modelo = extractedFromText.modelo || extractFieldValueFromLines(lines, [/^modelo\b/i, /^referencia\b/i, /^part\s*number\b/i, /^c[oó]digo\b/i, /^codigo\b/i]);
      const docCode = extractedFromText.docCode || extractCodeValueFromLines(lines);
      const contactLine = findBestLine(lines, (line) => /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/.test(line));
      const websiteLine = findBestLine(lines, (line) => /\b(?:selec\.cl|www\.selec\.cl)\b/i.test(line));
      const contactoPdf = [contactLine, websiteLine].filter(Boolean).join(" · ") || extractedFromText.contacto || CONTACTO_DEFAULT;

      const specsStart = lines.findIndex((line) => /caracter[ií]sticas? t[eé]cnicas?/i.test(line));
      const notesIndex = lines.findIndex((line) => /(notas?|observaciones?)/i.test(line));
      const descStart = lines.findIndex((line) => /descripc(i|ó)n/i.test(line));
      const descEnd = [specsStart, notesIndex, lines.length].filter((index) => index >= 0).sort((a, b) => a - b)[0] ?? lines.length;

      let desc = "";
      if (descStart >= 0) {
        desc = lines.slice(descStart + 1, descEnd).join(" ");
      } else {
        const rangeStart = titleMarker >= 0 ? titleMarker + 1 : 0;
        desc = lines
          .slice(rangeStart, descEnd)
          .filter((line) => !/^(marca|modelo|fabricante|código|codigo|referencia|descripción|descripcion|características técnicas|caracteristicas tecnicas|notas|observaciones)/i.test(line))
          .join(" ");
      }

      const specsBlock = specsStart >= 0 ? lines.slice(specsStart + 1, notesIndex >= 0 ? notesIndex : lines.length) : [];
      const specs = specsBlock
        .map((line) => extractSpecLine(line))
        .filter((spec): spec is Spec => spec !== null)
        .slice(0, 8);

      const notes = notesIndex >= 0 ? lines.slice(notesIndex + 1).join(" ") : "";

      const heuristicData = {
        empresa: EMPRESA_DEFAULT,
        titulo: extractedFromText.titulo || title,
        marca,
        modelo,
        docCode,
        desc: extractedFromText.desc || desc,
        notas: notes,
        contacto: contactoPdf,
        specs: specs.length ? specs : [{ k: "", v: "", img: null }],
        logo: defaultLogo.src,
        photos: [],
      };

      applyFichaData(heuristicData);
      setLastPdfText(rawText);
      await extractWithAi(rawText, heuristicData);
    } catch (error) {
      console.error(error);
      alert("No se pudo leer el PDF. Asegúrate de que sea una ficha técnica válida.");
    }
  };

  const importFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")) {
      await importPdfFile(f);
    } else {
      importJsonFile(f);
    }
    e.target.value = "";
  };

  const nPhotos = photos.length;

  return (
    <>
      <div className="topbar">
        <div className="brand">
          
          {logo && (
            <img className="ft-logo" src={logo} alt={empresa} />
          )}

          <div>
            <h1>Generador de Fichas Técnicas</h1>
            <span>Foto(s) + título + especificaciones → PDF (A4)</span>
          </div>
        </div>
        <div className="actions">
          <label className="btn" style={{ cursor: "pointer" }}>
            Importar datos
            <input type="file" accept=".json,.pdf" onChange={importFile} style={{ display: "none" }} />
          </label>
          <button className="btn primary" onClick={downloadPdf}>Descargar PDF</button>
        </div>
      </div>
      {aiNotice ? <div className="ai-status">{aiNotice}</div> : null}

      <div className="main">
        {/* ================= EDITOR ================= */}
        <aside className="editor">


          <h2>Fotografías del producto</h2>
          <div className="field">
            <label>Subir foto(s) — puedes seleccionar varias</label>
            <div className={`file-drop${nPhotos ? " loaded" : ""}`}>
              <span>
                {nPhotos
                  ? `${nPhotos} foto(s) cargada(s) — clic para añadir más`
                  : "Haz clic para subir foto(s)"}
              </span>
              <input type="file" accept="image/*" multiple onChange={onPhotos} />
            </div>
            <div className="paste-zone" tabIndex={0}>
              Haz clic aquí y pega (<b>Ctrl+V</b>) una captura de pantalla
            </div>
            <div className="thumbs">
              {photos.map((src, idx) => (
                <div className="thumb" key={idx}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={`foto ${idx + 1}`} />
                  <button
                    className="rm"
                    title="Quitar"
                    onClick={() => setPhotos((prev) => prev.filter((_, i) => i !== idx))}
                  >×</button>
                </div>
              ))}
            </div>
          </div>

          <h2>Producto</h2>
          <div className="field">
            <label>Título del producto</label>
            <input type="text" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej: Contactor Siemens 3RT2015-1AP01" />
          </div>
          <div className="field">
            <label>Marca</label>
            <input type="text" value={marca} onChange={(e) => setMarca(e.target.value)} placeholder="Ej: Siemens" />
          </div>
          <div className="field">
            <label>Modelo / Código</label>
            <input type="text" value={modelo} onChange={(e) => setModelo(e.target.value)} placeholder="Ej: 3RT2015-1AP01" />
          </div>
          <div className="field">
            <label>Código del documento (opcional)</label>
            <input type="text" value={docCode} onChange={(e) => setDocCode(e.target.value)} placeholder="Ej: FT-2026-0142" />
          </div>
          <div className="field">
            <label>Descripción</label>
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Descripción general del producto, aplicación, características principales..." />
          </div>

          <h2>Características técnicas</h2>
          <div>
            {specs.map((s, idx) => (
              <div className="spec-row" key={idx}>
                <input
                  className="k"
                  type="text"
                  placeholder="Característica (ej: Tensión bobina)"
                  value={s.k}
                  onChange={(e) => updateSpec(idx, { k: e.target.value })}
                />
                <input
                  className={`v${s.img ? " has-img" : ""}`}
                  type="text"
                  data-spec-idx={idx}
                  placeholder={s.img ? "🖼 imagen pegada — texto opcional" : "Valor (texto o pega imagen con Ctrl+V)"}
                  value={s.v}
                  onChange={(e) => updateSpec(idx, { v: e.target.value })}
                />
                <button className="del" title="Eliminar fila" onClick={() => removeSpec(idx)}>×</button>
              </div>
            ))}
          </div>
          <button className="add-spec" onClick={addSpec}>+ Agregar característica</button>
          <div className="hint">
            Para pegar una imagen en una característica: haz clic en su campo <i>Valor</i> y pega con <b>Ctrl+V</b>.
          </div>



        </aside>

        {/* ================= VISTA PREVIA ================= */}
        <div className="preview-zone">
          <div className="sheet">
            <div className="sheet-inner">
              <FichaHeader logo={logo} empresa={empresa} docCode={docCode} />
              {/* bar yellow */}
                  <div className="volt-bar"/> 

              <FichaBody
                titulo={titulo}
                marca={marca}
                modelo={modelo}
                desc={desc}
                photos={photos}
                specs={specs}
                notes={notas}
              />

              <FichaFooter empresa={empresa} contacto={contacto} fecha={fecha} />
            </div>
          </div>
          <div className="sheet-print-footer">
            <FichaFooter empresa={empresa} contacto={contacto} fecha={fecha} />
          </div>
        </div>
      </div>

      <style jsx global>{`
        :root {
          --ink: #1a1d21; --steel: #5c6670; --line: #d8dce0;
          --amber: #f5a800; --amber-dark: #c78a00; --paper: #ffffff;
          --editor-bg: #16181c; --editor-panel: #1e2126; --editor-line: #2c3038;
          --editor-text: #e7e9ec; --editor-muted: #8b929c;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; }
        body {
          font-family: var(--font-archivo), sans-serif; background: var(--editor-bg);
          color: var(--editor-text); display: flex; flex-direction: column;
          height: 100vh; overflow: hidden;
        }
        .topbar {
          display: flex; align-items: center; justify-content: space-between;
          padding: 12px 20px; background: var(--editor-panel);
          border-bottom: 1px solid var(--editor-line); flex-shrink: 0;
        }
        .topbar .brand { display: flex; align-items: center; gap: 10px; }
        .topbar .brand .bolt {
          width: 26px; height: 26px; background: var(--amber);
          display: flex; align-items: center; justify-content: center;
          font-weight: 900; color: var(--ink); font-size: 15px;
        }
        .topbar .brand h1 { font-size: 15px; font-weight: 700; letter-spacing: .02em; }
        .topbar .brand span { font-size: 11px; color: var(--editor-muted); display: block; font-weight: 400; }
        .topbar .actions { display: flex; gap: 8px; }
        .btn {
          font-family: var(--font-archivo), sans-serif; font-size: 13px; font-weight: 600;
          padding: 8px 16px; border: 1px solid var(--editor-line);
          background: transparent; color: var(--editor-text); cursor: pointer;
          transition: background .15s, border-color .15s;
        }
        .btn:hover { background: var(--editor-line); }
        .btn.primary { background: var(--amber); border-color: var(--amber); color: var(--ink); }
        .btn.primary:hover { background: var(--amber-dark); border-color: var(--amber-dark); }
        .main { display: flex; flex: 1; overflow: hidden; }
        .editor {
          width: 380px; flex-shrink: 0; overflow-y: auto;
          background: var(--editor-panel); border-right: 1px solid var(--editor-line); padding: 20px;
        }
        .editor h2 {
          font-size: 11px; font-weight: 700; letter-spacing: .12em;
          text-transform: uppercase; color: var(--amber);
          margin: 22px 0 10px; padding-bottom: 6px; border-bottom: 1px solid var(--editor-line);
        }
        .editor h2:first-child { margin-top: 0; }
        .field { margin-bottom: 12px; }
        .field label { display: block; font-size: 12px; color: var(--editor-muted); margin-bottom: 5px; font-weight: 500; }
        .hint { font-size: 11px; color: var(--editor-muted); margin-top: 8px; line-height: 1.4; }
        .field input[type=text], .field textarea {
          width: 100%; padding: 8px 10px; background: var(--editor-bg);
          border: 1px solid var(--editor-line); color: var(--editor-text);
          font-family: var(--font-archivo), sans-serif; font-size: 13px;
        }
        .field input:focus, .field textarea:focus { outline: none; border-color: var(--amber); }
        .field textarea { resize: vertical; min-height: 64px; }
        .file-drop {
          border: 1px dashed var(--editor-line); padding: 14px; text-align: center;
          cursor: pointer; font-size: 12px; color: var(--editor-muted);
          transition: border-color .15s; position: relative;
        }
        .file-drop:hover { border-color: var(--amber); }
        .file-drop input { position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; }
        .file-drop.loaded { border-style: solid; border-color: var(--amber); color: var(--editor-text); }
        .file-clear {
          font-size: 11px; color: var(--editor-muted); background: none; border: none;
          cursor: pointer; text-decoration: underline; margin-top: 4px;
        }
        .file-clear:hover { color: var(--editor-text); }
        .paste-zone {
          margin-top: 8px; border: 1px dashed var(--editor-line); padding: 12px;
          text-align: center; font-size: 11.5px; color: var(--editor-muted);
          cursor: text; transition: border-color .15s, background .15s; outline: none;
        }
        .paste-zone:focus { border-color: var(--amber); color: var(--editor-text); background: var(--editor-bg); }
        .paste-zone b { color: var(--amber); font-weight: 600; }
        .thumbs { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
        .thumb {
          position: relative; width: 64px; height: 64px; border: 1px solid var(--editor-line);
          background: var(--editor-bg); overflow: hidden; flex-shrink: 0;
        }
        .thumb img { width: 100%; height: 100%; object-fit: cover; }
        .thumb .rm {
          position: absolute; top: 2px; right: 2px; width: 18px; height: 18px; line-height: 1;
          background: rgba(0,0,0,.65); color: #fff; border: none; cursor: pointer;
          font-size: 13px; border-radius: 2px;
        }
        .thumb .rm:hover { background: #c0392b; }
        .spec-row { display: flex; gap: 6px; margin-bottom: 6px; align-items: center; }
        .spec-row input {
          padding: 7px 9px; background: var(--editor-bg); border: 1px solid var(--editor-line);
          color: var(--editor-text); font-size: 12.5px; font-family: var(--font-archivo), sans-serif; min-width: 0;
        }
        .spec-row .k { flex: 1.1; }
        .spec-row .v { flex: 1; }
        .spec-row input:focus { outline: none; border-color: var(--amber); }
        .spec-row input.has-img { border-color: var(--amber); color: var(--amber); }
        .spec-row .del {
          width: 26px; height: 26px; flex-shrink: 0; background: none;
          border: 1px solid var(--editor-line); color: var(--editor-muted);
          cursor: pointer; font-size: 14px; line-height: 1;
        }
        .spec-row .del:hover { border-color: #c0392b; color: #e74c3c; }
        .add-spec {
          width: 100%; padding: 8px; margin-top: 4px; background: none;
          border: 1px dashed var(--editor-line); color: var(--editor-muted);
          cursor: pointer; font-size: 12.5px; font-family: var(--font-archivo), sans-serif; font-weight: 500;
        }
        .add-spec:hover { border-color: var(--amber); color: var(--editor-text); }
        .preview-zone {
          flex: 1; overflow: auto; display: flex; align-items: flex-start; justify-content: center;
          padding: 32px;
          background: radial-gradient(circle at 1px 1px, #23262c 1px, transparent 0) 0 0/22px 22px, var(--editor-bg);
        }
        .sheet {
          width: 794px; min-height: 1123px; background: var(--paper); color: var(--ink);
          box-shadow: 0 8px 40px rgba(0,0,0,.5); display: flex; flex-direction: column; flex-shrink: 0;
        }
        .sheet-inner { flex: 1; display: flex; flex-direction: column; padding: 48px 52px 36px; overflow: visible; }
        .ft-foot { margin-top: auto; }
        .ft-head { display: flex; justify-content: space-between; align-items: flex-end; padding-bottom: 14px; }
        .ft-logo { max-height: 60px; max-width: 220px; object-fit: contain; }
        .ft-logo-text { font-weight: 900; font-size: 26px; letter-spacing: .01em; font-stretch: 110%; }
        .ft-doc { text-align: right; }
        .ft-doc .doc-label { font-size: 12px; font-weight: 800; letter-spacing: .22em; text-transform: uppercase; }
        .ft-doc .doc-code { font-family: var(--font-mono), monospace; font-size: 11px; color: var(--steel); margin-top: 2px; }
        .volt-bar {
          height: 6px; 
          background: repeating-linear-gradient(#ff8c00 0 250px, var(--ink) 14px 17px);
          margin-bottom: 26px;
        }
        .ft-title { font-weight: 800; font-size: 30px; line-height: 1.12; font-stretch: 105%; letter-spacing: -.01em; margin-bottom: 6px; }
        .ft-subtitle { font-family: var(--font-mono), monospace; font-size: 12.5px; color: var(--steel); display: flex; gap: 18px; flex-wrap: wrap; margin-bottom: 24px; }
        .ft-subtitle b { color: var(--ink); font-weight: 600; }
        .ft-body { display: flex; gap: 28px; margin-bottom: 26px; }
        .ft-desc { flex: 1.15; font-size: 13.5px; line-height: 1.62; color: #33383e; white-space: pre-line; }
        .ft-photos { flex: 1; display: grid; gap: 8px; align-content: start; grid-template-columns: 1fr; }
        .ft-photos.n2, .ft-photos.n3, .ft-photos.n4 { grid-template-columns: 1fr 1fr; }
        .ft-photo {
          min-height: 150px; border: 1px solid var(--line); display: flex;
          align-items: center; justify-content: center; background: #fafbfc; overflow: hidden;
        }
        .ft-photos.n1 .ft-photo { min-height: 230px; max-height: 300px; }
        .ft-photo img { width: 100%; height: 100%; object-fit: contain; padding: 10px; }
        .ft-photo .ph { color: #b9bfc6; font-size: 12px; text-align: center; line-height: 1.5; padding: 20px; }
        .ft-specs-block { margin-bottom: 26px; }
        .ft-specs-title {
          font-size: 12px; font-weight: 800; letter-spacing: .18em; text-transform: uppercase;
          display: flex; align-items: center; gap: 10px; margin-bottom: 10px;
        }
        .ft-specs-title::after { content: ""; flex: 1; height: 2px; background: var(--ink); }
        table.ft-specs { width: 100%; border-collapse: collapse; }
        table.ft-specs td { padding: 7px 12px; font-size: 12.5px; border-bottom: 1px solid var(--line); vertical-align: top; }
        table.ft-specs td.k { width: 46%; color: #3c434b; font-weight: 500; }
        table.ft-specs td.v { font-family: var(--font-mono), monospace; font-weight: 500; font-size: 12px; }
        table.ft-specs td.v img { max-width: 100%; max-height: 120px; object-fit: contain; display: block; }
        table.ft-specs tr:nth-child(odd) td { background: #f7f8f9; }
        .ft-notes {
          font-size: 11px; color: var(--steel); line-height: 1.55;
          border-left: 3px solid var(--amber); padding-left: 12px; margin-bottom: auto; white-space: pre-line;
        }
        .ft-foot {
          margin-top: 30px; padding-top: 12px; border-top: 2px solid var(--ink);
          display: flex; justify-content: space-between; align-items: baseline;
          font-size: 10.5px; color: var(--steel); gap: 12px; flex-wrap: wrap;
        }
        .ft-foot .co { font-weight: 700; color: var(--ink); font-size: 11px; }
        .ft-foot .date { font-family: var(--font-mono), monospace; }

        .sheet-print-footer { display: none; }

        @media print {
          .sheet-print-footer {
            display: block;
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            width: auto;
            padding: 0 14mm 10mm;
            box-sizing: border-box;
            background: #fff;
            z-index: 1000;
          }
          .sheet-print-footer .ft-foot {
            margin-top: 0;
            padding-top: 10px;
            border-top: 2px solid var(--ink);
            page-break-inside: avoid;
          }
          .sheet { page-break-inside: avoid; }
          .sheet-inner { display: block; }
          .ft-foot { display: none; }
          .sheet-print-footer .ft-foot { display: flex !important; }
          @page { size: A4; margin: 14mm 15mm 20mm; }
          html, body { overflow: visible !important; height: auto !important; background: #fff !important; }
          .topbar, .editor { display: none !important; }
          .main { display: block !important; overflow: visible !important; }
          .preview-zone { padding: 0 !important; background: #fff !important; display: block !important; overflow: visible !important; }
          .sheet { width: 210mm !important; min-height: 297mm !important; height: auto !important; box-shadow: none !important; margin: 0 auto !important; transform: none !important; display: block !important; }
          .sheet-inner { flex: none; display: block; padding: 0; }
          .ft-foot { margin-top: auto; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
        @media (max-width: 900px) {
          .main { flex-direction: column; }
          .editor { width: 100%; max-height: 45vh; border-right: none; border-bottom: 1px solid var(--editor-line); }
          .preview-zone { padding: 16px; }
          .sheet { transform: scale(.45); transform-origin: top center; }
        }
      `}</style>
    </>
  );
}
