// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 系统相关 API
 * 合并迁移自旧架构：app-version, behavior, category, monitor, settings, statistics, visit
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'
import { buildQs, type PageData, type PageQuery } from '../utils.js'

// ===================== 类型定义 =====================

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

/** 版本检查结*/
export interface VersionCheckResult {
  hasUpdate: boolean
  latestVersion?: string
  currentVersion?: string
  forceUpdate?: boolean
  downloadUrl?: string
  releaseNotes?: string
  /**
   * 服务端强制最低版本(X.Y.Z);null/缺省 = 没有要求。
   * 2026-10-27 起由 GET /api/app-version/check-update 真的下发(此前客户端读的字段端点从不返回,
   * 那条强更分支结构上不可达);来源是服务端环境变量 IHUI_MIN_VERSION,未配置即 null。
   */
  minimumVersion?: string | null
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

/** 监控状*/
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

/**
 * 安全日志(GET /api/settings/security-logs)。
 * 字段 = `security_logs` 表实列(见 packages/database/src/schema/security-logs.ts):
 * action/ip/userAgent/metadata/createdAt。旧声明里的 type/description/device/createTime
 * 后端从未返回 —— 按旧声明渲染会得到一排 undefined,故按实列重写。
 */
export interface SecurityLog {
  id: string
  userId: string
  action: string
  ip: string | null
  userAgent: string | null
  metadata: unknown
  createdAt: string
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

/** 检查应用版本更*/
export async function checkAppVersion(input: {
  version: string
  platform: AppVersion['platform']
}): Promise<ApiResult<VersionCheckResult>> {
  return fetchApi<VersionCheckResult>(`/api/app-version/check-update${buildQs(input)}`)
}

/** 获取应用版本列表 */
export async function getAppVersions(
  query: PageQuery = {},
): Promise<ApiResult<PageData<AppVersion>>> {
  return fetchApi<PageData<AppVersion>>(`/api/app-version${buildQs(query)}`)
}

/** 获取最新版*/
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

/** 记录用户行为 —— 2026-09-28 门 8 死调用清账:删除。
 * POST /api/behavior 从未注册(behavior 面只有 POST /behavior/likes/counts);
 * 本仓零消费方(命中的 recordBehavior 是 clawdbot 引擎内部方法,非本函数)。 */

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
  return fetchApi<Category[]>(`/api/categories${buildQs(query)}`)
}

/** 获取分类*/
export async function getCategoryTree(type?: string): Promise<ApiResult<Category[]>> {
  return fetchApi<Category[]>(`/api/categories/tree${buildQs(type ? { type } : {})}`)
}

/** 获取分类详情 */
export async function getCategoryDetail(id: string | number): Promise<ApiResult<Category>> {
  return fetchApi<Category>(`/api/categories/${id}`)
}

// 2026-10-22 G-962 #109 摘除:POST /api/categories 从未注册(agents.ts 的创建真形态是
// POST /api/categories/create),全仓零消费方。

/** 更新分类 */
export async function updateCategory(
  id: string | number,
  input: Partial<Category>,
): Promise<ApiResult<Category>> {
  return fetchApi<Category>(`/api/categories/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

/** 删除分类 */
export async function deleteCategory(
  id: string | number,
): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/api/categories/${id}`, { method: 'DELETE' })
}

// ===================== monitor（监控） =====================

// 2026-10-22 G-962 #110 摘除:GET /api/monitor/status 从未注册(在册近邻
// GET /api/relay/monitor/status 是中转站专用形状),全仓零消费方。

/** 获取监控指标 */
export async function getMonitorMetrics(
  query: { names?: string; start?: string; end?: string } = {},
): Promise<ApiResult<MonitorMetric[]>> {
  return fetchApi<MonitorMetric[]>(`/api/monitor/metrics${buildQs(query)}`)
}

/** 获取服务健康状*/
export async function getServicesHealth(): Promise<ApiResult<MonitorStatus['services']>> {
  return fetchApi<MonitorStatus['services']>('/api/admin/monitor/services')
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

/**
 * 读取偏好设置(2026-10-20 侧边栏简洁模式通道)。
 *
 * 后端 `GET /api/settings/preferences` 返回 group='preferences' 的全部 (key,value),
 * value 恒为字符串或 null —— **JSON 值由调用方自己 parse**,本函数不做结构化,
 * 这样往这张表里加任何新的扁平偏好都不用再动这一层。
 * 与 `updatePreferences` 成对。
 */
export async function getPreferences(): Promise<
  ApiResult<{ settings: Record<string, string | null> }>
> {
  return fetchApi<{ settings: Record<string, string | null> }>('/api/settings/preferences')
}

/**
 * 读取侧边栏「自定义」栏配置(2026-10-16 立)。
 * 返回有序 href 列表 —— 顺序即侧栏显示顺序,调用方不得重排。
 * `exists=false` 表示该用户从未设置过(区别于"设置过但为空",后者 exists=true 且 hrefs=[]);
 * 调用方据此决定是否把本地缓存上推,推错会让已删项复活。
 */
export async function getSidebarNavPreference(): Promise<
  ApiResult<{ hrefs: string[]; exists: boolean }>
> {
  return fetchApi<{ hrefs: string[]; exists: boolean }>('/api/settings/sidebar-nav')
}

/** 写入侧边栏「自定义」栏配置(整体覆盖,顺序即显示顺序)。 */
export async function updateSidebarNavPreference(
  hrefs: string[],
): Promise<ApiResult<{ hrefs: string[]; exists: boolean }>> {
  return fetchApi<{ hrefs: string[]; exists: boolean }>('/api/settings/sidebar-nav', {
    method: 'PUT',
    body: JSON.stringify({ hrefs }),
  })
}

/** 获取登录设备列表 */
export async function getLoginDevices(): Promise<ApiResult<LoginDevice[]>> {
  return fetchApi<LoginDevice[]>('/api/settings/devices')
}

/** 移除登录设备 —— 2026-09-28 门 8 死调用清账:删除。
 * DELETE /api/settings/devices/:id 从未注册(设备面只有 GET /settings/devices;撤会话的真面是
 * DELETE /settings/authorizations/:id);本仓零消费方。将来接"撤设备"时按真形状重加,不留假可用。 */

/** 获取安全日志 */
export async function getSecurityLogs(
  query: PageQuery & { type?: string; startDate?: string; endDate?: string } = {},
): Promise<ApiResult<PageData<SecurityLog>>> {
  return fetchApi<PageData<SecurityLog>>(`/api/settings/security-logs${buildQs(query)}`)
}

/** 安全评分(GET /api/user/security-score;后端按密码/邮箱/第三方绑定启发式计算,无分项明细)。 */
export interface SecurityScore {
  score: number
  level: 'high' | 'medium' | 'low'
}

export async function getSecurityScore(): Promise<ApiResult<SecurityScore>> {
  return fetchApi<SecurityScore>('/api/user/security-score')
}

/**
 * 活跃会话(GET /api/settings/authorizations)。
 * 字段以后端 refresh_tokens 的实列投影为准 —— 不含 ip/device/browser,不要按 web 旧组件的声明补。
 */
export interface AuthorizationSession {
  id: string
  createdAt: string
  expiresAt: string
  familyId: string | null
}

export async function getAuthorizations(
  query: PageQuery = {},
): Promise<ApiResult<PageData<AuthorizationSession>>> {
  return fetchApi<PageData<AuthorizationSession>>(`/api/settings/authorizations${buildQs(query)}`)
}

/** 撤销一条登录会话(DELETE /api/settings/authorizations/:id;只能撤自己的,非 uuid 服务端回 400)。
 * 名称带 Session 后缀:**不得**与 developer.ts 的 revokeAuthorization(撤 OAuth 应用授权)同名,
 * index.ts 两条 export * 会撞名。 */
export async function revokeUserSession(id: string): Promise<ApiResult<{ revoked: boolean }>> {
  return fetchApi<{ revoked: boolean }>(`/api/settings/authorizations/${id}`, { method: 'DELETE' })
}

/** 两步验证状态(GET /api/auth/2fa/status)。 */
export interface TwoFactorStatus {
  enabled: boolean
  hasBackupCodes: boolean
  enabledAt: string | null
}

export async function getTwoFactorStatus(): Promise<ApiResult<TwoFactorStatus>> {
  return fetchApi<TwoFactorStatus>('/api/auth/2fa/status')
}

/** 生成 TOTP 密钥与二维码(POST /api/auth/2fa/setup;确认前 enabled 仍为 false)。 */
export interface TwoFactorSetup {
  secret: string
  uri: string
  qrCode: string
}

export async function setupTwoFactor(accountName?: string): Promise<ApiResult<TwoFactorSetup>> {
  return fetchApi<TwoFactorSetup>('/api/auth/2fa/setup', {
    method: 'POST',
    body: JSON.stringify(accountName ? { accountName } : {}),
  })
}

/** 校验 6 位 TOTP 并启用(POST /api/auth/2fa/verify;备份码明文只返回这一次)。 */
export async function verifyTwoFactor(
  code: string,
): Promise<ApiResult<{ verified: boolean; backupCodes: string[] }>> {
  return fetchApi<{ verified: boolean; backupCodes: string[] }>('/api/auth/2fa/verify', {
    method: 'POST',
    body: JSON.stringify({ code }),
  })
}

/** 禁用两步验证(POST /api/auth/2fa/disable;需当前密码二次确认)。 */
export async function disableTwoFactor(
  password: string,
): Promise<ApiResult<{ disabled: boolean }>> {
  return fetchApi<{ disabled: boolean }>('/api/auth/2fa/disable', {
    method: 'POST',
    body: JSON.stringify({ password }),
  })
}

/** 导出用户数据 */
export async function exportUserData(): Promise<
  ApiResult<{ url: string; filename: string; expiresAt: string }>
> {
  return fetchApi<{ url: string; filename: string; expiresAt: string }>('/api/settings/export', {
    method: 'POST',
  })
}

/** 清除所有数*/
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

/** 获取账户删除状*/
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
  sessionId?: string
}): Promise<ApiResult<{ success: boolean }>> {
  // 出站形状必须与 apps/api 的 pageRecordSchema 逐字对齐(url / sessionId / referer):
  // 此前这里原样发 {page, referrer, duration},服务端要的 url 不在其中 ⇒ 该调用方
  // **恒 400**,一次也没成功过(2026-10-23 修)。duration 服务端没有对应列,不发了。
  return fetchApi<{ success: boolean }>('/api/visit-tracking/page/record', {
    method: 'POST',
    body: JSON.stringify({
      url: input.page,
      ...(input.sessionId ? { sessionId: input.sessionId } : {}),
      ...(input.referrer ? { referer: input.referrer } : {}),
    }),
  })
}

/** 获取访问记录列表 */
export async function getVisits(
  query: PageQuery & { userId?: string; page_path?: string } = {},
): Promise<ApiResult<PageData<VisitRecord>>> {
  return fetchApi<PageData<VisitRecord>>(`/api/visit-tracking/page/record${buildQs(query)}`)
}

/** 获取访问统计 */
export async function getVisitStats(
  query: { start?: string; end?: string } = {},
): Promise<ApiResult<StatisticsData>> {
  return fetchApi<StatisticsData>(`/api/visit-tracking/stats${buildQs(query)}`)
}

// ===================== public-configs（公开系统配置,P3-4.3 Server-Driven UI） =====================

/** 公开系统配置行(is_public=true,无鉴权可读) */
export interface PublicConfig {
  id: string
  key: string
  value: string
  type: string
  category: string
  description: string | null
  isPublic: boolean
  updatedAt: string
}

/** 获取所有公开系统配置(GET /api/configs,无需鉴权) */
export async function getPublicConfigs(): Promise<ApiResult<PublicConfig[]>> {
  const res = await fetchApi<{ list: PublicConfig[] }>('/api/configs')
  if (!res.success) return res
  return { success: true, data: res.data.list }
}

/**
 * 获取首页 schema(Server-Driven UI)。
 * 从公开配置中取 key='home_schema' 的 value(JSON 字符串),解析为对象。
 * 调用方需自行校验 + fallback 默认 schema(见 web/src/components/marketing/home-schema.ts)。
 * 未配置或解析失败时返回 null,由调用方决定 fallback 策略。
 */
export async function getHomeSchemaConfig(): Promise<ApiResult<unknown | null>> {
  const res = await getPublicConfigs()
  if (!res.success) return res
  const cfg = res.data.find((c) => c.key === 'home_schema' && c.type === 'json')
  if (!cfg) return { success: true, data: null }
  try {
    return { success: true, data: JSON.parse(cfg.value) }
  } catch {
    return { success: true, data: null }
  }
}

/**
 * 获取首页 schema 草稿(P3-4.6 草稿+预览模式)。
 * 从公开配置中取 key='home_schema_draft' 的 value(JSON 字符串),解析为对象。
 * admin 在 /admin/home-schema 编辑时保存为草稿,预览页 `/?preview=draft` 加载此配置。
 * 草稿不存在时返回 null,由调用方决定 fallback 策略(通常 fallback 到生产 schema)。
 */
export async function getHomeSchemaDraftConfig(): Promise<ApiResult<unknown | null>> {
  const res = await getPublicConfigs()
  if (!res.success) return res
  const cfg = res.data.find((c) => c.key === 'home_schema_draft' && c.type === 'json')
  if (!cfg) return { success: true, data: null }
  try {
    return { success: true, data: JSON.parse(cfg.value) }
  } catch {
    return { success: true, data: null }
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
