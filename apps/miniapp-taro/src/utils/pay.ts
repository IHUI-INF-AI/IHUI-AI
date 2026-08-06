import Taro from '@tarojs/taro'
import { requestWeappPayment, requestAlipayPayment } from '../platform/pay'
import { getPlatform } from '../platform/auth'
import type { PayPlatform, AnyPayParams } from '@ihui/types'
import { t } from '@/i18n'
// 2026-07-28 Q-5: 跨端纯逻辑(错误分类 + 参数归一化 + App 端 orderInfo 构建)
// 下沉到 @ihui/shared/pay,消除本文件重复实现。
import {
  classifyPayError,
  isCancelError,
  isWxNotInstalled,
  isAliNotInstalled,
  isParamError,
  buildAppWxOrderInfo,
  type PayErrorLike,
} from '@ihui/shared/pay'

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

// 2026-07-28 Q-3: 删除本地 getPlatform 重复实现,复用 platform/auth.ts 的 getPlatform
// (已扩展为 RuntimePlatform,支持 weapp/alipay/app/web/unknown)。
// 注意:platform/auth.ts 用 'weapp'/'alipay',原本地实现用 'mp-weixin'/'mp-alipay',
// 已同步更新下方所有判断分支。

function showWxPayError(err: PayErrorLike): void {
  if (isCancelError(err)) {
    Taro.showToast({ title: t('pay.cancel'), icon: 'none' })
    return
  }
  if (isWxNotInstalled(err)) {
    Taro.showModal({
      title: t('common.hint'),
      content: t('pay.wxNotInstalled'),
      showCancel: false,
      confirmText: t('pay.gotIt'),
    })
    return
  }
  if (isParamError(err)) {
    Taro.showToast({ title: t('pay.paramError'), icon: 'none', duration: 2000 })
    return
  }
  Taro.showToast({ title: t('pay.failed'), icon: 'none', duration: 2000 })
}

function showAliPayError(err: PayErrorLike): void {
  if (isCancelError(err)) {
    Taro.showToast({ title: t('pay.cancel'), icon: 'none' })
    return
  }
  if (isAliNotInstalled(err)) {
    Taro.showModal({
      title: t('common.hint'),
      content: t('pay.aliNotInstalled'),
      showCancel: false,
      confirmText: t('pay.gotIt'),
    })
    return
  }
  const msg = err.errMsg || err.message || ''
  Taro.showToast({
    title: msg.length > 20 ? t('pay.failed') : msg || t('pay.failedShort'),
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
  Taro.showLoading({ title: t('pay.processing'), mask: true })
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
  Taro.showToast({ title: t('pay.wxUnsupportedEnv'), icon: 'none' })
  return Promise.reject(new Error(`unsupported platform: ${platform}`))
}

/**
 * 支付宝支付:alipay 委托 platform/pay.ts,App 端保留原 orderInfo 模式
 * 向后兼容:签名(requestAliPayment + AnyPayParams)不变,调用方无需修改
 */
export function requestAliPayment(payParams: AnyPayParams): Promise<unknown> {
  const platform = getPlatform()

  if (platform === 'weapp') {
    Taro.showToast({ title: t('pay.aliUnsupportedWeapp'), icon: 'none' })
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
  Taro.showLoading({ title: t('pay.processing'), mask: true })
  const orderStr =
    typeof payParams.orderInfo === 'string' ? payParams.orderInfo : (payParams.orderStr ?? '')
  if (!orderStr) {
    Taro.hideLoading()
    Taro.showToast({ title: t('pay.aliOrderMissing'), icon: 'none' })
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

//classifyPayError re-export(供调用方做错误类型判断,如 catch 块按 'cancel'/'wxNotInstalled' 分支)
export { classifyPayError }
