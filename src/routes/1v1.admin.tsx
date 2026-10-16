import { createFileRoute } from "@tanstack/react-router";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { canAccessOwnerTools } from "@/lib/player-navigation";
import { BallArenaPage } from "./index";

function OwnerLabRoute() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) {
    return <main className="owner-lab-gate"><section aria-live="polite" role="status"><span>IDENTITY CHECK</span><h1>Verifying access…</h1><p>The testing lab stays closed until the signed-in account is checked.</p></section></main>;
  }
  if (!canAccessOwnerTools(user)) {
    return <main className="owner-lab-gate">
      <section>
        <span>RESTRICTED / INTERNAL TESTING</span>
        <h1>Owner lab only.</h1>
        <p>The 1V1 control deck is an internal ball-pack test surface. It is available only to the verified owner account.</p>
        {!user && <a className="portal-button primary" href="/login?callbackURL=%2F1v1%2Fadmin">SIGN IN AS OWNER ↗</a>}
        <a className="portal-button secondary" href="/1v1/">RETURN TO DUEL</a>
      </section>
    </main>;
  }
  return <BallArenaPage mode="admin" />;
}

export const Route = createFileRoute("/1v1/admin")({
  component: OwnerLabRoute,
});
