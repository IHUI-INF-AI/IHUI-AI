import { API_ENDPOINTS } from '@aizhs/shared-api'
import { getRefreshToken } from '@aizhs/shared-auth'
import type { ApiResponse, AuthToken } from '@aizhs/shared-types'
import type { SharedRequestAdapter } from './request-adapter'
import { normalizeApiResponse } from './request-adapter'

export interface RefreshTokenInput {
  storageData?: {
    uuid?: string
    thirdPartyAccounts?: Record<string, unknown>
    [key: string]: unknown
  } | null
  refreshToken?: string
  uuid?: string
  platformType?: string
}

export async function refreshAuthToken(
  adapter: SharedRequestAdapter,
  input: RefreshTokenInput,
): Promise<ApiResponse<AuthToken | string>> {
  const refreshToken = input.refreshToken || getRefreshToken(input.storageData)
  const uuid = input.uuid || input.storageData?.uuid

  if (!refreshToken) {
    throw new Error('No refresh token')
  }

  const response = await adapter.request({
    url: API_ENDPOINTS.LOGIN.REFRESH_TOKEN,
    method: 'POST',
    base: 2,
    headers: input.platformType ? { 'platform-type': input.platformType } : undefined,
    data: {
      refreshToken,
      uuid,
    },
  })

  return normalizeApiResponse<AuthToken | string>(response)
}
