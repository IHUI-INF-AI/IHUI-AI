/**
 * 微信支付 V3 服务。
 * 密钥配置留空时降级为 mock 模式（DEV 环境）。
 * 生产环境填入 .env 真实密钥即激活真实网关调用。
 *
 * 密钥配置（.env）:
 * - WX_MINI_APPID / WX_APP_APPID: 小程序/APP appid
 * - WX_SHOP_ID: 商户号 mchid
 * - WX_PAY_V3_KEY: AES-256-GCM 解密密钥（32 字节）
 * - WX_PAY_CERT_SERIAL: 商户证书序列号
 * - WX_PAY_PRIVATE_KEY: 商户私钥 PEM（或 WX_PAY_PRIVATE_KEY_PATH 文件路径）
 * - WX_PAY_PLATFORM_CERT: 平台公钥 PEM（用于验签，或 WX_PAY_PLATFORM_CERT_PATH）
 * - WX_PAY_NOTIFY_URL / WX_PAY_COURSE_NOTIFY_URL / WX_ANDROID_NOTIFY_URL
 */

import crypto, { createSign, createVerify, randomBytes } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { env } from 'node:process'

const API_BASE = env.WX_API_BASE ?? 'https://api.mch.weixin.qq.com'

export function isWechatPayConfigured(): boolean {
  if (!env.WX_SHOP_ID || !env.WX_PAY_V3_KEY) return false
  if (env.WX_PAY_PRIVATE_KEY) return true
  if (env.WX_PAY_PRIVATE_KEY_PATH && existsSync(env.WX_PAY_PRIVATE_KEY_PATH)) return true
  return false
}

function getPrivateKey(): string {
  if (env.WX_PAY_PRIVATE_KEY) return env.WX_PAY_PRIVATE_KEY
  if (env.WX_PAY_PRIVATE_KEY_PATH && existsSync(env.WX_PAY_PRIVATE_KEY_PATH)) {
    return readFileSync(env.WX_PAY_PRIVATE_KEY_PATH, 'utf-8')
  }
  return ''
}

function getPlatformCert(): string {
  if (env.WX_PAY_PLATFORM_CERT) return env.WX_PAY_PLATFORM_CERT
  if (env.WX_PAY_PLATFORM_CERT_PATH) return readFileSync(env.WX_PAY_PLATFORM_CERT_PATH, 'utf-8')
  return ''
}

/** 构造 V3 Authorization 头（WECHATPAY2-SHA256-RSA2048） */
function buildAuthorization(method: string, url: string, body: string): string {
  const mchid = env.WX_SHOP_ID ?? ''
  const serial = env.WX_PAY_CERT_SERIAL ?? ''
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const nonce = randomBytes(16).toString('hex')
  const signStr = `${method}\n${url}\n${timestamp}\n${nonce}\n${body}\n`
  const sign = createSign('RSA-SHA256')
  sign.update(signStr, 'utf-8')
  const signature = sign.sign(getPrivateKey(), 'base64')
  return `WECHATPAY2-SHA256-RSA2048 mchid="${mchid}",nonce_str="${nonce}",timestamp="${timestamp}",serial_no="${serial}",signature="${signature}"`
}

/** 验证微信回调签名（Headers: timestamp/nonce/serial/signature + body） */
export function verifyCallbackSignature(
  timestamp: string,
  nonce: string,
  body: string,
  signature: string,
): boolean {
  const cert = getPlatformCert()
  if (!cert) {
    // DEV 环境无平台证书时跳过验签（生产必须配置）
    return env.NODE_ENV !== 'production'
  }
  const signStr = `${timestamp}\n${nonce}\n${body}\n`
  const verify = createVerify('RSA-SHA256')
  verify.update(signStr, 'utf-8')
  return verify.verify(cert, Buffer.from(signature, 'base64'))
}

/** AES-256-GCM 解密回调资源（resource.ciphertext） */
export function decryptCallback(
  ciphertext: string,
  nonce: string,
  associatedData: string,
): Record<string, unknown> {
  const key = Buffer.from(env.WX_PAY_V3_KEY ?? '', 'utf-8')
  const data = Buffer.from(ciphertext, 'base64')
  const authTag = data.subarray(-16)
  const ct = data.subarray(0, -16)
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(nonce, 'utf-8'))
  decipher.setAAD(Buffer.from(associatedData, 'utf-8'))
  decipher.setAuthTag(authTag)
  const plain = Buffer.concat([decipher.update(ct), decipher.final()])
  return JSON.parse(plain.toString('utf-8')) as Record<string, unknown>
}

/** JSAPI 预下单 */
export async function jsapiPrepay(params: {
  outTradeNo: string
  amount: number // 分
  description: string
  openId: string
  notifyUrl: string
}): Promise<string> {
  const appid = env.WX_MINI_APPID ?? ''
  const mchid = env.WX_SHOP_ID ?? ''
  const body = JSON.stringify({
    appid,
    mchid,
    description: params.description,
    out_trade_no: params.outTradeNo,
    notify_url: params.notifyUrl,
    amount: { total: params.amount, currency: 'CNY' },
    payer: { openid: params.openId },
  })
  const url = '/v3/pay/transactions/jsapi'
  const resp = await fetch(`${API_BASE}${url}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: buildAuthorization('POST', url, body),
    },
    body,
  })
  if (!resp.ok) throw new Error(`WechatPay jsapi failed: ${resp.status} ${await resp.text()}`)
  const data = (await resp.json()) as { prepay_id: string }
  return data.prepay_id
}

/** APP 预下单 */
export async function appPrepay(params: {
  outTradeNo: string
  amount: number
  description: string
  notifyUrl: string
}): Promise<Record<string, string>> {
  const appid = env.WX_APP_APPID ?? env.WX_MINI_APPID ?? ''
  const mchid = env.WX_SHOP_ID ?? ''
  const body = JSON.stringify({
    appid,
    mchid,
    description: params.description,
    out_trade_no: params.outTradeNo,
    notify_url: params.notifyUrl,
    amount: { total: params.amount, currency: 'CNY' },
  })
  const url = '/v3/pay/transactions/app'
  const resp = await fetch(`${API_BASE}${url}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: buildAuthorization('POST', url, body),
    },
    body,
  })
  if (!resp.ok) throw new Error(`WechatPay app failed: ${resp.status} ${await resp.text()}`)
  return (await resp.json()) as Record<string, string>
}

/** H5 预下单(返回 h5_url 跳转链接,移动端浏览器使用) */
export async function h5Prepay(params: {
  outTradeNo: string
  amount: number
  description: string
  notifyUrl: string
  payerClientIp: string
}): Promise<string> {
  const appid = env.WX_APP_APPID ?? env.WX_MINI_APPID ?? ''
  const mchid = env.WX_SHOP_ID ?? ''
  const body = JSON.stringify({
    appid,
    mchid,
    description: params.description,
    out_trade_no: params.outTradeNo,
    notify_url: params.notifyUrl,
    amount: { total: params.amount, currency: 'CNY' },
    scene_info: {
      payer_client_ip: params.payerClientIp,
      h5_info: { type: 'WAP' },
    },
  })
  const url = '/v3/pay/transactions/h5'
  const resp = await fetch(`${API_BASE}${url}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: buildAuthorization('POST', url, body),
    },
    body,
  })
  if (!resp.ok) throw new Error(`WechatPay h5 failed: ${resp.status} ${await resp.text()}`)
  const data = (await resp.json()) as { h5_url: string }
  return data.h5_url
}

/** Native 预下单(返回 code_url 用于生成二维码) */
export async function nativePrepay(params: {
  outTradeNo: string
  amount: number
  description: string
  notifyUrl: string
}): Promise<string> {
  const appid = env.WX_APP_APPID ?? env.WX_MINI_APPID ?? ''
  const mchid = env.WX_SHOP_ID ?? ''
  const body = JSON.stringify({
    appid,
    mchid,
    description: params.description,
    out_trade_no: params.outTradeNo,
    notify_url: params.notifyUrl,
    amount: { total: params.amount, currency: 'CNY' },
  })
  const url = '/v3/pay/transactions/native'
  const resp = await fetch(`${API_BASE}${url}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: buildAuthorization('POST', url, body),
    },
    body,
  })
  if (!resp.ok) throw new Error(`WechatPay native failed: ${resp.status} ${await resp.text()}`)
  const data = (await resp.json()) as { code_url: string }
  return data.code_url
}

/** 生成前端 JSAPI 调起签名（paySign） */
export function buildJsapiSign(prepayId: string): Record<string, string> {
  const appid = env.WX_MINI_APPID ?? ''
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const nonceStr = randomBytes(16).toString('hex')
  const pkg = `prepay_id=${prepayId}`
  const signStr = `${appid}\n${timestamp}\n${nonceStr}\n${pkg}\n`
  const sign = createSign('RSA-SHA256')
  sign.update(signStr, 'utf-8')
  const paySign = sign.sign(getPrivateKey(), 'base64')
  return { timestamp, nonceStr, package: pkg, signType: 'RSA', paySign }
}

/** 查询订单 */
export async function queryOrder(outTradeNo: string): Promise<Record<string, unknown>> {
  const mchid = env.WX_SHOP_ID ?? ''
  const url = `/v3/pay/transactions/out-trade-no/${outTradeNo}?mchid=${mchid}`
  const resp = await fetch(`${API_BASE}${url}`, {
    headers: { Authorization: buildAuthorization('GET', url, '') },
  })
  if (!resp.ok) throw new Error(`WechatPay query failed: ${resp.status}`)
  return (await resp.json()) as Record<string, unknown>
}

/** 关闭订单 */
export async function closeOrder(outTradeNo: string): Promise<void> {
  const mchid = env.WX_SHOP_ID ?? ''
  const body = JSON.stringify({ mchid })
  const url = `/v3/pay/transactions/out-trade-no/${outTradeNo}/close`
  const resp = await fetch(`${API_BASE}${url}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: buildAuthorization('POST', url, body),
    },
    body,
  })
  if (!resp.ok) throw new Error(`WechatPay close failed: ${resp.status}`)
}

/** 退款 */
export async function refund(params: {
  outTradeNo: string
  refundNo: string
  refundAmount: number
  totalAmount: number
  reason: string
  notifyUrl: string
}): Promise<Record<string, unknown>> {
  const body = JSON.stringify({
    out_trade_no: params.outTradeNo,
    out_refund_no: params.refundNo,
    reason: params.reason,
    amount: { refund: params.refundAmount, total: params.totalAmount, currency: 'CNY' },
    notify_url: params.notifyUrl,
  })
  const url = '/v3/refund/domestic/refunds'
  const resp = await fetch(`${API_BASE}${url}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: buildAuthorization('POST', url, body),
    },
    body,
  })
  if (!resp.ok) throw new Error(`WechatPay refund failed: ${resp.status} ${await resp.text()}`)
  return (await resp.json()) as Record<string, unknown>
}

/** 下载账单（对账用） */
export async function downloadBill(
  billDate: string,
  billType: 'ALL' | 'SUCCESS' | 'REFUND' = 'ALL',
): Promise<string> {
  const url = `/v3/bill/tradebill?bill_date=${billDate}&bill_type=${billType}`
  const resp = await fetch(`${API_BASE}${url}`, {
    headers: { Authorization: buildAuthorization('GET', url, '') },
  })
  if (!resp.ok) throw new Error(`WechatPay bill failed: ${resp.status}`)
  const data = (await resp.json()) as { download_url: string }
  const csvResp = await fetch(data.download_url)
  return csvResp.text()
}

/** 生成 out_trade_no */
export function generateOutTradeNo(prefix = 'WX'): string {
  const rand = randomBytes(4).toString('hex').toUpperCase()
  const ts = Date.now().toString()
  return `${prefix}${rand}${ts}`
}

// =============================================================================
// V3 周期扣款(连续包月)API — 签约 / 解约 / 查询 / 委托扣款
// =============================================================================

/** V3 请求内部辅助:统一 buildAuthorization + fetch,供周期扣款 4 函数复用 */
async function requestV3<T = unknown>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const bodyStr = body !== undefined ? JSON.stringify(body) : ''
  const resp = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: buildAuthorization(method, path, bodyStr),
    },
    ...(body !== undefined ? { body: bodyStr } : {}),
  })
  if (!resp.ok) {
    throw new Error(`WechatPay V3 ${method} ${path} failed: ${resp.status} ${await resp.text()}`)
  }
  const text = await resp.text()
  return (text ? JSON.parse(text) : ({} as T)) as T
}

function ensureRecurringConfigured(): void {
  if (!isWechatPayConfigured()) {
    throw new Error('微信支付周期扣款未配置:缺少 WX_SHOP_ID / WX_PAY_V3_KEY / WX_PAY_PRIVATE_KEY')
  }
}

/** 签约:申请签约方案(返回 signUrl 供前端跳转签约页面) */
export async function signContract(params: {
  planId: string
  outTradeNo: string
  notifyUrl: string
  userId: string
  openid?: string
  contractDisplay?: string
}): Promise<{ signUrl: string; contractId?: string }> {
  ensureRecurringConfigured()
  const body: Record<string, unknown> = {
    plan_id: params.planId,
    out_contract_code: params.outTradeNo,
    notification_url: params.notifyUrl,
  }
  if (params.openid) body.openid = params.openid
  if (params.contractDisplay) body.contract_display = params.contractDisplay
  // TODO: 生产前确认 sign-plan user-notifications 返回字段名,当前按微信支付 V3 文档实现
  const data = await requestV3<{ sign_url?: string; contract_id?: string }>(
    'POST',
    '/v3/payscore/sign-plan/user-notifications',
    body,
  )
  return {
    signUrl: data.sign_url ?? '',
    contractId: data.contract_id,
  }
}

/** 解约:终止签约 */
export async function cancelContract(params: {
  contractId: string
  reason?: string
}): Promise<{ cancelled: boolean }> {
  ensureRecurringConfigured()
  const body = params.reason ? { cancel_reason: params.reason } : undefined
  await requestV3(
    'DELETE',
    `/v3/payscore/sign-plan/contracts/${encodeURIComponent(params.contractId)}`,
    body,
  )
  return { cancelled: true }
}

/** 查询签约状态 */
export async function queryContract(contractId: string): Promise<{
  contractId: string
  status: 'active' | 'cancelled' | 'expired' | 'pending'
  planId: string
  signedAt?: string
  cancelledAt?: string
  nextChargeTime?: string
}> {
  ensureRecurringConfigured()
  // TODO: 生产前确认返回字段映射,当前按微信支付 V3 sign-plan 文档实现
  const data = await requestV3<Record<string, unknown>>(
    'GET',
    `/v3/payscore/sign-plan/contracts/${encodeURIComponent(contractId)}`,
  )
  return {
    contractId: (data.contract_id as string) ?? contractId,
    status: (data.status as 'active' | 'cancelled' | 'expired' | 'pending') ?? 'pending',
    planId: (data.plan_id as string) ?? '',
    signedAt: data.sign_time as string | undefined,
    cancelledAt: data.cancel_time as string | undefined,
    nextChargeTime: data.deduct_time as string | undefined,
  }
}

/** 委托扣款:触发一次扣款(系统定时调用) */
export async function deductRecurring(params: {
  contractId: string
  outTradeNo: string
  amount: number
  description: string
  notifyUrl: string
}): Promise<{ deductId: string; status: 'pending' | 'success' | 'failed' }> {
  ensureRecurringConfigured()
  const body = {
    out_trade_no: params.outTradeNo,
    amount: { total: params.amount, currency: 'CNY' },
    description: params.description,
    notify_url: params.notifyUrl,
  }
  // TODO: 生产前确认委托扣款 API 路径,当前按微信支付 V3 sign-plan 文档实现
  const data = await requestV3<{
    deduct_id?: string
    transaction_id?: string
    trade_state?: string
  }>(
    'POST',
    `/v3/payscore/sign-plan/contracts/${encodeURIComponent(params.contractId)}/deduct`,
    body,
  )
  const status: 'pending' | 'success' | 'failed' =
    data.trade_state === 'SUCCESS'
      ? 'success'
      : data.trade_state === 'FAILED'
        ? 'failed'
        : 'pending'
  return {
    deductId: data.deduct_id ?? data.transaction_id ?? params.outTradeNo,
    status,
  }
}
