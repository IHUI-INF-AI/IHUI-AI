// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * API 桥接层 — 将 @ihui/api-client 的 ApiResult<T> 解包为 miniapp-taro 期望的 Promise<T>。
 *
 * 保留与原 utils/request.ts 相同的错误处理行为:
 * - 401: 结束本地会话(不落登出标记) + toast + 跳转登录页
 * - 其他错误: toast 提示 + throw
 */
import { t } from '@/i18n'
import Taro from '@tarojs/taro'
import type { ApiResult } from '@ihui/types'
import { fetchApi, type FetchApiOptions } from '@ihui/api-client'
import { isTokenExpired } from '@ihui/shared/constants'
import { expireAuth, getToken, goToLogin } from './auth'

/**
 * 解包 ApiResult,失败时 toast + throw(行为与原 request.ts 一致)。
 *
 * ⚠️ 401 分两型,此前被当成一型,那正是"小程序未登录就被踢到登录页"的闸口:
 *  - **有凭据却被打回 401** = 会话真过期/被撤 ⇒ 清凭据 + 提示 + 去登录页(原行为,保留)。
 *  - **压根没凭据** = 游客打到了鉴权端点 ⇒ 没有任何会话可过期,清凭据是空操作,
 *    而 `reLaunch` 到登录页就是机主要拆的那道"登录墙"(2026-10-23 实测:未登录停在
 *    「我的」页,端内仍发 `GET /api/ai/history` → 401 → 800ms 后被弹回登录页,
 *    于是页面里那个"该由用户主动点开的登录弹窗"永远走不到)。
 *
 * 凭据有没有,必须在 **await 之前**读:`expireAuth()` 与刷新失败都会清掉本地票,
 * 晚一步读就把"真过期"读成"游客",那一型恰恰必须跳登录页。
 */
export async function unwrapApi<T>(p: Promise<ApiResult<T>>): Promise<T> {
  const hadCredential = getToken().length > 0
  const r = await p
  if (!r.success) {
    if (isTokenExpired(r.status ?? 0)) {
      if (!hadCredential) {
        // 不 toast、不跳转:页面自己渲染未登录空态/引导。抛错保留原契约(调用方按失败处理)。
        throw new Error(r.error || '未登录')
      }
      expireAuth()
      Taro.showToast({ title: t('auth.expired'), icon: 'none' })
      // 去向只有 `goToLogin()` 一个出口(登录页已删 ⇒ 这里不能再各自硬编码路由串)
      setTimeout(goToLogin, 800)
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
