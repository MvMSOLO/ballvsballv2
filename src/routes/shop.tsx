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
import { BallInspectDialog } from "@/components/ball-inspect-dialog";

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
  const [ownership, setOwnership] = useState("all");
  const [sort, setSort] = useState("featured");
  const [saveReady, setSaveReady] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"loading" | "local" | "syncing" | "synced" | "error">("loading");
  const [notice, setNotice] = useState("");
  const [buyingBallId, setBuyingBallId] = useState<string | null>(null);
  const [inspectedBall, setInspectedBall] = useState<BallDef | null>(null);
  useEffect(() => {
    const local = loadSave();
    setSave(local);
    setSaveReady(true);
    if (cloudSync) {
      setSaveStatus("syncing");
      void hydrateArenaSave(local)
        .then((next) => { setSave(next); setSaveStatus("synced"); })
        .catch(() => {
          setSaveStatus("error");
          setNotice("Cloud save could not be loaded; your local collection remains available.");
        });
    } else {
      setSaveStatus("local");
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
        setSaveStatus("synced");
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
        setSaveStatus("local");
        setNotice(ball.name.en + " unlocked on this device. Sign in to sync your collection.");
      }
    } catch {
      setSaveStatus("error");
      setNotice("Purchase could not be confirmed. Check ownership and wallet state before retrying.");
    } finally {
      setBuyingBallId(null);
    }
  }
  const rarityOrder: Record<BallDef["rarity"], number> = { common: 0, rare: 1, epic: 2, legendary: 3, mythic: 4 };
  const filtered = balls.filter((ball) => {
    const term = query.trim().toLowerCase();
    const haystack = [ball.name.en, ball.id, ball.ai_hints.role, ...ball.tags].join(" ").toLowerCase();
    const ownsBall = save.owned.includes(ball.id);
    return (rarity === "all" || ball.rarity === rarity)
      && (ownership === "all" || (ownership === "owned" ? ownsBall : !ownsBall))
      && (!term || haystack.includes(term));
  });
  const sorted = [...filtered].sort((a, b) => {
    if (sort === "name") return a.name.en.localeCompare(b.name.en);
    if (sort === "price-low") return ballPrice(a) - ballPrice(b) || a.name.en.localeCompare(b.name.en);
    if (sort === "price-high") return ballPrice(b) - ballPrice(a) || a.name.en.localeCompare(b.name.en);
    if (sort === "rarity") return rarityOrder[rarityOrder[a.rarity] === undefined ? "common" : b.rarity] - rarityOrder[a.rarity] || a.name.en.localeCompare(b.name.en);
    return 0;
  });
  const hasActiveFilters = Boolean(query.trim()) || rarity !== "all" || ownership !== "all" || sort !== "featured";
  const visible = showAll || hasActiveFilters ? sorted : sorted.slice(0, 18);

  return <PortalShell active="shop" title="THE BALL MARKET" description="Unlock new combat styles using currency earned in your matches.">
    <section className="shop-wallet portal-panel"><div><span className="portal-kicker">YOUR WALLET</span><div className="wallet-values"><strong>● {save.adminInfiniteCoins ? "∞" : save.coins.toLocaleString()} <small>COINS</small></strong><strong>◈ {save.adminInfiniteDiamonds ? "∞" : save.diamonds.toLocaleString()} <small>GEMS</small></strong><strong>✧ {save.fragments.toLocaleString()} <small>FRAGMENTS</small></strong></div></div><div className="shop-wallet-side"><span className="shop-save-state" data-state={saveStatus} role="status">{saveStatus === "loading" ? "LOADING SAVE…" : saveStatus === "syncing" ? "SYNCING ACCOUNT…" : saveStatus === "synced" ? "ACCOUNT SYNCED" : saveStatus === "error" ? "SYNC NEEDS ATTENTION" : "LOCAL SAVE"}</span><span className="shop-demo-label">IN-GAME CURRENCY ONLY<br /><small>Real-money payments are not enabled.</small></span></div></section>
    <section className="portal-panel shop-feature-panel"><span className="shop-feature-icon">◈</span><div><span className="portal-kicker">DIRECT UNLOCKS</span><h2>Pick the ball. See the price. Own it.</h2><p>Every ball has a fixed gem price shown on its card. No randomized purchases and no real-money checkout.</p></div></section>
    {notice && <p className="portal-notice" role="status">{notice}</p>}
    <div className="portal-section-heading shop-heading"><div><span className="portal-kicker">THE COLLECTION</span><h2>Ball market</h2></div><span className="portal-muted-count">{save.owned.length} owned · {filtered.length} matching · {balls.length} listed</span></div>
    <div className="shop-filters shop-catalog-filters"><input aria-label="Search balls by name, role, or tag" placeholder="Search name, role, or tag…" value={query} onChange={(event) => setQuery(event.target.value)} /><select aria-label="Filter rarity" value={rarity} onChange={(event) => setRarity(event.target.value)}><option value="all">All rarities</option>{["common", "rare", "epic", "legendary", "mythic"].map((item) => <option key={item} value={item}>{item}</option>)}</select><select aria-label="Filter ownership" value={ownership} onChange={(event) => setOwnership(event.target.value)}><option value="all">All balls</option><option value="owned">Owned</option><option value="unowned">Not owned</option></select><select aria-label="Sort ball catalogue" value={sort} onChange={(event) => setSort(event.target.value)}><option value="featured">Featured order</option><option value="name">Name A–Z</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option><option value="rarity">Rarity</option></select></div>
    {!saveReady ? <div className="portal-empty shop-loading" role="status"><strong>Loading saved collection…</strong><p>Reading your wallet and ownership before showing purchase states.</p></div> : <div className="shop-ball-grid" aria-busy={saveStatus === "syncing"}>{visible.map((ball) => {
      const owned = save.owned.includes(ball.id);
      return <article className="shop-ball-card" key={ball.id}><div className={"shop-ball-orb rarity-" + ball.rarity + " shape-" + ball.visual.shape} style={{ background: "radial-gradient(circle at 32% 24%, #fff 0%, " + ball.visual.baseColor + " 25%, " + ball.visual.accentColor + " 100%)" }}><span>{ball.id.includes("jolt") ? "ϟ" : ball.id.includes("web") ? "✳" : ball.id.includes("magma") ? "✹" : "◈"}</span></div><span className={"rarity-pill rarity-" + ball.rarity}>{ball.rarity.toUpperCase()}</span><h3>{ball.name.en}</h3><p>{ball.ai_hints.role.toUpperCase()} · {ball.stats.hp} HP</p><button className="portal-button secondary ball-inspect-trigger" type="button" onClick={() => setInspectedBall(ball)}>⌕ INSPECT</button><button className={"portal-button " + (owned ? "owned" : "secondary")} disabled={owned || buyingBallId !== null} onClick={() => void buyBall(ball)}>{owned ? "✓ OWNED" : buyingBallId === ball.id ? "PURCHASING…" : "BUY · ◈ " + ballPrice(ball)}</button></article>;
    })}</div>}
    {!showAll && !query.trim() && rarity === "all" && ownership === "all" && sort === "featured" && filtered.length > visible.length && <button className="portal-button secondary portal-load-more" onClick={() => setShowAll(true)}>VIEW FULL CATALOG · {filtered.length - visible.length} MORE</button>}
    {saveReady && visible.length === 0 && <div className="portal-empty"><span>⌕</span><strong>No balls match these filters</strong><p>Clear a filter or search by another name, role, or tag.</p><button className="portal-button secondary" type="button" onClick={() => { setQuery(""); setRarity("all"); setOwnership("all"); setSort("featured"); setShowAll(false); }}>RESET CATALOG FILTERS</button></div>}
    <BallInspectDialog ball={inspectedBall} onClose={() => setInspectedBall(null)} actionLabel={inspectedBall ? save.owned.includes(inspectedBall.id) ? "✓ ALREADY OWNED" : buyingBallId === inspectedBall.id ? "PURCHASING…" : "BUY · ◈ " + ballPrice(inspectedBall) : undefined} actionDisabled={!inspectedBall || save.owned.includes(inspectedBall.id) || buyingBallId !== null} onAction={() => { if (inspectedBall) void buyBall(inspectedBall); }} />
  </PortalShell>;
}
