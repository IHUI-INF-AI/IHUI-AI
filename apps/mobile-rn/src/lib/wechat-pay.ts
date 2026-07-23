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
import * as WeChat from 'react-native-wechat-lib'
import type { WechatAppPaySignData } from '@ihui/api-client'

// 微信开放平台移动应用 AppID(从历史项目复用,application.yml wx.app.appid)
const APP_ID = 'wx85fa429a9331b5c8'
// iOS Universal Link(微信支付完成后回到 app,需在 apple-app-site-association 配置)
const UNIVERSAL_LINK = 'https://file.aizhs.top/'

let registered = false

/** 注册微信开放平台移动应用(应用启动时调用一次,lazy 自动注册) */
export async function registerWeChat(): Promise<void> {
  if (registered) return
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
