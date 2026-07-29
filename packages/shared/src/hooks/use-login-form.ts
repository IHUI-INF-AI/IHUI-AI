'use client'

/**
 * @ihui/shared/hooks/use-login-form — 跨端共享登录表单 Hook(2026-07-29 立)
 *
 * 设计原则(与 useAuth 一致):
 * 1. 依赖注入:各端必须传入 loginApi / storage / onLoginSuccess,不内置任何平台 API
 * 2. 零新依赖:纯 useState + useCallback,不引入 zustand(兼容 extension MV3 / mobile-rn Hermes / Taro 小程序)
 * 3. 非破坏性:与各端现有登录组件平行存在,可通过接入消除重复的 useState + handleLogin 逻辑
 * 4. UI 无关:只提供状态 + 操作函数,各端 UI 自由绑定(web shadcn / RN Pressable / Taro View)
 *
 * 复用基础设施:
 * - 不重复造轮子:各端可通过 onLoginSuccess 桥接 useAuth().login 写 token + user
 * - SSO 登录:各端注入 ssoLogin 函数即可,内部复用 @ihui/shared/auth/sso-core
 *
 * 各端接入示例:
 * - web: useLoginForm({ loginApi: (a,p) => fetchApi('/api/auth/login', {...}), storage: webStorage, onLoginSuccess: (t,r,u) => { setTokenWithPrefs(t,r,autoLogin); setUser(u) } })
 * - mobile-rn: useLoginForm({ loginApi: (a,p) => authApi.login(a,p), storage: rnStorage, onLoginSuccess: (t,r,u) => auth.login(t,r,u) })
 * - miniapp-taro: useLoginForm({ loginApi: (a,p) => loginByPassword(a,p), storage: taroStorage, onLoginSuccess: (t,r,u) => setAuth(t,u,r) })
 */

import { useCallback, useState } from 'react'

/** 登录 API 返回值(各端 loginApi 注入函数的统一返回格式) */
export interface LoginApiResult {
  success: boolean
  accessToken?: string
  refreshToken?: string
  user?: LoginUser
  error?: string
}

/** 登录用户信息(精简版,各端可扩展) */
export interface LoginUser {
  id: string
  nickname: string
  avatar?: string
}

/** 已记住的凭据 */
export interface RememberedCredentials {
  account: string
  password: string
}

/**
 * 凭据持久化存储接口(各端注入实现)
 *
 * - web: 基于 localStorage(参考 apps/web/src/lib/remember-credentials.ts)
 * - mobile-rn: 基于 AsyncStorage
 * - miniapp-taro: 基于 Taro.setStorageSync
 */
export interface CredentialStorage {
  loadRemembered: () => RememberedCredentials | null
  saveRemembered: (account: string, password: string) => void
  clearRemembered: () => void
  loadAutoLogin: () => boolean
  saveAutoLogin: (enabled: boolean) => void
  clearAutoLogin: () => void
  saveLoginHistory: (account: string) => void
}

export interface UseLoginFormOptions {
  /** 调用后端登录 API(各端注入,返回统一格式) */
  loginApi: (account: string, password: string) => Promise<LoginApiResult>
  /** 凭据持久化存储(各端注入) */
  storage: CredentialStorage
  /** 登录成功后写 token + user 的回调(各端注入,通常桥接 useAuth().login) */
  onLoginSuccess: (
    accessToken: string,
    refreshToken: string,
    user?: LoginUser,
  ) => void | Promise<void>
  /** SSO 登录函数(可选,各端注入;不传则 ssoLoginAction 为 no-op) */
  ssoLogin?: () => Promise<LoginApiResult>
  /** 登录成功后回调(可选,各端注入,用于关闭弹窗/路由跳转) */
  onSuccess?: () => void
  /** 是否启用记住密码功能(默认 true;false 时 rememberPassword/autoLogin 恒为 false) */
  enableRemember?: boolean
  /** 账号最小长度(默认 3,与 web 端 accountSchema 一致) */
  minAccountLength?: number
  /** 密码最小长度(默认 6,与 web 端 loginSchema 一致) */
  minPasswordLength?: number
}

export interface UseLoginFormReturn {
  /** 表单状态 */
  account: string
  password: string
  setAccount: (v: string) => void
  setPassword: (v: string) => void
  /** UI 状态 */
  loading: boolean
  ssoLoading: boolean
  error: string | null
  setError: (e: string | null) => void
  clearError: () => void
  /** 记住密码(仅在 enableRemember=true 时有意义) */
  rememberPassword: boolean
  setRememberPassword: (v: boolean) => void
  autoLogin: boolean
  setAutoLogin: (v: boolean) => void
  /** 初始化时加载的已记住凭据(供各端 UI 回填表单) */
  remembered: RememberedCredentials | null
  /** 操作函数 */
  login: () => Promise<void>
  ssoLoginAction: () => Promise<void>
  /** 是否禁用按钮(loading 或 ssoLoading) */
  disabled: boolean
}

/**
 * 跨端共享登录表单 Hook
 *
 * @example
 * ```ts
 * // web 端接入示例
 * const form = useLoginForm({
 *   loginApi: async (account, password) => {
 *     const result = await fetchApi<LoginData>('/api/auth/login', {
 *       method: 'POST',
 *       body: JSON.stringify({ account, password }),
 *     })
 *     return {
 *       success: result.success && !!result.data?.accessToken,
 *       accessToken: result.data?.accessToken,
 *       refreshToken: result.data?.refreshToken,
 *       user: result.data?.user,
 *       error: result.error,
 *     }
 *   },
 *   storage: webCredentialStorage,
 *   onLoginSuccess: (token, refreshToken, user) => {
 *     setTokenWithPrefs(token, refreshToken, autoLogin)
 *     if (user) setUser(user)
 *   },
 *   onSuccess: () => onSuccess?.(),
 * })
 * ```
 */
export function useLoginForm(options: UseLoginFormOptions): UseLoginFormReturn {
  const {
    loginApi,
    storage,
    onLoginSuccess,
    ssoLogin,
    onSuccess,
    enableRemember = true,
    minAccountLength = 3,
    minPasswordLength = 6,
  } = options

  // 初始化时加载已记住凭据(各端 UI 可据此回填表单)
  const [remembered] = useState<RememberedCredentials | null>(() =>
    enableRemember ? storage.loadRemembered() : null,
  )

  const [account, setAccount] = useState<string>(remembered?.account ?? '')
  const [password, setPassword] = useState<string>(remembered?.password ?? '')
  const [loading, setLoading] = useState(false)
  const [ssoLoading, setSsoLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [rememberPassword, setRememberPasswordState] = useState<boolean>(!!remembered)
  const [autoLogin, setAutoLoginState] = useState<boolean>(
    enableRemember && !!remembered && storage.loadAutoLogin(),
  )

  const clearError = useCallback(() => setError(null), [])

  const setRememberPassword = useCallback((v: boolean) => {
    setRememberPasswordState(v)
    if (!v) {
      setAutoLoginState(false)
    }
  }, [])

  const setAutoLogin = useCallback(
    (v: boolean) => {
      if (v && !rememberPassword) {
        setRememberPasswordState(true)
      }
      setAutoLoginState(v)
    },
    [rememberPassword],
  )

  const login = useCallback(async () => {
    setError(null)

    // 本地校验(与 web 端 loginSchema 一致:account >= 3, password >= 6)
    if (account.length < minAccountLength) {
      setError('auth.invalidAccount')
      return
    }
    if (password.length < minPasswordLength) {
      setError('auth.invalidPassword')
      return
    }

    setLoading(true)
    try {
      const result = await loginApi(account, password)
      if (!result.success || !result.accessToken) {
        setError(result.error ?? 'auth.loginFailed')
        return
      }

      // 保存/清除凭据 + 账号历史 + 自动登录标志(仅在启用记住密码时)
      if (enableRemember) {
        if (rememberPassword) {
          storage.saveRemembered(account, password)
        } else {
          storage.clearRemembered()
          if (autoLogin) {
            setAutoLoginState(false)
            storage.clearAutoLogin()
          }
        }
        storage.saveAutoLogin(autoLogin && rememberPassword)
        storage.saveLoginHistory(account)
      }

      // 写 token + user(各端注入的回调)
      await onLoginSuccess(result.accessToken, result.refreshToken ?? '', result.user)

      onSuccess?.()
    } catch {
      setError('auth.loginFailed')
    } finally {
      setLoading(false)
    }
  }, [
    account,
    password,
    loginApi,
    storage,
    onLoginSuccess,
    onSuccess,
    enableRemember,
    rememberPassword,
    autoLogin,
    minAccountLength,
    minPasswordLength,
  ])

  const ssoLoginAction = useCallback(async () => {
    if (!ssoLogin) return
    setError(null)
    setSsoLoading(true)
    try {
      const result = await ssoLogin()
      if (!result.success || !result.accessToken) {
        setError(result.error ?? 'auth.ssoFailed')
        return
      }
      await onLoginSuccess(result.accessToken, result.refreshToken ?? '', result.user)
      onSuccess?.()
    } catch {
      setError('auth.ssoFailed')
    } finally {
      setSsoLoading(false)
    }
  }, [ssoLogin, onLoginSuccess, onSuccess])

  return {
    account,
    password,
    setAccount,
    setPassword,
    loading,
    ssoLoading,
    error,
    setError,
    clearError,
    rememberPassword,
    setRememberPassword,
    autoLogin,
    setAutoLogin,
    remembered,
    login,
    ssoLoginAction,
    disabled: loading || ssoLoading,
  }
}
