// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 充值扫码凭据的会话内暂存(W-07)。
 *
 * 2026-11-08 安全修复:此前 /wallet/recharge/success 直接把 URL 里的
 * `amount` / `method` / `codeUrl` / `payUrl` 当可信输入渲染,攻击者可构造链接
 * 展示自己的收款码与任意金额(支付钓鱼)。现在 URL 只携带 `orderNo`,
 * 金额/支付方式一律以服务端订单详情为准;二维码凭据改由下单页写入本标签页
 * 的 sessionStorage(同源、按 orderNo 键),成功页只读这份本地数据。
 *
 * 攻击者构造的链接没有对应的 sessionStorage 记录,只能看到「等待支付确认」
 * 的只读页,无法渲染任何二维码。
 */

export type RechargePaymentMethod = 'wechat' | 'alipay'

export interface RechargeQrCredentials {
  codeUrl?: string
  payUrl?: string
}

const KEY_PREFIX = 'ihui:recharge:qr:'

/** 仅允许微信 Native 的 code_url 与支付宝的 https 收银台地址,阻断 javascript:/data: 等危险二维码内容 */
function isAllowedQrValue(value: string): boolean {
  return value.startsWith('weixin://') || value.startsWith('https://')
}

function sanitize(value: unknown): string | undefined {
  return typeof value === 'string' && isAllowedQrValue(value) ? value : undefined
}

export function saveRechargeQr(orderNo: string, creds: RechargeQrCredentials): void {
  if (!orderNo) return
  const payload: RechargeQrCredentials = {}
  const codeUrl = sanitize(creds.codeUrl)
  const payUrl = sanitize(creds.payUrl)
  if (codeUrl) payload.codeUrl = codeUrl
  if (payUrl) payload.payUrl = payUrl
  if (!payload.codeUrl && !payload.payUrl) return
  try {
    sessionStorage.setItem(`${KEY_PREFIX}${orderNo}`, JSON.stringify(payload))
  } catch {
    // 隐私模式/配额受限时静默降级:成功页会退回只读等待页
  }
}

export function readRechargeQr(orderNo: string): RechargeQrCredentials | null {
  if (!orderNo) return null
  try {
    const raw = sessionStorage.getItem(`${KEY_PREFIX}${orderNo}`)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const record = parsed as Record<string, unknown>
    const codeUrl = sanitize(record.codeUrl)
    const payUrl = sanitize(record.payUrl)
    if (!codeUrl && !payUrl) return null
    return { ...(codeUrl ? { codeUrl } : {}), ...(payUrl ? { payUrl } : {}) }
  } catch {
    return null
  }
}

export function clearRechargeQr(orderNo: string): void {
  if (!orderNo) return
  try {
    sessionStorage.removeItem(`${KEY_PREFIX}${orderNo}`)
  } catch {
    // ignore
  }
}

/** 服务端 paymentMethod 只做展示白名单映射,未知值一律不展示支付方式 */
export function normalizePaymentMethod(
  paymentMethod: string | null | undefined,
): RechargePaymentMethod | null {
  switch (paymentMethod) {
    case 'wechat':
    case 'wechat_native':
    case 'wechat_jsapi':
    case 'wechat_h5':
      return 'wechat'
    case 'alipay':
      return 'alipay'
    default:
      return null
  }
}

/** 订单金额以分为单位(见 packages/database billing.orders.amount),展示时转元 */
export function formatOrderAmount(amountCents: number | null | undefined): string | null {
  if (typeof amountCents !== 'number' || !Number.isFinite(amountCents) || amountCents < 0)
    return null
  return (amountCents / 100).toFixed(2)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
