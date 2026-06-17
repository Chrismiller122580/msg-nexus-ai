import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  allowedDevOrigins: ['*.app.github.dev', '*.github.dev'],
  experimental: {
    serverActions: {
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
