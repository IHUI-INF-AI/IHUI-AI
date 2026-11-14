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
 *    - 收件人:users.email 主邮箱 + user_emails 附加邮箱合并去重(主邮箱优先;
 *      user_emails 查询失败降级仅主邮箱)。
 *
 * 设计原则:db/邮件异常一律 catch 后 log.warn + return false,绝不抛出。
 */

import nodemailer from 'nodemailer'
import { eq } from 'drizzle-orm'
import { dbRead } from '../db/index.js'
import { users, userEmails } from '@ihui/database'
import { logger } from '../utils/logger.js'
import { renderLowBalanceEmail, resolveBrandSmtpFrom } from './email-templates.js'

// =============================================================================
// 常量与配置
// =============================================================================

/**
 * SMTP 三段超时(ms):连接 / 握手 / 读写各一条。
 * 缺省时 nodemailer 会挂到操作系统默认(数分钟),fire-and-forget 的调用方
 * (relay 扣费后 notify)会攒住 socket 不释放。
 */
const SMTP_TIMEOUT_MS = 10_000

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
  const fromConfig = process.env.SMTP_FROM

  // 任一 SMTP 配置缺失 → 不发送(静默降级,不影响主链路)
  if (!host || !port || !user || !pass) {
    logger.warn('[mail-notify] SMTP 未配置,跳过余额不足邮件', { to: params.to })
    return false
  }

  /**
   * From 走品牌身份 —— 2026-11-10 定案。此前是 `const from = process.env.SMTP_FROM` 整串直传:
   * 配置里写什么显示名就寄什么(裸地址时收件箱显示 `noreply`),与告警派发器的口径完全脱节。
   * 地址段与显示名分离、以及 QQ 中继「地址必须等于登录账号」的回落,都与派发器共用同一判据。
   */
  const from = resolveBrandSmtpFrom(fromConfig, user)
  if (from === '') {
    logger.warn('[mail-notify] SMTP_FROM/SMTP_USER 均取不到地址,跳过余额不足邮件', {
      to: params.to,
    })
    return false
  }

  const recipients = (params.to ?? []).filter((e) => typeof e === 'string' && e.length > 0)
  if (recipients.length === 0) {
    logger.warn('[mail-notify] 收件人为空,跳过余额不足邮件')
    return false
  }

  try {
    // `family` 是 nodemailer 透给 net.connect 的运行时旋钮,@types/nodemailer 未登记它 ⇒
    // 具名变量 spread(口径同 notify-deploy-failure 的 makeSmtpTransport),不整包 as any。
    const runtimeOnly: { family: 4 } = { family: 4 }
    const transporter = nodemailer.createTransport({
      host,
      port: Number.parseInt(port, 10) || 465,
      secure: Number.parseInt(port, 10) === 465,
      auth: { user, pass },
      // IPv4 强制 + 三段超时:2026-10-01 记录在案的 IPv6 ENETUNREACH 静默失败,
      // 以及 fire-and-forget 调用方不能被默认超时攒住 socket。口径同派发器 makeSmtpTransport。
      ...runtimeOnly,
      connectionTimeout: SMTP_TIMEOUT_MS,
      greetingTimeout: SMTP_TIMEOUT_MS,
      socketTimeout: SMTP_TIMEOUT_MS,
    })

    const purchaseUrl = `${PURCHASE_BASE_URL}/purchase`

    // 「智汇通报」品牌模板(与事务邮件同一设计语言)
    const rendered = renderLowBalanceEmail({
      userName: params.userName,
      keyName: params.keyName,
      tokenBalance: params.tokenBalance,
      costBalanceCents: params.costBalanceCents,
      thresholdCents: params.thresholdCents,
      purchaseUrl,
    })

    await transporter.sendMail({
      from,
      to: recipients.join(','),
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
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
 * 收件人:users.email 主邮箱 + user_emails 附加邮箱合并去重(主邮箱优先;
 * user_emails 查询失败时降级仅主邮箱发送)。
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

  // 3. 查收件人邮箱:users.email 主邮箱 + user_emails 附加邮箱,合并去重(主邮箱优先)
  const emails: string[] = []
  try {
    const rows = await dbRead
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
    const primary = rows[0]?.email ?? null
    if (primary) emails.push(primary)
    // 附加邮箱(user_emails):查询失败降级仅主邮箱,不阻断通知
    try {
      const extraRows = await dbRead
        .select({ email: userEmails.email })
        .from(userEmails)
        .where(eq(userEmails.userId, userId))
      for (const row of extraRows) {
        if (typeof row.email === 'string' && row.email.length > 0 && !emails.includes(row.email)) {
          emails.push(row.email)
        }
      }
    } catch (err) {
      logger.warn('[mail-notify] 查询附加邮箱失败,降级仅主邮箱', {
        userId,
        keyName,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  } catch (err) {
    logger.warn('[mail-notify] 查询用户邮箱失败,跳过余额不足通知', {
      userId,
      keyName,
      error: err instanceof Error ? err.message : String(err),
    })
    return false
  }

  if (emails.length === 0) {
    logger.warn('[mail-notify] 用户无邮箱,跳过余额不足通知', { userId, keyName })
    return false
  }

  // 4. 记录冷却(先标记,避免并发重复发送) + 发信(全部收件人合并为一封邮件)
  lastNotifiedAtByUser.set(userId, now)
  return sendLowBalanceMail({
    to: emails,
    keyName,
    tokenBalance,
    costBalanceCents,
    thresholdCents: LOW_BALANCE_NOTIFY_THRESHOLD_CENTS,
  })
}
