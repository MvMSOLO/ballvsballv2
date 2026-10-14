import { CONFIG, levelFromXp, type Lang, type QualityName } from "../config";

export interface AvatarLook {
  skin: string;
  shirt: string;
  pants: string;
  hat: string;
  hatStyle: string;
  face: string;
  back: string;
  emote: string;
  frame: string;
  title: string;
}

export interface MatchRecord {
  id: string;
  at: number;
  opponent: string;
  ball: string;
  oppBall: string;
  win: boolean;
  trophies: number;
  seed: number;
  damage: number;
}

export interface AchievementState {
  p: number;
  claimed: boolean;
}

export interface SaveSettings {
  lang: Lang;
  sound: boolean;
  haptics: boolean;
  quality: QualityName;
  leftHanded: boolean;
  master: number;
  music: number;
  sfx: number;
  colorblind: boolean;
  reduceMotion: boolean;
}

export interface FriendCard {
  name: string;
  ball: string;
  trophies: number;
}

export interface Save {
  v: number;
  coins: number;
  diamonds: number;
  /** Server-controlled owner overrides; the server overwrites these from moderation records. */
  adminInfiniteCoins: boolean;
  adminInfiniteDiamonds: boolean;
  fragments: number;
  xp: number;
  owned: string[];
  explosions: string[];
  flyers: string[];
  explosion: string;
  flyer: string;
  avatar: AvatarLook;
  settings: SaveSettings;
  dailyDay: string;
  streak: number;
  questDay: string;
  questPlay: number;
  questWin: number;
  questRounds: number;
  questClaimed: [boolean, boolean, boolean];
  matches: number;
  wins: number;
  packsEnabled: string[] | null;
  username: string;
  country: string;
  favorites: string[];
  ballLevel: Record<string, number>;
  trophies: number;
  bestStreak: number;
  winStreak: number;
  damageDealt: number;
  playSeconds: number;
  history: MatchRecord[];
  achievements: Record<string, AchievementState>;
  dailyClaimedOn: string;
  dailyIndex: number;
  streakTokens: number;
  passXp: number;
  passPremium: boolean;
  passClaimedFree: number[];
  passClaimedPrem: number[];
  pity: number;
  epicPity: number;
  pulls: number;
  boostUntil: number;
  boostKind: "" | "xp" | "coin" | "both";
  rerollTokens: number;
  proPass: boolean;
  cosmetics: string[];
  outfitSlots: AvatarLook[];
  activeOutfit: number;
  friends: FriendCard[];
  fulfilledOrders: string[];
  firstPurchase: Record<string, boolean>;
  weeklyKey: string;
  weeklyPlay: number;
  weeklyClaimed: boolean;
  crafts: number;
  guestPrompted: boolean;
  joinedAt: number;
  seasonId: string;
}

const KEY = "ball-arena-save";

export const EXPLOSIONS = [
  { id: "pop_classic", name: "Classic Pop", color: "#ff5a36" },
  { id: "confetti", name: "Confetti Burst", color: "#f5b942" },
  { id: "ink", name: "Ink Splash", color: "#1c2430" },
  { id: "aurora", name: "Aurora Ring", color: "#79c7ff" },
];

export const FLYERS = [
  { id: "straight", name: "Straight Shot", color: "#ffffff" },
  { id: "spiral", name: "Spiral Flyer", color: "#5b8cff" },
  { id: "comet", name: "Comet Streak", color: "#ffd23f" },
  { id: "boomer", name: "Arc Return", color: "#3ecf8e" },
];

export function todayKey(now = new Date()): string {
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

export function weekKey(now = new Date()): string {
  const start = new Date(Date.UTC(now.getFullYear(), 0, 1));
  const diff = now.getTime() - start.getTime();
  const week = Math.floor(diff / 604800000) + 1;
  return `${now.getFullYear()}-W${week}`;
}

function langOf(): Lang {
  const nav = typeof navigator === "undefined" ? "en" : navigator.language.toLowerCase();
  return nav.startsWith("uz") ? "uz" : nav.startsWith("ru") ? "ru" : "en";
}

export function defaultAvatar(): AvatarLook {
  return {
    skin: "#f3c7a1",
    shirt: "#ff5a36",
    pants: "#243044",
    hat: "#1c2430",
    hatStyle: "cap",
    face: "focus",
    back: "cape",
    emote: "idle",
    frame: "iron",
    title: "Rookie",
  };
}

export function defaultSave(): Save {
  return {
    v: 2,
    coins: CONFIG.starterCoins,
    diamonds: CONFIG.starterDiamonds,
    adminInfiniteCoins: false,
    adminInfiniteDiamonds: false,
    fragments: 0,
    xp: 0,
    owned: [...CONFIG.starterBalls],
    explosions: ["pop_classic"],
    flyers: ["straight"],
    explosion: "pop_classic",
    flyer: "straight",
    avatar: defaultAvatar(),
    settings: {
      lang: langOf(),
      sound: true,
      haptics: true,
      quality: "auto",
      leftHanded: false,
      master: 0.8,
      music: 0.45,
      sfx: 0.8,
      colorblind: false,
      reduceMotion: false,
    },
    dailyDay: "",
    streak: 0,
    questDay: todayKey(),
    questPlay: 0,
    questWin: 0,
    questRounds: 0,
    questClaimed: [false, false, false],
    matches: 0,
    wins: 0,
    packsEnabled: null,
    username: "Guest",
    country: "UZ",
    favorites: CONFIG.starterBalls.slice(0, 3),
    ballLevel: {},
    trophies: 0,
    bestStreak: 0,
    winStreak: 0,
    damageDealt: 0,
    playSeconds: 0,
    history: [],
    achievements: {},
    dailyClaimedOn: "",
    dailyIndex: 0,
    streakTokens: 1,
    passXp: 0,
    passPremium: false,
    passClaimedFree: [],
    passClaimedPrem: [],
    pity: 0,
    epicPity: 0,
    pulls: 0,
    boostUntil: 0,
    boostKind: "",
    rerollTokens: 1,
    proPass: false,
    cosmetics: ["frame_iron", "title_rookie", "trail_straight", "boom_pop_classic"],
    outfitSlots: [defaultAvatar(), defaultAvatar(), defaultAvatar()],
    activeOutfit: 0,
    friends: [],
    fulfilledOrders: [],
    firstPurchase: {},
    weeklyKey: weekKey(),
    weeklyPlay: 0,
    weeklyClaimed: false,
    crafts: 0,
    guestPrompted: false,
    joinedAt: Date.now(),
    seasonId: "neon-colosseum-1",
  };
}

function strList(v: unknown, fallback: string[]): string[] {
  if (!Array.isArray(v)) return fallback;
  const out = v.filter((x) => typeof x === "string");
  return out.length ? out : fallback;
}

function num(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

/** v1 saves keep every economy field. Unknown future blobs still keep what we recognize. */
export function migrateSave(raw: unknown): Save {
  const base = defaultSave();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Partial<Save> & { settings?: Partial<SaveSettings>; avatar?: Partial<AvatarLook> };
  const owned = strList(o.owned, base.owned);
  const history = Array.isArray(o.history)
    ? o.history.filter((row) => row && typeof row === "object" && typeof (row as MatchRecord).id === "string").slice(0, 20) as MatchRecord[]
    : [];
  const quest = Array.isArray(o.questClaimed) && o.questClaimed.length === 3
    ? [Boolean(o.questClaimed[0]), Boolean(o.questClaimed[1]), Boolean(o.questClaimed[2])] as [boolean, boolean, boolean]
    : base.questClaimed;
  return {
    ...base,
    ...o,
    v: 2,
    coins: Math.max(0, num(o.coins, base.coins)),
    diamonds: Math.max(0, num(o.diamonds, base.diamonds)),
    adminInfiniteCoins: bool(o.adminInfiniteCoins, false),
    adminInfiniteDiamonds: bool(o.adminInfiniteDiamonds, false),
    fragments: Math.max(0, num(o.fragments, base.fragments)),
    xp: Math.max(0, num(o.xp, base.xp)),
    owned,
    explosions: strList(o.explosions, base.explosions),
    flyers: strList(o.flyers, base.flyers),
    explosion: typeof o.explosion === "string" ? o.explosion : base.explosion,
    flyer: typeof o.flyer === "string" ? o.flyer : base.flyer,
    avatar: { ...base.avatar, ...(o.avatar ?? {}) },
    settings: { ...base.settings, ...(o.settings ?? {}) },
    streak: Math.max(0, num(o.streak, 0)),
    questPlay: Math.max(0, num(o.questPlay, 0)),
    questWin: Math.max(0, num(o.questWin, 0)),
    questRounds: Math.max(0, num(o.questRounds, 0)),
    questClaimed: quest,
    matches: Math.max(0, num(o.matches, 0)),
    wins: Math.max(0, num(o.wins, 0)),
    packsEnabled: Array.isArray(o.packsEnabled) ? o.packsEnabled.filter((x) => typeof x === "string") : null,
    username: typeof o.username === "string" && o.username.trim() ? o.username.slice(0, 16) : base.username,
    country: typeof o.country === "string" ? o.country.slice(0, 2).toUpperCase() : base.country,
    favorites: strList(o.favorites, owned.slice(0, 3)).slice(0, 3),
    ballLevel: o.ballLevel && typeof o.ballLevel === "object" ? o.ballLevel : {},
    trophies: Math.max(0, num(o.trophies, 0)),
    bestStreak: Math.max(0, num(o.bestStreak, 0)),
    winStreak: Math.max(0, num(o.winStreak, 0)),
    damageDealt: Math.max(0, num(o.damageDealt, 0)),
    playSeconds: Math.max(0, num(o.playSeconds, 0)),
    history,
    achievements: o.achievements && typeof o.achievements === "object" ? o.achievements : {},
    dailyIndex: Math.max(0, Math.min(6, num(o.dailyIndex, 0))),
    streakTokens: Math.max(0, num(o.streakTokens, base.streakTokens)),
    passXp: Math.max(0, num(o.passXp, 0)),
    passPremium: bool(o.passPremium, false),
    passClaimedFree: Array.isArray(o.passClaimedFree) ? o.passClaimedFree.filter((n) => typeof n === "number") : [],
    passClaimedPrem: Array.isArray(o.passClaimedPrem) ? o.passClaimedPrem.filter((n) => typeof n === "number") : [],
    pity: Math.max(0, num(o.pity, 0)),
    epicPity: Math.max(0, num(o.epicPity, 0)),
    pulls: Math.max(0, num(o.pulls, 0)),
    boostUntil: Math.max(0, num(o.boostUntil, 0)),
    boostKind: o.boostKind === "xp" || o.boostKind === "coin" || o.boostKind === "both" ? o.boostKind : "",
    rerollTokens: Math.max(0, num(o.rerollTokens, base.rerollTokens)),
    proPass: bool(o.proPass, false),
    cosmetics: strList(o.cosmetics, base.cosmetics),
    outfitSlots: Array.isArray(o.outfitSlots) && o.outfitSlots.length
      ? o.outfitSlots.slice(0, 3).map((slot) => ({ ...base.avatar, ...slot }))
      : base.outfitSlots,
    friends: Array.isArray(o.friends) ? o.friends.filter((f) => f && typeof f.name === "string").slice(0, 40) : [],
    fulfilledOrders: strList(o.fulfilledOrders, []).slice(-200),
    firstPurchase: o.firstPurchase && typeof o.firstPurchase === "object" ? o.firstPurchase : {},
    weeklyPlay: Math.max(0, num(o.weeklyPlay, 0)),
    weeklyClaimed: bool(o.weeklyClaimed, false),
    crafts: Math.max(0, num(o.crafts, 0)),
    guestPrompted: bool(o.guestPrompted, false),
    joinedAt: num(o.joinedAt, base.joinedAt),
    seasonId: typeof o.seasonId === "string" ? o.seasonId : base.seasonId,
    questDay: typeof o.questDay === "string" ? o.questDay : base.questDay,
    dailyClaimedOn: typeof o.dailyClaimedOn === "string" ? o.dailyClaimedOn : "",
    weeklyKey: typeof o.weeklyKey === "string" ? o.weeklyKey : base.weeklyKey,
  };
}

export function loadSave(): Save {
  try {
    const text = localStorage.getItem(KEY);
    if (!text) return defaultSave();
    return migrateSave(JSON.parse(text));
  } catch {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    return defaultSave();
  }
}

export function writeSave(save: Save): void {
  save.v = 2;
  const day = todayKey();
  if (save.questDay !== day) {
    save.questDay = day;
    save.questPlay = 0;
    save.questWin = 0;
    save.questRounds = 0;
    save.questClaimed = [false, false, false];
  }
  const week = weekKey();
  if (save.weeklyKey !== week) {
    save.weeklyKey = week;
    save.weeklyPlay = 0;
    save.weeklyClaimed = false;
  }
  localStorage.setItem(KEY, JSON.stringify(save));
}

export function levelOf(save: Save): number {
  return levelFromXp(save.xp);
}

export { todayKey as today };
