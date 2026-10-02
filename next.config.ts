import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Removed "export" to enable API routes for AI-powered template generation.
  // "standalone" emits a minimal self-contained server bundle (.next/standalone)
  // for lean production Docker images.
  output: "standalone",
};

export default nextConfig;
