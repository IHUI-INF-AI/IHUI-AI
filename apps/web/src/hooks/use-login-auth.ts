'use client'

import * as React from 'react'

import { useAuthStore, type AuthUser } from '@/stores/auth'
import { fetchApi } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'

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

interface TokenPayload {
  accessToken: string
  refreshToken?: string
  user: AuthUser
}

/** 登录认证 Hook,封装账号密码/验证码登录与注册 */
export function useLoginAuth(): UseLoginAuthReturn {
  const toast = useToast()
  const setToken = useAuthStore((s) => s.setToken)
  const setUser = useAuthStore((s) => s.setUser)
  const [loading, setLoading] = React.useState(false)

  const applyLogin = React.useCallback(
    (data: TokenPayload) => {
      setToken(data.accessToken, data.refreshToken ?? null)
      setUser(data.user)
    },
    [setToken, setUser],
  )

  const login = React.useCallback(
    async (input: LoginInput): Promise<boolean> => {
      setLoading(true)
      try {
        const res = await fetchApi<TokenPayload>('/auth/login', {
          method: 'POST',
          body: JSON.stringify(input),
        })
        if (res.success) {
          applyLogin(res.data)
          toast.success('登录成功')
          return true
        }
        toast.error('登录失败', res.error)
        return false
      } finally {
        setLoading(false)
      }
    },
    [applyLogin, toast],
  )

  const loginByCode = React.useCallback(
    async (phone: string, code: string): Promise<boolean> => {
      setLoading(true)
      try {
        const res = await fetchApi<TokenPayload>('/auth/login-code', {
          method: 'POST',
          body: JSON.stringify({ phone, code }),
        })
        if (res.success) {
          applyLogin(res.data)
          toast.success('登录成功')
          return true
        }
        toast.error('登录失败', res.error)
        return false
      } finally {
        setLoading(false)
      }
    },
    [applyLogin, toast],
  )

  const register = React.useCallback(
    async (input: LoginInput & { phone: string }): Promise<boolean> => {
      setLoading(true)
      try {
        const res = await fetchApi<TokenPayload>('/auth/register', {
          method: 'POST',
          body: JSON.stringify(input),
        })
        if (res.success) {
          applyLogin(res.data)
          toast.success('注册成功')
          return true
        }
        toast.error('注册失败', res.error)
        return false
      } finally {
        setLoading(false)
      }
    },
    [applyLogin, toast],
  )

  return { loading, login, loginByCode, register }
}
