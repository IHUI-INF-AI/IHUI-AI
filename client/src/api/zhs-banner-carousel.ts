import request from '@/utils/request'
import type { ApiResponse, PaginationParams, PaginationResponse } from '@/types'
import { withApiResponseHandler, normalizeApiResponse } from '@/utils/api-response'

export interface Carousel {
  id?: string
  title?: string
  imageUrl?: string
  linkUrl?: string
  linkType?: string
  sortOrder?: number
  status?: number
  startTime?: string
  endTime?: string
  createdAt?: string
  updatedAt?: string
}

export interface CarouselListParams extends PaginationParams {
  title?: string
  status?: number
  startTime?: string
  endTime?: string
}

export const updateCarousel = withApiResponseHandler(
  async (data: Carousel): Promise<ApiResponse<Carousel>> => {
    const response = await request.put<Carousel>('/carousel', data)
    return normalizeApiResponse(response)
  }
)

export const createCarousel = withApiResponseHandler(
  async (data: Carousel): Promise<ApiResponse<Carousel>> => {
    const response = await request.post<Carousel>('/carousel', data)
    return normalizeApiResponse(response)
  }
)

export const exportCarousel = withApiResponseHandler(
  async (params?: CarouselListParams): Promise<ApiResponse<Blob>> => {
    const response = await request.post<Blob>('/carousel/export', params, {
      responseType: 'blob',
    })
    return normalizeApiResponse(response)
  }
)

export const getCarouselDetail = withApiResponseHandler(
  async (id: string): Promise<ApiResponse<Carousel>> => {
    const response = await request.get<Carousel>(`/carousel/${id}`)
    return normalizeApiResponse(response)
  }
)

export const getCarouselList = withApiResponseHandler(
  async (params?: CarouselListParams): Promise<ApiResponse<PaginationResponse<Carousel>>> => {
    const response = await request.get('/carousel/list', { params })
    const normalized = normalizeApiResponse(response)
    
    if (normalized.data && typeof normalized.data === 'object' && 'list' in normalized.data) {
      return normalized as ApiResponse<PaginationResponse<Carousel>>
    }
    
    return {
      code: normalized.code ?? 200,
      success: normalized.success,
      message: normalized.message,
      data: {
        list: normalized.data as Carousel[],
        pagination: {
          total: 0,
          page: params?.page || 1,
          pageSize: params?.pageSize || 10,
          totalPages: 0,
        },
      },
    }
  }
)

export const deleteCarousel = withApiResponseHandler(
  async (ids: string | string[]): Promise<ApiResponse<null>> => {
    const idsString = Array.isArray(ids) ? ids.join(',') : ids
    const response = await request.delete<null>(`/carousel/${idsString}`)
    return normalizeApiResponse(response)
  }
)
