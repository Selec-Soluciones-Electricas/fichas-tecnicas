"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import defaultLogo from "@/img/Alta resolución.jpg";
import { normalizeDescHtml } from "@/lib/richText";
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
const STORAGE_KEY = "fichaTecnicaGenerator:data";
const HIGHLIGHT_COLORS = [
  { hex: "f5a800", label: "Ámbar" },
  { hex: "fff59d", label: "Amarillo" },
  { hex: "a5d6a7", label: "Verde" },
  { hex: "81d4fa", label: "Celeste" },
  { hex: "f48fb1", label: "Rosa" },
  { hex: "ce93d8", label: "Morado" },
];
type StoredFicha = Partial<{
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
}>;


let cachedStoredFicha: StoredFicha | null | undefined;
const getStoredFicha = (): StoredFicha | null => {
  if (cachedStoredFicha !== undefined) return cachedStoredFicha;
  let result: StoredFicha | null = null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    result = raw ? JSON.parse(raw) : null;
  } catch {
    result = null;
  }
  cachedStoredFicha = result;
  return result;
};

export default function FichaTecnicaGenerator() {
  const [empresa, setEmpresa] = useState(() => getStoredFicha()?.empresa || EMPRESA_DEFAULT);
  const [titulo, setTitulo] = useState(() => getStoredFicha()?.titulo || "");
  const [marca, setMarca] = useState(() => getStoredFicha()?.marca || "");
  const [modelo, setModelo] = useState(() => getStoredFicha()?.modelo?.trim() || "");
  const [docCode, setDocCode] = useState(() => getStoredFicha()?.docCode || "");
  const [desc, setDesc] = useState(() => normalizeDescHtml(getStoredFicha()?.desc || ""));
  const [customHighlightColor, setCustomHighlightColor] = useState("f5a800");
  const [notas, setNotas] = useState(() => getStoredFicha()?.notas || "");
  const [contacto, setContacto] = useState(() => getStoredFicha()?.contacto || CONTACTO_DEFAULT);
  const [logo, setLogo] = useState<string | null>(() => getStoredFicha()?.logo ?? defaultLogo.src);
  const [photos, setPhotos] = useState<string[]>(() => {
    const stored = getStoredFicha()?.photos;
    return Array.isArray(stored) ? stored.slice() : [];
  });
  const [specs, setSpecs] = useState<Spec[]>(() => {
    const stored = getStoredFicha()?.specs;
    return Array.isArray(stored) && stored.length
      ? stored.map((s) => ({ k: s.k || "", v: s.v || "", img: s.img || null }))
      : [
          { k: "", v: "", img: null },
          { k: "", v: "", img: null },
          { k: "", v: "", img: null },
        ];
  });
  const [lastPdfText, setLastPdfText] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiNotice, setAiNotice] = useState("");
  const fecha = useMemo(() => {
    const d = new Date();
    return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
  }, []);
  useEffect(() => {
    const nextTitle = (modelo || "Ficha Técnica").trim() || "Ficha Técnica";
    document.title = nextTitle;
  }, [modelo]);
  const readFile = (f: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(f);
    });
  const trimImageWhitespace = (dataUrl: string): Promise<string> =>
    new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const width = img.naturalWidth;
        const height = img.naturalHeight;
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx || width === 0 || height === 0) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0);

        let pixels: Uint8ClampedArray;
        try {
          pixels = ctx.getImageData(0, 0, width, height).data;
        } catch {
          resolve(dataUrl);
          return;
        }

        const bgR = pixels[0];
        const bgG = pixels[1];
        const bgB = pixels[2];
        const THRESHOLD = 12;
        const isBackground = (x: number, y: number) => {
          const i = (y * width + x) * 4;
          return (
            Math.abs(pixels[i] - bgR) <= THRESHOLD &&
            Math.abs(pixels[i + 1] - bgG) <= THRESHOLD &&
            Math.abs(pixels[i + 2] - bgB) <= THRESHOLD
          );
        };
        const rowHasContent = (y: number) => {
          for (let x = 0; x < width; x += 2) {
            if (!isBackground(x, y)) return true;
          }
          return false;
        };
        const colHasContent = (x: number) => {
          for (let y = 0; y < height; y += 2) {
            if (!isBackground(x, y)) return true;
          }
          return false;
        };

        let top = 0, bottom = height - 1, left = 0, right = width - 1;
        while (top < bottom && !rowHasContent(top)) top += 1;
        while (bottom > top && !rowHasContent(bottom)) bottom -= 1;
        while (left < right && !colHasContent(left)) left += 1;
        while (right > left && !colHasContent(right)) right -= 1;

        const PADDING = 14;
        const cropX = Math.max(0, left - PADDING);
        const cropY = Math.max(0, top - PADDING);
        const cropW = Math.min(width, right + PADDING) - cropX;
        const cropH = Math.min(height, bottom + PADDING) - cropY;

        const reducedEnough = cropW < width * 0.98 || cropH < height * 0.98;
        if (!reducedEnough || cropW < 20 || cropH < 20) {
          resolve(dataUrl);
          return;
        }

        const outCanvas = document.createElement("canvas");
        outCanvas.width = cropW;
        outCanvas.height = cropH;
        const outCtx = outCanvas.getContext("2d");
        if (!outCtx) {
          resolve(dataUrl);
          return;
        }
        outCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
        resolve(outCanvas.toDataURL("image/png"));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });

  const addPhoto = (dataUrl: string) => setPhotos((prev) => [...prev, dataUrl]);
  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData("text/plain") ?? "";
      if (text.trim()) return;
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
      readFile(file).then(async (dataUrl) => {
        if (specIdxAttr !== undefined) {
          const idx = parseInt(specIdxAttr, 10);
          const trimmed = await trimImageWhitespace(dataUrl);
          setSpecs((prev) =>
            prev.map((s, i) => (i === idx ? { ...s, img: trimmed } : s))
          );
        } else {
          addPhoto(dataUrl);
        }
      });
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, []);
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
  const updateSpec = (idx: number, patch: Partial<Spec>) =>
    setSpecs((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  const removeSpec = (idx: number) =>
    setSpecs((prev) => prev.filter((_, i) => i !== idx));
  const addSpec = () =>
    setSpecs((prev) => [...prev, { k: "", v: "", img: null }]);
  const descRef = useRef<HTMLDivElement>(null);
  const savedDescRangeRef = useRef<Range | null>(null);
  // Chrome sometimes wraps each selected line in its own <ul>/<ol> instead of
  // one shared list (bullets/numbers then don't render as a continuous list).
  const mergeAdjacentLists = (root: HTMLElement) => {
    root.querySelectorAll("ul, ol").forEach((list) => {
      let next = list.nextElementSibling;
      while (next && next.tagName === list.tagName) {
        while (next.firstChild) list.appendChild(next.firstChild);
        const toRemove = next;
        next = next.nextElementSibling;
        toRemove.remove();
      }
    });
  };
  const syncDescFromDom = () => {
    const el = descRef.current;
    if (!el) return;
    mergeAdjacentLists(el);
    if (!(el.textContent || "").trim() && el.innerHTML !== "") {
      el.innerHTML = "";
    }
    setDesc(el.innerHTML);
  };
  const saveDescSelection = () => {
    const el = descRef.current;
    const sel = window.getSelection();
    if (el && sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (el.contains(range.commonAncestorContainer)) {
        savedDescRangeRef.current = range.cloneRange();
      }
    }
  };
  const restoreDescSelection = () => {
    const el = descRef.current;
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    if (sel && savedDescRangeRef.current) {
      sel.removeAllRanges();
      sel.addRange(savedDescRangeRef.current);
    }
  };
  // Wrap any top-level inline content (bare text/b/i/span/br, e.g. an untouched
  // first line) into a <div> so every line is a normal block-level element.
  const normalizeDescBlocks = (root: HTMLElement) => {
    const BLOCK_TAGS = new Set(["DIV", "P", "UL", "OL"]);
    const originalChildren = Array.from(root.childNodes);
    let run: Node[] = [];
    const flushRun = (beforeNode: Node | null) => {
      if (!run.length) return;
      const div = document.createElement("div");
      run.forEach((n) => div.appendChild(n));
      root.insertBefore(div, beforeNode);
      run = [];
    };
    for (const child of originalChildren) {
      const isBlock = child.nodeType === 1 && BLOCK_TAGS.has((child as Element).tagName);
      if (isBlock) {
        flushRun(child);
      } else {
        run.push(child);
      }
    }
    flushRun(null);
  };
  const toggleDescList = (ordered: boolean) => {
    const el = descRef.current;
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (!el.contains(range.commonAncestorContainer)) return;

    normalizeDescBlocks(el);
    if (!el.firstChild) {
      const emptyDiv = document.createElement("div");
      emptyDiv.appendChild(document.createElement("br"));
      el.appendChild(emptyDiv);
    }

    const getTopLevelAncestor = (node: Node): Node | null => {
      if (node === el) return el.firstChild;
      let n: Node | null = node;
      while (n && n.parentNode !== el) n = n.parentNode;
      return n;
    };
    const startBlock = getTopLevelAncestor(range.startContainer);
    const endBlock = getTopLevelAncestor(range.endContainer);
    if (!startBlock || !endBlock) return;

    const children = Array.from(el.childNodes);
    let startIdx = children.indexOf(startBlock as ChildNode);
    let endIdx = children.indexOf(endBlock as ChildNode);
    if (startIdx === -1 || endIdx === -1) return;
    if (startIdx > endIdx) [startIdx, endIdx] = [endIdx, startIdx];

    const targetTag = ordered ? "OL" : "UL";
    const selectedBlocks = children.slice(startIdx, endIdx + 1);
    const referenceNode = children[endIdx + 1] || null;

    const isSingleMatchingList =
      selectedBlocks.length === 1 &&
      selectedBlocks[0].nodeType === 1 &&
      (selectedBlocks[0] as Element).tagName === targetTag;

    if (isSingleMatchingList) {
      const list = selectedBlocks[0] as HTMLElement;
      Array.from(list.children).forEach((li) => {
        const div = document.createElement("div");
        while (li.firstChild) div.appendChild(li.firstChild);
        el.insertBefore(div, list);
      });
      list.remove();
    } else {
      const list = document.createElement(targetTag);
      selectedBlocks.forEach((block) => {
        if (block.nodeType === 1 && ["UL", "OL"].includes((block as Element).tagName)) {
          Array.from((block as Element).children).forEach((li) => {
            const newLi = document.createElement("li");
            while (li.firstChild) newLi.appendChild(li.firstChild);
            list.appendChild(newLi);
          });
        } else {
          const li = document.createElement("li");
          while (block.firstChild) li.appendChild(block.firstChild);
          list.appendChild(li);
        }
        block.parentNode?.removeChild(block);
      });
      el.insertBefore(list, referenceNode);
    }

    mergeAdjacentLists(el);
    syncDescFromDom();
    const newRange = document.createRange();
    newRange.selectNodeContents(el);
    newRange.collapse(false);
    sel.removeAllRanges();
    sel.addRange(newRange);
  };
  const execDescCommand = (command: string, value?: string) => {
    const el = descRef.current;
    if (!el) return;
    el.focus();
    try {
      document.execCommand(command, false, value);
    } catch {
      // ignore unsupported command in this browser
    }
    syncDescFromDom();
  };
  const applyDescHighlight = (hex: string) => {
    const color = `#${hex}`;
    const el = descRef.current;
    if (!el) return;
    el.focus();
    try {
      if (!document.execCommand("hiliteColor", false, color)) {
        document.execCommand("backColor", false, color);
      }
    } catch {
      try {
        document.execCommand("backColor", false, color);
      } catch {
        // ignore unsupported command in this browser
      }
    }
    syncDescFromDom();
  };
  const preventToolbarFocusSteal = (e: React.MouseEvent) => e.preventDefault();
  useEffect(() => {
    const el = descRef.current;
    if (!el) return;
    if (document.activeElement !== el && el.innerHTML !== desc) {
      el.innerHTML = desc;
    }
  }, [desc]);
  const downloadPdf = () => setTimeout(() => window.print(), 50);
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
  const applyFichaData = (d: StoredFicha) => {
    setEmpresa(d.empresa || EMPRESA_DEFAULT);
    setTitulo(d.titulo || "");
    setMarca(d.marca || "");
    setModelo(d.modelo?.trim() || "");
    setDocCode(d.docCode || "");
    setDesc(normalizeDescHtml(d.desc || ""));
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

  useEffect(() => {
    const timeout = setTimeout(() => {
      try {
        const data = { empresa, titulo, marca, modelo, docCode, desc, notas, contacto, specs, logo, photos };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch {
        console.warn("No se pudo guardar el progreso automáticamente (posiblemente por el tamaño de las imágenes).");
      }
    }, 400);
    return () => clearTimeout(timeout);
  }, [empresa, titulo, marca, modelo, docCode, desc, notas, contacto, specs, logo, photos]);

  const clearFicha = () => {
    if (!window.confirm("¿Seguro que deseas limpiar la ficha? Se perderán todos los datos ingresados.")) return;
    setEmpresa(EMPRESA_DEFAULT);
    setTitulo("");
    setMarca("");
    setModelo("");
    setDocCode("");
    setDesc("");
    setNotas("");
    setContacto(CONTACTO_DEFAULT);
    setLogo(defaultLogo.src);
    setPhotos([]);
    setSpecs([
      { k: "", v: "", img: null },
      { k: "", v: "", img: null },
      { k: "", v: "", img: null },
    ]);
    setLastPdfText("");
    setAiNotice("");
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
    }
  };

  const importJsonFile = (f: File) => {
    const r = new FileReader();
    r.onload = () => {
      try {
        const d = JSON.parse(r.result as string);
        applyFichaData(d);
      } 
      catch {
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
  const extractDescriptionFromLines = (lines: string[]) => {
    const descriptionLabelIndex = lines.findIndex((line) => /^descripc(i|ó)n/i.test(line));
    const candidateLines = descriptionLabelIndex >= 0
      ? lines.slice(descriptionLabelIndex + 1)
      : lines;

    return candidateLines
      .filter((line) => line && isValueLike(line) && !/^(marca|modelo|fabricante|código|codigo|referencia|descripción|descripcion|características|caracteristicas|notas|observaciones|ficha|selec|www\.|@)/i.test(line))
      .slice(0, 6)
      .join(" ")
      .trim();
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

    const marca = findValueFromText(/\b(?:marca|fabricante|brand|marca comercial)\b[^A-Za-zÁÉÍÓÚÑáéíóúñ0-9]{0,6}([A-Za-zÁÉÍÓÚÑáéíóúñ0-9/._-]+(?:\s+[A-Za-zÁÉÍÓÚÑáéíóúñ0-9/._-]+){0,6})/i) ||
      extractFieldValueFromLines(lines, [/^marca\b/i, /^fabricante\b/i, /^brand\b/i, /^marca comercial\b/i]);

    const modelo = findValueFromText(/\b(?:modelo|referencia|part\s*number|código|codigo|serie|n[°.º]?\s*modelo|nro\.?\s*modelo)\b[^A-Za-zÁÉÍÓÚÑáéíóúñ0-9]{0,6}([A-Za-zÁÉÍÓÚÑáéíóúñ0-9/._-]+(?:\s+[A-Za-zÁÉÍÓÚÑáéíóúñ0-9/._-]+){0,6})/i) ||
      extractFieldValueFromLines(lines, [/^modelo\b/i, /^referencia\b/i, /^part\s*number\b/i, /^c[oó]digo\b/i, /^codigo\b/i, /^serie\b/i, /^n[°.º]?\s*modelo\b/i]);

    const docCode = normalizedText.match(/\b(FT[-\s]?\d+)\b/i)?.[1]?.toUpperCase().replace(/\s+/g, "-") ||
      extractCodeValueFromLines(lines) ||
      findValueFromText(/\b(?:c[oó]digo|codigo)\b[^A-Za-zÁÉÍÓÚÑáéíóúñ0-9]{0,6}([A-Za-zÁÉÍÓÚÑáéíóúñ0-9/._-]+(?:\s+[A-Za-zÁÉÍÓÚÑáéíóúñ0-9/._-]+){0,6})/i);

    const title = pickBestCandidate(
      lines.filter((line) => line.length > 8 && !/^(marca|modelo|fabricante|referencia|código|codigo|descripción|descripcion|características|caracteristicas|notas|observaciones|ficha|selec|www\.|@)/i.test(line)),
      scoreTitleCandidate
    ) || lines.find((line) => line.length > 12) || "";

    const desc = extractDescriptionFromLines(lines) ||
      lines
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
    const stableBuffer = buffer.slice(0);
    const doc = await pdfjsLib.getDocument({ data: stableBuffer }).promise;
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
      // 
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
  const extractEmbeddedPdfImage = (page: any, objId: string, timeoutMs = 4000): Promise<any> =>
    new Promise((resolve) => {
      if (page.objs.has(objId)) {
        resolve(page.objs.get(objId));
        return;
      }
      if (page.commonObjs.has(objId)) {
        resolve(page.commonObjs.get(objId));
        return;
      }
      let settled = false;
      const finish = (value: any) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      page.objs.get(objId, finish);
      page.commonObjs.get(objId, finish);
      setTimeout(() => finish(null), timeoutMs);
    });

  const embeddedImageToDataUrl = (img: any, ImageKind: { RGBA_32BPP: number; RGB_24BPP: number }): string | null => {
    if (!img || !img.width || !img.height) return null;
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    if (img.bitmap) {
      ctx.drawImage(img.bitmap, 0, 0);
      return canvas.toDataURL("image/png");
    }
    if (!img.data) return null;
    const imageData = ctx.createImageData(img.width, img.height);
    const src: Uint8ClampedArray = img.data;
    if (img.kind === ImageKind.RGBA_32BPP) {
      imageData.data.set(src);
    } else if (img.kind === ImageKind.RGB_24BPP) {
      for (let s = 0, d = 0; s < src.length; s += 3, d += 4) {
        imageData.data[d] = src[s];
        imageData.data[d + 1] = src[s + 1];
        imageData.data[d + 2] = src[s + 2];
        imageData.data[d + 3] = 255;
      }
    } else {
      return null;
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL("image/png");
  };
  const extractPdfPhotos = async (buffer: ArrayBuffer): Promise<string[]> => {
    const pdfjsLib: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
    pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    const stableBuffer = buffer.slice(0);
    const doc = await pdfjsLib.getDocument({ data: stableBuffer }).promise;

    type Candidate = { page: any; objId: string; width: number; height: number };
    const candidates: Candidate[] = [];
    for (let i = 1; i <= doc.numPages; i += 1) {
      const page = await doc.getPage(i);
      const opList = await page.getOperatorList();
      for (let idx = 0; idx < opList.fnArray.length; idx += 1) {
        if (opList.fnArray[idx] !== pdfjsLib.OPS.paintImageXObject) continue;
        const [objId, width, height] = opList.argsArray[idx];
        if (!width || !height || width < 90 || height < 90) continue;
        const aspect = Math.max(width / height, height / width);
        if (aspect > 5) continue; // descarta barras/logos muy alargados
        candidates.push({ page, objId, width, height });
      }
    }

    candidates.sort((a, b) => b.width * b.height - a.width * a.height);

    const photos: string[] = [];
    const seen = new Set<string>();
    for (const candidate of candidates) {
      if (photos.length >= 6) break;
      const key = `${candidate.width}x${candidate.height}`;
      if (seen.has(key)) continue;
      try {
        const img = await extractEmbeddedPdfImage(candidate.page, candidate.objId);
        const dataUrl = embeddedImageToDataUrl(img, pdfjsLib.ImageKind);
        if (!dataUrl || dataUrl === "data:,") continue;
        seen.add(key);
        photos.push(dataUrl);
      } catch {
         }
    }
    if (photos.length > 0) return photos;
    return extractPdfPhotosHeuristic(buffer);
  };

  const extractPdfPhotosHeuristic = async (buffer: ArrayBuffer): Promise<string[]> => {
    const pdfjsLib: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
    pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    const stableBuffer = buffer.slice(0);
    const doc = await pdfjsLib.getDocument({ data: stableBuffer }).promise;
    const photos: string[] = [];
    for (let i = 1; i <= doc.numPages; i += 1) {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale: 1.6 });
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) continue;
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({ canvasContext: context, viewport }).promise;
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const visited = new Uint8Array(canvas.width * canvas.height);
      const candidates: Array<{ x: number; y: number; width: number; height: number; area: number; edgeCoverage: number; centrality: number }> = [];
      const fallbackCandidates: Array<{ x: number; y: number; width: number; height: number; area: number; edgeCoverage: number; centrality: number }> = [];
      const isBackgroundPixel = (index: number) => {
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];
        const a = data[index + 3];
        const isWhite = r > 235 && g > 235 && b > 235;
        const isGray = Math.abs(r - g) < 12 && Math.abs(g - b) < 12 && r > 180 && r < 230;
        return a < 40 || isWhite || isGray;
      };
     
      const createPhotoFromRegion = (x: number, y: number, width: number, height: number) => {
        const cropCanvas = document.createElement("canvas");
        const cropContext = cropCanvas.getContext("2d");
        if (!cropContext) return null;

        const safeX = Math.max(0, Math.min(x, canvas.width - 1));
        const safeY = Math.max(0, Math.min(y, canvas.height - 1));
        const safeWidth = Math.max(40, Math.min(width, canvas.width - safeX));
        const safeHeight = Math.max(40, Math.min(height, canvas.height - safeY));

        cropCanvas.width = safeWidth;
        cropCanvas.height = safeHeight;
        cropContext.drawImage(canvas, safeX, safeY, safeWidth, safeHeight, 0, 0, safeWidth, safeHeight);
     
        const cropData = cropContext.getImageData(0, 0, safeWidth, safeHeight).data;
        let nonBackgroundPixels = 0;
        for (let i = 0; i < cropData.length; i += 4) {
          const a = cropData[i + 3];
          const r = cropData[i];
          const g = cropData[i + 1];
          const b = cropData[i + 2];
          const isWhite = r > 235 && g > 235 && b > 235;
          const isGray = Math.abs(r - g) < 12 && Math.abs(g - b) < 12 && r > 180 && r < 230;
          if (!(a < 40 || isWhite || isGray)) nonBackgroundPixels += 1;
        }
        const density = nonBackgroundPixels / Math.max(1, safeWidth * safeHeight);
        if (density < 0.08) return null;
        return cropCanvas.toDataURL("image/png");
      };
      const getPixelVariance = (index: number) => {
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];
        return Math.max(r, g, b) - Math.min(r, g, b);
      };
      for (let y = 0; y < canvas.height; y += 1) {
        for (let x = 0; x < canvas.width; x += 1) {
          const idx = y * canvas.width + x;
          if (visited[idx]) continue;
          const pixelIndex = idx * 4;
          if (isBackgroundPixel(pixelIndex)) continue;
          const stack: Array<[number, number]> = [[x, y]];
          visited[idx] = 1;
          let minX = x;
          let maxX = x;
          let minY = y;
          let maxY = y;
          let area = 0;
          let nonBackground = 0;
          let edgeCoverage = 0;
          while (stack.length) {
            const [cx, cy] = stack.pop()!;
            const currentIndex = cy * canvas.width + cx;
            const currentPixel = currentIndex * 4;
            area += 1;
            if (!isBackgroundPixel(currentPixel)) {
              nonBackground += 1;
              edgeCoverage += getPixelVariance(currentPixel);
            } 
            minX = Math.min(minX, cx);
            maxX = Math.max(maxX, cx);
            minY = Math.min(minY, cy);
            maxY = Math.max(maxY, cy);
            const neighbors = [
              [cx + 1, cy],
              [cx - 1, cy],
              [cx, cy + 1],
              [cx, cy - 1],
            ];
            for (const [nx, ny] of neighbors) {
              if (nx < 0 || ny < 0 || nx >= canvas.width || ny >= canvas.height) continue;
              const nextIndex = ny * canvas.width + nx;
              if (visited[nextIndex]) continue;
              const nextPixel = nextIndex * 4;
              if (!isBackgroundPixel(nextPixel)) {
                visited[nextIndex] = 1;
                stack.push([nx, ny]);
              }
            }
          }
          const width = maxX - minX + 1;
          const height = maxY - minY + 1;
          const bboxArea = width * height;
          const density = nonBackground / Math.max(area, 1);
          const contrast = edgeCoverage / Math.max(nonBackground, 1);
          const aspect = Math.max(width / height, height / width);
          const centerX = (minX + maxX) / (2 * canvas.width);
          const centerY = (minY + maxY) / (2 * canvas.height);
          const centrality = 1 - Math.min(1, Math.abs(centerX - 0.5) * 1.4 + Math.abs(centerY - 0.5) * 1.4);
          const isHeaderLike = minY < canvas.height * 0.18 || maxY > canvas.height * 0.82;
          const isWideBanner = width > canvas.width * 0.65 || height > canvas.height * 0.65;
          const strictMatch =
            area >= 3200 &&
            width >= 60 &&
            height >= 60 &&
            bboxArea >= 8000 &&
            density >= 0.3 &&
            contrast >= 24 &&
            aspect <= 2.8 &&
            !isHeaderLike &&
            !isWideBanner &&
            centrality >= 0.25;

          const fallbackMatch =
            area >= 1400 &&
            width >= 36 &&
            height >= 36 &&
            bboxArea >= 3600 &&
            density >= 0.18 &&
            contrast >= 12 &&
            aspect <= 4.2 &&
            !isHeaderLike &&
            !isWideBanner &&
            centrality >= 0.1;
          if (strictMatch) {
            candidates.push({ x: minX, y: minY, width, height, area, edgeCoverage: contrast, centrality });
          } else if (fallbackMatch) {
            fallbackCandidates.push({ x: minX, y: minY, width, height, area, edgeCoverage: contrast, centrality });
          }
        }
      }
      candidates.sort((a, b) => (b.edgeCoverage * 0.5 + b.area * 0.2 + b.centrality * 0.3) - (a.edgeCoverage * 0.5 + a.area * 0.2 + a.centrality * 0.3));
      fallbackCandidates.sort((a, b) => (b.edgeCoverage * 0.5 + b.area * 0.2 + b.centrality * 0.3) - (a.edgeCoverage * 0.5 + a.area * 0.2 + a.centrality * 0.3));
      const seen = new Set<string>();
      const selectedCandidates = candidates.length ? candidates : fallbackCandidates;
      for (const candidate of selectedCandidates.slice(0, 6)) {
        const cropCanvas = document.createElement("canvas");
        const cropContext = cropCanvas.getContext("2d");
        if (!cropContext) continue;
        const padding = 10;
        const cropX = Math.max(0, candidate.x - padding);
        const cropY = Math.max(0, candidate.y - padding);
        const cropWidth = Math.min(canvas.width - cropX, candidate.width + padding * 2);
        const cropHeight = Math.min(canvas.height - cropY, candidate.height + padding * 2);
        cropCanvas.width = cropWidth;
        cropCanvas.height = cropHeight;
        cropContext.drawImage(canvas, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
        const dataUrl = cropCanvas.toDataURL("image/png");
        if (dataUrl && dataUrl !== "data:," && dataUrl.length > 300) {
          const key = `${cropWidth}x${cropHeight}:${dataUrl.slice(0, 120)}`;
          if (!seen.has(key)) {
            seen.add(key);
            photos.push(dataUrl);
          }
        }
      }
      if (photos.length === 0) {
        const fallbackRegions = [
          {
            x: Math.floor(canvas.width * 0.12),
            y: Math.floor(canvas.height * 0.16),
            width: Math.floor(canvas.width * 0.76),
            height: Math.floor(canvas.height * 0.58),
          },
          {
            x: Math.floor(canvas.width * 0.16),
            y: Math.floor(canvas.height * 0.12),
            width: Math.floor(canvas.width * 0.68),
            height: Math.floor(canvas.height * 0.54),
          },
          {
            x: Math.floor(canvas.width * 0.20),
            y: Math.floor(canvas.height * 0.20),
            width: Math.floor(canvas.width * 0.60),
            height: Math.floor(canvas.height * 0.48),
          },
        ];
        for (const region of fallbackRegions) {
          const dataUrl = createPhotoFromRegion(region.x, region.y, region.width, region.height);
          if (dataUrl && dataUrl !== "data:,") {
            const key = `${region.width}x${region.height}:${dataUrl.slice(0, 120)}`;
            if (!seen.has(key)) {
              seen.add(key);
              photos.push(dataUrl);
            }
          }
          if (photos.length >= 1) break;
        }
      }
    }
    return photos.filter((photo, index, self) => self.indexOf(photo) === index);
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
        photos: Array.isArray(payload.photos) && payload.photos.length > 0 ? payload.photos : currentData.photos,
      };
      applyFichaData(nextData);
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
      const extractedPhotos = await extractPdfPhotos(buffer);
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
        photos: extractedPhotos,
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
          <button className="btn" onClick={clearFicha}>Limpiar ficha</button>
          <button className="btn primary" onClick={downloadPdf}>Descargar PDF</button>
        </div>
      </div>
      {aiNotice ? <div className="ai-status">{aiNotice}</div> : null}

      <div className="main">
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
                  <img src={src} alt={`foto ${idx + 1}`} />
                  <button
                    className="rm"
                    title="Quitar"
                    onClick={() => removePhoto(idx)}
                  >×</button>
                </div>
              ))}
            </div>
          </div>
          <h2>Producto</h2>
          <div className="field">
            <label>Título del producto</label>
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ej: Contactor Siemens 3RT2015-1AP01"
            />
          </div>
          <div className="field">
            <label>Marca</label>
            <input type="text" value={marca} onChange={(e) => setMarca(e.target.value)} placeholder="Ej: Siemens" />
          </div>
          <div className="field">
            <label>Modelo / Código</label>
            <input
              type="text"
              value={modelo}
              onChange={(e) => setModelo(e.target.value)}
              placeholder="Ej: 3RT2015-1AP01"
            />
          </div>
          <div className="field">
            <label>Código del documento (opcional)</label>
            <input type="text" value={docCode} onChange={(e) => setDocCode(e.target.value)} placeholder="Ej: FT-2026-0142" />
          </div>



          <div className="field">
            <label>Descripción</label>
            <div className="desc-toolbar">
              <button type="button" title="Negrita" onMouseDown={preventToolbarFocusSteal} onClick={() => execDescCommand("bold")}><b>N</b></button>
              <button type="button" title="Cursiva" onMouseDown={preventToolbarFocusSteal} onClick={() => execDescCommand("italic")}><i>I</i></button>
              <button type="button" title="Lista con viñetas" onMouseDown={preventToolbarFocusSteal} onClick={() => toggleDescList(false)}>☰</button>
              <button type="button" title="Lista numerada" onMouseDown={preventToolbarFocusSteal} onClick={() => toggleDescList(true)}>1.</button>
              <button type="button" title="Quitar formato" onMouseDown={preventToolbarFocusSteal} onClick={() => execDescCommand("removeFormat")}>✕</button>
            </div>
            <div className="desc-colors">
              {HIGHLIGHT_COLORS.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  className="swatch"
                  title={`Resaltar en ${c.label}`}
                  style={{ background: `#${c.hex}` }}
                  onMouseDown={preventToolbarFocusSteal}
                  onClick={() => applyDescHighlight(c.hex)}
                />
              ))}
              <label
                className="swatch swatch-custom"
                title="Elegir otro color"
                style={{ background: `#${customHighlightColor}` }}
              >
                <span>+</span>
                <input
                  type="color"
                  value={`#${customHighlightColor}`}
                  onMouseDown={saveDescSelection}
                  onChange={(e) => {
                    const hex = e.target.value.replace("#", "");
                    setCustomHighlightColor(hex);
                    restoreDescSelection();
                    applyDescHighlight(hex);
                  }}
                />
              </label>
            </div>
            <div
              ref={descRef}
              className="desc-editable"
              contentEditable
              suppressContentEditableWarning
              data-placeholder="Descripción general del producto, aplicación, características principales..."
              onInput={syncDescFromDom}
              onBlur={syncDescFromDom}
            />
            <div className="hint">
              Selecciona texto y usa los botones para dar formato: negrita, cursiva, resaltado de color y listas.
            </div>
          </div>


          
          <h2>Características técnicas</h2>
          <div>
            {specs.map((s, idx) => (
              <div className={`spec-row${s.img ? " spec-row-image" : ""}`} key={idx}>
                {s.img ? (
                  <div className="spec-image-field" data-spec-idx={idx} tabIndex={0}>
                    <img src={s.img} alt="" />
                    <input
                      type="text"
                      placeholder="Descripción de la imagen (opcional)"
                      value={s.v}
                      onChange={(e) => updateSpec(idx, { v: e.target.value })}
                    />
                    <button
                      className="clear-img"
                      title="Quitar imagen"
                      onClick={() => updateSpec(idx, { img: null })}
                    >×</button>
                  </div>
                ) : (
                  <>
                    <input
                      className="k"
                      type="text"
                      placeholder="Característica (ej: Tensión bobina)"
                      value={s.k}
                      onChange={(e) => updateSpec(idx, { k: e.target.value })}
                    />
                    <textarea
                      className="v"
                      rows={1}
                      data-spec-idx={idx}
                      placeholder="Valor (texto o pega imagen con Ctrl+V)"
                      value={s.v}
                      onChange={(e) => updateSpec(idx, { v: e.target.value })}
                    />
                  </>
                )}
                <button className="del" title="Eliminar fila" onClick={() => removeSpec(idx)}>×</button>
              </div>
            ))}
          </div>
          <button className="add-spec" onClick={addSpec}>+ Agregar característica</button>
          <div className="hint">
            Para pegar una imagen en una característica: haz clic en su campo <i>Valor</i> y pega con <b>Ctrl+V</b>.
          </div>



        </aside>

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
        .desc-toolbar { display: flex; gap: 4px; margin-bottom: 6px; }
        .desc-toolbar button {
          width: 28px; height: 26px; display: flex; align-items: center; justify-content: center;
          background: var(--editor-bg); border: 1px solid var(--editor-line); color: var(--editor-text);
          font-family: var(--font-archivo), sans-serif; font-size: 12px; cursor: pointer; border-radius: 2px;
        }
        .desc-toolbar button:hover { border-color: var(--amber); color: var(--amber); }
        .desc-colors { display: flex; gap: 6px; margin-bottom: 8px; }
        .desc-colors .swatch {
          width: 20px; height: 20px; border-radius: 4px; border: 1px solid var(--editor-line);
          cursor: pointer; padding: 0;
        }
        .desc-colors .swatch:hover { border-color: var(--editor-text); transform: scale(1.1); }
        .desc-colors .swatch-custom {
          position: relative; display: inline-flex; align-items: center; justify-content: center;
          border-style: dashed; border-color: var(--editor-text); overflow: hidden;
        }
        .desc-colors .swatch-custom span {
          font-size: 13px; font-weight: 700; line-height: 1; color: #fff;
          text-shadow: 0 0 2px rgba(0,0,0,.9), 0 0 1px rgba(0,0,0,.9); pointer-events: none;
        }
        .desc-colors .swatch-custom input[type="color"] {
          position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; border: none; padding: 0;
        }
        .desc-editable {
          width: 100%; min-height: 100px; max-height: 320px; overflow-y: auto; resize: vertical;
          padding: 8px 10px; background: var(--editor-bg); border: 1px solid var(--editor-line);
          color: var(--editor-text); font-family: var(--font-archivo), sans-serif; font-size: 13px;
          line-height: 1.5;
        }
        .desc-editable:focus { outline: none; border-color: var(--amber); }
        .desc-editable:empty::before {
          content: attr(data-placeholder); color: var(--editor-muted); pointer-events: none;
        }
        .desc-editable ul, .desc-editable ol { padding-left: 20px; margin: 4px 0; }
        .desc-editable ul { list-style: disc outside; }
        .desc-editable ol { list-style: decimal outside; }
        .desc-editable li { display: list-item; }
        .desc-editable div { min-height: 1em; }
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
        .spec-row { display: flex; gap: 6px; margin-bottom: 6px; align-items: flex-start; }
        .spec-row input, .spec-row textarea.v {
          padding: 7px 9px; background: var(--editor-bg); border: 1px solid var(--editor-line);
          color: var(--editor-text); font-size: 12.5px; font-family: var(--font-archivo), sans-serif; min-width: 0;
        }
        .spec-row .k { flex: 1.1; }
        .spec-row textarea.v {
          flex: 1; resize: vertical; min-height: 30px; max-height: 160px; line-height: 1.4;
        }
        .spec-row input:focus, .spec-row textarea.v:focus { outline: none; border-color: var(--amber); }
        .spec-row .del {
          width: 26px; height: 26px; flex-shrink: 0; align-self: flex-start; background: none;
          border: 1px solid var(--editor-line); color: var(--editor-muted);
          cursor: pointer; font-size: 14px; line-height: 1;
        }
        .spec-row .del:hover { border-color: #c0392b; color: #e74c3c; }
        .spec-row-image { align-items: stretch; }
        .spec-image-field {
          flex: 1; display: flex; align-items: center; gap: 8px; min-width: 0;
          padding: 6px; background: var(--editor-bg); border: 1px solid var(--amber);
        }
        .spec-image-field img {
          width: 40px; height: 40px; object-fit: cover; flex-shrink: 0; border-radius: 2px;
        }
        .spec-image-field input {
          flex: 1; min-width: 0; padding: 6px 8px; background: transparent; border: none;
          color: var(--editor-text); font-size: 12.5px; font-family: var(--font-archivo), sans-serif;
        }
        .spec-image-field input:focus { outline: none; }
        .spec-image-field .clear-img {
          flex-shrink: 0; width: 22px; height: 22px; background: none; border: 1px solid var(--editor-line);
          color: var(--editor-muted); cursor: pointer; font-size: 13px; line-height: 1;
        }
        .spec-image-field .clear-img:hover { border-color: #c0392b; color: #e74c3c; }
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
        .ft-desc { flex: 1.15; font-size: 13.5px; line-height: 1.62; color: #33383e; text-align: justify; text-align-last: left; }
        .ft-desc p, .ft-desc div { margin: 0 0 8px; }
        .ft-desc ul, .ft-desc ol { margin: 0 0 10px; padding-left: 18px; }
        .ft-desc ul { list-style: disc outside; }
        .ft-desc ol { list-style: decimal outside; }
        .ft-desc li { display: list-item; }
        .ft-desc li { margin-bottom: 4px; }
        .ft-desc p:last-child, .ft-desc div:last-child, .ft-desc ul:last-child, .ft-desc ol:last-child { margin-bottom: 0; }
        .ft-desc li:last-child { margin-bottom: 0; }
        .ft-desc b, .ft-desc strong { font-weight: 700; color: var(--ink); }
        .ft-desc i, .ft-desc em { font-style: italic; }
        .ft-desc span[style*="background-color"] { padding: 0 2px; border-radius: 2px; }
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
        table.ft-specs { width: 100%; border-collapse: collapse; table-layout: fixed; }
        table.ft-specs td { padding: 7px 12px; font-size: 12.5px; border-bottom: 1px solid var(--line); vertical-align: top; overflow: hidden; }
        table.ft-specs td.k { width: 46%; color: #3c434b; font-weight: 500; }
        table.ft-specs td.v { font-family: var(--font-mono), monospace; font-weight: 500; font-size: 12px; white-space: pre-line; }
        table.ft-specs td.v-image { width: 100%; }
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
