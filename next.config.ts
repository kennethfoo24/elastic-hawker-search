import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // standalone output → small Docker image for Cloud Run (Phase B)
  output: "standalone",
};

export default nextConfig;
