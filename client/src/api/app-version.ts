import request from '../utils/request'
import { withApiResponseHandler, normalizeApiResponse } from '../utils/apiResponseHandler'
import type { ApiResponse, PageResult } from '@/types/api'

export interface AppVersion {
  id?: string
  version?: string
  versionCode?: number
  platform?: string
  downloadUrl?: string
  updateLog?: string
  isForceUpdate?: boolean
  status?: number
  createdAt?: string
  updatedAt?: string
}

export interface AppVersionListParams {
  page?: number
  pageSize?: number
  version?: string
  platform?: string
  status?: number
}

export const createAppVersion = withApiResponseHandler(
  async (data: AppVersion): Promise<ApiResponse<AppVersion>> => {
    const response = await request.post<AppVersion>('/appVersion', data)
    return normalizeApiResponse(response)
  }
)

export const updateAppVersion = withApiResponseHandler(
  async (data: AppVersion): Promise<ApiResponse<AppVersion>> => {
    const response = await request.put<AppVersion>('/appVersion', data)
    return normalizeApiResponse(response)
  }
)

export const exportAppVersion = withApiResponseHandler(
  async (params?: AppVersionListParams): Promise<ApiResponse<Blob>> => {
    const response = await request.post<Blob>('/appVersion/export', params, { responseType: 'blob' })
    return normalizeApiResponse(response)
  }
)

export const getAppVersionById = withApiResponseHandler(
  async (id: string): Promise<ApiResponse<AppVersion>> => {
    const response = await request.get<AppVersion>(`/appVersion/${id}`)
    return normalizeApiResponse(response)
  }
)

export const getAppVersionList = withApiResponseHandler(
  async (params?: AppVersionListParams): Promise<ApiResponse<PageResult<AppVersion>>> => {
    const response = await request.get<PageResult<AppVersion>>('/appVersion/list', { params })
    return normalizeApiResponse(response)
  }
)

export const deleteAppVersion = withApiResponseHandler(
  async (ids: string | string[]): Promise<ApiResponse<null>> => {
    const idsString = Array.isArray(ids) ? ids.join(',') : ids
    const response = await request.delete<null>(`/appVersion/${idsString}`)
    return normalizeApiResponse(response)
  }
)
