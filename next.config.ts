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
};

export default nextConfig;
