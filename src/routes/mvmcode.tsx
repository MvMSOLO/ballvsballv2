import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { authEnabled } from "@/lib/auth/client";
import { redeemOwnerBadge } from "@/lib/arena/server-fns";
import { PortalShell } from "@/components/portal-shell";

export const Route = createFileRoute("/mvmcode")({ component: MvmCodePage });

function MvmCodePage() {
  const { user, isPending } = useCurrentUserState();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [success, setSuccess] = useState(false);
  const connected = Boolean(authEnabled && user && !user.isDevFallback);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!connected) {
      setNotice("Sign in with Google before redeeming a code.");
      return;
    }
    setBusy(true);
    setNotice("");
    setSuccess(false);
    try {
      const result = await redeemOwnerBadge({ data: { code: code.trim() } });
      if (result.ok) {
        setSuccess(true);
        setNotice(result.alreadyOwner
          ? "OWNER status is already verified for this account."
          : "OWNER frame unlocked and saved to your account.");
        setCode("");
      } else {
        const messages: Record<string, string> = {
          disabled: "Redemption is not configured on the server yet.",
          invalid: "That code is not valid.",
          claimed: "This one-time Owner code has already been redeemed.",
        };
        setNotice(messages[result.reason] ?? "Code could not be redeemed.");
      }
    } catch {
      setNotice("Could not verify this code. Please retry.");
    } finally {
      setBusy(false);
    }
  }

  return <PortalShell active="redeem" title="PRIVATE REDEMPTION" description="Securely verify a one-time profile-frame entitlement.">
    <section className="mvm-code-shell portal-panel">
      <div className="mvm-code-emblem"><img src="/frames/owner.svg" alt="" aria-hidden="true" /></div>
      <div className="mvm-code-copy">
        <span className="portal-kicker">MVM ACCESS NODE // PRIVATE ROUTE</span>
        <h2>Owner frame redemption</h2>
        <p>Sign in to bind the Owner frame to your account. A valid redemption can only be claimed once globally.</p>
        {isPending && <p className="portal-muted">Checking your session…</p>}
        {!isPending && !connected && <p className="mvm-code-warning">A verified Google session is required. <a href="/login?callbackURL=%2Fmvmcode">SIGN IN ↗</a></p>}
        {connected && <form className="portal-form mvm-code-form" onSubmit={(event) => void submit(event)}>
          <label>REDEMPTION CODE
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={80}
              placeholder="ENTER PRIVATE CODE"
              aria-label="Private redemption code"
              required
            />
          </label>
          <button className="portal-button primary" type="submit" disabled={busy || !code.trim()}>{busy ? "VERIFYING…" : "VERIFY & UNLOCK ↗"}</button>
        </form>}
        {notice && <p className={"portal-notice mvm-code-notice" + (success ? " is-success" : "")} role="status">{notice}</p>}
        {success && <a className="portal-button secondary" href="/profile">VIEW PROFILE FRAME ↗</a>}
      </div>
    </section>
  </PortalShell>;
}
