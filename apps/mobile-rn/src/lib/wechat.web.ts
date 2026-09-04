// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:

// 平台特有:web stub。react-native-wechat-lib 是纯原生库,web 端 import 即崩
// (NativeModules.WeChat 为 undefined),此文件由 Metro 平台后缀解析在 web 端
// 自动替代 wechat.ts,native(Android/iOS)不受影响。

export const WECHAT_ERRCODE = {
  SUCCESS: 0,
  USER_CANCEL: -2,
  COMMON_ERROR: -1,
} as const

let isRegistered = false

/** web 端无微信 SDK,恒返回 false */
export async function registerWechat(): Promise<boolean> {
  isRegistered = false
  return false
}

/** web 端无微信 App,恒返回 false */
export async function isWechatInstalled(): Promise<boolean> {
  return false
}

/** web 端微信登录不可用,UI 层据此走兜底 */
export function isWechatAvailable(): boolean {
  return false
}

/** web 端不支持微信授权,恒抛错 */
export async function sendWechatAuth(_scope?: string, _state?: string): Promise<string> {
  throw new Error('微信原生 SDK 不支持 web 平台')
}

/** web 端 SDK 永未初始化 */
export function isWechatRegistered(): boolean {
  return isRegistered
}
