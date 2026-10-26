import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  experimental: {
    // 4 MB files plus form overhead, within Vercel's 4.5 MB function payload limit.
    serverActions: { bodySizeLimit: '4.25mb' },
  },
  // Supports path tracing when living in a subfolder inside a monorepo
  outputFileTracingRoot: path.join(import.meta.dirname ?? process.cwd(), "../"),

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
