import { describe, it, expect, vi, beforeEach } from 'vitest'
import { resetAsyncStorageMock } from './__mocks__/async-storage'

const { tokenMocks } = vi.hoisted(() => ({
  tokenMocks: {
    initApi: vi.fn(async () => {}),
    setToken: vi.fn(async () => {}),
    setRefreshToken: vi.fn(async () => {}),
    getToken: vi.fn(() => null as unknown),
    getRefreshToken: vi.fn(() => null as unknown),
    clearToken: vi.fn(async () => {}),
  },
}))

vi.mock('../src/lib/token', () => ({
  ...tokenMocks,
  tokenStore: {
    getToken: () => tokenMocks.getToken() as string | null,
    getRefreshToken: () => tokenMocks.getRefreshToken() as string | null,
    setToken: tokenMocks.setToken,
    setRefreshToken: tokenMocks.setRefreshToken,
    clearAll: tokenMocks.clearToken,
  },
}))

import { rnAuthStore } from '../src/stores/auth-store'

describe('Debug token store', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetAsyncStorageMock()
    tokenMocks.getToken.mockReturnValue(null)
  })

  it('should use mocked tokenStore', async () => {
    // Check what tokenStore the auth-store is using
    const state = rnAuthStore.getState()

    // Set cached token
    tokenMocks.getToken.mockReturnValue('cached-tk')

    // Hydrate should read from tokenStore
    await state.hydrate()

    expect(state.token).toBe('cached-tk')
  })
})
