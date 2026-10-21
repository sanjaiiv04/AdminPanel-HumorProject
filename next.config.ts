import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
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