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
              {GROK_PROVIDERS.map((provider) => (
                <button key={provider.providerId} type="button" className="na-btn secondary" onClick={() => signIn(provider.providerId, { callbackURL: "/" })}>
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
