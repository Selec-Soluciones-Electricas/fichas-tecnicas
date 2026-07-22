import type { Metadata } from "next";
import { Archivo, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

// Configuración de fuentes
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
});
// Configuración de fuentes
const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
});
// Metadata de la página
export const metadata: Metadata = {
  title: "Ficha Técnica",
  description: "Crea fichas técnicas de productos (A4) listas para exportar a PDF.",
};
// Layout raíz de la aplicación
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${archivo.variable} ${ibmPlexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
