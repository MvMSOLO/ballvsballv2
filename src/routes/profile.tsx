import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { levelOf, loadSave, writeSave, defaultSave, type Save } from "@/economy/save";
import { setUsername } from "@/lib/arena/server-fns";
import { syncArenaSave } from "@/economy/persistence";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { authEnabled } from "@/lib/auth/client";
import { PortalShell } from "@/components/portal-shell";

export const Route = createFileRoute("/profile")({ component: ProfilePage });

function ProfilePage() {
  const { user, isPending } = useCurrentUserState();
  const [save, setSave] = useState<Save>(() => defaultSave());
  const [username, setName] = useState("Guest");
  const [country, setCountry] = useState("UZ");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const local = loadSave();
    setSave(local);
    setName(local.username === "Guest" && user?.displayName ? user.displayName.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 16) || "Guest" : local.username);
    setCountry(local.country || "UZ");
    const connected = Boolean(user && !user.isDevFallback && authEnabled);
    if (connected) {
      void syncArenaSave(local).then((merged) => {
        setSave(merged);
        setName(merged.username === "Guest" && user?.displayName ? user.displayName.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 16) || "Guest" : merged.username);
        setCountry(merged.country || "UZ");
      }).catch(() => setNotice("Cloud profile is unavailable; showing saved local progress."));
    }
  }, [user?.displayName, user?.id, user?.isDevFallback, isPending]);

  function persist(next: Save) {
    setSave(next);
    try { writeSave(next); } catch { setNotice("Could not save on this device."); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanName = username.trim();
    if (!/^[a-zA-Z0-9_]{3,16}$/.test(cleanName)) {
      setNotice("Username must be 3–16 characters: letters, numbers or underscore.");
      return;
    }
    setBusy(true);
    setNotice("");
    try {
      const connected = Boolean(user && !user.isDevFallback && authEnabled);
      if (connected) {
        const result = await setUsername({ data: { username: cleanName, country } });
        if (!result.ok) {
          setNotice(result.reason === "taken" ? "That username is already taken." : "Profile could not be updated.");
          return;
        }
      }
      const next = { ...save, username: cleanName, country, avatar: { ...save.avatar, title: save.avatar.title || "Rookie" } };
      persist(next);
      if (connected) {
        try {
          const merged = await syncArenaSave(next);
          persist(merged);
          setName(merged.username);
          setCountry(merged.country);
        } catch {
          setNotice("Profile saved locally, but cloud sync failed. Try again later.");
          return;
        }
      }
      setNotice(connected ? "Profile saved and cloud profile synced." : "Profile saved on this device. Sign in to connect cloud progress.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Profile could not be saved.");
    } finally { setBusy(false); }
  }

  const level = levelOf(save);
  const winRate = save.matches ? Math.round((save.wins / save.matches) * 100) : 0;
  const shownName = save.username === "Guest" && user?.displayName ? user.displayName : save.username;

  return <PortalShell active="profile" title="PLAYER PROFILE" description="Your identity, rank, and arena record in one place.">
    <section className="profile-hero portal-panel">
      <div className="profile-avatar">{(shownName || "G").charAt(0).toUpperCase()}<span className="profile-avatar-ring" /></div>
      <div className="profile-identity"><span className="portal-kicker">CURRENT PLAYER</span><h2>{shownName}</h2><p>{isPending ? "Checking account…" : user && !user.isDevFallback ? (user.primaryEmail || "Signed-in player") : "Guest profile · this device"}</p><div className="profile-tags"><span>LEVEL {level}</span><span>{save.avatar.title.toUpperCase()}</span><span>{save.country}</span></div></div>
      {authEnabled && (!user || user.isDevFallback) && <a className="portal-button secondary" href="/login">CONNECT ACCOUNT ↗</a>}
    </section>
    <div className="portal-stat-grid">
      <article className="portal-stat"><span>🏆 TROPHIES</span><strong>{save.trophies.toLocaleString()}</strong><small>Current division points</small></article>
      <article className="portal-stat"><span>⚔ MATCHES</span><strong>{save.matches.toLocaleString()}</strong><small>Duels played</small></article>
      <article className="portal-stat"><span>✦ VICTORIES</span><strong>{save.wins.toLocaleString()}</strong><small>{winRate}% win rate</small></article>
      <article className="portal-stat"><span>◈ COLLECTION</span><strong>{save.owned.length}</strong><small>Balls owned</small></article>
    </div>
    <div className="portal-columns">
      <section className="portal-panel"><div className="portal-section-heading"><span className="portal-kicker">IDENTITY</span><h2>Edit profile</h2></div>
        <form className="portal-form" onSubmit={(event) => void submit(event)}>
          <label>Username<input value={username} onChange={(event) => setName(event.target.value)} minLength={3} maxLength={16} pattern="[A-Za-z0-9_]{3,16}" autoComplete="username" required /></label>
          <label>Country<select value={country} onChange={(event) => setCountry(event.target.value)}>{["UZ", "RU", "US", "KZ", "TR", "DE", "GB", "KR", "JP", "BR"].map((code) => <option key={code} value={code}>{code}</option>)}</select></label>
          <button className="portal-button primary" type="submit" disabled={busy}>{busy ? "SAVING…" : "SAVE PROFILE ↗"}</button>
          {notice && <p className="portal-notice" role="status">{notice}</p>}
        </form>
      </section>
      <section className="portal-panel"><div className="portal-section-heading"><span className="portal-kicker">RECENT DUELS</span><h2>Match history</h2></div>
        {save.history.length ? <div className="portal-history">{save.history.slice(0, 6).map((match) => <div className="portal-history-row" key={match.id}><span className={"history-result " + (match.win ? "win" : "loss")}>{match.win ? "WIN" : "LOSS"}</span><span><strong>{match.opponent}</strong><small>{new Date(match.at).toLocaleDateString()} · {match.ball}</small></span><b>{match.trophies > 0 ? "+" : ""}{match.trophies} 🏆</b></div>)}</div> : <div className="portal-empty"><span>◎</span><strong>No duels recorded yet</strong><p>Challenge a rival in the arena to build your history.</p><a href="/" className="portal-text-link">ENTER ARENA ↗</a></div>}
      </section>
    </div>
  </PortalShell>;
}
