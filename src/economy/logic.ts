import { CONFIG, levelFromXp, type Rarity } from "../config";
import type { BallDef } from "../sim/types";
import {
  defaultSave,
  levelOf,
  migrateSave,
  todayKey,
  type MatchRecord,
  type Save,
} from "./save";

export interface Reward {
  coins: number;
  xp: number;
  trophies: number;
  diamonds: number;
}

export interface PullResult {
  id: string;
  rarity: Rarity;
  duplicate: boolean;
  fragments: number;
}

const RARITY_ORDER: Rarity[] = ["common", "rare", "epic", "legendary", "mythic"];

export const DIVISIONS = [
  { id: "pebble", min: 0, en: "Pebble", uz: "Toshbo'lak", ru: "Галька" },
  { id: "orbit", min: 120, en: "Iron Orbit", uz: "Temir orbita", ru: "Железная орбита" },
  { id: "pulse", min: 280, en: "Steel Pulse", uz: "Po'lat zarba", ru: "Стальной пульс" },
  { id: "guard", min: 480, en: "Neon Guard", uz: "Neon qo'riqchi", ru: "Неоновый страж" },
  { id: "ace", min: 760, en: "Crimson Ace", uz: "Qirmizi ace", ru: "Багровый ас" },
  { id: "vanguard", min: 1100, en: "Solar Vanguard", uz: "Quyosh avangardi", ru: "Солнечный авангард" },
  { id: "coil", min: 1550, en: "Myth Coil", uz: "Afsona spirali", ru: "Миф-спираль" },
  { id: "god", min: 2100, en: "Colosseum", uz: "Kolizey", ru: "Колизей" },
] as const;

export function divisionOf(trophies: number) {
  let current: (typeof DIVISIONS)[number] = DIVISIONS[0];
  for (const row of DIVISIONS) if (trophies >= row.min) current = row;
  return current;
}

export function nextDivision(trophies: number) {
  return DIVISIONS.find((row) => row.min > trophies) ?? null;
}

export function boostLive(save: Save, now = Date.now()): boolean {
  return save.boostUntil > now && save.boostKind !== "";
}

export function computeRewards(
  win: boolean,
  heartsLeft: number,
  opts: { ranked: boolean; boost: boolean; pro: boolean; ballLevel: number },
): Reward {
  let coins = win ? CONFIG.winCoinsBase + Math.max(0, heartsLeft) * 15 : CONFIG.loseCoins;
  let xp = win ? CONFIG.xpWin : CONFIG.xpLose;
  if (opts.boost) {
    coins *= 2;
    xp *= 2;
  }
  if (opts.pro) coins = Math.round(coins * 1.1);
  const levelBonus = 1 + Math.max(0, Math.min(20, opts.ballLevel)) * 0.01;
  coins = Math.round(coins * levelBonus);
  const trophies = opts.ranked ? (win ? 28 : -18) : win ? 8 : 2;
  const diamonds = win && heartsLeft >= 3 ? 1 : 0;
  return { coins, xp, trophies, diamonds };
}

export function applyMatch(
  save: Save,
  input: {
    win: boolean;
    heartsLeft: number;
    ranked: boolean;
    opponent: string;
    ball: string;
    oppBall: string;
    seed: number;
    damage: number;
    now?: number;
  },
): Save {
  const next = clone(save);
  const ballLevel = next.ballLevel[input.ball] ?? 0;
  const reward = computeRewards(input.win, input.heartsLeft, {
    ranked: input.ranked,
    boost: boostLive(next, input.now),
    pro: next.proPass,
    ballLevel,
  });
  next.coins += reward.coins;
  next.diamonds += reward.diamonds;
  next.xp += reward.xp;
  next.passXp += reward.xp;
  next.trophies = Math.max(0, next.trophies + reward.trophies);
  next.matches += 1;
  next.questPlay += 1;
  next.questRounds += 1;
  next.weeklyPlay += 1;
  next.damageDealt += Math.max(0, Math.round(input.damage));
  if (input.win) {
    next.wins += 1;
    next.questWin += 1;
    next.winStreak += 1;
    next.bestStreak = Math.max(next.bestStreak, next.winStreak);
  } else {
    next.winStreak = 0;
  }
  const row: MatchRecord = {
    id: `${input.seed}-${next.matches}`,
    at: input.now ?? Date.now(),
    opponent: input.opponent,
    ball: input.ball,
    oppBall: input.oppBall,
    win: input.win,
    trophies: reward.trophies,
    seed: input.seed,
    damage: Math.round(input.damage),
  };
  next.history = [row, ...next.history].slice(0, 20);
  return next;
}

function clone(save: Save): Save {
  return migrateSave(JSON.parse(JSON.stringify(save)) as unknown);
}

export function rollRarity(save: Save, rng: () => number): Rarity {
  const forceLegend = save.pity + 1 >= 40;
  const forceEpic = save.epicPity + 1 >= 10;
  if (forceLegend) return rng() < 0.12 ? "mythic" : "legendary";
  if (forceEpic) {
    const bag: Rarity[] = ["epic", "epic", "epic", "legendary", "mythic"];
    return bag[Math.floor(rng() * bag.length)] ?? "epic";
  }
  const weights = CONFIG.gachaWeights;
  const total = RARITY_ORDER.reduce((sum, key) => sum + weights[key], 0);
  let cursor = rng() * total;
  for (const key of RARITY_ORDER) {
    cursor -= weights[key];
    if (cursor <= 0) return key;
  }
  return "common";
}

export function pullGacha(save: Save, pool: BallDef[], count: number, rng: () => number): { save: Save; pulls: PullResult[] } {
  const next = clone(save);
  const pulls: PullResult[] = [];
  const n = Math.max(1, Math.min(10, count));
  if (!pool.length) return { save: next, pulls };
  for (let i = 0; i < n; i++) {
    const rarity = rollRarity(next, rng);
    const bucket = pool.filter((ball) => ball.rarity === rarity);
    const choice = (bucket.length ? bucket : pool)[Math.floor(rng() * (bucket.length ? bucket.length : pool.length))]!;
    const duplicate = next.owned.includes(choice.id);
    let fragments = 0;
    if (duplicate) {
      fragments = CONFIG.duplicateFragments + (rarity === "legendary" || rarity === "mythic" ? 8 : rarity === "epic" ? 4 : 0);
      next.fragments += fragments;
      next.coins += CONFIG.duplicateCoins;
    } else {
      next.owned = [...next.owned, choice.id];
    }
    next.pulls += 1;
    next.pity = rarity === "legendary" || rarity === "mythic" ? 0 : next.pity + 1;
    next.epicPity = rarity === "epic" || rarity === "legendary" || rarity === "mythic" ? 0 : next.epicPity + 1;
    pulls.push({ id: choice.id, rarity: choice.rarity, duplicate, fragments });
  }
  return { save: next, pulls };
}

export function craftBall(save: Save, pool: BallDef[], rng: () => number): { save: Save; id: string | null; error?: string } {
  const next = clone(save);
  if (next.fragments < CONFIG.craftFragments) return { save, id: null, error: "fragments" };
  if (!pool.length) return { save, id: null, error: "empty" };
  next.fragments -= CONFIG.craftFragments;
  next.crafts += 1;
  const missing = pool.filter((ball) => !next.owned.includes(ball.id));
  const choice = (missing.length ? missing : pool)[Math.floor(rng() * (missing.length || pool.length))]!;
  if (next.owned.includes(choice.id)) {
    next.fragments += CONFIG.duplicateFragments;
    next.coins += CONFIG.duplicateCoins;
  } else {
    next.owned = [...next.owned, choice.id];
  }
  return { save: next, id: choice.id };
}

export function upgradeBall(save: Save, id: string): { save: Save; error?: string } {
  if (!save.owned.includes(id)) return { save, error: "unowned" };
  const level = save.ballLevel[id] ?? 0;
  if (level >= 10) return { save, error: "max" };
  const cost = 20 + level * 12;
  if (save.fragments < cost) return { save, error: "fragments" };
  const next = clone(save);
  next.fragments -= cost;
  next.ballLevel = { ...next.ballLevel, [id]: level + 1 };
  return { save: next };
}

const SKUS: Record<string, { diamonds?: number; coins?: number; fragments?: number; hours?: number; kind?: Save["boostKind"]; pro?: boolean; pass?: boolean; tokens?: number; cosmetic?: string }> = {
  handful: { diamonds: 10 },
  pouch: { diamonds: 30 },
  crate: { diamonds: 80 },
  vault: { diamonds: 200 },
  colosseum: { diamonds: 520 },
  coins_satchel: { coins: 800 },
  coins_chest: { coins: 2400 },
  frag_pack: { fragments: 40 },
  frag_crate: { fragments: 120 },
  boost_1h: { hours: 1, kind: "both" },
  boost_24h: { hours: 24, kind: "both" },
  boost_7d: { hours: 168, kind: "both" },
  reroll_pack: { tokens: 3 },
  pro_pass: { pro: true, tokens: 2, cosmetic: "title_pro" },
  battle_pass: { pass: true },
  starter: { diamonds: 40, coins: 1500, fragments: 30, tokens: 2 },
};

export function skuCatalog() {
  return SKUS;
}

/** Idempotent fulfillment. Same order id never grants twice. Test-mode currency packs do not debit a card. */
export function fulfillOrder(save: Save, sku: string, orderId: string, now = Date.now()): { save: Save; status: "ok" | "duplicate" | "unknown" } {
  if (!orderId || save.fulfilledOrders.includes(orderId)) return { save, status: "duplicate" };
  const spec = SKUS[sku];
  if (!spec) return { save, status: "unknown" };
  const next = clone(save);
  next.fulfilledOrders = [...next.fulfilledOrders, orderId].slice(-200);
  const first = !next.firstPurchase[sku];
  const currencyPack = sku === "handful" || sku === "pouch" || sku === "crate" || sku === "vault" || sku === "colosseum" || sku === "coins_satchel" || sku === "coins_chest";
  const mult = first && currencyPack ? 2 : 1;
  if (first && currencyPack) next.firstPurchase = { ...next.firstPurchase, [sku]: true };
  if (spec.diamonds) next.diamonds += spec.diamonds * mult;
  if (spec.coins) next.coins += spec.coins * mult;
  if (spec.fragments) next.fragments += spec.fragments;
  if (spec.tokens) next.rerollTokens += spec.tokens;
  if (spec.hours && spec.kind) {
    const base = Math.max(now, next.boostUntil);
    next.boostUntil = base + spec.hours * 3600000;
    next.boostKind = "both";
  }
  if (spec.pro) {
    next.proPass = true;
    if (spec.cosmetic && !next.cosmetics.includes(spec.cosmetic)) next.cosmetics = [...next.cosmetics, spec.cosmetic];
    next.avatar = { ...next.avatar, title: "Pro" };
  }
  if (spec.pass) next.passPremium = true;
  return { save: next, status: "ok" };
}

export function spend(save: Save, cost: { coins?: number; diamonds?: number }): { save: Save; ok: boolean } {
  if ((cost.coins ?? 0) > save.coins || (cost.diamonds ?? 0) > save.diamonds) return { save, ok: false };
  const next = clone(save);
  next.coins -= cost.coins ?? 0;
  next.diamonds -= cost.diamonds ?? 0;
  return { save: next, ok: true };
}

export function buyOwnedBall(save: Save, ball: BallDef): { save: Save; error?: string } {
  if (save.owned.includes(ball.id)) return { save, error: "owned" };
  const price = ball.rarity === "mythic" ? 280 : ball.rarity === "legendary" ? 160 : ball.rarity === "epic" ? 80 : ball.rarity === "rare" ? 40 : 15;
  const paid = spend(save, { diamonds: price });
  if (!paid.ok) return { save, error: "diamonds" };
  paid.save.owned = [...paid.save.owned, ball.id];
  return { save: paid.save };
}

function yesterdayKey(now: Date): string {
  const d = new Date(now);
  d.setDate(d.getDate() - 1);
  return todayKey(d);
}

export function claimDaily(save: Save, now = new Date(), useToken = false): { save: Save; error?: string; reward?: { coins: number; diamonds: number } } {
  const day = todayKey(now);
  if (save.dailyClaimedOn === day) return { save, error: "claimed" };
  const next = clone(save);
  const continued = save.dailyClaimedOn === yesterdayKey(now);
  if (!continued && save.dailyClaimedOn && useToken && next.streakTokens > 0) {
    next.streakTokens -= 1;
    next.streak += 1;
  } else if (continued || !save.dailyClaimedOn) {
    next.streak = continued ? next.streak + 1 : 1;
  } else {
    next.streak = 1;
    next.dailyIndex = 0;
  }
  if (continued || useToken) next.dailyIndex = (save.dailyIndex + (save.dailyClaimedOn ? 1 : 0)) % 7;
  const reward = CONFIG.dailyRewards[next.dailyIndex] ?? CONFIG.dailyRewards[0];
  next.coins += reward.coins + (next.proPass ? 20 : 0);
  next.diamonds += reward.diamonds;
  if (next.proPass) next.rerollTokens += 1;
  next.dailyClaimedOn = day;
  next.dailyDay = day;
  return { save: next, reward };
}

export function claimQuest(save: Save, index: 0 | 1 | 2): { save: Save; error?: string } {
  const goals = [1, 1, 3];
  const progress = [save.questPlay, save.questWin, save.questRounds][index];
  if (save.questClaimed[index]) return { save, error: "claimed" };
  if (progress < goals[index]) return { save, error: "progress" };
  const next = clone(save);
  next.questClaimed = [...next.questClaimed] as [boolean, boolean, boolean];
  next.questClaimed[index] = true;
  next.coins += [80, 120, 150][index];
  next.xp += [10, 20, 16][index];
  next.passXp += [10, 20, 16][index];
  if (index === 1) next.diamonds += 1;
  return { save: next };
}

export function claimWeekly(save: Save): { save: Save; error?: string } {
  if (save.weeklyClaimed) return { save, error: "claimed" };
  if (save.weeklyPlay < 10) return { save, error: "progress" };
  const next = clone(save);
  next.weeklyClaimed = true;
  next.coins += 600;
  next.diamonds += 8;
  next.fragments += 20;
  next.passXp += 80;
  return { save: next };
}

export interface AchievementDef {
  id: string;
  metric: "matches" | "wins" | "bestStreak" | "trophies" | "damage" | "pulls" | "owned" | "level" | "play" | "crafts" | "login" | "friends";
  goal: number;
  coins: number;
  diamonds: number;
  en: string;
  uz: string;
  ru: string;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  ["first_spark", "matches", 1, 40, 0, "First light", "Birinchi uchqun", "Первая искра"],
  ["bouts_10", "matches", 10, 80, 0, "Ten bouts", "O'nta jang", "Десять боёв"],
  ["bouts_25", "matches", 25, 120, 1, "Regular", "Doimiy mehmon", "Завсегдатай"],
  ["bouts_50", "matches", 50, 180, 2, "Veteran", "Veteran", "Ветеран"],
  ["bouts_100", "matches", 100, 300, 4, "Centurion", "Yuzlab jang", "Центурион"],
  ["win_1", "wins", 1, 60, 0, "First blood", "Birinchi g'alaba", "Первая кровь"],
  ["win_10", "wins", 10, 140, 1, "Hot hand", "Qizigan qo'l", "Горячая рука"],
  ["win_25", "wins", 25, 220, 2, "Champion", "Chempion", "Чемпион"],
  ["win_50", "wins", 50, 400, 5, "Warlord", "Sarkarda", "Полководец"],
  ["streak_3", "bestStreak", 3, 70, 0, "Three straight", "Uchta ketma-ket", "Три подряд"],
  ["streak_5", "bestStreak", 5, 120, 1, "On fire", "Olovda", "В ударе"],
  ["streak_8", "bestStreak", 8, 200, 2, "Untouchable", "Tegilmas", "Неприкасаемый"],
  ["streak_12", "bestStreak", 12, 360, 4, "Dynasty", "Sulola", "Династия"],
  ["trophy_120", "trophies", 120, 80, 0, "Ranked spark", "Reyting uchquni", "Искра рейтинга"],
  ["trophy_280", "trophies", 280, 120, 1, "Climbing", "Ko'tarilish", "Подъём"],
  ["trophy_760", "trophies", 760, 200, 2, "Ace night", "Ace kechasi", "Ночь аса"],
  ["trophy_1550", "trophies", 1550, 400, 6, "Myth coil", "Afsona spirali", "Миф-спираль"],
  ["dmg_400", "damage", 400, 50, 0, "First dents", "Birinchi iz", "Первые вмятины"],
  ["dmg_2000", "damage", 2000, 120, 1, "Heavy hands", "Og'ir qo'l", "Тяжёлая рука"],
  ["dmg_8000", "damage", 8000, 240, 3, "Arena storm", "Arena bo'roni", "Шторм арены"],
  ["own_8", "owned", 8, 60, 0, "Pocket league", "Cho'ntak ligasi", "Карманная лига"],
  ["own_16", "owned", 16, 140, 2, "Curator", "To'plovchi", "Куратор"],
  ["own_24", "owned", 24, 260, 4, "Archivist", "Arxivchi", "Архивариус"],
  ["pull_1", "pulls", 1, 20, 0, "First crate", "Birinchi quti", "Первый ящик"],
  ["pull_10", "pulls", 10, 80, 1, "Pity watch", "Afsus hisoblagich", "Счётчик жалости"],
  ["pull_40", "pulls", 40, 200, 4, "Legend due", "Afsona vaqti", "Легенда близко"],
  ["lvl_5", "level", 5, 80, 0, "Warmed up", "Qizidi", "Разогрев"],
  ["lvl_10", "level", 10, 160, 2, "Known name", "Taniqli ism", "Известное имя"],
  ["lvl_20", "level", 20, 300, 4, "House name", "Uy nomi", "Имя дома"],
  ["play_10m", "play", 600, 40, 0, "Ten minutes", "O'n daqiqa", "Десять минут"],
  ["play_1h", "play", 3600, 150, 2, "Hour in the lights", "Chiroqlar ostida soat", "Час под огнями"],
  ["craft_1", "crafts", 1, 40, 0, "First forge", "Birinchi o'choq", "Первый горн"],
  ["craft_5", "crafts", 5, 120, 1, "Smith", "Temirchi", "Кузнец"],
  ["login_3", "login", 3, 60, 1, "Three-day flame", "Uch kunlik alanga", "Трёхдневное пламя"],
  ["login_7", "login", 7, 140, 3, "Week of fire", "Olovli hafta", "Огненная неделя"],
  ["login_14", "login", 14, 240, 5, "Fortnight", "Ikki hafta", "Две недели"],
  ["friends_1", "friends", 1, 40, 0, "Plus one", "Yana bittasi", "Плюс один"],
  ["friends_5", "friends", 5, 100, 1, "Crew", "Jamoa", "Команда"],
  ["pass_200", "level", 8, 80, 1, "Season walker", "Mavsum yo'lchisi", "Путник сезона"],
  ["damage_king", "damage", 15000, 400, 6, "Colosseum hammer", "Kolizey bolg'asi", "Молот Колизея"],
].map(([id, metric, goal, coins, diamonds, en, uz, ru]) => ({
  id: id as string,
  metric: metric as AchievementDef["metric"],
  goal: goal as number,
  coins: coins as number,
  diamonds: diamonds as number,
  en: en as string,
  uz: uz as string,
  ru: ru as string,
}));

export function metricValue(save: Save, metric: AchievementDef["metric"]): number {
  switch (metric) {
    case "matches": return save.matches;
    case "wins": return save.wins;
    case "bestStreak": return save.bestStreak;
    case "trophies": return save.trophies;
    case "damage": return save.damageDealt;
    case "pulls": return save.pulls;
    case "owned": return save.owned.length;
    case "level": return levelOf(save);
    case "play": return save.playSeconds;
    case "crafts": return save.crafts;
    case "login": return save.streak;
    case "friends": return save.friends.length;
  }
}

export function claimAchievement(save: Save, id: string): { save: Save; error?: string } {
  const def = ACHIEVEMENTS.find((row) => row.id === id);
  if (!def) return { save, error: "missing" };
  if (save.achievements[id]?.claimed) return { save, error: "claimed" };
  if (metricValue(save, def.metric) < def.goal) return { save, error: "progress" };
  const next = clone(save);
  next.achievements = { ...next.achievements, [id]: { p: def.goal, claimed: true } };
  next.coins += def.coins;
  next.diamonds += def.diamonds;
  return { save: next };
}

export function passTier(save: Save): number {
  return Math.max(0, Math.min(50, Math.floor(save.passXp / 80)));
}

export function claimPassTier(save: Save, tier: number, track: "free" | "prem"): { save: Save; error?: string } {
  if (tier < 1 || tier > 50) return { save, error: "tier" };
  if (passTier(save) < tier) return { save, error: "progress" };
  if (track === "prem" && !save.passPremium) return { save, error: "premium" };
  const bag = track === "free" ? save.passClaimedFree : save.passClaimedPrem;
  if (bag.includes(tier)) return { save, error: "claimed" };
  const next = clone(save);
  if (track === "free") {
    next.passClaimedFree = [...next.passClaimedFree, tier];
    next.coins += tier % 5 === 0 ? 200 : 40 + tier * 6;
    if (tier % 5 === 0) next.diamonds += 2;
  } else {
    next.passClaimedPrem = [...next.passClaimedPrem, tier];
    next.coins += 90 + tier * 10;
    next.fragments += tier % 3 === 0 ? 6 : 2;
    if (tier % 10 === 0) next.diamonds += 12;
  }
  return { save: next };
}

export function mergeCloud(local: Save, remote: Save | null): Save {
  if (!remote) return migrateSave(local);
  const a = migrateSave(local);
  const b = migrateSave(remote);
  const owned = [...new Set([...a.owned, ...b.owned])];
  const history = [...a.history, ...b.history].filter((row, index, list) => list.findIndex((other) => other.id === row.id) === index).slice(0, 20);
  const achievements: Save["achievements"] = { ...a.achievements };
  for (const [id, state] of Object.entries(b.achievements)) {
    const prev = achievements[id];
    achievements[id] = { p: Math.max(prev?.p ?? 0, state.p), claimed: Boolean(prev?.claimed || state.claimed) };
  }
  const ballLevel: Record<string, number> = { ...a.ballLevel };
  for (const [id, level] of Object.entries(b.ballLevel)) ballLevel[id] = Math.max(ballLevel[id] ?? 0, level);
  return migrateSave({
    ...a,
    ...b,
    coins: Math.max(a.coins, b.coins),
    diamonds: Math.max(a.diamonds, b.diamonds),
    fragments: Math.max(a.fragments, b.fragments),
    xp: Math.max(a.xp, b.xp),
    trophies: Math.max(a.trophies, b.trophies),
    matches: Math.max(a.matches, b.matches),
    wins: Math.max(a.wins, b.wins),
    bestStreak: Math.max(a.bestStreak, b.bestStreak),
    damageDealt: Math.max(a.damageDealt, b.damageDealt),
    playSeconds: Math.max(a.playSeconds, b.playSeconds),
    pulls: Math.max(a.pulls, b.pulls),
    pity: Math.max(a.pity, b.pity),
    epicPity: Math.max(a.epicPity, b.epicPity),
    passXp: Math.max(a.passXp, b.passXp),
    streak: Math.max(a.streak, b.streak),
    owned,
    history,
    achievements,
    ballLevel,
    cosmetics: [...new Set([...a.cosmetics, ...b.cosmetics])],
    explosions: [...new Set([...a.explosions, ...b.explosions])],
    flyers: [...new Set([...a.flyers, ...b.flyers])],
    explosion: a.explosion,
    flyer: a.flyer,
    favorites: a.favorites,
    country: a.country,
    outfitSlots: a.outfitSlots,
    activeOutfit: a.activeOutfit,
    fulfilledOrders: [...new Set([...a.fulfilledOrders, ...b.fulfilledOrders])].slice(-200),
    proPass: a.proPass || b.proPass,
    passPremium: a.passPremium || b.passPremium,
    username: a.username !== "Guest" ? a.username : b.username,
    avatar: a.avatar,
    settings: a.settings,
    friends: a.friends.length >= b.friends.length ? a.friends : b.friends,
  });
}

export function freshRng(seed: number): () => number {
  let s = seed || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function emptyEconomy(): Save {
  return defaultSave();
}

export { levelFromXp };
