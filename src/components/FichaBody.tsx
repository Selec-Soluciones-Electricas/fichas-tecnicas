import { sanitizeDescHtml } from "@/lib/richText";

type FichaBodyProps = {
  titulo: string;
  marca: string;
  modelo: string;
  desc: string;
  photos: string[];
  specs: Array<{ k: string; v: string; img: string | null }>;
  notes?: string;
};
export default function FichaBody({
  titulo,
  marca,
  modelo,
  desc,
  photos,
  specs,
  notes,
}: FichaBodyProps) {
  const nPhotos = photos.length;
  const photosClass = `ft-photos n${nPhotos === 0 ? 1 : Math.min(nPhotos, 4)}`;
  const specsHasContent = specs.some((s) => s.k.trim() || s.v.trim() || s.img);
  return (
    <>
      <div className="ft-title">{titulo || "Título del producto"}</div>
      <div className="ft-subtitle">
        {marca && <span>MARCA&nbsp;&nbsp;<b>{marca}</b></span>}
        {modelo && <span>MODELO&nbsp;&nbsp;<b>{modelo}</b></span>}
      </div>

      <div className="ft-body">
        <div
          className="ft-desc"
          dangerouslySetInnerHTML={{
            __html: desc.replace(/<[^>]+>/g, "").trim()
              ? sanitizeDescHtml(desc)
              : "<p>La descripción del producto aparecerá aquí.</p>",
          }}
        />
        <div className={photosClass}>
          {nPhotos === 0 ? (
            <div className="ft-photo"><div className="ph">Fotografía<br />del producto</div></div>
          ) : (
            photos.map((src, idx) => (
              <div className="ft-photo" key={idx}>
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
                    {s.img ? (
                      <td className="v-image" colSpan={2}>
                        <div className="spec-image-wrap">
                          <img src={s.img} alt={s.k || s.v || ""} />
                          {s.v && <div className="spec-image-caption">{s.v}</div>}
                        </div>
                      </td>
                    ) : (
                      <>
                        <td className="k">{s.k}</td>
                        <td className="v">{s.v}</td>
                      </>
                    )}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {notes && <div className="ft-notes">{notes}</div>}

      <style jsx>{`
        .spec-image-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          width: 100%;
        }
        .spec-image-wrap img {
          width: auto;
          max-width: 100%;
          height: auto;
          max-height: 1600px;
          object-fit: contain;
          display: block;
          margin: 0 auto;
          border-radius: 4px;
        }
        .spec-image-caption {
          font-size: 11px;
          color: #5c6670;
          line-height: 1.4;
          text-align: center;
        }
      `}</style>
    </>
  );
}
