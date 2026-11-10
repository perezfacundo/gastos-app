import type { NextConfig } from "next";

/**
 * Cabeceras de seguridad HTTP aplicadas a todas las respuestas.
 * (Una Content-Security-Policy estricta es el siguiente paso; requiere listar
 * el dominio de Supabase y manejar los scripts inline de Next con nonces.)
 */
const securityHeaders = [
  // Impide que otro sitio muestre la app dentro de un <iframe> (clickjacking).
  { key: "X-Frame-Options", value: "DENY" },
  // El navegador no "adivina" tipos de archivo (evita ejecutar contenido disfrazado).
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Al navegar a otro sitio, solo se envía el dominio de origen, no la URL completa.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // La app no usa cámara, micrófono ni ubicación: se bloquean explícitamente.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Fuerza HTTPS durante 2 años (Vercel ya sirve todo por HTTPS).
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // No anunciar "X-Powered-By: Next.js" (menos información para un atacante).
  poweredByHeader: false,
  headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        // El service worker nunca se cachea: así cada deploy llega a todos.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
