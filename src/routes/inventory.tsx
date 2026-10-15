import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import type { BallDef } from "@/sim/types";
import { allPacks } from "@/packs/registry";
import { defaultSave, loadSave, writeSave, EXPLOSIONS, FLYERS, type Save } from "@/economy/save";
import { hydrateArenaSave, syncArenaSave } from "@/economy/persistence";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { authEnabled } from "@/lib/auth/client";
import { PortalShell } from "@/components/portal-shell";
import { BallInspectDialog } from "@/components/ball-inspect-dialog";

export const Route = createFileRoute("/inventory")({ component: InventoryPage });
function titleCase(value: string) { return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }

function InventoryPage() {
  const { user, isPending } = useCurrentUserState();
  const cloudSync = authEnabled && Boolean(user && !user.isDevFallback);
  const balls = useMemo(() => allPacks().flatMap((pack) => pack.balls), []);
  const ballMap = useMemo(() => new Map<string, BallDef>(balls.map((ball) => [ball.id, ball])), [balls]);
  const [save, setSave] = useState<Save>(() => defaultSave());
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("favorites");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [inspectedBall, setInspectedBall] = useState<BallDef | null>(null);
  useEffect(() => {
    const local = loadSave();
    setSave(local);
    if (cloudSync) {
      void hydrateArenaSave(local).then((merged) => {
        setSave(merged);
      }).catch(() => setNotice("Cloud save could not be loaded; local collection is still available."));
    }
  }, [cloudSync, isPending]);

  function persist(next: Save) {
    try {
      writeSave(next);
    } catch {
      setNotice("Could not save changes on this device.");
      return;
    }
    setSave(next);
    if (cloudSync) {
      setSaving(true);
      void syncArenaSave(next).then((merged) => {
        setSave(merged);
        setNotice("Collection changes saved and synced to your account.");
      }).catch(() => setNotice("Changes are saved locally, but cloud sync failed. Retry when the connection is available."))
        .finally(() => setSaving(false));
    } else {
      setNotice("Collection changes saved on this device. Sign in to sync them.");
    }
  }
  function toggleFavorite(id: string) {
    if (!save.owned.includes(id)) return;
    const has = save.favorites.includes(id);
    const favorites = has ? save.favorites.filter((item) => item !== id) : [...save.favorites, id].slice(-3);
    persist({ ...save, favorites });
  }
  const owned = save.owned.map((id) => ballMap.get(id)).filter((ball): ball is BallDef => Boolean(ball));
  const rarityOrder: Record<BallDef["rarity"], number> = { common: 0, rare: 1, epic: 2, legendary: 3, mythic: 4 };
  const ownedInCategory = filter === "favorites" ? owned.filter((ball) => save.favorites.includes(ball.id))
    : filter === "upgradable" ? owned.filter((ball) => (save.ballLevel[ball.id] ?? 0) < 10)
      : owned;
  const term = query.trim().toLowerCase();
  const displayed = [...ownedInCategory]
    .filter((ball) => !term || [ball.name.en, ball.id, ball.ai_hints.role, ...ball.tags].join(" ").toLowerCase().includes(term))
    .sort((a, b) => {
      if (sort === "name") return a.name.en.localeCompare(b.name.en);
      if (sort === "level") return (save.ballLevel[b.id] ?? 0) - (save.ballLevel[a.id] ?? 0) || a.name.en.localeCompare(b.name.en);
      if (sort === "rarity") return rarityOrder[b.rarity] - rarityOrder[a.rarity] || a.name.en.localeCompare(b.name.en);
      if (sort === "favorites") return Number(save.favorites.includes(b.id)) - Number(save.favorites.includes(a.id)) || a.name.en.localeCompare(b.name.en);
      return 0;
    });
  const titles = [...new Set([...save.cosmetics.filter((item) => item.startsWith("title_")).map((item) => item.slice(6)), save.avatar.title.toLowerCase()])];
  const frames = [...new Set([...save.cosmetics.filter((item) => item.startsWith("frame_")).map((item) => item.slice(6)), save.avatar.frame])].filter(Boolean);

  return <PortalShell active="inventory" title="YOUR COLLECTION" description="Manage unlocked balls and choose favorites for your player identity.">
    <section className="shop-wallet portal-panel"><div><span className="portal-kicker">COLLECTION STATUS</span><div className="wallet-values"><strong>{owned.length} <small>OWNED BALLS</small></strong><strong>{save.favorites.length} <small>FAVORITES</small></strong><strong>{save.cosmetics.length} <small>COSMETICS</small></strong></div></div><a href="/shop" className="portal-button primary">VISIT MARKET ↗</a></section>
    <div className="shop-filters inventory-filters"><input aria-label="Search owned balls by name, role, or tag" placeholder="Search collection…" value={query} onChange={(event) => setQuery(event.target.value)} /><select aria-label="Filter collection" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All owned</option><option value="favorites">Favorites</option><option value="upgradable">Upgradeable</option></select><select aria-label="Sort owned balls" value={sort} onChange={(event) => setSort(event.target.value)}><option value="favorites">Favorites first</option><option value="name">Name A–Z</option><option value="level">Level high to low</option><option value="rarity">Rarity</option></select><span className="portal-muted-count">{displayed.length} shown · up to 3 favorites</span></div>
    {notice && <p className="portal-notice" role="status">{notice}</p>}
    <div className="shop-ball-grid inventory-grid" aria-busy={saving}>{displayed.map((ball) => {
      const favorite = save.favorites.includes(ball.id);
      return <article className={"shop-ball-card inventory-ball " + (favorite ? "is-favorite" : "")} key={ball.id}>
        <div className={"shop-ball-orb rarity-" + ball.rarity + " shape-" + ball.visual.shape} style={{ background: "radial-gradient(circle at 32% 24%, #fff 0%, " + ball.visual.baseColor + " 25%, " + ball.visual.accentColor + " 100%)" }}><span>{ball.id.includes("jolt") ? "ϟ" : ball.id.includes("web") ? "✳" : ball.id.includes("magma") ? "✹" : "◈"}</span></div>
        <span className={"rarity-pill rarity-" + ball.rarity}>{ball.rarity.toUpperCase()}</span><h3>{ball.name.en}</h3><p>LEVEL {save.ballLevel[ball.id] ?? 0} · {ball.stats.hp} HP</p>
        <button className="portal-button secondary ball-inspect-trigger" type="button" onClick={() => setInspectedBall(ball)}>⌕ INSPECT</button>
        <button className={"portal-button " + (favorite ? "primary" : "secondary")} type="button" disabled={saving} onClick={() => toggleFavorite(ball.id)}>{favorite ? "★ FAVORITE" : "☆ SET FAVORITE"}</button>
      </article>;
    })}</div>
    {!displayed.length && <div className="portal-empty"><span>◈</span><strong>{term ? "No matching balls" : "Nothing in this category yet"}</strong><p>{term ? "Try another name, role, or tag, or reset the collection filters." : "Open the market to expand your collection."}</p>{term || filter !== "all" ? <button className="portal-button secondary" type="button" onClick={() => { setQuery(""); setFilter("all"); setSort("favorites"); }}>RESET COLLECTION FILTERS</button> : <a href="/shop" className="portal-text-link">OPEN BALL MARKET ↗</a>}</div>}
    <BallInspectDialog ball={inspectedBall} onClose={() => setInspectedBall(null)} statusLabel={inspectedBall ? save.owned.includes(inspectedBall.id) ? "OWNED · LEVEL " + (save.ballLevel[inspectedBall.id] ?? 0) : "NOT IN COLLECTION" : undefined} actionLabel={inspectedBall ? save.favorites.includes(inspectedBall.id) ? "★ REMOVE FAVORITE" : "☆ SET FAVORITE" : undefined} actionDisabled={!inspectedBall || !save.owned.includes(inspectedBall.id)} onAction={() => { if (inspectedBall) toggleFavorite(inspectedBall.id); }} />
    <div className="portal-columns inventory-equipment">
      <section className="portal-panel"><div className="portal-section-heading"><span className="portal-kicker">LOADOUT</span><h2>Equipped cosmetics</h2></div><div className="portal-form">
        <label>Profile title<select disabled={saving} value={save.avatar.title.toLowerCase()} onChange={(event) => persist({ ...save, avatar: { ...save.avatar, title: titleCase(event.target.value) } })}>{titles.map((item) => <option key={item} value={item}>{titleCase(item)}{save.avatar.title.toLowerCase() === item ? " · EQUIPPED" : ""}</option>)}</select></label>
        <label>Profile frame<select disabled={saving} value={save.avatar.frame} onChange={(event) => persist({ ...save, avatar: { ...save.avatar, frame: event.target.value } })}>{frames.map((item) => <option key={item} value={item}>{titleCase(item)}{save.avatar.frame === item ? " · EQUIPPED" : ""}</option>)}</select></label>
        <label>Ball trail<select disabled={saving} value={save.flyer} onChange={(event) => persist({ ...save, flyer: event.target.value })}>{FLYERS.filter((item) => save.flyers.includes(item.id)).map((item) => <option key={item.id} value={item.id}>{item.name}{save.flyer === item.id ? " · EQUIPPED" : ""}</option>)}</select></label>
        <label>Impact effect<select disabled={saving} value={save.explosion} onChange={(event) => persist({ ...save, explosion: event.target.value })}>{EXPLOSIONS.filter((item) => save.explosions.includes(item.id)).map((item) => <option key={item.id} value={item.id}>{item.name}{save.explosion === item.id ? " · EQUIPPED" : ""}</option>)}</select></label>
      </div></section>
      <section className="portal-panel"><div className="portal-section-heading"><span className="portal-kicker">FRAGMENTS</span><h2>Upgrade materials</h2></div><div className="fragment-count"><span>✧</span><strong>{save.fragments.toLocaleString()}</strong><small>UPGRADE FRAGMENTS</small></div><p className="portal-muted">Fragments are earned from duplicate pulls. Upgrade and crafting flows can build on this inventory next.</p><a href="/shop" className="portal-text-link">GET MORE BALLS ↗</a></section>
    </div>
  </PortalShell>;
}
