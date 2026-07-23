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

// 2026-07-22 P0 Round 3 鲁棒性加固:所有微信支付 fetch 调用统一 10s 超时
// 防止网络挂起导致请求堆积(支付场景对超时敏感,10s 足够覆盖正常网络延迟)
const WX_PAY_FETCH_TIMEOUT_MS = 10_000

export function isWechatPayConfigured(): boolean {
  if (!env.WX_SHOP_ID || !env.WX_PAY_V3_KEY) return false
  if (env.WX_PAY_PRIVATE_KEY) return true
  if (env.WX_PAY_PRIVATE_KEY_PATH && existsSync(env.WX_PAY_PRIVATE_KEY_PATH)) return true
  return false
}

/**
 * 平台证书是否已配置(用于验签微信支付回调)。
 * 生产环境必须返回 true,否则所有支付回调验签失败,
 * verifyCallbackSignature 在无证书时返回 false,导致订单永远无法标记为 paid。
 *
 * 优先级:环境变量 PEM 内容 > 文件路径。
 */
export function isPlatformCertConfigured(): boolean {
  if (env.WX_PAY_PLATFORM_CERT && env.WX_PAY_PLATFORM_CERT.trim().length > 0) return true
  if (env.WX_PAY_PLATFORM_CERT_PATH && existsSync(env.WX_PAY_PLATFORM_CERT_PATH)) return true
  return false
}

/**
 * 微信支付回调验签是否就绪。
 * DEV 环境无证书允许降级(返回 true),生产环境必须配置平台证书才能验签。
 */
export function isCallbackSignatureVerificationReady(): boolean {
  if (isPlatformCertConfigured()) return true
  // DEV/test 环境允许无证书(verifyCallbackSignature 会跳过验签)
  return env.NODE_ENV !== 'production'
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
    signal: AbortSignal.timeout(WX_PAY_FETCH_TIMEOUT_MS),
  })
  if (!resp.ok) throw new Error(`WechatPay jsapi failed: ${resp.status} ${await resp.text()}`)
  const data = (await resp.json()) as { prepay_id: string }
  return data.prepay_id
}

/** APP 支付签名参数(传给 react-native-wechat-lib 等 RN SDK 直接调起) */
export interface AppPaySignData {
  appid: string
  partnerid: string
  prepayid: string
  package: string
  noncestr: string
  timestamp: string
  sign: string
}

/**
 * APP 支付二次签名。
 * 签名串格式(微信 V3 APP 支付): appid\ntimestamp\nnoncestr\nprepayid\n
 * 返回 RN SDK 调起支付所需的完整参数(react-native-wechat-lib openWXAppPayment)。
 */
export function buildAppSign(prepayId: string): AppPaySignData {
  const appid = env.WX_APP_APPID ?? env.WX_MINI_APPID ?? ''
  const partnerid = env.WX_SHOP_ID ?? ''
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const noncestr = randomBytes(16).toString('hex')
  const signStr = `${appid}\n${timestamp}\n${noncestr}\n${prepayId}\n`
  const sign = createSign('RSA-SHA256')
  sign.update(signStr, 'utf-8')
  return {
    appid,
    partnerid,
    prepayid: prepayId,
    package: 'Sign=WXPay',
    noncestr,
    timestamp,
    sign: sign.sign(getPrivateKey(), 'base64'),
  }
}

/** APP 预下单(返回 RN SDK 直接可用的完整签名参数) */
export async function appPrepay(params: {
  outTradeNo: string
  amount: number
  description: string
  notifyUrl: string
}): Promise<AppPaySignData> {
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
    signal: AbortSignal.timeout(WX_PAY_FETCH_TIMEOUT_MS),
  })
  if (!resp.ok) throw new Error(`WechatPay app failed: ${resp.status} ${await resp.text()}`)
  const data = (await resp.json()) as { prepay_id: string }
  return buildAppSign(data.prepay_id)
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
    signal: AbortSignal.timeout(WX_PAY_FETCH_TIMEOUT_MS),
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
    signal: AbortSignal.timeout(WX_PAY_FETCH_TIMEOUT_MS),
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
    signal: AbortSignal.timeout(WX_PAY_FETCH_TIMEOUT_MS),
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
    signal: AbortSignal.timeout(WX_PAY_FETCH_TIMEOUT_MS),
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
    signal: AbortSignal.timeout(WX_PAY_FETCH_TIMEOUT_MS),
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
    signal: AbortSignal.timeout(WX_PAY_FETCH_TIMEOUT_MS),
  })
  if (!resp.ok) throw new Error(`WechatPay bill failed: ${resp.status}`)
  const data = (await resp.json()) as { download_url: string }
  const csvResp = await fetch(data.download_url, {
    signal: AbortSignal.timeout(WX_PAY_FETCH_TIMEOUT_MS),
  })
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
    signal: AbortSignal.timeout(WX_PAY_FETCH_TIMEOUT_MS),
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

type ContractState = 'SIGNED' | 'TERMINATED' | 'SIGN_FAILED' | 'TO_BE_RENEWED'

interface DeviceInfo {
  deviceIp: string
  deviceNumber?: string
  deviceType?: string
  merchantNo?: string
  operator?: string
  storeNo?: string
  terminalNo?: string
  unionStoreNo?: string
}

/** 签约:委托代扣预签约(返回 pre_entrustweb_id 供前端跳转签约页面,10 分钟有效) */
export async function signContract(params: {
  planId: number
  outContractCode: string
  appid: string
  contractDisplayAccount: string
  contractNotifyUrl: string
  outUserCode: string
  signScene: 'SIGN_SCENE_APP' | 'SIGN_SCENE_QRCODE'
  deviceInfo: DeviceInfo
  openid?: string
  returnUrl?: string
}): Promise<{
  preEntrustwebId: string
  miniProgramUsername?: string
  miniProgramPath?: string
  redirectUrl?: string
}> {
  ensureRecurringConfigured()
  const body: Record<string, unknown> = {
    sign_scene: params.signScene,
    appid: params.appid,
    plan_id: params.planId,
    out_contract_code: params.outContractCode,
    contract_display_account: params.contractDisplayAccount,
    contract_notify_url: params.contractNotifyUrl,
    out_user_code: params.outUserCode,
    device_info: {
      device_ip: params.deviceInfo.deviceIp,
      ...(params.deviceInfo.deviceNumber !== undefined
        ? { device_number: params.deviceInfo.deviceNumber }
        : {}),
      ...(params.deviceInfo.deviceType !== undefined
        ? { device_type: params.deviceInfo.deviceType }
        : {}),
      ...(params.deviceInfo.merchantNo !== undefined
        ? { merchant_no: params.deviceInfo.merchantNo }
        : {}),
      ...(params.deviceInfo.operator !== undefined ? { operator: params.deviceInfo.operator } : {}),
      ...(params.deviceInfo.storeNo !== undefined ? { store_no: params.deviceInfo.storeNo } : {}),
      ...(params.deviceInfo.terminalNo !== undefined
        ? { terminal_no: params.deviceInfo.terminalNo }
        : {}),
      ...(params.deviceInfo.unionStoreNo !== undefined
        ? { union_store_no: params.deviceInfo.unionStoreNo }
        : {}),
    },
  }
  if (params.openid) body.openid = params.openid
  if (params.returnUrl) body.return_url = params.returnUrl
  const data = await requestV3<{
    pre_entrustweb_id?: string
    mini_program_username?: string
    mini_program_path?: string
    redirect_url?: string
  }>('POST', '/v3/papay/sign/contracts/pre-entrust-sign', body)
  return {
    preEntrustwebId: data.pre_entrustweb_id ?? '',
    ...(data.mini_program_username !== undefined
      ? { miniProgramUsername: data.mini_program_username }
      : {}),
    ...(data.mini_program_path !== undefined ? { miniProgramPath: data.mini_program_path } : {}),
    ...(data.redirect_url !== undefined ? { redirectUrl: data.redirect_url } : {}),
  }
}

/** 解约:委托代扣终止签约(返回完整 contract 对象) */
export async function cancelContract(params: {
  planId: number
  outContractCode: string
  contractTerminationRemark: string
}): Promise<{
  contractId: string
  contractState: ContractState
  contractTerminatedTime?: string
}> {
  ensureRecurringConfigured()
  const path = `/v3/papay/sign/contracts/plan-id/${params.planId}/out-contract-code/${encodeURIComponent(
    params.outContractCode,
  )}/terminate`
  const body = { contract_termination_remark: params.contractTerminationRemark }
  const data = await requestV3<{
    contract_id?: string
    contract_state?: string
    contract_terminate_info?: { contract_terminated_time?: string }
  }>('POST', path, body)
  const terminateInfo = data.contract_terminate_info ?? {}
  return {
    contractId: data.contract_id ?? '',
    contractState: (data.contract_state as ContractState) ?? 'TERMINATED',
    ...(terminateInfo.contract_terminated_time !== undefined
      ? { contractTerminatedTime: terminateInfo.contract_terminated_time }
      : {}),
  }
}

/** 查询签约状态:委托代扣查询签约(按 plan_id + out_contract_code) */
export async function queryContract(
  planId: number,
  outContractCode: string,
): Promise<{
  contractId: string
  contractState: ContractState
  planId: number
  outContractCode: string
  contractDisplayAccount?: string
  contractSignedTime?: string
  contractExpiredTime?: string
  openid?: string
  contractTerminateInfo?: {
    contractTerminationMode: string
    contractTerminatedTime: string
    contractTerminationRemark?: string
  }
  deductSchedule?: unknown
}> {
  ensureRecurringConfigured()
  const path = `/v3/papay/sign/contracts/plan-id/${planId}/out-contract-code/${encodeURIComponent(
    outContractCode,
  )}`
  const data = await requestV3<{
    contract_id?: string
    contract_state?: string
    plan_id?: number
    out_contract_code?: string
    contract_display_account?: string
    contract_signed_time?: string
    contract_expired_time?: string
    openid?: string
    contract_terminate_info?: {
      contract_termination_mode?: string
      contract_terminated_time?: string
      contract_termination_remark?: string
    }
    deduct_schedule?: unknown
  }>('GET', path)
  const terminateInfo = data.contract_terminate_info
  return {
    contractId: data.contract_id ?? '',
    contractState: (data.contract_state as ContractState) ?? 'SIGNED',
    planId: data.plan_id ?? planId,
    outContractCode: data.out_contract_code ?? outContractCode,
    ...(data.contract_display_account !== undefined
      ? { contractDisplayAccount: data.contract_display_account }
      : {}),
    ...(data.contract_signed_time !== undefined
      ? { contractSignedTime: data.contract_signed_time }
      : {}),
    ...(data.contract_expired_time !== undefined
      ? { contractExpiredTime: data.contract_expired_time }
      : {}),
    ...(data.openid !== undefined ? { openid: data.openid } : {}),
    ...(terminateInfo !== undefined
      ? {
          contractTerminateInfo: {
            contractTerminationMode: terminateInfo.contract_termination_mode ?? '',
            contractTerminatedTime: terminateInfo.contract_terminated_time ?? '',
            ...(terminateInfo.contract_termination_remark !== undefined
              ? { contractTerminationRemark: terminateInfo.contract_termination_remark }
              : {}),
          },
        }
      : {}),
    ...(data.deduct_schedule !== undefined ? { deductSchedule: data.deduct_schedule } : {}),
  }
}

/**
 * 从 queryContract 响应中提取 contractExpiredTime 并转为 Date。
 * 微信返回 ISO8601 字符串(本地时区无 'Z',需包装为 Date 供 PG timestamptz 存储)。
 * 解析失败返回 null,调用方应保留现有值。
 */
export function parseContractExpiredTime(value: string | undefined): Date | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * 委托扣款:受理一次扣款。
 *
 * WeChat Pay V3 委托扣款 API 同步只返回受理结果(out_trade_no + amount),
 * 实际扣款状态通过 webhook(TRANSACTION.SUCCESS / TRANSACTION.FAIL)异步通知。
 *
 * deduct_mode(此处命名为 settleMode):
 * - 'async' (默认): 受理后立即返回,扣款结果由 webhook 异步处理。
 *   适合定时扣款场景,扫描 N 条签约 → 全部受理 → webhook 回调时统一更新状态。
 * - 'wait': 受理后轮询 queryOrder,直到交易终态(SUCCESS/CLOSED/PAYERROR)或超时(默认 5s),
 *   同步返回最终状态。适合"用户主动点击扣款(即时扣款)"等需要即时反馈的场景。
 *
 * 注意:'wait' 模式轮询会增加 1-3 次额外 queryOrder API 调用,
 * 单签约场景使用,不要在批量扫扣(并发 5+)场景使用,避免触发 WX API 限流。
 */
export type DeductSettleMode = 'async' | 'wait'

export interface DeductRecurringParams {
  appid: string
  contractId: string
  outTradeNo: string
  amount: number
  description: string
  transactionNotifyUrl: string
  goodsTag?: string
  attach?: string
  /** 默认 'async'; 'wait' 模式会同步轮询交易终态,适合单签约即时扣款场景 */
  settleMode?: DeductSettleMode
}

export interface DeductRecurringResult {
  outTradeNo: string
  amount: { total: number; currency: string }
  /** 仅 settleMode='wait' 模式有值: SUCCESS / CLOSED / PAYERROR / NOTPAY (超时未轮询到) */
  tradeState?: string
}

/** 'wait' 模式轮询配置: 500ms 间隔, 最多 5s 超时 (10 次轮询) */
const DEDUCT_WAIT_POLL_INTERVAL_MS = 500
const DEDUCT_WAIT_TIMEOUT_MS = 5000

export async function deductRecurring(
  params: DeductRecurringParams,
): Promise<DeductRecurringResult> {
  ensureRecurringConfigured()
  const settleMode = params.settleMode ?? 'async'
  const body: Record<string, unknown> = {
    appid: params.appid,
    out_trade_no: params.outTradeNo,
    description: params.description,
    transaction_notify_url: params.transactionNotifyUrl,
    contract_id: params.contractId,
    amount: { total: params.amount, currency: 'CNY' },
  }
  if (params.goodsTag !== undefined) body.goods_tag = params.goodsTag
  if (params.attach !== undefined) body.attach = params.attach
  const data = await requestV3<{
    out_trade_no?: string
    amount?: { total?: number; currency?: string }
  }>('POST', '/v3/papay/pay/transactions/apply', body)

  const result: DeductRecurringResult = {
    outTradeNo: data.out_trade_no ?? params.outTradeNo,
    amount: {
      total: data.amount?.total ?? params.amount,
      currency: data.amount?.currency ?? 'CNY',
    },
  }

  // 'wait' 模式:轮询 queryOrder 直到终态或超时,即时扣款场景使用
  if (settleMode === 'wait') {
    result.tradeState = await pollDeductTradeState(result.outTradeNo, DEDUCT_WAIT_TIMEOUT_MS)
  }

  return result
}

/**
 * 轮询委托扣款交易状态,直到终态或超时。
 * 终态: SUCCESS / CLOSED / PAYERROR / REVOKED / REFUND
 * 非终态: NOTPAY / USERPAYING / ACCEPT
 *
 * 'wait' 模式内部使用,导出以便测试可独立 mock。
 */
async function pollDeductTradeState(outTradeNo: string, timeoutMs: number): Promise<string> {
  const start = Date.now()
  let lastState = 'NOTPAY'
  while (Date.now() - start < timeoutMs) {
    try {
      const data = await queryOrder(outTradeNo)
      const state = (data.trade_state as string) ?? lastState
      lastState = state
      if (
        state === 'SUCCESS' ||
        state === 'CLOSED' ||
        state === 'PAYERROR' ||
        state === 'REVOKED' ||
        state === 'REFUND'
      ) {
        return state
      }
    } catch {
      // queryOrder 失败不立即终止,继续重试(扣款可能仍在进行)
    }
    await new Promise((resolve) => setTimeout(resolve, DEDUCT_WAIT_POLL_INTERVAL_MS))
  }
  return lastState
}
