/**
 * 微信 SDK 封装(react-native-wechat-lib)
 *
 * 平台特有:依赖 RN NativeModules.WeChat 原生模块,不适合共享。
 *
 * 平台支持:
 * - Android/iOS native:完整支持(registerApp + sendAuthRequest + 拉起微信 App 授权)
 * - web:不支持(NativeModules.WeChat = undefined),所有函数返回 false/throw
 *
 * 初始化:App.tsx 启动时调用 registerWechat()。
 *   注册失败时后续 isWechatAvailable() 返回 false,handleThirdPartyLogin 走 Alert 兜底。
 *
 * 授权流程:handleThirdPartyLogin('wechat')
 *   → isWechatInstalled() → sendWechatAuth() → code → loginByWechat(code) → JWT
 */

import { Platform } from 'react-native'
import * as wechatLib from 'react-native-wechat-lib'
import type { AuthResponse } from 'react-native-wechat-lib'

const WECHAT_APP_ID = process.env.EXPO_PUBLIC_WECHAT_APP_ID
const WECHAT_UNIVERSAL_LINK = process.env.EXPO_PUBLIC_WECHAT_UNIVERSAL_LINK

// 微信 SDK 错误码常量(对齐微信开放平台文档)
// -2: 用户取消授权(非错误,handleThirdPartyLogin 应静默处理,不弹错误提示)
// -1: 普通错误(微信 App 通用错误,可能由网络/微信版本不兼容引起)
// 0: 成功
export const WECHAT_ERRCODE = {
  SUCCESS: 0,
  USER_CANCEL: -2,
  COMMON_ERROR: -1,
} as const

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

/**
 * 微信登录能力是否可用(同步检查,供 UI 层快速判断是否走兜底)。
 * 判定条件:① native 平台;② 已配置 EXPO_PUBLIC_WECHAT_APP_ID;③ SDK 已 registerApp 成功。
 * 注意:此函数只检查 SDK 是否就绪,不检查用户是否安装微信 App(用 isWechatInstalled 异步检查)。
 */
export function isWechatAvailable(): boolean {
  if (Platform.OS === 'web') return false
  if (!WECHAT_APP_ID) return false
  return isRegistered
}

/** 发送微信授权请求,返回 code(native only)。
 *  抛出错误时 message 含 errCode,errCode=USER_CANCEL(-2) 表示用户取消(非错误)。 */
export async function sendWechatAuth(
  scope = 'snsapi_userinfo',
  state?: string,
): Promise<string> {
  if (Platform.OS === 'web') throw new Error('微信原生 SDK 不支持 web 平台')
  if (typeof wechatLib.sendAuthRequest !== 'function') throw new Error('微信 SDK 未初始化')

  const res: AuthResponse = await wechatLib.sendAuthRequest(scope, state)
  if (res.errCode !== undefined && res.errCode !== WECHAT_ERRCODE.SUCCESS) {
    throw new Error(res.errStr ?? `微信授权失败(errCode=${res.errCode})`)
  }
  if (!res.code) throw new Error('微信授权未返回 code')
  return res.code
}

/** 微信 SDK 是否已初始化 */
export function isWechatRegistered(): boolean {
  return isRegistered
}
