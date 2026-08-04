"use client";

import dynamic from "next/dynamic";


const FichaTecnicaGenerator = dynamic(() => import("@/components/FichaTecnicaGenerator"), {
  ssr: false,
});

export default function Page() {
  return <FichaTecnicaGenerator />;
}
