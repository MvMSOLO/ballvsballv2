/** Shared player-hub route definitions. Keep the arena and portal navigation in sync. */
export const PLAYER_HUB_NAV = [
  { href: "/profile", title: "Profile", label: "PROFILE", key: "profile", icon: "profile" },
  { href: "/shop", title: "Shop", label: "SHOP", key: "shop", icon: "shop" },
  { href: "/inventory", title: "Inventory", label: "INVENTORY", key: "inventory", icon: "inventory" },
  { href: "/leaderboard", title: "Leaderboard", label: "RANKS", key: "leaderboard", icon: "ranks" },
  { href: "/settings", title: "Settings", label: "SETTINGS", key: "settings", icon: "settings" },
] as const;

export const OWNER_ACCOUNT_EMAIL = "mirzayevavazbek15@gmail.com";

export type OwnerAccessCandidate = {
  primaryEmail?: string | null;
  emailVerified?: boolean;
  isDevFallback?: boolean;
} | null | undefined;

/** Client-side visibility/route gate only; sensitive operations still verify the owner in server code. */
export function canAccessOwnerTools(user: OwnerAccessCandidate): boolean {
  return Boolean(
    user &&
      !user.isDevFallback &&
      user.emailVerified === true &&
      user.primaryEmail?.trim().toLowerCase() === OWNER_ACCOUNT_EMAIL,
  );
}
