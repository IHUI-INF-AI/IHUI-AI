/**
 * 跨端支付参数归一化(纯逻辑,零平台依赖)
 *
 * 后端可能返回 snake_case / camelCase / lowercase 多种字段命名
 * (appid / appId / app_id / partnerid / partnerId / partner_id …),
 * 本模块统一归一化为 lowercase 字段,供 App 端微信 orderInfo 构建等场景消费。
 */
import type { AliPayParams, AnyPayParams, WxPayParams } from '@ihui/types'

/**
 * 从原始对象中按多命名约定选取首个非空值。
 * 返回 undefined 表示所有候选键均未提供有效值。
 */
function pickFirst<T = unknown>(obj: Record<string, unknown>, keys: string[]): T | undefined {
  for (const k of keys) {
    const v = obj[k]
    if (v !== undefined && v !== null && v !== '') return v as T
  }
  return undefined
}

/**
 * 归一化微信支付参数:统一将多命名变体收敛为 lowercase 字段。
 * 用于 App 端 orderInfo 构建(react-native-wechat-lib / Taro.requestPayment 需要)。
 */
export function normalizeWxPayParams(raw: Record<string, unknown>): WxPayParams {
  return {
    appid: pickFirst<string>(raw, ['appid', 'appId', 'app_id']),
    partnerid: pickFirst<string>(raw, ['partnerid', 'partnerId', 'partner_id']),
    prepayid: pickFirst<string>(raw, ['prepayid', 'prepayId', 'prepay_id']),
    package: (raw.package as string) ?? 'Sign=WXPay',
    noncestr: pickFirst<string>(raw, ['noncestr', 'nonceStr', 'nonce_str']) ?? '',
    timestamp: String(pickFirst(raw, ['timestamp', 'timeStamp']) ?? Math.floor(Date.now() / 1000)),
    sign: raw.sign as string,
  }
}

/**
 * 归一化支付宝支付参数:统一取 tradeNO / orderStr / orderInfo。
 * orderInfo 优先级:显式 orderStr > string 类型 orderInfo。
 */
export function normalizeAliPayParams(raw: Record<string, unknown>): AliPayParams {
  const orderInfoStr = typeof raw.orderInfo === 'string' ? raw.orderInfo : undefined
  return {
    tradeNO: raw.tradeNO as string | undefined,
    orderStr: (raw.orderStr as string) ?? orderInfoStr,
    orderInfo: raw.orderInfo as string | undefined,
  }
}

/**
 * 构建 App 端微信支付的 orderInfo JSON 字符串。
 *
 * 行为(与原 miniapp-taro utils/pay.ts 一致):
 * 1. 若 payParams.orderInfo 已是 string,直接返回;
 * 2. 若 orderInfo 是对象,JSON.stringify 返回;
 * 3. 否则按 normalizeWxPayParams 归一化后 stringify。
 */
export function buildAppWxOrderInfo(p: AnyPayParams): string {
  if (typeof p.orderInfo === 'string') return p.orderInfo
  if (p.orderInfo && typeof p.orderInfo === 'object') return JSON.stringify(p.orderInfo)
  return JSON.stringify(normalizeWxPayParams(p as unknown as Record<string, unknown>))
}
