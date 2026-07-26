/**
 * Extension 端 LoginApiClient 实现(2026-07-26 立)
 *
 * 共享 @ihui/ui-react.LoginForm 的 apiClient 适配层,把 web fetchApi + 后端
 * 4 个登录端点(账号密码 / 邮箱验证码 / 手机验证码 / 第三方)封装成 LoginApiClient
 * 接口,扩展端 popup + sidepanel 共享使用,与 web 端 LoginDialog 视觉/功能 100% 一致。
 *
 * 关键差异(对比 web 端实现 apps/web/src/components/login/EmailCodeLoginForm.tsx):
 *   - token 存 chrome.storage.local(非 cookie / localStorage)
 *   - 登录成功后调 scheduleRefreshAlarm + startAutoRefresh 启动定时刷新
 *   - apiClient 不处理第三方登录(qr / web oauth) → useExtensionThirdPartyAuth 跳 web
 *   - 复用 @ihui/api-client 已有的 loginByAccount / loginBySms / sendSmsCode
 *   - 邮箱登录端点 @ihui/api-client 未导出,直接用 fetchApi 调 /api/auth/login/email
 */
import { fetchApi, loginByAccount, loginBySms, sendSmsCode } from '@ihui/api-client'

import { setTokenPair } from './token'
import { scheduleRefreshAlarm, startAutoRefresh } from './token-utils'
import type { LoginApiClient, LoginResult } from '@ihui/ui-react'

/** 登录成功后的副作用:写 token + 启动定时刷新。 */
function handleLoginSuccess(data: LoginResult): void {
  void setTokenPair({
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    expiresIn: data.expiresIn,
  }).then(() => {
    scheduleRefreshAlarm(data.accessToken)
    startAutoRefresh()
  })
}

export function createExtensionLoginApiClient(): LoginApiClient {
  return {
    /** 账号密码登录(手机号 / 邮箱 / 用户名),支持图形验证码 */
    loginByAccount: async (account, password, captcha) => {
      const result = await loginByAccount(account, password, captcha)
      if (result.success && result.data) {
        handleLoginSuccess(result.data)
      }
      return result
    },

    /** 邮箱验证码登录(扩展端直接调后端端点) */
    loginByEmailCode: async (email, code) => {
      const result = await fetchApi<LoginResult>('/api/auth/login/email', {
        method: 'POST',
        body: JSON.stringify({ email, code }),
      })
      if (result.success && result.data) {
        handleLoginSuccess(result.data)
      }
      return result
    },

    /** 手机号验证码登录 */
    loginBySms: async (phone, code) => {
      const result = await loginBySms(phone, code)
      if (result.success && result.data) {
        handleLoginSuccess(result.data)
      }
      return result
    },

    /** 发送邮箱验证码(扩展端直接调后端端点) */
    sendEmailCode: async (email) => {
      return fetchApi<{ sent: boolean }>('/api/auth/email/code', {
        method: 'POST',
        body: JSON.stringify({ email }),
      })
    },

    /** 发送手机验证码(场景: login) */
    sendSmsCode: async (phone) => {
      return sendSmsCode(phone, 'login')
    },
  }
}
