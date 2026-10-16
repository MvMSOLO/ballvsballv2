import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getAdminOverview, performAdminAction } from "@/lib/arena/admin-fns";
import { PortalShell } from "@/components/portal-shell";
import { OWNER_ACCOUNT_EMAIL, canAccessOwnerTools } from "@/lib/player-navigation";

export const Route = createFileRoute("/admin")({ component: AdminPage });
type AdminActionKey =
  | "kick" | "ban" | "unban" | "toggle_inf_coins" | "toggle_inf_diamonds"
  | "grant_ball" | "remove_ball" | "grant_all_balls" | "set_trophies" | "set_xp" | "set_pass_xp"
  | "grant_premium" | "revoke_premium" | "grant_vip_frame" | "grant_admin_frame"
  | "revoke_vip_frame" | "revoke_admin_frame" | "reset_progress";

type AdminPlayer = {
  id: string; name: string; email: string; email_verified: boolean; username: string; country: string;
  trophies: number; level: number; coins: number; diamonds: number; xp: number; pass_xp: number; balls_owned: number;
  is_banned: boolean; ban_reason: string; infinite_coins: boolean; infinite_diamonds: boolean; active_sessions: number;
};
type AdminBall = { id: string; name: string; rarity: string };
type AdminActivity = { id: string; action: string; summary: string; created_at: string; actor_email: string; target_email: string };
type Overview = {
  viewerEmail: string;
  stats: { total_users: number; banned_users: number; active_sessions: number; saved_players: number };
  players: AdminPlayer[];
  balls: AdminBall[];
  activity: AdminActivity[];
};

function AdminPage() {
  const { user, isPending } = useCurrentUserState();
  const isOwnerClient = canAccessOwnerTools(user);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [ballId, setBallId] = useState("");
  const [banReason, setBanReason] = useState("");
  const [trophies, setTrophies] = useState("0");
  const [xp, setXp] = useState("0");
  const [passXp, setPassXp] = useState("0");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const selected = useMemo(
    () => overview?.players.find((player) => player.id === selectedId) ?? overview?.players[0] ?? null,
    [overview, selectedId],
  );

  async function refresh(nextQuery = query) {
    setLoading(true);
    setError("");
    try {
      const data = await getAdminOverview({ data: { query: nextQuery } });
      setOverview(data as Overview);
      setSelectedId((current) => data.players.some((player) => player.id === current) ? current : data.players[0]?.id ?? "");
      setBallId((current) => current || data.balls[0]?.id || "");
    } catch (reason) {
      setOverview(null);
      setError(reason instanceof Error ? reason.message : "Could not load admin data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isPending) return;
    if (!isOwnerClient) { setLoading(false); return; }
    void refresh("");
    // Refresh only when the authenticated owner identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPending, isOwnerClient, user?.id]);

  // Keep edit fields in sync with the selected server record, including after
  // an admin action. This prevents a stale 0/value from being submitted later.
  useEffect(() => {
    if (!selected) return;
    setTrophies(String(selected.trophies));
    setXp(String(selected.xp));
    setPassXp(String(selected.pass_xp));
  }, [selected?.id, selected?.trophies, selected?.xp, selected?.pass_xp]);

  async function runAction(action: AdminActionKey, extras: { reason?: string; ballId?: string; amount?: number } = {}) {
    if (!selected || busy) return;
    const labels: Partial<Record<AdminActionKey, string>> = {
      kick: "Kick this player by revoking their active login sessions?",
      ban: "Ban this account and revoke all active login sessions?",
      reset_progress: "Reset this player's game progress to starter state?",
      revoke_premium: "Revoke this player's Premium/Pro Pass access?",
      revoke_vip_frame: "Remove the VIP profile frame from this player?",
      revoke_admin_frame: "Remove the ADMIN profile frame from this player?",
    };
    const confirmation = labels[action];
    if (confirmation && !window.confirm(confirmation)) return;
    setBusy(true);
    setNotice("");
    setError("");
    try {
      const result = await performAdminAction({
        data: {
          targetUserId: selected.id,
          action,
          reason: extras.reason ?? "",
          ...(extras.ballId ? { ballId: extras.ballId } : {}),
          ...(extras.amount !== undefined ? { amount: extras.amount } : {}),
        },
      });
      setNotice(result.message);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Admin action failed.");
    } finally {
      setBusy(false);
    }
  }

  function selectPlayer(player: AdminPlayer) {
    setSelectedId(player.id);
    setTrophies(String(player.trophies));
    setXp(String(player.xp));
    setPassXp(String(player.pass_xp));
  }

  const ownerTarget = Boolean(selected?.email?.trim().toLowerCase() === OWNER_ACCOUNT_EMAIL && selected.email_verified);
  const selfTarget = selected?.id === user?.id;
  // Owner can edit their own profile. Only a duplicate owner identity viewed
  // from another record stays protected.
  const blockedTarget = !selected || (ownerTarget && !selfTarget);
  const canRenderAdmin = isOwnerClient && !isPending;

  return <PortalShell active="admin" title="OWNER CONTROL CENTER" description="Verified-owner tools for player accounts, balances, inventory, moderation and audit history.">
    {!isPending && !user && <section className="portal-panel admin-gate"><span className="admin-kicker">AUTH REQUIRED</span><h2>Sign in first</h2><p>Admin tools require the verified owner account.</p><a className="portal-button primary" href="/login?callbackURL=%2Fadmin">SIGN IN ↗</a></section>}
    {!isPending && user && !isOwnerClient && <section className="portal-panel admin-gate"><span className="admin-kicker">RESTRICTED AREA</span><h2>Owner access only</h2><p>This route is protected on the server and only accepts the verified owner email.</p><a className="portal-button secondary" href="/">RETURN TO ARENA</a></section>}
    {canRenderAdmin && <>
      <section className="admin-hero portal-panel">
        <div><span className="admin-kicker"><i /> SECURE OWNER SESSION / VERIFIED</span><h2>CONTROL <em>EVERYTHING.</em></h2><p>Every action is checked against the verified account on the server and recorded in the audit log.</p></div>
        <div className="admin-hero-side"><span>AUTHENTICATED OWNER</span><strong>{overview?.viewerEmail ?? OWNER_ACCOUNT_EMAIL}</strong><button className="portal-button secondary" disabled={loading || busy} onClick={() => void refresh()}>↻ REFRESH DATA</button></div>
      </section>
      {error && <div className="admin-alert error" role="alert"><strong>REQUEST BLOCKED</strong><span>{error}</span></div>}
      {notice && <div className="admin-alert success" role="status"><strong>ACTION LOGGED</strong><span>{notice}</span></div>}
      <section className="admin-stats-grid">
        {[
          { label: "REGISTERED PLAYERS", value: overview?.stats.total_users ?? "—", glyph: "◉" },
          { label: "ACTIVE SESSIONS", value: overview?.stats.active_sessions ?? "—", glyph: "⌁" },
          { label: "BANNED ACCOUNTS", value: overview?.stats.banned_users ?? "—", glyph: "⊘" },
          { label: "CLOUD SAVES", value: overview?.stats.saved_players ?? "—", glyph: "▤" },
        ].map((stat) => <article className="admin-stat" key={stat.label}><span>{stat.glyph}</span><small>{stat.label}</small><strong>{typeof stat.value === "number" ? stat.value.toLocaleString() : stat.value}</strong></article>)}
      </section>
      <div className="admin-layout">
        <section className="portal-panel admin-player-panel">
          <div className="admin-section-head"><div><span className="admin-kicker">ACCOUNT DATABASE</span><h2>Player registry</h2></div><span className="admin-count">{overview?.players.length ?? 0} SHOWN</span></div>
          <form className="admin-search" onSubmit={(event) => { event.preventDefault(); void refresh(query); }}>
            <span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search username, email, ID…" aria-label="Search players" maxLength={80} /><button type="submit" disabled={loading || busy}>SEARCH</button>
          </form>
          {loading ? <div className="admin-empty"><i className="portal-spinner" /> Loading player database…</div> : !overview?.players.length ? <div className="admin-empty">No matching player accounts.</div> : <div className="admin-player-list">
            {overview.players.map((player) => <button key={player.id} className={"admin-player-row" + (selected?.id === player.id ? " selected" : "")} onClick={() => selectPlayer(player)} type="button">
              <span className="admin-player-avatar">{(player.username || player.name || player.email).slice(0, 1).toUpperCase()}</span>
              <span className="admin-player-main"><strong>{player.username || player.name || "Unnamed player"}</strong><small>{player.email}</small><small className="admin-player-meta">{player.email_verified ? "VERIFIED" : "UNVERIFIED"} · {player.active_sessions} SESSION{player.active_sessions === 1 ? "" : "S"}</small></span>
              <span className="admin-player-status">{player.is_banned ? <i className="banned">BANNED</i> : <i className="active">ACTIVE</i>}<small>🏆 {player.trophies.toLocaleString()}</small></span>
            </button>)}
          </div>}
        </section>
        <section className="portal-panel admin-detail-panel">
          <div className="admin-section-head"><div><span className="admin-kicker">PLAYER OPERATIONS</span><h2>Target profile</h2></div><span className="admin-target-icon">⌘</span></div>
          {!selected ? <div className="admin-empty">Select an account to unlock controls.</div> : <>
            <div className="admin-target-card">
              <div className="admin-target-avatar">{(selected.username || selected.name || selected.email).slice(0, 1).toUpperCase()}</div>
              <div><h3>{selected.username || selected.name || "Unnamed player"}</h3><p>{selected.email}</p><small>{selected.id}</small></div>
              <span className={selected.is_banned ? "admin-state banned" : "admin-state"}>{selected.is_banned ? "BANNED" : "IN GOOD STANDING"}</span>
            </div>
            <div className="admin-wallet-grid">
              <div><small>COINS</small><strong>{selected.infinite_coins ? "∞ INF" : selected.coins.toLocaleString()}</strong></div>
              <div><small>DIAMONDS</small><strong>{selected.infinite_diamonds ? "∞ INF" : selected.diamonds.toLocaleString()}</strong></div>
              <div><small>XP / LEVEL</small><strong>{selected.xp.toLocaleString()} <i>/ {selected.level}</i></strong></div>
              <div><small>BATTLE PASS XP</small><strong>{selected.pass_xp.toLocaleString()}</strong></div>
              <div><small>OWNED BALLS</small><strong>{selected.balls_owned}</strong></div>
            </div>
            {selfTarget && <p className="admin-protected-note">Owner self-management is enabled: economy, balls, perks, trophies and XP can all be edited here. KICK/BAN is disabled for your own active account to prevent accidental lockout.</p>}
            {blockedTarget && <p className="admin-protected-note">This verified owner identity can only be managed from its own signed-in account.</p>}
            <div className="admin-control-section">
              <div className="admin-control-title"><span>01</span><div><strong>MODERATION</strong><small>Session and account access</small></div></div>
              <div className="admin-action-grid">
                <button className="admin-action-button danger" disabled={busy || blockedTarget || selfTarget || selected.active_sessions === 0} onClick={() => void runAction("kick")}><b>↯</b><span>KICK PLAYER</span><small>Revoke active sessions</small></button>
                {selected.is_banned
                  ? <button className="admin-action-button good" disabled={busy || blockedTarget || selfTarget} onClick={() => void runAction("unban")}><b>✓</b><span>UNBAN PLAYER</span><small>Restore server access</small></button>
                  : <button className="admin-action-button danger" disabled={busy || blockedTarget || selfTarget} onClick={() => void runAction("ban", { reason: banReason })}><b>⊘</b><span>BAN PLAYER</span><small>Block game API access</small></button>}
              </div>
              {!selected.is_banned && <label className="admin-label">BAN REASON<input value={banReason} onChange={(event) => setBanReason(event.target.value)} maxLength={300} placeholder="Optional reason shown in the audit log" /></label>}
              {selected.is_banned && <p className="admin-ban-reason">REASON: {selected.ban_reason || "No reason provided."}</p>}
            </div>
            <div className="admin-control-section">
              <div className="admin-control-title"><span>02</span><div><strong>ECONOMY OVERRIDES</strong><small>Infinite wallet modes</small></div></div>
              <div className="admin-action-grid">
                <button className={"admin-action-button coin" + (selected.infinite_coins ? " enabled" : "")} disabled={busy || blockedTarget} onClick={() => void runAction("toggle_inf_coins")}><b>●</b><span>{selected.infinite_coins ? "DISABLE INF COINS" : "ENABLE INF COINS"}</span><small>{selected.infinite_coins ? "Active · shows ∞ to player" : "Unlimited in-game coin balance"}</small></button>
                <button className={"admin-action-button gem" + (selected.infinite_diamonds ? " enabled" : "")} disabled={busy || blockedTarget} onClick={() => void runAction("toggle_inf_diamonds")}><b>◈</b><span>{selected.infinite_diamonds ? "DISABLE INF DIAMONDS" : "ENABLE INF DIAMONDS"}</span><small>{selected.infinite_diamonds ? "Active · shows ∞ to player" : "Unlimited gem balance"}</small></button>
              </div>
              <p className="admin-inline-help">Disabling INF restores the saved pre-override balance. The active state is server-controlled.</p>
            </div>
            <div className="admin-control-section">
              <div className="admin-control-title"><span>03</span><div><strong>INVENTORY & PERKS</strong><small>Grant or revoke catalog items</small></div></div>
              <label className="admin-label">BALL CATALOG<select value={ballId} onChange={(event) => setBallId(event.target.value)}><option value="">Select a ball…</option>{overview?.balls.map((ball) => <option key={ball.id} value={ball.id}>{ball.name} · {ball.rarity.toUpperCase()}</option>)}</select></label>
              <div className="admin-action-grid">
                <button className="admin-action-button good" disabled={busy || blockedTarget || !ballId} onClick={() => void runAction("grant_ball", { ballId })}><b>＋</b><span>ADD BALL</span><small>Grant selected ball</small></button>
                <button className="admin-action-button danger" disabled={busy || blockedTarget || !ballId} onClick={() => void runAction("remove_ball", { ballId })}><b>−</b><span>REMOVE BALL</span><small>Remove selected ball</small></button>
                <button className="admin-action-button good" disabled={busy || blockedTarget} onClick={() => void runAction("grant_all_balls")}><b>✦</b><span>ALL PLAYABLE BALLS</span><small>Unlock every enabled ball and remove inactive template IDs</small></button>
                <button className="admin-action-button good" disabled={busy || blockedTarget} onClick={() => void runAction("grant_premium")}><b>♛</b><span>GRANT PREMIUM</span><small>Enable Premium + Pro Pass</small></button>
                <button className="admin-action-button danger" disabled={busy || blockedTarget} onClick={() => void runAction("revoke_premium")}><b>×</b><span>REVOKE PREMIUM</span><small>Remove Premium + Pro Pass</small></button>
                <button className="admin-action-button coin" disabled={busy || blockedTarget} onClick={() => void runAction("grant_vip_frame")}><b>✧</b><span>GRANT VIP FRAME</span><small>Profile cosmetic</small></button>
                <button className="admin-action-button danger" disabled={busy || blockedTarget} onClick={() => void runAction("revoke_vip_frame")}><b>×</b><span>REMOVE VIP FRAME</span><small>Profile cosmetic</small></button>
                <button className="admin-action-button gem" disabled={busy || blockedTarget} onClick={() => void runAction("grant_admin_frame")}><b>◈</b><span>GRANT ADMIN FRAME</span><small>Cosmetic only, not role</small></button>
                <button className="admin-action-button danger" disabled={busy || blockedTarget} onClick={() => void runAction("revoke_admin_frame")}><b>×</b><span>REMOVE ADMIN FRAME</span><small>Cosmetic only, not role</small></button>
              </div>
            </div>
            <div className="admin-control-section">
              <div className="admin-control-title"><span>04</span><div><strong>PROGRESSION</strong><small>Edit leaderboard and XP</small></div></div>
              <div className="admin-two-fields">
                <label className="admin-label">TROPHIES<input type="number" min="0" max="100000" value={trophies} onChange={(event) => setTrophies(event.target.value)} /></label>
                <button className="portal-button secondary admin-set-button" disabled={busy || blockedTarget || trophies.trim() === "" || !Number.isFinite(Number(trophies)) || Number(trophies) < 0 || Number(trophies) > 100000} onClick={() => void runAction("set_trophies", { amount: Math.floor(Number(trophies)) })}>SET TROPHIES</button>
                <label className="admin-label">XP<input type="number" min="0" max="10000000" value={xp} onChange={(event) => setXp(event.target.value)} /></label>
                <button className="portal-button secondary admin-set-button" disabled={busy || blockedTarget || xp.trim() === "" || !Number.isFinite(Number(xp)) || Number(xp) < 0 || Number(xp) > 10000000} onClick={() => void runAction("set_xp", { amount: Math.floor(Number(xp)) })}>SET XP</button>
                <label className="admin-label">BATTLE PASS XP<input type="number" min="0" max="10000000" value={passXp} onChange={(event) => setPassXp(event.target.value)} /></label>
                <button className="portal-button secondary admin-set-button" disabled={busy || blockedTarget || passXp.trim() === "" || !Number.isFinite(Number(passXp)) || Number(passXp) < 0 || Number(passXp) > 10000000} onClick={() => void runAction("set_pass_xp", { amount: Math.floor(Number(passXp)) })}>SET PASS XP</button>
              </div>
              <button className="admin-reset-button" disabled={busy || blockedTarget} onClick={() => void runAction("reset_progress")}><span>⚠</span><span><strong>RESET GAME PROGRESS</strong><small>Reset stats, match history, friends and inventory to starter state. Account, receipts and moderation controls remain.</small></span></button>
            </div>
          </>}
        </section>
      </div>
      <section className="portal-panel admin-activity-panel">
        <div className="admin-section-head"><div><span className="admin-kicker">ACTION AUDIT TRAIL</span><h2>Recent activity</h2></div><span className="admin-count">LATEST 20</span></div>
        {!overview?.activity.length ? <div className="admin-empty">No admin actions recorded yet.</div> : <div className="admin-activity-list">{overview.activity.map((item) => <article className="admin-activity-row" key={item.id}><span className="admin-activity-dot" /><div><strong>{item.action.replace(/_/g, " ").toUpperCase()}</strong><p>{item.summary}</p><small>TARGET {item.target_email} · ACTOR {item.actor_email}</small></div><time>{new Date(item.created_at).toLocaleString()}</time></article>)}</div>}
      </section>
      <p className="admin-footer-note">KICK revokes active login sessions; it does not forcibly interrupt a peer-to-peer round already running. BAN additionally blocks authenticated server actions until unbanned.</p>
    </>}
  </PortalShell>;
}
