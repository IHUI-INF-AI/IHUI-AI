// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 跨端登录与用户资料抽象层
 * 统一封装微信小程序(weapp)与支付宝小程序(alipay)的登录 API 差异
 */
import { t } from '@/i18n'
import Taro from '@tarojs/taro'

export type MiniProgramPlatform = 'weapp' | 'alipay'
// 2026-07-28 Q-3: 扩展 getPlatform 返回类型,覆盖 app/web 环境,
// 供 utils/pay.ts 等需要区分多端的模块复用(消除本地 getPlatform 重复实现)。
export type RuntimePlatform = 'weapp' | 'alipay' | 'app' | 'web' | 'unknown'

export interface MiniProgramLoginResult {
  /** 微信 code 或支付宝 authCode */
  code: string
  /** 平台标识 */
  platform: MiniProgramPlatform
}

export interface MiniProgramUserProfile {
  nickName?: string
  avatarUrl?: string
}

/** 支付宝 getAuthCode 的 Taro 代理句柄(Taro 类型未声明,运行时由 alipay 插件代理 my.getAuthCode) */
type AlipayAuthTaro = {
  getAuthCode(option: { scopes: string[] }): Promise<{ authCode: string; errMsg?: string }>
}

/** 获取当前平台(2026-07-28 Q-3: 扩展支持 app/web,供 utils/pay.ts 复用) */
export function getPlatform(): RuntimePlatform {
  const env = Taro.getEnv()
  if (env === Taro.ENV_TYPE.WEAPP) return 'weapp'
  if (env === Taro.ENV_TYPE.ALIPAY) return 'alipay'
  if (env === Taro.ENV_TYPE.RN) return 'app'
  if (env === Taro.ENV_TYPE.WEB) return 'web'
  return 'unknown'
}

/** 是否在微信小程序环境 */
export function isWeapp(): boolean {
  return getPlatform() === 'weapp'
}

/** 是否在支付宝小程序环境 */
export function isAlipay(): boolean {
  return getPlatform() === 'alipay'
}

/** 跨端登录:微信用 Taro.login,支付宝用 Taro.getAuthCode (my.getAuthCode) */
export async function login(): Promise<MiniProgramLoginResult> {
  const platform = getPlatform()
  if (platform === 'weapp') {
    const res = await Taro.login()
    if (!res.code) throw new Error(t('platformAuth.q1'))
    return { code: res.code, platform: 'weapp' }
  }
  if (platform === 'alipay') {
    const res = await (Taro as unknown as AlipayAuthTaro).getAuthCode({ scopes: ['auth_base'] })
    if (!res.authCode) throw new Error(t('platformAuth.q2'))
    return { code: res.authCode, platform: 'alipay' }
  }
  throw new Error(t('platformAuth.q3'))
}

/** 跨端获取用户资料:微信用 Taro.getUserProfile,支付宝用 Taro.getOpenUserInfo */
export async function getUserProfile(): Promise<MiniProgramUserProfile> {
  const platform = getPlatform()
  if (platform === 'weapp') {
    const res = await Taro.getUserProfile({ desc: t('platformAuth.q4') })
    return {
      nickName: res.userInfo.nickName,
      avatarUrl: res.userInfo.avatarUrl,
    }
  }
  if (platform === 'alipay') {
    const res = await Taro.getOpenUserInfo({})
    // 支付宝返回 response 为 JSON 字符串,使用 JSON.parse(res.response).response 解析
    const info = JSON.parse(res.response)?.response
    return {
      nickName: info?.nickName,
      avatarUrl: info?.avatar,
    }
  }
  throw new Error(t('platformAuth.q5'))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
