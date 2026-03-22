export function BrandLogo({ size = 34 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      className="brand-logo-svg"
      aria-hidden
    >
      {/* Outer dashed ring — rotates */}
      <circle
        cx="20" cy="20" r="18"
        stroke="currentColor"
        strokeWidth="1"
        strokeOpacity="0.35"
        strokeDasharray="5 3"
        className="brand-logo-ring"
      />
      {/* Solid mid ring */}
      <circle cx="20" cy="20" r="11.5" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.65" />
      {/* Tick marks (crosshair ticks) */}
      <line x1="20" y1="1"  x2="20" y2="8.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="20" y1="31.5" x2="20" y2="39" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="1"  y1="20" x2="8.5" y2="20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="31.5" y1="20" x2="39" y2="20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      {/* Tick-end dots */}
      <circle cx="20" cy="8.5"  r="1.5" fill="currentColor" fillOpacity="0.55" />
      <circle cx="20" cy="31.5" r="1.5" fill="currentColor" fillOpacity="0.55" />
      <circle cx="8.5"  cy="20" r="1.5" fill="currentColor" fillOpacity="0.55" />
      <circle cx="31.5" cy="20" r="1.5" fill="currentColor" fillOpacity="0.55" />
      {/* Center dot */}
      <circle cx="20" cy="20" r="4" fill="currentColor" />
      {/* Inner glow ring */}
      <circle cx="20" cy="20" r="7" stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.4" />
    </svg>
  );
}
