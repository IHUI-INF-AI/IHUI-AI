/**
 * 微信支付封装(mobile-rn 端)。
 * 基于 react-native-wechat-lib,提供 registerApp + 调起 APP 支付能力。
 *
 * ⚠️ 需要 EAS Build 或 bare workflow(Expo Go 不支持原生模块)。
 * DEV/测试环境(无原生模块)调用会抛错,UI 层应 catch 并提示。
 *
 * 字段映射:后端返回 lowercase(appid/partnerid/prepayid/noncestr/timestamp),
 * react-native-wechat-lib 接受 camelCase(appId/partnerId/prepayId/nonceStr/timeStamp)。
 */
import type { WechatAppPaySignData } from '@ihui/api-client'
import type * as WeChatMod from 'react-native-wechat-lib'

// 动态 require + try-catch:react-native-wechat-lib 入口顶层执行
// `wrapRegisterApp(WeChat.registerApp)`,Expo Go 中 NativeModules.WeChat 为 undefined,
// 顶层访问即抛 TypeError,导致整个 bundle 红屏。用 try-catch 降级为 null,运行时再判断。
let WeChat: typeof WeChatMod | null = null
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  WeChat = require('react-native-wechat-lib')
} catch (e) {
  console.warn('[wechat-pay] react-native-wechat-lib 不可用(Expo Go,需 EAS Build):', e)
}

// 微信开放平台移动应用 AppID(从历史项目复用,application.yml wx.app.appid)
const APP_ID = process.env.EXPO_PUBLIC_WECHAT_APP_ID || ''
// iOS Universal Link(微信支付完成后回到 app,需在 apple-app-site-association 配置)
const UNIVERSAL_LINK = process.env.EXPO_PUBLIC_WECHAT_UNIVERSAL_LINK || 'https://file.aizhs.top/'

let registered = false

/** 注册微信开放平台移动应用(应用启动时调用一次,lazy 自动注册) */
export async function registerWeChat(): Promise<void> {
  if (registered) return
  if (!WeChat) throw new Error('WECHAT_NATIVE_UNAVAILABLE')
  if (!APP_ID) {
    throw new Error('EXPO_PUBLIC_WECHAT_APP_ID 未配置,请在 apps/mobile-rn/.env 设置')
  }
  try {
    await WeChat.registerApp(APP_ID, UNIVERSAL_LINK)
    registered = true
  } catch (e) {
    // Expo Go 中原生模块不可用,EAS Build 后正常
    console.warn('[wechat-pay] registerApp failed (need EAS Build):', e)
    throw new Error('WECHAT_NATIVE_UNAVAILABLE')
  }
}

/** 检查微信客户端是否已安装 */
export async function isWeChatInstalled(): Promise<boolean> {
  if (!WeChat) return false
  try {
    return await WeChat.isWXAppInstalled()
  } catch {
    return false
  }
}

/**
 * 调起微信 APP 支付。
 * @param prepayData 后端 createWechatAppPayment 返回的签名参数
 * @returns true=支付成功,false=用户取消
 * @throws 微信未安装 / 原生模块不可用 / 调起失败
 */
export async function openWeChatPayment(prepayData: WechatAppPaySignData): Promise<boolean> {
  if (!prepayData) throw new Error('prepayData is required')
  await registerWeChat()
  const installed = await isWeChatInstalled()
  if (!installed) throw new Error('WECHAT_NOT_INSTALLED')
  if (!WeChat) throw new Error('WECHAT_NATIVE_UNAVAILABLE')
  const res = await WeChat.pay({
    partnerId: prepayData.partnerid,
    prepayId: prepayData.prepayid,
    nonceStr: prepayData.noncestr,
    timeStamp: prepayData.timestamp,
    package: prepayData.package,
    sign: prepayData.sign,
  })
  // react-native-wechat-lib pay() 返回 { errCode, errStr }
  // errCode: 0=成功, -1=错误, -2=用户取消
  return res.errCode === 0
}
