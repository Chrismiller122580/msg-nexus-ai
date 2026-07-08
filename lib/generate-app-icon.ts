import { ImageResponse } from 'next/og';
import { AppIconMarkup } from '@/lib/app-icon-markup';

export function generateAppIcon(size: number) {
  const scale = size / 32;
  return new ImageResponse(
    AppIconMarkup({
      fontSize: Math.round(14 * scale),
      borderRadius: Math.round(8 * scale),
    }),
    { width: size, height: size }
  );
}