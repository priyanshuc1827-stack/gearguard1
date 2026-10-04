import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep Turbopack scoped to this app when the repository has other lockfiles.
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
