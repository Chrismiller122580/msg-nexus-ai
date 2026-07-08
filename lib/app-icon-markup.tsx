/** Shared mark for favicon / PWA icons (ImageResponse JSX). */
export function AppIconMarkup({
  fontSize,
  borderRadius,
}: {
  fontSize: number;
  borderRadius: number;
}) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius,
        background: 'linear-gradient(135deg, #818cf8, #a78bfa, #e879f9)',
        color: 'white',
        fontSize,
        fontWeight: 700,
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      MN
    </div>
  );
}