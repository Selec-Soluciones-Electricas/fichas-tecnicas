// Prpops for the FichaHeader component
type FichaHeaderProps = {
  logo: string | null;
  empresa: string;
  docCode: string;
};
// FichaHeader component that displays the header of the technical sheet
export default function FichaHeader({ logo, empresa, docCode }: FichaHeaderProps) {
  return (
    <div className="ft-head">
      <div>
        {logo ? (
          <img src={logo} width="150" height="150" alt={empresa} />
        ) : (
          <span className="ft-logo-text">{(empresa || "SELEC").toUpperCase()}</span>
        )}
      </div>
      <div className="ft-doc">
        <div className="doc-label">Ficha Técnica</div>
        <div className="doc-code">{docCode}</div>
      </div>
    </div>
  );
}
