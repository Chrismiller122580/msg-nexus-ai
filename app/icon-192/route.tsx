import { generateAppIcon } from '@/lib/generate-app-icon';

export const runtime = 'edge';

export async function GET() {
  return generateAppIcon(192);
}