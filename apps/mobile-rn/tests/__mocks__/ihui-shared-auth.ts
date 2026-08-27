// Stub for @ihui/shared/auth - vitest mock
// Provides createInMemoryTokenStore and TokenStore for useAuth tests.

export interface TokenStore {
  getToken(): string | null
  getRefreshToken(): string | null
  setToken(token: string | null): void
  setRefreshToken(token: string | null): void
  clearAll(): void
}

export interface TokenStoreConfig {
  initial?: { token?: string; refreshToken?: string }
}

export function createInMemoryTokenStore(config?: TokenStoreConfig): TokenStore {
  let _token: string | null = config?.initial?.token ?? null
  let _refreshToken: string | null = config?.initial?.refreshToken ?? null

  return {
    getToken() {
      return _token
    },
    getRefreshToken() {
      return _refreshToken
    },
    setToken(t) {
      _token = t
    },
    setRefreshToken(t) {
      _refreshToken = t
    },
    clearAll() {
      _token = null
      _refreshToken = null
    },
  }
}
