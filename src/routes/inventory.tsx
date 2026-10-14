import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import type { BallDef } from "@/sim/types";
import { allPacks } from "@/packs/registry";
import { defaultSave, loadSave, writeSave, EXPLOSIONS, FLYERS, type Save } from "@/economy/save";
import { PortalShell } from "@/components/portal-shell";

export const Route = createFileRoute("/inventory")({ component: InventoryPage });
function titleCase(value: string) { return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }

function InventoryPage() {
  const balls = useMemo(() => allPacks().flatMap((pack) => pack.balls), []);
  const ballMap = useMemo(() => new Map<string, BallDef>(balls.map((ball) => [ball.id, ball])), [balls]);
  const [save, setSave] = useState<Save>(() => defaultSave());
  const [filter, setFilter] = useState("all");
  const [notice, setNotice] = useState("");
  useEffect(() => { setSave(loadSave()); }, []);

  function persist(next: Save) {
    setSave(next);
    try { writeSave(next); setNotice("Collection updated."); } catch { setNotice("Could not save changes on this device."); }
  }
  function toggleFavorite(id: string) {
    if (!save.owned.includes(id)) return;
    const has = save.favorites.includes(id);
    const favorites = has ? save.favorites.filter((item) => item !== id) : [...save.favorites, id].slice(-3);
    persist({ ...save, favorites });
  }
  const owned = save.owned.map((id) => ballMap.get(id)).filter((ball): ball is BallDef => Boolean(ball));
  const displayed = filter === "favorites" ? owned.filter((ball) => save.favorites.includes(ball.id)) : filter === "upgradable" ? owned.filter((ball) => (save.ballLevel[ball.id] ?? 0) < 10) : owned;
  const titles = save.cosmetics.filter((item) => item.startsWith("title_")).map((item) => item.slice(6));
  const frames = save.cosmetics.filter((item) => item.startsWith("frame_")).map((item) => item.slice(6));

  return <PortalShell active="inventory" title="YOUR COLLECTION" description="Manage unlocked balls and choose favorites for your player identity.">
    <section className="shop-wallet portal-panel"><div><span className="portal-kicker">COLLECTION STATUS</span><div className="wallet-values"><strong>{owned.length} <small>OWNED BALLS</small></strong><strong>{save.favorites.length} <small>FAVORITES</small></strong><strong>{save.cosmetics.length} <small>COSMETICS</small></strong></div></div><a href="/shop" className="portal-button primary">VISIT MARKET ↗</a></section>
    <div className="shop-filters inventory-filters"><select aria-label="Filter collection" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All owned</option><option value="favorites">Favorites</option><option value="upgradable">Upgradeable</option></select><span className="portal-muted-count">Choose up to 3 favorites</span></div>
    {notice && <p className="portal-notice" role="status">{notice}</p>}
    <div className="shop-ball-grid inventory-grid">{displayed.map((ball) => {
      const favorite = save.favorites.includes(ball.id);
      return <article className={"shop-ball-card inventory-ball " + (favorite ? "is-favorite" : "")} key={ball.id}>
        <div className={"shop-ball-orb rarity-" + ball.rarity} style={{ background: "radial-gradient(circle at 32% 24%, #fff 0%, " + ball.visual.baseColor + " 25%, " + ball.visual.accentColor + " 100%)" }}><span>{ball.id.includes("jolt") ? "ϟ" : ball.id.includes("web") ? "✳" : ball.id.includes("magma") ? "✹" : "◈"}</span></div>
        <span className={"rarity-pill rarity-" + ball.rarity}>{ball.rarity.toUpperCase()}</span><h3>{ball.name.en}</h3><p>LEVEL {save.ballLevel[ball.id] ?? 0} · {ball.stats.hp} HP</p>
        <button className={"portal-button " + (favorite ? "primary" : "secondary")} onClick={() => toggleFavorite(ball.id)}>{favorite ? "★ FAVORITE" : "☆ SET FAVORITE"}</button>
      </article>;
    })}</div>
    {!displayed.length && <div className="portal-empty"><span>◈</span><strong>Nothing in this category yet</strong><p>Open a crate or visit the market to expand your collection.</p><a href="/shop" className="portal-text-link">OPEN BALL MARKET ↗</a></div>}
    <div className="portal-columns inventory-equipment">
      <section className="portal-panel"><div className="portal-section-heading"><span className="portal-kicker">LOADOUT</span><h2>Equipped cosmetics</h2></div><div className="portal-form">
        <label>Profile title<select value={save.avatar.title.toLowerCase()} onChange={(event) => persist({ ...save, avatar: { ...save.avatar, title: titleCase(event.target.value) } })}>{titles.map((item) => <option key={item} value={item}>{titleCase(item)}</option>)}{!titles.length && <option value={save.avatar.title.toLowerCase()}>{save.avatar.title}</option>}</select></label>
        <label>Profile frame<select value={save.avatar.frame} onChange={(event) => persist({ ...save, avatar: { ...save.avatar, frame: event.target.value } })}>{frames.map((item) => <option key={item} value={item}>{titleCase(item)}</option>)}{!frames.length && <option value={save.avatar.frame}>{titleCase(save.avatar.frame)}</option>}</select></label>
        <label>Ball trail<select value={save.flyer} onChange={(event) => persist({ ...save, flyer: event.target.value })}>{FLYERS.filter((item) => save.flyers.includes(item.id)).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>Impact effect<select value={save.explosion} onChange={(event) => persist({ ...save, explosion: event.target.value })}>{EXPLOSIONS.filter((item) => save.explosions.includes(item.id)).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      </div></section>
      <section className="portal-panel"><div className="portal-section-heading"><span className="portal-kicker">FRAGMENTS</span><h2>Upgrade materials</h2></div><div className="fragment-count"><span>✧</span><strong>{save.fragments.toLocaleString()}</strong><small>UPGRADE FRAGMENTS</small></div><p className="portal-muted">Fragments are earned from duplicate pulls. Upgrade and crafting flows can build on this inventory next.</p><a href="/shop" className="portal-text-link">GET MORE BALLS ↗</a></section>
    </div>
  </PortalShell>;
}
