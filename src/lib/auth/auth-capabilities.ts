import { createServerFn } from "@tanstack/react-start";

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

  return {
    serviceEnabled: authConfigured,
    emailPasswordEnabled: authConfigured && emailAndPasswordEnabled,
    providers: GROK_PROVIDERS.map((provider) => ({
      providerId: provider.providerId,
      label: provider.label,
      enabled: authConfigured && (provider.providerId === "google" ? googleConfigured : true),
    })),
  } satisfies AuthCapabilities;
});
