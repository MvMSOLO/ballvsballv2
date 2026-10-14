import { describe, expect, it } from "vitest";
import { CONFIG } from "../src/config";
import { claimAchievement, claimDaily, computeRewards, fulfillOrder, mergeCloud, pullGacha } from "../src/economy/logic";
import { defaultSave, migrateSave } from "../src/economy/save";
import { enabledBalls } from "../src/packs/registry";

describe("v1 save migration", () => {
  it("keeps coins, diamonds, owned balls, avatar, streak and quests", () => {
    const migrated = migrateSave({
      v: 1,
      coins: 777,
      diamonds: 42,
      fragments: 9,
      xp: 400,
      owned: ["web_weaver", "boom_pebble", "lucky_die"],
      explosions: ["pop_classic", "ink"],
      flyers: ["straight"],
      explosion: "ink",
      flyer: "straight",
      avatar: { skin: "#ffffff", shirt: "#111111", pants: "#222222", hat: "#333333" },
      settings: { lang: "uz", sound: false, haptics: true, quality: "low", leftHanded: true },
      dailyDay: "2026-1-2",
      streak: 4,
      questDay: "2026-10-1",
      questPlay: 1,
      questWin: 1,
      questRounds: 2,
      questClaimed: [true, false, false],
      matches: 12,
      wins: 7,
      packsEnabled: null,
    });
    expect(migrated.v).toBe(2);
    expect(migrated.coins).toBe(777);
    expect(migrated.diamonds).toBe(42);
    expect(migrated.fragments).toBe(9);
    expect(migrated.xp).toBe(400);
    expect(migrated.owned).toEqual(["web_weaver", "boom_pebble", "lucky_die"]);
    expect(migrated.avatar.shirt).toBe("#111111");
    expect(migrated.avatar.hatStyle).toBe("cap");
    expect(migrated.settings.lang).toBe("uz");
    expect(migrated.settings.leftHanded).toBe(true);
    expect(migrated.streak).toBe(4);
    expect(migrated.questClaimed).toEqual([true, false, false]);
    expect(migrated.matches).toBe(12);
    expect(migrated.wins).toBe(7);
    expect(migrated.trophies).toBe(0);
  });
});

describe("rewards", () => {
  it("pays the sacred win formula, then boosts and pro on top", () => {
    const plain = computeRewards(true, 2, { ranked: false, boost: false, pro: false, ballLevel: 0 });
    expect(plain.coins).toBe(CONFIG.winCoinsBase + 30);
    expect(plain.xp).toBe(CONFIG.xpWin);
    const boosted = computeRewards(true, 2, { ranked: true, boost: true, pro: true, ballLevel: 10 });
    expect(boosted.coins).toBe(Math.round((CONFIG.winCoinsBase + 30) * 2 * 1.1 * 1.1));
    expect(boosted.trophies).toBe(28);
    expect(computeRewards(false, 0, { ranked: true, boost: false, pro: false, ballLevel: 0 }).trophies).toBe(-18);
  });
});

describe("gacha pity", () => {
  it("guarantees a legendary or mythic on the 40th dry pull", () => {
    const save = defaultSave();
    save.pity = 39;
    save.epicPity = 0;
    const pool = enabledBalls();
    const { pulls } = pullGacha(save, pool, 1, () => 0.99);
    expect(["legendary", "mythic"]).toContain(pulls[0]?.rarity);
  });

  it("guarantees epic or better at 10 dry pulls", () => {
    const save = defaultSave();
    save.epicPity = 9;
    save.pity = 3;
    const { pulls } = pullGacha(save, enabledBalls(), 1, () => 0);
    expect(["epic", "legendary", "mythic"]).toContain(pulls[0]?.rarity);
  });
});

describe("purchase idempotency", () => {
  it("grants a test-mode pack once and doubles the first currency pack", () => {
    const first = fulfillOrder(defaultSave(), "pouch", "order-1");
    expect(first.status).toBe("ok");
    expect(first.save.diamonds).toBe(CONFIG.starterDiamonds + 60);
    const again = fulfillOrder(first.save, "pouch", "order-1");
    expect(again.status).toBe("duplicate");
    expect(again.save.diamonds).toBe(first.save.diamonds);
    const secondSku = fulfillOrder(first.save, "pouch", "order-2");
    expect(secondSku.save.diamonds).toBe(first.save.diamonds + 30);
  });

  it("rejects unknown skus without writing an order", () => {
    const save = defaultSave();
    const result = fulfillOrder(save, "not-a-real-pack", "order-x");
    expect(result.status).toBe("unknown");
    expect(result.save.fulfilledOrders).toEqual([]);
  });
});

describe("claims and cloud merge", () => {
  it("claims an achievement once", () => {
    const save = defaultSave();
    save.matches = 1;
    const claimed = claimAchievement(save, "first_spark");
    expect(claimed.save.coins).toBeGreaterThan(save.coins);
    expect(claimAchievement(claimed.save, "first_spark").error).toBe("claimed");
  });

  it("keeps the larger economy when merging devices", () => {
    const local = defaultSave();
    local.coins = 50;
    local.diamonds = 90;
    local.owned = ["web_weaver"];
    const remote = defaultSave();
    remote.coins = 800;
    remote.diamonds = 10;
    remote.owned = ["boom_pebble"];
    remote.trophies = 400;
    const merged = mergeCloud(local, remote);
    expect(merged.coins).toBe(800);
    expect(merged.diamonds).toBe(90);
    expect(merged.trophies).toBe(400);
    expect(merged.owned.sort()).toEqual(["boom_pebble", "web_weaver"]);
  });

  it("does not double-claim a daily", () => {
    const now = new Date("2026-10-14T12:00:00Z");
    const first = claimDaily(defaultSave(), now);
    expect(first.reward?.coins).toBeGreaterThan(0);
    expect(claimDaily(first.save, now).error).toBe("claimed");
  });
});
