import axios from 'axios'
import { t } from '@/utils/i18n'
import type { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse, AxiosError, AxiosRequestConfig } from 'axios'
import { AxiosHeaders } from 'axios'
import { ElMessage } from 'element-plus'
import i18n from '@/locales'

// 类型安全的 i18n 翻译函数
type TranslateFn = (key: string) => string
const i18nT: TranslateFn = (key: string) => {
  const global = i18n.global
  if (typeof global === 'object' && global !== null && 't' in global) {
    return (global.t as TranslateFn)(key)
  }
  return key
}
// 避免导入router以防止循环依赖
// 直接使用window.location进行跳转操作
import { COZE_PATHS, COZE_PREFIX, LOGIN_PWD_PATHS } from '@/config/backend-paths'
import { isTokenExpired } from '@/config/error-codes'
import { NETWORK_CONFIG } from '@/config/auth.config'
import { StorageManager, STORAGE_KEYS, TokenStorage } from './storage'
import { logger } from './logger'
import { ErrorHandler, ErrorType } from './errorHandler'

// ========================================
// API地址配置 - 端口使用约束
// ========================================
// ⚠️ 严格限制：本项目统一使用8888端口
// 所有服务（前端、后台管理、后端API）都通过8888端口访问
// ⚠️ 禁止：不得添加新的端口配置、不得使用其他端口
// ========================================
// 主后端API地址 - Using relative path通过Vite代理转发，或使用环境变量配置
// 开发环境通过 /api 代理到 http://localhost:8888
// 生产环境使用环境变量 VITE_API_BASE_URL
const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api'
// 代理路径 - 用于通过 Vite 代理转发请求
export const baseUrl2 = '/api'
// 空路径 - 用于某些特殊场景
export const baseUrl3 = ''

import { isDemoMode } from './envUtils'
import { getCurrentPlatform } from '../router/utils/routeMerger'
// 检测是否为演示模式（集中通过 envUtils 读取，支持默认开启）
const isDemo = isDemoMode()
// 获取当前平台类型
const _currentPlatform = getCurrentPlatform()

// ========================================
// 统一登录引导 - 替代硬跳转 window.location.href = '/login'
// ========================================
// 历史问题: 多处硬跳转 /login → 路由守卫拦截重定向回 / → 组件重新挂载 →
//          再次触发需 token 的 API → 再次硬跳转, 形成 1.5s 一次的无限刷新循环
// 修复策略: 改用全局登录弹窗 (useLoginDialog), 与路由守卫策略一致, 不刷新页面
// 保存当前路径到 auth-return-path, 登录成功后可返回原页面
let _loginDialogRedirectOpen = false
function redirectToLoginDialog(redirectPath?: string): void {
  if (typeof window === 'undefined') return
  const currentPath = redirectPath ?? (window.location.pathname + window.location.search)
  // 已在 /login 路由时无需再弹窗 (用户已在此页)
  if (currentPath === '/login') return
  try {
    localStorage.setItem('auth-return-path', currentPath)
  } catch {
    // localStorage 不可用 (隐私模式等), 忽略
  }
  // 去重: 弹窗已打开时不重复 open, 避免覆盖 redirectPath
  if (_loginDialogRedirectOpen) return
  _loginDialogRedirectOpen = true
  // 动态 import 避免循环依赖 (request.ts 是底层工具模块)
  void import('@/composables/useLoginDialog')
    .then(({ useLoginDialog }) => {
      const loginDialog = useLoginDialog()
      if (!loginDialog.visible.value) {
        loginDialog.open('login', currentPath)
      }
    })
    .catch((e) => {
      logger.warn('[request] Failed to open login dialog:', e)
    })
    .finally(() => {
      // 重置标志, 允许下次弹窗 (用户关闭后再次触发 401 时可重新弹)
      setTimeout(() => { _loginDialogRedirectOpen = false }, 1000)
    })
}

// ========================================
// 鉴权就绪状态（由 useAuthedApi composable 引用）
// 真实状态由 authStore 维护；此处提供类型安全的占位实现
// 业务侧应通过 @/utils/auth 维护，不直接依赖此模块
// ========================================
let _authReady = false
let _notificationDedupMap: Map<string, number> = new Map()

export function isAuthReady(): boolean {
  return _authReady
}

export function setAuthReady(ready: boolean): void {
  _authReady = ready
  if (ready) {
    // 鉴权就绪后清空历史去重状态，避免长时间运行后 map 膨胀
    _notificationDedupMap.clear()
  }
}

export async function waitForAuthReady(timeoutMs = 5000): Promise<void> {
  if (_authReady) return
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    await new Promise<void>((resolve) => setTimeout(resolve, 50))
    if (_authReady) return
  }
}

export function resetNotificationDedup(): void {
  _notificationDedupMap.clear()
  _authReady = false
}

// ========================================
// Mock API 数据 - 用于演示模式
// ========================================
const mockData: Record<string, unknown> = {
  // 用户信息相关
  '/user/info': {
    uuid: 'e774c6ea-09cc-4895-b49f-557556064052',
    username: 'demo_user',
    nickname: '演示用户',
    avatar: 'https://file.aizhs.top/sys-mini/daixaodiming.png',
    phone: '13800138000',
    email: 'demo@example.com',
    isVip: true,
    status: 1,
    identityTypy: 1,
    createTime: '2024-01-01T00:00:00.000Z',
    updateTime: '2024-12-31T23:59:59.999Z',
    userMargin: {
      tokenQuantity: '10000',
      balance: 1000.00,
      frozenAmount: 0,
    },
    thirdPartyAccounts: {
      accessToken: 'demo-access-token',
      refreshToken: 'demo-refresh-token',
    },
  },
  // 用户统计相关
  // 智能体列表（后端不可用时演示用）
  '/ai-program/zhsAgent/list': {
    code: 200,
    msg: '查询成功',
    rows: [
      { id: '1', name: '示例写作助手', description: '辅助写作与润色', category: 'assistant', status: 1 },
      { id: '2', name: '示例客服助手', description: '智能客服与问答', category: 'business', status: 1 },
    ],
    total: 2,
  },
  [COZE_PATHS.statistics.usage]: {
    period: {
      start: '2024-01-01',
      end: '2024-12-31',
      type: 'all',
    },
    chat: {
      totalSessions: 156,
      totalMessages: 3420,
      totalTokens: 125680,
    },
    files: {
      totalFiles: 45,
      totalSize: 52428800,
      imageCount: 32,
      videoCount: 8,
      audioCount: 5,
    },
    tokens: {
      consumed: 125680,
      recharged: 200000,
    },
    orders: {
      totalOrders: 12,
      totalAmount: 2999.88,
      paidOrders: 10,
      unpaidOrders: 2,
    },
    trends: Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      sessions: Math.floor(Math.random() * 10) + 1,
      messages: Math.floor(Math.random() * 50) + 10,
      tokens: Math.floor(Math.random() * 5000) + 1000,
    })),
  },
  [COZE_PATHS.statistics.behavior]: {
    login: {
      loginDays: 28,
      lastLoginTime: new Date().toISOString(),
      totalLoginCount: 45,
    },
    activeHours: Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      count: Math.floor(Math.random() * 20) + 1,
    })),
    favoriteAgents: [
      { botId: 'agent_001', usageCount: 45, totalTokens: 12500 },
      { botId: 'agent_002', usageCount: 32, totalTokens: 8900 },
      { botId: 'agent_003', usageCount: 28, totalTokens: 7200 },
    ],
    activeDays: Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      sessions: Math.floor(Math.random() * 5) + 1,
      messages: Math.floor(Math.random() * 30) + 5,
    })),
  },
  [COZE_PATHS.statistics.orders]: {
    summary: {
      totalOrders: 12,
      totalAmount: 2999.88,
      completedAmount: 2499.90,
      paidOrders: 10,
      unpaidOrders: 2,
      completedOrders: 8,
      pendingOrders: 2,
    },
    byPaymentMethod: [
      { payType: 'alipay', count: 6, amount: 1499.94 },
      { payType: 'wechat', count: 4, amount: 999.96 },
      { payType: 'balance', count: 2, amount: 499.98 },
    ],
    byOrderType: [
      { orderType: 1, count: 8, amount: 1999.92 },
      { orderType: 2, count: 4, amount: 999.96 },
    ],
    trends: Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      count: Math.floor(Math.random() * 2),
      amount: Math.floor(Math.random() * 500) + 100,
    })),
  },
  // 代理结算相关
  [COZE_PATHS.agentSettlement.incomeOverview]: {
    uuid: 'e774c6ea-09cc-4895-b49f-557556064052',
    todayAccount: 125.50,
    PendingSettlement: 856.30,
    WithdrawableAmount: 680.20,
    WithdrawnAmount: 2450.00,
    AccumulatedIncome: 3130.20,
    statistics_time: new Date().toISOString(),
  },
  [COZE_PATHS.agentSettlement.list]: {
    list: Array.from({ length: 20 }, (_, i) => ({
      id: `settlement_${i + 1}`,
      uuid: 'e774c6ea-09cc-4895-b49f-557556064052',
      order_no: `ORDER${Date.now() - i * 86400000}`,
      create_time: new Date(Date.now() - i * 86400000).toISOString(),
      buy_uuid: `buy_uuid_${i + 1}`,
      agent_id: `agent_${(i % 3) + 1}`,
      agent_name: `智能体 ${(i % 3) + 1}`,
      prologue: '这是一个智能的AI助手',
      agent_avatar: '/images/common/userIcon.svg',
      expiration_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      settlement: (i % 2 === 0 ? '1' : '0'),
      withdrawal: (i % 3 === 0 ? '1' : '0'),
      total: Math.floor(Math.random() * 10) + 1,
      accountType: '10 元/月',
      amount: Math.floor(Math.random() * 1000) * 100,
      buyType: 1,
      buyDuration: 30,
    })),
    pagination: {
      page: 1,
      pageSize: 20,
      total: 156,
      totalPages: 8,
    },
  },
  [COZE_PATHS.agentSettlement.statsOverview]: {
    total_settlements: 156,
    total_amount: 15600.00,
    settled_count: 98,
    unsettled_count: 58,
  },
  // 新闻列表相关
  '/news/list': {
    success: true,
    data: {
      list: Array.from({ length: 10 }, (_, i) => ({
        id: `news_${i + 1}`,
        title: `AI技术新进展 ${i + 1}`,
        summary: '人工智能技术正在快速发展，为各行各业带来革命性变化。',
        content: t('text.request.人工智能技术正在6'),
        coverImage: '/images/news-cover.png',
        author: 'AI研究院',
        publishTime: new Date(Date.now() - i * 86400000).toISOString(),
        viewCount: Math.floor(Math.random() * 10000) + 1000,
        likeCount: Math.floor(Math.random() * 1000) + 100,
        category: ['技术', '应用', '趋势'][i % 3],
        tags: ['AI', '机器学习', '深度学习', '自然语言处理'].slice(0, (i % 4) + 1),
      })),
      pagination: {
        page: 1,
        pageSize: 10,
        total: 100,
        totalPages: 10,
      },
    },
  },
  // Python API新闻列表
  '/api/v1/news/list': {
    success: true,
    data: {
      list: Array.from({ length: 12 }, (_, i) => ({
        id: `python_news_${i + 1}`,
        title: `Python AI技术新进展 ${i + 1}`,
        summary: 'Python在AI领域的应用越来越广泛。',
        content: t('text.request.Python作为7'),
        coverImage: '/images/python-news-cover.png',
        author: 'Python研究院',
        publishTime: new Date(Date.now() - i * 86400000).toISOString(),
        viewCount: Math.floor(Math.random() * 10000) + 1000,
        likeCount: Math.floor(Math.random() * 1000) + 100,
        category: ['技术', '应用', '趋势'][i % 3],
      })),
      pagination: {
        page: 1,
        pageSize: 12,
        total: 120,
        totalPages: 10,
      },
    },
  },
  // 登录相关 - 手机验证码登录 (2026-06-21 联调: 对齐后端 v1/auth)
  '/api/v1/auth/sms/verify': {
    success: true,
    message: t('api.request.验证码已发送'),
    data: {
      success: true,
      message: t('api.request.验证码已发送至您1'),
    },
  },
  '/api/v1/auth/sms/code': {
    success: true,
    message: t('api.request.验证成功2'),
    data: 'temp_key_' + Date.now(),
  },
  '/api/v1/auth/register': {
    success: true,
    message: t('api.request.登录成功3'),
    data: {
      accessToken: 'mock_access_token_' + Date.now(),
      refreshToken: 'mock_refresh_token_' + Date.now(),
      expiresIn: 7200,
      tokenType: 'Bearer',
      user: {
        uuid: 'e774c6ea-09cc-4895-b49f-557556064052',
        username: 'demo_user',
        nickname: '演示用户',
        avatar: 'https://file.aizhs.top/sys-mini/daixaodiming.png',
        phone: '13800138000',
        email: 'demo@example.com',
        isVip: true,
        status: 1,
        identityTypy: 1,
        createTime: '2024-01-01T00:00:00.000Z',
        updateTime: '2024-12-31T23:59:59.999Z',
        userMargin: {
          tokenQuantity: '10000',
          balance: 1000.00,
          frozenAmount: 0,
        },
      },
    },
  },
}

/** 规范化请求 URL 用于 mock 查找：先原样查，再去掉开头的 /api 查，兼容 baseUrl 拼接后的路径 */
function getMockDataKey(url: string): keyof typeof mockData | undefined {
  if (mockData[url as keyof typeof mockData]) return url as keyof typeof mockData
  const withoutApi = url.replace(/^\/api/, '') || '/'
  if (mockData[withoutApi as keyof typeof mockData]) return withoutApi as keyof typeof mockData
  return undefined
}

// 创建axios实例（统一超时配置）
// 普通请求：20分钟
// 大文件/流式请求：使用 config.timeout 单独设置
const REQUEST_TIMEOUT_MS = 20 * 60 * 1000 // 20分钟
const service: AxiosInstance = axios.create({
  timeout: REQUEST_TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Token刷新锁，防止并发刷新
let isRefreshing = false
const failedQueue: Array<{
  resolve: (value: unknown) => void
  reject: (reason: unknown) => void
}> = []

// 白名单接口列表 - 从移动端项目平移
const whiteList = [
  '/login/wechat/getOpenId',
  '/resource/getHomePageResources',
  '/login/wechat/getPhoneNumber',
  '/general/remote/third/group/list',
  '/information/list',
  '/coze/agents',
  '/remote/get/true',
  // 大模型统一列表接口（生产环境）
  COZE_PATHS.aiModelInfo.list,
  '/api/code',              // 验证码接口 - 不需要登录
  '/bot/sites/kind',        // AI 世界站点列表 - 公开接口 (Java @SkipLogin)
]

// 白名单路径前缀 - 所有登录相关接口都不需要token
const whiteListPrefixes = [
  '/login/',
  '/auth/wechat/',
  '/prod-api/ai/login/',
  '/api/ai-program/login/',  // 总管理端/教育端登录
  'ai-program/login/',      // 同上，用于 config.url 去掉 /api 后的判断
  '/api/ai-program/zhsAgent', // 智能体列表等读接口
  '/ai-program/zhsAgent',     // base3 直连 /ai-program 代理时路径
  'ai-program/zhsAgent',      // 拼接前路径
  '/api/ai-program/plaza/',   // 需求广场，与后端 /ai-program/plaza/demands 一致
  // 绝对地址形式的登录接口（原直连 https://bsm.aizhs.top/prod-api/，已迁移到 Python 后端）
  '/prod-api/login/',
  '/prod-api/login/pwd/',
  // 后台管理员登录链路 (admin_user 表) - 无需 token 即可访问
  '/api/v1/login/',
]

// 公开页面路径 - 未登录访问这些页面时，API 请求静默失败，不弹出登录框
// 原因：首页等公开页面加载时，子组件可能发起需 token 的 API 请求（如 AIChat 预加载），
//       若弹窗会强迫用户登录，体验不佳。用户主动触发需登录的功能时，由组件自身检查并弹窗。
const PUBLIC_PAGE_PATHS = ['/', '/home', '/login', '/register', '/forgot-password']
// 公开页面路径前缀 - 以这些前缀开头的页面也视为公开（如 /ai-world, /ai-world/detail/123）
const PUBLIC_PAGE_PREFIXES = ['/ai-world']

function isPublicPage(): boolean {
  if (typeof window === 'undefined') return false
  const path = window.location.pathname
  return (
    PUBLIC_PAGE_PATHS.some(p => path === p) ||
    PUBLIC_PAGE_PREFIXES.some(p => path === p || path.startsWith(p + '/'))
  )
}

// 登录类路径：请求时不要携带 Authorization，避免后端因旧 token 返回「令牌不能为空」
const loginPathPrefixes = [
  '/api/ai-program/login/',
  '/api/v1/auth/login',
  '/api/v1/auth/register',
  '/api/v1/auth/sms',
  '/api/v1/auth/email',
  '/api/v1/auth/refresh',
  '/api/v1/auth/email/inbox',
  '/api/v1/login/',      // 后台管理员登录 (admin_user 表)
  '/api/code',           // 总管理端验证码 GET /code
  '/api/login/pwd/',     // 兼容旧路径
  '/login/pwd/',         // 兼容旧路径
  '/auth/login',
  // 绝对地址形式的登录接口（原直连 https://bsm.aizhs.top/prod-api/，已迁移到 Python 后端）
  '/prod-api/login/',
  '/prod-api/login/pwd/',
]

// 获取存储的数据 - 使用统一的存储工具
export const getStoredData = (): unknown => {
  const userData = StorageManager.getItem<unknown>(STORAGE_KEYS.USER_DATA)
  // 在非浏览器环境或没有数据时返回mock数据
  if (!userData && typeof window === 'undefined') {
    return {
      thirdPartyAccounts: { accessToken: 'mock-token' },
      uuid: 'e774c6ea-09cc-4895-b49f-557556064052',
    }
  }
  return userData
}

// 获取用户token的辅助函数 - 使用统一的 TokenStorage
export const getUserToken = (): string | null => {
  // 1. 首先从统一 TokenStorage 获取
  const directToken = TokenStorage.getToken()
  if (directToken) return directToken

  // 2. 从 user_data 中获取（兼容第三方账号 access_token）
  const userData = getStoredData()
  return (
    (userData as { thirdPartyAccounts?: { accessToken?: string } } | undefined)?.thirdPartyAccounts
      ?.accessToken || null
  )
}

// 请求拦截器
function setupRequestInterceptor() {
  service.interceptors.request.use(
    async (config: InternalAxiosRequestConfig) => {
      // 确保请求头对象存在（对于完整URL的跨域请求很重要）
      if (!config.headers) {
        config.headers = new AxiosHeaders()
      }

      // 从配置中获取base参数，决定使用哪个基础URL
      // 注意：base 可能为 0（历史兼容：表示空/特殊 base），不能用 || 否则会被当成 1
      const base = config.base ?? 1

      // 增加请求日志
      logger.debug(`API request`, { url: config.url, method: config.method, base })

      // 设置正确的基础URL（base 1 = 智能体列表等，通过 /api-kou 代理到 Python 后端避免 404）
      const kouProxyPath = import.meta.env.VITE_KOU_PROXY_PATH || '/api-kou'
      let realBaseUrl = baseUrl
      if (base === 1) realBaseUrl = kouProxyPath
      else if (base === 2) realBaseUrl = baseUrl2
      else if (base === 3) realBaseUrl = baseUrl3

      // 确保URL是完整的
      if (!config.url?.startsWith('http')) {
        // 确保 URL 以 / 开头
        if (!config.url?.startsWith('/')) {
          config.url = '/' + (config.url || '')
        }
        const isProd = import.meta.env.PROD
        // 开发与生产统一Using relative path，由本地 Vite 或线上 nginx/网关代理，避免直连跨域
        // 排除：/api/v1/auth、/api/login/wechat、/api-kou（资讯等走 /api-kou 代理到 Python 后端）
        const isProxyOnlyPath = config.url.startsWith('/api/v1/auth') || config.url.startsWith('/api/login/wechat') || config.url.startsWith('/api-kou')
        if (isProd && config.url.startsWith('/api') && !isProxyOnlyPath && typeof baseUrl === 'string' && baseUrl.startsWith('http')) {
          // 生产环境：/api 且配置了绝对 base 时，拼成完整 URL（部署未反向代理 /api 时避免 404）
          const apiPath = config.url.replace(/^\/api/, '') || '/'
          config.url = baseUrl.replace(/\/$/, '') + apiPath
          logger.debug('Production environment /api using direct connection', { url: config.url })
        } else {
          // 定义需要代理的路径前缀（开发环境或相对 base 时保持相对路径由代理/网关处理）
          // 2026-06-29: 新增 /admin, /learn, /behavior, /community, /tools, /content, /statistics
          // 这些路径有独立 vite proxy 规则, 不应被 /api-kou 前缀包裹
          const proxyPaths = ['/api', '/api-kou', '/ihui-ai-api', '/auth', '/message', '/prod-api', COZE_PREFIX, '/login',
            '/admin', '/learn', '/behavior', '/community', '/tools', '/content', '/statistics',
            '/ranking', '/circle', '/exam', '/visit-tracking', '/commission', '/home',
          ]
          const isProxyPath = proxyPaths.some(path => config.url?.startsWith(path))
          if (isProxyPath) {
            logger.debug('Detected proxy path, using relative path', { url: config.url })
          } else if (realBaseUrl && !realBaseUrl.startsWith('http')) {
            config.url = realBaseUrl + (config.url || '')
            logger.debug('Building full URL', { url: config.url })
          } else {
            logger.debug('Using relative path', { url: config.url })
          }
        }
      }

      // 检查当前请求是否在白名单中
      // 需要同时检查原始URL和构建后的URL（可能包含/api前缀）
      const isWhitelisted = whiteList.some(whiteUrl => config.url?.includes(whiteUrl)) ||
        whiteListPrefixes.some(prefix => config.url?.startsWith(prefix)) ||
        whiteList.some(whiteUrl => config.url?.replace('/api', '').includes(whiteUrl)) ||
        whiteListPrefixes.some(prefix => config.url?.replace('/api', '').startsWith(prefix))

      // 使用辅助函数获取用户token
      const token = getUserToken()

      // 如果不在白名单中，才检查用户是否已登录
      if (!isWhitelisted && !token && !isDemo) {
        // 公开页面（首页/登录/注册等）未登录时静默拒绝，不弹窗不警告
        // 原因：首页子组件加载时可能发起需 token 的 API 请求，弹窗会强迫用户登录
        // 用户主动触发需登录功能时，由组件自身检查登录状态并弹窗（见 useLoginDialog 各调用点）
        if (isPublicPage()) {
          return Promise.reject(new Error(i18nT('errors.notLoggedIn')))
        }

        // 非公开页面：显示登录提示并弹出登录框
        // 修复无限刷新循环: 改用登录弹窗代替硬跳转 /login
        // 原因: 硬跳转 /login → 路由守卫拦截重定向回 / → App.vue 重新挂载 →
        //       AIChat 等组件再次调用需 token 的 API → 再次硬跳转 → 死循环 (每 1.5s 一次)
        // 弹窗方式与路由守卫策略一致 (router/index.ts 中也是跳首页 + 弹窗)
        ElMessage.warning(i18nT('errors.pleaseLogin'))
        redirectToLoginDialog()

        return Promise.reject(new Error(i18nT('errors.notLoggedIn')))
      }

      // 设置请求头
      const storageData = getStoredData()
      const storageDataTyped = storageData as { uuid?: string } | null
      if (storageDataTyped?.uuid && !config.headers['uuid']) {
        config.headers['uuid'] = storageDataTyped.uuid
      }

      // 登录类接口：不携带 Authorization，避免后端收到旧/无效 token 返回「令牌不能为空」
      const isLoginPath = loginPathPrefixes.some(
        p => config.url?.startsWith(p) || config.url?.replace(/^\/api/, '').startsWith(p.replace(/^\/api/, ''))
      )
      // OAuth2认证支持
      if (config.url?.includes('/auth/oauth/token')) {
        const clientId = import.meta.env.VITE_OAUTH2_CLIENT_ID || 'web-client'
        config.headers['X-Client-Id'] = clientId
      } else if (!isLoginPath && token) {
        config.headers.Authorization = `Bearer ${token}`
        if (!config.headers['platform-type']) {
          config.headers['platform-type'] = 'web'
        }
      }

      // 设备指纹
      const { DeviceService } = await import('./deviceService')
      const deviceHeaders = DeviceService.getHeaders()
      Object.assign(config.headers, deviceHeaders)

      // 请求签名验证
      const { requestSignatureService } = await import('./requestSignature')
      if (requestSignatureService.isEnabled()) {
        const signatureHeaders = requestSignatureService.getHeaders(
          config.method || 'GET',
          config.url || '',
          config.data
        )
        Object.assign(config.headers, signatureHeaders)
      }

      // 对于完整URL的跨域请求，确保headers是普通对象（避免代理对象问题）
      if (config.url?.startsWith('http')) {
        const headers: Record<string, string> = {}
        Object.keys(config.headers).forEach(key => {
          const value = config.headers[key]
          if (typeof value === 'string') {
            headers[key] = value
          }
        })
        config.headers = new AxiosHeaders(headers)
      }

      return config
    },
    error => {
      logger.error('Request interceptor error', error instanceof Error ? error : new Error(String(error)))
      return Promise.reject(error)
    }
  )
}

// 响应拦截器
function setupResponseInterceptor() {
  // 主响应拦截器：成功直接返回；失败统一在 onRejected 里处理（含刷新 token）
  service.interceptors.response.use(
    (response: AxiosResponse) => {
      // P11: v1 弃用头检测 (开发环境) - 提示前端开发者尽快迁移到 v2
      try {
        const migStatus = (response.headers?.['x-api-migration-status'] || '') as string
        const deprecation = (response.headers?.['deprecation'] || '') as string
        const sunset = (response.headers?.['sunset'] || '') as string
        const link = (response.headers?.['link'] || '') as string
        if (migStatus === 'deprecated' || migStatus === 'retired' || deprecation === 'true') {
          const url = response.config?.url || ''
          if (import.meta.env.DEV && typeof console !== 'undefined') {
            console.warn(
              `[API MIGRATION] v1 端点已${migStatus === 'retired' ? '下线' : '弃用'}, 请尽快迁移到 v2:\n` +
                `  URL:    ${url}\n` +
                `  Sunset: ${sunset}\n` +
                `  Link:   ${link}\n` +
                `  提示:   将 /api/v1 替换为 /api/v2 (行为已对齐)`,
            )
          }
          // P12: 批量埋点 (window.__ZHS_V1_DEPRECATED__), 30s flush 一次
          if (typeof window !== 'undefined') {
            const w = window as unknown as Record<string, unknown>
            w.__ZHS_V1_DEPRECATED__ = (w.__ZHS_V1_DEPRECATED__ as string[] | undefined) || []
            ;(w.__ZHS_V1_DEPRECATED__ as string[]).push(url)
            scheduleV1DeprecationFlush()
          }
        }
      } catch {
        // 拦截器异常不影响主流程
      }
      // 记录成功的API request性能
      if (typeof window !== 'undefined' && response.config) {
        import('./monitoring')
          .then(({ monitoringService }) => {
            const timing = performance.getEntriesByName(
              response.config.url || ''
            )[0] as PerformanceResourceTiming
            if (timing) {
              const duration = timing.responseEnd - timing.requestStart
              monitoringService.recordMetric('apiRequestTime', duration, 'ms', {
                url: response.config.url?.substring(0, 100),
                method: response.config.method,
                status: response.status,
              })
            }
          })
          .catch(() => {
            logger.debug('[request] Monitoring service load failed, skipping performance record')
          })
      }
      return response
    },
    async error => {
      const status = error.response?.status
      const config = error.response?.config ?? error.config

      // 其他错误：记录到监控并走统一展示逻辑
      import('./monitoring')
        .then(({ monitoringService }) => {
          monitoringService.recordError(
            error instanceof Error ? error : new Error(String(error)),
            'api',
            (status ?? 0) >= 500 ? 'high' : 'medium',
            {
              url: config?.url,
              method: config?.method,
              status,
            }
          )
        })
        .catch(() => {
          logger.debug('[request] Monitoring service load failed, skipping error record')
        })

      if (!error.response) {
        const { config } = error
        const requestUrl = config?.url || ''
        const mockKey = getMockDataKey(requestUrl)

        // 检查是否在演示模式且有对应的mock数据（支持带/不带 /api 的 URL）
        if (isDemo && mockKey) {
          logger.warn(`API request failed, using mock data: ${requestUrl}`)
          return Promise.resolve({
            data: mockData[mockKey],
            status: 200,
            statusText: 'OK',
            headers: {},
            config
          })
        }

        // 检查是否是请求拦截器抛出的"未登录"错误（有特定message但无response）
        const errorMessage = error.message || ''
        const isNotLoggedInError =
          errorMessage.includes('未登录') ||
          errorMessage.includes('请先登录') ||
          errorMessage.includes('not logged in') ||
          errorMessage.includes('notLoggedIn')

        if (isNotLoggedInError) {
          // 未登录错误：静默处理，不显示网络错误提示
          // 因为请求拦截器已经显示了"请先登录"的提示
          logger.warn('[request] User not logged in, request intercepted', { url: requestUrl })
          return Promise.reject(error)
        }

        // 网络错误自动重试机制
        const retryCount = (config as AxiosRequestConfig & { _retryCount?: number })._retryCount || 0
        const maxRetries = NETWORK_CONFIG.MAX_RETRIES
        const retryDelay = NETWORK_CONFIG.BASE_RETRY_DELAY_MS * Math.pow(2, retryCount) // 指数退避：1s, 2s, 4s

        if (retryCount < maxRetries && config.method?.toLowerCase() === 'get') {
          (config as AxiosRequestConfig & { _retryCount?: number })._retryCount = retryCount + 1
          logger.info(`[request] Network error, retry ${(config as AxiosRequestConfig & { _retryCount?: number })._retryCount} attempt: ${requestUrl}`)

          await new Promise(resolve => setTimeout(resolve, retryDelay))
          return service.request(config)
        }

        // 真正的网络错误：使用统一错误处理工具处理并显示
        const errorInfo = ErrorHandler.handleAxiosError(error as AxiosError)
        ErrorHandler.showError(errorInfo, { silent: false })
        return Promise.reject(error)
      }

      // 使用统一错误处理工具处理错误
      const errorInfo = ErrorHandler.handleAxiosError(error as AxiosError)

      // 注意：status/config 已在上方统一计算，避免重复声明导致编译失败

      // 处理401错误 - 未授权或Token过期
      if (status === 401) {
        // 注意: 请求拦截器已在请求发出前处理"公开页面未登录"场景 (line 566 isPublicPage 早返回),
        // 能走到这里说明请求已发出并收到 401 响应, 意味着用户曾持有 token 且已被服务器拒绝,
        // 应该提示重新登录而非静默丢弃 (否则用户会困惑为何功能无响应).
        // 如果是刷新Token的请求出错，直接跳转到登录页（避免刷新接口死循环）
        const refreshEndpointHints = [
          '/refresh-token',
          '/auth/refresh-token',
          '/auth/refresh',
          '/api/v1/auth/refresh',
          LOGIN_PWD_PATHS.refreshToken,
        ].filter(Boolean) as string[]
        if (refreshEndpointHints.some(p => config.url?.includes(p))) {
          // 统一通过 session-expired 事件, 由 useAppLifecycle 弹 ElNotification 顶部下滑通知
          // (避免直接 ElMessageBox 居中模态打断用户)
          window.dispatchEvent(new CustomEvent('session-expired', {
            detail: { reason: i18nT('auth.sessionExpiredMessage') },
          }))
          return Promise.reject(error)
        }

        // 不是刷新Token的请求，尝试刷新Token
        if (!isRefreshing) {
          isRefreshing = true

          try {
            // 尝试刷新Token
            // 注意：本项目存在多套存储/兼容逻辑，这里按优先级尽可能取到 refreshToken/uuid
            const userData = getStoredData() as {
              refreshToken?: string
              thirdPartyAccounts?: { refreshToken?: string }
              uuid?: string
            } | null
            const uuid =
              userData?.uuid || undefined

            let refreshToken: string | null | undefined =
              // 1) userData 内（历史/兼容）
              userData?.refreshToken ||
              userData?.thirdPartyAccounts?.refreshToken ||
              // 2) 统一 TokenStorage
              TokenStorage.getRefreshToken() ||
              null

            // 如果没有 refreshToken，无法刷新
            if (!refreshToken) {
              logger.warn('[request] Cannot refresh token: no refreshToken available')
              throw new Error(i18nT('auth.refreshFailed'))
            }

            let refreshResult: AxiosResponse<unknown> | null = null
            try {
                logger.info('[request] Starting token refresh', {
                  url: LOGIN_PWD_PATHS.refreshToken,
                  hasUuid: Boolean(uuid),
                  hasRefreshToken: Boolean(refreshToken),
                })
                const refreshResponse = await service({
                  // 与小程序一致：/login/pwd/refreshToken（本项目统一用 /api 前缀）
                  url: LOGIN_PWD_PATHS.refreshToken,
                  method: 'POST',
                  data: { refreshToken, uuid },
                  // 不使用 base: 2，直接使用默认代理路径
                })
                refreshResult = refreshResponse
                logger.info('[request] Token refresh successful', {
                  url: LOGIN_PWD_PATHS.refreshToken,
                })
              } catch (refreshApiError: unknown) {
                logger.warn('Refresh token API call failed', {
                  error: refreshApiError,
                })
                // API调用失败，检查是否是401（refreshToken也过期了）
                if (
                  (refreshApiError as { response?: { status?: number } })?.response?.status === 401
                ) {
                  // refreshToken也过期了，需要重新登录
                  refreshResult = null
                } else {
                  // 其他错误，也视为刷新失败
                  refreshResult = null
                }
              }

            // 如果刷新失败或没有refreshToken，跳转到登录页
            if (!refreshResult) {
              logger.warn('[request] Cannot refresh token: missing refreshToken or refresh endpoint failed', {
                hasRefreshToken: Boolean(refreshToken),
                hasUuid: Boolean(uuid),
              })

              throw new Error(i18nT('auth.refreshFailed'))
            }

            // 处理响应格式（兼容多种返回）：
            // 1) { code: 200, data: "accessToken字符串" }
            // 2) { code: 200, data: { accessToken/token, refreshToken } }
            // 3) { token, refreshToken } / { accessToken, refreshToken }
            // 2026-06-28 联调: 后端统一响应码 SUCCESS="0", 兼容 0/"0"/200/"200"
            const responseData = refreshResult.data as {
              code?: number | string
              data?: unknown
              token?: string
              accessToken?: string
              refreshToken?: string
              refresh_token?: string
            }
            let newToken: string | null = null
            let newRefreshToken: string | null = null

            // 先解析 data 字段 (兼容 code=0/"0"/200/"200")
            const rc = responseData?.code
            const isRefreshSuccess = rc === 200 || rc === '200' || rc === 0 || rc === '0'
            if (isRefreshSuccess && responseData?.data) {
              if (typeof responseData.data === 'string') {
                newToken = responseData.data
              } else if (typeof responseData.data === 'object' && responseData.data !== null) {
                // 同时兼容 camelCase 和 snake_case 字段名
                const d = responseData.data as {
                  accessToken?: string
                  access_token?: string
                  token?: string
                  refreshToken?: string
                  refresh_token?: string
                }
                newToken = d.accessToken || d.access_token || d.token || null
                newRefreshToken = d.refreshToken || d.refresh_token || null
              }
            }
            // 再兼容顶层字段
            if (!newToken) newToken = responseData?.accessToken || responseData?.token || null
            if (!newRefreshToken) {
              newRefreshToken = responseData?.refreshToken || responseData?.refresh_token || null
            }
            // 如果后端没返回新的 refreshToken，就沿用旧的
            if (!newRefreshToken) newRefreshToken = refreshToken || null

            if (!newToken) {

              throw new Error(i18nT('auth.refreshFailed'))
            }

            // 更新Token并重新发送请求
            const originalRequest = config

            // 更新多种存储方式的token
            // 1. 更新userData中的token（使用之前已获取的userData）
            if (userData) {
              const userDataObj = userData as {
                thirdPartyAccounts?: { accessToken?: string; refreshToken?: string }
                refreshToken?: string
                [key: string]: unknown
              }
              if (!userDataObj.thirdPartyAccounts) {
                userDataObj.thirdPartyAccounts = {}
              }
              userDataObj.thirdPartyAccounts.accessToken = newToken
              if (newRefreshToken) {
                userDataObj.thirdPartyAccounts.refreshToken = newRefreshToken
                userDataObj.refreshToken = newRefreshToken
              }
              // 使用统一的存储工具更新token
              StorageManager.setItem(STORAGE_KEYS.USER_DATA, userDataObj)
              TokenStorage.setToken(newToken)
              if (newRefreshToken) {
                TokenStorage.setRefreshToken(newRefreshToken)
              }
            } else {
              // 如果没有userData，创建新的数据结构
              TokenStorage.setToken(newToken)
              if (newRefreshToken) {
                TokenStorage.setRefreshToken(newRefreshToken)
              }
            }

            // 更新 auth store 的 token（如果可用）
            try {
              const { useAuthStore } = await import('@/stores/auth')
              const authStore = useAuthStore()
              authStore.token = newToken
              if (newRefreshToken) {

                const authStoreWithRefresh = authStore as { token: string; refreshToken?: string }
              authStoreWithRefresh.refreshToken = newRefreshToken
              }
            } catch (storeError) {
              // auth store 可能未初始化，静默处理
              logger.debug('Update auth store token failed', { error: storeError })
            }

            // 更新 RememberMeService 中的 refreshToken 并重置失败记录
            try {
              const { RememberMeService } = await import('@/utils/rememberMeService')
              if (newRefreshToken) {
                RememberMeService.updateRefreshToken(newRefreshToken)
              }
              RememberMeService.resetAutoLoginRecord()
            } catch {
              logger.debug('[request] Update RememberMeService failed')
            }

            // 更新原请求的 Authorization header
            originalRequest.headers = originalRequest.headers || {}
            originalRequest.headers['Authorization'] = `Bearer ${newToken}`

            // 重新发送所有失败的请求
            failedQueue.forEach(prom => {
              prom.resolve(newToken)
            })
            failedQueue.length = 0

            // 重试原请求
            return service(originalRequest)
          } catch (refreshError) {
            // 刷新Token失败，清除认证信息并跳转到登录页
            // 记录自动登录失败
            try {
              const { RememberMeService } = await import('@/utils/rememberMeService')
              RememberMeService.recordAutoLoginFailure('Token 刷新失败')
            } catch {
              logger.debug('[request] Record auto login failure failed')
            }

            // 清除所有认证相关的存储
            StorageManager.removeItem(STORAGE_KEYS.USER_DATA)
            StorageManager.removeItem(STORAGE_KEYS.TOKEN)
            StorageManager.removeItem(STORAGE_KEYS.USER_TOKEN)
            StorageManager.removeItem(STORAGE_KEYS.REFRESH_TOKEN)

            // 清除 auth store（如果可用）
            try {
              const { useAuthStore } = await import('@/stores/auth')
              const authStore = useAuthStore()
              try {
                await authStore.logout()
              } catch {
                logger.debug('[request] authStore.logout failed')
              }
            } catch (_storeError) {
              logger.debug('[request] auth store not initialized')
            }

            // 统一通过 session-expired 事件, 由 useAppLifecycle 弹 ElNotification 顶部下滑通知
            // (避免直接 ElMessageBox 居中模态打断用户)
            window.dispatchEvent(new CustomEvent('session-expired', {
              detail: { reason: i18nT('auth.sessionExpiredMessage') },
            }))

            // 清空失败队列
            failedQueue.forEach(prom => {
              prom.reject(refreshError)
            })
            failedQueue.length = 0

            return Promise.reject(refreshError)
          } finally {
            isRefreshing = false
          }
        } else {
          // 正在刷新Token，将请求加入队列等待
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject })
          })
            .then(token => {
              // 刷新成功后，使用新token重试请求
              config.headers = config.headers || {}
              config.headers['Authorization'] = `Bearer ${token}`
              return service(config)
            })
            .catch(error => {
              // 刷新失败，直接拒绝
              return Promise.reject(error)
            })
        }
      }

      // 处理403错误 - 权限不足
      if (status === 403) {
        const responseData = (error.response?.data as { code?: number }) || {}
        const { isPasswordExpired } = await import('@/config/error-codes')

        if (isPasswordExpired(responseData.code || status)) {
          ErrorHandler.showError({
            type: ErrorType.FORBIDDEN,
            message: i18nT('errors.passwordExpired'),
            code: responseData.code || status,
            timestamp: Date.now(),
          })
          if (typeof window !== 'undefined') {
            localStorage.setItem('password_expired', 'true')
            window.location.href = '/settings/security?force=1'
          }
        } else {
          ErrorHandler.showError({
            type: ErrorType.FORBIDDEN,
            message: i18nT('errors.forbidden'),
            code: status,
            timestamp: Date.now(),
          })
        }
      }

      // 处理404错误 - 资源不存在（GET /user/settings 等可选接口静默，由调用方用默认值）
      if (status === 404) {
        const requestUrl = typeof config?.url === 'string' ? config.url : ''
        const isGetUserSettingsBase =
          config?.method?.toLowerCase() === 'get' && /\/user\/settings\/?(\?|$)/.test(requestUrl)
        const skip404Toast =
          isGetUserSettingsBase || (config as AxiosRequestConfig & { skip404Toast?: boolean }).skip404Toast
        if (!skip404Toast) {
          ErrorHandler.showError({
            type: ErrorType.NOT_FOUND,
            message: i18nT('errors.notFound'),
            code: status,
            timestamp: Date.now(),
          })
        }
      }

      // 5xx 服务器错误: GET 请求自动重试（服务器临时故障）
      if (status >= 500 && config.method?.toLowerCase() === 'get') {
        const retryCount5xx = (config as AxiosRequestConfig & { _retryCount?: number })._retryCount || 0
        const maxRetries = NETWORK_CONFIG.MAX_RETRIES
        const retryDelay = NETWORK_CONFIG.BASE_RETRY_DELAY_MS * Math.pow(2, retryCount5xx)
        if (retryCount5xx < maxRetries) {
          (config as AxiosRequestConfig & { _retryCount?: number })._retryCount = retryCount5xx + 1
          logger.info(`[request] 5xx error, retry ${retryCount5xx + 1} attempt: ${config?.url || ''}`)
          await new Promise(resolve => setTimeout(resolve, retryDelay))
          return service.request(config)
        }
      }

      // 处理500错误 - 服务器错误
      if (status >= 500) {
        // 调用方可通过 config.silent500 标记静默 5xx toast（首页/侧边栏等辅助数据失败不打扰用户）
        const silent500 = (config as AxiosRequestConfig & { silent500?: boolean })?.silent500 === true
        if (silent500) {
          logger.warn(`[request] 5xx silent handling: ${config?.url || ''}`)
        } else {
        // 检查是否在演示模式（支持带/不带 /api 的 URL 查 mock）
        if (isDemo) {
          const requestUrl = config?.url || ''
          const mockKey = getMockDataKey(requestUrl)
          if (mockKey) {
            logger.warn(`API 500 error, using mock data: ${requestUrl}`)
            return Promise.resolve({
              data: mockData[mockKey],
              status: 200,
              statusText: 'OK',
              headers: {},
              config
            })
          }
        }

        // 所有 500 错误一律显示
        ErrorHandler.showError(errorInfo, { duration: 5000 })
        }
      } else if (status >= 400 && status < 500) {
        // 4xx错误（除了401、403、404已在上面处理）
        if (status !== 401 && status !== 403 && status !== 404) {
          // 调用方可通过 config.silent400 标记静默 4xx toast（可选数据 404/业务校验 422 等不打扰用户）
          const silent400 = (config as AxiosRequestConfig & { silent400?: boolean })?.silent400 === true
          if (silent400) {
            logger.warn(`[request] 4xx silent handling: ${config?.url || ''} (status=${status})`)
          } else {
            ErrorHandler.showError(errorInfo)
          }
        }
      }

      return Promise.reject(error)
    }
  )

  // 业务码拦截器（必须后注册，确保在 response 链路最先执行）
  // 将 HTTP 200 + data.code=401/40101 转成 401 错误，交给上面的 onRejected 刷新 token 并重试
  service.interceptors.response.use(
    (response: AxiosResponse) => {
      // 兼容多种后端返回：
      // 1) { code, msg, ... }
      // 2) { code, message, ... }
      // 3) { data: { code, msg, ... } }（部分网关/二次封装）
      const raw = response.data as
        | { code?: number | string; msg?: string; message?: string; data?: unknown }
        | undefined
      const nested = (raw && typeof raw === 'object' && raw.data && typeof raw.data === 'object'
        ? raw.data as { code?: number | string; msg?: string; message?: string }
        : undefined)
      const bizCode = raw?.code ?? nested?.code
      const bizMsg = raw?.msg ?? raw?.message ?? nested?.msg ?? nested?.message
      // 兼容：部分后端用 code=401/40101/A40101(HTTP仍为200) 表示未登录/过期
      if (bizCode !== undefined && isTokenExpired(bizCode as number | string)) {
        logger.warn('[request] Business code unauthorized, triggering refreshToken and retry', {
          url: response.config?.url,
          method: response.config?.method,
          code: bizCode,
          msg: bizMsg,
        })
        const config = (response.config || {}) as InternalAxiosRequestConfig
        const syntheticError: AxiosError = {
          name: 'AxiosError',
          message: bizMsg || 'Unauthorized',
          config,
          isAxiosError: true,
          toJSON() {
            return {}
          },
          response: {
            data: raw,
            status: 401,
            statusText: 'Unauthorized',
            headers: response.headers,
            config,
          },
          code: '401',
        }
        return Promise.reject(syntheticError)
      }
      return response
    },
    (error: unknown) => Promise.reject(error)
  )
}

// 设置拦截器
setupRequestInterceptor()
setupResponseInterceptor()

// P12: v1 弃用埋点批量 flush (30s 一次, 走 navigator.sendBeacon 异步上报)
let _v1FlushTimer: ReturnType<typeof setTimeout> | null = null
function scheduleV1DeprecationFlush() {
  if (_v1FlushTimer) return
  if (typeof window === 'undefined') return
  _v1FlushTimer = setTimeout(() => {
    _v1FlushTimer = null
    try {
      const w = window as unknown as Record<string, unknown>
      const list = (w.__ZHS_V1_DEPRECATED__ as string[] | undefined) || []
      if (list.length === 0) return
      // 聚合: 同 URL 只计次数
      const counts: Record<string, number> = {}
      for (const u of list) counts[u] = (counts[u] || 0) + 1
      const payload = JSON.stringify({
        type: 'v1_deprecation_batch',
        timestamp: Date.now(),
        items: counts,
        total: list.length,
      })
      // sendBeacon 不阻塞页面, 失败也无所谓
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        navigator.sendBeacon('/api/migration/devtools-report', payload)
      }
      // 清空缓存
      w.__ZHS_V1_DEPRECATED__ = []
    } catch {
      // 上报失败不影响主流程
    }
  }, 30_000)
}

// 页面卸载时立即 flush 一次
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    try {
      const w = window as unknown as Record<string, unknown>
      const list = (w.__ZHS_V1_DEPRECATED__ as string[] | undefined) || []
      if (list.length === 0) return
      const counts: Record<string, number> = {}
      for (const u of list) counts[u] = (counts[u] || 0) + 1
      const payload = JSON.stringify({
        type: 'v1_deprecation_batch',
        timestamp: Date.now(),
        items: counts,
        total: list.length,
        onunload: true,
      })
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        navigator.sendBeacon('/api/migration/devtools-report', payload)
      }
    } catch {
      // ignore
    }
  })
}

// 导出request作为默认导出
export default service

// 同时导出 request 命名导出，供组件使用
export { service as request }

