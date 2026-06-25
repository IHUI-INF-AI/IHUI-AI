import request from '@/utils/request'
import { t } from '@/utils/i18n'
import type { ApiResponse } from '@/types'
import { withApiResponseHandler, normalizeApiResponse } from '@/utils/api-response'

// FAQ 接口
export interface FAQ {
  id: string
  category: string
  question: string
  answer: string
  tags?: string[]
  helpful?: number
  notHelpful?: number
  viewCount?: number
  order?: number
  createTime?: string
  updateTime?: string
}

// FAQ 分类
export interface FAQCategory {
  key: string
  label: string
  icon?: string
  count?: number
}

// 获取 FAQ 列表
export const getFAQs = withApiResponseHandler(
  async (params?: {
    category?: string
    search?: string
    page?: number
    pageSize?: number
  }): Promise<ApiResponse<FAQ[]>> => {
    if (import.meta.env.DEV) {
      // 开发环境返回模拟数据
      const faqs: FAQ[] = Array.from({ length: 10 }).map((_, i) => {
        const id = String(i + 1)
        const categories = ['account', 'security', 'payment', 'usage', 'settings']
        const category = categories[i % categories.length]
        return {
          id,
          category,
          question: `开发环境 FAQ ${id} - 这是问题标题`,
          answer: `这是 FAQ ${id} 的详细答案内容。`,
          tags: ['标签1', '标签2'],
          helpful: Math.floor(Math.random() * 100),
          notHelpful: Math.floor(Math.random() * 10),
          viewCount: Math.floor(Math.random() * 500),
          order: i + 1,
          createTime: new Date().toISOString(),
        }
      })
      return {
        code: 200,
        success: true,
        message: 'mock',
        data: faqs,
        timestamp: Date.now(),
      }
    }
    const response = await request.get<FAQ[]>('/help/faqs', { params })
    return normalizeApiResponse(response)
  }
)

// 获取 FAQ 分类列表
export const getFAQCategories = withApiResponseHandler(
  async (): Promise<ApiResponse<FAQCategory[]>> => {
    if (import.meta.env.DEV) {
      const categories: FAQCategory[] = [
        { key: 'all', label: t('text.help.全部'), count: 10 },
        { key: 'account', label: t('text.help.账户相关1'), count: 2 },
        { key: 'security', label: t('text.help.安全隐私2'), count: 2 },
        { key: 'payment', label: t('text.help.支付充值3'), count: 2 },
        { key: 'usage', label: t('text.help.使用指南4'), count: 2 },
        { key: 'settings', label: t('text.help.系统设置5'), count: 2 },
      ]
      return {
        code: 200,
        success: true,
        message: 'mock',
        data: categories,
        timestamp: Date.now(),
      }
    }
    const response = await request.get<FAQCategory[]>('/help/categories')
    return normalizeApiResponse(response)
  }
)

// 标记 FAQ 为有用
export const markFAQHelpful = withApiResponseHandler(
  async (faqId: string): Promise<ApiResponse<{ helpful: number }>> => {
    if (import.meta.env.DEV) {
      return {
        code: 200,
        success: true,
        message: 'mock',
        data: { helpful: Math.floor(Math.random() * 100) + 1 },
        timestamp: Date.now(),
      }
    }
    const response = await request.post<{ helpful: number }>(`/help/faqs/${faqId}/helpful`)
    return normalizeApiResponse(response)
  }
)

// 标记 FAQ 为无用
export const markFAQNotHelpful = withApiResponseHandler(
  async (faqId: string): Promise<ApiResponse<{ notHelpful: number }>> => {
    if (import.meta.env.DEV) {
      return {
        code: 200,
        success: true,
        message: 'mock',
        data: { notHelpful: Math.floor(Math.random() * 10) + 1 },
        timestamp: Date.now(),
      }
    }
    const response = await request.post<{ notHelpful: number }>(`/help/faqs/${faqId}/not-helpful`)
    return normalizeApiResponse(response)
  }
)

// 记录 FAQ 查看
export const recordFAQView = withApiResponseHandler(
  async (faqId: string): Promise<ApiResponse<boolean>> => {
    if (import.meta.env.DEV) {
      return {
        code: 200,
        success: true,
        message: 'mock',
        data: true,
        timestamp: Date.now(),
      }
    }
    const response = await request.post<boolean>(`/help/faqs/${faqId}/view`)
    return normalizeApiResponse(response)
  }
)
