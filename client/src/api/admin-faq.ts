/**
 * 管理后台 - FAQ API
 * 后端约定：/admin/faqs 列表、新增、编辑、删除、置顶
 */
import request from '@/utils/request'
import type { ApiResponse, PaginationParams } from '@/types'
import { normalizeApiResponse } from '@/utils/api-response'
import { seedFallbackB } from '@/utils/seedData'

export interface AdminFAQ {
  id: string
  question: string
  answer: string
  category: string
  isTop: boolean
  status: string
  views: number
  createdAt: string
}

export interface AdminFAQListParams extends PaginationParams {
  category?: string
  keyword?: string
}

export interface AdminFAQListResult {
  list: AdminFAQ[]
  total: number
}

export interface AdminFAQCreateParams {
  question: string
  answer: string
  category: string
}

export interface AdminFAQUpdateParams extends Partial<AdminFAQCreateParams> {
  isTop?: boolean
  status?: string
}

/** 获取 FAQ 列表（管理端） */
export async function getAdminFAQs(
  params?: AdminFAQListParams
): Promise<ApiResponse<AdminFAQListResult>> {
  try {
    const response = await request.get<AdminFAQListResult>('/admin/faqs', { params })
    return normalizeApiResponse(response)
  } catch (_e) {
    // P15.1 seedData fallback
    return seedFallbackB('faqs', params) as unknown as ApiResponse<AdminFAQListResult>
  }
}

/** 新增 FAQ */
export async function createAdminFAQ(
  data: AdminFAQCreateParams
): Promise<ApiResponse<AdminFAQ>> {
  try {
    const response = await request.post<AdminFAQ>('/admin/faqs', data)
    return normalizeApiResponse(response)
  } catch (e) {
    return {
      code: 500,
      message: (e as Error)?.message || '创建失败',
      data: {} as AdminFAQ,
      success: false,
      timestamp: Date.now(),
    }
  }
}

/** 更新 FAQ */
export async function updateAdminFAQ(
  id: string,
  data: AdminFAQUpdateParams
): Promise<ApiResponse<AdminFAQ>> {
  try {
    const response = await request.put<AdminFAQ>(`/admin/faqs/${id}`, data)
    return normalizeApiResponse(response)
  } catch (e) {
    return {
      code: 500,
      message: (e as Error)?.message || '更新失败',
      data: {} as AdminFAQ,
      success: false,
      timestamp: Date.now(),
    }
  }
}

/** 删除 FAQ */
export async function deleteAdminFAQ(id: string): Promise<ApiResponse<boolean>> {
  try {
    const response = await request.delete<boolean>(`/admin/faqs/${id}`)
    return normalizeApiResponse(response)
  } catch (e) {
    return {
      code: 500,
      message: (e as Error)?.message || '删除失败',
      data: false,
      success: false,
      timestamp: Date.now(),
    }
  }
}

/** 切换置顶 */
export async function toggleAdminFAQTop(
  id: string,
  isTop: boolean
): Promise<ApiResponse<AdminFAQ>> {
  try {
    const response = await request.put<AdminFAQ>(`/admin/faqs/${id}/top`, { isTop })
    return normalizeApiResponse(response)
  } catch (e) {
    return {
      code: 500,
      message: (e as Error)?.message || '操作失败',
      data: {} as AdminFAQ,
      success: false,
      timestamp: Date.now(),
    }
  }
}
