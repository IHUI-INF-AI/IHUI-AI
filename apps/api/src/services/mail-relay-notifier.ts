// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * 余额不足邮件通知服务(2026-09-16 立)。
 *
 * 职责:
 * 1. sendLowBalanceMail: 通过 SMTP(nodemailer) 发送余额不足中文通知邮件。
 *    SMTP 配置读 env: SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / SMTP_FROM,
 *    任一缺失 → 直接 return false 并 log.warn(不抛错,通知失败不影响主链路)。
 * 2. checkAndNotifyLowBalance: relay 扣费后 fire-and-forget 调用。
 *    - 防骚扰:进程内 Map<userId, lastNotifiedAt>,同用户 24h 内只发一次
 *      (LOW_BALANCE_NOTIFY_COOLDOWN_MS 默认 86400000)。
 *    - 余额判定:tokenBalance 为 0 或 (costBalanceCents >= 0 且 < 阈值) 视为不足。
 *      阈值默认 1000 分(¥10),env LOW_BALANCE_NOTIFY_THRESHOLD_CENTS 可调。
 *    - 收件人:查 users 表邮箱(单邮箱;多邮箱扩展留 TODO)。
 *
 * 设计原则:db/邮件异常一律 catch 后 log.warn + return false,绝不抛出。
 */

import nodemailer from 'nodemailer'
import { eq } from 'drizzle-orm'
import { dbRead } from '../db/index.js'
import { users } from '@ihui/database'
import { logger } from '../utils/logger.js'

// =============================================================================
// 常量与配置
// =============================================================================

/** 余额不足通知冷却窗口(ms),默认 24h,env LOW_BALANCE_NOTIFY_COOLDOWN_MS 可调 */
const LOW_BALANCE_NOTIFY_COOLDOWN_MS = Number(
  process.env.LOW_BALANCE_NOTIFY_COOLDOWN_MS ?? 86400000,
)

/** 余额不足阈值(分),默认 1000 分(¥10),env LOW_BALANCE_NOTIFY_THRESHOLD_CENTS 可调 */
const LOW_BALANCE_NOTIFY_THRESHOLD_CENTS = Number(
  process.env.LOW_BALANCE_NOTIFY_THRESHOLD_CENTS ?? 1000,
)

/** 充值落地页(邮件内建议充值链接前缀),env PUBLIC_API_BASE_URL 可调 */
const PURCHASE_BASE_URL = process.env.PUBLIC_API_BASE_URL ?? 'https://aizhs.top'

// =============================================================================
// 进程内防骚扰冷却(同用户 24h 内只发一次)
// =============================================================================

const lastNotifiedAtByUser = new Map<string, number>()

// =============================================================================
// 1. sendLowBalanceMail — 发送余额不足邮件(低层,单一收件人列表)
// =============================================================================

export interface SendLowBalanceMailParams {
  to: string[]
  userName?: string
  keyName: string
  tokenBalance: number
  costBalanceCents: number
  thresholdCents: number
}

/**
 * 通过 SMTP 发送余额不足邮件。
 *
 * SMTP 配置(env):SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / SMTP_FROM。
 * 任一缺失 → 直接 return false 并 log.warn(不抛错,失败不影响主链路)。
 *
 * 邮件正文中文简洁:Key 名称、当前余额(Token 与 元=costBalanceCents/100 保留 2 位)、
 * 建议充值链接 PURCHASE_BASE_URL + '/purchase'。
 */
export async function sendLowBalanceMail(params: SendLowBalanceMailParams): Promise<boolean> {
  const host = process.env.SMTP_HOST
  const port = process.env.SMTP_PORT
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  const from = process.env.SMTP_FROM

  // 任一 SMTP 配置缺失 → 不发送(静默降级,不影响主链路)
  if (!host || !port || !user || !pass || !from) {
    logger.warn('[mail-notify] SMTP 未配置,跳过余额不足邮件', { to: params.to })
    return false
  }

  const recipients = (params.to ?? []).filter((e) => typeof e === 'string' && e.length > 0)
  if (recipients.length === 0) {
    logger.warn('[mail-notify] 收件人为空,跳过余额不足邮件')
    return false
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port: Number.parseInt(port, 10) || 465,
      secure: Number.parseInt(port, 10) === 465,
      auth: { user, pass },
    })

    const subject = '【智汇AI】您的 API Key 余额不足，请及时充值'
    const yuan = (params.costBalanceCents / 100).toFixed(2)
    const thresholdYuan = (params.thresholdCents / 100).toFixed(2)
    const purchaseUrl = `${PURCHASE_BASE_URL}/purchase`

    const text = [
      `尊敬的用户${params.userName ? `（${params.userName}）` : ''}：`,
      '',
      `您的 API Key「${params.keyName}」当前余额已不足，为避免调用中断请尽快充值。`,
      '',
      '当前余额：',
      `  · Token 余额：${params.tokenBalance}`,
      `  · 金额余额：¥${yuan}（${params.costBalanceCents} 分，阈值 ¥${thresholdYuan}）`,
      '',
      `立即充值：${purchaseUrl}`,
      '',
      '— 智汇AI 团队',
    ].join('\n')

    const html = [
      '<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.6">',
      `  <p>尊敬的用户${params.userName ? `（${params.userName}）` : ''}：</p>`,
      `  <p>您的 API Key <strong>「${params.keyName}」</strong> 当前余额已不足，为避免调用中断请尽快充值。</p>`,
      '  <p>当前余额：</p>',
      '  <ul>',
      `    <li>Token 余额：${params.tokenBalance}</li>`,
      `    <li>金额余额：¥${yuan}（${params.costBalanceCents} 分，阈值 ¥${thresholdYuan}）</li>`,
      '  </ul>',
      `  <p><a href="${purchaseUrl}">立即充值</a></p>`,
      '  <p>— 智汇AI 团队</p>',
      '</div>',
    ].join('\n')

    await transporter.sendMail({
      from,
      to: recipients.join(','),
      subject,
      text,
      html,
    })
    return true
  } catch (err) {
    logger.warn('[mail-notify] 发送余额不足邮件失败', {
      to: params.to,
      keyName: params.keyName,
      error: err instanceof Error ? err.message : String(err),
    })
    return false
  }
}

// =============================================================================
// 2. checkAndNotifyLowBalance — 余额不足判定 + 防骚扰 + 发信(高层,fire-and-forget 用)
// =============================================================================

export interface CheckAndNotifyLowBalanceParams {
  userId: string
  keyId: string
  keyName: string
  tokenBalance: number
  costBalanceCents: number
}

/**
 * relay 扣费成功后调用:判定余额不足且未在冷却内时,查收件人邮箱并发邮件。
 *
 * 防骚扰:进程内 Map<userId, lastNotifiedAt>,同用户 LOW_BALANCE_NOTIFY_COOLDOWN_MS
 * 内只发一次(默认 24h)。
 * 余额判定:tokenBalance 为 0 或 (costBalanceCents >= 0 且 < 阈值) 视为不足
 * (-1 无限额度 costBalanceCents 不参与判定)。
 * 收件人:查 users 表邮箱。当前仅支持单邮箱;多邮箱扩展 TODO(遍历 users.emails 或
 * 关联邮箱表后批量发送)。
 *
 * 全部异常 catch 后 log.warn + return false,绝不抛出(不影响主调用链路)。
 */
export async function checkAndNotifyLowBalance(
  params: CheckAndNotifyLowBalanceParams,
): Promise<boolean> {
  const { userId, keyName, tokenBalance, costBalanceCents } = params

  // 1. 防骚扰冷却:冷却内直接跳过(不查库、不发信)
  const now = Date.now()
  const lastNotifiedAt = lastNotifiedAtByUser.get(userId)
  if (lastNotifiedAt !== undefined && now - lastNotifiedAt < LOW_BALANCE_NOTIFY_COOLDOWN_MS) {
    return false
  }

  // 2. 余额判定:token 耗尽 或 金额余额在 [0, 阈值) 内(排除 -1 无限额度)
  const isLow =
    tokenBalance === 0 ||
    (costBalanceCents >= 0 && costBalanceCents < LOW_BALANCE_NOTIFY_THRESHOLD_CENTS)
  if (!isLow) return false

  // 3. 查收件人邮箱(users 表)
  let email: string | null = null
  try {
    const rows = await dbRead
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
    email = rows[0]?.email ?? null
  } catch (err) {
    logger.warn('[mail-notify] 查询用户邮箱失败,跳过余额不足通知', {
      userId,
      keyName,
      error: err instanceof Error ? err.message : String(err),
    })
    return false
  }

  if (!email) {
    logger.warn('[mail-notify] 用户无邮箱,跳过余额不足通知', { userId, keyName })
    return false
  }

  // 4. 记录冷却(先标记,避免并发重复发送) + 发信
  // TODO: 多邮箱扩展 —— 若用户有多个邮箱,遍历后分别发送
  lastNotifiedAtByUser.set(userId, now)
  return sendLowBalanceMail({
    to: [email],
    keyName,
    tokenBalance,
    costBalanceCents,
    thresholdCents: LOW_BALANCE_NOTIFY_THRESHOLD_CENTS,
  })
}
