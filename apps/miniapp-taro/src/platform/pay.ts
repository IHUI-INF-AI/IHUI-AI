/**
 * 跨端支付抽象层
 * 统一封装微信小程序(requestPayment)与支付宝小程序(tradePay)的支付 API 差异
 *
 * 关键差异:支付宝小程序不支持 Taro.requestPayment,必须用 Taro.tradePay(对应 my.tradePay)
 */
import Taro from '@tarojs/taro'
import { getPlatform, type MiniProgramPlatform } from './auth'
import { isAlipaySuccess, isAlipayCancel, isAlipayPending } from '@ihui/shared/constants'
import { type PayErrorLike, isCancelError } from '@ihui/shared/pay'

export interface WechatPayParams {
  timeStamp: string
  nonceStr: string
  package: string
  signType: 'RSA' | 'MD5' | 'HMAC-SHA256'
  paySign: string
}

export interface AlipayPayParams {
  /** 支付宝交易号(后端 alipay.trade.create 返回) */
  tradeNO?: string
  /** 完整订单字符串(后端 alipay.trade.app.pay 返回) */
  orderStr?: string
}

export type PayResult = {
  platform: MiniProgramPlatform
  /** 支付宝返回的 resultCode:9000=成功 8000=待确认 4000=失败 6001=取消 6002=网络异常 */
  resultCode?: string
}

/** 发起支付:自动判断平台 */
export function requestPayment(params: WechatPayParams | AlipayPayParams): Promise<PayResult> {
  const platform = getPlatform()
  if (platform === 'weapp') return requestWeappPayment(params as WechatPayParams)
  if (platform === 'alipay') return requestAlipayPayment(params as AlipayPayParams)
  // TODO: i18n — Taro.showToast 硬编码中文待翻译(当前环境不支持支付)
  Taro.showToast({ title: '当前环境不支持支付', icon: 'none' })
  return Promise.reject(new Error('当前环境不支持支付'))
}

/** 微信支付:Taro.requestPayment */
export async function requestWeappPayment(params: WechatPayParams): Promise<PayResult> {
  // TODO: i18n — Taro.showLoading 硬编码中文待翻译(支付中...)
  Taro.showLoading({ title: '支付中...', mask: true })
  try {
    await Taro.requestPayment({
      timeStamp: params.timeStamp,
      nonceStr: params.nonceStr,
      package: params.package,
      signType: params.signType,
      paySign: params.paySign,
    })
    Taro.hideLoading()
    return { platform: 'weapp' }
  } catch (err) {
    Taro.hideLoading()
    const e = err as PayErrorLike
    const msg = e.errMsg || ''
    if (isCancelError(e)) {
      // TODO: i18n — Taro.showToast 硬编码中文待翻译(您已取消支付)
      Taro.showToast({ title: '您已取消支付', icon: 'none' })
      throw 'cancel'
    }
    // TODO: i18n — Taro.showToast 硬编码中文待翻译(支付失败,请重试)
    Taro.showToast({ title: '支付失败,请重试', icon: 'none' })
    throw new Error(msg || '微信支付失败')
  }
}

/** 支付宝支付:Taro.tradePay(对应 my.tradePay,支付宝不支持 requestPayment) */
export async function requestAlipayPayment(params: AlipayPayParams): Promise<PayResult> {
  const tradeNO = params.tradeNO
  const orderStr = params.orderStr
  if (!tradeNO && !orderStr) {
    // TODO: i18n — Taro.showToast 硬编码中文待翻译(支付宝订单信息缺失)
    Taro.showToast({ title: '支付宝订单信息缺失', icon: 'none' })
    throw new Error('支付宝订单信息缺失')
  }
  // 优先用 tradeNO,否则用 orderStr
  const option = tradeNO ? { tradeNO } : { orderStr: orderStr as string }
  // TODO: i18n — Taro.showLoading 硬编码中文待翻译(支付中...)
  Taro.showLoading({ title: '支付中...', mask: true })
  try {
    const res = await Taro.tradePay(option)
    Taro.hideLoading()
    const resultCode = String(res.response.resultCode)
    if (isAlipaySuccess(resultCode)) return { platform: 'alipay', resultCode }
    if (isAlipayCancel(resultCode)) {
      // TODO: i18n — Taro.showToast 硬编码中文待翻译(您已取消支付)
      Taro.showToast({ title: '您已取消支付', icon: 'none' })
      throw 'cancel'
    }
    if (isAlipayPending(resultCode)) {
      // TODO: i18n — Taro.showToast 硬编码中文待翻译(支付结果待确认)
      Taro.showToast({ title: '支付结果待确认', icon: 'none', duration: 2000 })
      throw new Error(`支付宝支付待确认(${resultCode})`)
    }
    // TODO: i18n — Taro.showToast 硬编码中文待翻译(支付失败,请重试)
    Taro.showToast({ title: '支付失败,请重试', icon: 'none' })
    throw new Error(`支付宝支付失败(${resultCode})`)
  } catch (err) {
    // 业务层已处理(throw 'cancel' / Error),透传;系统错误补充提示
    if (err === 'cancel' || err instanceof Error) throw err
    Taro.hideLoading()
    // TODO: i18n — Taro.showToast 硬编码中文待翻译(支付失败,请重试)
    Taro.showToast({ title: '支付失败,请重试', icon: 'none' })
    throw new Error('支付宝支付失败')
  }
}
