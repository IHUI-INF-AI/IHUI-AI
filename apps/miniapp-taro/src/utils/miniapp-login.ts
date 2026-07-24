/**
 * 跨端小程序统一登录入口
 *
 * 自动适配微信小程序(weapp)与支付宝小程序(alipay):
 * - 微信:Taro.login 拿 code → POST /auth/login/wechat
 * - 支付宝:Taro.getAuthCode 拿 authCode → POST /auth/alipay/login
 *
 * 底层 API 差异由 platform/auth 封装,本模块负责:
 * 1. 获取平台 code
 * 2. 调后端换 token
 * 3. (可选)合并用户资料
 * 4. 持久化 token / refreshToken / userInfo
 */
import { login as platformLogin, getUserProfile as platformGetUserProfile, isWeapp, isAlipay } from '../platform'
import { loginByWechat, loginByAlipay } from '../api'
import { setToken, setRefreshToken, setUserInfo, type UserInfo, type LoginResult } from './auth'
import { useUserStore } from '../stores/user'

export interface MiniAppLoginOptions {
  /** 是否同时获取用户头像/昵称 */
  withProfile?: boolean
  /** 邀请码(分销场景) */
  inviteCode?: string
}

export interface MiniAppLoginResult {
  user: UserInfo
  isNewUser: boolean
  platform: 'weapp' | 'alipay'
}

/** 是否在小程序环境(微信或支付宝) */
export function isMiniAppEnvironment(): boolean {
  return isWeapp() || isAlipay()
}

/**
 * 跨端小程序登录。非小程序环境直接抛错(由调用方降级到手机号登录)。
 */
export async function miniAppLogin(options: MiniAppLoginOptions = {}): Promise<MiniAppLoginResult> {
  if (!isMiniAppEnvironment()) {
    throw new Error('请在小程序中使用本登录')
  }

  // 1. 拿平台 code(微信 code 或支付宝 authCode)
  const { code, platform } = await platformLogin()
  if (!code) throw new Error('登录授权码为空')

  // 2. 调后端换 token(根据平台走不同接口)
  let result: LoginResult
  if (platform === 'weapp') {
    result = await loginByWechat(code)
  } else {
    result = await loginByAlipay(code) as LoginResult
  }
  const { accessToken, refreshToken, user } = result

  // 3. (可选)拿用户资料合并
  let profileNick: string | undefined
  let profileAvatar: string | undefined
  if (options.withProfile) {
    try {
      const profile = await platformGetUserProfile()
      profileNick = profile.nickName
      profileAvatar = profile.avatarUrl
    } catch {
      // 用户拒绝授权不阻断登录
    }
  }

  // 4. 合并昵称/头像
  const finalUser: UserInfo = {
    ...user,
    nickname: user.nickname || profileNick || user.userName || `${platform === 'weapp' ? '微信' : '支付宝'}用户`,
    avatar: user.avatar || profileAvatar,
  }

  // 5. 持久化(storage + store 双写)
  setToken(accessToken)
  setRefreshToken(refreshToken)
  setUserInfo(finalUser)
  try {
    useUserStore.getState().setAuth(accessToken, finalUser, refreshToken)
  } catch {
    // store 可能未挂载,忽略
  }

  return {
    user: finalUser,
    isNewUser: Boolean((finalUser as { isNewUser?: boolean }).isNewUser),
    platform,
  }
}
