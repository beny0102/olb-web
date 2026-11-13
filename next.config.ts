import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: "standalone",
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
