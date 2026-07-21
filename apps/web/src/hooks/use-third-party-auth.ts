'use client'

import * as React from 'react'

import { useAuthStore, type AuthUser } from '@/stores/auth'
import { fetchApi } from '@/lib/api'
import {
  getAllPlatformConfigs,
  getPlatformConfig,
  validatePlatformConfig,
} from '@/lib/third-party-config'
import {
  buildAuthUrl,
  clearOAuthState,
  generateState,
  saveOAuthState,
  validateOAuthState,
} from '@/lib/oauth-utils'
import { useToast } from '@/hooks/use-toast'
import type {
  GoogleIdConfiguration,
  GoogleOAuthConfig,
  PromptMomentNotification,
  ThirdPartyAccount,
  ThirdPartyLoginResponse,
  ThirdPartyLoginState,
  ThirdPartyPlatform,
} from '@/types/third-party'

/** 平台展示名 */
const PLATFORM_DISPLAY_NAMES: Record<ThirdPartyPlatform, string> = {
  google: 'Google',
  apple: 'Apple',
  dingtalk: '钉钉',
  enterpriseWechat: '企业微信',
  wechat: '微信',
  github: 'GitHub',
  feishu: '飞书',
  alipay: '支付宝',
}

/** Google GIS SDK 脚本地址 */
const GOOGLE_GIS_SCRIPT_SRC = 'https://accounts.google.com/gsi/client'

/** 最大重试次数 */
const MAX_RETRY = 5

/** OAuth 回调后端入口（按平台） */
function callbackPath(platform: ThirdPartyPlatform): string {
  return `/api/auth/${platform}/callback`
}

/** 绑定账号后端入口 */
const BIND_PATH = '/api/user/bind-third-party'
/** 解绑账号后端入口 */
const UNBIND_PATH = '/api/user/unbind-third-party'
/** 已绑定账号列表后端入口 */
const BOUND_ACCOUNTS_PATH = '/api/user/third-party-accounts'

/**
 * 判断是否为演示模式。
 * 优先读 NEXT_PUBLIC_DEMO_MODE，其次检查 URL 是否含 ?demo=1。
 */
export function isDemoMode(): boolean {
  if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_DEMO_MODE === 'true') {
    return true
  }
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search)
    return params.get('demo') === '1'
  }
  return false
}

/** 构造演示模式下的本地回退登录数据（仅开发环境） */
function buildFallbackLoginData(platform: ThirdPartyPlatform): ThirdPartyLoginResponse {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('第三方登录在未配置时不可用')
  }
  return {
    token: `dev_${platform}_${Date.now()}`,
    user: {
      id: `${platform}_local_user`,
      username: `${platform}_local_user`,
      email: 'local@example.com',
      nickname: `${PLATFORM_DISPLAY_NAMES[platform]}本地登录`,
      avatar: '/images/common/empty.svg',
      isVip: false,
      inviteCode: 'LOCALTP',
      createTime: new Date().toISOString(),
    },
  }
}

/** 登录成功后将 token/user 写入 auth store */
function applyLoginData(data: ThirdPartyLoginResponse): void {
  const { setToken, setUser } = useAuthStore.getState()
  setToken(data.token, data.refreshToken)
  const user: AuthUser = {
    id: data.user.id,
    nickname: data.user.nickname,
    avatar: data.user.avatar,
    phone: undefined,
  }
  setUser(user)
}

export interface UseThirdPartyAuthReturn {
  /** 所有已启用的平台 */
  enabledPlatforms: ThirdPartyPlatform[]
  /** 是否存在任意已启用平台 */
  isAnyPlatformEnabled: boolean
  /** 当前登录中平台 */
  currentPlatform: ThirdPartyPlatform | null
  /** 各平台登录状态 */
  loginStates: Record<ThirdPartyPlatform, ThirdPartyLoginState | undefined>
  /** 已绑定的第三方账号 */
  boundAccounts: ThirdPartyAccount[]
  /** 全局加载态 */
  isLoading: boolean
  /** 平台是否启用 */
  isPlatformEnabled: (platform: ThirdPartyPlatform) => boolean
  /** 平台是否已绑定 */
  isBound: (platform: ThirdPartyPlatform) => boolean
  /** 获取已绑定账号 */
  getBoundAccount: (platform: ThirdPartyPlatform) => ThirdPartyAccount | null
  /** 获取平台展示名 */
  getPlatformDisplayName: (platform: ThirdPartyPlatform) => string
  /** 开始第三方登录（重定向流程） */
  startLogin: (platform: ThirdPartyPlatform) => Promise<boolean>
  /** 处理 OAuth 回调 */
  handleCallback: (platform: ThirdPartyPlatform, code: string, state: string) => Promise<boolean>
  /** 处理登录失败 */
  handleLoginError: (platform: ThirdPartyPlatform, error: unknown) => void
  /** 重试登录 */
  retryLogin: (platform: ThirdPartyPlatform) => Promise<boolean>
  /** 取消登录 */
  cancelLogin: (platform: ThirdPartyPlatform) => void
  /** 绑定第三方账号 */
  bindAccount: (platform: ThirdPartyPlatform, code: string) => Promise<boolean>
  /** 解绑第三方账号 */
  unbindAccount: (platform: ThirdPartyPlatform) => Promise<boolean>
  /** 刷新已绑定账号列表 */
  refreshBoundAccounts: () => Promise<void>
  /** 加载 Google GIS SDK 并初始化 One Tap */
  loadGoogleOneTap: (clientId: string, callback: (credential: string) => void) => Promise<void>
  /** 触发 Google One Tap 提示 */
  promptGoogleOneTap: () => void
  /** 校验过期状态 */
  checkExpiredStates: () => void
  /** 清理所有状态 */
  clearAllStates: () => void
}

/**
 * 第三方登录 Hook
 *
 * 等价自旧架构 client/src/features/third-party-login/stores/thirdPartyAuth.ts（Pinia），
 * 适配新架构 React + Zustand + sonner toast。
 * 覆盖：登录状态管理、账号绑定/解绑、平台启用判断、One Tap 登录、演示模式/本地回退。
 */
export function useThirdPartyAuth(): UseThirdPartyAuthReturn {
  const toast = useToast()

  const [loginStates, setLoginStates] = React.useState<
    Record<ThirdPartyPlatform, ThirdPartyLoginState | undefined>
  >({} as Record<ThirdPartyPlatform, ThirdPartyLoginState | undefined>)
  const [boundAccounts, setBoundAccounts] = React.useState<ThirdPartyAccount[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [currentPlatform, setCurrentPlatform] = React.useState<ThirdPartyPlatform | null>(null)

  // Google One Tap 回调引用
  const oneTapCallbackRef = React.useRef<((credential: string) => void) | null>(null)

  // ---- 计算属性 ----
  const enabledPlatforms = React.useMemo<ThirdPartyPlatform[]>(() => {
    const configs = getAllPlatformConfigs()
    return (Object.keys(configs) as ThirdPartyPlatform[]).filter((p) => configs[p].enabled)
  }, [])

  const isAnyPlatformEnabled = enabledPlatforms.length > 0

  const isPlatformEnabled = React.useCallback((platform: ThirdPartyPlatform): boolean => {
    return getPlatformConfig(platform)?.enabled === true
  }, [])

  const isBound = React.useCallback(
    (platform: ThirdPartyPlatform): boolean =>
      boundAccounts.some((a) => a.platform === platform && a.status === 'active'),
    [boundAccounts],
  )

  const getBoundAccount = React.useCallback(
    (platform: ThirdPartyPlatform): ThirdPartyAccount | null =>
      boundAccounts.find((a) => a.platform === platform && a.status === 'active') ?? null,
    [boundAccounts],
  )

  const getPlatformDisplayName = React.useCallback(
    (platform: ThirdPartyPlatform): string => PLATFORM_DISPLAY_NAMES[platform] ?? platform,
    [],
  )

  // ---- 状态管理 ----
  const initLoginState = React.useCallback((platform: ThirdPartyPlatform): ThirdPartyLoginState => {
    const state: ThirdPartyLoginState = {
      platform,
      status: 'pending',
      retryCount: 0,
    }
    setLoginStates((prev) => ({ ...prev, [platform]: state }))
    setCurrentPlatform(platform)
    return state
  }, [])

  const updateLoginState = React.useCallback(
    (platform: ThirdPartyPlatform, updates: Partial<ThirdPartyLoginState>) => {
      setLoginStates((prev) => {
        const cur = prev[platform]
        if (!cur) return prev
        return { ...prev, [platform]: { ...cur, ...updates } }
      })
    },
    [],
  )

  const clearLoginState = React.useCallback((platform: ThirdPartyPlatform) => {
    setLoginStates((prev) => {
      const next = { ...prev }
      delete next[platform]
      return next
    })
    setCurrentPlatform((cur) => (cur === platform ? null : cur))
  }, [])

  // ---- 登录流程 ----

  /**
   * 构造授权 URL（含 state CSRF 防护）并重定向。
   * 优先使用后端代理入口（proxyPath）；演示模式或配置完整时直接跳转厂商授权页。
   */
  const startLogin = React.useCallback(
    async (platform: ThirdPartyPlatform): Promise<boolean> => {
      const displayName = PLATFORM_DISPLAY_NAMES[platform] ?? platform
      try {
        setIsLoading(true)

        if (!isPlatformEnabled(platform)) {
          throw new Error(`${displayName}登录未启用`)
        }

        // 初始化登录状态
        initLoginState(platform)

        const config = getPlatformConfig(platform)
        const state = generateState()
        saveOAuthState(platform, state)

        // 演示模式或配置完整 → 直接构造厂商授权 URL
        const validation = validatePlatformConfig(platform)
        const canDirectRedirect =
          isDemoMode() ||
          (validation.valid && !!config.authUrl && !!(config.clientId || config.appId))

        if (canDirectRedirect && config.authUrl) {
          const params: Record<string, string> = {
            redirect_uri: config.redirectUri,
            response_type: 'code',
            state,
          }
          // 各平台 appid 参数名差异:
          // - 支付宝:app_id
          // - 微信扫码(qrconnect)/ 企业微信(qrConnect):appid(不是 client_id)
          // - 其他(Google/Apple/钉钉/GitHub/飞书):client_id
          if (platform === 'alipay') {
            params.app_id = config.appId || ''
          } else if (platform === 'wechat' || platform === 'enterpriseWechat') {
            params.appid = config.appId || ''
            // 企业微信 qrConnect 必须带 agentid(自建应用 ID)
            if (platform === 'enterpriseWechat' && config.agentId) {
              params.agentid = String(config.agentId)
            }
          } else {
            params.client_id = config.clientId || config.appId || ''
          }
          if (config.scope) params.scope = config.scope
          // Apple 需要 response_mode
          if (platform === 'apple') params.response_mode = 'form_post'
          // Google 额外参数
          if (platform === 'google') {
            params.access_type = 'offline'
            params.prompt = 'consent'
            params.include_granted_scopes = 'true'
          }

          let url = buildAuthUrl(config.authUrl, params)
          // 微信扫码授权链接必须以 #wechat_redirect 结尾,否则报 "redirect_uri 参数错误"
          if (platform === 'wechat') url += '#wechat_redirect'
          if (typeof window !== 'undefined') window.location.href = url
          return true
        }

        // 回退：走后端代理入口（state 由后端接管）
        if (typeof window !== 'undefined') {
          window.location.href = `${config.proxyPath}?state=${encodeURIComponent(state)}`
        }
        return true
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error)
        toast.error(`${PLATFORM_DISPLAY_NAMES[platform] ?? platform}登录启动失败`, msg)
        updateLoginState(platform, { status: 'failed', error: msg })
        return false
      } finally {
        setIsLoading(false)
      }
    },
    [initLoginState, isPlatformEnabled, toast, updateLoginState],
  )

  /**
   * 处理登录成功：将 token/user 写入 auth store，刷新绑定列表。
   */
  const handleLoginSuccess = React.useCallback(
    async (platform: ThirdPartyPlatform, data: ThirdPartyLoginResponse): Promise<boolean> => {
      const displayName = PLATFORM_DISPLAY_NAMES[platform] ?? platform
      try {
        updateLoginState(platform, { status: 'success' })
        applyLoginData(data)
        toast.success(`${displayName}登录成功`)
        clearLoginState(platform)
        await refreshBoundAccountsImpl(setBoundAccounts, toast)
        return true
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error)
        updateLoginState(platform, { status: 'failed', error: msg })
        toast.error(`${displayName}登录处理失败`, msg)
        return false
      }
    },
    [clearLoginState, toast, updateLoginState],
  )

  /**
   * 处理 OAuth 回调：校验 state → 调用后端 → 写入 auth store。
   * 演示模式或后端失败时回退为本地数据。
   */
  const handleCallback = React.useCallback(
    async (platform: ThirdPartyPlatform, code: string, state: string): Promise<boolean> => {
      const displayName = PLATFORM_DISPLAY_NAMES[platform] ?? platform
      if (!code) {
        toast.error(`${displayName}登录失败`, '缺少必要的 code 参数')
        return false
      }

      // 校验 state 防 CSRF
      if (!validateOAuthState(platform, state)) {
        toast.error(`${displayName}登录失败`, 'state 参数验证失败')
        updateLoginState(platform, { status: 'failed', error: 'state 参数验证失败' })
        clearOAuthState(platform)
        return false
      }
      clearOAuthState(platform)

      // 演示模式：直接返回本地数据
      if (isDemoMode()) {
        await new Promise((r) => setTimeout(r, 600))
        return handleLoginSuccess(platform, buildFallbackLoginData(platform))
      }

      setIsLoading(true)
      try {
        const res = await fetchApi<ThirdPartyLoginResponse>(callbackPath(platform), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, state }),
        })
        if (res.success) {
          return await handleLoginSuccess(platform, res.data)
        }
        // 后端失败 → 本地回退
        toast.warning(`${displayName}后端登录失败，已启用本地回退`, res.error)
        return await handleLoginSuccess(platform, buildFallbackLoginData(platform))
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error)
        toast.warning(`${displayName}登录异常，已启用本地回退`, msg)
        return await handleLoginSuccess(platform, buildFallbackLoginData(platform))
      } finally {
        setIsLoading(false)
      }
    },
    [handleLoginSuccess, toast, updateLoginState],
  )

  /** 处理登录失败 */
  const handleLoginError = React.useCallback(
    (platform: ThirdPartyPlatform, error: unknown) => {
      const displayName = PLATFORM_DISPLAY_NAMES[platform] ?? platform
      const msg = error instanceof Error ? error.message : String(error) || '登录失败'
      setLoginStates((prev) => {
        const cur = prev[platform]
        const retryCount = (cur?.retryCount ?? 0) + 1
        return {
          ...prev,
          [platform]: {
            ...(cur ?? { platform, status: 'failed', retryCount }),
            status: 'failed',
            error: msg,
            retryCount,
          },
        }
      })
      if (retryCountExceeds(platform, loginStates)) {
        toast.error(`${displayName}登录多次失败，建议尝试其他登录方式`)
      } else {
        toast.error(msg || `${displayName}登录失败`)
      }
    },
    [loginStates, toast],
  )

  /** 重试登录 */
  const retryLogin = React.useCallback(
    async (platform: ThirdPartyPlatform): Promise<boolean> => {
      const cur = loginStates[platform]
      if (!cur) return false
      if (cur.retryCount >= MAX_RETRY) {
        toast.warning('重试次数过多，请尝试其他登录方式')
        return false
      }
      clearLoginState(platform)
      return startLogin(platform)
    },
    [clearLoginState, loginStates, startLogin, toast],
  )

  /** 取消登录 */
  const cancelLogin = React.useCallback(
    (platform: ThirdPartyPlatform) => {
      clearLoginState(platform)
      toast.info(`已取消${PLATFORM_DISPLAY_NAMES[platform] ?? platform}登录`)
    },
    [clearLoginState, toast],
  )

  // ---- 账号绑定 ----

  /** 绑定第三方账号 */
  const bindAccount = React.useCallback(
    async (platform: ThirdPartyPlatform, code: string): Promise<boolean> => {
      const displayName = PLATFORM_DISPLAY_NAMES[platform] ?? platform
      try {
        setIsLoading(true)
        const res = await fetchApi<{ success: boolean }>(BIND_PATH, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ platform, code }),
        })
        if (!res.success) {
          throw new Error(res.error)
        }
        toast.success(`${displayName}账号绑定成功`)
        await refreshBoundAccountsImpl(setBoundAccounts, toast)
        return true
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error)
        toast.error(`${displayName}账号绑定失败`, msg)
        return false
      } finally {
        setIsLoading(false)
      }
    },
    [toast],
  )

  /** 解绑第三方账号 */
  const unbindAccount = React.useCallback(
    async (platform: ThirdPartyPlatform): Promise<boolean> => {
      const displayName = PLATFORM_DISPLAY_NAMES[platform] ?? platform
      const account = getBoundAccount(platform)
      if (!account) {
        toast.error(`未找到${displayName}绑定的账号`)
        return false
      }
      try {
        setIsLoading(true)
        const res = await fetchApi<{ success: boolean }>(
          `${UNBIND_PATH}?id=${encodeURIComponent(account.id)}`,
          {
            method: 'DELETE',
          },
        )
        if (!res.success) {
          throw new Error(res.error)
        }
        toast.success(`${displayName}账号解绑成功`)
        await refreshBoundAccountsImpl(setBoundAccounts, toast)
        return true
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error)
        toast.error(`${displayName}账号解绑失败`, msg)
        return false
      } finally {
        setIsLoading(false)
      }
    },
    [getBoundAccount, toast],
  )

  /** 刷新已绑定账号列表 */
  const refreshBoundAccounts = React.useCallback(async () => {
    await refreshBoundAccountsImpl(setBoundAccounts, toast)
  }, [toast])

  // ---- Google One Tap ----

  /** 加载 Google GIS SDK 并初始化 One Tap */
  const loadGoogleOneTap = React.useCallback(
    async (clientId: string, callback: (credential: string) => void): Promise<void> => {
      if (typeof window === 'undefined') return
      if (!clientId) {
        toast.error('Google One Tap 初始化失败', '缺少 client_id')
        return
      }
      oneTapCallbackRef.current = callback

      const init = () => {
        const g = window.google?.accounts?.id
        if (!g) return
        const cfg: GoogleIdConfiguration = {
          client_id: clientId,
          callback: (resp) => {
            if (resp?.credential && oneTapCallbackRef.current) {
              oneTapCallbackRef.current(resp.credential)
            }
          },
          auto_select: false,
          cancel_on_tap_outside: true,
          context: 'signin',
        }
        g.initialize(cfg)
      }

      if (window.google?.accounts?.id) {
        init()
        return
      }

      // 动态注入 GIS 脚本
      await new Promise<void>((resolve, reject) => {
        const existing = document.getElementById('google-gis-script')
        if (existing) {
          existing.addEventListener('load', () => resolve())
          existing.addEventListener('error', () => reject(new Error('GIS 加载失败')))
          return
        }
        const script = document.createElement('script')
        script.id = 'google-gis-script'
        script.src = GOOGLE_GIS_SCRIPT_SRC
        script.async = true
        script.defer = true
        script.onload = () => resolve()
        script.onerror = () => reject(new Error('GIS 加载失败'))
        document.head.appendChild(script)
      }).catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err)
        toast.error('Google GIS 加载失败', msg)
      })

      init()
    },
    [toast],
  )

  /** 触发 Google One Tap 提示 */
  const promptGoogleOneTap = React.useCallback(() => {
    if (typeof window === 'undefined') return
    const g = window.google?.accounts?.id
    if (!g) {
      toast.warning('Google One Tap 尚未初始化')
      return
    }
    g.prompt((notification: PromptMomentNotification) => {
      if (notification.isNotDisplayed()) {
        const reason = notification.getNotDisplayedReason()
        if (reason !== 'opt_out_or_no_session' && reason !== 'suppressed_by_user') {
          toast.info('Google One Tap 未显示', reason)
        }
      }
    })
  }, [toast])

  // ---- 辅助 ----

  /** 校验过期状态 */
  const checkExpiredStates = React.useCallback(() => {
    const now = Date.now()
    setLoginStates((prev) => {
      let changed = false
      const next = { ...prev }
      for (const key of Object.keys(next) as ThirdPartyPlatform[]) {
        const s = next[key]
        if (s?.expiresAt && now > s.expiresAt) {
          next[key] = { ...s, status: 'expired', error: '登录已过期' }
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [])

  /** 清理所有状态 */
  const clearAllStates = React.useCallback(() => {
    setLoginStates({} as Record<ThirdPartyPlatform, ThirdPartyLoginState | undefined>)
    setCurrentPlatform(null)
    setIsLoading(false)
  }, [])

  return {
    enabledPlatforms,
    isAnyPlatformEnabled,
    currentPlatform,
    loginStates,
    boundAccounts,
    isLoading,
    isPlatformEnabled,
    isBound,
    getBoundAccount,
    getPlatformDisplayName,
    startLogin,
    handleCallback,
    handleLoginError,
    retryLogin,
    cancelLogin,
    bindAccount,
    unbindAccount,
    refreshBoundAccounts,
    loadGoogleOneTap,
    promptGoogleOneTap,
    checkExpiredStates,
    clearAllStates,
  }
}

// ---- 模块级辅助函数（避免 hook 闭包中重复定义） ----

/** 判断平台重试次数是否超限 */
function retryCountExceeds(
  platform: ThirdPartyPlatform,
  states: Record<ThirdPartyPlatform, ThirdPartyLoginState | undefined>,
): boolean {
  return (states[platform]?.retryCount ?? 0) >= MAX_RETRY - 1
}

/** 刷新已绑定账号列表实现 */
async function refreshBoundAccountsImpl(
  setBoundAccounts: React.Dispatch<React.SetStateAction<ThirdPartyAccount[]>>,
  toast: ReturnType<typeof useToast>,
): Promise<void> {
  try {
    const res = await fetchApi<ThirdPartyAccount[]>(BOUND_ACCOUNTS_PATH)
    if (res.success) {
      setBoundAccounts(res.data)
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    toast.error('刷新绑定账号列表失败', msg)
  }
}

/**
 * 获取 Google OAuth 配置（从后端拉取）。
 * 供组件判断 Google 是否已配置。
 */
export async function fetchGoogleOAuthConfig(): Promise<GoogleOAuthConfig | null> {
  try {
    const res = await fetchApi<GoogleOAuthConfig>('/api/auth/google/config')
    if (res.success) return res.data
    return null
  } catch {
    return null
  }
}
