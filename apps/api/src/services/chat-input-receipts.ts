// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 输入幂等 receipt(批次 4,2026-11-06 立)。
 *
 * 为什么必须落库:客户端重试(网络抖动 / 双击 / 切网重连)会带着同一个 `inputId`
 * 再次打到网关。ai-service 的 `_admission_seen` 是**进程内** dict —— 多实例网关下
 * 两个实例各算各的、重启即清空,"同一输入只生成一次"根本无从判据。本服务把
 * `(conversation_id, input_id)` 的唯一索引当作幂等判据,由存储层兜住,而不是靠内存。
 *
 * 四条硬语义:
 *  1. 首次受理 / `failed` 重臂 / 崩溃后租约过期的 dispatching 接管 → accepted(可以真的调上游);
 *  2. 已受理过且租约仍有效(dispatching 或 dispatched)→ duplicate(**绝不**再生成一份);
 *  3. 同 inputId 不同 fingerprint → reused(明确拒绝,让客户端换 id,而不是静默吞掉正文);
 *  4. 租约(lease_expires_at)只为"进程崩溃"兜底:活着的流由网关心跳续租,过期与否一律
 *     由 SQL 的 `now()` 判定(谓词写进 WHERE),应用侧不做时钟比较。
 *
 * 之所以接受 `Queryable` 而不是绑死某个驱动:网关主池是 postgres.js(`unsafe`),
 * 而单测只需要一张假表;两边都能塞进同一个最小端口,判据只有一份。
 */

import { createHash } from 'node:crypto'

/**
 * 租约时长 90s / 心跳 30s(2026-11-06 增补)。
 *
 * 为什么两档:心跳必须明显短于租约(留 3 次机会),否则 DB 抖动漏一拍就把一条活着的流
 * 判成"可接管";租约又要明显长于一次首字节等待,否则慢模型会被健康的并发重试抢走生成权。
 */
export const INPUT_RECEIPT_LEASE_SECONDS = 90
export const INPUT_RECEIPT_HEARTBEAT_MS = 30_000

/** 最小 SQL 端口:只需能带参执行并拿回行。 */
export interface Queryable {
  query(sql: string, params: unknown[]): Promise<{ rows: unknown[] }>
}

/** 指纹输入:只取**语义字段**,传输字段(inputId/inputAttempt/metadata)一律不进指纹。 */
export interface ChatRequestFingerprintInput {
  model?: string | null
  mode?: string | null
  messages: ReadonlyArray<{ role: string; content: string }>
}

/**
 * 逐层排序键再序列化,保证"对象键序不同但语义相同"的请求体指纹一致。
 * 只在指纹这一处需要,故不引第二份 canonicalJson(与 run-idempotency 的纪律同向)。
 */
function stableJson(value: unknown): string {
  const sortDeep = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(sortDeep)
    if (input !== null && typeof input === 'object') {
      const source = input as Record<string, unknown>
      const out: Record<string, unknown> = {}
      for (const key of Object.keys(source).sort()) out[key] = sortDeep(source[key])
      return out
    }
    return input
  }
  return JSON.stringify(sortDeep(value))
}

/**
 * 请求指纹:同 inputId 换了正文必须能识别出来(判据 3)。
 * 刻意只取 model/messages/mode —— `inputId`、`inputAttempt`、`metadata`
 * 等传输字段在重试时会原样变化或重复,混进来会让"重试"看起来像"换了内容"。
 */
export function fingerprintChatRequest(body: ChatRequestFingerprintInput): string {
  return createHash('sha256')
    .update(
      stableJson({
        model: body.model ?? null,
        mode: body.mode ?? null,
        messages: body.messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    )
    .digest('hex')
}

/** acquire 的三档判别式结果(处置动作互不相同,所以不能并成一态)。 */
export type AcquireInputReceiptResult =
  | { kind: 'accepted'; attempt: number }
  | { kind: 'duplicate'; attempt: number; messageId: string | null; status: string }
  | { kind: 'reused'; attempt: number; fingerprint: string }

export interface AcquireInputReceiptParams {
  conversationId: string
  userId: string
  inputId: string
  /** 客户端预生成的 assistant 占位消息 id;首次插入与 failed 重臂时写入 */
  messageId?: string | null
  fingerprint: string
}

interface ReceiptRowShape {
  attempt: number
  messageId: string | null
  fingerprint: string
  status: string
  /** 租约到期时刻(仅诊断用:是否过期由 SQL 谓词判,不在应用侧比时钟) */
  leaseExpiresAt: string | null
}

/**
 * 租约值 → 可诊断字符串。postgres.js 的 timestamptz 回来是 Date,假表可能直接给 ISO 串;
 * 两种都收,>解析不出就留 null —— 该字段只用于日志/判据归因,不该让验型失败拖垮受理。
 */
function readLease(raw: unknown): string | null {
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw.toISOString()
  if (typeof raw === 'string' && raw !== '') return raw
  return null
}

/** 行 → 窄化结构。DB 回来的值一律按 unknown 逐个验型,不把 any 泄到调用方。 */
function readRow(row: unknown): ReceiptRowShape | null {
  if (row === null || typeof row !== 'object') return null
  const rec = row as Record<string, unknown>
  const attemptRaw = rec.attempt_count
  const attempt = typeof attemptRaw === 'string' ? Number.parseInt(attemptRaw, 10) : attemptRaw
  if (typeof attempt !== 'number' || !Number.isFinite(attempt)) return null
  return {
    attempt,
    messageId: typeof rec.message_id === 'string' ? rec.message_id : null,
    fingerprint: typeof rec.fingerprint === 'string' ? rec.fingerprint : '',
    status: typeof rec.status === 'string' ? rec.status : '',
    leaseExpiresAt: readLease(rec.lease_expires_at),
  }
}

/**
 * 受理一次输入。
 *
 * 竞态解释:先 `INSERT ... ON CONFLICT DO NOTHING` —— 只有真正插入成功的那一路拿
 * `RETURNING` 行,无需先查后写(查后写会在两个并发请求之间开一个必输窗口)。
 * 冲突后 SELECT 既有行再分流:`failed` 行做**带 status 谓词的原子重臂**,
 * 两个并发重试里只有一个能把 failed 翻回 dispatching(另一个落 duplicate),
 * 这比"先读再写"少一个窗口,也避免重复消费一次真实生成。
 */
export async function acquireInputReceipt(
  queryable: Queryable,
  params: AcquireInputReceiptParams,
): Promise<AcquireInputReceiptResult> {
  const { conversationId, userId, inputId, messageId = null, fingerprint } = params
  const inserted = await queryable.query(
    `INSERT INTO chat_input_receipts
       (conversation_id, user_id, input_id, fingerprint, message_id, status, attempt_count, lease_expires_at)
     VALUES ($1, $2, $3, $4, $5, 'dispatching', 1, now() + ($6::int * interval '1 second'))
     ON CONFLICT (conversation_id, input_id) DO NOTHING
     RETURNING attempt_count, message_id, fingerprint, status, lease_expires_at`,
    [conversationId, userId, inputId, fingerprint, messageId, INPUT_RECEIPT_LEASE_SECONDS],
  )
  const insertedRow = readRow(inserted.rows[0])
  if (insertedRow) return { kind: 'accepted', attempt: insertedRow.attempt }

  const existing = await queryable.query(
    `SELECT attempt_count, message_id, fingerprint, status, lease_expires_at
       FROM chat_input_receipts
      WHERE conversation_id = $1 AND input_id = $2`,
    [conversationId, inputId],
  )
  const row = readRow(existing.rows[0])
  // 行在两次语句之间被删(理论上只有级联删除会碰到):当作首次受理重试一次插入语义。
  if (!row) return { kind: 'accepted', attempt: 1 }

  // 判据 3 排在 failed 重臂之前:同一个 id 换了正文,重臂等于把新正文塞进旧幂等槽,
  // 客户端会以为"重试成功"而实际内容已被无声替换 —— 先如实报 reused。
  if (row.fingerprint !== fingerprint) {
    return { kind: 'reused', attempt: row.attempt, fingerprint: row.fingerprint }
  }

  if (row.status === 'failed') {
    const rearmed = await queryable.query(
      `UPDATE chat_input_receipts
          SET status = 'dispatching',
              attempt_count = attempt_count + 1,
              fingerprint = $3,
              message_id = COALESCE($4, message_id),
              last_error_code = NULL,
              lease_expires_at = now() + ($5::int * interval '1 second'),
              updated_at = now()
        WHERE conversation_id = $1 AND input_id = $2 AND status = 'failed'
        RETURNING attempt_count, message_id, fingerprint, status, lease_expires_at`,
      [conversationId, inputId, fingerprint, messageId, INPUT_RECEIPT_LEASE_SECONDS],
    )
    const rearmedRow = readRow(rearmed.rows[0])
    if (rearmedRow) return { kind: 'accepted', attempt: rearmedRow.attempt }
    // 另一个并发重试已抢先在上一句重臂成功:本次落 duplicate(不重复生成)。
  }

  // 崩溃接管:进程挂掉时行会永远停在 dispatching。租约过期后,同 inputId 的重试
  // 把这个"没人跑"的槽原子接手 —— status 保持 dispatching,只是换了一个新 attempt。
  // 过期与否全交给 SQL 的 `now()`:两个并发重试在 DB 侧排队,只有一个能拿到 RETURNING 行。
  if (row.status === 'dispatching') {
    const takenOver = await queryable.query(
      `UPDATE chat_input_receipts
          SET attempt_count = attempt_count + 1,
              fingerprint = $3,
              message_id = COALESCE($4, message_id),
              last_error_code = NULL,
              lease_expires_at = now() + ($5::int * interval '1 second'),
              updated_at = now()
        WHERE conversation_id = $1 AND input_id = $2 AND fingerprint = $3
          AND status = 'dispatching' AND lease_expires_at < now()
        RETURNING attempt_count, message_id, fingerprint, status, lease_expires_at`,
      [conversationId, inputId, fingerprint, messageId, INPUT_RECEIPT_LEASE_SECONDS],
    )
    const takenOverRow = readRow(takenOver.rows[0])
    if (takenOverRow) return { kind: 'accepted', attempt: takenOverRow.attempt }
    // 没拿到行 ⇒ 租约还没过期(真重复),或已被另一个重试抢先接管 → 落 duplicate。
  }

  // 累加计数但**不**刷新租约:正在跑的那条流不该因为别人重试而续命。
  const bumped = await queryable.query(
    `UPDATE chat_input_receipts
        SET attempt_count = attempt_count + 1, updated_at = now()
      WHERE conversation_id = $1 AND input_id = $2
      RETURNING attempt_count, message_id, fingerprint, status`,
    [conversationId, inputId],
  )
  const bumpedRow = readRow(bumped.rows[0]) ?? row
  return {
    kind: 'duplicate',
    attempt: bumpedRow.attempt,
    messageId: bumpedRow.messageId,
    status: bumpedRow.status,
  }
}

/**
 * 结算 receipt。
 *
 * 谓词只认 `status = 'dispatching'` 是**双向**守卫:迟到的 failed 不能把已 dispatched
 * 的行降级(否则一次成功生成会被一次超时重试洗成"可重试"),迟到的 dispatched 也不能
 * 把 failed 洗成成功。返回 applied=false 表示守卫拦下了这次结算(不是错误)。
 */
export async function settleInputReceipt(
  queryable: Queryable,
  params: {
    conversationId: string
    inputId: string
    status: 'dispatched' | 'failed'
    errorCode?: string | null
  },
): Promise<{ applied: boolean }> {
  const { conversationId, inputId, status, errorCode = null } = params
  const updated = await queryable.query(
    `UPDATE chat_input_receipts
        SET status = $3, last_error_code = $4, updated_at = now()
      WHERE conversation_id = $1 AND input_id = $2 AND status = 'dispatching'
      RETURNING attempt_count`,
    [conversationId, inputId, status, errorCode],
  )
  return { applied: updated.rows.length > 0 }
}

/**
 * 续租心跳(2026-11-06 增补):流还在跑,每 30s 把租约往后推 90s。
 *
 * 返回 boolean 而不是抛:心跳是旁路,漏一拍最多让"崩溃判定"提前,不该打断透传。
 * 谓词只认 `dispatching` —— 已结算(dispatched/failed)的轮次不再续租,免得把一条
 * 已完成的轮次重新"租"给某个来晚的重试。
 */
export async function renewInputReceiptLease(
  queryable: Queryable,
  params: { conversationId: string; inputId: string },
): Promise<boolean> {
  const { conversationId, inputId } = params
  const renewed = await queryable.query(
    `UPDATE chat_input_receipts
        SET lease_expires_at = now() + ($3::int * interval '1 second'),
            updated_at = now()
      WHERE conversation_id = $1 AND input_id = $2 AND status = 'dispatching'
      RETURNING attempt_count`,
    [conversationId, inputId, INPUT_RECEIPT_LEASE_SECONDS],
  )
  return renewed.rows.length > 0
}

/** admission 帧的两档形状(与 apps/ai-service 的 `_sse(SSE_ADMISSION, payload)` 逐字同形)。 */
export type AdmissionFrameInput =
  | { inputId: string; disposition: 'duplicate'; messageId: string | null; attempt: number }
  | { inputId: string; disposition: 'rejected'; reason: string; attempt: number }

/**
 * 纯函数帧构造器:duplicate / rejected 两档都由网关在**未调上游**时直接下发。
 * `type` 字段与 ai-service 一致(其 payload 自带 type);`attempt` 是网关侧新增的
 * 附加字段,旧客户端按未知字段忽略。
 */
export function buildAdmissionFrame(input: AdmissionFrameInput): string {
  const payload: Record<string, unknown> =
    input.disposition === 'duplicate'
      ? {
          type: 'admission',
          inputId: input.inputId,
          disposition: 'duplicate',
          ...(input.messageId ? { messageId: input.messageId } : {}),
          attempt: input.attempt,
        }
      : {
          type: 'admission',
          inputId: input.inputId,
          disposition: 'rejected',
          reason: input.reason,
          attempt: input.attempt,
        }
  return `event: admission\ndata: ${JSON.stringify(payload)}\n\n`
}
