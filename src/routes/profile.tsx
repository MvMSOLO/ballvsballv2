import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { levelOf, xpForNext, loadSave, writeSave, defaultSave, migrateSave, type Save } from "@/economy/save";
import { hydrateArenaSave, syncArenaSave } from "@/economy/persistence";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { authEnabled } from "@/lib/auth/client";
import { getProfileBadgeState, purchaseProfileBadge, setUsername } from "@/lib/arena/server-fns";
import { PortalShell } from "@/components/portal-shell";

export const Route = createFileRoute("/profile")({ component: ProfilePage });

type BadgeState = { vip: boolean; admin: boolean; owner: boolean };
type PurchasableBadge = "vip" | "admin";
type FrameId = "iron" | "vip" | "admin" | "owner";
const EMPTY_BADGES: BadgeState = { vip: false, admin: false, owner: false };
const OWNER_EMAIL = "mirzayevavazbek15@gmail.com";
const FRAME_ITEMS = [
  { id: "vip" as const, name: "VIP", price: 80, file: "/frames/vip.svg", subtitle: "AURELUX PRISMATIC GOLD", description: "Animated gold metal, rainbow energy arcs and a premium crest." },
  { id: "admin" as const, name: "ADMIN", price: 280, file: "/frames/admin.svg", subtitle: "CRIMSON OVERDRIVE", description: "Red-hot plasma, black obsidian plates and a live lightning crest." },
];

function ProfilePage() {
  const { user, isPending } = useCurrentUserState();
  const connected = Boolean(user && !user.isDevFallback && authEnabled);
  const [save, setSave] = useState<Save>(() => defaultSave());
  const [username, setName] = useState("Guest");
  const [country, setCountry] = useState("UZ");
  const [notice, setNotice] = useState("");
  const [frameNotice, setFrameNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [buyingBadge, setBuyingBadge] = useState<PurchasableBadge | null>(null);
  const [equippingFrame, setEquippingFrame] = useState(false);
  const [badges, setBadges] = useState<BadgeState>(EMPTY_BADGES);

  useEffect(() => {
    const local = loadSave();
    setSave(local);
    setName(local.username === "Guest" && user?.displayName
      ? user.displayName.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 16) || "Guest"
      : local.username);
    setCountry(local.country || "UZ");

    if (!connected) {
      setBadges({
        vip: false,
        admin: false,
        owner: user?.primaryEmail?.toLowerCase() === OWNER_EMAIL,
      });
      return;
    }

    void hydrateArenaSave(local).then((merged) => {
      setSave(merged);
      setName(merged.username === "Guest" && user?.displayName
        ? user.displayName.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 16) || "Guest"
        : merged.username);
      setCountry(merged.country || "UZ");
    }).catch(() => setNotice("Cloud profile is unavailable; showing saved local progress."));

    void getProfileBadgeState().then(setBadges).catch(() => {
      setFrameNotice("Badge collection could not be loaded. Refresh the profile to retry.");
    });
  }, [user?.displayName, user?.id, user?.isDevFallback, user?.primaryEmail, isPending, connected]);

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
    } finally {
      setBusy(false);
    }
  }

  async function buyBadge(badgeId: PurchasableBadge) {
    if (!connected || buyingBadge) {
      setFrameNotice("Sign in with Google to unlock and sync profile frames.");
      return;
    }
    if (badges[badgeId]) {
      setFrameNotice("This frame is already in your collection.");
      return;
    }
    setBuyingBadge(badgeId);
    setFrameNotice("");
    try {
      const result = await purchaseProfileBadge({ data: { badgeId } });
      if (!result.ok) {
        const messages: Record<string, string> = {
          diamonds: "Not enough gems. Win more duels and try again.",
          save: "Your cloud wallet is not ready yet. Refresh your profile and retry.",
          race: "Your wallet changed in another request. Refresh your profile and retry.",
        };
        setFrameNotice(messages[result.reason] ?? "Frame purchase could not be completed.");
        return;
      }
      if (!result.alreadyOwned && result.blob) {
        const next = migrateSave(JSON.parse(result.blob) as unknown);
        persist(next);
      }
      setBadges(await getProfileBadgeState());
      setFrameNotice(result.alreadyOwned ? "Already unlocked on your account." : badgeId.toUpperCase() + " frame unlocked! It is now saved to your account.");
    } catch {
      setFrameNotice("Purchase failed. Your account balance was not changed by this screen.");
    } finally {
      setBuyingBadge(null);
    }
  }

  async function equipFrame(frameId: FrameId) {
    const allowed = frameId === "iron"
      || (frameId === "vip" && badges.vip)
      || (frameId === "admin" && badges.admin)
      || (frameId === "owner" && badges.owner);
    if (!allowed) {
      setFrameNotice("Unlock or verify this frame before equipping it.");
      return;
    }
    if (equippingFrame) return;
    setEquippingFrame(true);
    setFrameNotice("");
    const next = { ...save, avatar: { ...save.avatar, frame: frameId } };
    try {
      writeSave(next);
    } catch {
      setFrameNotice("Could not save the frame choice on this device.");
      setEquippingFrame(false);
      return;
    }
    setSave(next);
    try {
      if (connected) {
        const merged = await syncArenaSave(next);
        setSave(merged);
        setFrameNotice(frameId.toUpperCase() + " frame equipped and synced to your account.");
      } else {
        setFrameNotice("Frame equipped on this device. Sign in to sync the choice across devices.");
      }
    } catch {
      setFrameNotice("Frame is equipped on this device, but cloud sync failed. Retry when your connection is available.");
    } finally {
      setEquippingFrame(false);
    }
  }

  const level = levelOf(save);
  const xpFloor = Math.max(0, (level - 1) ** 2 * 40);
  const xpTarget = xpForNext(level);
  const xpInLevel = Math.max(0, save.xp - xpFloor);
  const xpForLevel = Math.max(1, xpTarget - xpFloor);
  const xpPercent = Math.max(0, Math.min(100, xpInLevel / xpForLevel * 100));
  const winRate = save.matches ? Math.round((save.wins / save.matches) * 100) : 0;
  const shownName = save.username === "Guest" && user?.displayName ? user.displayName : save.username;
  const requestedFrame = save.avatar.frame as FrameId;
  const activeFrame: "none" | "vip" | "admin" | "owner" =
    requestedFrame === "vip" && badges.vip ? "vip"
      : requestedFrame === "admin" && badges.admin ? "admin"
        : requestedFrame === "owner" && badges.owner ? "owner" : "none";
  const frameSrc = activeFrame === "none" ? "" : "/frames/" + activeFrame + ".svg";

  return <PortalShell active="profile" title="PLAYER PROFILE" description="Your identity, rank, cosmetics and arena record — saved to your account.">
    <section className="profile-hero profile-hero-premium portal-panel">
      <div className={"profile-avatar-frame profile-avatar-frame-" + activeFrame}>
        <div className="profile-avatar">
          {user?.profileImageUrl
            ? <img src={user.profileImageUrl} alt={shownName + " avatar"} referrerPolicy="no-referrer" />
            : <span>{(shownName || "G").charAt(0).toUpperCase()}</span>}
          <span className="profile-avatar-ring" />
        </div>
        {/* Supplied SVG frames keep a transparent portrait center so the profile image underneath shows through. */}
        {frameSrc && <img className={"profile-frame-art profile-frame-art-" + activeFrame} src={frameSrc} alt="" aria-hidden="true" />}
        {activeFrame === "none" && <span className="profile-avatar-default-orbit" aria-hidden="true" />}
      </div>
      <div className="profile-identity">
        <span className="portal-kicker">PLAYER IDENTITY // VERIFIED ACCOUNT</span>
        <h2>{shownName}</h2>
        <p>{isPending ? "Checking account…" : user && !user.isDevFallback ? (user.primaryEmail || "Signed-in player") : "Guest profile · this device"}</p>
        <div className="profile-tags">
          <span>LEVEL {level}</span><span>{save.avatar.title.toUpperCase()}</span><span>{save.country}</span>
          {activeFrame !== "none" && <span className={"profile-role-chip profile-role-" + activeFrame}>{activeFrame.toUpperCase()} MEMBER</span>}
        </div>
      </div>
      {!connected && authEnabled && <a className="portal-button secondary profile-connect-button" href="/login?callbackURL=%2Fprofile">CONNECT ACCOUNT ↗</a>}
    </section>

    <section className="portal-panel profile-xp-panel" aria-label="Experience progression">
      <div className="profile-xp-heading"><div><span className="portal-kicker">PROGRESSION SYSTEM</span><h2>LEVEL {level} <span>›</span> {level + 1}</h2></div><strong>{save.xp.toLocaleString()} TOTAL XP</strong></div>
      <div className="profile-xp-track" role="progressbar" aria-label={"Progress to level " + (level + 1)} aria-valuemin={0} aria-valuemax={xpForLevel} aria-valuenow={Math.min(xpForLevel, xpInLevel)} aria-valuetext={xpInLevel + " of " + xpForLevel + " XP in level " + level}><span style={{ width: xpPercent + "%" }} /></div>
      <div className="profile-xp-foot"><span>{Math.min(xpForLevel, xpInLevel).toLocaleString()} / {xpForLevel.toLocaleString()} XP THIS LEVEL</span><span>{Math.max(0, xpTarget - save.xp).toLocaleString()} XP TO LEVEL {level + 1}</span></div>
    </section>

    <div className="portal-stat-grid profile-stat-grid">
      <article className="portal-stat"><span>🏆 TROPHIES</span><strong>{save.trophies.toLocaleString()}</strong><small>Current division points</small></article>
      <article className="portal-stat"><span>⚔ MATCHES</span><strong>{save.matches.toLocaleString()}</strong><small>Duels played</small></article>
      <article className="portal-stat"><span>✦ VICTORIES</span><strong>{save.wins.toLocaleString()}</strong><small>{winRate}% win rate</small></article>
      <article className="portal-stat"><span>◈ COLLECTION</span><strong>{save.owned.length}</strong><small>Balls owned</small></article>
    </div>

    <section className="profile-frame-vault portal-panel">
      <div className="portal-section-heading profile-frame-heading">
        <div><span className="portal-kicker">COSMETIC SYSTEM // ACCOUNT-BOUND</span><h2>Frame vault</h2></div>
        <span className="profile-frame-wallet">◈ {save.adminInfiniteDiamonds ? "∞" : save.diamonds.toLocaleString()} GEMS</span>
      </div>
      <p className="profile-vault-intro">Unlock animated identity frames with in-game gems. Purchases are saved to your signed-in account; no real-money checkout is used.</p>
      <div className="profile-frame-grid">
        <article className={"profile-frame-card profile-frame-card-iron" + (activeFrame === "none" ? " is-equipped" : "")}>
          <div className="profile-frame-preview"><span className="profile-iron-preview" aria-hidden="true">BA</span></div>
          <div className="profile-frame-copy"><span className="profile-frame-subtitle">STANDARD ALLOY</span><h3>IRON FRAME</h3><p>The standard identity treatment, available to every player.</p></div>
          <button className={"portal-button " + (activeFrame === "none" ? "owned" : "secondary")} type="button" disabled={equippingFrame || activeFrame === "none"} onClick={() => void equipFrame("iron")}>{activeFrame === "none" ? "✓ EQUIPPED" : equippingFrame ? "SAVING…" : "EQUIP FRAME"}</button>
        </article>
        {FRAME_ITEMS.map((item) => {
          const owned = badges[item.id];
          const equipped = activeFrame === item.id;
          return <article className={"profile-frame-card profile-frame-card-" + item.id + (equipped ? " is-equipped" : "")} key={item.id}>
            <div className="profile-frame-preview"><img src={item.file} alt={item.name + " animated profile frame"} /></div>
            <div className="profile-frame-copy">
              <span className="profile-frame-subtitle">{item.subtitle}</span>
              <h3>{item.name} FRAME</h3>
              <p>{item.description}</p>
              {item.id === "admin" && <small className="profile-cosmetic-note">Cosmetic badge only — it does not grant moderation permissions.</small>}
            </div>
            <button className={"portal-button " + (owned ? (equipped ? "owned" : "primary") : "secondary")} type="button" disabled={Boolean(buyingBadge) || equippingFrame || (!owned && !connected) || (owned && equipped)} onClick={() => owned ? void equipFrame(item.id) : void buyBadge(item.id)}>
              {owned ? (equipped ? "✓ EQUIPPED" : equippingFrame ? "SAVING…" : "EQUIP FRAME") : buyingBadge === item.id ? "UNLOCKING…" : !connected ? "SIGN IN TO UNLOCK" : "UNLOCK · ◈ " + item.price}
            </button>
          </article>;
        })}
        <article className={"profile-frame-card profile-frame-card-owner" + (badges.owner ? " is-equipped" : "")}>
          <div className="profile-frame-preview"><img src="/frames/owner.svg" alt="OWNER animated profile frame" /></div>
          <div className="profile-frame-copy">
            <span className="profile-frame-subtitle">CLASSIFIED // EXCLUSIVE</span>
            <h3>OWNER FRAME</h3>
            <p>{badges.owner ? "Ownership verified. The royal silver-black frame is active on this account." : "Reserved for the verified owner account or a valid one-time redemption."}</p>
          </div>
          <button className={"portal-button " + (activeFrame === "owner" ? "owned" : "secondary")} type="button" disabled={!badges.owner || equippingFrame || activeFrame === "owner"} onClick={() => void equipFrame("owner")}>{!badges.owner ? "RESTRICTED" : activeFrame === "owner" ? "✓ EQUIPPED" : equippingFrame ? "SAVING…" : "EQUIP FRAME"}</button>
          <span className={"profile-frame-state" + (badges.owner ? " is-owned" : "")}>{badges.owner ? "✓ VERIFIED" : "RESTRICTED"}</span>
        </article>
      </div>
      {frameNotice && <p className="portal-notice profile-frame-notice" role="status">{frameNotice}</p>}
      <div className="profile-vault-footer"><span><i className="status-dot" /> BADGES ARE SERVER-VERIFIED</span><span>OWNER IS NOT A PURCHASE ITEM</span></div>
    </section>

    <div className="portal-columns profile-details-columns">
      <section className="portal-panel"><div className="portal-section-heading"><span className="portal-kicker">PLAYER SETTINGS</span><h2>Edit profile</h2></div>
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
