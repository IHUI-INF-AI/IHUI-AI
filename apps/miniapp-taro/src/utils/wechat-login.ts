/**
 * 真实微信登录流程
 *
 * 流程:
 * 1. Taro.login() 获取临时登录凭证 code(有效期 5 分钟)
 * 2. (可选)Taro.getUserProfile() 获取加密的用户信息
 * 3. POST /auth/login/wechat → 后端用 code + AppID/Secret 换 unionid/openid
 * 4. 后端返回 LoginResult(accessToken + refreshToken + user)
 * 5. 持久化 token / refreshToken / userInfo(通过 user store)
 *
 * 设计要点:
 * - 兼容 H5 端(无 wx.login 时的友好降级)
 * - 网络失败 / code 失效有清晰错误(错误信息 i18n 化,根据当前 locale 返回)
 * - 单元测试可独立运行(纯函数 + 注入依赖)
 */
import Taro from '@tarojs/taro'
import { loginByWechat } from '../api'
import { setToken, setRefreshToken, setUserInfo, type UserInfo } from './auth'
import { useUserStore } from '../stores/user'
import { miniapp as zhCN } from '@ihui/i18n/locales/zh-CN'
import { miniapp as en } from '@ihui/i18n/locales/en'
import { miniapp as ja } from '@ihui/i18n/locales/ja'
import { miniapp as ko } from '@ihui/i18n/locales/ko'
import { miniapp as zhTW } from '@ihui/i18n/locales/zh-TW'

/** 读取当前 locale 下的 i18n 字典(非 hook 场景,供工具函数使用) */
function getCurrentDict(): typeof zhCN {
  try {
    const stored = Taro.getStorageSync('lang') as string
    if (stored === 'en') return en as typeof zhCN
    if (stored === 'ja') return ja as typeof zhCN
    if (stored === 'ko') return ko as typeof zhCN
    if (stored === 'zh-TW') return zhTW as typeof zhCN
  } catch {
    /* ignore */
  }
  return zhCN
}

function loginT(key: string, fallback: string): string {
  const value = (getCurrentDict() as Record<string, unknown>).login as
    Record<string, string> | undefined
  return value && typeof value[key] === 'string' ? value[key] : fallback
}

export interface WechatLoginOptions {
  /** 是否同时获取用户头像/昵称(新版小程序要求 button open-type 触发) */
  withProfile?: boolean
  /** 邀请码(分销场景) */
  inviteCode?: string
}

export interface WechatLoginResult {
  user: UserInfo
  isNewUser: boolean
}

/** Taro.login success 回调结构 */
interface LoginSuccessRes {
  code?: string
  errMsg?: string
}

/** Taro.getUserProfile success 回调结构 */
interface UserProfileSuccessRes {
  userInfo?: {
    nickName?: string
    avatarUrl?: string
    gender?: number
    country?: string
    province?: string
    city?: string
  }
  encryptedData?: string
  iv?: string
  errMsg?: string
}

/** 抽象 wx.login / getUserProfile,便于单测 mock */
export interface WechatClient {
  login: () => Promise<string>
  getUserProfile?: () => Promise<UserProfileSuccessRes>
  /** 字符串形式返回 Taro.getEnv() 结果(避免测试需要 mock 整个 ENV_TYPE 枚举) */
  getEnv: () => string
}

export const defaultWechatClient: WechatClient = {
  login: () =>
    new Promise<string>((resolve, reject) => {
      Taro.login({
        success: (res: LoginSuccessRes) => {
          if (res.code) resolve(res.code)
          else reject(new Error(res.errMsg || loginT('wechatFailed', '微信登录失败')))
        },
        fail: (err: { errMsg?: string }) =>
          reject(new Error(err.errMsg || loginT('wechatFailed', '微信登录失败'))),
      })
    }),
  getUserProfile: () =>
    new Promise<UserProfileSuccessRes>((resolve, reject) => {
      Taro.getUserProfile({
        desc: '用于完善会员资料',
        success: resolve,
        fail: (err: { errMsg?: string }) =>
          reject(new Error(err.errMsg || loginT('profileFailed', '获取微信资料失败'))),
      } as Parameters<typeof Taro.getUserProfile>[0])
    }),
  getEnv: () => Taro.getEnv(),
}

/** 检测当前是否在微信小程序环境 */
export function isWechatMiniProgram(env: string = Taro.getEnv()): boolean {
  return env === Taro.ENV_TYPE.WEAPP || env === 'weapp'
}

/**
 * 执行真实微信登录。
 * 非 weapp 环境直接抛错(由调用方决定降级到手机号登录)。
 */
export async function wechatLogin(
  options: WechatLoginOptions = {},
  client: WechatClient = defaultWechatClient,
): Promise<WechatLoginResult> {
  if (!isWechatMiniProgram(client.getEnv())) {
    throw new Error(loginT('wechatEnvError', '请在微信小程序中使用微信登录'))
  }

  // 1. 拿临时 code
  const code = await client.login()
  if (!code) throw new Error(loginT('codeEmpty', '微信登录 code 为空'))

  // 2. (可选)拿用户加密资料
  let profile: UserProfileSuccessRes | undefined
  if (options.withProfile && client.getUserProfile) {
    try {
      profile = await client.getUserProfile()
    } catch {
      // 用户拒绝授权不阻断登录,后端会用默认信息
      profile = undefined
    }
  }

  // 3. 调后端换 token
  const result = await loginByWechat(code)
  const { accessToken, refreshToken, user } = result
  const profileNick = profile?.userInfo?.nickName
  const profileAvatar = profile?.userInfo?.avatarUrl

  // 4. 合并微信昵称/头像(若已授权)
  const finalUser: UserInfo = {
    ...user,
    nickname:
      user.nickname || profileNick || user.userName || loginT('defaultNickname', '微信用户'),
    avatar: user.avatar || profileAvatar,
  }

  // 5. 持久化(storage + store 双写)
  setToken(accessToken)
  setRefreshToken(refreshToken)
  setUserInfo(finalUser)
  try {
    useUserStore.getState().setAuth(accessToken, finalUser, refreshToken)
  } catch {
    // store 可能未在测试环境挂载,忽略
  }

  return {
    user: finalUser,
    isNewUser: Boolean((finalUser as { isNewUser?: boolean }).isNewUser),
  }
}
