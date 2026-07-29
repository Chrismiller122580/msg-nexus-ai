/**
 * Shared mark for favicon / PWA icons (next/og ImageResponse + Satori).
 * Uses only geometric divs — Satori does not load system fonts by default,
 * so text like "MN" would render as a blank square.
 */
export function AppIconMarkup({
  size,
  maskable = false,
}: {
  size: number;
  /** Extra safe-zone padding for Android maskable icons (~20% total). */
  maskable?: boolean;
}) {
  // Outer pad: maskable needs ~10% per side; regular icons get a light inset
  const padRatio = maskable ? 0.12 : 0.08;
  const pad = Math.round(size * padRatio);
  const inner = size - pad * 2;

  // Bubble + nexus node proportions relative to inner square
  const bubbleW = Math.round(inner * 0.62);
  const bubbleH = Math.round(inner * 0.48);
  const bubbleR = Math.round(bubbleH * 0.28);
  const node = Math.max(Math.round(inner * 0.16), 6);
  const tail = Math.max(Math.round(inner * 0.12), 4);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #d946ef 100%)',
      }}
    >
      <div
        style={{
          width: inner,
          height: inner,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        {/* Soft plate behind mark for contrast on maskable crops */}
        <div
          style={{
            position: 'absolute',
            width: Math.round(inner * 0.92),
            height: Math.round(inner * 0.92),
            borderRadius: Math.round(inner * 0.22),
            background: 'rgba(255,255,255,0.12)',
            display: 'flex',
          }}
        />

        {/* Message bubble */}
        <div
          style={{
            position: 'absolute',
            width: bubbleW,
            height: bubbleH,
            borderRadius: bubbleR,
            background: 'white',
            display: 'flex',
            left: Math.round((inner - bubbleW) / 2 - inner * 0.04),
            top: Math.round((inner - bubbleH) / 2 - inner * 0.06),
            boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
          }}
        />

        {/* Bubble tail */}
        <div
          style={{
            position: 'absolute',
            width: tail,
            height: tail,
            background: 'white',
            left: Math.round((inner - bubbleW) / 2 - inner * 0.02),
            bottom: Math.round((inner - bubbleH) / 2 + inner * 0.02),
            transform: 'rotate(45deg)',
            display: 'flex',
          }}
        />

        {/* Chat lines inside bubble */}
        <div
          style={{
            position: 'absolute',
            width: Math.round(bubbleW * 0.55),
            height: Math.max(Math.round(inner * 0.045), 3),
            borderRadius: 999,
            background: '#a78bfa',
            left: Math.round((inner - bubbleW) / 2 + bubbleW * 0.12),
            top: Math.round((inner - bubbleH) / 2 + bubbleH * 0.28),
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            width: Math.round(bubbleW * 0.38),
            height: Math.max(Math.round(inner * 0.045), 3),
            borderRadius: 999,
            background: '#c4b5fd',
            left: Math.round((inner - bubbleW) / 2 + bubbleW * 0.12),
            top: Math.round((inner - bubbleH) / 2 + bubbleH * 0.52),
            display: 'flex',
          }}
        />

        {/* Nexus node (AI / connection) */}
        <div
          style={{
            position: 'absolute',
            width: node,
            height: node,
            borderRadius: node,
            background: '#f0abfc',
            border: `${Math.max(Math.round(inner * 0.02), 2)}px solid white`,
            right: Math.round(inner * 0.14),
            top: Math.round(inner * 0.18),
            display: 'flex',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          }}
        />
        {/* Second smaller node */}
        <div
          style={{
            position: 'absolute',
            width: Math.round(node * 0.7),
            height: Math.round(node * 0.7),
            borderRadius: node,
            background: '#818cf8',
            border: `${Math.max(Math.round(inner * 0.015), 1)}px solid white`,
            right: Math.round(inner * 0.22),
            bottom: Math.round(inner * 0.2),
            display: 'flex',
          }}
        />
      </div>
    </div>
  );
}
