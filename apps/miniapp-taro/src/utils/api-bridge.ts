/**
 * API 桥接层 — 将 @ihui/api-client 的 ApiResult<T> 解包为 miniapp-taro 期望的 Promise<T>。
 *
 * 保留与原 utils/request.ts 相同的错误处理行为:
 * - 401: 清理登录态 + toast + 跳转登录页
 * - 其他错误: toast 提示 + throw
 */
import Taro from '@tarojs/taro'
import type { ApiResult } from '@ihui/types'
import { fetchApi, type FetchApiOptions } from '@ihui/api-client'
import { clearAuth } from './auth'

/** 解包 ApiResult,失败时 toast + throw(行为与原 request.ts 一致) */
export async function unwrapApi<T>(p: Promise<ApiResult<T>>): Promise<T> {
  const r = await p
  if (!r.success) {
    if (r.status === 401) {
      clearAuth()
      Taro.showToast({ title: '登录已过期，请重新登录', icon: 'none' })
      setTimeout(() => Taro.reLaunch({ url: '/pages/login/login' }), 800)
    } else {
      Taro.showToast({ title: r.error, icon: 'none' })
    }
    throw new Error(r.error)
  }
  return r.data
}

/* ============ HTTP 方法助手(替代 utils/request.ts,统一走 @ihui/api-client fetchApi) ============ */
// 行为与原 utils/request.ts 等价:
//   - GET: data 作为 query string(Taro.request GET 语义)
//   - POST/PUT/PATCH/DELETE: data 作为 JSON body
//   - 错误处理(401 跳登录 / toast / throw)由 unwrapApi 统一承接,与旧 request.ts 一致
type _Query = Record<string, string | number | boolean | undefined | null>

/** GET 请求:data 作为 query string */
export function get<T = unknown>(
  url: string,
  data?: unknown,
  header?: Record<string, string>,
): Promise<T> {
  const opts: FetchApiOptions = { method: 'GET', headers: header }
  if (data !== null && data !== undefined) opts.params = data as _Query
  return unwrapApi(fetchApi<T>(url, opts))
}

/** POST 请求:data 作为 JSON body */
export function post<T = unknown>(
  url: string,
  data?: unknown,
  header?: Record<string, string>,
): Promise<T> {
  const opts: FetchApiOptions = { method: 'POST', headers: header }
  if (data !== undefined) opts.body = JSON.stringify(data)
  return unwrapApi(fetchApi<T>(url, opts))
}

/** PUT 请求:data 作为 JSON body */
export function put<T = unknown>(
  url: string,
  data?: unknown,
  header?: Record<string, string>,
): Promise<T> {
  const opts: FetchApiOptions = { method: 'PUT', headers: header }
  if (data !== undefined) opts.body = JSON.stringify(data)
  return unwrapApi(fetchApi<T>(url, opts))
}

/** PATCH 请求:data 作为 JSON body */
export function patch<T = unknown>(
  url: string,
  data?: unknown,
  header?: Record<string, string>,
): Promise<T> {
  const opts: FetchApiOptions = { method: 'PATCH', headers: header }
  if (data !== undefined) opts.body = JSON.stringify(data)
  return unwrapApi(fetchApi<T>(url, opts))
}

/** DELETE 请求 */
export function del<T = unknown>(
  url: string,
  data?: unknown,
  header?: Record<string, string>,
): Promise<T> {
  const opts: FetchApiOptions = { method: 'DELETE', headers: header }
  if (data !== undefined) opts.body = JSON.stringify(data)
  return unwrapApi(fetchApi<T>(url, opts))
}
