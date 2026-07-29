"use client";

import dynamic from "next/dynamic";

// Este componente depende de localStorage, portapapeles y archivos del navegador, por lo
// que no tiene sentido renderizarlo en el servidor: se carga solo en el cliente para evitar
// un desajuste de hidratación entre el HTML del servidor y los datos restaurados localmente.
const FichaTecnicaGenerator = dynamic(() => import("@/components/FichaTecnicaGenerator"), {
  ssr: false,
});

export default function Page() {
  return <FichaTecnicaGenerator />;
}
