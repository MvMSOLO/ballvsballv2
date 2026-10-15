import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { buyOwnedBall, computeRewards, fulfillOrder, mergeCloud } from "../../economy/logic";
import { defaultSave, migrateSave, type Save } from "../../economy/save";
import { allPacks } from "../../packs/registry";

const NAME = z.string().regex(/^[a-zA-Z0-9_]{3,16}$/);
const matchSchema = z.object({
  win: z.boolean(),
  heartsLeft: z.number().int().min(0).max(3),
  ranked: z.boolean(),
  opponent: z.string().min(1).max(32),
  ball: z.string().min(1).max(80),
  oppBall: z.string().max(80),
  seed: z.number().int(),
  damage: z.number().min(0).max(8000),
  ballLevel: z.number().int().min(0).max(20),
});

function storedName(name: string, userId: string): string {
  if (/^[a-zA-Z0-9_]{3,16}$/.test(name) && name.toLowerCase() !== "guest") return name;
  const compact = userId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10);
  return `g_${compact || "player"}`.slice(0, 16);
}

const lastMatch = new Map<string, number>();

function readSave(blob: string | null | undefined): Save | null {
  if (!blob) return null;
  try {
    return migrateSave(JSON.parse(blob));
  } catch {
    return null;
  }
}

async function sql() {
  const { getSql } = await import("@/lib/db");
  return getSql();
}

const INFINITE_BALANCE = 2_000_000_000;

/** Currency flags are authoritative in player_admin_controls, never in the client blob. */
async function applyAdminCurrencyFlags(db: Awaited<ReturnType<typeof sql>>, userId: string, input: Save): Promise<Save> {
  const rows = await db.query<{ infinite_coins: boolean; infinite_diamonds: boolean }>(
    "select infinite_coins, infinite_diamonds from player_admin_controls where user_id = $1 limit 1",
    [userId],
  );
  const infiniteCoins = Boolean(rows[0]?.infinite_coins);
  const infiniteDiamonds = Boolean(rows[0]?.infinite_diamonds);
  return {
    ...input,
    adminInfiniteCoins: infiniteCoins,
    adminInfiniteDiamonds: infiniteDiamonds,
    coins: infiniteCoins ? INFINITE_BALANCE : input.coins,
    diamonds: infiniteDiamonds ? INFINITE_BALANCE : input.diamonds,
  };
}

export const syncSave = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const data = z.object({ blob: z.string().max(400_000) }).parse(input);
    return { blob: data.blob };
  })
  .handler(async ({ context, data }) => {
    const db = await sql();
    const incoming = migrateSave(JSON.parse(data.blob));
    const rows = await db<{ blob: string }>`select blob from saves where user_id = ${context.userId}`;
    const prev = readSave(rows[0]?.blob);
    // An admin edit/reset increments this revision. A still-open client tab may
    // carry pre-edit progress; do not let max-merging resurrect removed balls,
    // old XP, or progress that an owner intentionally reset. Return the canonical
    // cloud blob once and let the client hydrate to the new revision.
    const staleAfterAdminEdit = Boolean(prev && incoming.adminRevision < prev.adminRevision);
    let merged = staleAfterAdminEdit ? prev! : mergeCloud(incoming, prev);
    if (prev) {
      if (incoming.coins > prev.coins + 25000) merged = { ...merged, coins: prev.coins };
      if (incoming.diamonds > prev.diamonds + 4000) merged = { ...merged, diamonds: prev.diamonds };
      if (incoming.trophies > prev.trophies + 60) merged = { ...merged, trophies: prev.trophies };
    }
    merged.coins = Math.min(5_000_000, Math.max(0, merged.coins));
    merged.diamonds = Math.min(200_000, Math.max(0, merged.diamonds));
    merged.trophies = Math.min(100_000, Math.max(0, merged.trophies));
    merged = await applyAdminCurrencyFlags(db, context.userId, merged);
    const blob = JSON.stringify(merged);
    await db`
      insert into saves (user_id, version, blob, coins, diamonds, xp)
      values (${context.userId}, ${merged.v}, ${blob}, ${merged.coins}, ${merged.diamonds}, ${merged.xp})
      on conflict (user_id) do update set
        version = excluded.version,
        blob = excluded.blob,
        coins = excluded.coins,
        diamonds = excluded.diamonds,
        xp = excluded.xp,
        updated_at = now()
    `;
    const publicName = storedName(merged.username, context.userId);
    await db`
      insert into profiles (user_id, username, country, title, trophies, level, favorite)
      values (${context.userId}, ${publicName}, ${merged.country}, ${merged.avatar.title}, ${merged.trophies}, ${Math.max(1, Math.floor(Math.sqrt(merged.xp / 40)) + 1)}, ${merged.favorites[0] ?? ""})
      on conflict (user_id) do update set
        username = excluded.username,
        country = excluded.country,
        title = excluded.title,
        trophies = excluded.trophies,
        level = excluded.level,
        favorite = excluded.favorite,
        updated_at = now()
    `;
    await db`
      insert into leaderboard (user_id, username, country, trophies, favorite)
      values (${context.userId}, ${publicName}, ${merged.country}, ${merged.trophies}, ${merged.favorites[0] ?? ""})
      on conflict (user_id) do update set
        username = excluded.username,
        country = excluded.country,
        trophies = excluded.trophies,
        favorite = excluded.favorite,
        updated_at = now()
    `;
    return { blob };
  });

export const recordMatch = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => matchSchema.parse(input))
  .handler(async ({ context, data }) => {
    const now = Date.now();
    const prevAt = lastMatch.get(context.userId) ?? 0;
    if (now - prevAt < 8000) return { ok: false as const, reason: "rate" };
    const db = await sql();
    const rows = await db<{ blob: string }>`select blob from saves where user_id = ${context.userId}`;
    const current = await applyAdminCurrencyFlags(db, context.userId, readSave(rows[0]?.blob) ?? migrateSave({}));
    const reward = computeRewards(data.win, data.heartsLeft, {
      ranked: data.ranked,
      boost: current.boostUntil > now,
      pro: current.proPass,
      ballLevel: data.ballLevel,
    });
    if (Math.abs(reward.coins) > 2000 || Math.abs(reward.trophies) > 40) return { ok: false as const, reason: "cap" };
    const id = `${context.userId}:${data.seed}:${current.matches + 1}`;
    const existing = await db<{ id: string }>`select id from matches where id = ${id} and user_id = ${context.userId}`;
    if (existing.length) return { ok: true as const, duplicate: true, reward };
    let next: Save = {
      ...current,
      coins: current.coins + reward.coins,
      diamonds: current.diamonds + reward.diamonds,
      xp: current.xp + reward.xp,
      passXp: current.passXp + reward.xp,
      trophies: Math.max(0, current.trophies + reward.trophies),
      matches: current.matches + 1,
      wins: current.wins + (data.win ? 1 : 0),
      damageDealt: current.damageDealt + Math.round(data.damage),
    };
    next = await applyAdminCurrencyFlags(db, context.userId, next);
    const blob = JSON.stringify(next);
    await db`
      insert into matches (id, user_id, seed, win, opponent, ball, trophies, coins, xp)
      values (${id}, ${context.userId}, ${data.seed}, ${data.win}, ${data.opponent}, ${data.ball}, ${reward.trophies}, ${reward.coins}, ${reward.xp})
    `;
    await db`
      insert into saves (user_id, version, blob, coins, diamonds, xp)
      values (${context.userId}, ${next.v}, ${blob}, ${next.coins}, ${next.diamonds}, ${next.xp})
      on conflict (user_id) do update set blob = excluded.blob, coins = excluded.coins, diamonds = excluded.diamonds, xp = excluded.xp, updated_at = now()
    `;
    await db`
      insert into leaderboard (user_id, username, country, trophies, favorite)
      values (${context.userId}, ${next.username}, ${next.country}, ${next.trophies}, ${data.ball})
      on conflict (user_id) do update set trophies = excluded.trophies, favorite = excluded.favorite, updated_at = now()
    `;
    lastMatch.set(context.userId, now);
    return { ok: true as const, duplicate: false, reward, blob };
  });

export const fulfillPurchase = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({
    orderId: z.string().min(8).max(80),
    sku: z.string().min(2).max(40),
  }).parse(input))
  .handler(async ({ context, data }) => {
    const db = await sql();
    const seen = await db<{ id: string }>`select id from orders where id = ${data.orderId} and user_id = ${context.userId}`;
    const rows = await db<{ blob: string }>`select blob from saves where user_id = ${context.userId}`;
    const current = await applyAdminCurrencyFlags(db, context.userId, readSave(rows[0]?.blob) ?? migrateSave({}));
    if (seen.length) return { status: "duplicate" as const, blob: JSON.stringify(current) };
    const result = fulfillOrder(current, data.sku, data.orderId);
    if (result.status === "unknown") return { status: "unknown" as const, blob: JSON.stringify(current) };
    const next = await applyAdminCurrencyFlags(db, context.userId, result.save);
    const blob = JSON.stringify(next);
    await db`insert into orders (id, user_id, sku, status) values (${data.orderId}, ${context.userId}, ${data.sku}, ${"test_fulfilled"})`;
    await db`
      insert into saves (user_id, version, blob, coins, diamonds, xp)
      values (${context.userId}, ${next.v}, ${blob}, ${next.coins}, ${next.diamonds}, ${next.xp})
      on conflict (user_id) do update set blob = excluded.blob, coins = excluded.coins, diamonds = excluded.diamonds, xp = excluded.xp, updated_at = now()
    `;
    return { status: result.status, blob };
  });

export const claimKey = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({ key: z.string().min(3).max(80) }).parse(input))
  .handler(async ({ context, data }) => {
    const db = await sql();
    const existing = await db<{ claim_key: string }>`select claim_key from claims where user_id = ${context.userId} and claim_key = ${data.key}`;
    if (existing.length) return { ok: false as const, reason: "duplicate" };
    await db`insert into claims (user_id, claim_key) values (${context.userId}, ${data.key})`;
    return { ok: true as const };
  });

export const leaderboard = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({
    scope: z.enum(["global", "country"]).default("global"),
    country: z.string().max(2).optional(),
    cursor: z.number().int().min(0).max(500).default(0),
  }).parse(input ?? {}))
  .handler(async ({ context, data }) => {
    const db = await sql();
    const country = (data.country ?? "").toUpperCase();
    const rows = data.scope === "country"
      ? await db<{ username: string; country: string; trophies: number; favorite: string }>`
          select username, country, trophies, favorite from leaderboard
          where country = ${country}
          order by trophies desc, username asc
          limit 25 offset ${data.cursor}
        `
      : await db<{ username: string; country: string; trophies: number; favorite: string }>`
          select username, country, trophies, favorite from leaderboard
          order by trophies desc, username asc
          limit 25 offset ${data.cursor}
        `;
    const mine = await db<{ trophies: number; username: string }>`select trophies, username from leaderboard where user_id = ${context.userId}`;
    return { rows, me: mine[0] ?? null };
  });

export const usernameAvailable = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({ username: NAME }).parse(input))
  .handler(async ({ context, data }) => {
    const db = await sql();
    const rows = await db<{ user_id: string }>`select user_id from profiles where lower(username) = lower(${data.username}) and user_id <> ${context.userId}`;
    return { ok: rows.length === 0 };
  });

export const setUsername = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({
    username: NAME,
    country: z.string().min(2).max(2),
  }).parse(input))
  .handler(async ({ context, data }) => {
    const db = await sql();
    const taken = await db<{ user_id: string }>`select user_id from profiles where lower(username) = lower(${data.username}) and user_id <> ${context.userId}`;
    if (taken.length) return { ok: false as const, reason: "taken" };
    await db`
      insert into profiles (user_id, username, country)
      values (${context.userId}, ${data.username}, ${data.country.toUpperCase()})
      on conflict (user_id) do update set username = excluded.username, country = excluded.country, updated_at = now()
    `;
    return { ok: true as const };
  });

export const addFriend = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({ username: NAME }).parse(input))
  .handler(async ({ context, data }) => {
    const db = await sql();
    const found = await db<{ username: string; trophies: number; favorite: string }>`
      select username, trophies, favorite from leaderboard where lower(username) = lower(${data.username}) limit 1
    `;
    if (!found.length) return { ok: false as const, reason: "missing" };
    await db`
      insert into friends (user_id, friend_name) values (${context.userId}, ${found[0].username})
      on conflict (user_id, friend_name) do nothing
    `;
    return { ok: true as const, friend: found[0] };
  });

export const listFriends = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const db = await sql();
    return db<{ friend_name: string }>`select friend_name from friends where user_id = ${context.userId} order by friend_name asc`;
  });

export const publicProfile = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({ username: NAME }).parse(input))
  .handler(async ({ data }) => {
    const db = await sql();
    const rows = await db<{ username: string; country: string; title: string; trophies: number; level: number; favorite: string }>`
      select username, country, title, trophies, level, favorite from profiles where lower(username) = lower(${data.username}) limit 1
    `;
    return rows[0] ?? null;
  });

export const deleteProgress = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const db = await sql();
    const id = context.userId;
    await db`delete from saves where user_id = ${id}`;
    await db`delete from matches where user_id = ${id}`;
    await db`delete from leaderboard where user_id = ${id}`;
    await db`delete from orders where user_id = ${id}`;
    await db`delete from friends where user_id = ${id}`;
    await db`delete from claims where user_id = ${id}`;
    await db`delete from profiles where user_id = ${id}`;
    return { ok: true as const };
  });


/** Read the canonical save for this authenticated player without merging a stale device snapshot. */
export const loadCloudSave = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const db = await sql();
    const rows = await db.query<{ blob: string }>(
      "select blob from saves where user_id = $1",
      [context.userId],
    );
    if (!rows[0]?.blob) return { blob: null };
    const current = readSave(rows[0].blob);
    if (!current) return { blob: rows[0].blob };
    const canonical = await applyAdminCurrencyFlags(db, context.userId, current);
    return { blob: JSON.stringify(canonical) };
  });

/** Purchase one explicitly priced catalog ball using the server's current wallet. */
export const purchaseBall = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({ ballId: z.string().min(1).max(80) }).parse(input))
  .handler(async ({ context, data }) => {
    const db = await sql();
    const rows = await db.query<{ blob: string }>(
      "select blob from saves where user_id = $1",
      [context.userId],
    );
    const current = await applyAdminCurrencyFlags(db, context.userId, readSave(rows[0]?.blob) ?? migrateSave({}));
    const ball = allPacks().flatMap((pack) => pack.balls).find((item) => item.id === data.ballId);
    if (!ball) return { status: "unknown" as const, blob: JSON.stringify(current) };

    const result = buyOwnedBall(current, ball);
    if (result.error) {
      return {
        status: (result.error === "diamonds" ? "diamonds" : "owned") as "diamonds" | "owned",
        blob: JSON.stringify(current),
      };
    }

    const next = await applyAdminCurrencyFlags(db, context.userId, result.save);
    const blob = JSON.stringify(next);
    await db.query(
      "insert into saves (user_id, version, blob, coins, diamonds, xp) values ($1, $2, $3, $4, $5, $6) " +
        "on conflict (user_id) do update set version = excluded.version, blob = excluded.blob, " +
        "coins = excluded.coins, diamonds = excluded.diamonds, xp = excluded.xp, updated_at = now()",
      [context.userId, next.v, blob, next.coins, next.diamonds, next.xp],
    );
    const publicName = storedName(next.username, context.userId);
    const level = Math.max(1, Math.floor(Math.sqrt(next.xp / 40)) + 1);
    await db.query(
      "insert into profiles (user_id, username, country, title, trophies, level, favorite) values ($1, $2, $3, $4, $5, $6, $7) " +
        "on conflict (user_id) do update set username = excluded.username, country = excluded.country, " +
        "title = excluded.title, trophies = excluded.trophies, level = excluded.level, favorite = excluded.favorite, updated_at = now()",
      [context.userId, publicName, next.country, next.avatar.title, next.trophies, level, next.favorites[0] ?? ""],
    );
    await db.query(
      "insert into leaderboard (user_id, username, country, trophies, favorite) values ($1, $2, $3, $4, $5) " +
        "on conflict (user_id) do update set username = excluded.username, country = excluded.country, " +
        "trophies = excluded.trophies, favorite = excluded.favorite, updated_at = now()",
      [context.userId, publicName, next.country, next.trophies, next.favorites[0] ?? ""],
    );
    return { status: "ok" as const, blob };
  });


// ── Account-bound profile frames ─────────────────────────────────────────────
// These are cosmetic entitlements only. The ADMIN frame does not grant app or
// moderation permissions; prices are server-owned and charged from cloud gems.
const PROFILE_BADGE_PRICES = { vip: 80, admin: 280 } as const;
const OWNER_EMAIL = "mirzayevavazbek15@gmail.com";

export const getProfileBadgeState = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const db = await sql();
    const users = await db.query<{ email: string; email_verified: boolean }>(
      'select email, "emailVerified" as email_verified from "user" where id = $1 limit 1',
      [context.userId],
    );
    const ownerClaims = await db.query<{ user_id: string }>(
      "select user_id from owner_badge_claims where claim_id = $1 limit 1",
      ["mvm-owner-frame-v1"],
    );
    const owned = await db.query<{ badge_id: string }>(
      "select badge_id from profile_badges where user_id = $1",
      [context.userId],
    );
    const emailOwner = Boolean(
      users[0]?.email_verified && users[0]?.email?.toLowerCase() === OWNER_EMAIL,
    );
    return {
      vip: owned.some((row) => row.badge_id === "vip"),
      admin: owned.some((row) => row.badge_id === "admin"),
      owner: emailOwner || ownerClaims.some((row) => row.user_id === context.userId),
    };
  });

export const purchaseProfileBadge = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z.object({ badgeId: z.enum(["vip", "admin"]) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const db = await sql();
    const currentEntitlements = await db.query<{ badge_id: string }>(
      "select badge_id from profile_badges where user_id = $1 and badge_id = $2 limit 1",
      [context.userId, data.badgeId],
    );
    if (currentEntitlements.length) {
      const currentRows = await db.query<{ blob: string }>(
        "select blob from saves where user_id = $1 limit 1",
        [context.userId],
      );
      return {
        ok: true as const,
        alreadyOwned: true as const,
        blob: currentRows[0]?.blob ?? "",
      };
    }

    const saves = await db.query<{ blob: string }>(
      "select blob from saves where user_id = $1 limit 1",
      [context.userId],
    );
    if (!saves[0]?.blob) return { ok: false as const, reason: "save" as const };

    const parsedCurrent = readSave(saves[0].blob);
    if (!parsedCurrent) return { ok: false as const, reason: "save" as const };
    const current = await applyAdminCurrencyFlags(db, context.userId, parsedCurrent);
    const price = PROFILE_BADGE_PRICES[data.badgeId];
    if (!current.adminInfiniteDiamonds && current.diamonds < price) return { ok: false as const, reason: "diamonds" as const };

    const next = await applyAdminCurrencyFlags(
      db,
      context.userId,
      current.adminInfiniteDiamonds ? current : { ...current, diamonds: current.diamonds - price },
    );
    const nextBlob = JSON.stringify(next);
    // Optimistic compare-and-update ensures two concurrent requests cannot spend
    // the same wallet snapshot. Entitlement is inserted only if the debit wins.
    const granted = await db.query<{ badge_id: string }>(
      "with debited as (" +
        " update saves set version = $1, blob = $2, coins = $8, diamonds = $3, updated_at = now()" +
        " where user_id = $4 and blob = $5 and diamonds >= $6 returning user_id" +
        ") insert into profile_badges (user_id, badge_id, grant_source)" +
        " select user_id, $7, 'purchase' from debited" +
        " on conflict (user_id, badge_id) do nothing returning badge_id",
      [next.v, nextBlob, next.diamonds, context.userId, saves[0].blob, price, data.badgeId, next.coins],
    );
    if (!granted.length) return { ok: false as const, reason: "race" as const };
    return { ok: true as const, alreadyOwned: false as const, blob: nextBlob };
  });

export const redeemOwnerBadge = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z.object({ code: z.string().trim().min(1).max(80) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const db = await sql();
    const users = await db.query<{ email: string; email_verified: boolean }>(
      'select email, "emailVerified" as email_verified from "user" where id = $1 limit 1',
      [context.userId],
    );
    if (users[0]?.email_verified && users[0]?.email?.toLowerCase() === OWNER_EMAIL) {
      return { ok: true as const, alreadyOwner: true as const };
    }

    // Keep the redeem code out of client bundles and source control. Configure
    // MVM_OWNER_REDEEM_CODE as a Vercel environment variable for production.
    const expectedCode = process.env.MVM_OWNER_REDEEM_CODE?.trim();
    if (!expectedCode) return { ok: false as const, reason: "disabled" as const };
    if (data.code !== expectedCode) return { ok: false as const, reason: "invalid" as const };

    const claimed = await db.query<{ user_id: string }>(
      "select user_id from owner_badge_claims where claim_id = $1 limit 1",
      ["mvm-owner-frame-v1"],
    );
    if (claimed.length) {
      return claimed[0].user_id === context.userId
        ? { ok: true as const, alreadyOwner: true as const }
        : { ok: false as const, reason: "claimed" as const };
    }

    await db.query(
      "insert into owner_badge_claims (claim_id, user_id) values ($1, $2) on conflict (claim_id) do nothing",
      ["mvm-owner-frame-v1", context.userId],
    );
    const verifiedClaim = await db.query<{ user_id: string }>(
      "select user_id from owner_badge_claims where claim_id = $1 limit 1",
      ["mvm-owner-frame-v1"],
    );
    if (verifiedClaim[0]?.user_id !== context.userId) {
      return { ok: false as const, reason: "claimed" as const };
    }
    return { ok: true as const, alreadyOwner: false as const };
  });
