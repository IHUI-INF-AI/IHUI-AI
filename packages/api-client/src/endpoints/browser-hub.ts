/**
 * Browser Hub CDP 端点(2026-07-31 立,P0 WorkPanel CDP 升级)
 *
 * 对标 Trae/Cursor 内置浏览器:后端持续 Chromium 实例 + CDP 画面流 + 事件回传。
 * 端点契约见 apps/ai-service/app/routers/browser_hub.py。
 *
 * 路由:/api/browser/sessions/*(Next.js dev 代理到 ai-service:8803)
 * WebSocket:/api/browser/ws/{sessionId}(前端直连 ai-service:8803,不走 Next.js rewrites)
 */

import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client'

/** Browser Hub 会话信息 */
export interface BrowserSessionInfo {
  session_id: string
  url: string
  title: string
  cookie_count: number
}

/** 创建会话请求 */
export interface CreateBrowserSessionRequest {
  url?: string
  viewport_width?: number
  viewport_height?: number
  user_agent?: string | null
}

/** Cookie 项(契约与 Playwright Cookie 一致) */
export interface BrowserCookie {
  name: string
  value: string
  domain: string
  path: string
  expires?: number
  httpOnly?: boolean
  secure?: boolean
  sameSite?: 'Strict' | 'Lax' | 'None'
}

/** 导航结果 */
export interface BrowserNavigateResult {
  url?: string
  title?: string
  [key: string]: unknown
}

/** 创建浏览器会话(每个会话=独立 BrowserContext + Page) */
export async function createBrowserSession(
  req: CreateBrowserSessionRequest = {},
): Promise<ApiResult<BrowserSessionInfo>> {
  return fetchApi<BrowserSessionInfo>('/api/browser/sessions', {
    method: 'POST',
    body: JSON.stringify(req),
  })
}

/** 获取会话信息 */
export async function getBrowserSessionInfo(
  sessionId: string,
): Promise<ApiResult<BrowserSessionInfo>> {
  return fetchApi<BrowserSessionInfo>(`/api/browser/sessions/${sessionId}`, {
    method: 'GET',
  })
}

/** 关闭会话 */
export async function closeBrowserSession(
  sessionId: string,
): Promise<ApiResult<{ session_id: string }>> {
  return fetchApi<{ session_id: string }>(`/api/browser/sessions/${sessionId}`, {
    method: 'DELETE',
  })
}

/** 导航到指定 URL */
export async function navigateBrowser(
  sessionId: string,
  url: string,
  waitUntil: string = 'domcontentloaded',
): Promise<ApiResult<BrowserNavigateResult>> {
  return fetchApi<BrowserNavigateResult>(`/api/browser/sessions/${sessionId}/navigate`, {
    method: 'POST',
    body: JSON.stringify({ url, wait_until: waitUntil }),
  })
}

/** 获取会话 cookies(可选按 URL 过滤) */
export async function getBrowserCookies(
  sessionId: string,
  urls?: string[],
): Promise<ApiResult<{ cookies: BrowserCookie[]; count: number }>> {
  const query = urls && urls.length > 0 ? `?urls=${encodeURIComponent(urls.join(','))}` : ''
  return fetchApi<{ cookies: BrowserCookie[]; count: number }>(
    `/api/browser/sessions/${sessionId}/cookies${query}`,
    { method: 'GET' },
  )
}

/** 后退 */
export async function browserHubBack(
  sessionId: string,
): Promise<ApiResult<{ success: boolean; url: string }>> {
  return fetchApi<{ success: boolean; url: string }>(`/api/browser/sessions/${sessionId}/back`, {
    method: 'POST',
  })
}

/** 前进 */
export async function browserHubForward(
  sessionId: string,
): Promise<ApiResult<{ success: boolean; url: string }>> {
  return fetchApi<{ success: boolean; url: string }>(`/api/browser/sessions/${sessionId}/forward`, {
    method: 'POST',
  })
}

/** 刷新结果(2026-08-02:风控墙重建时返回新 session_id) */
export interface BrowserReloadResult {
  url: string
  session_id?: string
  recreated?: boolean
}

/** 刷新 */
export async function browserHubReload(sessionId: string): Promise<ApiResult<BrowserReloadResult>> {
  return fetchApi<BrowserReloadResult>(`/api/browser/sessions/${sessionId}/reload`, {
    method: 'POST',
  })
}

/**
 * 构建 Browser Hub WebSocket URL。
 *
 * dev 模式直连 ai-service:8803(Next.js rewrites 不代理 WebSocket);
 * 生产模式走同源(由 nginx/CDN 代理到 ai-service)。
 *
 * 必须在客户端调用(依赖 window/location)。
 */

// Node 环境(tsconfig 无 DOM lib)无 window 全局,显式声明类型避免 TS2304。
// 运行时 typeof window === 'undefined' 判定仍正确(Node 下返回 'undefined')。
declare const window: { location: { protocol: string; host: string } } | undefined

export function buildBrowserWsUrl(sessionId: string): string {
  if (typeof window === 'undefined') {
    // SSR 防护:返回占位 URL,实际不应在 SSR 调用
    return `ws://localhost:8803/api/browser/ws/${sessionId}`
  }
  if (process.env.NODE_ENV !== 'production') {
    return `ws://localhost:8803/api/browser/ws/${sessionId}`
  }
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${window.location.host}/api/browser/ws/${sessionId}`
}
