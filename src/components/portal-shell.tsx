import type { ReactNode } from "react";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { PLAYER_HUB_NAV, canAccessOwnerTools } from "@/lib/player-navigation";

const AUTH_RETURN_PATHS: Record<string, string> = Object.fromEntries(
  PLAYER_HUB_NAV.map((item) => [item.key, item.href]),
);

export function PortalShell({ active, title, description, children }: {
  active: string; title: string; description: string; children: ReactNode;
}) {
  const { user, isPending } = useCurrentUserState();
  const signInHref = "/login?callbackURL=" + encodeURIComponent(AUTH_RETURN_PATHS[active] ?? "/");
  return <main className="portal-page">
    <div className="portal-ambient" aria-hidden="true" />
    <header className="portal-topbar">
      <a href="/" className="portal-brand" aria-label="BALL ARENA home">
        <img className="portal-brand-wordmark" src="/brand/ball-arena-wordmark.svg" alt="BALL ARENA — Physics Duel League" />
      </a>
      <nav className="portal-nav" aria-label="Main navigation">
        {PLAYER_HUB_NAV.map((item) => <a key={item.key} href={item.href} title={item.title} className={"portal-nav-link" + (active === item.key ? " active" : "")} aria-current={active === item.key ? "page" : undefined}>{item.label}</a>)}
        {!isPending && canAccessOwnerTools(user) && <a href="/admin" className={"portal-nav-link portal-admin-nav" + (active === "admin" ? " active" : "")} aria-current={active === "admin" ? "page" : undefined}>ADMIN</a>}
      </nav>
      <div className="portal-session">
        {isPending ? <span className="portal-session-state">CHECKING SESSION…</span> : user ? <div className="portal-account"><UserButton /></div> : <a className="portal-signin" href={signInHref}>SIGN IN ↗</a>}
      </div>
    </header>
    <section className="portal-content">
      <a href="/" className="portal-back">← BACK TO ARENA</a>
      <div className="portal-page-heading"><span className="portal-kicker">PLAYER HUB / {active.toUpperCase()}</span><h1>{title}</h1><p>{description}</p></div>
      {children}
      <footer className="portal-footer"><span><i className="status-dot" /> ARENA SYSTEM ONLINE</span><span>PROGRESS SAVES ON THIS DEVICE</span></footer>
    </section>
  </main>;
}
