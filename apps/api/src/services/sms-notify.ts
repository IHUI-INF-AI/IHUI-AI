// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 业务事件 → 结构化短信通知(2026-10-26, A1)。
 *
 * 设计边界:
 *  - 只走**已报审的固定文案通知模板**(category=notice),不在这里拼自由正文;
 *  - 一律 fire-and-forget:业务主流程已经写库成功才调用,短信失败只告警,绝不回滚业务;
 *  - 号码来自 users.phone,偏好来自 notification_preferences.sms_enabled;
 *    **安全类通知不受偏好约束** —— 改密/换绑/新设备/账号注销是账号安全事件,
 *    用户必须收到,否则等于给了攻击者静默操作窗口;
 *  - bizType+bizId 稳定,交给 sendTemplatedSms 的幂等闸去重,重试不会重复发。
 */

import { sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { logger } from '../utils/logger.js'
import { maskSmsPhone } from './sms-compliance.js'
import { sendTemplatedSms } from './sms.js'
import type { SmsNoticeTemplateKey } from './sms-types.js'

/** 安全类通知:跳过 sms_enabled 偏好。 */
const SECURITY_NOTICE_KEYS = new Set<SmsNoticeTemplateKey>([
  'password-changed',
  'new-device',
  'security-limit',
  'binding-success',
  'account-cancel',
])

export interface BusinessSmsOptions {
  /** 业务标识,如 auth/vip/order/security */
  bizType: string
  /** 业务事件 ID(同一事件重试必须相同),幂等键 */
  bizId: string
  /** 通道降级时的兜底正文(阿里云/代理),不超过 35 字 */
  fallbackContent?: string
  /** 强制发送(跳过偏好),用于确需触达的非安全类事件 */
  force?: boolean
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function findUserPhone(userId: string): Promise<string | null> {
  // users.id 是 uuid;非 uuid 的业务 ID 不可能在 users 表里,直接跳过,避免 ::uuid 转换抛错
  if (!UUID_RE.test(userId)) return null
  const rows = (await db.execute(sql`
    SELECT phone FROM users WHERE id = ${userId}::uuid LIMIT 1
  `)) as unknown as Array<{ phone: string | null }>
  const phone = rows[0]?.phone?.trim()
  return phone ? phone : null
}

async function isSmsEnabled(userId: string): Promise<boolean> {
  if (!UUID_RE.test(userId)) return false
  const rows = (await db.execute(sql`
    SELECT sms_enabled FROM notification_preferences
    WHERE user_id = ${userId}::uuid LIMIT 1
  `)) as unknown as Array<{ sms_enabled: boolean }>
  return rows[0]?.sms_enabled === true
}

/** 给指定用户发一条结构化通知短信。不抛错。 */
export async function sendNoticeSmsToUser(
  userId: string,
  templateKey: SmsNoticeTemplateKey,
  options: BusinessSmsOptions,
): Promise<void> {
  try {
    if (!options.force && !SECURITY_NOTICE_KEYS.has(templateKey)) {
      const enabled = await isSmsEnabled(userId)
      if (!enabled) {
        logger.info('业务短信跳过:用户未开启短信通知', { userId, templateKey })
        return
      }
    }
    const phone = await findUserPhone(userId)
    if (!phone) return
    const result = await sendTemplatedSms(phone, {
      category: 'notice',
      templateKey,
      fallbackContent: options.fallbackContent,
      bizType: options.bizType,
      bizId: options.bizId,
    })
    if (!result.success) {
      logger.warn('业务短信发送失败', {
        userId,
        templateKey,
        phone: maskSmsPhone(phone),
        error: result.error,
      })
    }
  } catch (e) {
    logger.warn('业务短信派发异常(已忽略,不影响业务)', {
      userId,
      templateKey,
      error: (e as Error).message,
    })
  }
}

/** 已知号码直接发(后台维护群发等无 userId 场景)。不抛错。 */
export async function sendNoticeSmsToPhone(
  phone: string,
  templateKey: SmsNoticeTemplateKey,
  options: BusinessSmsOptions,
): Promise<void> {
  try {
    const result = await sendTemplatedSms(phone, {
      category: 'notice',
      templateKey,
      fallbackContent: options.fallbackContent,
      bizType: options.bizType,
      bizId: options.bizId,
    })
    if (!result.success) {
      logger.warn('业务短信发送失败', {
        templateKey,
        phone: maskSmsPhone(phone),
        error: result.error,
      })
    }
  } catch (e) {
    logger.warn('业务短信派发异常(已忽略)', {
      templateKey,
      error: (e as Error).message,
    })
  }
}

export const __test__ = { SECURITY_NOTICE_KEYS }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
