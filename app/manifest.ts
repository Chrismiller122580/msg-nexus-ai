import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'MsgNexus.AI',
    short_name: 'MsgNexus',
    description: 'Unified messaging inbox with AI-powered bill and subscription detection',
    start_url: '/inbox',
    display: 'standalone',
    background_color: '#0a0a0a',
    theme_color: '#6366f1',
    icons: [
      {
        src: '/icon',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}