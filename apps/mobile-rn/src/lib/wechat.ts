/**
 * 微信 SDK 封装(react-native-wechat-lib)
 *
 * 平台支持:
 * - Android/iOS native:完整支持(registerApp + sendAuthRequest + 拉起微信 App 授权)
 * - web:不支持(NativeModules.WeChat = undefined),所有函数返回 false/throw
 *
 * 初始化:App.tsx 启动时调用 registerWechat()
 * 授权流程:handleThirdPartyLogin('wechat') → sendWechatAuth() → code → loginByWechat(code) → JWT
 */

import { Platform } from 'react-native'
import * as wechatLib from 'react-native-wechat-lib'

const WECHAT_APP_ID = process.env.EXPO_PUBLIC_WECHAT_APP_ID
const WECHAT_UNIVERSAL_LINK = process.env.EXPO_PUBLIC_WECHAT_UNIVERSAL_LINK

let isRegistered = false

/** 初始化微信 SDK(App.tsx 启动时调用,native only) */
export async function registerWechat(): Promise<boolean> {
  if (Platform.OS === 'web') return false
  if (typeof wechatLib.registerApp !== 'function') return false
  if (!WECHAT_APP_ID) return false

  try {
    const result = await wechatLib.registerApp(WECHAT_APP_ID, WECHAT_UNIVERSAL_LINK)
    isRegistered = result
    return result
  } catch {
    return false
  }
}

/** 检查是否安装微信(native only) */
export async function isWechatInstalled(): Promise<boolean> {
  if (Platform.OS === 'web') return false
  if (typeof wechatLib.isWXAppInstalled !== 'function') return false
  try {
    return await wechatLib.isWXAppInstalled()
  } catch {
    return false
  }
}

/** 发送微信授权请求,返回 code(native only) */
export async function sendWechatAuth(
  scope = 'snsapi_userinfo',
  state?: string,
): Promise<string> {
  if (Platform.OS === 'web') throw new Error('微信原生 SDK 不支持 web 平台')
  if (typeof wechatLib.sendAuthRequest !== 'function') throw new Error('微信 SDK 未初始化')

  const res = await wechatLib.sendAuthRequest(scope, state)
  if (res.errCode && res.errCode !== 0) {
    throw new Error(res.errStr ?? `微信授权失败(errCode=${res.errCode})`)
  }
  if (!res.code) throw new Error('微信授权未返回 code')
  return res.code
}

/** 微信 SDK 是否已初始化 */
export function isWechatRegistered(): boolean {
  return isRegistered
}
