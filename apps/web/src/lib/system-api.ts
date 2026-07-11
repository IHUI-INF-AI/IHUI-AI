/**
 * 系统相关 API
 * 合并迁移自旧架构：app-version, behavior, category, monitor, settings, statistics, visit
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '@/lib/api'
import { buildQs, type PageData } from '@/lib/edu'

// ===================== 类型定义 =====================

export interface PageQuery {
  page?: number
  pageSize?: number
  [key: string]: string | number | undefined | null
}

/** 应用版本 */
export interface AppVersion {
  id: string
  version: string
  platform: 'web' | 'android' | 'ios' | 'miniapp'
  downloadUrl?: string
  forceUpdate?: boolean
  description?: string
  releaseNotes?: string
  status?: number
  createdAt: string
  [key: string]: unknown
}

/** 版本检查结果 */
export interface VersionCheckResult {
  hasUpdate: boolean
  latestVersion?: string
  currentVersion?: string
  forceUpdate?: boolean
  downloadUrl?: string
  releaseNotes?: string
  [key: string]: unknown
}

/** 行为记录 */
export interface BehaviorRecord {
  id: string
  userId?: string
  action: string
  targetType?: string
  targetId?: string
  metadata?: Record<string, unknown>
  ip?: string
  userAgent?: string
  createTime: string
  [key: string]: unknown
}

/** 分类 */
export interface Category {
  id: string | number
  name: string
  parentId?: string | number
  icon?: string
  sort?: number
  status?: number
  type?: string
  description?: string
  children?: Category[]
  [key: string]: unknown
}

/** 监控指标 */
export interface MonitorMetric {
  name: string
  value: number
  unit?: string
  status?: 'normal' | 'warning' | 'critical'
  timestamp?: string
  [key: string]: unknown
}

/** 监控状态 */
export interface MonitorStatus {
  status: 'healthy' | 'degraded' | 'down'
  services?: Array<{
    name: string
    status: string
    latency?: number
    message?: string
  }>
  timestamp?: string
  [key: string]: unknown
}

/** 用户设置 */
export interface UserSettings {
  notifications?: {
    email?: boolean
    sms?: boolean
    push?: boolean
    [key: string]: unknown
  }
  privacy?: {
    profileVisible?: boolean
    activityVisible?: boolean
    searchVisible?: boolean
    [key: string]: unknown
  }
  preferences?: {
    theme?: string
    language?: string
    timezone?: string
    [key: string]: unknown
  }
  [key: string]: unknown
}

/** 登录设备 */
export interface LoginDevice {
  id: string
  deviceName: string
  deviceType: string
  browser: string
  os: string
  ip: string
  location: string
  lastActive: string
  isCurrent: boolean
  [key: string]: unknown
}

/** 安全日志 */
export interface SecurityLog {
  id: string
  type:
    | 'login'
    | 'logout'
    | 'password_change'
    | 'email_change'
    | 'phone_change'
    | 'two_factor_enable'
    | 'two_factor_disable'
  description: string
  ip: string
  location: string
  device: string
  createTime: string
  status: 'success' | 'failed'
  [key: string]: unknown
}

/** 统计数据 */
export interface StatisticsData {
  total?: number
  today?: number
  week?: number
  month?: number
  growth?: number
  trend?: Array<{ date: string; value: number }>
  [key: string]: unknown
}

/** 访问记录 */
export interface VisitRecord {
  id: string
  userId?: string
  page: string
  referrer?: string
  ip?: string
  userAgent?: string
  duration?: number
  visitTime: string
  [key: string]: unknown
}

// ===================== app-version（应用版本） =====================

/** 检查应用版本更新 */
export async function checkAppVersion(input: {
  version: string
  platform: AppVersion['platform']
}): Promise<ApiResult<VersionCheckResult>> {
  return fetchApi<VersionCheckResult>('/api/app-version/check', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** 获取应用版本列表 */
export async function getAppVersions(
  query: PageQuery = {},
): Promise<ApiResult<PageData<AppVersion>>> {
  return fetchApi<PageData<AppVersion>>(`/api/app-version${buildQs(query)}`)
}

/** 获取最新版本 */
export async function getLatestVersion(
  platform: AppVersion['platform'],
): Promise<ApiResult<AppVersion>> {
  return fetchApi<AppVersion>(`/api/app-version/latest${buildQs({ platform })}`)
}

/** 创建应用版本 */
export async function createAppVersion(input: Partial<AppVersion>): Promise<ApiResult<AppVersion>> {
  return fetchApi<AppVersion>('/api/app-version', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** 更新应用版本 */
export async function updateAppVersion(
  id: string,
  input: Partial<AppVersion>,
): Promise<ApiResult<AppVersion>> {
  return fetchApi<AppVersion>(`/api/app-version/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

/** 删除应用版本 */
export async function deleteAppVersion(id: string): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/api/app-version/${id}`, { method: 'DELETE' })
}

// ===================== behavior（行为记录） =====================

/** 记录用户行为 */
export async function recordBehavior(input: {
  action: string
  targetType?: string
  targetId?: string
  metadata?: Record<string, unknown>
}): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>('/api/behavior', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** 获取行为记录列表 */
export async function getBehaviors(
  query: PageQuery & { userId?: string; action?: string } = {},
): Promise<ApiResult<PageData<BehaviorRecord>>> {
  return fetchApi<PageData<BehaviorRecord>>(`/api/behavior${buildQs(query)}`)
}

// ===================== category（分类） =====================

/** 获取分类列表 */
export async function getCategories(
  query: { type?: string; parentId?: string | number } = {},
): Promise<ApiResult<Category[]>> {
  return fetchApi<Category[]>(`/api/category${buildQs(query)}`)
}

/** 获取分类树 */
export async function getCategoryTree(type?: string): Promise<ApiResult<Category[]>> {
  return fetchApi<Category[]>(`/api/category/tree${buildQs(type ? { type } : {})}`)
}

/** 获取分类详情 */
export async function getCategoryDetail(id: string | number): Promise<ApiResult<Category>> {
  return fetchApi<Category>(`/api/category/${id}`)
}

/** 创建分类 */
export async function createCategory(input: Partial<Category>): Promise<ApiResult<Category>> {
  return fetchApi<Category>('/api/category', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** 更新分类 */
export async function updateCategory(
  id: string | number,
  input: Partial<Category>,
): Promise<ApiResult<Category>> {
  return fetchApi<Category>(`/api/category/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

/** 删除分类 */
export async function deleteCategory(
  id: string | number,
): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/api/category/${id}`, { method: 'DELETE' })
}

// ===================== monitor（监控） =====================

/** 获取系统监控状态 */
export async function getMonitorStatus(): Promise<ApiResult<MonitorStatus>> {
  return fetchApi<MonitorStatus>('/api/monitor/status')
}

/** 获取监控指标 */
export async function getMonitorMetrics(
  query: { names?: string; start?: string; end?: string } = {},
): Promise<ApiResult<MonitorMetric[]>> {
  return fetchApi<MonitorMetric[]>(`/api/monitor/metrics${buildQs(query)}`)
}

/** 获取服务健康状态 */
export async function getServicesHealth(): Promise<ApiResult<MonitorStatus['services']>> {
  return fetchApi<MonitorStatus['services']>('/api/monitor/services')
}

// ===================== settings（设置） =====================

/** 获取用户设置 */
export async function getUserSettings(): Promise<ApiResult<UserSettings>> {
  return fetchApi<UserSettings>('/api/settings')
}

/** 更新用户设置 */
export async function updateUserSettings(data: Partial<UserSettings>): Promise<ApiResult<void>> {
  return fetchApi<void>('/api/settings', {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

/** 更新通知设置 */
export async function updateNotificationSettings(
  data: NonNullable<UserSettings['notifications']>,
): Promise<ApiResult<void>> {
  return fetchApi<void>('/api/settings/notifications', {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

/** 更新隐私设置 */
export async function updatePrivacySettings(
  data: NonNullable<UserSettings['privacy']>,
): Promise<ApiResult<void>> {
  return fetchApi<void>('/api/settings/privacy', {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

/** 更新偏好设置 */
export async function updatePreferences(
  data: NonNullable<UserSettings['preferences']>,
): Promise<ApiResult<void>> {
  return fetchApi<void>('/api/settings/preferences', {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

/** 获取登录设备列表 */
export async function getLoginDevices(): Promise<ApiResult<LoginDevice[]>> {
  return fetchApi<LoginDevice[]>('/api/settings/devices')
}

/** 移除登录设备 */
export async function removeLoginDevice(deviceId: string): Promise<ApiResult<void>> {
  return fetchApi<void>(`/api/settings/devices/${deviceId}`, { method: 'DELETE' })
}

/** 获取安全日志 */
export async function getSecurityLogs(
  query: PageQuery & { type?: string; startDate?: string; endDate?: string } = {},
): Promise<ApiResult<PageData<SecurityLog>>> {
  return fetchApi<PageData<SecurityLog>>(`/api/settings/security-logs${buildQs(query)}`)
}

/** 导出用户数据 */
export async function exportUserData(): Promise<
  ApiResult<{ url: string; filename: string; expiresAt: string }>
> {
  return fetchApi<{ url: string; filename: string; expiresAt: string }>('/api/settings/export', {
    method: 'POST',
  })
}

/** 清除所有数据 */
export async function clearAllData(): Promise<ApiResult<void>> {
  return fetchApi<void>('/api/settings/clear-data', { method: 'POST' })
}

/** 删除账户 */
export async function deleteAccount(password: string, reason?: string): Promise<ApiResult<void>> {
  return fetchApi<void>('/api/settings/delete-account', {
    method: 'POST',
    body: JSON.stringify({ password, reason }),
  })
}

/** 获取账户删除状态 */
export async function getAccountDeletionStatus(): Promise<
  ApiResult<{
    isScheduled: boolean
    scheduledDate?: string
    canCancel: boolean
  }>
> {
  return fetchApi<{
    isScheduled: boolean
    scheduledDate?: string
    canCancel: boolean
  }>('/api/settings/delete-account/status')
}

/** 取消账户删除 */
export async function cancelAccountDeletion(): Promise<ApiResult<void>> {
  return fetchApi<void>('/api/settings/delete-account/cancel', { method: 'POST' })
}

// ===================== statistics（统计） =====================

/** 获取总体统计数据 */
export async function getStatistics(
  query: { type?: string; start?: string; end?: string } = {},
): Promise<ApiResult<StatisticsData>> {
  return fetchApi<StatisticsData>(`/api/statistics${buildQs(query)}`)
}

/** 获取用户统计 */
export async function getUserStatistics(
  query: { start?: string; end?: string } = {},
): Promise<ApiResult<StatisticsData>> {
  return fetchApi<StatisticsData>(`/api/statistics/users${buildQs(query)}`)
}

/** 获取访问统计 */
export async function getVisitStatistics(
  query: { start?: string; end?: string } = {},
): Promise<ApiResult<StatisticsData>> {
  return fetchApi<StatisticsData>(`/api/statistics/visits${buildQs(query)}`)
}

/** 获取订单统计 */
export async function getOrderStatistics(
  query: { start?: string; end?: string } = {},
): Promise<ApiResult<StatisticsData>> {
  return fetchApi<StatisticsData>(`/api/statistics/orders${buildQs(query)}`)
}

// ===================== visit（访问记录） =====================

/** 记录访问 */
export async function recordVisit(input: {
  page: string
  referrer?: string
  duration?: number
}): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>('/api/visit', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** 获取访问记录列表 */
export async function getVisits(
  query: PageQuery & { userId?: string; page_path?: string } = {},
): Promise<ApiResult<PageData<VisitRecord>>> {
  return fetchApi<PageData<VisitRecord>>(`/api/visit${buildQs(query)}`)
}

/** 获取访问统计 */
export async function getVisitStats(
  query: { start?: string; end?: string } = {},
): Promise<ApiResult<StatisticsData>> {
  return fetchApi<StatisticsData>(`/api/visit/stats${buildQs(query)}`)
}
