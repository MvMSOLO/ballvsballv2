/**
 * Next-gen circular aim dial — animated SVG, touch-first, private until lock.
 * Replaces the basic range slider for a premium competitive feel.
 */
import { useCallback, useId, useRef, type PointerEvent as ReactPointerEvent } from "react";

type Props = {
  angle: number; // 0–359
  locked: boolean;
  onChange: (angle: number) => void;
  onLock: () => void;
  reduceMotion?: boolean;
};

const SIZE = 220;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R_OUTER = 96;
const R_TRACK = 78;
const R_INNER = 52;

function polar(deg: number, r: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
}

export function AnimatedAimDial({ angle, locked, onChange, onLock, reduceMotion }: Props) {
  const uid = useId().replace(/:/g, "");
  const dragging = useRef(false);
  const svgRef = useRef<SVGSVGElement>(null);

  const setFromPointer = useCallback(
    (e: ReactPointerEvent | PointerEvent) => {
      const el = svgRef.current;
      if (!el || locked) return;
      const rect = el.getBoundingClientRect();
      const x = e.clientX - (rect.left + rect.width / 2);
      const y = e.clientY - (rect.top + rect.height / 2);
      let deg = (Math.atan2(y, x) * 180) / Math.PI + 90;
      if (deg < 0) deg += 360;
      onChange(Math.round(deg) % 360);
    },
    [locked, onChange],
  );

  const onDown = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      if (locked) return;
      dragging.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      setFromPointer(e);
    },
    [locked, setFromPointer],
  );

  const onMove = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      if (!dragging.current) return;
      setFromPointer(e);
    },
    [setFromPointer],
  );

  const onUp = useCallback((e: ReactPointerEvent<SVGSVGElement>) => {
    dragging.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  }, []);

  const tip = polar(angle, R_TRACK);
  const tipOuter = polar(angle, R_OUTER - 6);
  const arcPath = (() => {
    const start = polar(0, R_TRACK);
    const end = polar(angle, R_TRACK);
    const large = angle > 180 ? 1 : 0;
    return `M ${start.x} ${start.y} A ${R_TRACK} ${R_TRACK} 0 ${large} 1 ${end.x} ${end.y}`;
  })();

  return (
    <div className={`aim-dial ${locked ? "is-locked" : ""} ${reduceMotion ? "ba-reduced-motion" : ""}`}>
      <svg
        ref={svgRef}
        className="aim-dial-svg"
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        width={SIZE}
        height={SIZE}
        role="slider"
        aria-label="Launch angle"
        aria-valuemin={0}
        aria-valuemax={359}
        aria-valuenow={angle}
        aria-valuetext={`${angle} degrees`}
        aria-disabled={locked}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <defs>
          <linearGradient id={`aim-ring-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ff7a45" />
            <stop offset="50%" stopColor="#ff4d37" />
            <stop offset="100%" stopColor="#3ee0ff" />
          </linearGradient>
          <linearGradient id={`aim-fill-${uid}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ff5a36" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#3ee0ff" stopOpacity="0.85" />
          </linearGradient>
          <filter id={`aim-glow-${uid}`} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="3.5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id={`aim-core-${uid}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#1a2433" />
            <stop offset="70%" stopColor="#0d121a" />
            <stop offset="100%" stopColor="#080a0e" />
          </radialGradient>
        </defs>

        {Array.from({ length: 24 }, (_, i) => {
          const d = i * 15;
          const major = i % 6 === 0;
          const a = polar(d, major ? R_OUTER - 2 : R_OUTER - 8);
          const b = polar(d, R_OUTER + (major ? 4 : 0));
          return (
            <line
              key={i}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={major ? "rgba(255,122,69,0.55)" : "rgba(194,210,230,0.18)"}
              strokeWidth={major ? 2 : 1}
              strokeLinecap="round"
            />
          );
        })}

        <circle cx={CX} cy={CY} r={R_TRACK} fill="none" stroke="rgba(194,210,230,0.12)" strokeWidth={10} />

        <path
          d={arcPath}
          fill="none"
          stroke={`url(#aim-fill-${uid})`}
          strokeWidth={10}
          strokeLinecap="round"
          filter={reduceMotion ? undefined : `url(#aim-glow-${uid})`}
        />

        <circle cx={CX} cy={CY} r={R_INNER} fill={`url(#aim-core-${uid})`} stroke="rgba(194,210,230,0.2)" strokeWidth={1.5} />

        <line x1={CX - 14} y1={CY} x2={CX + 14} y2={CY} stroke="rgba(255,255,255,0.25)" strokeWidth={1} />
        <line x1={CX} y1={CY - 14} x2={CX} y2={CY + 14} stroke="rgba(255,255,255,0.25)" strokeWidth={1} />
        <circle cx={CX} cy={CY} r={4} fill="#ff7a45" />

        <line
          x1={CX}
          y1={CY}
          x2={tip.x}
          y2={tip.y}
          stroke={`url(#aim-ring-${uid})`}
          strokeWidth={2.5}
          strokeLinecap="round"
          opacity={0.9}
        />

        <circle
          cx={tipOuter.x}
          cy={tipOuter.y}
          r={locked ? 10 : 14}
          fill={locked ? "#61e6ac" : "#ff5a36"}
          stroke="#fff"
          strokeWidth={2}
          filter={reduceMotion ? undefined : `url(#aim-glow-${uid})`}
          className="aim-dial-handle"
        />
        {!locked && (
          <circle
            cx={tipOuter.x}
            cy={tipOuter.y}
            r={20}
            fill="none"
            stroke="rgba(255,90,54,0.35)"
            strokeWidth={1.5}
            className="aim-dial-pulse"
          />
        )}

        <text
          x={CX}
          y={CY + 6}
          textAnchor="middle"
          fill="#f4f6fb"
          fontFamily="IBM Plex Mono, ui-monospace, monospace"
          fontSize={22}
          fontWeight={700}
          letterSpacing="0.04em"
        >
          {angle}°
        </text>
      </svg>

      <button
        type="button"
        className="primary-button compact aim-lock-btn"
        disabled={locked}
        onClick={onLock}
      >
        {locked ? (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M7 11V8a5 5 0 0 1 10 0v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="2" />
              <path d="M12 15v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            AIM LOCKED
          </>
        ) : (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
              <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            LOCK AIM
          </>
        )}
      </button>
    </div>
  );
}
