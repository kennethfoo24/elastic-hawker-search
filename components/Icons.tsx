import type { TierKey } from "@/lib/types";

type IconProps = { className?: string };

export function SearchGlassIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" />
      <path d="M20 20L15.8 15.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function LayersIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M12 3l8 4.2-8 4.2-8-4.2L12 3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M4 12l8 4.2 8-4.2" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M4 16.4l8 4.2 8-4.2" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

export function TrophyIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M7 4h10v4a5 5 0 01-10 0V4z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M7 5H4v1a4 4 0 004 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M17 5h3v1a4 4 0 01-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12 13v3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8.5 20h7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M9 20v-1.5a3 3 0 016 0V20" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export function PinIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M12 21s7-6.1 7-11.5A7 7 0 0 0 5 9.5C5 14.9 12 21 12 21z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="9.5" r="2.4" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

const TIER_ICON: Record<TierKey, (p: IconProps) => React.ReactElement> = {
  keyword: SearchGlassIcon,
  semantic: LayersIcon,
  hybrid: TrophyIcon,
};

export function TierIcon({ tier, className }: { tier: TierKey; className?: string }) {
  const Cmp = TIER_ICON[tier];
  return <Cmp className={className} />;
}
