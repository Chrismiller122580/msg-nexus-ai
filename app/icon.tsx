import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 8,
          background: 'linear-gradient(135deg, #818cf8, #a78bfa, #e879f9)',
          color: 'white',
          fontSize: 14,
          fontWeight: 700,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        MN
      </div>
    ),
    { ...size }
  );
}
