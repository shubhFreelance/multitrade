import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  // Invoice PDFs read their fonts from disk at runtime.
  outputFileTracingIncludes: { "/api/v1/**": ["./assets/fonts/**"] },
  // Dev only: forwarding browser errors (e.g. from the React DevTools extension) to the terminal set off an endless reload loop.
  logging: { browserToTerminal: false },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default createNextIntlPlugin("./src/lib/i18n.ts")(nextConfig);
