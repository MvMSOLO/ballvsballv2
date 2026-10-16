export type HubLogoKind = "profile" | "shop" | "inventory" | "ranks" | "settings" | "account" | "login";

export function HubLogo({ kind }: { kind: HubLogoKind }) {
  return (
    <svg className={`hub-logo hub-logo-${kind}`} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`hub-grad-${kind}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#a5f3fc" />
          <stop offset="55%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#c4b5fd" />
        </linearGradient>
      </defs>
      <path className="hub-logo-orbit" d="M17 3H31L45 17V31L31 45H17L3 31V17Z" />
      {kind === "profile" && <><path className="hub-logo-core" d="M24 9 31 13V21L24 25 17 21V13Z" /><path className="hub-logo-line" d="M10 38 14 30 24 26 34 30 38 38 34 41H14Z" /></>}
      {kind === "shop" && <><path className="hub-logo-line" d="M7 9H14L19 31H36L41 14H16" /><path className="hub-logo-core" d="M18 36 21 33 24 36 21 40Z M32 36 35 33 38 36 35 40Z" /><path className="hub-logo-line" d="M23 19V27M30 19V27" /></>}
      {kind === "inventory" && <><path className="hub-logo-line" d="M24 5 41 15V33L24 43 7 33V15Z" /><path className="hub-logo-line" d="m9 16 15 9 15-9M24 25v15" /><path className="hub-logo-core" d="m18 12 15 8" /></>}
      {kind === "ranks" && <><path className="hub-logo-line" d="M15 8H33V18L29 27 24 31 19 27 15 18Z" /><path className="hub-logo-line" d="M15 13H7V19L17 27M33 13H41V19L31 27M24 31V38M15 41H33" /><path className="hub-logo-core" d="M24 12 27 18 34 19 29 24 30 30 24 27 18 30 19 24 14 19 21 18Z" /></>}
      {kind === "settings" && <><path className="hub-logo-line" d="M19 5H29L31 11 37 14 43 12 46 20 41 24 43 29 38 36 32 34 28 43H20L18 37 12 34 6 36 3 28 8 24 6 19 11 12 17 14Z" /><path className="hub-logo-core" d="M24 17 31 21V27L24 31 17 27V21Z" /></>}
      {kind === "account" && <><path className="hub-logo-line" d="M24 4 41 12V24L35 35 24 43 13 35 7 24V12Z" /><path className="hub-logo-core" d="M24 12 30 16V22L24 26 18 22V16Z" /><path className="hub-logo-line" d="M15 33 19 28H29L33 33" /></>}
      {kind === "login" && <><path className="hub-logo-line" d="M26 7H41V41H26M5 24H31M21 14 31 24 21 34" /><path className="hub-logo-core" d="M8 8H17V17H8Z" /></>}
    </svg>
  );
}
