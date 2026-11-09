import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // proxy.ts (login) lee las solicitudes antes que las rutas; por defecto corta los
    // cuerpos sobre 10 MB, y los PDF de fichas técnicas pueden pesar hasta 20 MB.
    proxyClientMaxBodySize: "25mb",
  },
};

export default nextConfig;