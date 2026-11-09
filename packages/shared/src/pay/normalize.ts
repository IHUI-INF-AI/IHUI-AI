// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 跨端支付参数归一化(纯逻辑,零平台依赖)
 *
 * 后端可能返回 snake_case / camelCase / lowercase 多种字段命名
 * (appid / appId / app_id / partnerid / partnerId / partner_id …),
 * 本模块统一归一化为 lowercase 字段,供 App 端微信 orderInfo 构建等场景消费。
 */
import type { AliPayParams, AnyPayParams, WxPayParams } from '@ihui/types'

/**
 * 服务端下发的支付凭据只接受「标量」:字符串 / 有限数字 / 布尔。
 * 数组、对象、函数一律按缺失处理(2026-11-08,同型根因自查 shared 信任类)。
 *
 * 为什么不能直接 `as string`:后端在某些序列化路径上会把数组/数值派成对象或数组
 * (见 findings-api 的跨端形状类问题),`as` 会让 `[object Object]`、数组原样进入
 * 支付 SDK 的签名参数 —— 失败方式从「明确缺字段」退化成「拿一个看起来有值的垃圾去签名」。
 */
function toCredentialString(value: unknown): string | undefined {
  if (typeof value === 'string') return value === '' ? undefined : value
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : undefined
  if (typeof value === 'boolean') return String(value)
  return undefined
}

/**
 * 从原始对象中按多命名约定选取首个「标量」值,并统一成字符串。
 * 返回 undefined 表示所有候选键均未提供可用凭据。
 */
function pickCredential(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const value = toCredentialString(obj[k])
    if (value !== undefined) return value
  }
  return undefined
}

/**
 * 归一化微信支付参数:统一将多命名变体收敛为 lowercase 字段。
 * 用于 App 端 orderInfo 构建(react-native-wechat-lib / Taro.requestPayment 需要)。
 */
export function normalizeWxPayParams(raw: Record<string, unknown>): WxPayParams {
  return {
    appid: pickCredential(raw, ['appid', 'appId', 'app_id']),
    partnerid: pickCredential(raw, ['partnerid', 'partnerId', 'partner_id']),
    prepayid: pickCredential(raw, ['prepayid', 'prepayId', 'prepay_id']),
    package: toCredentialString(raw.package) ?? 'Sign=WXPay',
    noncestr: pickCredential(raw, ['noncestr', 'nonceStr', 'nonce_str']) ?? '',
    timestamp:
      pickCredential(raw, ['timestamp', 'timeStamp']) ?? String(Math.floor(Date.now() / 1000)),
    sign: toCredentialString(raw.sign),
  }
}

/**
 * 归一化支付宝支付参数:统一取 tradeNO / orderStr / orderInfo。
 * orderInfo 优先级:显式 orderStr > string 类型 orderInfo。
 */
export function normalizeAliPayParams(raw: Record<string, unknown>): AliPayParams {
  const orderInfoStr = toCredentialString(raw.orderInfo)
  return {
    tradeNO: toCredentialString(raw.tradeNO),
    orderStr: toCredentialString(raw.orderStr) ?? orderInfoStr,
    orderInfo: orderInfoStr,
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
