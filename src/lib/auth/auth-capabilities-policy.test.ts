import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isAuthProviderAvailable } from "./auth-capabilities-policy.ts";

describe("isAuthProviderAvailable", () => {
  const base = {
    authConfigured: true,
    googleConfigured: false,
    brokerConfigured: false,
    production: true,
  };

  it("requires Google credentials before advertising Google sign-in", () => {
    assert.equal(isAuthProviderAvailable({ ...base, providerId: "google" }), false);
    assert.equal(isAuthProviderAvailable({ ...base, providerId: "google", googleConfigured: true }), true);
  });

  it("does not mistake the preview fallback broker secret for production configuration", () => {
    assert.equal(isAuthProviderAvailable({ ...base, providerId: "grok-x" }), false);
    assert.equal(isAuthProviderAvailable({ ...base, providerId: "grok-x", brokerConfigured: true }), true);
  });

  it("permits the baked preview broker only outside production", () => {
    assert.equal(isAuthProviderAvailable({ ...base, providerId: "grok-x", production: false }), true);
  });

  it("marks every provider unavailable when authentication itself is disabled", () => {
    assert.equal(isAuthProviderAvailable({ ...base, providerId: "google", authConfigured: false, googleConfigured: true }), false);
    assert.equal(isAuthProviderAvailable({ ...base, providerId: "grok-x", authConfigured: false, brokerConfigured: true }), false);
  });
});
