// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// i18n-content-exempt-file: 多语言常量数据定义(label/title/description等选项值,内容体系定为中文单语,产品决策2026-11-15) until 2027-05-31

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
import {
  createWechatAppPayment,
  upgradeVip,
  type VipPayInfo,
  type WechatAppPaySignData,
} from '@ihui/api-client'
import type * as WeChatMod from 'react-native-wechat-lib'
import appJson from '../../app.json'

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

// 微信开放平台移动应用 AppID(取值链:构建期 env → app.json extra,见 wechat.ts 同名说明)
const APP_ID = process.env.EXPO_PUBLIC_WECHAT_APP_ID || appJson.expo.extra.WX_APP_APPID || ''
// iOS Universal Link(微信支付完成后回到 app,需在 apple-app-site-association 配置)
// 注意:此前此处默认值是 file.aizhs.top,与 app.json / app.config.js 登记的 aizhs.top 不一致
// —— 同一微信应用注册两个 Universal Link 会导致支付回调落空,统一以 app.json 为唯一源。
const UNIVERSAL_LINK =
  process.env.EXPO_PUBLIC_WECHAT_UNIVERSAL_LINK || appJson.expo.extra.WX_UNIVERSAL_LINK

let registered = false

/**
 * 当前是否跑在微信小程序宿主。
 *
 * 为什么不能只看 `Platform.OS`：小程序的 react-native 兼容层把 OS 固定成 ios，
 * 无法区分「真 iOS」和「微信宿主」；而微信宿主一定有全局 `wx.requestPayment`。
 * RN 端没有 `wx`，这条判据不会误伤 APP 支付。
 */
type MiniProgramWx = {
  requestPayment?: (input: {
    timeStamp: string
    nonceStr: string
    package: string
    signType: 'MD5' | 'HMAC-SHA256' | 'RSA'
    paySign: string
    success?: () => void
    fail?: (err: { errMsg?: string }) => void
  }) => void
}

function miniProgramWx(): MiniProgramWx | null {
  const wx = (globalThis as { wx?: MiniProgramWx }).wx
  return typeof wx?.requestPayment === 'function' ? wx : null
}

export function isMiniProgramHost(): boolean {
  return miniProgramWx() !== null
}

/** VIP 下单的统一返回面：RN 的 APP 支付和小程序的 JSAPI 共用。 */
export interface VipWechatPaymentOrder {
  outTradeNo: string
  amount?: number
  mock?: boolean
  prepayData?: WechatAppPaySignData
  payInfo?: VipPayInfo
}

export interface VipWechatPaymentResult {
  success: boolean
  data?: VipWechatPaymentOrder
  error?: string
}

/** 注册微信开放平台移动应用(应用启动时调用一次,lazy 自动注册) */
export async function registerWeChat(): Promise<void> {
  // 小程序宿主不需要开放平台 registerApp：支付走 wx.requestPayment，登录走宿主的 wx.login。
  if (isMiniProgramHost()) return
  if (registered) return
  if (!WeChat) throw new Error('WECHAT_NATIVE_UNAVAILABLE')
  if (!APP_ID) {
    throw new Error('微信 AppID 缺失:请检查 apps/mobile-rn/app.json 的 extra.WX_APP_APPID')
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
  // 小程序宿主本身就是微信，不存在“未安装微信”的中间态。
  if (isMiniProgramHost()) return true
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

/**
 * 创建 VIP 支付订单（宿主分流）：
 * - 微信小程序：POST /vip/order，paymentMethod=wechat_jsapi，返回 JSAPI 签名；
 * - RN APP：沿用原 createWechatAppPayment + react-native-wechat-lib 的 APP 支付。
 *
 * 注意：小程序端不要调用 /api/payments/wechat/android/create —— 那是 APP 支付签名，
 * wx.requestPayment 消费不了。
 */
export async function createVipWechatOrder(input: {
  levelId: string
  amount: number
  description: string
}): Promise<VipWechatPaymentResult> {
  if (isMiniProgramHost()) {
    const res = await upgradeVip(input.levelId, { paymentMethod: 'wechat_jsapi' })
    if (!res.success || !res.data) return { success: false, error: res.error }
    const { orderNo, amount, payInfo } = res.data
    return {
      success: true,
      data: { outTradeNo: orderNo, amount, mock: payInfo?.mock, payInfo },
    }
  }

  const res = await createWechatAppPayment({
    amount: input.amount,
    orderType: 1,
    description: input.description,
  })
  if (!res.success || !res.data) return { success: false, error: res.error }
  const data = res.data
  return {
    success: true,
    data: {
      outTradeNo: data.outTradeNo,
      amount: data.amount,
      mock: data.mock,
      prepayData: data.prepayData,
    },
  }
}

/**
 * 调起 VIP 支付（宿主分流）。
 * @returns true=支付成功，false=用户取消；其他错误抛出，由 VipScreen 统一提示。
 */
export async function openVipWechatPayment(data: VipWechatPaymentOrder): Promise<boolean> {
  if (isMiniProgramHost()) {
    const payInfo = data.payInfo
    if (!payInfo) throw new Error('WECHAT_NATIVE_UNAVAILABLE')
    if (payInfo.error) throw new Error(payInfo.error)
    if (payInfo.method !== 'jsapi') throw new Error('WECHAT_NATIVE_UNAVAILABLE')
    if (
      !payInfo.timeStamp ||
      !payInfo.nonceStr ||
      !payInfo.package ||
      !payInfo.signType ||
      !payInfo.paySign
    ) {
      throw new Error('WECHAT_NATIVE_UNAVAILABLE')
    }
    const wx = miniProgramWx()
    if (!wx) throw new Error('WECHAT_NATIVE_UNAVAILABLE')
    return new Promise<boolean>((resolve, reject) => {
      wx.requestPayment?.({
        timeStamp: payInfo.timeStamp as string,
        nonceStr: payInfo.nonceStr as string,
        package: payInfo.package as string,
        signType: payInfo.signType as 'MD5' | 'HMAC-SHA256' | 'RSA',
        paySign: payInfo.paySign as string,
        success: () => resolve(true),
        fail: (err) => {
          const message = err.errMsg ?? ''
          // 微信宿主的取消码是 requestPayment:fail cancel；取消不是错误，交给上层提示。
          if (message.includes('cancel')) resolve(false)
          else reject(new Error(message || 'WECHAT_PAY_FAILED'))
        },
      })
    })
  }

  if (!data.prepayData) throw new Error('WECHAT_NATIVE_UNAVAILABLE')
  return openWeChatPayment(data.prepayData)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
