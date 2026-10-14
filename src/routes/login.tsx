import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { GROK_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";
import { setUsername } from "@/lib/arena/server-fns";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [country, setCountry] = useState("UZ");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setBusy(true);
    setError("");
    try {
      if (!authEnabled) {
        setError("Sign-in is not enabled.");
        return;
      }
      if (password.length < 8) {
        setError("Use at least 8 characters.");
        return;
      }
      const result = mode === "up"
        ? await authClient.signUp.email({ email, password, name: name || email.split("@")[0] || "Player", callbackURL: "/" })
        : await authClient.signIn.email({ email, password, callbackURL: "/" });
      if (result.error) {
        setError(result.error.message || "Could not sign in.");
        return;
      }
      if (mode === "up" && /^[a-zA-Z0-9_]{3,16}$/.test(name)) {
        await setUsername({ data: { username: name, country } }).catch(() => undefined);
      }
      await navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  async function continueWithProvider(providerId: string) {
    setBusy(true);
    setError("");
    try {
      await signIn(providerId, { callbackURL: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in could not be started. Please try again.");
      setBusy(false);
    }
  }

  return (
    <main className="login-screen">
      <form className="na-sheet sheet-center" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <p className="eyebrow">BALL ARENA</p>
        <h1>Save the colosseum</h1>
        <p className="muted">Guest progress stays on this device. New accounts can import it; existing accounts load their cloud save.</p>
        {authEnabled ? (
          <>
            <div className="seg">
              <button type="button" className={mode === "in" ? "on" : ""} onClick={() => setMode("in")}>Sign in</button>
              <button type="button" className={mode === "up" ? "on" : ""} onClick={() => setMode("up")}>Create account</button>
            </div>
            {mode === "up" && (
              <>
                <label>Username<input value={name} onChange={(e) => setName(e.target.value)} autoComplete="username" placeholder="arena_fox" /></label>
                <label>Country
                  <select value={country} onChange={(e) => setCountry(e.target.value)}>
                    {["UZ", "RU", "US", "KZ", "TR", "DE", "GB", "KR", "JP", "BR"].map((code) => <option key={code}>{code}</option>)}
                  </select>
                </label>
              </>
            )}
            <label>Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
            <label>Password<input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "up" ? "new-password" : "current-password"} /></label>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="na-btn primary" type="submit" disabled={busy}>{busy ? "Please wait" : mode === "up" ? "Create account" : "Sign in"}</button>
            <div className="socials">
              {GROK_PROVIDERS.filter((provider) => provider.idp === "google").map((provider) => (
                <button key={provider.providerId} type="button" className="google-auth-button" disabled={busy} onClick={() => void continueWithProvider(provider.providerId)}>
                  <svg viewBox="0 0 48 48" aria-hidden="true" className="google-auth-mark">
                    <path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.6c3.9-3.6 6.1-8.8 6.1-15Z"/>
                    <path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.6-5.1c-1.8 1.2-4 1.9-6.9 1.9-5.3 0-9.8-3.6-11.4-8.4H5.8v5.3A20 20 0 0 0 24 44Z"/>
                    <path fill="#FBBC05" d="M12.6 27.5a12 12 0 0 1 0-7V15.2H5.8a20 20 0 0 0 0 17.6l6.8-5.3Z"/>
                    <path fill="#EA4335" d="M24 12.1c3 0 5.7 1 7.8 3.1l5.8-5.8C34.1 6.1 29.5 4 24 4A20 20 0 0 0 5.8 15.2l6.8 5.3C14.2 15.7 18.7 12.1 24 12.1Z"/>
                  </svg>
                  <span>{busy ? "CONNECTING..." : "CONTINUE WITH GOOGLE"}</span>
                  <span className="google-auth-arrow" aria-hidden="true">↗</span>
                </button>
              ))}
              {GROK_PROVIDERS.filter((provider) => provider.idp !== "google").map((provider) => (
                <button key={provider.providerId} type="button" className="na-btn secondary" disabled={busy} onClick={() => void continueWithProvider(provider.providerId)}>
                  Continue with {provider.label}
                </button>
              ))}
            </div>
          </>
        ) : <p className="muted">Sign-in is disabled.</p>}
        <a className="na-btn ghost" href="/">Back to the arena</a>
      </form>
    </main>
  );
}
