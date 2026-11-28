// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Browser Hub CDP 端点(2026-07-31 立,P0 WorkPanel CDP 升级)
 *
 * /Cursor 内置浏览器:后端持续 Chromium 实例 + CDP 画面流 + 事件回传。
 * 端点契约见 apps/ai-service/app/routers/browser_hub.py。
 *
 * 路由:/api/browser/sessions/*(Next.js dev 代理到 ai-service:8803)
 * WebSocket:/api/browser/ws/{sessionId}(前端直连 ai-service:8803,不走 Next.js rewrites)
 */

import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'

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

/** Browser Hub 会话列表(2026-11-25 补:桌面自动监看需要发现服务端新会话) */
export interface BrowserSessionList {
  session_ids: string[]
  count: number
}

/** 检查点等待项(聊天输入区提示条;2026-11-26 补) */
export interface BrowserCheckpointAttention {
  session_id: string
  task_id: string | null
  goal: string | null
  url: string
  title: string
  timed_out: boolean
  phase: { phase?: string; reason?: string | null }
  checkpoint: {
    id: string
    label: string
    label_key: string | null
    match: string | null
    status: 'pending' | 'active' | 'done'
    entered_at: string | null
    done_at: string | null
    timed_out: boolean
  }
}

/** 列出当前用户所有 Browser Hub 会话 */
export async function listBrowserSessions(): Promise<ApiResult<BrowserSessionList>> {
  return fetchApi<BrowserSessionList>('/api/browser/sessions', {
    method: 'GET',
  })
}

/** 列出检查点正在等用户处理的会话(聊天输入区提示条轮询) */
export async function listBrowserCheckpointAttention(): Promise<
  ApiResult<{ sessions: BrowserCheckpointAttention[]; count: number }>
> {
  return fetchApi<{ sessions: BrowserCheckpointAttention[]; count: number }>(
    '/api/browser/sessions/attention',
    { method: 'GET' },
  )
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

/** 任务模板(2026-11-25 内置;2026-11-26 加用户自定义,与服务端同字段) */
export interface BrowserTaskTemplate {
  id: string
  /** 自定义模板名称;内置模板由前端按 id 本地化,可缺省。 */
  name?: string
  /** builtin=内置只读;custom=当前用户自建(跨设备持久化)。 */
  source?: 'builtin' | 'custom'
  goal: string
  requirements: string[]
  checkpoints: Array<{
    id: string
    label: string
    match: string | null
    label_key?: string | null
  }>
  /** 该模板的检查点等待上限(秒);超时只标记,不自动恢复。 */
  checkpoint_timeout_seconds: number
  updated_at?: string
}

/** 自定义模板保存载荷(可视化编辑器提交;id 空=新建) */
export interface SaveBrowserTaskTemplateRequest {
  id?: string
  name: string
  goal: string
  requirements: string[]
  checkpoints: Array<{
    id: string
    label: string
    match?: string | null
  }>
  checkpoint_timeout_seconds?: number
}

/** 会话内检查点状态 */
export interface BrowserTaskCheckpoint {
  id: string
  label: string
  label_key: string | null
  match: string | null
  status: 'pending' | 'active' | 'done'
  entered_at: string | null
  done_at: string | null
  /** 服务端派生:超过等待上限;仍保持 active,不会自动恢复。 */
  timed_out: boolean
}

/** 会话内任务快照 */
export interface BrowserTaskSnapshot {
  task_id: string
  template_id: string | null
  goal: string
  requirements: string[]
  checkpoints: BrowserTaskCheckpoint[]
  /** 本任务的检查点等待上限(秒);默认 15 分钟,范围 60..3600。 */
  checkpoint_timeout_seconds: number
  status: 'active' | 'cleared'
  created_at: string | null
}

export interface BindBrowserTaskRequest {
  template_id?: string
  goal?: string
  requirements?: string[]
  checkpoints?: Array<{ id: string; label: string; match?: string | null }>
  /** 覆盖模板默认的检查点等待上限(秒),范围 60..3600。 */
  checkpoint_timeout_seconds?: number
}

/** 按模板开监看:没有现成会话时由服务端自动创建 */
export interface StartBrowserTaskTemplateRequest {
  session_id?: string
  url?: string
  goal?: string
  checkpoint_timeout_seconds?: number
}

export interface StartBrowserTaskTemplateResult {
  session_id: string
  url: string
  title: string
  auto_created: boolean
  task: BrowserTaskSnapshot
}

/** 一键按模板开监看(有会话复用,无会话自动建) */
export async function startBrowserTaskTemplate(
  templateId: string,
  req: StartBrowserTaskTemplateRequest = {},
): Promise<ApiResult<StartBrowserTaskTemplateResult>> {
  return fetchApi<StartBrowserTaskTemplateResult>(
    `/api/browser/task-templates/${encodeURIComponent(templateId)}/start`,
    {
      method: 'POST',
      body: JSON.stringify(req),
    },
  )
}

/** 任务模板目录(内置只读 + 当前用户自定义) */
export async function listBrowserTaskTemplates(): Promise<
  ApiResult<{ templates: BrowserTaskTemplate[]; count: number }>
> {
  return fetchApi<{ templates: BrowserTaskTemplate[]; count: number }>(
    '/api/browser/task-templates',
    { method: 'GET' },
  )
}

/** 新建/更新自定义任务模板(服务端按用户持久化) */
export async function saveBrowserTaskTemplate(
  req: SaveBrowserTaskTemplateRequest,
): Promise<ApiResult<{ template: BrowserTaskTemplate }>> {
  return fetchApi<{ template: BrowserTaskTemplate }>('/api/browser/task-templates', {
    method: 'POST',
    body: JSON.stringify(req),
  })
}

/** 删除当前用户的一条自定义模板 */
export async function deleteBrowserTaskTemplate(
  templateId: string,
): Promise<ApiResult<{ deleted: boolean }>> {
  return fetchApi<{ deleted: boolean }>(
    `/api/browser/task-templates/${encodeURIComponent(templateId)}`,
    { method: 'DELETE' },
  )
}

/** 给会话绑定任务模板 */
export async function bindBrowserTask(
  sessionId: string,
  req: BindBrowserTaskRequest,
): Promise<ApiResult<{ task: BrowserTaskSnapshot }>> {
  return fetchApi<{ task: BrowserTaskSnapshot }>(`/api/browser/sessions/${sessionId}/task`, {
    method: 'POST',
    body: JSON.stringify(req),
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

/** 当前 access token(由应用层在登录后注入;取不到时 WS 连接将被服务端 4401 拒绝) */
let currentAccessToken = ''
export function setBrowserWsToken(token: string): void {
  currentAccessToken = token
}

export function buildBrowserWsUrl(sessionId: string): string {
  // 生产 web 与 API 不同源时(例:www.aizhs.top 的 EdgeOne 边缘不转发
  // /api/browser/ws,实测 404,而 api.aizhs.top 可正常升级),用显式 origin
  // 指向真正承载 WS 的 ai-service;未配置时保持原同源行为,不影响 dev/自建。
  const configuredOrigin = process.env.NEXT_PUBLIC_BROWSER_WS_ORIGIN?.trim().replace(/\/+$/, '')
  const base = configuredOrigin
    ? `${configuredOrigin}/api/browser/ws/${sessionId}`
    : typeof window === 'undefined'
      ? `ws://localhost:8803/api/browser/ws/${sessionId}` // SSR 防护:占位,实际不应在 SSR 调用
      : process.env.NODE_ENV !== 'production'
        ? `ws://localhost:8803/api/browser/ws/${sessionId}`
        : (window.location.protocol === 'https:' ? 'wss' : 'ws') +
          `://${window.location.host}/api/browser/ws/${sessionId}`
  // P0-4(2026-08-05):ai-service WS 握手要求 ?token=<access_token>,否则 close 4401
  const sep = base.includes('?') ? '&' : '?'
  return `${base}${sep}token=${encodeURIComponent(currentAccessToken)}`
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
