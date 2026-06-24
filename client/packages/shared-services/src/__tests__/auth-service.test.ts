import { describe, expect, it } from 'vitest'
import { refreshAuthToken } from '../auth-service'
import type { SharedRequestAdapter, SharedRequestConfig } from '../request-adapter'

function createAdapter(handler: (config: SharedRequestConfig) => unknown | Promise<unknown>): SharedRequestAdapter {
  return {
    async request<TResponse = unknown>(config: SharedRequestConfig): Promise<TResponse> {
      return handler(config) as Promise<TResponse>
    },
  }
}

describe('shared-services/auth-service', () => {
  it('refreshes token through the provided adapter', async () => {
    let capturedConfig: SharedRequestConfig | undefined
    const adapter = createAdapter(
      async (config) => {
        capturedConfig = config
        return {
          code: 200,
          data: {
            accessToken: 'new-access-token',
            refreshToken: 'new-refresh-token',
          },
        }
      },
    )

    const response = await refreshAuthToken(adapter, {
      refreshToken: 'old-refresh-token',
      uuid: 'user-uuid',
      platformType: 'web',
    })

    expect(capturedConfig).toMatchObject({
      url: '/api/v1/auth/refresh',
      method: 'POST',
      base: 2,
      headers: { 'platform-type': 'web' },
      data: {
        refreshToken: 'old-refresh-token',
        uuid: 'user-uuid',
      },
    })
    expect(response.data).toEqual({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
    })
  })

  it('uses nested storage refresh token when input token is omitted', async () => {
    const adapter = createAdapter(
      async (config) => {
        expect(config.data).toEqual({
          refreshToken: 'nested-refresh-token',
          uuid: 'nested-uuid',
        })
        return { code: 200, data: 'new-access-token' }
      },
    )

    const response = await refreshAuthToken(adapter, {
      storageData: {
        uuid: 'nested-uuid',
        thirdPartyAccounts: {
          refreshToken: 'nested-refresh-token',
        },
      },
    })

    expect(response.data).toBe('new-access-token')
  })
})
