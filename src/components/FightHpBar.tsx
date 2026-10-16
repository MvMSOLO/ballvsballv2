/**
 * Premium animated SVG HP bar for fight HUD.
 */
import { useId } from "react";

type Props = {
  current: number;
  max: number;
  accent?: string;
  label: string;
  side: "you" | "rival";
  reduceMotion?: boolean;
};

export function FightHpBar({ current, max, accent = "#4aa3ff", label, side, reduceMotion }: Props) {
  const uid = useId().replace(/:/g, "");
  const pct = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;
  const critical = pct <= 25 && pct > 0;
  const dead = pct <= 0;

  return (
    <div className={`fight-hp ${side} ${critical ? "is-critical" : ""} ${dead ? "is-dead" : ""}`}>
      <div className="fight-hp-meta">
        <span className="fight-hp-label">{label}</span>
        <span className="fight-hp-nums ba-data">
          {Math.max(0, Math.ceil(current))}
          <i>/</i>
          {Math.ceil(max)}
        </span>
      </div>
      <svg className="fight-hp-svg" viewBox="0 0 200 14" preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id={`hp-fill-${uid}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={critical ? "#ff4d37" : accent} />
            <stop offset="100%" stopColor={critical ? "#ff704e" : "#fff"} stopOpacity={0.85} />
          </linearGradient>
          <filter id={`hp-glow-${uid}`}>
            <feGaussianBlur stdDeviation="1.6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <rect x="0" y="2" width="200" height="10" rx="3" fill="rgba(194,210,230,0.1)" />
        <rect
          x="0"
          y="2"
          width={pct * 2}
          height="10"
          rx="3"
          fill={`url(#hp-fill-${uid})`}
          filter={reduceMotion || dead ? undefined : `url(#hp-glow-${uid})`}
          className="fight-hp-fill"
        />
        {[25, 50, 75].map((t) => (
          <line key={t} x1={t * 2} y1="2" x2={t * 2} y2="12" stroke="rgba(8,10,14,0.35)" strokeWidth="1" />
        ))}
      </svg>
      {critical && !dead && <strong className="fight-hp-warn">CRITICAL</strong>}
    </div>
  );
}
