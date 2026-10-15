import type { ReactNode } from "react";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

const OWNER_EMAIL = "mirzayevavazbek15@gmail.com";

const LINKS = [
  { href: "/profile", label: "PROFILE", key: "profile" },
  { href: "/shop", label: "SHOP", key: "shop" },
  { href: "/inventory", label: "INVENTORY", key: "inventory" },
  { href: "/leaderboard", label: "RANKS", key: "leaderboard" },
  { href: "/settings", label: "SETTINGS", key: "settings" },
];

export function PortalShell({ active, title, description, children }: {
  active: string; title: string; description: string; children: ReactNode;
}) {
  const { user, isPending } = useCurrentUserState();
  return <main className="portal-page">
    <div className="portal-ambient" aria-hidden="true" />
    <header className="portal-topbar">
      <a href="/" className="portal-brand" aria-label="BALL ARENA home">
        <img className="portal-brand-wordmark" src="/brand/ball-arena-wordmark.svg" alt="BALL ARENA — Physics Duel League" />
      </a>
      <nav className="portal-nav" aria-label="Main navigation">
        {LINKS.map((item) => <a key={item.key} href={item.href} className={"portal-nav-link" + (active === item.key ? " active" : "")} aria-current={active === item.key ? "page" : undefined}>{item.label}</a>)}
        {!isPending && user && !user.isDevFallback && user.primaryEmail?.trim().toLowerCase() === OWNER_EMAIL && <a href="/admin" className={"portal-nav-link portal-admin-nav" + (active === "admin" ? " active" : "")} aria-current={active === "admin" ? "page" : undefined}>ADMIN</a>}
      </nav>
      <div className="portal-session">
        {isPending ? <span className="portal-session-state">CHECKING SESSION…</span> : user ? <div className="portal-account"><UserButton /></div> : <a className="portal-signin" href="/login">SIGN IN ↗</a>}
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
