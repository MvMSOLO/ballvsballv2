import { useEffect } from "react";

/** Temporary stub while full page is restored. */
export function BallArenaPage() {
  useEffect(() => {
    console.warn("BallArenaPage stub: full next-gen UI components are on main; wire full page next.");
  }, []);
  return (
    <main className="game-shell" style={{ padding: 24, fontFamily: "system-ui", minHeight: "100vh", background: "#080a0e", color: "#f4f6fb" }}>
      <h1 style={{ color: "#ff7a45", fontFamily: "Chakra Petch, sans-serif" }}>BALL ARENA</h1>
      <p style={{ color: "#b6c0cf", maxWidth: 480, lineHeight: 1.6 }}>
        Next-gen components are live on <code>main</code>: AnimatedAimDial, BallCardSvg, FightHpBar, MatchPhaseUI, nextgen-ui.css.
      </p>
      <p style={{ color: "#7d899b", fontSize: 13, maxWidth: 480, lineHeight: 1.5 }}>
        Full arena page source is ready locally (index.final.tsx / BallArenaPage.tsx). Pushing full page next.
      </p>
    </main>
  );
}
