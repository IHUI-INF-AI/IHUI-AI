/**
 * login-api — Extension 端 LoginApiClient 适配器(2026-07-26 立)
 *
 * 把 @ihui/api-client 提供的 loginByAccount / loginBySms / sendSmsCode 等
 * 适配成共享 @ihui/ui-react.LoginForm 需要的 LoginApiClient 接口。
 *
 * 关键点:
 *   1. 邮箱登录(/api/auth/login/email + /api/auth/email/code)api-client 没
 *      提供现成 wrapper,这里直接用 fetchApi 调后端端点;后端未启用时友好
 *      降级(返回 error 让 LoginForm 显示错误提示)。
 *   2. LoginApiClient.loginByAccount 返回 LoginResult,而 api-client 返回
 *      ApiResult<LoginResult>,需要适配字段(success / data / error)。
 *   3. 不依赖 extension 端的任何 store / token,只负责"调用后端"。
 *      成功后的 token 存储由 popup / sidepanel 各自处理(经过 onSuccess 回调)。
 */
import { fetchApi, loginByAccount, loginBySms, sendSmsCode } from '@ihui/api-client'
import type {
  LoginApiClient,
  LoginResult,
} from '@ihui/ui-react'

/** 把 ApiResult 包装成 LoginResult(共享包 LoginForm 期待的格式) */
function wrap(
  res: { success: boolean; data?: { accessToken: string; refreshToken: string; expiresIn: number; user?: any }; error?: string },
): LoginResult {
  if (res.success && res.data) {
    return {
      success: true,
      data: {
        accessToken: res.data.accessToken,
        refreshToken: res.data.refreshToken,
        expiresIn: res.data.expiresIn,
        user: res.data.user,
      },
    }
  }
  return {
    success: false,
    error: res.error || '登录失败',
  }
}

/** 包装后的 LoginApiClient 实例(共享包 LoginForm 直接用) */
export const loginApiClient: LoginApiClient = {
  /**
   * 账号+密码登录(手机/邮箱/用户名)
   * 后端路径:/api/auth/login
   */
  async loginByAccount(account: string, password: string) {
    return wrap(await loginByAccount(account, password))
  },

  /**
   * 邮箱+验证码登录
   * 后端路径:/api/auth/login/email(api-client 没提供 wrapper,直接 fetchApi)
   */
  async loginByEmailCode(email: string, code: string) {
    const res = await fetchApi<{
      accessToken: string
      refreshToken: string
      expiresIn: number
      user?: NonNullable<LoginResult['data']>['user']
    }>('/api/auth/login/email', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    })
    return wrap(res)
  },

  /**
   * 手机+验证码登录
   * 后端路径:/api/auth/login/sms(api-client 提供 loginBySms)
   */
  async loginByPhoneCode(phone: string, code: string) {
    return wrap(await loginBySms(phone, code))
  },

  /**
   * 发送邮箱验证码
   * 后端路径:/api/auth/email/code
   */
  async sendEmailCode(email: string) {
    const res = await fetchApi<{ sent: boolean }>('/api/auth/email/code', {
      method: 'POST',
      body: JSON.stringify({ email }),
    })
    if (res.success) return { success: true }
    return { success: false, error: res.error }
  },

  /**
   * 发送手机验证码
   * 后端路径:/api/auth/sms/send(api-client 提供 sendSmsCode,scene 默认 'login')
   */
  async sendPhoneCode(phone: string) {
    const res = await sendSmsCode(phone, 'login')
    if (res.success) return { success: true }
    return { success: false, error: res.error }
  },
}
