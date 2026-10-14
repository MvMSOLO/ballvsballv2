/**
 * Sign-in providers available in this app. Google authenticates directly with
 * Google's OAuth service; X remains federated through the Grok auth broker.
 */
export type GrokProvider = {
  /** Local provider id; for broker providers this is also the callback segment. */
  providerId: string;
  /** Upstream hint for broker providers. */
  idp: string;
  label: string;
};

export const GROK_PROVIDERS: readonly GrokProvider[] = [
  { providerId: "google", idp: "google", label: "Google" },
  { providerId: "grok-x", idp: "twitter", label: "X" },
];
