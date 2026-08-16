'use client'

/**
 * @ihui/shared/hooks/use-register-form — 跨端共享注册表单 Hook(2026-07-29 立)
 *
 * 设计原则(与 useLoginForm 一致):
 * 1. 依赖注入:各端必须传入 registerApi / sendCodeApi / onRegisterSuccess,不内置任何平台 API
 * 2. 零新依赖:纯 useState + useCallback + useRef,不引入 zustand(兼容 extension MV3 / mobile-rn Hermes / Taro 小程序)
 * 3. 非破坏性:与各端现有注册组件平行存在,可通过接入消除重复的 useState + handleRegister 逻辑
 * 4. UI 无关:只提供状态 + 操作函数,各端 UI 自由绑定(web shadcn / RN Pressable / Taro View)
 * 5. 多注册类型支持:account / email / phone 三种,各端按需启用对应字段
 *
 * 复用基础设施:
 * - 不重复造轮子:各端可通过 onRegisterSuccess 桥接 useAuth().login 写 token + user(自动登录)
 * - 验证码倒计时:内置 60s 倒计时,各端注入 sendCodeApi 即可
 *
 * 各端接入示例:
 * - web EmailRegisterForm: useRegisterForm({ type: 'email', registerApi: (v) => registerByEmail(v.email, v.code, v.password), sendCodeApi: (v) => sendEmailCode(v.email, 'register'), ... })
 * - web PhoneRegisterForm: useRegisterForm({ type: 'phone', registerApi: (v) => registerByPhone(v.phone, v.code, v.password), sendCodeApi: (v) => sendCode(v.phone), ... })
 * - mobile-rn RegisterScreen: useRegisterForm({ type: 'account', registerApi: (v) => register(v.account, v.password), enableCode: false, enableConfirmPassword: true, onRegisterSuccess: async (token, rt, user) => auth.login(token, rt, user), ... })
 * - miniapp-taro register: useRegisterForm({ type: 'phone', registerApi: (v) => register({ phone: v.phone, code: v.code, password: v.password }), sendCodeApi: (v) => sendSmsCode(v.phone), ... })
 */

import { useCallback, useEffect, useRef, useState } from 'react'

/** 注册类型 */
export type RegisterType = 'account' | 'email' | 'phone'

/** 注册表单值 */
export interface RegisterFormValues {
  account: string
  email: string
  phone: string
  code: string
  password: string
  confirmPassword: string
}

/** 注册 API 返回值(与 LoginApiResult 一致,注册成功可直接用于自动登录) */
export interface RegisterApiResult {
  success: boolean
  accessToken?: string
  refreshToken?: string
  user?: RegisterUser
  error?: string
}

/** 注册用户信息(与 LoginUser 一致) */
export interface RegisterUser {
  id: string
  nickname: string
  avatar?: string
}

/** 发送验证码 API 返回值 */
export interface SendCodeApiResult {
  success: boolean
  error?: string
}

export interface UseRegisterFormOptions {
  /** 注册类型:account(账号)/ email(邮箱)/ phone(手机) */
  type: RegisterType
  /** 注册 API(各端注入) */
  registerApi: (values: RegisterFormValues) => Promise<RegisterApiResult>
  /** 发送验证码 API(各端注入;enableCode=false 时可不传) */
  sendCodeApi?: (values: RegisterFormValues) => Promise<SendCodeApiResult>
  /** 注册成功后回调(各端注入,可用于自动登录 + 路由跳转) */
  onRegisterSuccess?: (result: RegisterApiResult) => void | Promise<void>
  /** 注册成功后回调(各端注入,用于关闭弹窗/路由跳转,与 onRegisterSuccess 二选一或都用) */
  onSuccess?: () => void
  /** 是否启用验证码(默认 true;account 类型通常 false) */
  enableCode?: boolean
  /** 是否启用确认密码(默认 true) */
  enableConfirmPassword?: boolean
  /** 是否启用协议勾选(默认 false,各端按需) */
  enableAgreement?: boolean
  /** 是否启用注册后自动登录(默认 false;true 时需 onRegisterSuccess 桥接 useAuth) */
  enableAutoLogin?: boolean
  /** 验证码倒计时秒数(默认 60) */
  countdownSeconds?: number
  /** 账号最小长度(默认 3) */
  minAccountLength?: number
  /** 密码最小长度(默认 6) */
  minPasswordLength?: number
  /** 密码最大长度(默认 64) */
  maxPasswordLength?: number
  /** 验证码长度(默认 6;手机验证码 6 位) */
  codeLength?: number
  /** 手机号正则(默认中国大陆 /^1[3-9]\d{9}$/) */
  phoneRegex?: RegExp
  /** 邮箱正则(默认标准邮箱格式) */
  emailRegex?: RegExp
  /** 倒计时初始值(测试用,默认 0) */
  initialCountdown?: number
}

export interface UseRegisterFormReturn {
  /** 表单状态 */
  values: RegisterFormValues
  setAccount: (v: string) => void
  setEmail: (v: string) => void
  setPhone: (v: string) => void
  setCode: (v: string) => void
  setPassword: (v: string) => void
  setConfirmPassword: (v: string) => void
  /** 协议勾选(仅 enableAgreement=true 时有意义) */
  agreed: boolean
  setAgreed: (v: boolean) => void
  /** UI 状态 */
  submitting: boolean
  sendingCode: boolean
  error: string | null
  info: string | null
  setError: (e: string | null) => void
  setInfo: (e: string | null) => void
  clearError: () => void
  /** 验证码倒计时 */
  countdown: number
  /** 操作函数 */
  register: () => Promise<void>
  sendCode: () => Promise<void>
  /** 是否禁用提交按钮 */
  disabled: boolean
  /** 是否禁用发送验证码按钮(countdown > 0 或 sendingCode) */
  codeBtnDisabled: boolean
}

/**
 * 跨端共享注册表单 Hook
 *
 * @example
 * ```ts
 * // web 邮箱注册接入示例
 * const form = useRegisterForm({
 *   type: 'email',
 *   registerApi: async (v) => {
 *     const r = await registerByEmail(v.email, v.code, v.password)
 *     return { success: r.success, error: r.error }
 *   },
 *   sendCodeApi: async (v) => {
 *     const r = await sendEmailCode(v.email, 'register')
 *     return { success: r.success, error: r.error }
 *   },
 *   enableAgreement: true,
 *   onSuccess: () => setMode('login'),
 * })
 * ```
 */
export function useRegisterForm(options: UseRegisterFormOptions): UseRegisterFormReturn {
  const {
    type,
    registerApi,
    sendCodeApi,
    onRegisterSuccess,
    onSuccess,
    enableCode = true,
    enableConfirmPassword = true,
    enableAgreement = false,
    enableAutoLogin = false,
    countdownSeconds = 60,
    minAccountLength = 3,
    minPasswordLength = 6,
    maxPasswordLength = 64,
    codeLength = 6,
    phoneRegex = /^1[3-9]\d{9}$/,
    emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    initialCountdown = 0,
  } = options

  const [values, setValues] = useState<RegisterFormValues>({
    account: '',
    email: '',
    phone: '',
    code: '',
    password: '',
    confirmPassword: '',
  })
  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [sendingCode, setSendingCode] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [countdown, setCountdown] = useState(initialCountdown)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // 倒计时 effect
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [])

  const setAccount = useCallback((v: string) => setValues((p) => ({ ...p, account: v })), [])
  const setEmail = useCallback((v: string) => setValues((p) => ({ ...p, email: v })), [])
  const setPhone = useCallback((v: string) => setValues((p) => ({ ...p, phone: v })), [])
  const setCode = useCallback((v: string) => setValues((p) => ({ ...p, code: v })), [])
  const setPassword = useCallback((v: string) => setValues((p) => ({ ...p, password: v })), [])
  const setConfirmPassword = useCallback(
    (v: string) => setValues((p) => ({ ...p, confirmPassword: v })),
    [],
  )

  const clearError = useCallback(() => setError(null), [])

  /** 启动倒计时 */
  const startCountdown = useCallback(() => {
    setCountdown(countdownSeconds)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          if (timerRef.current) {
            clearInterval(timerRef.current)
            timerRef.current = null
          }
          return 0
        }
        return c - 1
      })
    }, 1000)
  }, [countdownSeconds])

  /** 本地校验,返回错误 key 或 null */
  const validate = useCallback((): string | null => {
    if (type === 'account') {
      if (values.account.trim().length < minAccountLength) {
        return 'auth.invalidAccount'
      }
    } else if (type === 'email') {
      if (!emailRegex.test(values.email)) {
        return 'auth.invalidEmail'
      }
    } else if (type === 'phone') {
      if (!phoneRegex.test(values.phone.trim())) {
        return 'auth.invalidPhone'
      }
    }

    if (enableCode && values.code.length < codeLength) {
      return 'auth.codePlaceholder'
    }

    if (values.password.length < minPasswordLength || values.password.length > maxPasswordLength) {
      return 'auth.invalidPassword'
    }

    if (enableConfirmPassword && values.password !== values.confirmPassword) {
      return 'auth.passwordMismatch'
    }

    if (enableAgreement && !agreed) {
      return 'auth.agreeRequired'
    }

    return null
  }, [
    type,
    values,
    enableCode,
    enableConfirmPassword,
    enableAgreement,
    agreed,
    minAccountLength,
    minPasswordLength,
    maxPasswordLength,
    codeLength,
    phoneRegex,
    emailRegex,
  ])

  const register = useCallback(async () => {
    setError(null)
    setInfo(null)

    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setSubmitting(true)
    try {
      const result = await registerApi(values)
      if (!result.success) {
        setError(result.error ?? 'auth.registerFailed')
        return
      }

      // 注册成功
      if (enableAutoLogin && onRegisterSuccess) {
        // 自动登录模式:把 token + user 交给 onRegisterSuccess
        await onRegisterSuccess(result)
      } else {
        // 非自动登录:仅提示成功 + 跳转
        setInfo('auth.registerSuccess')
      }

      onSuccess?.()
    } catch {
      setError('auth.registerFailed')
    } finally {
      setSubmitting(false)
    }
  }, [validate, registerApi, values, enableAutoLogin, onRegisterSuccess, onSuccess])

  const sendCode = useCallback(async () => {
    if (!sendCodeApi || countdown > 0 || sendingCode) return

    // 发送前校验对应字段
    if (type === 'email' && !emailRegex.test(values.email)) {
      setError('auth.invalidEmail')
      return
    }
    if (type === 'phone' && !phoneRegex.test(values.phone.trim())) {
      setError('auth.invalidPhone')
      return
    }

    setError(null)
    setSendingCode(true)
    try {
      const result = await sendCodeApi(values)
      if (result.success) {
        setInfo('auth.codeSent')
        startCountdown()
      } else {
        setError(result.error ?? 'auth.sendCodeFailed')
      }
    } catch {
      setError('auth.sendCodeFailed')
    } finally {
      setSendingCode(false)
    }
  }, [sendCodeApi, countdown, sendingCode, type, values, phoneRegex, emailRegex, startCountdown])

  return {
    values,
    setAccount,
    setEmail,
    setPhone,
    setCode,
    setPassword,
    setConfirmPassword,
    agreed,
    setAgreed,
    submitting,
    sendingCode,
    error,
    info,
    setError,
    setInfo,
    clearError,
    countdown,
    register,
    sendCode,
    disabled: submitting,
    codeBtnDisabled: countdown > 0 || sendingCode,
  }
}
