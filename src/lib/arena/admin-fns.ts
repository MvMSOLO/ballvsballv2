import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { defaultSave, migrateSave, type Save } from "@/economy/save";
import { allPacks } from "@/packs/registry";

const OWNER_EMAIL = "mirzayevavazbek15@gmail.com";
const INFINITE_BALANCE = 2_000_000_000;
type Db = Awaited<ReturnType<typeof getDb>>;

type Control = {
  is_banned: boolean;
  ban_reason: string;
  infinite_coins: boolean;
  infinite_diamonds: boolean;
  coins_before_infinite: number | null;
  diamonds_before_infinite: number | null;
};

async function getDb() {
  const { getSql } = await import("@/lib/db");
  return getSql();
}

async function assertOwner(db: Db, userId: string): Promise<string> {
  const rows = await db.query<{ email: string; email_verified: boolean }>(
    'select email, "emailVerified" as email_verified from "user" where id = $1 limit 1',
    [userId],
  );
  const email = rows[0]?.email?.trim().toLowerCase() ?? "";
  if (!rows[0]?.email_verified || email !== OWNER_EMAIL) {
    throw new Error("Forbidden: the verified owner account is required.");
  }
  return email;
}

async function getControl(db: Db, userId: string): Promise<Control> {
  const rows = await db.query<Control>(
    "select is_banned, ban_reason, infinite_coins, infinite_diamonds, coins_before_infinite, diamonds_before_infinite " +
      "from player_admin_controls where user_id = $1 limit 1",
    [userId],
  );
  return rows[0] ?? {
    is_banned: false,
    ban_reason: "",
    infinite_coins: false,
    infinite_diamonds: false,
    coins_before_infinite: null,
    diamonds_before_infinite: null,
  };
}

function parseSave(blob?: string | null): Save {
  if (!blob) return defaultSave();
  try {
    return migrateSave(JSON.parse(blob));
  } catch {
    return defaultSave();
  }
}

async function applyCurrencyFlags(db: Db, userId: string, input: Save): Promise<Save> {
  const control = await getControl(db, userId);
  return {
    ...input,
    adminInfiniteCoins: control.infinite_coins,
    adminInfiniteDiamonds: control.infinite_diamonds,
    coins: control.infinite_coins ? INFINITE_BALANCE : input.coins,
    diamonds: control.infinite_diamonds ? INFINITE_BALANCE : input.diamonds,
  };
}

function storedName(name: string, userId: string): string {
  if (/^[a-zA-Z0-9_]{3,16}$/.test(name) && name.toLowerCase() !== "guest") return name;
  const compact = userId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10);
  return `g_${compact || "player"}`.slice(0, 16);
}

async function persistSave(db: Db, userId: string, input: Save): Promise<Save> {
  const save = await applyCurrencyFlags(db, userId, input);
  const blob = JSON.stringify(save);
  await db.query(
    "insert into saves (user_id, version, blob, coins, diamonds, xp) values ($1, $2, $3, $4, $5, $6) " +
      "on conflict (user_id) do update set version = excluded.version, blob = excluded.blob, " +
      "coins = excluded.coins, diamonds = excluded.diamonds, xp = excluded.xp, updated_at = now()",
    [userId, save.v, blob, save.coins, save.diamonds, save.xp],
  );
  const publicName = storedName(save.username, userId);
  const level = Math.max(1, Math.floor(Math.sqrt(save.xp / 40)) + 1);
  await db.query(
    "insert into profiles (user_id, username, country, title, trophies, level, favorite) values ($1, $2, $3, $4, $5, $6, $7) " +
      "on conflict (user_id) do update set username = excluded.username, country = excluded.country, title = excluded.title, " +
      "trophies = excluded.trophies, level = excluded.level, favorite = excluded.favorite, updated_at = now()",
    [userId, publicName, save.country, save.avatar.title, save.trophies, level, save.favorites[0] ?? ""],
  );
  await db.query(
    "insert into leaderboard (user_id, username, country, trophies, favorite) values ($1, $2, $3, $4, $5) " +
      "on conflict (user_id) do update set username = excluded.username, country = excluded.country, " +
      "trophies = excluded.trophies, favorite = excluded.favorite, updated_at = now()",
    [userId, publicName, save.country, save.trophies, save.favorites[0] ?? ""],
  );
  return save;
}

async function logAction(db: Db, actorId: string, targetId: string, action: string, summary: string) {
  const id = `adm-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  await db.query(
    "insert into admin_action_log (id, actor_user_id, target_user_id, action, details) values ($1, $2, $3, $4, $5::jsonb)",
    [id, actorId, targetId, action, JSON.stringify({ summary })],
  );
}

function getBallCatalog() {
  const seen = new Set<string>();
  return allPacks()
    .flatMap((pack) => pack.balls.map((ball) => ({
      id: ball.id,
      name: ball.name.en,
      rarity: ball.rarity,
    })))
    .filter((ball) => {
      if (seen.has(ball.id)) return false;
      seen.add(ball.id);
      return true;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

const overviewInput = z.object({ query: z.string().trim().max(80).default("") });

export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => overviewInput.parse(input ?? {}))
  .handler(async ({ context, data }) => {
    const db = await getDb();
    const email = await assertOwner(db, context.userId);
    const query = data.query.trim();
    const pattern = `%${query}%`;
    const statsRows = await db.query<{
      total_users: number;
      banned_users: number;
      active_sessions: number;
      saved_players: number;
    }>(
      "select count(u.id)::int as total_users, " +
        "sum(case when coalesce(c.is_banned, false) then 1 else 0 end)::int as banned_users, " +
        "(select count(*)::int from \"session\" where \"expiresAt\" > now()) as active_sessions, " +
        "(select count(*)::int from saves) as saved_players " +
        "from \"user\" u left join player_admin_controls c on c.user_id = u.id",
    );
    const playerRows = await db.query<{
      id: string; name: string; email: string; email_verified: boolean; username: string; country: string;
      trophies: number; level: number; coins: number; diamonds: number; xp: number; balls_owned: number;
      is_banned: boolean; ban_reason: string; infinite_coins: boolean; infinite_diamonds: boolean; active_sessions: number;
    }>(
      "select u.id, u.name, u.email, u.\"emailVerified\" as email_verified, coalesce(p.username, '') as username, " +
        "coalesce(p.country, 'UZ') as country, coalesce(p.trophies, 0)::int as trophies, coalesce(p.level, 1)::int as level, " +
        "coalesce(s.coins, 0)::int as coins, coalesce(s.diamonds, 0)::int as diamonds, coalesce(s.xp, 0)::int as xp, " +
        "coalesce(c.is_banned, false) as is_banned, coalesce(c.ban_reason, '') as ban_reason, " +
        "coalesce(c.infinite_coins, false) as infinite_coins, coalesce(c.infinite_diamonds, false) as infinite_diamonds, " +
        "(select count(*)::int from \"session\" ss where ss.\"userId\" = u.id and ss.\"expiresAt\" > now()) as active_sessions, " +
        "case when s.blob is null then 0 else coalesce(jsonb_array_length((s.blob::jsonb)->'owned'), 0)::int end as balls_owned " +
        "from \"user\" u left join profiles p on p.user_id = u.id left join saves s on s.user_id = u.id " +
        "left join player_admin_controls c on c.user_id = u.id " +
        "where ($1 = '' or u.email ilike $2 or u.name ilike $2 or coalesce(p.username, '') ilike $2 or u.id ilike $2) " +
        "order by coalesce(s.updated_at, u.\"createdAt\") desc nulls last, u.email asc limit 100",
      [query, pattern],
    );
    const logs = await db.query<{
      id: string; action: string; summary: string; created_at: string; actor_email: string; target_email: string;
    }>(
      "select l.id, l.action, coalesce(l.details->>'summary', l.action) as summary, l.created_at, " +
        "coalesce(a.email, 'deleted account') as actor_email, coalesce(t.email, 'deleted account') as target_email " +
        "from admin_action_log l left join \"user\" a on a.id = l.actor_user_id " +
        "left join \"user\" t on t.id = l.target_user_id order by l.created_at desc limit 20",
    );
    return {
      viewerEmail: email,
      stats: statsRows[0] ?? { total_users: 0, banned_users: 0, active_sessions: 0, saved_players: 0 },
      players: playerRows,
      balls: getBallCatalog(),
      activity: logs,
    };
  });

const actionSchema = z.object({
  targetUserId: z.string().trim().min(1).max(200),
  action: z.enum([
    "kick", "ban", "unban", "toggle_inf_coins", "toggle_inf_diamonds",
    "grant_ball", "remove_ball", "grant_all_balls", "set_trophies", "set_xp",
    "grant_premium", "revoke_premium", "grant_vip_frame", "grant_admin_frame",
    "revoke_vip_frame", "revoke_admin_frame", "reset_progress",
  ]),
  reason: z.string().trim().max(300).optional().default(""),
  ballId: z.string().trim().min(1).max(80).optional(),
  amount: z.number().int().min(0).max(10_000_000).optional(),
});

export const performAdminAction = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => actionSchema.parse(input))
  .handler(async ({ context, data }) => {
    const db = await getDb();
    await assertOwner(db, context.userId);
    if (context.userId === data.targetUserId) throw new Error("For safety, the owner account cannot be moderated here.");
    const targetRows = await db.query<{ id: string; email: string; email_verified: boolean }>(
      'select id, email, "emailVerified" as email_verified from "user" where id = $1 limit 1',
      [data.targetUserId],
    );
    const target = targetRows[0];
    if (!target) throw new Error("Player account not found.");
    if (target.email.trim().toLowerCase() === OWNER_EMAIL && target.email_verified) {
      throw new Error("The verified owner account is protected from moderation actions.");
    }

    const control = await getControl(db, target.id);
    const saveRows = await db.query<{ blob: string; coins: number; diamonds: number }>(
      "select blob, coins, diamonds from saves where user_id = $1 limit 1",
      [target.id],
    );
    const current = await applyCurrencyFlags(db, target.id, parseSave(saveRows[0]?.blob));
    const catalog = getBallCatalog();
    let summary = "";
    let updatedSave: Save | null = null;

    switch (data.action) {
      case "kick": {
        await db.query(
          "insert into player_admin_controls (user_id, kicked_at, kicked_by) values ($1, now(), $2) " +
            "on conflict (user_id) do update set kicked_at = now(), kicked_by = $2, updated_at = now()",
          [target.id, context.userId],
        );
        await db.query('delete from "session" where "userId" = $1', [target.id]);
        summary = "KICK: revoked all active sign-in sessions.";
        break;
      }
      case "ban": {
        const reason = data.reason || "No reason provided.";
        await db.query(
          "insert into player_admin_controls (user_id, is_banned, ban_reason, banned_at, banned_by) " +
            "values ($1, true, $2, now(), $3) on conflict (user_id) do update set is_banned = true, " +
            "ban_reason = $2, banned_at = now(), banned_by = $3, updated_at = now()",
          [target.id, reason, context.userId],
        );
        await db.query('delete from "session" where "userId" = $1', [target.id]);
        summary = `BANNED: ${reason}`;
        break;
      }
      case "unban": {
        await db.query(
          "insert into player_admin_controls (user_id, is_banned, ban_reason) values ($1, false, '') " +
            "on conflict (user_id) do update set is_banned = false, ban_reason = '', banned_at = null, banned_by = null, updated_at = now()",
          [target.id],
        );
        summary = "UNBAN: account access restored; the player may need to sign in again.";
        break;
      }
      case "toggle_inf_coins": {
        const enabled = !control.infinite_coins;
        if (enabled) {
          await db.query(
            "insert into player_admin_controls (user_id, infinite_coins, coins_before_infinite) values ($1, true, $2) " +
              "on conflict (user_id) do update set infinite_coins = true, " +
              "coins_before_infinite = coalesce(player_admin_controls.coins_before_infinite, excluded.coins_before_infinite), updated_at = now()",
            [target.id, saveRows[0]?.coins ?? current.coins],
          );
          updatedSave = { ...current, coins: INFINITE_BALANCE, adminInfiniteCoins: true };
        } else {
          await db.query(
            "update player_admin_controls set infinite_coins = false, coins_before_infinite = null, updated_at = now() where user_id = $1",
            [target.id],
          );
          updatedSave = {
            ...current,
            coins: Math.max(0, control.coins_before_infinite ?? current.coins),
            adminInfiniteCoins: false,
          };
        }
        summary = `INF COINS ${enabled ? "enabled" : "disabled"}.`;
        break;
      }
      case "toggle_inf_diamonds": {
        const enabled = !control.infinite_diamonds;
        if (enabled) {
          await db.query(
            "insert into player_admin_controls (user_id, infinite_diamonds, diamonds_before_infinite) values ($1, true, $2) " +
              "on conflict (user_id) do update set infinite_diamonds = true, " +
              "diamonds_before_infinite = coalesce(player_admin_controls.diamonds_before_infinite, excluded.diamonds_before_infinite), updated_at = now()",
            [target.id, saveRows[0]?.diamonds ?? current.diamonds],
          );
          updatedSave = { ...current, diamonds: INFINITE_BALANCE, adminInfiniteDiamonds: true };
        } else {
          await db.query(
            "update player_admin_controls set infinite_diamonds = false, diamonds_before_infinite = null, updated_at = now() where user_id = $1",
            [target.id],
          );
          updatedSave = {
            ...current,
            diamonds: Math.max(0, control.diamonds_before_infinite ?? current.diamonds),
            adminInfiniteDiamonds: false,
          };
        }
        summary = `INF DIAMONDS ${enabled ? "enabled" : "disabled"}.`;
        break;
      }
      case "grant_ball":
      case "remove_ball": {
        const ball = catalog.find((item) => item.id === data.ballId);
        if (!ball) throw new Error("Choose a valid ball from the catalog.");
        if (data.action === "grant_ball") {
          updatedSave = { ...current, owned: Array.from(new Set([...current.owned, ball.id])) };
          summary = `Granted ball: ${ball.name}.`;
        } else {
          const owned = current.owned.filter((id) => id !== ball.id);
          updatedSave = {
            ...current,
            owned: owned.length ? owned : defaultSave().owned,
            favorites: current.favorites.filter((id) => id !== ball.id),
            ballLevel: Object.fromEntries(Object.entries(current.ballLevel).filter(([id]) => id !== ball.id)),
          };
          summary = `Removed ball: ${ball.name}.`;
        }
        break;
      }
      case "grant_all_balls": {
        updatedSave = { ...current, owned: Array.from(new Set([...current.owned, ...catalog.map((item) => item.id)])) };
        summary = `Granted all ${catalog.length} catalog balls.`;
        break;
      }
      case "set_trophies": {
        if (data.amount === undefined || data.amount > 100_000) throw new Error("Trophies must be between 0 and 100,000.");
        updatedSave = { ...current, trophies: data.amount };
        summary = `Set trophies to ${data.amount.toLocaleString()}.`;
        break;
      }
      case "set_xp": {
        if (data.amount === undefined) throw new Error("Enter an XP amount.");
        updatedSave = { ...current, xp: data.amount };
        summary = `Set XP to ${data.amount.toLocaleString()}.`;
        break;
      }
      case "grant_premium": {
        updatedSave = {
          ...current, passPremium: true, proPass: true,
          cosmetics: Array.from(new Set([...current.cosmetics, "pass_premium"])),
        };
        summary = "Granted Premium Pass and Pro Pass access.";
        break;
      }
      case "revoke_premium": {
        updatedSave = {
          ...current, passPremium: false, proPass: false,
          cosmetics: current.cosmetics.filter((item) => item !== "pass_premium"),
        };
        summary = "Revoked Premium Pass and Pro Pass access.";
        break;
      }
      case "grant_vip_frame":
      case "grant_admin_frame": {
        const badgeId = data.action === "grant_vip_frame" ? "vip" : "admin";
        await db.query(
          "insert into profile_badges (user_id, badge_id, grant_source) values ($1, $2, 'admin') " +
            "on conflict (user_id, badge_id) do nothing",
          [target.id, badgeId],
        );
        summary = `Granted ${badgeId.toUpperCase()} profile frame.`;
        break;
      }
      case "revoke_vip_frame":
      case "revoke_admin_frame": {
        const badgeId = data.action === "revoke_vip_frame" ? "vip" : "admin";
        await db.query("delete from profile_badges where user_id = $1 and badge_id = $2", [target.id, badgeId]);
        summary = `Revoked ${badgeId.toUpperCase()} profile frame.`;
        break;
      }
      case "reset_progress": {
        await db.query("delete from matches where user_id = $1", [target.id]);
        await db.query("delete from friends where user_id = $1", [target.id]);
        await db.query("delete from leaderboard where user_id = $1", [target.id]);
        await db.query("delete from profiles where user_id = $1", [target.id]);
        const reset = defaultSave();
        reset.username = current.username;
        reset.country = current.country;
        reset.joinedAt = current.joinedAt;
        updatedSave = reset;
        summary = "Reset game progress to starter state; account, moderation state, receipts and claims were retained.";
        break;
      }
    }

    if (updatedSave) await persistSave(db, target.id, updatedSave);
    await logAction(db, context.userId, target.id, data.action, summary);
    return { ok: true as const, message: summary };
  });
