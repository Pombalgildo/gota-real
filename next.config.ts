import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // "standalone" só é preciso no sandbox de pré-visualização local;
  // na Vercel (process.env.VERCEL definido) usa-se o build normal.
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: ["*.space-z.ai", "*.chat.z.ai", "localhost"],
  // o service worker NUNCA pode ser cacheado — senão os clientes ficam
  // presos na versão antiga da app mesmo depois de actualizações
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
