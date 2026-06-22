import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    'lighthouse',
    'chrome-launcher',
    'playwright',
    'axe-core',
  ],
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
