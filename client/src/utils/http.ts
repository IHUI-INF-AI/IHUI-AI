/**
 * HTTP 客户端封装 - 基于 fetch，统一 token 注入和响应适配
 * 后端响应格式: { code: 0, message: 'success', data: T }
 * 前端期望格式: { code: 200, success: true, message: '', data: T }
 */
import { getUserToken } from '@/utils/request'
import type { ApiResponse, Recordable } from '@/types'

const BASE_URL = '/api'

class ApiError extends Error {
  constructor(public code: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T = any>(
  method: string,
  path: string,
  params?: Recordable,
  body?: Recordable,
): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`, window.location.origin)
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v != null && v !== '') url.searchParams.set(k, String(v))
    })
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  const token = getUserToken()
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  const json = await res.json()

  // 后端 code: 0 = 成功, 非 0 = 错误
  if (json.code !== 0) {
    throw new ApiError(json.code ?? res.status, json.message || '请求失败')
  }

  return json.data as T
}

/** 适配前端 ApiResponse 格式 */
function toApiResponse<T>(data: T): ApiResponse<T> {
  return { code: 200, success: true, message: '', data }
}

export const http = {
  get: <T = any>(path: string, params?: Recordable) => request<T>('GET', path, params),
  post: <T = any>(path: string, body?: Recordable) => request<T>('POST', path, undefined, body),
  put: <T = any>(path: string, body?: Recordable) => request<T>('PUT', path, undefined, body),
  patch: <T = any>(path: string, body?: Recordable) => request<T>('PATCH', path, undefined, body),
  delete: <T = any>(path: string, params?: Recordable) => request<T>('DELETE', path, params),
  toApiResponse,
}

export { ApiError }
