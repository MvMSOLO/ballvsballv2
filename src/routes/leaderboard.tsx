import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { leaderboard } from "@/lib/arena/server-fns";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { PortalShell } from "@/components/portal-shell";

export const Route = createFileRoute("/leaderboard")({ component: LeaderboardPage });
type LeaderboardRow = { username: string; country: string; trophies: number; favorite: string };

function LeaderboardPage() {
  const { user, isPending } = useCurrentUserState();
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [myRankName, setMyRankName] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let current = true;
    if (isPending) return () => { current = false; };
    if (!user) { setBusy(false); return () => { current = false; }; }
    setBusy(true);
    void leaderboard({ data: { scope: "global", cursor: 0 } }).then((result) => {
      if (!current) return;
      setRows(result.rows);
      setMyRankName(result.me?.username ?? "");
      setError("");
    }).catch((reason: unknown) => {
      if (!current) return;
      setError(reason instanceof Error ? reason.message : "Leaderboard is not available right now.");
    }).finally(() => { if (current) setBusy(false); });
    return () => { current = false; };
  }, [user?.id, user?.isDevFallback, isPending, user]);

  return <PortalShell active="leaderboard" title="GLOBAL RANKINGS" description="Rankings are built from cloud-saved player profiles and trophies.">
    {!isPending && !user && <section className="portal-panel leaderboard-locked"><span className="leaderboard-symbol">🏆</span><h2>Sign in to load rankings</h2><p>Connect an account to view the cloud leaderboard and keep your rank synced.</p><a className="portal-button primary" href="/login">SIGN IN / CREATE ACCOUNT ↗</a></section>}
    {user && <section className="portal-panel"><div className="portal-section-heading"><span className="portal-kicker">SEASON 01</span><h2>Top players</h2></div>
      {busy ? <div className="portal-empty"><span className="portal-spinner" /><strong>Loading rankings…</strong></div> : error ? <div className="portal-empty"><span>!</span><strong>Rankings unavailable</strong><p>{error}</p><button className="portal-button secondary" onClick={() => window.location.reload()}>RETRY</button></div> : rows.length ? <div className="rank-table">
        <div className="rank-table-head"><span>RANK / PLAYER</span><span>COUNTRY</span><span>TROPHIES</span><span>FAVORITE</span></div>
        {rows.map((row, index) => <div className={"rank-row" + (row.username === myRankName ? " is-me" : "")} key={row.username + "-" + row.country}><span className="rank-player"><b>{String(index + 1).padStart(2, "0")}</b><span className="rank-avatar">{row.username.charAt(0).toUpperCase()}</span><strong>{row.username}{row.username === myRankName && <small> YOU</small>}</strong></span><span>{row.country || "—"}</span><strong className="rank-trophies">🏆 {Number(row.trophies).toLocaleString()}</strong><span>{row.favorite || "—"}</span></div>)}
      </div> : <div className="portal-empty"><span>🏆</span><strong>No ranked players yet</strong><p>Play duels and sync your progress to populate rankings.</p><a href="/" className="portal-text-link">ENTER THE ARENA ↗</a></div>}
    </section>}
  </PortalShell>;
}
