/**
 * 跨端支付参数类型(从 apps/miniapp-taro/src/utils/pay.ts 下沉)。
 *
 * 注意:AnyPayParams 是 WxPayParams & AliPayParams 的交集类型(非联合),
 * 兼容微信/支付宝双端字段共存场景。
 */

/** 支付平台标识 */
export type PayPlatform = 'wechat' | 'alipay'

/** 微信支付参数(兼容 weapp / App 端多字段命名) */
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

/** 支付宝支付参数 */
export interface AliPayParams {
  orderInfo?: string
  orderStr?: string
  /** 支付宝交易号(后端 alipay.trade.create 返回,my.tradePay 优先用此字段) */
  tradeNO?: string
}

/** 统一支付参数(微信 + 支付宝字段交集,按平台取所需字段) */
export type AnyPayParams = WxPayParams & AliPayParams
