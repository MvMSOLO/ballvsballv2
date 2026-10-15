import { createServerFn } from "@tanstack/react-start";
import { isAuthProviderAvailable } from "./auth-capabilities-policy";

export type AuthProviderCapability = {
  providerId: string;
  label: string;
  enabled: boolean;
};

export type AuthCapabilities = {
  serviceEnabled: boolean;
  emailPasswordEnabled: boolean;
  providers: AuthProviderCapability[];
};

/**
 * Return provider availability without exposing client secrets. Capability
 * checks are advisory; the identity provider still decides every auth result.
 */
export const getAuthCapabilities = createServerFn({ method: "GET" }).handler(async () => {
  const [{ authConfigured }, { emailAndPasswordEnabled }, { GROK_PROVIDERS }] = await Promise.all([
    import("./server"),
    import("./email-password"),
    import("./providers"),
  ]);
  const googleConfigured = Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim(),
  );
  const brokerConfigured = Boolean(
    process.env.GROK_AUTH_CLIENT_ID?.trim() && process.env.GROK_AUTH_CLIENT_SECRET?.trim(),
  );
  const production = process.env.VERCEL_ENV === "production";

  return {
    serviceEnabled: authConfigured,
    emailPasswordEnabled: authConfigured && emailAndPasswordEnabled,
    providers: GROK_PROVIDERS.map((provider) => ({
      providerId: provider.providerId,
      label: provider.label,
      enabled: isAuthProviderAvailable({
        providerId: provider.providerId,
        authConfigured,
        googleConfigured,
        brokerConfigured,
        production,
      }),
    })),
  } satisfies AuthCapabilities;
});
