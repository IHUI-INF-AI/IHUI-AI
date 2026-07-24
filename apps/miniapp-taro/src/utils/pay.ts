import Taro from '@tarojs/taro'

export type PayPlatform = 'wechat' | 'alipay'

export interface WxPayParams {
  timeStamp?: string | number
  nonceStr?: string
  package?: string
  signType?: 'RSA' | 'MD5' | 'HMAC-SHA256'
  paySign?: string
  orderInfo?: string | Record<string, unknown>
  appid?: string
  appId?: string
  app_id?: string
  partnerid?: string
  partnerId?: string
  partner_id?: string
  prepayid?: string
  prepayId?: string
  prepay_id?: string
  noncestr?: string
  nonce_str?: string
  timestamp?: string | number
  sign?: string
}

export interface AliPayParams {
  orderInfo?: string
  orderStr?: string
  /** 支付宝交易号(后端 alipay.trade.create 返回,my.tradePay 优先用此字段) */
  tradeNO?: string
}

export type AnyPayParams = WxPayParams & AliPayParams

type Platform = 'mp-weixin' | 'mp-alipay' | 'app' | 'web' | 'unknown'

interface PayErrorLike {
  errMsg?: string
  code?: number
  message?: string
}

function getPlatform(): Platform {
  const env = Taro.getEnv()
  if (env === Taro.ENV_TYPE.WEAPP) return 'mp-weixin'
  if (env === Taro.ENV_TYPE.ALIPAY) return 'mp-alipay'
  if (env === Taro.ENV_TYPE.RN) return 'app'
  if (env === Taro.ENV_TYPE.WEB) return 'web'
  return 'unknown'
}

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
    partnerid: pick(p as unknown as Record<string, unknown>, ['partnerid', 'partnerId', 'partner_id']),
    prepayid: pick(p as unknown as Record<string, unknown>, ['prepayid', 'prepayId', 'prepay_id']),
    package: (p.package as string) ?? 'Sign=WXPay',
    noncestr: pick(p as unknown as Record<string, unknown>, ['noncestr', 'nonceStr', 'nonce_str']) ?? '',
    timestamp: String(
      pick(p as unknown as Record<string, unknown>, ['timestamp', 'timeStamp']) ?? Math.floor(Date.now() / 1000),
    ),
    sign: p.sign,
  }
  return JSON.stringify(obj)
}

function showWxPayError(err: PayErrorLike): void {
  if (isCancelError(err)) {
    Taro.showToast({ title: '您已取消支付', icon: 'none' })
    return
  }
  if (isWxNotInstalled(err)) {
    Taro.showModal({
      title: '提示',
      content: '未检测到微信应用,请先安装微信',
      showCancel: false,
      confirmText: '我知道了',
    })
    return
  }
  if (isParamError(err)) {
    Taro.showToast({ title: '支付参数错误,请重试', icon: 'none', duration: 2000 })
    return
  }
  Taro.showToast({ title: '支付失败,请重试', icon: 'none', duration: 2000 })
}

function showAliPayError(err: PayErrorLike): void {
  if (isCancelError(err)) {
    Taro.showToast({ title: '您已取消支付', icon: 'none' })
    return
  }
  if (isAliNotInstalled(err)) {
    Taro.showModal({
      title: '提示',
      content: '未检测到支付宝应用,请先安装支付宝',
      showCancel: false,
      confirmText: '我知道了',
    })
    return
  }
  const msg = err.errMsg || err.message || ''
  Taro.showToast({
    title: msg.length > 20 ? '支付失败,请重试' : msg || '支付失败',
    icon: 'none',
    duration: 2000,
  })
}

export function requestWxPayment(payParams: AnyPayParams): Promise<unknown> {
  const platform = getPlatform()
  Taro.showLoading({ title: '支付中...', mask: true })

  if (platform === 'mp-weixin') {
    const required = ['timeStamp', 'nonceStr', 'package', 'paySign'] as const
    const missing = required.filter((k) => !payParams[k])
    if (missing.length > 0) {
      Taro.hideLoading()
      Taro.showToast({ title: '支付参数不完整', icon: 'none' })
      return Promise.reject(new Error(`missing: ${missing.join(',')}`))
    }
    return new Promise((resolve, reject) => {
      Taro.requestPayment({
        timeStamp: String(payParams.timeStamp ?? ''),
        nonceStr: String(payParams.nonceStr ?? ''),
        package: String(payParams.package ?? ''),
        signType: (payParams.signType as 'RSA' | 'MD5') || 'RSA',
        paySign: String(payParams.paySign ?? ''),
        success: (res) => {
          Taro.hideLoading()
          resolve(res)
        },
        fail: (err) => {
          Taro.hideLoading()
          showWxPayError(err as PayErrorLike)
          reject(err)
        },
      })
    })
  }

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
  Taro.showToast({ title: '当前环境不支持微信支付', icon: 'none' })
  return Promise.reject(new Error(`unsupported platform: ${platform}`))
}

export function requestAliPayment(payParams: AnyPayParams): Promise<unknown> {
  const platform = getPlatform()
  Taro.showLoading({ title: '支付中...', mask: true })

  if (platform === 'mp-weixin') {
    Taro.hideLoading()
    Taro.showToast({ title: '微信小程序暂不支持支付宝支付', icon: 'none' })
    return Promise.reject(new Error('mp-weixin unsupported alipay'))
  }

  // 支付宝小程序支付:必须用 Taro.tradePay(对应 my.tradePay),而非 Taro.requestPayment
  // tradeNO 优先(后端 alipay.trade.create 返回),否则用 orderStr(完整订单串)
  const tradeNO = (payParams as { tradeNO?: string }).tradeNO
  const orderStr = payParams.orderInfo ?? payParams.orderStr ?? ''

  if (platform === 'mp-alipay') {
    if (!tradeNO && !orderStr) {
      Taro.hideLoading()
      Taro.showToast({ title: '支付宝订单信息缺失', icon: 'none' })
      return Promise.reject(new Error('missing alipay tradeNO/orderStr'))
    }
    const tradeOption: Record<string, unknown> = {}
    if (tradeNO) tradeOption.tradeNO = tradeNO
    else tradeOption.orderStr = orderStr

    return new Promise((resolve, reject) => {
      Taro.tradePay({
        ...tradeOption,
        success: (res: { resultCode?: number | string }) => {
          Taro.hideLoading()
          const code = String(res?.resultCode ?? '')
          // 9000=成功 8000=待确认 4000=失败 6001=取消 6002=网络异常
          if (code === '9000') {
            resolve(res)
          } else if (code === '6001') {
            Taro.showToast({ title: '您已取消支付', icon: 'none' })
            reject(new Error('cancel'))
          } else if (code === '8000') {
            Taro.showToast({ title: '支付结果待确认', icon: 'none', duration: 2000 })
            reject(new Error(`alipay pending: ${code}`))
          } else {
            Taro.showToast({ title: '支付失败,请重试', icon: 'none', duration: 2000 })
            reject(new Error(`alipay failed: ${code}`))
          }
        },
        fail: (err: PayErrorLike) => {
          Taro.hideLoading()
          showAliPayError(err)
          reject(err)
        },
      } as unknown as Parameters<typeof Taro.tradePay>[0])
    })
  }

  // App 端支付宝支付(保留原 orderInfo 模式)
  if (!orderStr) {
    Taro.hideLoading()
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
