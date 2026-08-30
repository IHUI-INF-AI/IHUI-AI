'use client'

import * as React from 'react'
import {
  loginByAccount as apiLoginByAccount,
  loginBySms as apiLoginBySms,
  register as apiRegister,
  type LoginResult,
} from '@ihui/api-client'

import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/hooks/use-toast'
import { useAnalytics } from '@/hooks/use-analytics'

export interface LoginInput {
  account: string
  password: string
  captcha?: string
}

export interface UseLoginAuthReturn {
  loading: boolean
  login: (input: LoginInput) => Promise<boolean>
  loginByCode: (phone: string, code: string) => Promise<boolean>
  register: (input: LoginInput & { phone: string }) => Promise<boolean>
}

/** 登录认证 Hook,封装账号密码/验证码登录与注册 */
export function useLoginAuth(): UseLoginAuthReturn {
  const toast = useToast()
  const { track } = useAnalytics()
  const setToken = useAuthStore((s) => s.setToken)
  const setUser = useAuthStore((s) => s.setUser)
  const [loading, setLoading] = React.useState(false)

  const applyLogin = React.useCallback(
    (data: LoginResult) => {
      setToken(data.accessToken, data.refreshToken ?? null)
      setUser(data.user)
    },
    [setToken, setUser],
  )

  const login = React.useCallback(
    async (input: LoginInput): Promise<boolean> => {
      setLoading(true)
      try {
        const res = await apiLoginByAccount(input.account, input.password, input.captcha)
        if (res.success) {
          applyLogin(res.data)
          // 转化埋点：登录成功（账号密码）
          track({ name: 'login_success', category: 'auth', label: 'account' })
          toast.success('登录成功')
          return true
        }
        toast.error('登录失败', res.error)
        return false
      } finally {
        setLoading(false)
      }
    },
    [applyLogin, toast, track],
  )

  const loginByCode = React.useCallback(
    async (phone: string, code: string): Promise<boolean> => {
      setLoading(true)
      try {
        const res = await apiLoginBySms(phone, code)
        if (res.success) {
          applyLogin(res.data)
          // 转化埋点：登录成功（短信验证码）
          track({ name: 'login_success', category: 'auth', label: 'sms' })
          toast.success('登录成功')
          return true
        }
        toast.error('登录失败', res.error)
        return false
      } finally {
        setLoading(false)
      }
    },
    [applyLogin, toast, track],
  )

  const register = React.useCallback(
    async (input: LoginInput & { phone: string }): Promise<boolean> => {
      setLoading(true)
      try {
        const res = await apiRegister(
          input.phone,
          input.password,
          undefined,
          undefined,
          input.account,
          input.captcha,
        )
        if (res.success) {
          applyLogin(res.data)
          // 转化埋点：注册成功
          track({ name: 'register_success', category: 'auth', label: 'register' })
          toast.success('注册成功')
          return true
        }
        toast.error('注册失败', res.error)
        return false
      } finally {
        setLoading(false)
      }
    },
    [applyLogin, toast, track],
  )

  return { loading, login, loginByCode, register }
}
