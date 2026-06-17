import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Codespaces port-forwarding: browser may use github.dev while origin stays localhost
  allowedDevOrigins: ['*.app.github.dev', '*.github.dev'],
  experimental: {
    serverActions: {
      // Allow origin/host mismatch when behind reverse proxies (Codespaces, Vercel)
      allowedOrigins: [
        'localhost:3000',
        'localhost:3001',
        '127.0.0.1:3000',
        '127.0.0.1:3001',
        '*.vercel.app',
        '*.github.dev',
        '*.app.github.dev',
      ],
    },
  },
};

export default nextConfig;
