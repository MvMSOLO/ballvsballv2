export type AuthProviderAvailabilityInput = {
  providerId: string;
  authConfigured: boolean;
  googleConfigured: boolean;
  brokerConfigured: boolean;
  production: boolean;
};

/**
 * Preview broker credentials are accepted only on preview/local environments.
 * A production deployment must carry its own broker client credentials before
 * advertising the generic OAuth provider as available.
 */
export function isAuthProviderAvailable(input: AuthProviderAvailabilityInput): boolean {
  if (!input.authConfigured) return false;
  if (input.providerId === "google") return input.googleConfigured;
  return input.brokerConfigured || !input.production;
}
