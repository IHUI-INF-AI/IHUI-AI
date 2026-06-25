import request from '../utils/request'
import { withApiResponseHandler, normalizeApiResponse } from '../utils/apiResponseHandler'
import type { ApiResponse, PageResult } from '@/types/api'

export interface Advertise {
  id?: string
  title?: string
  content?: string
  imageUrl?: string
  linkUrl?: string
  status?: number
  sort?: number
  startTime?: string
  endTime?: string
  createdAt?: string
  updatedAt?: string
}

export interface AdvertiseListParams {
  page?: number
  pageSize?: number
  title?: string
  status?: number
}

export const getAdvertiseList = withApiResponseHandler(
  async (params?: AdvertiseListParams): Promise<ApiResponse<PageResult<Advertise>>> => {
    const response = await request.get<PageResult<Advertise>>('/advertise/list', { params })
    return normalizeApiResponse(response)
  }
)

export const getAdvertiseById = withApiResponseHandler(
  async (id: string): Promise<ApiResponse<Advertise>> => {
    const response = await request.get<Advertise>(`/advertise/${id}`)
    return normalizeApiResponse(response)
  }
)

export const createAdvertise = withApiResponseHandler(
  async (data: Advertise): Promise<ApiResponse<Advertise>> => {
    const response = await request.post<Advertise>('/advertise', data)
    return normalizeApiResponse(response)
  }
)

export const updateAdvertise = withApiResponseHandler(
  async (data: Advertise): Promise<ApiResponse<Advertise>> => {
    const response = await request.put<Advertise>('/advertise', data)
    return normalizeApiResponse(response)
  }
)

export const deleteAdvertise = withApiResponseHandler(
  async (ids: string | string[]): Promise<ApiResponse<null>> => {
    const idsString = Array.isArray(ids) ? ids.join(',') : ids
    const response = await request.delete<null>(`/advertise/${idsString}`)
    return normalizeApiResponse(response)
  }
)

export const exportAdvertise = withApiResponseHandler(
  async (params?: AdvertiseListParams): Promise<ApiResponse<Blob>> => {
    const response = await request.post<Blob>('/advertise/export', params, { responseType: 'blob' })
    return normalizeApiResponse(response)
  }
)
