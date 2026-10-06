import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingRoot: process.cwd(),
  // The editor is a heavy client-side canvas app; keep large binaries out of the server bundle
  // and allow the sandbox / preview proxy hosts to talk to the dev server.
  allowedDevOrigins: [
    "*.e2b.app",
    "*.e2b.dev",
    "*.arena.ai",
    "localhost",
    "127.0.0.1",
  ],
  serverExternalPackages: ["tesseract.js", "pdfjs-dist"],
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  async headers() {
    return [
      {
        // Tesseract workers / wasm cores must be same-origin fetchable.
        source: "/tesseract/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
        ],
      },
      {
        source: "/workers/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
