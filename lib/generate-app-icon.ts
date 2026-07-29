import { ImageResponse } from 'next/og';
import { AppIconMarkup } from '@/lib/app-icon-markup';

export function generateAppIcon(size: number, opts?: { maskable?: boolean }) {
  return new ImageResponse(AppIconMarkup({ size, maskable: opts?.maskable }), {
    width: size,
    height: size,
  });
}
