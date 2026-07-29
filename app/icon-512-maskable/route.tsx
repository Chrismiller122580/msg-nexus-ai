import { generateAppIcon } from '@/lib/generate-app-icon';

export const runtime = 'edge';

/** Maskable PWA icon with safe-zone padding for Android adaptive icons. */
export async function GET() {
  return generateAppIcon(512, { maskable: true });
}
