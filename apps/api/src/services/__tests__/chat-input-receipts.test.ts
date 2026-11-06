// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * chat-input-receipts 单元测试(批次 4)。
 *
 * 用状态化假 Queryable 真跑语句级判据 —— 不是按调用次数回放脚本:
 * 插入冲突 / failed 原子重臂 / 结算守卫的真假必须由"表里当前那一行"决定,
 * 否则测不到并发重试背后那条唯一索引的语义。
 */

import { describe, it, expect } from 'vitest'
import {
  acquireInputReceipt,
  buildAdmissionFrame,
  fingerprintChatRequest,
  INPUT_RECEIPT_LEASE_SECONDS,
  renewInputReceiptLease,
  settleInputReceipt,
  type Queryable,
} from '../chat-input-receipts.js'

type ReceiptStatus = 'dispatching' | 'dispatched' | 'failed'

interface ReceiptRow {
  conversationId: string
  userId: string
  inputId: string
  fingerprint: string
  messageId: string | null
  status: ReceiptStatus
  attemptCount: number
  /** 租约到期时刻(epoch ms)—— 假表用真实时钟判过期,与 SQL 的 now() 同口径 */
  leaseExpiresAt: number
}

function toDbRow(row: ReceiptRow): Record<string, unknown> {
  return {
    attempt_count: row.attemptCount,
    message_id: row.messageId,
    fingerprint: row.fingerprint,
    status: row.status,
    lease_expires_at: new Date(row.leaseExpiresAt).toISOString(),
  }
}

/** 假表:按 SQL 子句分流,维护真实行状态。 */
class FakeReceiptDb implements Queryable {
  rows: ReceiptRow[] = []
  calls: Array<{ sql: string; params: unknown[] }> = []

  private find(conversationId: string, inputId: string): ReceiptRow | undefined {
    return this.rows.find((r) => r.conversationId === conversationId && r.inputId === inputId)
  }

  async query(sql: string, params: unknown[]): Promise<{ rows: unknown[] }> {
    this.calls.push({ sql, params })
    if (sql.includes('INSERT INTO chat_input_receipts')) {
      const [conversationId, userId, inputId, fingerprint, messageId, leaseSeconds] = params as [
        string,
        string,
        string,
        string,
        string | null,
        number,
      ]
      // 唯一索引 (conversation_id, input_id)
      if (this.find(conversationId, inputId)) return { rows: [] }
      const row: ReceiptRow = {
        conversationId,
        userId,
        inputId,
        fingerprint,
        messageId,
        status: 'dispatching',
        attemptCount: 1,
        leaseExpiresAt: Date.now() + leaseSeconds * 1000,
      }
      this.rows.push(row)
      return { rows: [toDbRow(row)] }
    }
    // 崩溃接管:仍在 dispatching 且租约已过期才命中(与 SQL 的 lease_expires_at < now() 同义)
    if (sql.includes('lease_expires_at < now()')) {
      const [conversationId, inputId, fingerprint, messageId, leaseSeconds] = params as [
        string,
        string,
        string,
        string | null,
        number,
      ]
      const row = this.find(conversationId, inputId)
      if (!row || row.status !== 'dispatching' || row.fingerprint !== fingerprint)
        return { rows: [] }
      if (row.leaseExpiresAt >= Date.now()) return { rows: [] }
      row.attemptCount += 1
      row.fingerprint = fingerprint
      row.messageId = messageId ?? row.messageId
      row.leaseExpiresAt = Date.now() + leaseSeconds * 1000
      return { rows: [toDbRow(row)] }
    }
    if (
      sql.includes("SET status = 'dispatching'") &&
      sql.includes('attempt_count = attempt_count + 1')
    ) {
      const [conversationId, inputId, fingerprint, messageId, leaseSeconds] = params as [
        string,
        string,
        string,
        string | null,
        number,
      ]
      const row = this.find(conversationId, inputId)
      // 重臂谓词:只有 failed 行能被翻回 dispatching
      if (!row || row.status !== 'failed') return { rows: [] }
      row.status = 'dispatching'
      row.attemptCount += 1
      row.fingerprint = fingerprint
      row.messageId = messageId ?? row.messageId
      row.leaseExpiresAt = Date.now() + leaseSeconds * 1000
      return { rows: [toDbRow(row)] }
    }
    // 心跳续租:只对 dispatching 生效
    if (sql.includes('SET lease_expires_at = now()') && !sql.includes('lease_expires_at < now()')) {
      const [conversationId, inputId, leaseSeconds] = params as [string, string, number]
      const row = this.find(conversationId, inputId)
      if (!row || row.status !== 'dispatching') return { rows: [] }
      row.leaseExpiresAt = Date.now() + leaseSeconds * 1000
      return { rows: [{ attempt_count: row.attemptCount }] }
    }
    if (sql.includes('SET status = $3')) {
      const [conversationId, inputId, status] = params as [string, string, ReceiptStatus]
      const row = this.find(conversationId, inputId)
      // 结算守卫:只认 dispatching(双向:不降级已 dispatched,也不洗白 failed)
      if (!row || row.status !== 'dispatching') return { rows: [] }
      row.status = status
      return { rows: [{ attempt_count: row.attemptCount }] }
    }
    if (sql.includes('attempt_count = attempt_count + 1')) {
      const [conversationId, inputId] = params as [string, string]
      const row = this.find(conversationId, inputId)
      if (!row) return { rows: [] }
      row.attemptCount += 1
      return { rows: [toDbRow(row)] }
    }
    const [conversationId, inputId] = params as [string, string]
    const row = this.find(conversationId, inputId)
    return { rows: row ? [toDbRow(row)] : [] }
  }
}

const base = {
  conversationId: 'conv-1',
  userId: 'user-1',
  inputId: 'input-1',
  fingerprint: 'fp-a',
  messageId: 'msg-1',
}

describe('chat-input-receipts / fingerprintChatRequest', () => {
  const body = {
    model: 'gpt-4o',
    mode: 'build',
    messages: [
      { role: 'user', content: '你好' },
      { role: 'assistant', content: '在的' },
    ],
  }

  it('语义相同的请求(键序不同)指纹一致', () => {
    const a = fingerprintChatRequest(body)
    const b = fingerprintChatRequest({
      messages: body.messages,
      mode: 'build',
      model: 'gpt-4o',
    })
    expect(a).toBe(b)
    expect(a).toMatch(/^[0-9a-f]{64}$/)
  })

  it('传输字段(inputId/inputAttempt/metadata)不参与指纹', () => {
    const withTransport = {
      ...body,
      inputId: 'input-1',
      inputAttempt: 2,
      metadata: { conversationId: 'conv-1' },
    }
    expect(fingerprintChatRequest(withTransport)).toBe(fingerprintChatRequest(body))
  })

  it('正文或 model 改变后指纹不同', () => {
    expect(fingerprintChatRequest({ ...body, model: 'gpt-5' })).not.toBe(
      fingerprintChatRequest(body),
    )
    expect(
      fingerprintChatRequest({
        ...body,
        messages: [{ role: 'user', content: '换个问法' }],
      }),
    ).not.toBe(fingerprintChatRequest(body))
  })
})

describe('chat-input-receipts / acquireInputReceipt', () => {
  it('首次受理 → accepted attempt=1,并落 dispatching 行(租约在未来)', async () => {
    const db = new FakeReceiptDb()
    const result = await acquireInputReceipt(db, base)
    expect(result).toEqual({ kind: 'accepted', attempt: 1 })
    expect(db.rows).toHaveLength(1)
    expect(db.rows[0]?.status).toBe('dispatching')
    expect(db.rows[0]?.messageId).toBe('msg-1')
    // 租约 = now + 90s
    expect(db.rows[0]?.leaseExpiresAt).toBeGreaterThan(Date.now())
  })

  it('并发重试 → 恰好一个 accepted,另一个 duplicate(不会双生成)', async () => {
    const db = new FakeReceiptDb()
    const [first, second] = await Promise.all([
      acquireInputReceipt(db, base),
      acquireInputReceipt(db, base),
    ])
    const kinds = [first.kind, second.kind].sort()
    expect(kinds).toEqual(['accepted', 'duplicate'])
    expect(db.rows).toHaveLength(1)
    // duplicate 携带 receipt 上的 messageId 与累加后的 attempt
    const duplicate =
      first.kind === 'duplicate' ? first : second.kind === 'duplicate' ? second : null
    expect(duplicate?.kind).toBe('duplicate')
    if (duplicate?.kind === 'duplicate') {
      expect(duplicate.messageId).toBe('msg-1')
      expect(duplicate.attempt).toBe(2)
      expect(duplicate.status).toBe('dispatching')
    }
  })

  it('failed 行 → 原子重臂为 accepted(attempt+1,messageId 补齐)', async () => {
    const db = new FakeReceiptDb()
    db.rows.push({
      conversationId: 'conv-1',
      userId: 'user-1',
      inputId: 'input-1',
      fingerprint: 'fp-a',
      messageId: null,
      status: 'failed',
      attemptCount: 2,
      leaseExpiresAt: Date.now() - 1_000,
    })
    const result = await acquireInputReceipt(db, base)
    expect(result).toEqual({ kind: 'accepted', attempt: 3 })
    expect(db.rows[0]?.status).toBe('dispatching')
    expect(db.rows[0]?.messageId).toBe('msg-1')
  })

  it('同 inputId 不同 fingerprint → reused,且不重臂、不累加', async () => {
    const db = new FakeReceiptDb()
    db.rows.push({
      conversationId: 'conv-1',
      userId: 'user-1',
      inputId: 'input-1',
      fingerprint: 'fp-old',
      messageId: null,
      status: 'failed',
      attemptCount: 4,
      leaseExpiresAt: Date.now() - 1_000,
    })
    const result = await acquireInputReceipt(db, { ...base, fingerprint: 'fp-new' })
    expect(result).toEqual({ kind: 'reused', attempt: 4, fingerprint: 'fp-old' })
    expect(db.rows[0]?.status).toBe('failed')
    expect(db.rows[0]?.fingerprint).toBe('fp-old')
  })
})

describe('chat-input-receipts / 租约超时接管', () => {
  it('dispatching 且租约已过期 → accepted attempt+1(进程崩溃后重试恢复)', async () => {
    const db = new FakeReceiptDb()
    db.rows.push({
      conversationId: 'conv-1',
      userId: 'user-1',
      inputId: 'input-1',
      fingerprint: 'fp-a',
      messageId: null,
      status: 'dispatching',
      attemptCount: 1,
      leaseExpiresAt: Date.now() - 1_000,
    })
    const result = await acquireInputReceipt(db, base)
    expect(result).toEqual({ kind: 'accepted', attempt: 2 })
    // 仍是 dispatching(只是换了 attempt),并换到一段新租约
    expect(db.rows[0]?.status).toBe('dispatching')
    expect(db.rows[0]?.messageId).toBe('msg-1')
    expect(db.rows[0]?.leaseExpiresAt).toBeGreaterThan(Date.now())
  })

  it('dispatching 且租约有效 → duplicate(真重复,不得双生成)', async () => {
    const db = new FakeReceiptDb()
    const leaseExpiresAt = Date.now() + 60_000
    db.rows.push({
      conversationId: 'conv-1',
      userId: 'user-1',
      inputId: 'input-1',
      fingerprint: 'fp-a',
      messageId: 'msg-1',
      status: 'dispatching',
      attemptCount: 1,
      leaseExpiresAt,
    })
    const result = await acquireInputReceipt(db, base)
    expect(result).toEqual({
      kind: 'duplicate',
      attempt: 2,
      messageId: 'msg-1',
      status: 'dispatching',
    })
    // duplicate 不得续租:不能把别人正在跑的流的租约往后推
    expect(db.rows[0]?.leaseExpiresAt).toBe(leaseExpiresAt)
  })

  it('dispatched 行即使租约过期 → duplicate(绝不接管已完成轮次)', async () => {
    const db = new FakeReceiptDb()
    const leaseExpiresAt = Date.now() - 1_000
    db.rows.push({
      conversationId: 'conv-1',
      userId: 'user-1',
      inputId: 'input-1',
      fingerprint: 'fp-a',
      messageId: 'msg-1',
      status: 'dispatched',
      attemptCount: 1,
      leaseExpiresAt,
    })
    const result = await acquireInputReceipt(db, base)
    expect(result).toEqual({
      kind: 'duplicate',
      attempt: 2,
      messageId: 'msg-1',
      status: 'dispatched',
    })
    expect(db.rows[0]?.status).toBe('dispatched')
    expect(db.rows[0]?.leaseExpiresAt).toBe(leaseExpiresAt)
  })

  it('failed 重臂后租约被刷新(新租约在未来)', async () => {
    const db = new FakeReceiptDb()
    db.rows.push({
      conversationId: 'conv-1',
      userId: 'user-1',
      inputId: 'input-1',
      fingerprint: 'fp-a',
      messageId: null,
      status: 'failed',
      attemptCount: 1,
      leaseExpiresAt: Date.now() - 5_000,
    })
    const before = Date.now()
    const result = await acquireInputReceipt(db, base)
    expect(result).toEqual({ kind: 'accepted', attempt: 2 })
    expect(db.rows[0]?.leaseExpiresAt).toBeGreaterThan(before)
    expect(db.rows[0]?.leaseExpiresAt).toBeLessThanOrEqual(
      before + INPUT_RECEIPT_LEASE_SECONDS * 1000,
    )
  })

  it('renew 只对 dispatching 生效并延后过期;dispatched/failed 返回 false', async () => {
    const db = new FakeReceiptDb()
    const before = Date.now()
    db.rows.push({
      conversationId: 'conv-1',
      userId: 'user-1',
      inputId: 'input-1',
      fingerprint: 'fp-a',
      messageId: 'msg-1',
      status: 'dispatching',
      attemptCount: 1,
      leaseExpiresAt: before - 1_000,
    })
    expect(await renewInputReceiptLease(db, { conversationId: 'conv-1', inputId: 'input-1' })).toBe(
      true,
    )
    expect(db.rows[0]?.leaseExpiresAt).toBeGreaterThan(before)

    db.rows[0]!.status = 'dispatched'
    const dispatchedLease = db.rows[0]!.leaseExpiresAt
    expect(await renewInputReceiptLease(db, { conversationId: 'conv-1', inputId: 'input-1' })).toBe(
      false,
    )
    expect(db.rows[0]?.leaseExpiresAt).toBe(dispatchedLease)

    db.rows[0]!.status = 'failed'
    const failedLease = db.rows[0]!.leaseExpiresAt
    expect(await renewInputReceiptLease(db, { conversationId: 'conv-1', inputId: 'input-1' })).toBe(
      false,
    )
    expect(db.rows[0]?.leaseExpiresAt).toBe(failedLease)

    // 行不存在也返回 false(不抛)
    expect(
      await renewInputReceiptLease(db, { conversationId: 'conv-1', inputId: 'input-404' }),
    ).toBe(false)
  })
})

describe('chat-input-receipts / settleInputReceipt', () => {
  it('dispatching → dispatched 生效', async () => {
    const db = new FakeReceiptDb()
    await acquireInputReceipt(db, base)
    const result = await settleInputReceipt(db, {
      conversationId: 'conv-1',
      inputId: 'input-1',
      status: 'dispatched',
    })
    expect(result).toEqual({ applied: true })
    expect(db.rows[0]?.status).toBe('dispatched')
  })

  it('迟到的 failed 不能把已 dispatched 降级', async () => {
    const db = new FakeReceiptDb()
    db.rows.push({
      conversationId: 'conv-1',
      userId: 'user-1',
      inputId: 'input-1',
      fingerprint: 'fp-a',
      messageId: 'msg-1',
      status: 'dispatched',
      attemptCount: 1,
      leaseExpiresAt: Date.now() + 60_000,
    })
    const result = await settleInputReceipt(db, {
      conversationId: 'conv-1',
      inputId: 'input-1',
      status: 'failed',
      errorCode: 'upstream_error',
    })
    expect(result).toEqual({ applied: false })
    expect(db.rows[0]?.status).toBe('dispatched')
  })

  it('迟到的 dispatched 不能把 failed 洗成成功', async () => {
    const db = new FakeReceiptDb()
    db.rows.push({
      conversationId: 'conv-1',
      userId: 'user-1',
      inputId: 'input-1',
      fingerprint: 'fp-a',
      messageId: 'msg-1',
      status: 'failed',
      attemptCount: 1,
      leaseExpiresAt: Date.now() - 1_000,
    })
    const result = await settleInputReceipt(db, {
      conversationId: 'conv-1',
      inputId: 'input-1',
      status: 'dispatched',
    })
    expect(result).toEqual({ applied: false })
    expect(db.rows[0]?.status).toBe('failed')
  })
})

describe('chat-input-receipts / buildAdmissionFrame', () => {
  it('duplicate 帧:event 名 + type/inputId/disposition/messageId/attempt', () => {
    const frame = buildAdmissionFrame({
      inputId: 'input-1',
      disposition: 'duplicate',
      messageId: 'msg-1',
      attempt: 2,
    })
    expect(frame.startsWith('event: admission\ndata: ')).toBe(true)
    expect(frame.endsWith('\n\n')).toBe(true)
    const payload = JSON.parse(frame.slice('event: admission\ndata: '.length)) as Record<
      string,
      unknown
    >
    expect(payload).toEqual({
      type: 'admission',
      inputId: 'input-1',
      disposition: 'duplicate',
      messageId: 'msg-1',
      attempt: 2,
    })
  })

  it('rejected 帧带 input_id_reused 原因;无 messageId 时该键缺席', () => {
    const frame = buildAdmissionFrame({
      inputId: 'input-1',
      disposition: 'rejected',
      reason: 'input_id_reused',
      attempt: 1,
    })
    const payload = JSON.parse(frame.slice('event: admission\ndata: '.length)) as Record<
      string,
      unknown
    >
    expect(payload.disposition).toBe('rejected')
    expect(payload.reason).toBe('input_id_reused')
    expect(payload).not.toHaveProperty('messageId')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
