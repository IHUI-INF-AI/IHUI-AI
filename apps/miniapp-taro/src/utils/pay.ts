import Taro from '@tarojs/taro'
import { requestWeappPayment, requestAlipayPayment } from '../platform/pay'
import { getPlatform } from '../platform/auth'
import type { PayPlatform, AnyPayParams } from '@ihui/types'

// 对外统一 API(从 platform/pay.ts re-export,消除双套实现)
export {
  requestPayment,
  requestWeappPayment,
  requestAlipayPayment,
  type WechatPayParams,
  type AlipayPayParams,
  type PayResult,
} from '../platform/pay'

// PayPlatform / WxPayParams / AliPayParams / AnyPayParams 已下沉到 @ihui/types
export type { PayPlatform, WxPayParams, AliPayParams, AnyPayParams } from '@ihui/types'

interface PayErrorLike {
  errMsg?: string
  code?: number
  message?: string
}

// 2026-07-28 Q-3: 删除本地 getPlatform 重复实现,复用 platform/auth.ts 的 getPlatform
// (已扩展为 RuntimePlatform,支持 weapp/alipay/app/web/unknown)。
// 注意:platform/auth.ts 用 'weapp'/'alipay',原本地实现用 'mp-weixin'/'mp-alipay',
// 已同步更新下方所有判断分支。

function isCancelError(err: PayErrorLike): boolean {
  const msg = err.errMsg || err.message || ''
  return msg.includes('cancel')
}

function isWxNotInstalled(err: PayErrorLike): boolean {
  if (err.code === -100) return true
  return (err.errMsg || '').includes('62000')
}

function isAliNotInstalled(err: PayErrorLike): boolean {
  if (err.code === -100) return true
  return (err.errMsg || '').includes('62009')
}

function isParamError(err: PayErrorLike): boolean {
  const msg = err.errMsg || err.message || ''
  return msg.includes('parameter') || msg.includes('参数')
}

function pick<T extends Record<string, unknown>>(obj: T, keys: string[]): unknown {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k]
  }
  return undefined
}

function buildAppWxOrderInfo(p: AnyPayParams): string {
  if (typeof p.orderInfo === 'string') return p.orderInfo
  if (p.orderInfo && typeof p.orderInfo === 'object') return JSON.stringify(p.orderInfo)
  const obj = {
    appid: pick(p as unknown as Record<string, unknown>, ['appid', 'appId', 'app_id']),
    partnerid: pick(p as unknown as Record<string, unknown>, [
      'partnerid',
      'partnerId',
      'partner_id',
    ]),
    prepayid: pick(p as unknown as Record<string, unknown>, ['prepayid', 'prepayId', 'prepay_id']),
    package: (p.package as string) ?? 'Sign=WXPay',
    noncestr:
      pick(p as unknown as Record<string, unknown>, ['noncestr', 'nonceStr', 'nonce_str']) ?? '',
    timestamp: String(
      pick(p as unknown as Record<string, unknown>, ['timestamp', 'timeStamp']) ??
        Math.floor(Date.now() / 1000),
    ),
    sign: p.sign,
  }
  return JSON.stringify(obj)
}

function showWxPayError(err: PayErrorLike): void {
  if (isCancelError(err)) {
    // TODO: i18n — Taro.showToast 硬编码中文待翻译(您已取消支付)
    Taro.showToast({ title: '您已取消支付', icon: 'none' })
    return
  }
  if (isWxNotInstalled(err)) {
    // TODO: i18n — Taro.showModal 硬编码中文待翻译(提示 / 未检测到微信应用,请先安装微信 / 我知道了)
    Taro.showModal({
      title: '提示',
      content: '未检测到微信应用,请先安装微信',
      showCancel: false,
      confirmText: '我知道了',
    })
    return
  }
  if (isParamError(err)) {
    // TODO: i18n — Taro.showToast 硬编码中文待翻译(支付参数错误,请重试)
    Taro.showToast({ title: '支付参数错误,请重试', icon: 'none', duration: 2000 })
    return
  }
  // TODO: i18n — Taro.showToast 硬编码中文待翻译(支付失败,请重试)
  Taro.showToast({ title: '支付失败,请重试', icon: 'none', duration: 2000 })
}

function showAliPayError(err: PayErrorLike): void {
  if (isCancelError(err)) {
    // TODO: i18n — Taro.showToast 硬编码中文待翻译(您已取消支付)
    Taro.showToast({ title: '您已取消支付', icon: 'none' })
    return
  }
  if (isAliNotInstalled(err)) {
    // TODO: i18n — Taro.showModal 硬编码中文待翻译(提示 / 未检测到支付宝应用,请先安装支付宝 / 我知道了)
    Taro.showModal({
      title: '提示',
      content: '未检测到支付宝应用,请先安装支付宝',
      showCancel: false,
      confirmText: '我知道了',
    })
    return
  }
  const msg = err.errMsg || err.message || ''
  // TODO: i18n — Taro.showToast 硬编码中文待翻译(支付失败,请重试 / 支付失败)
  Taro.showToast({
    title: msg.length > 20 ? '支付失败,请重试' : msg || '支付失败',
    icon: 'none',
    duration: 2000,
  })
}

/**
 * 微信支付:weapp 委托 platform/pay.ts,App 端保留原 orderInfo 模式
 * 向后兼容:签名(requestWxPayment + AnyPayParams)不变,调用方无需修改
 */
export function requestWxPayment(payParams: AnyPayParams): Promise<unknown> {
  const platform = getPlatform()

  // weapp: 委托 platform/pay.ts 实现(内部处理 loading + 错误提示)
  if (platform === 'weapp') {
    return requestWeappPayment({
      timeStamp: String(payParams.timeStamp ?? ''),
      nonceStr: String(payParams.nonceStr ?? ''),
      package: String(payParams.package ?? ''),
      signType: payParams.signType ?? 'RSA',
      paySign: String(payParams.paySign ?? ''),
    })
  }

  // App 端支付(保留原逻辑)
  // TODO: i18n — Taro.showLoading 硬编码中文待翻译(支付中...)
  Taro.showLoading({ title: '支付中...', mask: true })
  if (platform === 'app') {
    const orderInfo = buildAppWxOrderInfo(payParams)
    return new Promise((resolve, reject) => {
      Taro.requestPayment({
        provider: 'wxpay',
        orderInfo,
        success: (res: unknown) => {
          Taro.hideLoading()
          resolve(res)
        },
        fail: (err: PayErrorLike) => {
          Taro.hideLoading()
          showWxPayError(err)
          reject(err)
        },
      } as unknown as Parameters<typeof Taro.requestPayment>[0])
    })
  }

  Taro.hideLoading()
  // TODO: i18n — Taro.showToast 硬编码中文待翻译(当前环境不支持微信支付)
  Taro.showToast({ title: '当前环境不支持微信支付', icon: 'none' })
  return Promise.reject(new Error(`unsupported platform: ${platform}`))
}

/**
 * 支付宝支付:alipay 委托 platform/pay.ts,App 端保留原 orderInfo 模式
 * 向后兼容:签名(requestAliPayment + AnyPayParams)不变,调用方无需修改
 */
export function requestAliPayment(payParams: AnyPayParams): Promise<unknown> {
  const platform = getPlatform()

  if (platform === 'weapp') {
    // TODO: i18n — Taro.showToast 硬编码中文待翻译(微信小程序暂不支持支付宝支付)
    Taro.showToast({ title: '微信小程序暂不支持支付宝支付', icon: 'none' })
    return Promise.reject(new Error('weapp unsupported alipay'))
  }

  // alipay: 委托 platform/pay.ts 实现(内部处理 loading + 错误提示)
  if (platform === 'alipay') {
    const tradeNO = payParams.tradeNO
    const orderStr =
      typeof payParams.orderInfo === 'string' ? payParams.orderInfo : payParams.orderStr
    return requestAlipayPayment({ tradeNO, orderStr })
  }

  // App 端支付宝支付(保留原 orderInfo 模式)
  // TODO: i18n — Taro.showLoading 硬编码中文待翻译(支付中...)
  Taro.showLoading({ title: '支付中...', mask: true })
  const orderStr =
    typeof payParams.orderInfo === 'string' ? payParams.orderInfo : (payParams.orderStr ?? '')
  if (!orderStr) {
    Taro.hideLoading()
    // TODO: i18n — Taro.showToast 硬编码中文待翻译(支付宝订单信息缺失)
    Taro.showToast({ title: '支付宝订单信息缺失', icon: 'none' })
    return Promise.reject(new Error('missing alipay orderInfo'))
  }

  return new Promise((resolve, reject) => {
    Taro.requestPayment({
      provider: 'alipay',
      orderInfo: orderStr,
      success: (res: unknown) => {
        Taro.hideLoading()
        resolve(res)
      },
      fail: (err: PayErrorLike) => {
        Taro.hideLoading()
        showAliPayError(err)
        reject(err)
      },
    } as unknown as Parameters<typeof Taro.requestPayment>[0])
  })
}

export function unifiedPay(platform: PayPlatform, payParams: AnyPayParams): Promise<unknown> {
  if (platform === 'alipay') return requestAliPayment(payParams)
  return requestWxPayment(payParams)
}
