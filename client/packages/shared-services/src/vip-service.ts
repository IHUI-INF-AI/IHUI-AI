import { API_ENDPOINTS } from '@aizhs/shared-api'
import type { ApiResponse, VipPackage } from '@aizhs/shared-types'
import type { SharedRequestAdapter } from './request-adapter'
import { normalizeApiResponse } from './request-adapter'

export async function getVipPrice(
  adapter: SharedRequestAdapter,
  token?: string,
): Promise<ApiResponse<VipPackage[] | Record<string, unknown>>> {
  const response = await adapter.request({
    url: API_ENDPOINTS.VIP.PRICE,
    method: 'GET',
    base: 2,
    headers: {
      'content-type': 'application/json',
    },
    data: token ? { token } : {},
  })

  return normalizeApiResponse<VipPackage[] | Record<string, unknown>>(response)
}

export async function purchaseVip(
  adapter: SharedRequestAdapter,
  params: { packageId: string; token?: string; paymentMethod?: string },
): Promise<ApiResponse<unknown>> {
  const response = await adapter.request({
    url: API_ENDPOINTS.VIP.PURCHASE,
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    data: params,
  })

  return normalizeApiResponse(response)
}

export async function getUserVipInfo(
  adapter: SharedRequestAdapter,
  token?: string,
): Promise<ApiResponse<unknown>> {
  const response = await adapter.request({
    url: API_ENDPOINTS.VIP.INFO,
    method: 'GET',
    headers: {
      'content-type': 'application/json',
    },
    data: token ? { token } : {},
  })

  return normalizeApiResponse(response)
}
