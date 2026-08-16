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
  return fetchApi(`/api/publish/accounts/${accountId}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
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

export async function listScanLoginPlatforms(): Promise<
  ApiResult<{ platforms: ScanLoginPlatform[] }>
> {
  return fetchApi('/api/publish/scan-login/platforms')
}

export async function startScanLogin(
  platform: string,
): Promise<
  ApiResult<{ task_id: string; platform: string; status: string; snapshot: ScanLoginTask }>
> {
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

export async function cancelScanLogin(
  taskId: string,
): Promise<ApiResult<{ task_id: string; cancelled: boolean }>> {
  return fetchApi(`/api/publish/scan-login/${encodeURIComponent(taskId)}/cancel`, {
    method: 'POST',
  })
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

// =============================================================================
// 账号分组管理(2026-08-01 新增)
// =============================================================================
export interface PublishAccountGroup {
  group_id: string
  user_id: string
  name: string
  description: string
  account_ids: number[]
  created_at: string
  updated_at: string
}

export async function listPublishGroups(): Promise<
  ApiResult<{ items: PublishAccountGroup[]; count: number }>
> {
  return fetchApi('/api/publish/groups')
}

export async function createPublishGroup(body: {
  name: string
  description?: string
}): Promise<ApiResult<PublishAccountGroup>> {
  return fetchApi('/api/publish/groups', { method: 'POST', body: JSON.stringify(body) })
}

export async function updatePublishGroup(
  groupId: string,
  body: { name?: string; description?: string },
): Promise<ApiResult<PublishAccountGroup>> {
  return fetchApi(`/api/publish/groups/${encodeURIComponent(groupId)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export async function deletePublishGroup(groupId: string): Promise<ApiResult<unknown>> {
  return fetchApi(`/api/publish/groups/${encodeURIComponent(groupId)}`, { method: 'DELETE' })
}

export async function addToPublishGroup(
  groupId: string,
  accountIds: number[],
): Promise<ApiResult<{ added: number }>> {
  return fetchApi(`/api/publish/groups/${encodeURIComponent(groupId)}/add`, {
    method: 'POST',
    body: JSON.stringify({ account_ids: accountIds }),
  })
}

export async function removeFromPublishGroup(
  groupId: string,
  accountIds: number[],
): Promise<ApiResult<{ removed: number }>> {
  return fetchApi(`/api/publish/groups/${encodeURIComponent(groupId)}/remove`, {
    method: 'POST',
    body: JSON.stringify({ account_ids: accountIds }),
  })
}

export async function listPublishGroupMembers(
  groupId: string,
): Promise<ApiResult<{ account_ids: number[]; count: number }>> {
  return fetchApi(`/api/publish/groups/${encodeURIComponent(groupId)}/members`)
}

export async function publishToGroup(
  groupId: string,
  body: {
    title: string
    format: string
    text?: string
    file_path?: string
    cover_path?: string
    html?: string
    images?: string[]
    extra?: Record<string, unknown>
    platform_config?: Record<string, unknown>
  },
): Promise<
  ApiResult<{
    results: Array<{
      account_id: number
      platform: string
      success: boolean
      error?: string
      published_url?: string
    }>
    success_count: number
    failed_count: number
    total: number
  }>
> {
  return fetchApi(`/api/publish/groups/${encodeURIComponent(groupId)}/publish`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

// =============================================================================
// 批量账号导入 / 导出 / 验证 / 模板(2026-08-01 新增)
// =============================================================================
export interface BatchImportRow {
  platform: string
  nickname: string
  credentials: Record<string, string>
}

export interface BatchImportResult {
  success_count: number
  failed_count: number
  errors: Array<{ row: number; error: string }>
  total: number
}

export async function batchImportAccounts(
  rows: BatchImportRow[],
): Promise<ApiResult<BatchImportResult>> {
  return fetchApi('/api/publish/accounts/batch-import', {
    method: 'POST',
    body: JSON.stringify({ rows }),
  })
}

export async function batchExportAccounts(): Promise<ApiResult<{ csv: string; count: number }>> {
  return fetchApi('/api/publish/accounts/batch-export', { method: 'POST' })
}

export interface BatchVerifyResult {
  verified_count: number
  invalid_count: number
  results: Array<{ account_id: number; platform: string; valid: boolean; message: string }>
  total: number
}

export async function batchVerifyAccounts(): Promise<ApiResult<BatchVerifyResult>> {
  return fetchApi('/api/publish/accounts/batch-verify', { method: 'POST' })
}

export async function getBatchImportTemplate(): Promise<ApiResult<{ csv: string }>> {
  return fetchApi('/api/publish/accounts/batch-template')
}

// =============================================================================
// Cookie 健康度 + 手动保活(2026-08-01 新增)
// =============================================================================
export type CookieHealthLevel = 'healthy' | 'expiring' | 'expired'

export interface CookieHealthInfo {
  account_id: number
  platform: string
  level: CookieHealthLevel
  days_since_verified: number | null
  last_verified_at: string | null
  predicted_expiry: string | null
  last_verify_msg: string | null
  status: string
}

export async function getCookieHealth(accountId: number): Promise<ApiResult<CookieHealthInfo>> {
  return fetchApi(`/api/publish/accounts/${accountId}/cookie-health`)
}

export async function refreshAccountCookie(
  accountId: number,
): Promise<ApiResult<{ account_id: number; platform: string; success: boolean; message: string }>> {
  return fetchApi(`/api/publish/accounts/${accountId}/refresh-cookie`, { method: 'POST' })
}

export interface CookieRefreshStats {
  total: number
  success: number
  failed: number
  skipped: number
  last_run_at: string | null
  running: boolean
  interval_hours: number
  auto_enabled: boolean
}

export async function getCookieRefreshStats(): Promise<ApiResult<CookieRefreshStats>> {
  return fetchApi('/api/publish/cookie-refresh/stats')
}

export async function triggerCookieRefresh(): Promise<ApiResult<{ triggered: boolean }>> {
  return fetchApi('/api/publish/cookie-refresh/trigger', { method: 'POST' })
}

// =============================================================================
// 数据分析(2026-08-01 新增)
// =============================================================================

export type AnalyticsPeriod = '7d' | '30d' | '90d'

export interface AnalyticsOverview {
  totalPublished: number
  successRate: number
  avgDurationMs: number
  activeAccounts: number
  trend: ReadonlyArray<{ date: string; count: number }>
  platformDistribution: ReadonlyArray<{ platform: string; count: number; color: string }>
  failureReasons: ReadonlyArray<{ reason: string; count: number }>
}

export interface AccountHealth {
  accountId: number
  platform: string
  displayName: string
  successRate: number
  lastPublishedAt: string | null
  riskStatus: 'safe' | 'low' | 'medium' | 'high'
}

export interface PlatformStat {
  platform: string
  total: number
  successRate: number
  avgDurationMs: number
}

export async function getPublishAnalyticsOverview(
  period: AnalyticsPeriod = '30d',
): Promise<ApiResult<AnalyticsOverview>> {
  return fetchApi<AnalyticsOverview>('/api/publish/analytics/overview', { params: { period } })
}

export async function getPublishAnalyticsAccounts(
  period: AnalyticsPeriod = '30d',
): Promise<ApiResult<AccountHealth[]>> {
  return fetchApi<AccountHealth[]>('/api/publish/analytics/accounts', { params: { period } })
}

export async function getPublishAnalyticsPlatforms(
  period: AnalyticsPeriod = '30d',
): Promise<ApiResult<PlatformStat[]>> {
  return fetchApi<PlatformStat[]>('/api/publish/analytics/platforms', { params: { period } })
}

// =============================================================================
// AI 辅助写作(2026-08-01 新增)
// =============================================================================

export interface AiTitleResult {
  titles: string[]
}

export interface AiTagResult {
  tags: string[]
}

export async function generatePublishTitles(
  content: string,
  platform: string,
  count = 5,
): Promise<ApiResult<AiTitleResult>> {
  return fetchApi<AiTitleResult>('/api/publish/ai/titles', {
    method: 'POST',
    body: JSON.stringify({ content, platform, count }),
  })
}

export async function polishPublishContent(
  content: string,
  style = 'professional',
): Promise<ApiResult<{ content: string }>> {
  return fetchApi<{ content: string }>('/api/publish/ai/polish', {
    method: 'POST',
    body: JSON.stringify({ content, style }),
  })
}

export async function recommendPublishTags(
  content: string,
  platform: string,
  count = 8,
): Promise<ApiResult<AiTagResult>> {
  return fetchApi<AiTagResult>('/api/publish/ai/tags', {
    method: 'POST',
    body: JSON.stringify({ content, platform, count }),
  })
}

export async function generatePublishSummary(
  content: string,
  maxLength = 100,
): Promise<ApiResult<{ summary: string }>> {
  return fetchApi<{ summary: string }>('/api/publish/ai/summary', {
    method: 'POST',
    body: JSON.stringify({ content, max_length: maxLength }),
  })
}

export interface SeoReport {
  score: number
  titleScore: number
  contentScore: number
  keywordDensity: Record<string, number>
  suggestions: string[]
}

export async function analyzePublishSeo(
  title: string,
  content: string,
  platform: string,
): Promise<ApiResult<{ seo: SeoReport }>> {
  return fetchApi<{ seo: SeoReport }>('/api/publish/ai/seo', {
    method: 'POST',
    body: JSON.stringify({ title, content, platform }),
  })
}

export async function suggestPublishCovers(
  content: string,
): Promise<ApiResult<{ covers: string[] }>> {
  return fetchApi<{ covers: string[] }>('/api/publish/ai/cover', {
    method: 'POST',
    body: JSON.stringify({ content }),
  })
}

export interface AiAnalyzeAllResult {
  titles: string[]
  tags: string[]
  summary: string
  seo: SeoReport | null
  covers: string[]
}

export async function analyzePublishAll(
  content: string,
  title: string,
  platform = '',
): Promise<ApiResult<AiAnalyzeAllResult>> {
  return fetchApi<AiAnalyzeAllResult>('/api/publish/ai/analyze-all', {
    method: 'POST',
    body: JSON.stringify({ content, title, platform }),
  })
}
