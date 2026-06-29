// API服务配置，与Uniapp项目保持一致

import { COZE_PATHS, COZE_PREFIX, LOGIN_PWD_PATHS } from '@/config/backend-paths'
import { logger } from '@/utils/logger'
import http from '@/utils/request'
import { StorageManager, STORAGE_KEYS, TokenStorage } from '@/utils/storage'
import { isTokenExpired } from '@/config/error-codes'

export * from '../api/user'

// 正式环境地址
// 开发环境通过 Vite 代理访问，生产环境直接访问
// 使用 mode 而不是 DEV，因为 DEV 可能在某些情况下不准确
// 2026-06-20 全部迁移到 Python 后端, 无 Java 依赖
// 开发环境通过 Vite 代理, 生产环境通过 Nginx 反向代理, 均走相对路径
const BASE_URL = '/api-kou'
const BASE_URL2 = '/prod-api/ai'
const BASE_URL3 = COZE_PREFIX
const BASE_URL4 = '/prod-api'

// 请求配置
interface RequestOptions {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: unknown
  headers?: Record<string, string>
  timeout?: number
  base?: number // 1=BASE_URL, 2=BASE_URL2, 3=BASE_URL3, 4=BASE_URL4
  /** 内部使用：是否已刷新并重试过，防止死循环 */
  __retried?: boolean
}

// 模拟用户存储
export const getStoredData = (): Record<string, unknown> => {
  try {
    const userData = StorageManager.getItem<Record<string, unknown>>(STORAGE_KEYS.USER_DATA)
    if (userData) {
      return userData
    }
  } catch (parseError) {
    // JSON解析失败，尝试清理损坏的数据
    try {
      StorageManager.removeItem(STORAGE_KEYS.USER_DATA)
      if (import.meta.env.DEV) {
        logger.warn('[API] User data JSON parsing failed, cleaned up corrupted data:', parseError)
      }
    } catch (cleanError) {
      // 清理失败，记录但不影响功能
      if (import.meta.env.DEV) {
        logger.warn('[API] Failed to clean up corrupted data:', cleanError)
      }
    }
  }
  // 数据不存在或损坏时返回空对象, 不使用 mock 假数据
  return {}
}

// ============================
// fetch 版本的 token 刷新/重放
// ============================
let refreshingPromise: Promise<string | null> | null = null

function getBizCodeAndMsg(payload: unknown): { code: unknown; msg?: string } {
  if (!payload || typeof payload !== 'object') return { code: undefined }
  const p = payload as Record<string, unknown>
  const data = p?.data as Record<string, unknown> | undefined
  const code = (p?.code ?? data?.code) as unknown
  const msg = (p?.msg ?? p?.message ?? data?.msg ?? data?.message) as string | undefined
  return { code, msg }
}

function getAccessTokenFromStorage(): string | null {
  // 兼容 request.ts 的统一键
  const direct = TokenStorage.getToken()
  if (direct) return direct
  // 兼容本文件使用的 user_data
  try {
    const ud = getStoredData() as { thirdPartyAccounts?: { accessToken?: string } } | null
    return ud?.thirdPartyAccounts?.accessToken || null
  } catch {
    return null
  }
}

function getRefreshTokenFromStorage(): string | null {
  const direct = TokenStorage.getRefreshToken()
  if (direct) return direct
  try {
    const ud = getStoredData() as { refreshToken?: string; thirdPartyAccounts?: { refreshToken?: string } } | null
    return ud?.refreshToken || ud?.thirdPartyAccounts?.refreshToken || null
  } catch {
    return null
  }
}

function getUuidFromStorage(): string | null {
  const ud = StorageManager.getItem<{ uuid?: string }>(STORAGE_KEYS.USER_DATA)
  if (ud?.uuid) return String(ud.uuid)
  try {
    const legacy = getStoredData() as { uuid?: string } | null
    return legacy?.uuid ? String(legacy.uuid) : null
  } catch {
    return null
  }
}

async function refreshAccessToken(): Promise<string | null> {
  if (refreshingPromise) return refreshingPromise

  refreshingPromise = (async () => {
    const refreshToken = getRefreshTokenFromStorage()
    const uuid = getUuidFromStorage()

    if (!refreshToken) {
      logger.warn('[services/api] No refreshToken, cannot refresh')
      return null
    }

    // 统一走 /api 代理：/api/login/pwd/refreshToken
    const url = LOGIN_PWD_PATHS.refreshToken
    try {
      logger.info('[services/api] Start refreshing token', { url, hasUuid: Boolean(uuid) })
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'platform-type': 'web' },
        body: JSON.stringify({ refreshToken, uuid }),
        signal: AbortSignal.timeout(30_000),
      })
      const data = (await resp.json()) as Record<string, unknown>
      const dataData = data.data as Record<string, unknown> | undefined

      // 兼容多种返回格式
      const newAccessToken: string | null =
        (dataData?.accessToken as string) || (dataData?.token as string) || (data.accessToken as string) || (data.token as string) || null
      const newRefreshToken: string | null =
        (dataData?.refreshToken as string) || (data.refreshToken as string) || (data.refresh_token as string) || null

      if (!newAccessToken) {
        logger.warn('[services/api] Token refresh failed: no accessToken', { data })
        return null
      }

      // 写入统一存储键，确保 axios/fetch 两套都拿得到
      TokenStorage.setToken(newAccessToken)
      if (newRefreshToken) TokenStorage.setRefreshToken(newRefreshToken)

      // 同步本文件 legacy user_data（避免页面其它逻辑只读 user_data）
      try {
        const legacy = getStoredData() as Record<string, unknown>
        if (legacy && typeof legacy === 'object') {
          const thirdPartyAccounts = (legacy.thirdPartyAccounts as Record<string, unknown>) || {}
          thirdPartyAccounts.accessToken = newAccessToken
          if (newRefreshToken) {
            thirdPartyAccounts.refreshToken = newRefreshToken
            legacy.refreshToken = newRefreshToken
          }
          legacy.thirdPartyAccounts = thirdPartyAccounts
          StorageManager.setItem(STORAGE_KEYS.USER_DATA, legacy)
        }
      } catch {
        // 静默
      }

      logger.info('[services/api] Token refresh successful')
      return newAccessToken
    } catch (e) {
      logger.warn('[services/api] Token refresh request failed', e instanceof Error ? e : new Error(String(e)))
      return null
    } finally {
      refreshingPromise = null
    }
  })()

  return refreshingPromise
}

// 请求函数
export async function request({
  url,
  method = 'GET',
  data = {},
  headers = {},
  timeout = 500000,
  base = 1,
  __retried = false,
}: RequestOptions): Promise<unknown> {
  const baseUrlMap = {
    1: BASE_URL,
    2: BASE_URL2,
    3: BASE_URL3,
    4: BASE_URL4,
  }

  const realBaseUrl = baseUrlMap[base as keyof typeof baseUrlMap] || BASE_URL

  const cleanUrl = url.startsWith('/') ? url : '/' + url
  const cleanBaseUrl = realBaseUrl.endsWith('/') ? realBaseUrl.slice(0, -1) : realBaseUrl
  const fullUrl = cleanBaseUrl + cleanUrl

  // 获取用户token信息（优先统一存储键）
  const userData = getStoredData()
  const accessToken = getAccessTokenFromStorage()

  // 构建请求头
  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  }

  // 特殊处理 BASE_URL3（ihui API / cozeZhsApi）的请求头
  if (userData?.uuid && !requestHeaders['uuid']) {
    requestHeaders['uuid'] = String(userData.uuid)
  }
  if (accessToken) {
    requestHeaders['Authorization'] = `Bearer ${accessToken}`
  }
  requestHeaders['platform-type'] = 'web'
  if (!requestHeaders['platform']) {
    requestHeaders['platform'] = 'h5'
  }

  // 构建请求配置
  const config: RequestInit = {
    method,
    headers: requestHeaders,
    signal: AbortSignal.timeout(timeout),
  }

  // 处理GET请求参数
  let finalUrl = fullUrl
  if (method === 'GET' && data !== null && typeof data === 'object') {
    const dataObj = data as Record<string, unknown>
    const keys = Object.keys(dataObj)
    if (keys.length > 0) {
      const params = new URLSearchParams()
      keys.forEach(key => {
        const value = dataObj[key]
        if (value !== undefined && value !== null) {
          params.append(key, String(value))
        }
      })
      finalUrl += '?' + params.toString()
    }
  } else if (['POST', 'PUT'].includes(method)) {
    config.body = JSON.stringify(data)
  }

  try {
    const response = await fetch(finalUrl, config)

    if (response.ok) {
      const result = await response.json()

      // 业务码未授权/过期（HTTP 200 + code=401/40101）
      {
        const { code, msg } = getBizCodeAndMsg(result)
        if (code !== undefined && isTokenExpired(code as number | string) && !__retried) {
          logger.warn('[services/api] Unauthorized business code hit, trying to refresh token and retry', { url, code, msg })
          const newToken = await refreshAccessToken()
          if (newToken) {
            // 只重试一次，避免死循环
            const retryHeaders = { ...headers, Authorization: `Bearer ${newToken}` }
            return request({ url, method, data, headers: retryHeaders, timeout, base, __retried: true })
          }
          logger.warn('[services/api] Token refresh failed (no new token), no more retries', { url, code })
        }
      }

      return result
    } else {
      // HTTP错误时，如果是用户相关接口，返回模拟数据
      if (url.includes('/users/')) {
        return {
          code: 200,
          data: {
            uuid: userData.uuid || 'e774c6ea-09cc-4895-b49f-557556064052',
            username: '测试用户',
            phone: '138****8888',
            isVip: 1,
            memberLevelText: '黄金会员',
            nextLevelInfoText: '距离铂金会员还差 2000 积分',
            tokenQuantity: '10000',
            knowledgeBaseQuota: '10GB',
            remainingTokens: '10000',
            avatarUrl: '/images/APP.jpg',
          },
        }
      }
      throw new Error(`HTTP error! status: ${response.status}`)
    }
  } catch (error) {
    import('@/utils/logger')
      .then(({ logger }) => {
        logger.error('Request failed', error instanceof Error ? error : new Error(String(error)))
      })
      .catch(() => {
        // 日志系统未加载，静默处理
      })
    // 网络错误时，如果是用户相关接口，返回模拟数据
    if (url.includes('/users/')) {
      return {
        code: 200,
        data: {
          uuid: userData.uuid || 'e774c6ea-09cc-4895-b49f-557556064052',
          username: '测试用户',
          phone: '138****8888',
          isVip: 1,
          memberLevelText: '黄金会员',
          nextLevelInfoText: '距离铂金会员还差 2000 积分',
          tokenQuantity: '10000',
          knowledgeBaseQuota: '10GB',
          remainingTokens: '10000',
          avatarUrl: '/images/APP.jpg',
        },
      }
    }
    throw error
  }
}

// 用户相关API
export function getUserInfo(uuid: string) {
  return request({
    url: `/auth/users/${uuid}`,
    method: 'GET',
    base: 1,
  })
}

export function getUserList(data?: Record<string, unknown>) {
  return request({
    url: `/auth/users/list`,
    method: 'GET',
    data: data || {},
    base: 1,
  })
}

// 账号登录
export function login(data: { username: string; password: string; rememberMe?: boolean }) {
  return request({
    url: '/auth/login/account',
    method: 'POST',
    data,
    base: 1,
  })
}

// 手机登录
export function phoneLogin(data: { phone: string; code: string }) {
  return request({
    url: '/auth/login/phone',
    method: 'POST',
    data,
    base: 1,
  })
}

// 发送验证码
export function sendSmsCode(phoneNumber: string) {
  return request({
    url: '/auth/sms/send-code',
    method: 'POST',
    data: {
      phoneNumber,
    },
    base: 1,
  })
}

// 注册
export function register(data: { username: string; password: string; email: string }) {
  return request({
    url: '/auth/register',
    method: 'POST',
    data,
    base: 1,
  })
}

// 获取需求广场列表
export function getXuqiuList(data: unknown): Promise<unknown> {
  // 构建查询参数
  const params = new URLSearchParams()
  const dataObj = data as Record<string, unknown>
  if (dataObj.pageNum) params.append('pageNum', String(dataObj.pageNum))
  if (dataObj.pageSize) params.append('pageSize', String(dataObj.pageSize))
  if (dataObj.status !== undefined && dataObj.status !== null && dataObj.status !== '') {
    params.append('status', String(dataObj.status))
  }
  if (dataObj.search) params.append('search', String(dataObj.search))
  if (dataObj.creator) params.append('creator', String(dataObj.creator))
  if (Array.isArray(dataObj.types) && dataObj.types.length > 0) {
    params.append('types', String(dataObj.types))
  }
  if (Array.isArray(dataObj.categorys) && dataObj.categorys.length > 0) {
    params.append('categorys', String(dataObj.categorys))
  }

  const queryString = params.toString()
  const url = `/remote/agent/task/need/task${queryString ? '?' + queryString : ''}`

  return request({
    url: url,
    method: 'GET',
    base: 2,
  })
}

// 获取分类
export function category(type = '1') {
  return request({
    url: `/remote/agent/category`,
    method: 'GET',
    data: {
      type,
    },
    base: 2,
  })
}

// 发布需求
export async function addXuqiuModel(data: unknown): Promise<{
  code: number
  success: boolean
  message?: string
  data?: unknown
  timestamp?: number
}> {
  return request({
    url: `/remote/agent/task/need/task/add`,
    method: 'POST',
    data,
    base: 2,
  }) as Promise<{
    code: number
    success: boolean
    message?: string
    data?: unknown
    timestamp?: number
  }>
}

// 获取需求详情
export function getXuqiuInfoById(id: string) {
  return request({
    url: `/remote/agent/task/need/task/add/${id}`,
    method: 'GET',
    base: 2,
  })
}

// 已移除旧的别名导出，统一使用 xuqiu 命名

// 未登录(401)或开发环境空列表时展示的示例（结构与后端一致：rows + total）
export const GUEST_AGENT_LIST_FALLBACK: ZhsAgentListBackendResponse = {
  code: 200,
  msg: '查询成功',
  rows: [
    { id: '1', agentName: '写作助手', description: '辅助写作、润色与续写', category: 'assistant', status: 1 },
    { id: '2', agentName: '客服助手', description: '智能客服与常见问题解答', category: 'business', status: 1 },
  ],
  total: 2,
}

// 主后端列表接口约定：GET /ai-program/zhsAgent/list 返回 { code, msg, rows, total }
// 行类型与后端实体一致，字段名不另做转换
// 后端可能返回 camelCase 或 snake_case，统一支持
export interface ZhsAgentRow {
  id?: string | number
  uuid?: string
  agentName?: string
  agent_name?: string
  name?: string
  description?: string
  prologue?: string
  avatar?: string
  icon?: string
  category?: string
  status?: number
  createTime?: string
  create_time?: string
  updateTime?: string
  update_time?: string
  /** 创作者/用户头像，后端返回后卡片 meta 左侧展示 */
  creatorAvatar?: string
  userAvatar?: string
  creator_avatar?: string
  user_avatar?: string
  [key: string]: unknown
}

export interface ZhsAgentListBackendResponse {
  code?: number
  msg?: string
  rows: ZhsAgentRow[]
  total: number
}

async function getAgentListOnce(
  params: Record<string, string | number | undefined>,
  base?: number
): Promise<ZhsAgentListBackendResponse> {
  const res = await http.get('/ai-program/zhsAgent/list', { params, base })
  const raw = (res as { data?: ZhsAgentListBackendResponse })?.data ?? res
  const body = raw as ZhsAgentListBackendResponse & { data?: { rows?: ZhsAgentRow[]; total?: number } }
  // 兼容后端两种格式：{ rows, total } 或 { data: { rows, total } }
  if (body?.data && Array.isArray(body.data.rows)) {
    return { code: body.code, msg: body.msg, rows: body.data.rows, total: body.data.total ?? 0 }
  }
  return body as ZhsAgentListBackendResponse
}

// 获取智能体列表。原接口 GET /ai-program/zhsAgent/list 已暂时取消（2026-06 探测 404）。
// 通过环境变量 VITE_ENABLE_ZHS_AGENT_LIST 控制：
//   - 缺省 / false / 'false' / '0'：返回空列表（兜底演示）
//   - true / 'true' / '1'：恢复调用 getAgentListOnce
// 恢复时只需在 .env(.local) 中加 VITE_ENABLE_ZHS_AGENT_LIST=true 并重启 dev server
const DISABLE_ZHS_AGENT_LIST = !(
  String(import.meta.env.VITE_ENABLE_ZHS_AGENT_LIST ?? '').toLowerCase() === 'true' ||
  String(import.meta.env.VITE_ENABLE_ZHS_AGENT_LIST ?? '') === '1'
)

export function getAgentList(options: unknown): Promise<ZhsAgentListBackendResponse> {
  if (DISABLE_ZHS_AGENT_LIST) {
    return Promise.resolve({ code: 200, msg: 'ok', rows: [], total: 0 })
  }

  const params: Record<string, string | number | undefined> = {}
  if (options && typeof options === 'object') {
    const opts = options as Record<string, unknown>
    Object.keys(opts).forEach(key => {
      if (opts[key] !== undefined && opts[key] !== null) {
        params[key] = String(opts[key])
      }
    })
    if (opts.page !== undefined && opts.page !== null && params.pageNum === undefined) {
      params.pageNum = String(opts.page)
    }
  }

  return getAgentListOnce(params)
    .catch(err => {
      logger.warn('[API] getAgentList main path failed, trying /ai-program direct connection', err)
      return getAgentListOnce(params, 3)
    })
    .catch(err => {
      const ax = err as { response?: { status?: number } }
      if (ax.response?.status === 401) {
        return GUEST_AGENT_LIST_FALLBACK
      }
      logger.warn('[API] getAgentList request failed', err)
      return { code: 500, msg: (err as Error)?.message || '请求失败', rows: [], total: 0 }
    })
}

// 获取首页资源
export function getHomePageResources(type: number) {
  return request({
    url: COZE_PATHS.index.resources(String(type)),
    method: 'GET',
    base: 3,
  })
}
