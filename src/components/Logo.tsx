/**
 * Hermes mark: a side-on dumbbell whose plates and handle also read as an "H".
 * Colours follow the brand tokens so it works on light and dark surfaces.
 */
export function LogoMark({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="hermes-mark-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1f3a30" />
          <stop offset="1" stopColor="#0e1c17" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill="url(#hermes-mark-bg)" />
      <g fill="#d4ee89">
        <rect x="10" y="14" width="8" height="36" rx="4" />
        <rect x="46" y="14" width="8" height="36" rx="4" />
        <rect x="19.5" y="20" width="6" height="24" rx="3" opacity="0.72" />
        <rect x="38.5" y="20" width="6" height="24" rx="3" opacity="0.72" />
        <rect x="24" y="29" width="16" height="6" rx="3" />
      </g>
    </svg>
  );
}
