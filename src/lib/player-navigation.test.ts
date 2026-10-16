import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PLAYER_HUB_NAV, OWNER_ACCOUNT_EMAIL, canAccessOwnerTools } from "./player-navigation.ts";

describe("shared player navigation", () => {
  it("defines stable, unique routes for all player-hub destinations", () => {
    const hrefs = PLAYER_HUB_NAV.map((item) => item.href);
    const keys = PLAYER_HUB_NAV.map((item) => item.key);
    assert.deepEqual(hrefs, ["/profile", "/shop", "/inventory", "/leaderboard", "/settings"]);
    assert.equal(new Set(hrefs).size, hrefs.length);
    assert.equal(new Set(keys).size, keys.length);
  });
});

describe("owner tools visibility policy", () => {
  it("requires the correct email, a verified address, and a non-fallback session", () => {
    assert.equal(canAccessOwnerTools(null), false);
    assert.equal(canAccessOwnerTools({ primaryEmail: OWNER_ACCOUNT_EMAIL, emailVerified: true, isDevFallback: true }), false);
    assert.equal(canAccessOwnerTools({ primaryEmail: OWNER_ACCOUNT_EMAIL, emailVerified: false, isDevFallback: false }), false);
    assert.equal(canAccessOwnerTools({ primaryEmail: "another@example.com", emailVerified: true, isDevFallback: false }), false);
    assert.equal(canAccessOwnerTools({ primaryEmail: " MIRZAYEVAVAZBEK15@GMAIL.COM ", emailVerified: true, isDevFallback: false }), true);
  });
});
