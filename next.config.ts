import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: "standalone",
  // `@olb/contract` is a local `file:../olb-contract` dependency, so the
  // workspace root sits one level above the web app.
  turbopack: {
    root: path.resolve(process.cwd(), ".."),
  },
  async headers() {
    return [
      {
        // The worker lives at /score/sw.js, whose default max scope is /score/.
        // Allow the exact /score scope so the index page is controlled too.
        source: "/score/sw.js",
        headers: [{ key: "Service-Worker-Allowed", value: "/score" }],
      },
    ];
  },
};

export default nextConfig;
