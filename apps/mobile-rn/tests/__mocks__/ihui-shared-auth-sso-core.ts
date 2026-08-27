// Stub for @ihui/shared/auth/sso-core - vitest mock
// Provides SSO helper types and functions.

export interface SsoTokenData {
  token: string
  refreshToken: string
  expiresIn: number
  user?: Record<string, unknown>
}

export interface SsoCoreOptions {
  clientId: string
  providerUrl: string
  redirectUri: string
}

export async function startSSOFlow(_opts: SsoCoreOptions): Promise<SsoTokenData | null> {
  return null
}

export function parseSSOResponse(_url: string): SsoTokenData | null {
  return null
}
