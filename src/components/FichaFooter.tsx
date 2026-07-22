// Componente que representa el pie de página de la ficha técnica, mostrando la empresa, el contacto y la fecha 
type FichaFooterProps = {
  empresa: string;
  contacto: string;
  fecha: string;
};

export default function FichaFooter({ empresa, contacto, fecha }: FichaFooterProps) {
  const footerContact = contacto || "info@selec.cl · selec.cl";
  const footerCompany = empresa || "SELEC";

  return (
    <div className="ft-foot">
      <span className="co">{footerCompany}</span>
      <span>{footerContact}</span>
      <span className="date">{fecha}</span>
    </div>
  );
}
