import type { ApiResult, ApiResponse } from '@ihui/types'

import { useAuthStore } from '@/stores/auth'

/**
 * 统一的 fetch 封装：
 * - 自动携带 Authorization header（从 authStore 读 token）
 * - 统一解析后端 ApiResponse 结构（{ code, message, data }）
 * - 统一错误处理，返回 ApiResult 联合类型
 */
export async function fetchApi<T>(url: string, options: RequestInit = {}): Promise<ApiResult<T>> {
  const token = useAuthStore.getState().token

  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers as Record<string, string> | undefined),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const maxRetries = 1
  let lastError = '网络异常'

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, { ...options, headers, signal: options.signal })

      if (!response.ok) {
        const text = await response.text().catch(() => '')
        return {
          success: false,
          error: text || `请求失败（${response.status}）`,
        }
      }

      const json = (await response.json()) as ApiResponse<T>

      if (json.code !== 0) {
        return { success: false, error: json.message || '请求失败' }
      }

      return { success: true, data: json.data }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return { success: false, error: '请求已取消' }
      }
      lastError = err instanceof Error ? err.message : '网络异常'
      if (attempt < maxRetries) continue
    }
  }

  return { success: false, error: lastError }
}
