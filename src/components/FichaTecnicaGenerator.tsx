"use client";

import { useEffect, useMemo, useState } from "react";

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

  const [logo, setLogo] = useState<string | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [specs, setSpecs] = useState<Spec[]>([
    { k: "", v: "", img: null },
    { k: "", v: "", img: null },
    { k: "", v: "", img: null },
  ]);

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

  const importJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const d = JSON.parse(r.result as string);
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
            ? d.specs.map((s: Partial<Spec>) => ({ k: s.k || "", v: s.v || "", img: s.img || null }))
            : [{ k: "", v: "", img: null }]
        );
        setPhotos(
          Array.isArray(d.photos) ? d.photos.slice() : d.photo ? [d.photo] : []
        );
        setLogo(d.logo || null);
      } catch {
        alert("El archivo no es un JSON válido de ficha técnica.");
      }
    };
    r.readAsText(f);
    e.target.value = "";
  };

  const specsHasContent = specs.some((s) => s.k.trim() || s.v.trim() || s.img);
  const nPhotos = photos.length;
  const photosClass = `ft-photos n${nPhotos === 0 ? 1 : Math.min(nPhotos, 4)}`;

  return (
    <>
      <div className="topbar">
        <div className="brand">
          <div className="bolt">⚡</div>
          <div>
            <h1>Generador de Fichas Técnicas</h1>
            <span>Foto(s) + título + especificaciones → PDF (A4)</span>
          </div>
        </div>
        <div className="actions">
          <button className="btn" onClick={exportJson}>Exportar datos</button>
          <label className="btn" style={{ cursor: "pointer" }}>
            Importar datos
            <input type="file" accept=".json" onChange={importJson} style={{ display: "none" }} />
          </label>
          <button className="btn primary" onClick={downloadPdf}>Descargar PDF</button>
        </div>
      </div>

      <div className="main">
        {/* ================= EDITOR ================= */}
        <aside className="editor">
          <h2>Identidad</h2>
          <div className="field">
            <label>Logo de la empresa (opcional)</label>
            <div className={`file-drop${logo ? " loaded" : ""}`}>
              <span>{logo ? "Logo cargado" : "Haz clic para subir el logo"}</span>
              <input type="file" accept="image/*" onChange={onLogo} />
            </div>
            {logo && (
              <button className="file-clear" onClick={() => setLogo(null)}>Quitar logo</button>
            )}
          </div>
          <div className="field">
            <label>Nombre de la empresa</label>
            <input type="text" value={empresa} onChange={(e) => setEmpresa(e.target.value)} placeholder="Nombre de la empresa" />
          </div>

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

          <h2>Notas y pie de página</h2>
          <div className="field">
            <label>Notas / certificaciones (opcional)</label>
            <textarea value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Ej: Certificado IEC 60947-4-1. Garantía 12 meses." />
          </div>
          <div className="field">
            <label>Datos de contacto</label>
            <input type="text" value={contacto} onChange={(e) => setContacto(e.target.value)} placeholder="Ej: info@selec.cl · selec.cl" />
          </div>
        </aside>

        {/* ================= VISTA PREVIA ================= */}
        <div className="preview-zone">
          <div className="sheet">
            <div className="sheet-inner">
              <div className="ft-head">
                <div>
                  {logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="ft-logo" src={logo} alt={empresa} />
                  ) : (
                    <span className="ft-logo-text">{(empresa || "Empresa").toUpperCase()}</span>
                  )}
                </div>
                <div className="ft-doc">
                  <div className="doc-label">Ficha Técnica</div>
                  <div className="doc-code">{docCode}</div>
                </div>
              </div>
              <div className="volt-bar" />

              <div className="ft-title">{titulo || "Título del producto"}</div>
              <div className="ft-subtitle">
                {marca && <span>MARCA&nbsp;&nbsp;<b>{marca}</b></span>}
                {modelo && <span>MODELO&nbsp;&nbsp;<b>{modelo}</b></span>}
              </div>

              <div className="ft-body">
                <div className="ft-desc">{desc || "La descripción del producto aparecerá aquí."}</div>
                <div className={photosClass}>
                  {nPhotos === 0 ? (
                    <div className="ft-photo"><div className="ph">Fotografía<br />del producto</div></div>
                  ) : (
                    photos.map((src, idx) => (
                      <div className="ft-photo" key={idx}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={src} alt={titulo || "Producto"} />
                      </div>
                    ))
                  )}
                </div>
              </div>

              {specsHasContent && (
                <div className="ft-specs-block">
                  <div className="ft-specs-title">Características técnicas</div>
                  <table className="ft-specs">
                    <tbody>
                      {specs
                        .filter((s) => s.k.trim() || s.v.trim() || s.img)
                        .map((s, idx) => (
                          <tr key={idx}>
                            <td className="k">{s.k}</td>
                            <td className="v">
                              {s.img ? (
                                <>
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={s.img} alt={s.k || ""} />
                                  {s.v && <div style={{ marginTop: 4 }}>{s.v}</div>}
                                </>
                              ) : (
                                s.v
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}

              {notas && <div className="ft-notes">{notas}</div>}

              <div className="ft-foot">
                <span className="co">{empresa}</span>
                <span>{contacto}</span>
                <span className="date">{fecha}</span>
              </div>
            </div>
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
        .sheet-inner { flex: 1; display: flex; flex-direction: column; padding: 48px 52px 36px; }
        .ft-head { display: flex; justify-content: space-between; align-items: flex-end; padding-bottom: 14px; }
        .ft-logo { max-height: 52px; max-width: 220px; object-fit: contain; }
        .ft-logo-text { font-weight: 900; font-size: 26px; letter-spacing: .01em; font-stretch: 110%; }
        .ft-doc { text-align: right; }
        .ft-doc .doc-label { font-size: 12px; font-weight: 800; letter-spacing: .22em; text-transform: uppercase; }
        .ft-doc .doc-code { font-family: var(--font-mono), monospace; font-size: 11px; color: var(--steel); margin-top: 2px; }
        .volt-bar {
          height: 6px; background: var(--amber);
          background: repeating-linear-gradient(-45deg, var(--amber) 0 14px, var(--ink) 14px 17px);
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

        @media print {
          @page { size: A4; margin: 0; }
          html, body { overflow: visible !important; height: auto !important; background: #fff !important; }
          .topbar, .editor { display: none !important; }
          .main { display: block !important; overflow: visible !important; }
          .preview-zone { padding: 0 !important; background: #fff !important; display: block !important; overflow: visible !important; }
          .sheet { width: 210mm !important; min-height: 297mm !important; box-shadow: none !important; margin: 0 !important; transform: none !important; }
          .sheet-inner { padding: 14mm 15mm 10mm; }
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
