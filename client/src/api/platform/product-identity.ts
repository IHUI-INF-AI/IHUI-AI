/**
 * 产品身份管理API
 * 对应后端路由：/product_identity
 */

import request from '@/utils/request'
import type { ApiResponse, PaginationParams, PaginationResponse } from '@/types'
import { withApiResponseHandler, normalizeApiResponse } from '@/utils/api-response'
import { PRODUCT_IDENTITY_PATHS } from '@/config/backend-paths'

export interface ProductIdentity {
  id?: string
  productId?: string
  productName?: string
  identityId?: string
  identityName?: string
  identityType?: number
  status?: number
  createdAt?: string
  updatedAt?: string
}

export interface ProductIdentityListParams extends PaginationParams {
  productId?: string
  identityId?: string
  identityType?: number
  status?: number
  startTime?: string
  endTime?: string
}

export const createProductIdentity = withApiResponseHandler(
  async (data: ProductIdentity): Promise<ApiResponse<ProductIdentity>> => {
    const response = await request.post<ProductIdentity>(PRODUCT_IDENTITY_PATHS.create, data)
    return normalizeApiResponse(response)
  }
)

export const updateProductIdentity = withApiResponseHandler(
  async (data: ProductIdentity): Promise<ApiResponse<ProductIdentity>> => {
    const response = await request.put<ProductIdentity>(PRODUCT_IDENTITY_PATHS.update, data)
    return normalizeApiResponse(response)
  }
)

export const getProductIdentityList = withApiResponseHandler(
  async (params?: ProductIdentityListParams): Promise<ApiResponse<PaginationResponse<ProductIdentity>>> => {
    const response = await request.get(PRODUCT_IDENTITY_PATHS.list, { params })
    interface ProductIdentityListResponse {
      list: ProductIdentity[]
      total: number
      page: number
      pageSize: number
    }
    const normalizedResponse = normalizeApiResponse<ProductIdentityListResponse>(response)
    const data = normalizedResponse.data?.list || []
    const total = normalizedResponse.data?.total || data.length
    const page = normalizedResponse.data?.page || params?.page || 1
    const pageSize = normalizedResponse.data?.pageSize || params?.pageSize || 20

    return {
      ...normalizedResponse,
      data: {
        list: (Array.isArray(data) ? data : []) as ProductIdentity[],
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    }
  }
)

export const getProductIdentityDetail = withApiResponseHandler(
  async (id: string): Promise<ApiResponse<ProductIdentity>> => {
    const response = await request.get<ProductIdentity>(`/product_identity/${id}`)
    return normalizeApiResponse(response)
  }
)

export const deleteProductIdentity = withApiResponseHandler(
  async (ids: string | string[]): Promise<ApiResponse<null>> => {
    const idsString = Array.isArray(ids) ? ids.join(',') : ids
    const response = await request.delete<null>(`/product_identity/${idsString}`)
    return normalizeApiResponse(response)
  }
)

export const exportProductIdentity = withApiResponseHandler(
  async (params?: ProductIdentityListParams): Promise<ApiResponse<Blob>> => {
    const response = await request.post<Blob>('/product_identity/export', params, {
      responseType: 'blob',
    })
    return normalizeApiResponse(response)
  }
)
