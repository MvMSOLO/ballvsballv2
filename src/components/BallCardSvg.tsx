/**
 * Animated SVG ball preview for pick cards — rarity rings, face glyphs, particle hints.
 */
import { useId } from "react";
import type { BallDef } from "@/sim/types";

type Props = {
  ball: BallDef;
  selected?: boolean;
  confirmed?: boolean;
  reduceMotion?: boolean;
};

const FACE_PATHS: Record<string, string> = {
  grin: "M9 13c1.2 1.6 3.2 2.4 5 2.4s3.8-.8 5-2.4M8 9.2h1.6M16.4 9.2H18",
  angry: "M8 13.5c1.4-1 3.2-1.4 5-1.4s3.6.4 5 1.4M8.2 8.2l2.2 1.4M17.8 8.2l-2.2 1.4",
  sleepy: "M9 13.2c1 .8 2.6 1.2 4 1.2s3-.4 4-1.2M8.5 9.5h2M15.5 9.5h2",
  cool: "M7.5 9.2h4.2M14.3 9.2h4.2M9 13.5c1.2.9 2.8 1.3 4 1.3s2.8-.4 4-1.3",
  cute: "M9 13.2c1.2 1.4 3 2 4 2s2.8-.6 4-2M8.5 9.2c.4-.6 1-.6 1.4 0M16.1 9.2c.4-.6 1-.6 1.4 0",
  robot: "M8 8.5h3v2.2H8zM15 8.5h3v2.2h-3zM10 13.5h6M9 16h8",
  ghost: "M9 13.5c1.2 1 3 1.5 4 1.5s2.8-.5 4-1.5M9 9.5c.3-.5.8-.5 1.1 0M15.9 9.5c.3-.5.8-.5 1.1 0",
  wink: "M8.5 9.2h2.2M15.5 8.8c.5-.4 1.2-.4 1.6 0M9 13.2c1.2 1.2 3 1.8 4 1.8s2.8-.6 4-1.8",
  focus: "M9 9.5h1.8M15.2 9.5H17M10 13.5c.8.6 1.8.9 3 .9s2.2-.3 3-.9",
};

export function BallCardSvg({ ball, selected, confirmed, reduceMotion }: Props) {
  const uid = useId().replace(/:/g, "");
  const face = ball.visual?.face ?? "grin";
  const facePath = FACE_PATHS[face] ?? FACE_PATHS.grin;
  const base = ball.visual?.baseColor ?? "#4aa3ff";
  const accent = ball.visual?.accentColor ?? "#80c4ff";
  const rarity = ball.rarity ?? "common";

  const rarityStops: Record<string, [string, string]> = {
    common: ["#8a97a8", "#c2d2e6"],
    rare: ["#3b82f6", "#93c5fd"],
    epic: ["#a855f7", "#e9d5ff"],
    legendary: ["#f59e0b", "#fde68a"],
    mythic: ["#ef4444", "#fca5a5"],
  };
  const [r1, r2] = rarityStops[rarity] ?? rarityStops.common;

  return (
    <svg
      className={`ball-card-svg ${selected ? "is-selected" : ""} ${confirmed ? "is-confirmed" : ""} ${reduceMotion ? "ba-reduced-motion" : ""}`}
      viewBox="0 0 96 96"
      width={88}
      height={88}
      aria-hidden
    >
      <defs>
        <radialGradient id={`ball-body-${uid}`} cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.95" />
          <stop offset="55%" stopColor={base} />
          <stop offset="100%" stopColor={base} stopOpacity="0.85" />
        </radialGradient>
        <linearGradient id={`rarity-ring-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={r1} />
          <stop offset="100%" stopColor={r2} />
        </linearGradient>
        <filter id={`ball-glow-${uid}`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <circle
        cx="48"
        cy="48"
        r="44"
        fill="none"
        stroke={`url(#rarity-ring-${uid})`}
        strokeWidth={selected ? 3 : 1.8}
        strokeDasharray={rarity === "mythic" ? "4 3" : rarity === "legendary" ? "6 2" : undefined}
        className="ball-rarity-ring"
        opacity={selected ? 1 : 0.75}
      />

      {!reduceMotion && (
        <circle cx="48" cy="48" r="38" fill={base} opacity={0.12} className="ball-aura" />
      )}

      <circle
        cx="48"
        cy="48"
        r="32"
        fill={`url(#ball-body-${uid})`}
        filter={reduceMotion ? undefined : `url(#ball-glow-${uid})`}
        stroke="rgba(255,255,255,0.22)"
        strokeWidth={1.5}
      />

      <ellipse cx="38" cy="36" rx="10" ry="7" fill="rgba(255,255,255,0.28)" />

      <g transform="translate(30 30) scale(1.5)" fill="none" stroke="rgba(8,10,14,0.75)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d={facePath} />
      </g>

      {ball.visual?.pattern === "dots" && (
        <g fill="rgba(255,255,255,0.18)">
          <circle cx="58" cy="58" r="2" />
          <circle cx="64" cy="52" r="1.5" />
          <circle cx="54" cy="64" r="1.5" />
        </g>
      )}
      {ball.visual?.pattern === "stars" && (
        <path
          d="M62 54l1.2 2.4 2.6.4-1.9 1.8.5 2.6-2.4-1.3-2.4 1.3.5-2.6-1.9-1.8 2.6-.4z"
          fill="rgba(255,255,255,0.35)"
        />
      )}

      {selected && (
        <g className="ball-select-mark">
          <circle cx="76" cy="20" r="10" fill="#61e6ac" stroke="#0b0e13" strokeWidth="2" />
          <path d="M71 20l3 3 6-6" fill="none" stroke="#0b0e13" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )}
    </svg>
  );
}
