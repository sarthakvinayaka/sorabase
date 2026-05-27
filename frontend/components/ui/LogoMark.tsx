/**
 * LogoMark — the Sorabase waveform-to-lines mark.
 *
 * Two variants:
 *   <LogoMark />   — icon only, currentColor (nav/auth, adapts to theme)
 *                    `size` controls the rendered HEIGHT; width scales from aspect ratio.
 *   <LogoIcon />   — icon inside the navy square (favicon / standalone brand use)
 *                    `size` controls width = height (square).
 */

// Tight viewBox cropped to the actual mark content (stroke-aware padding).
// Covers x: 8–92, y: 17–67 → 84 wide × 50 tall → aspect ratio 1.68
const MARK_VIEWBOX = "8 17 84 50";
const MARK_ASPECT  = 84 / 50; // ≈ 1.68

export function LogoMark({
  size = 28,
  className,
}: {
  size?: number;
  className?: string;
}) {
  const h = size;
  const w = Math.round(h * MARK_ASPECT);

  return (
    <svg
      width={w}
      height={h}
      viewBox={MARK_VIEWBOX}
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M14 50 C19 50 19 39 24 39 C29 39 29 61 34 61 C39 61 43 32 47 27 C50 23 52 42 56 44"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line x1="56" y1="33" x2="86" y2="33" stroke="currentColor" strokeWidth="6" strokeLinecap="round"/>
      <line x1="56" y1="44" x2="86" y2="44" stroke="currentColor" strokeWidth="6" strokeLinecap="round"/>
      <line x1="56" y1="55" x2="86" y2="55" stroke="currentColor" strokeWidth="6" strokeLinecap="round"/>
    </svg>
  );
}

export function LogoIcon({
  size = 32,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      aria-label="Sorabase"
      className={className}
    >
      <rect width="100" height="100" rx="20" fill="#0C1221"/>
      <path
        d="M14 50 C19 50 19 39 24 39 C29 39 29 61 34 61 C39 61 43 32 47 27 C50 23 52 42 56 44"
        stroke="white"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line x1="56" y1="33" x2="86" y2="33" stroke="white" strokeWidth="6" strokeLinecap="round"/>
      <line x1="56" y1="44" x2="86" y2="44" stroke="white" strokeWidth="6" strokeLinecap="round"/>
      <line x1="56" y1="55" x2="86" y2="55" stroke="white" strokeWidth="6" strokeLinecap="round"/>
    </svg>
  );
}
