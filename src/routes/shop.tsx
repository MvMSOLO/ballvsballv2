import { useMemo, useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import type { BallDef } from "@/sim/types";
import { allPacks } from "@/packs/registry";
import { buyOwnedBall } from "@/economy/logic";
import { defaultSave, loadSave, writeSave, type Save } from "@/economy/save";
import { hydrateArenaSave, purchaseArenaBall } from "@/economy/persistence";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { authEnabled } from "@/lib/auth/client";
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
  const { user, isPending } = useCurrentUserState();
  const cloudSync = authEnabled && Boolean(user && !user.isDevFallback);
  const balls = useMemo(() => allPacks().flatMap((pack) => pack.balls), []);
  const [save, setSave] = useState<Save>(() => defaultSave());
  const [query, setQuery] = useState("");
  const [rarity, setRarity] = useState("all");
  const [showAll, setShowAll] = useState(false);
  const [notice, setNotice] = useState("");
  const [buyingBallId, setBuyingBallId] = useState<string | null>(null);
  useEffect(() => {
    const local = loadSave();
    setSave(local);
    if (cloudSync) {
      void hydrateArenaSave(local).then(setSave).catch(() => setNotice("Cloud save could not be loaded; local progress is still available."));
    }
  }, [cloudSync, isPending]);

  async function buyBall(ball: BallDef) {
    if (buyingBallId) return;
    if (save.owned.includes(ball.id)) {
      setNotice("This ball is already in your collection.");
      return;
    }
    setBuyingBallId(ball.id);
    setNotice("");
    try {
      if (cloudSync) {
        const result = await purchaseArenaBall(ball.id);
        setSave(result.save);
        if (result.status === "diamonds") setNotice("Not enough gems for this ball.");
        else if (result.status === "owned") setNotice("This ball is already in your collection.");
        else if (result.status === "unknown") setNotice("This ball is not available in the server catalog.");
        else setNotice(ball.name.en + " unlocked and synced to your account.");
      } else {
        const result = buyOwnedBall(save, ball);
        if (result.error) {
          setNotice(result.error === "diamonds" ? "Not enough gems for this ball." : "This ball is already in your collection.");
          return;
        }
        writeSave(result.save);
        setSave(result.save);
        setNotice(ball.name.en + " unlocked on this device. Sign in to sync your collection.");
      }
    } catch {
      setNotice("Purchase could not be completed. Your balance has not been changed on this screen.");
    } finally {
      setBuyingBallId(null);
    }
  }
  const filtered = balls.filter((ball) => (rarity === "all" || ball.rarity === rarity) && (ball.name.en.toLowerCase().includes(query.toLowerCase()) || ball.id.toLowerCase().includes(query.toLowerCase())));
  const visible = showAll || query || rarity !== "all" ? filtered : filtered.slice(0, 18);

  return <PortalShell active="shop" title="THE BALL MARKET" description="Unlock new combat styles using currency earned in your matches.">
    <section className="shop-wallet portal-panel"><div><span className="portal-kicker">YOUR WALLET</span><div className="wallet-values"><strong>● {save.adminInfiniteCoins ? "∞" : save.coins.toLocaleString()} <small>COINS</small></strong><strong>◈ {save.adminInfiniteDiamonds ? "∞" : save.diamonds.toLocaleString()} <small>GEMS</small></strong><strong>✧ {save.fragments.toLocaleString()} <small>FRAGMENTS</small></strong></div></div><span className="shop-demo-label">IN-GAME CURRENCY ONLY<br /><small>Real-money payments are not enabled.</small></span></section>
    <section className="portal-panel shop-feature-panel"><span className="shop-feature-icon">◈</span><div><span className="portal-kicker">DIRECT UNLOCKS</span><h2>Pick the ball. See the price. Own it.</h2><p>Every ball has a fixed gem price shown on its card. No randomized purchases and no real-money checkout.</p></div></section>
    {notice && <p className="portal-notice" role="status">{notice}</p>}
    <div className="portal-section-heading shop-heading"><div><span className="portal-kicker">THE COLLECTION</span><h2>Ball market</h2></div><span className="portal-muted-count">{save.owned.length} owned · {balls.length} listed</span></div>
    <div className="shop-filters"><input aria-label="Search balls" placeholder="Search balls..." value={query} onChange={(event) => setQuery(event.target.value)} /><select aria-label="Filter rarity" value={rarity} onChange={(event) => setRarity(event.target.value)}><option value="all">All rarities</option>{["common", "rare", "epic", "legendary", "mythic"].map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
    <div className="shop-ball-grid">{visible.map((ball) => {
      const owned = save.owned.includes(ball.id);
      return <article className="shop-ball-card" key={ball.id}><div className={"shop-ball-orb rarity-" + ball.rarity} style={{ background: "radial-gradient(circle at 32% 24%, #fff 0%, " + ball.visual.baseColor + " 25%, " + ball.visual.accentColor + " 100%)" }}><span>{ball.id.includes("jolt") ? "ϟ" : ball.id.includes("web") ? "✳" : ball.id.includes("magma") ? "✹" : "◈"}</span></div><span className={"rarity-pill rarity-" + ball.rarity}>{ball.rarity.toUpperCase()}</span><h3>{ball.name.en}</h3><p>{ball.ai_hints.role.toUpperCase()} · {ball.stats.hp} HP</p><button className={"portal-button " + (owned ? "owned" : "secondary")} disabled={owned || buyingBallId !== null} onClick={() => void buyBall(ball)}>{owned ? "✓ OWNED" : buyingBallId === ball.id ? "PURCHASING…" : "BUY · ◈ " + ballPrice(ball)}</button></article>;
    })}</div>
    {!showAll && !query && rarity === "all" && filtered.length > visible.length && <button className="portal-button secondary portal-load-more" onClick={() => setShowAll(true)}>VIEW FULL CATALOG · {filtered.length - visible.length} MORE</button>}
    {visible.length === 0 && <div className="portal-empty"><span>⌕</span><strong>No balls found</strong><p>Try another name or rarity filter.</p></div>}
  </PortalShell>;
}
