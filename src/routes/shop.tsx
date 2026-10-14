import { useMemo, useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import type { BallDef } from "@/sim/types";
import { CONFIG } from "@/config";
import { allPacks } from "@/packs/registry";
import { buyOwnedBall, pullGacha, freshRng, spend } from "@/economy/logic";
import { defaultSave, loadSave, writeSave, type Save } from "@/economy/save";
import { PortalShell } from "@/components/portal-shell";

export const Route = createFileRoute("/shop")({ component: ShopPage });
function ballPrice(ball: BallDef) {
  if (ball.rarity === "mythic") return 280;
  if (ball.rarity === "legendary") return 160;
  if (ball.rarity === "epic") return 80;
  if (ball.rarity === "rare") return 40;
  return 15;
}
function ShopPage() {
  const balls = useMemo(() => allPacks().flatMap((pack) => pack.balls), []);
  const [save, setSave] = useState<Save>(() => defaultSave());
  const [query, setQuery] = useState("");
  const [rarity, setRarity] = useState("all");
  const [showAll, setShowAll] = useState(false);
  const [notice, setNotice] = useState("");
  const [recentPulls, setRecentPulls] = useState<string[]>([]);
  useEffect(() => { setSave(loadSave()); }, []);

  function persist(next: Save) {
    setSave(next);
    try { writeSave(next); } catch { setNotice("Could not save your purchase on this device."); }
  }
  function openCrate(count: number) {
    const cost = CONFIG.gachaCost * count;
    const paid = spend(save, { coins: cost });
    if (!paid.ok) { setNotice("Not enough coins. Win more duels and try again."); return; }
    const result = pullGacha(paid.save, balls, count, freshRng(Date.now()));
    if (!result.pulls.length) { setNotice("No balls are available in the current catalog."); return; }
    persist(result.save);
    const names = new Map(balls.map((ball) => [ball.id, ball.name.en]));
    setRecentPulls(result.pulls.map((pull) => (pull.duplicate ? "Duplicate · " : "") + (names.get(pull.id) || pull.id)));
    setNotice("Crate opened. Rewards have been added to your collection.");
  }
  function buyBall(ball: BallDef) {
    const result = buyOwnedBall(save, ball);
    if (result.error) { setNotice(result.error === "diamonds" ? "Not enough diamonds for this ball." : "This ball is already in your collection."); return; }
    persist(result.save);
    setNotice(ball.name.en + " added to your inventory.");
  }
  const filtered = balls.filter((ball) => (rarity === "all" || ball.rarity === rarity) && (ball.name.en.toLowerCase().includes(query.toLowerCase()) || ball.id.toLowerCase().includes(query.toLowerCase())));
  const visible = showAll || query || rarity !== "all" ? filtered : filtered.slice(0, 18);

  return <PortalShell active="shop" title="THE BALL MARKET" description="Unlock new combat styles using currency earned in your matches.">
    <section className="shop-wallet portal-panel"><div><span className="portal-kicker">YOUR WALLET</span><div className="wallet-values"><strong>● {save.coins.toLocaleString()} <small>COINS</small></strong><strong>◈ {save.diamonds.toLocaleString()} <small>GEMS</small></strong><strong>✧ {save.fragments.toLocaleString()} <small>FRAGMENTS</small></strong></div></div><span className="shop-demo-label">IN-GAME CURRENCY ONLY<br /><small>Real-money payments are not enabled.</small></span></section>
    <section className="crate-panel portal-panel"><div className="crate-art"><span>✦</span><i /><b>ARENA<br />CRATE</b></div><div className="crate-copy"><span className="portal-kicker">LUCKY DROP</span><h2>Open a ball crate</h2><p>Random rarity. Duplicate pulls convert into coins and fragments automatically.</p><div className="crate-actions"><button className="portal-button primary" onClick={() => openCrate(1)}>OPEN 1 · ● {CONFIG.gachaCost}</button><button className="portal-button secondary" onClick={() => openCrate(10)}>OPEN 10 · ● {CONFIG.gachaCost * 10}</button></div></div></section>
    {recentPulls.length > 0 && <section className="portal-panel pull-results"><div className="portal-section-heading"><span className="portal-kicker">JUST UNLOCKED</span><h2>Crate results</h2></div><div className="pull-result-list">{recentPulls.map((name, index) => <span key={index}>✦ {name}</span>)}</div></section>}
    {notice && <p className="portal-notice" role="status">{notice}</p>}
    <div className="portal-section-heading shop-heading"><div><span className="portal-kicker">THE COLLECTION</span><h2>Ball market</h2></div><span className="portal-muted-count">{save.owned.length} owned · {balls.length} listed</span></div>
    <div className="shop-filters"><input aria-label="Search balls" placeholder="Search balls..." value={query} onChange={(event) => setQuery(event.target.value)} /><select aria-label="Filter rarity" value={rarity} onChange={(event) => setRarity(event.target.value)}><option value="all">All rarities</option>{["common", "rare", "epic", "legendary", "mythic"].map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
    <div className="shop-ball-grid">{visible.map((ball) => {
      const owned = save.owned.includes(ball.id);
      return <article className="shop-ball-card" key={ball.id}><div className={"shop-ball-orb rarity-" + ball.rarity} style={{ background: "radial-gradient(circle at 32% 24%, #fff 0%, " + ball.visual.baseColor + " 25%, " + ball.visual.accentColor + " 100%)" }}><span>{ball.id.includes("jolt") ? "ϟ" : ball.id.includes("web") ? "✳" : ball.id.includes("magma") ? "✹" : "◈"}</span></div><span className={"rarity-pill rarity-" + ball.rarity}>{ball.rarity.toUpperCase()}</span><h3>{ball.name.en}</h3><p>{ball.ai_hints.role.toUpperCase()} · {ball.stats.hp} HP</p><button className={"portal-button " + (owned ? "owned" : "secondary")} disabled={owned} onClick={() => buyBall(ball)}>{owned ? "✓ OWNED" : "BUY · ◈ " + ballPrice(ball)}</button></article>;
    })}</div>
    {!showAll && !query && rarity === "all" && filtered.length > visible.length && <button className="portal-button secondary portal-load-more" onClick={() => setShowAll(true)}>VIEW FULL CATALOG · {filtered.length - visible.length} MORE</button>}
    {visible.length === 0 && <div className="portal-empty"><span>⌕</span><strong>No balls found</strong><p>Try another name or rarity filter.</p></div>}
  </PortalShell>;
}
