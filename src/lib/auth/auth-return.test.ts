import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  authReturnLabel,
  friendlyCredentialError,
  friendlyProviderError,
  resolveAuthReturnTo,
  validateCredentialInput,
} from "./auth-return.ts";

describe("resolveAuthReturnTo", () => {
  it("defaults to the arena and preserves safe internal paths, query, and hash", () => {
    assert.equal(resolveAuthReturnTo(undefined), "/");
    assert.equal(resolveAuthReturnTo("/profile?tab=history#recent"), "/profile?tab=history#recent");
  });

  it("rejects external, protocol-relative, and malformed paths", () => {
    for (const value of [
      "https://example.com/steal",
      "//example.com/steal",
      "/\\\\example.com",
      "javascript:alert(1)",
      "",
      "   ",
    ]) assert.equal(resolveAuthReturnTo(value), "/");
  });

  it("prevents login loops and avoids redirecting into auth endpoints", () => {
    assert.equal(resolveAuthReturnTo("/login?callbackURL=%2Fadmin"), "/");
    assert.equal(resolveAuthReturnTo("/auth/popup?providerId=grok-x"), "/");
    assert.equal(resolveAuthReturnTo("/api/auth/get-session"), "/");
  });

  it("labels safe destinations without displaying raw paths", () => {
    assert.equal(authReturnLabel("/inventory"), "your collection");
    assert.equal(authReturnLabel("/unknown?secret=1"), "your requested page");
    assert.equal(authReturnLabel("//example.com"), "the arena");
  });
});

describe("validateCredentialInput", () => {
  it("validates email and minimum password length before calling the server", () => {
    assert.equal(validateCredentialInput({ mode: "sign-in", email: "bad-email", password: "password123" }), "Enter a valid email address.");
    assert.equal(validateCredentialInput({ mode: "sign-in", email: "arena@example.com", password: "short" }), "Password must be at least 8 characters.");
  });

  it("requires a valid username during registration", () => {
    assert.match(validateCredentialInput({ mode: "sign-up", email: "arena@example.com", password: "password123", username: "ab" }) ?? "", /Username must be/);
    assert.equal(validateCredentialInput({ mode: "sign-up", email: "arena@example.com", password: "password123", username: "arena_fox" }), null);
  });

  it("converts credential and provider failures into recoverable player-facing messages", () => {
    assert.match(friendlyCredentialError(new Error("INVALID_EMAIL_OR_PASSWORD"), "sign-in"), /not recognized/);
    assert.match(friendlyCredentialError(new Error("Database connection failed"), "sign-up"), /could not be completed/);
    assert.match(friendlyProviderError(new Error("Pop-up blocked")), /Allow sign-in pop-ups/);
  });
});
