import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { authClient, authEnabled, signIn } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getAuthCapabilities, type AuthCapabilities } from "@/lib/auth/auth-capabilities";
import {
  authReturnLabel,
  friendlyCredentialError,
  friendlyProviderError,
  resolveAuthReturnTo,
  validateCredentialInput,
} from "@/lib/auth/auth-return";
import { setUsername } from "@/lib/arena/server-fns";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => ({
    callbackURL: resolveAuthReturnTo(search.callbackURL),
    authError: search.authError === "provider" ? "provider" as const : undefined,
  }),
  component: LoginPage,
});

type LoginMode = "in" | "up";
type CapabilityState = "loading" | "ready" | "error";

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className="auth-provider-mark">
      <path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.6c3.9-3.6 6.1-8.8 6.1-15Z"/>
      <path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.6-5.1c-1.8 1.2-4 1.9-6.9 1.9-5.3 0-9.8-3.6-11.4-8.4H5.8v5.3A20 20 0 0 0 24 44Z"/>
      <path fill="#FBBC05" d="M12.6 27.5a12 12 0 0 1 0-7V15.2H5.8a20 20 0 0 0 0 17.6l6.8-5.3Z"/>
      <path fill="#EA4335" d="M24 12.1c3 0 5.7 1 7.8 3.1l5.8-5.8C34.1 6.1 29.5 4 24 4A20 20 0 0 0 5.8 15.2l6.8 5.3C14.2 15.7 18.7 12.1 24 12.1Z"/>
    </svg>
  );
}

function AuthStatus({ title, detail, children }: {
  title: string;
  detail: string;
  children?: ReactNode;
}) {
  return (
    <section className="auth-status-panel" role="status" aria-live="polite">
      <span className="auth-status-orbit" aria-hidden="true"><span /></span>
      <div><strong>{title}</strong><p>{detail}</p></div>
      {children}
    </section>
  );
}

function LoginPage() {
  const { callbackURL: returnTo, authError } = Route.useSearch();
  const { user, isPending: sessionPending } = useCurrentUserState();
  const [mode, setMode] = useState<LoginMode>("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [country, setCountry] = useState("UZ");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [accountCreated, setAccountCreated] = useState(false);
  const [capabilities, setCapabilities] = useState<AuthCapabilities | null>(null);
  const [capabilityState, setCapabilityState] = useState<CapabilityState>("loading");
  const [capabilityError, setCapabilityError] = useState(false);
  const suppressSessionRedirect = useRef(false);

  const loadCapabilities = useCallback(async () => {
    setCapabilityState("loading");
    setCapabilityError(false);
    try {
      const result = await getAuthCapabilities();
      setCapabilities(result);
      setCapabilityState("ready");
    } catch {
      setCapabilityError(true);
      setCapabilityState("error");
    }
  }, []);

  useEffect(() => {
    if (authEnabled) void loadCapabilities();
  }, [loadCapabilities]);

  useEffect(() => {
    if (authError === "provider") {
      setError("The identity provider could not complete sign-in. Try again or choose another available method.");
    }
  }, [authError]);

  useEffect(() => {
    if (!authEnabled || sessionPending || !user || user.isDevFallback || suppressSessionRedirect.current || accountCreated) return;
    window.location.replace(returnTo);
  }, [accountCreated, returnTo, sessionPending, user]);

  function changeMode(next: LoginMode) {
    if (busyAction || accountCreated) return;
    setMode(next);
    setError("");
    setNotice("");
  }

  async function submitCredentials(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyAction || !capabilities?.serviceEnabled || !capabilities.emailPasswordEnabled) return;

    const validation = validateCredentialInput({
      mode: mode === "up" ? "sign-up" : "sign-in",
      email,
      password,
      username: name,
    });
    if (validation) {
      setError(validation);
      setNotice("");
      return;
    }

    const cleanEmail = email.trim();
    const cleanName = name.trim();
    setBusyAction(mode === "up" ? "email-sign-up" : "email-sign-in");
    setError("");
    setNotice("");
    if (mode === "up") suppressSessionRedirect.current = true;

    try {
      const result = mode === "up"
        ? await authClient.signUp.email({
            email: cleanEmail,
            password,
            name: cleanName,
            callbackURL: returnTo,
          })
        : await authClient.signIn.email({
            email: cleanEmail,
            password,
            callbackURL: returnTo,
          });

      if (result.error) {
        if (mode === "up") suppressSessionRedirect.current = false;
        setError(friendlyCredentialError(result.error, mode === "up" ? "sign-up" : "sign-in"));
        return;
      }

      if (mode === "up") {
        // The auth server has confirmed account creation. Do not redirect the
        // newly-created session while its public profile is being synchronized.
        setAccountCreated(true);
        let profileSaved = false;
        try {
          const profile = await setUsername({ data: { username: cleanName, country } });
          profileSaved = profile.ok;
        } catch {
          profileSaved = false;
        }
        if (!profileSaved) {
          setNotice("Your account was created, but the public username could not be saved yet. Continue to your destination and update your profile there.");
          return;
        }
      }

      window.location.replace(returnTo);
    } catch (reason) {
      if (mode === "up") {
        suppressSessionRedirect.current = false;
        setAccountCreated(false);
      }
      setError(friendlyCredentialError(reason, mode === "up" ? "sign-up" : "sign-in"));
    } finally {
      setBusyAction(null);
    }
  }

  async function continueWithProvider(providerId: string) {
    const provider = capabilities?.providers.find((item) => item.providerId === providerId);
    if (busyAction || !provider?.enabled) {
      if (!provider?.enabled) setError("That sign-in provider is not available on this deployment. Choose an enabled method.");
      return;
    }
    setBusyAction("provider:" + providerId);
    setError("");
    setNotice("");
    try {
      const errorCallbackURL = "/login?callbackURL=" + encodeURIComponent(returnTo) + "&authError=provider";
      await signIn(providerId, { callbackURL: returnTo, errorCallbackURL });
    } catch (reason) {
      setError(friendlyProviderError(reason));
    } finally {
      setBusyAction(null);
    }
  }

  function continueAfterAccountCreated() {
    window.location.replace(returnTo);
  }

  const providers = capabilities?.providers ?? [];
  const canUseEmail = Boolean(capabilities?.serviceEnabled && capabilities.emailPasswordEnabled);
  const hasEnabledProvider = providers.some((provider) => provider.enabled);

  return (
    <main className="login-screen auth-onboarding">
      <div className="na-sheet sheet-center auth-sheet">
        <aside className="auth-story">
          <a href="/" className="auth-brand" aria-label="BALL ARENA home">
            <img src="/brand/ball-arena-wordmark.svg" alt="BALL ARENA — Physics Duel League" />
          </a>
          <p className="eyebrow">ARENA ID / PLAYER ACCESS</p>
          <h1>Keep your run.<span>Own your arena.</span></h1>
          <p className="muted">Your matches are only the beginning. Connect an account to carry your collection and progress with you.</p>
          <div className="auth-benefit-list" aria-label="Account benefits">
            <div><span>01</span><div><strong>Cloud-backed progress</strong><small>Keep your profile, trophies and XP together.</small></div></div>
            <div><span>02</span><div><strong>Your ball collection</strong><small>Bring owned balls and favorites with your account.</small></div></div>
            <div><span>03</span><div><strong>Back to the action</strong><small>Return to {authReturnLabel(returnTo)} after sign-in.</small></div></div>
          </div>
          <div className="auth-return-chip"><span>RETURN DESTINATION</span><strong>{authReturnLabel(returnTo).toUpperCase()}</strong></div>
        </aside>

        <section className="auth-access" aria-label="Sign in or create account">
          <div className="auth-access-heading">
            <span className="auth-step-label">SECURE PLAYER ACCESS <i /></span>
            <h2>{accountCreated ? "Almost ready." : mode === "up" ? "Create your account" : "Welcome back."}</h2>
            <p>{accountCreated ? "Your account is created. One profile detail still needs attention." : "Sign in to continue your arena run."}</p>
          </div>

          {!authEnabled ? (
            <AuthStatus title="Guest mode is active" detail="Authentication is disabled in this build. You can still play locally and return to the arena." />
          ) : sessionPending ? (
            <AuthStatus title="Checking your session…" detail="Verifying whether this browser already has a signed-in player." />
          ) : user && !user.isDevFallback && !accountCreated ? (
            <AuthStatus title="Session verified" detail={"Returning to " + authReturnLabel(returnTo) + "…"} />
          ) : capabilityState === "loading" ? (
            <AuthStatus title="Checking sign-in methods…" detail="Verifying which account options are available for this deployment." />
          ) : capabilityError ? (
            <AuthStatus title="Sign-in options could not be checked" detail="No account method has been marked as available. Retry the capability check or return to the arena.">
              <button type="button" className="na-btn secondary auth-retry-button" onClick={() => void loadCapabilities()}>RETRY CHECK</button>
            </AuthStatus>
          ) : !capabilities?.serviceEnabled ? (
            <AuthStatus title="Authentication is unavailable" detail="This deployment has not enabled its authentication service. No sign-in success will be assumed.">
              <button type="button" className="na-btn secondary auth-retry-button" onClick={() => void loadCapabilities()}>CHECK AGAIN</button>
            </AuthStatus>
          ) : accountCreated ? (
            <AuthStatus title="Account created by the server" detail="The public username could not be saved. Your account exists; continue and update the profile once you arrive.">
              {notice && <p className="auth-inline-notice" role="status">{notice}</p>}
              <button type="button" className="na-btn primary auth-retry-button" onClick={continueAfterAccountCreated}>CONTINUE TO {authReturnLabel(returnTo).toUpperCase()} ↗</button>
            </AuthStatus>
          ) : (
            <>
              {authError === "provider" && <p className="auth-recovery-note" role="status">Provider sign-in returned to this page. Your destination is preserved; you can retry below.</p>}
              {error && <p className="form-error auth-form-message" role="alert">{error}</p>}
              {notice && <p className="auth-inline-notice" role="status">{notice}</p>}

              {canUseEmail && (
                <>
                  <div className="seg auth-mode-tabs" role="tablist" aria-label="Account action">
                    <button type="button" role="tab" aria-selected={mode === "in"} className={mode === "in" ? "on" : ""} disabled={Boolean(busyAction)} onClick={() => changeMode("in")}>Sign in</button>
                    <button type="button" role="tab" aria-selected={mode === "up"} className={mode === "up" ? "on" : ""} disabled={Boolean(busyAction)} onClick={() => changeMode("up")}>Create account</button>
                  </div>
                  <form className="auth-credentials" onSubmit={(event) => void submitCredentials(event)} noValidate>
                    {mode === "up" && (
                      <>
                        <label>PLAYER NAME
                          <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="username" placeholder="arena_fox" minLength={3} maxLength={16} pattern="[A-Za-z0-9_]{3,16}" required disabled={Boolean(busyAction)} />
                        </label>
                        <label>COUNTRY
                          <select value={country} onChange={(event) => setCountry(event.target.value)} disabled={Boolean(busyAction)}>
                            {["UZ", "RU", "US", "KZ", "TR", "DE", "GB", "KR", "JP", "BR"].map((code) => <option key={code} value={code}>{code}</option>)}
                          </select>
                        </label>
                      </>
                    )}
                    <label>EMAIL ADDRESS
                      <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="you@example.com" disabled={Boolean(busyAction)} />
                    </label>
                    <label>PASSWORD
                      <span className="auth-password-wrap">
                        <input type={showPassword ? "text" : "password"} required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "up" ? "new-password" : "current-password"} disabled={Boolean(busyAction)} />
                        <button type="button" className="auth-password-toggle" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} disabled={Boolean(busyAction)} onClick={() => setShowPassword((value) => !value)}>{showPassword ? "HIDE" : "SHOW"}</button>
                      </span>
                    </label>
                    <button className="na-btn primary auth-submit" type="submit" disabled={Boolean(busyAction)}>
                      {busyAction === "email-sign-up" ? "CREATING ACCOUNT…" : busyAction === "email-sign-in" ? "VERIFYING DETAILS…" : mode === "up" ? "CREATE PLAYER ACCOUNT ↗" : "SIGN IN TO ARENA ↗"}
                    </button>
                  </form>
                </>
              )}

              {canUseEmail && hasEnabledProvider && <div className="auth-method-divider"><span>OR CONTINUE WITH</span></div>}
              <div className="auth-provider-list">
                {providers.map((provider) => {
                  const busy = busyAction === "provider:" + provider.providerId;
                  return (
                    <div className="auth-provider-row" key={provider.providerId}>
                      <button
                        type="button"
                        className={"auth-provider-button" + (provider.providerId === "google" ? " is-google" : " is-broker")}
                        disabled={Boolean(busyAction) || !provider.enabled}
                        onClick={() => void continueWithProvider(provider.providerId)}
                        aria-describedby={"provider-state-" + provider.providerId}
                      >
                        {provider.providerId === "google" ? <GoogleMark /> : <span className="auth-provider-x" aria-hidden="true">𝕏</span>}
                        <span>{busy ? "CONNECTING…" : "CONTINUE WITH " + provider.label.toUpperCase()}</span>
                        <span className="auth-provider-arrow" aria-hidden="true">↗</span>
                      </button>
                      <small id={"provider-state-" + provider.providerId} className={"auth-provider-state" + (!provider.enabled ? " is-disabled" : "")}>
                        {busy ? "Waiting for provider confirmation…" : provider.enabled ? "Available on this deployment" : "Not configured here · choose another method"}
                      </small>
                    </div>
                  );
                })}
              </div>

              {!canUseEmail && !hasEnabledProvider && (
                <AuthStatus title="No sign-in method is enabled" detail="This deployment has no confirmed account method available. Retry the check later or continue as a guest." />
              )}
            </>
          )}

          <div className="auth-access-footer">
            <a href="/">← BACK TO ARENA</a>
            <span><i /> ACCOUNT DATA IS SERVER-VERIFIED</span>
          </div>
        </section>
      </div>
    </main>
  );
}
