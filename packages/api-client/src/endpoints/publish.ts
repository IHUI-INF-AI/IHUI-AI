/**
 * 多平台一键发布 API 端点(2026-07-30 新增)。
 *
 * 覆盖:
 * - 账号管理(列表/创建/更新/删除/验证)
 * - 任务管理(创建/查询/取消/重试)
 * - 历史/统计/上传
 * - 扫码登录(2026-07-30 新增,WorkPanel 内置浏览器扫码 → 自动保存 cookies)
 */

import type { ApiResult } from '@ihui/types'

import { fetchApi, fetchRaw } from '../client'

// =============================================================================
// 账号管理
// =============================================================================
export interface PublishAccount {
  id: number
  userId: string
  platform: string
  displayName: string
  status: string
  lastVerifiedAt: string | null
  lastVerifyMsg: string | null
  createdAt: string
  updatedAt: string
}

export async function listPublishAccounts(
  userId: string,
): Promise<ApiResult<{ items: PublishAccount[] }>> {
  return fetchApi(`/api/publish/accounts/${encodeURIComponent(userId)}`)
}

export async function createPublishAccount(body: {
  platform: string
  display_name: string
  credentials: Record<string, string>
}): Promise<ApiResult<PublishAccount>> {
  return fetchApi('/api/publish/accounts', { method: 'POST', body: JSON.stringify(body) })
}

export async function updatePublishAccount(
  accountId: number,
  body: { display_name?: string; credentials?: Record<string, string> },
): Promise<ApiResult<PublishAccount>> {
  return fetchApi(`/api/publish/accounts/${accountId}`, { method: 'PUT', body: JSON.stringify(body) })
}

export async function deletePublishAccount(accountId: number): Promise<ApiResult<unknown>> {
  return fetchApi(`/api/publish/accounts/${accountId}`, { method: 'DELETE' })
}

export async function verifyPublishAccount(accountId: number): Promise<ApiResult<unknown>> {
  return fetchApi(`/api/publish/accounts/${accountId}/verify`, { method: 'POST' })
}

// =============================================================================
// 任务管理
// =============================================================================
export interface PublishTask {
  id: number
  userId: string
  title: string
  contentMd?: string
  contentHtml?: string
  platforms: string[]
  status: string
  scheduledAt?: string | null
  createdAt: string
  completedAt?: string | null
  errorMessage?: string | null
}

export async function createPublishTask(body: {
  title: string
  content_md?: string
  content_html?: string
  platforms: string[]
  scheduled_at?: string
  account_ids?: number[]
}): Promise<ApiResult<PublishTask>> {
  return fetchApi('/api/publish/tasks', { method: 'POST', body: JSON.stringify(body) })
}

export async function listPublishTasks(params?: {
  status?: string
  limit?: number
  offset?: number
}): Promise<ApiResult<{ items: PublishTask[]; total: number }>> {
  const qs = params
    ? '?' +
      Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&')
    : ''
  return fetchApi(`/api/publish/tasks${qs}`)
}

export async function getPublishTask(taskId: number): Promise<ApiResult<PublishTask>> {
  return fetchApi(`/api/publish/tasks/${taskId}`)
}

export async function cancelPublishTask(taskId: number): Promise<ApiResult<unknown>> {
  return fetchApi(`/api/publish/tasks/${taskId}/cancel`, { method: 'POST' })
}

export async function retryPublishTask(taskId: number): Promise<ApiResult<unknown>> {
  return fetchApi(`/api/publish/tasks/${taskId}/retry`, { method: 'POST' })
}

// =============================================================================
// 扫码登录(2026-07-30 新增,WorkPanel 内置浏览器扫码 → 自动保存 cookies)
// =============================================================================
export interface ScanLoginPlatform {
  platform: string
  name: string
  login_url: string
  success_cookies: string[]
}

export interface ScanLoginTask {
  task_id: string
  user_id: string
  platform: string
  status: 'pending' | 'waiting_scan' | 'scanned' | 'success' | 'failed' | 'timeout' | 'cancelled'
  message: string
  has_qr: boolean
  qr_updated_at: number
  cookies_count: number
  account_id: number | null
  created_at: number
  completed_at: number | null
}

export async function listScanLoginPlatforms(): Promise<ApiResult<{ platforms: ScanLoginPlatform[] }>> {
  return fetchApi('/api/publish/scan-login/platforms')
}

export async function startScanLogin(
  platform: string,
): Promise<ApiResult<{ task_id: string; platform: string; status: string; snapshot: ScanLoginTask }>> {
  return fetchApi('/api/publish/scan-login/start', {
    method: 'POST',
    body: JSON.stringify({ platform }),
  })
}

export async function getScanLoginStatus(taskId: string): Promise<ApiResult<ScanLoginTask>> {
  return fetchApi(`/api/publish/scan-login/${encodeURIComponent(taskId)}/status`)
}

/** 获取扫码二维码截图 URL(直接给 <img src> 用,需带 auth cookie)。 */
export function getScanLoginQrUrl(taskId: string): string {
  return `/api/publish/scan-login/${encodeURIComponent(taskId)}/qr`
}

/** 用 fetchRaw 拉取 PNG 字节(备用,前端 img src 直接用 URL 即可)。 */
export async function fetchScanLoginQr(taskId: string): Promise<Blob> {
  return fetchRaw(`/api/publish/scan-login/${encodeURIComponent(taskId)}/qr`)
}

export async function cancelScanLogin(taskId: string): Promise<ApiResult<{ task_id: string; cancelled: boolean }>> {
  return fetchApi(`/api/publish/scan-login/${encodeURIComponent(taskId)}/cancel`, { method: 'POST' })
}

// =============================================================================
// CDP 扫码登录(2026-07-31 新增,WorkPanel 内置浏览器 CDP 模式)
// =============================================================================
/** CDP 登录检测结果 */
export interface CdpDetectResult {
  /** 是否检测到登录成功 cookies */
  detected: boolean
  /** 当前会话 cookies 总数 */
  cookies_count: number
  /** 保存到的账号 ID(detected=true 时有值) */
  account_id: number | null
  /** 错误信息(detected=false 时可能有) */
  error?: string | null
}

/**
 * 从 BrowserHub CDP 会话检测登录态 + 自动保存账号。
 *
 * WorkPanel CDP 扫码登录流程(前端轮询调用):
 * 1. createBrowserSession(url=平台登录页) → WorkPanel 打开 CDP 画面
 * 2. 用户在 CDP 画面里扫码登录
 * 3. 每 3s 调本函数 → 后端从 BrowserHub 拿 cookies → 检测 success_cookies
 * 4. detected=true → 命中则加密保存 → 前端 closeBrowserSession + 刷新账号列表
 */
export async function detectLoginFromCdp(
  sessionId: string,
  platform: string,
): Promise<ApiResult<CdpDetectResult>> {
  return fetchApi<CdpDetectResult>('/api/publish/scan-login/detect-from-cdp', {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId, platform }),
  })
}
