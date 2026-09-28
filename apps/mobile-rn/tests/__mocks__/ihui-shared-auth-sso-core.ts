// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

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
