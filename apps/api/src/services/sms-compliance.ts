// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 短信合规侧:退订黑名单、上行回复台账、发送审计。
 *
 * 为什么要独立一份(2026-10-26):
 *  - 营销短信的「拒收请回复R」不是文案装饰,是运营商合规要求;回复必须真的落黑名单,
 *    否则下一条群发仍然会发给他,投诉一次就是通道被封。
 *  - 发送审计要和回执对账:腾讯云状态回调只给 request_id / serial_no / 手机号,
 *    没有本地流水就只能看着一串 ID 猜是哪次发送。
 *
 * 所有 DB 操作都是 best-effort 之外的**明确语义**:
 *  - 查黑名单失败 ⇒ 返回 known:false,由调用方决定是否 fail-closed(营销默认拒绝发送);
 *  - 写审计失败 ⇒ 只 warn,绝不让已经发出去的短信回滚成"发送失败"。
 */
import { createHash } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { env } from 'node:process'
import { db } from '../db/index.js'
import { logger } from '../utils/logger.js'
import { stripCnSmsPrefix } from '../utils/phone.js'

/** 号码归一:本地一律存 11 位裸号(不带 +86),腾讯回执给的是 +86...,两边必须能对上。
 *  归一这一步的唯一实现住在 utils/phone.ts 的 stripCnSmsPrefix(§0.6)——这里只是"不校验"的
 *  那档薄壳:回执/黑名单可能带境外号,必须对任何输入都有定义,不能返回 null。 */
export function normalizeSmsPhone(phone: string): string {
  return stripCnSmsPrefix(phone)
}

/** 号码掩码:仅留前 3 后 4。台账号码保护(A6)后,列表接口只返回这一形态。 */
export function maskSmsPhone(phone: string): string {
  return phone.length >= 7 ? `${phone.slice(0, 3)}****${phone.slice(-4)}` : '***'
}

/** 号码哈希:与迁移里 `encode(sha256(convert_to(phone,'UTF8')),'hex')` 同一算法。
 *  用途是台账号码保护与排障索引;明文 `phone` 列仅回执对账内部使用,不再出接口。 */
export function hashSmsPhone(phone: string): string {
  return createHash('sha256').update(normalizeSmsPhone(phone), 'utf8').digest('hex')
}

/** 退订回复的闭集。只认明确的拒收表达,不做模糊匹配 ——
 *  把「我不需要退订」这种正常回复判成退订,等于替用户做了他没做的决定。 */
const UNSUBSCRIBE_EXACT = new Set([
  'R',
  'TD',
  'T',
  '退订',
  '退订回T',
  '拒收',
  '取消订阅',
  'UNSUBSCRIBE',
  'STOP',
])

export function isUnsubscribeReply(content: string): boolean {
  const cleaned = content
    .replace(/[\s,，。.!！?？、:：;；"'“”‘’]/g, '')
    .trim()
    .toUpperCase()
  if (!cleaned) return false
  if (UNSUBSCRIBE_EXACT.has(cleaned)) return true
  return cleaned.startsWith('退订') || cleaned.startsWith('TD')
}

export interface SmsUnsubscribeState {
  /** 查询本身是否成功。false = 存储不可用,不能当作"未退订" */
  known: boolean
  unsubscribed: boolean
}

export async function isPhoneUnsubscribed(phone: string): Promise<SmsUnsubscribeState> {
  const normalized = normalizeSmsPhone(phone)
  try {
    const rows = (await db.execute(sql`
      SELECT 1 FROM sms_unsubscribes WHERE phone = ${normalized} LIMIT 1
    `)) as unknown as unknown[]
    return { known: true, unsubscribed: rows.length > 0 }
  } catch (e) {
    logger.warn('退订黑名单查询失败', {
      phone: maskSmsPhone(normalized),
      error: (e as Error).message,
    })
    return { known: false, unsubscribed: false }
  }
}

export async function addSmsUnsubscribe(input: {
  phone: string
  reason?: string
  rawContent?: string
  source?: 'reply' | 'admin' | 'manual'
}): Promise<boolean> {
  const phone = normalizeSmsPhone(input.phone)
  if (!phone) return false
  try {
    await db.execute(sql`
      INSERT INTO sms_unsubscribes (
        phone, phone_hash, phone_masked, reason, raw_content, source, created_at, updated_at
      )
      VALUES (
        ${phone},
        ${hashSmsPhone(phone)},
        ${maskSmsPhone(phone)},
        ${input.reason ?? '用户回复退订'},
        ${input.rawContent ?? null},
        ${input.source ?? 'reply'},
        NOW(),
        NOW()
      )
      ON CONFLICT (phone) DO UPDATE
        SET reason = EXCLUDED.reason,
            phone_hash = EXCLUDED.phone_hash,
            phone_masked = EXCLUDED.phone_masked,
            raw_content = COALESCE(EXCLUDED.raw_content, sms_unsubscribes.raw_content),
            source = EXCLUDED.source,
            updated_at = NOW()
    `)
    return true
  } catch (e) {
    logger.warn('写入退订黑名单失败', { phone: maskSmsPhone(phone), error: (e as Error).message })
    return false
  }
}

export async function removeSmsUnsubscribe(phone: string): Promise<boolean> {
  const normalized = normalizeSmsPhone(phone)
  try {
    await db.execute(sql`DELETE FROM sms_unsubscribes WHERE phone = ${normalized}`)
    return true
  } catch (e) {
    logger.warn('移除退订黑名单失败', {
      phone: maskSmsPhone(normalized),
      error: (e as Error).message,
    })
    return false
  }
}

export async function recordSmsInbound(input: {
  phone: string
  content: string
  provider?: string
  raw?: unknown
}): Promise<boolean> {
  const phone = normalizeSmsPhone(input.phone)
  try {
    await db.execute(sql`
      INSERT INTO sms_inbound_messages (phone, content, provider, received_at, raw)
      VALUES (
        ${phone},
        ${input.content},
        ${input.provider ?? 'tencent'},
        NOW(),
        ${input.raw === undefined ? null : JSON.stringify(input.raw)}::jsonb
      )
    `)
    return true
  } catch (e) {
    logger.warn('写入短信上行台账失败', { phone: maskSmsPhone(phone), error: (e as Error).message })
    return false
  }
}

export interface SmsDeliveryLogEntry {
  provider: 'tencent' | 'aliyun' | 'proxy' | 'none'
  category: 'code' | 'notice' | 'marketing'
  templateKey?: string
  templateId?: string
  phone: string
  /** accepted = 已交云侧队列;failed = 云侧/调用失败;suppressed = 本地频控或退订拦截 */
  status: 'accepted' | 'failed' | 'suppressed'
  reason?: string
  requestId?: string
  serialNo?: string
  bizType?: string
  bizId?: string
}

/** 写一条发送审计。绝不抛错、绝不影响调用方判定。 */
export async function recordSmsDelivery(entry: SmsDeliveryLogEntry): Promise<void> {
  // 单测环境不连库:审计是旁路,不能把测试事件循环挂在一个连不上的池上。
  if (env.VITEST || env.SMS_AUDIT_ENABLED === '0') return
  const phone = normalizeSmsPhone(entry.phone)
  try {
    await db.execute(sql`
      INSERT INTO sms_delivery_logs (
        provider, category, template_key, template_id, phone, phone_hash, phone_masked,
        status, reason, request_id, serial_no, biz_type, biz_id, created_at, updated_at
      ) VALUES (
        ${entry.provider},
        ${entry.category},
        ${entry.templateKey ?? null},
        ${entry.templateId ?? null},
        ${phone},
        ${hashSmsPhone(phone)},
        ${maskSmsPhone(phone)},
        ${entry.status},
        ${entry.reason ?? null},
        ${entry.requestId ?? null},
        ${entry.serialNo ?? null},
        ${entry.bizType ?? null},
        ${entry.bizId ?? null},
        NOW(),
        NOW()
      )
    `)
  } catch (e) {
    logger.warn('短信发送审计写入失败(不影响发送结果)', {
      phone: maskSmsPhone(phone),
      error: (e as Error).message,
    })
  }
}

/** 回执对账:按 request_id / serial_no / 最近 7 天同号发送 三选一命中最近一条。
 *  返回是否命中(未命中说明该回执不是本机发出的,不能凭空造一条记录)。 */
export async function updateSmsDeliveryReport(input: {
  phone: string
  requestId?: string
  serialNo?: string
  delivered: boolean
  reason?: string
}): Promise<boolean> {
  const phone = normalizeSmsPhone(input.phone)
  const requestId = input.requestId ?? ''
  const serialNo = input.serialNo ?? ''
  // 没有任何可对账字段时不更新:退回"同号最近一条"会把另一条发送(可能是验证码)的状态改掉,
  // 伪造回执还能把 failed 洗成 delivered,让幂等闸误判"已发过"而抑制真实重试。
  if (!requestId && !serialNo) {
    logger.warn('短信回执缺少 request_id/serial_no ⇒ 不对账', {
      phone: maskSmsPhone(phone),
    })
    return false
  }
  try {
    const rows = (await db.execute(sql`
      UPDATE sms_delivery_logs
      SET status = ${input.delivered ? 'delivered' : 'delivery_failed'},
          reason = ${input.reason ?? null},
          updated_at = NOW()
      WHERE id = (
        SELECT id FROM sms_delivery_logs
        WHERE (${requestId} <> '' AND request_id = ${requestId})
           OR (${serialNo} <> '' AND serial_no = ${serialNo})
        ORDER BY created_at DESC
        LIMIT 1
      )
      RETURNING id
    `)) as unknown as unknown[]
    return rows.length > 0
  } catch (e) {
    logger.warn('短信回执对账失败', { phone: maskSmsPhone(phone), error: (e as Error).message })
    return false
  }
}

/** 同一业务事件是否已经成功发过(幂等判据)。
 *  只认 accepted/delivered ——被频控/退订/重复拦下(suppressed)与失败不算,过点时间重试仍允许。
 *  查询失败按"未发过"处理:幂等是防重复的优化,不能因审计库抖动把业务短信停掉。 */
export async function hasSmsDeliveryForBiz(
  phone: string,
  bizType: string,
  bizId: string,
  days = 7,
): Promise<boolean> {
  const normalized = normalizeSmsPhone(phone)
  const span = `${Math.max(1, Math.min(days, 365))} days`
  try {
    const rows = (await db.execute(sql`
      SELECT 1 FROM sms_delivery_logs
      WHERE phone = ${normalized}
        AND biz_type = ${bizType}
        AND biz_id = ${bizId}
        AND status IN ('accepted', 'delivered')
        AND created_at > NOW() - ${span}::interval
      LIMIT 1
    `)) as unknown as unknown[]
    return rows.length > 0
  } catch (e) {
    logger.warn('短信幂等查询失败(按未发送继续)', {
      phone: maskSmsPhone(normalized),
      error: (e as Error).message,
    })
    return false
  }
}

export async function countSmsUnsubscribes(): Promise<number> {
  try {
    const rows = (await db.execute(sql`
      SELECT COUNT(*)::int AS n FROM sms_unsubscribes
    `)) as unknown as Array<{ n: number }>
    return Number(rows[0]?.n ?? 0)
  } catch {
    return 0
  }
}

export async function listSmsUnsubscribes(
  limit: number,
  offset: number,
): Promise<Array<Record<string, unknown>>> {
  return (await db.execute(sql`
    SELECT phone_masked AS phone, reason, source, raw_content, created_at, updated_at
    FROM sms_unsubscribes
    ORDER BY updated_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `)) as unknown as Array<Record<string, unknown>>
}

export async function listSmsDeliveryLogs(
  limit: number,
  offset: number,
  status?: string,
): Promise<Array<Record<string, unknown>>> {
  return (await db.execute(sql`
    SELECT id, provider, category, template_key, template_id,
           phone_masked AS phone, status, reason,
           request_id, serial_no, biz_type, biz_id, created_at, updated_at
    FROM sms_delivery_logs
    WHERE (${status ?? ''} = '' OR status = ${status ?? ''})
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `)) as unknown as Array<Record<string, unknown>>
}

/** 台账总数与分状态计数(同一过滤条件下)。原接口只回当前页,运营无法判断
 *  "还有没有下一页",也看不到失败/拦截占比。查询失败按 0 处理:统计不是业务判据。 */
export async function smsDeliveryLogStats(
  status?: string,
): Promise<{ total: number; counts: Record<string, number> }> {
  try {
    const rows = (await db.execute(sql`
      SELECT status, COUNT(*)::int AS n
      FROM sms_delivery_logs
      WHERE (${status ?? ''} = '' OR status = ${status ?? ''})
      GROUP BY status
    `)) as unknown as Array<{ status: string; n: number }>
    const counts: Record<string, number> = {}
    let total = 0
    for (const row of rows) {
      const n = Number(row.n ?? 0)
      counts[row.status] = n
      total += n
    }
    return { total, counts }
  } catch (e) {
    logger.warn('短信台账统计查询失败', { error: (e as Error).message })
    return { total: 0, counts: {} }
  }
}

/** 测试出口(§22c):电话归一与退订判定是两条"错一次就群发投诉"的纯判据。 */
export const __test__ = {
  normalizeSmsPhone,
  isUnsubscribeReply,
  hashSmsPhone,
  maskSmsPhone,
  UNSUBSCRIBE_EXACT,
}
