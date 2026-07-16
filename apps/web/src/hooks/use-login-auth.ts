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
        const res = await apiLoginBySms(phone, code)
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
