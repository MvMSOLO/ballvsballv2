export type CredentialMode = "sign-in" | "sign-up";

const INTERNAL_ORIGIN = "https://ball-arena.invalid";
const AUTH_ROUTE_PATHS = new Set(["/login", "/auth/popup"]);

export type CredentialInput = {
  mode: CredentialMode;
  email: string;
  password: string;
  username?: string;
};

/** Accept only a same-origin app path; never allow OAuth to redirect off-site or loop back to login. */
export function resolveAuthReturnTo(value: unknown): string {
  if (typeof value !== "string") return "/";
  const candidate = value.trim();
  if (
    !candidate ||
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.startsWith("/\\") ||
    candidate.includes("\\")
  ) return "/";

  try {
    const target = new URL(candidate, INTERNAL_ORIGIN);
    if (target.origin !== INTERNAL_ORIGIN) return "/";
    if (
      AUTH_ROUTE_PATHS.has(target.pathname) ||
      target.pathname === "/api/auth" ||
      target.pathname.startsWith("/api/auth/")
    ) return "/";
    return target.pathname + target.search + target.hash;
  } catch {
    return "/";
  }
}

/** A friendly destination label for the post-auth hand-off. */
export function authReturnLabel(value: unknown): string {
  const safe = resolveAuthReturnTo(value);
  const path = new URL(safe, INTERNAL_ORIGIN).pathname;
  const labels: Record<string, string> = {
    "/": "the arena",
    "/profile": "your profile",
    "/shop": "the ball market",
    "/inventory": "your collection",
    "/leaderboard": "the rankings",
    "/settings": "game settings",
    "/admin": "the owner control center",
  };
  return labels[path] ?? "your requested page";
}

/** Validate client-side for clear feedback; the auth server remains authoritative. */
export function validateCredentialInput(input: CredentialInput): string | null {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
    return "Enter a valid email address.";
  }
  if (input.password.length < 8) {
    return "Password must be at least 8 characters.";
  }
  if (input.mode === "sign-up" && !/^[A-Za-z0-9_]{3,16}$/.test(input.username?.trim() ?? "")) {
    return "Username must be 3–16 characters using letters, numbers, or underscores.";
  }
  return null;
}

/** Translate common Better Auth errors without showing raw server internals to players. */
export function friendlyCredentialError(error: unknown, mode: CredentialMode): string {
  const candidate =
    typeof error === "string" ? error :
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : "";
  const message = candidate.toLowerCase();

  if (/invalid[_ -]?credentials?|invalid[_ -]?email[_ -]?(or[_ -]?)?password|invalid email or password|incorrect password|wrong password/.test(message)) {
    return "That email and password combination was not recognized. Check both and try again.";
  }
  if (/already exists|user_exists|email.*taken|duplicate/.test(message)) {
    return "An account may already use that email. Try signing in instead.";
  }
  if (/invalid[_ -]?email|email.*invalid/.test(message)) {
    return "Check the email address and try again.";
  }
  if (/password.*(short|length|minimum)|too short/.test(message)) {
    return "Choose a password with at least 8 characters.";
  }
  if (/invalid origin|trusted origin/.test(message)) {
    return "This sign-in request was rejected by the security check. Refresh the page and retry.";
  }
  if (/failed to fetch|network|timeout|fetch failed/.test(message)) {
    return "The sign-in service could not be reached. Check your connection and retry.";
  }
  return mode === "sign-up"
    ? "Account creation could not be completed. Check the details and try again."
    : "Sign-in could not be completed. Check your details and try again.";
}

/** Keep OAuth failures actionable, while avoiding raw provider responses in the UI. */
export function friendlyProviderError(error: unknown): string {
  const candidate =
    typeof error === "string" ? error :
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : "";
  const message = candidate.toLowerCase();

  if (/pop.?up blocked/.test(message)) return "Allow sign-in pop-ups for this site, then try again.";
  if (/cancelled|canceled/.test(message)) return "Sign-in was cancelled. You can retry or choose another method.";
  if (/not configured|not available|unavailable/.test(message)) return "This sign-in provider is not configured here. Choose another available method.";
  if (/failed to fetch|network|timeout/.test(message)) return "The sign-in provider could not be reached. Check your connection and retry.";
  return "This sign-in provider could not complete the request. Try again or use another available method.";
}
