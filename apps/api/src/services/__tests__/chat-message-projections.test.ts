// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * chat-message-projections 单元测试(批次 4)。
 *
 * 重点钉住四条守卫(它们都是"网关与 worker 并发写同一行"才暴露的形态):
 *  - 重开投影时 attempt 累加;已 committed 的 turn 不得重开;
 *  - materializing 只接受 pending/materializing;
 *  - commit 允许从 committed 再来一次(幂等),但不得覆盖终稿;
 *  - fail 不得触碰 committed。
 */

import { describe, it, expect } from 'vitest'
import type { Queryable } from '../chat-input-receipts.js'
import {
  commitProjection,
  failProjection,
  getProjection,
  markMaterializing,
  openProjection,
} from '../chat-message-projections.js'

type ProjectionState = 'pending' | 'materializing' | 'committed' | 'failed'

interface ProjectionRow {
  conversationId: string
  userId: string
  clientMessageId: string
  state: ProjectionState
  attempt: number
  content: string | null
  reasoning: string | null
  tokens: number | null
  committedMessageId: string | null
  errorCode: string | null
}

function toDbRow(row: ProjectionRow): Record<string, unknown> {
  return {
    conversation_id: row.conversationId,
    user_id: row.userId,
    client_message_id: row.clientMessageId,
    state: row.state,
    attempt_count: row.attempt,
    content: row.content,
    reasoning: row.reasoning,
    tokens: row.tokens,
    committed_message_id: row.committedMessageId,
    error_code: row.errorCode,
    last_activity_at: null,
  }
}

class FakeProjectionDb implements Queryable {
  rows: ProjectionRow[] = []
  calls: Array<{ sql: string; params: unknown[] }> = []

  private find(conversationId: string, clientMessageId: string): ProjectionRow | undefined {
    return this.rows.find(
      (r) => r.conversationId === conversationId && r.clientMessageId === clientMessageId,
    )
  }

  async query(sql: string, params: unknown[]): Promise<{ rows: unknown[] }> {
    this.calls.push({ sql, params })
    if (sql.includes('INSERT INTO chat_message_projections')) {
      const [conversationId, userId, clientMessageId] = params as [string, string, string]
      const existing = this.find(conversationId, clientMessageId)
      if (existing) {
        // WHERE state <> 'committed':已落库的 turn 不重开(零行返回)
        if (existing.state === 'committed') return { rows: [] }
        existing.state = 'pending'
        existing.content = null
        existing.reasoning = null
        existing.tokens = null
        existing.committedMessageId = null
        existing.errorCode = null
        existing.attempt += 1
        return { rows: [{ attempt_count: existing.attempt }] }
      }
      const row: ProjectionRow = {
        conversationId,
        userId,
        clientMessageId,
        state: 'pending',
        attempt: 1,
        content: null,
        reasoning: null,
        tokens: null,
        committedMessageId: null,
        errorCode: null,
      }
      this.rows.push(row)
      return { rows: [{ attempt_count: row.attempt }] }
    }
    const [conversationId, clientMessageId] = params as [string, string]
    const row = this.find(conversationId, clientMessageId)
    if (sql.includes("state = 'materializing'")) {
      if (!row || (row.state !== 'pending' && row.state !== 'materializing')) return { rows: [] }
      const [, , content, reasoning, tokens] = params as [
        string,
        string,
        string | null,
        string | null,
        number | null,
      ]
      row.state = 'materializing'
      row.content = content
      row.reasoning = reasoning
      row.tokens = tokens ?? row.tokens
      return { rows: [{ state: row.state }] }
    }
    if (sql.includes("state = 'committed'")) {
      if (!row) return { rows: [] }
      const [, , committedMessageId, content, reasoning, tokens] = params as [
        string,
        string,
        string | null,
        string | null,
        string | null,
        number | null,
      ]
      row.state = 'committed'
      row.committedMessageId = committedMessageId ?? row.committedMessageId
      row.content = content ?? row.content
      row.reasoning = reasoning ?? row.reasoning
      row.tokens = tokens ?? row.tokens
      row.errorCode = null
      return { rows: [{ state: row.state }] }
    }
    if (sql.includes("state = 'failed'")) {
      // state <> 'committed':已落库的 turn 没有"失败"可言
      if (!row || row.state === 'committed') return { rows: [] }
      row.state = 'failed'
      row.errorCode = typeof params[2] === 'string' ? params[2] : null
      return { rows: [{ state: row.state }] }
    }
    return { rows: row ? [toDbRow(row)] : [] }
  }
}

const identity = { conversationId: 'conv-1', userId: 'user-1', clientMessageId: 'msg-1' }

describe('chat-message-projections / openProjection', () => {
  it('首次打开 → pending,attempt=1', async () => {
    const db = new FakeProjectionDb()
    const result = await openProjection(db, identity)
    expect(result).toEqual({ kind: 'opened', attempt: 1 })
    expect(db.rows[0]?.state).toBe('pending')
  })

  it('同占位消息重试 → attempt 累加且清空上一次半截正文', async () => {
    const db = new FakeProjectionDb()
    db.rows.push({
      conversationId: 'conv-1',
      userId: 'user-1',
      clientMessageId: 'msg-1',
      state: 'materializing',
      attempt: 2,
      content: '半截正文',
      reasoning: '半截推理',
      tokens: 10,
      committedMessageId: null,
      errorCode: null,
    })
    const result = await openProjection(db, identity)
    expect(result).toEqual({ kind: 'opened', attempt: 3 })
    expect(db.rows[0]?.state).toBe('pending')
    expect(db.rows[0]?.content).toBeNull()
    expect(db.rows[0]?.reasoning).toBeNull()
    expect(db.rows[0]?.tokens).toBeNull()
  })

  it('已 committed 的 turn 不得重开(保持终稿与状态)', async () => {
    const db = new FakeProjectionDb()
    db.rows.push({
      conversationId: 'conv-1',
      userId: 'user-1',
      clientMessageId: 'msg-1',
      state: 'committed',
      attempt: 1,
      content: '最终回复',
      reasoning: null,
      tokens: 88,
      committedMessageId: '00000000-0000-0000-0000-000000000001',
      errorCode: null,
    })
    const result = await openProjection(db, identity)
    expect(result).toEqual({ kind: 'committed', attempt: 1 })
    expect(db.rows[0]?.state).toBe('committed')
    expect(db.rows[0]?.content).toBe('最终回复')
  })
})

describe('chat-message-projections / markMaterializing', () => {
  it('pending 行可以写入 partial → materializing', async () => {
    const db = new FakeProjectionDb()
    await openProjection(db, identity)
    const applied = await markMaterializing(db, identity, {
      content: '第一段',
      reasoning: '想一想',
    })
    expect(applied).toBe(true)
    expect(db.rows[0]?.state).toBe('materializing')
    expect(db.rows[0]?.content).toBe('第一段')
  })

  it('已 committed 行拒绝 partial 覆盖(守卫生效)', async () => {
    const db = new FakeProjectionDb()
    await openProjection(db, identity)
    await commitProjection(db, identity, {
      committedMessageId: '00000000-0000-0000-0000-000000000002',
      content: '终稿',
    })
    const applied = await markMaterializing(db, identity, { content: '迟到的半截' })
    expect(applied).toBe(false)
    expect(db.rows[0]?.state).toBe('committed')
    expect(db.rows[0]?.content).toBe('终稿')
  })
})

describe('chat-message-projections / commitProjection', () => {
  it('materializing → committed,写 committed_message_id', async () => {
    const db = new FakeProjectionDb()
    await openProjection(db, identity)
    await markMaterializing(db, identity, { content: '正文' })
    const applied = await commitProjection(db, identity, {
      committedMessageId: '00000000-0000-0000-0000-000000000003',
      content: '正文终稿',
      tokens: 42,
    })
    expect(applied).toBe(true)
    expect(db.rows[0]?.state).toBe('committed')
    expect(db.rows[0]?.committedMessageId).toBe('00000000-0000-0000-0000-000000000003')
    expect(db.rows[0]?.tokens).toBe(42)
  })

  it('commit 幂等:已 committed 再提交不报错、不丢终稿', async () => {
    const db = new FakeProjectionDb()
    await openProjection(db, identity)
    await commitProjection(db, identity, { content: '终稿' })
    const applied = await commitProjection(db, identity, { content: '终稿' })
    expect(applied).toBe(true)
    expect(db.rows[0]?.content).toBe('终稿')
  })
})

describe('chat-message-projections / failProjection', () => {
  it('pending 行可标记 failed', async () => {
    const db = new FakeProjectionDb()
    await openProjection(db, identity)
    const applied = await failProjection(db, identity, 'upstream_error')
    expect(applied).toBe(true)
    expect(db.rows[0]?.state).toBe('failed')
    expect(db.rows[0]?.errorCode).toBe('upstream_error')
  })

  it('已 committed 行拒绝标记失败', async () => {
    const db = new FakeProjectionDb()
    await openProjection(db, identity)
    await commitProjection(db, identity, { content: '终稿' })
    const applied = await failProjection(db, identity, 'upstream_error')
    expect(applied).toBe(false)
    expect(db.rows[0]?.state).toBe('committed')
  })
})

describe('chat-message-projections / getProjection', () => {
  it('无行 → null(不是错误)', async () => {
    const db = new FakeProjectionDb()
    expect(await getProjection(db, identity)).toBeNull()
  })

  it('有行 → 返回窄化结构', async () => {
    const db = new FakeProjectionDb()
    await openProjection(db, identity)
    await markMaterializing(db, identity, { content: '片段' })
    const row = await getProjection(db, identity)
    expect(row?.state).toBe('materializing')
    expect(row?.content).toBe('片段')
    expect(row?.attempt).toBe(1)
  })
})
