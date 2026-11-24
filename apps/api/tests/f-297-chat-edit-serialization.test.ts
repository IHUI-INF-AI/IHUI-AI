// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { beforeEach, describe, expect, it, vi } from 'vitest'

// F-297 回归:chat 消息编辑写路径必须按会话行锁串行(零库,链式假 db)。
// 病灶:editAiMessageAsVersion / editMessageAndTruncateAfter 在无锁事务里取 max/删行,
// 并发编辑撞 sibling_index;/edit-rerun 与流式回调并发时截断删不干净;
// editAiMessageAsVersion 插入新版本后不重算投影。判据:
//  ① 编辑 = 事务 → 会话行 FOR UPDATE → 取族内 max → insert;
//  ② insert 之后必须触发投影重算(rollHistoryProjection reset);
//  ③ edit-rerun 的 DELETE 之前先锁会话行;
//  ④ 正常编辑仍返回正确的新版本行(rootId / siblingIndex / 内容 / 来源);
//  ⑤ 既有错误语义不变(非 assistant 拒、目标不存在时不进事务)。
const state = vi.hoisted(() => ({
  events: [] as string[],
  target: null as Record<string, unknown> | null,
  familyRows: [] as { siblingIndex: number | null }[],
  insertPayload: null as Record<string, unknown> | null,
  insertRow: {} as Record<string, unknown>,
  projectionRows: [] as { turnOrdinal: number | null; content: string | null }[],
  updateReturns: [] as unknown[],
  updates: [] as Record<string, unknown>[],
}))

vi.mock('../src/db/index.js', () => {
  // 事件按调用顺序累积,断言只比较相对位置(transaction → for:update → select:family → insert → select:projection)
  const select = (fields?: Record<string, unknown>) => {
    let kind: 'rows' | 'family' | 'projection' = 'rows'
    if (fields && 'siblingIndex' in fields) kind = 'family'
    else if (fields && 'turnOrdinal' in fields && 'content' in fields) kind = 'projection'
    if (kind === 'family') state.events.push('select:family')
    if (kind === 'projection') state.events.push('select:projection')
    const rows = (): unknown[] =>
      kind === 'family'
        ? state.familyRows
        : kind === 'projection'
          ? state.projectionRows
          : state.target
            ? [state.target]
            : []
    const api: Record<string, unknown> = {}
    for (const m of [
      'from',
      'innerJoin',
      'leftJoin',
      'where',
      'orderBy',
      'limit',
      'offset',
      'groupBy',
    ])
      api[m] = () => api
    // 锁会话行:事件名带 mode,方便判"锁发生在取 max/DELETE 之前"
    api.for = (mode: string) => {
      state.events.push(`for:${mode}`)
      return Promise.resolve(rows())
    }
    api.then = (res?: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
      Promise.resolve(rows()).then(res, rej)
    return api
  }
  const update = () => {
    const api: Record<string, unknown> = {}
    for (const m of ['from', 'where', 'orderBy', 'limit', 'offset', 'groupBy']) api[m] = () => api
    api.set = (v: Record<string, unknown>) => {
      state.events.push('update')
      state.updates.push({ ...v })
      return api
    }
    api.returning = () => api
    api.then = (res?: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
      Promise.resolve(state.updateReturns).then(res, rej)
    return api
  }
  const insert = () => {
    const api: Record<string, unknown> = {}
    for (const m of ['from', 'where', 'orderBy', 'limit', 'offset', 'groupBy']) api[m] = () => api
    api.values = (v: Record<string, unknown>) => {
      state.insertPayload = { ...v }
      state.events.push('insert')
      return api
    }
    api.returning = () => api
    api.then = (res?: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
      Promise.resolve([state.insertRow]).then(res, rej)
    return api
  }
  const del = () => {
    const api: Record<string, unknown> = {}
    for (const m of ['from', 'where', 'orderBy', 'limit', 'offset', 'groupBy']) api[m] = () => api
    api.returning = () => api
    api.then = (res?: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => {
      state.events.push('delete')
      return Promise.resolve([]).then(res, rej)
    }
    return api
  }
  const client = { select, update, insert, delete: del }
  const db = {
    ...client,
    transaction: (fn: (tx: unknown) => Promise<unknown>) => {
      state.events.push('transaction')
      return fn(client)
    },
  }
  return { db, dbRead: db }
})

import { editAiMessageAsVersion, editMessageAndTruncateAfter } from '../src/db/chat-queries.js'

const CONV = 'c-1'
const idx = (event: string) => state.events.indexOf(event)

function assistantRow(over: Record<string, unknown> = {}) {
  return {
    id: 'm-1',
    conversationId: CONV,
    role: 'assistant',
    content: '旧回答',
    reasoning: null,
    turnOrdinal: 3,
    parentMessageId: null,
    siblingIndex: null,
    metadata: { model: 'gpt-x' },
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...over,
  }
}

function userRow(over: Record<string, unknown> = {}) {
  return assistantRow({ id: 'u-1', role: 'user', content: '旧提问', turnOrdinal: 2, ...over })
}

beforeEach(() => {
  state.events.length = 0
  state.updates.length = 0
  state.target = assistantRow()
  state.familyRows = [{ siblingIndex: 0 }]
  state.insertPayload = null
  state.insertRow = assistantRow({
    id: 'm-2',
    content: '改后的回答',
    parentMessageId: 'm-1',
    siblingIndex: 1,
  })
  state.projectionRows = [
    { turnOrdinal: 3, content: '旧回答' },
    { turnOrdinal: 3, content: '改后的回答' },
  ]
  state.updateReturns = []
})

describe('F-297①:editAiMessageAsVersion 事务 → 会话行锁 → 取 max → insert', () => {
  it('四步顺序固定:先开事务,再 FOR UPDATE 锁会话行,然后才读族内 max 与插入', async () => {
    await editAiMessageAsVersion({ messageId: 'm-1', userId: 'u-1', content: '改后的回答' })

    expect(idx('transaction')).toBeGreaterThanOrEqual(0)
    expect(idx('for:update')).toBeGreaterThan(idx('transaction'))
    expect(idx('select:family')).toBeGreaterThan(idx('for:update'))
    expect(idx('insert')).toBeGreaterThan(idx('select:family'))
  })
})

describe('F-297②:插入新版本后触发投影重算', () => {
  it('insert 之后出现 reset 档投影读(select:projection)与 historyProjectionState 落库', async () => {
    await editAiMessageAsVersion({ messageId: 'm-1', userId: 'u-1', content: '改后的回答' })

    expect(idx('select:projection')).toBeGreaterThan(idx('insert'))
    expect(state.updates.some((u) => 'historyProjectionState' in u)).toBe(true)
  })
})

describe('F-297③:editMessageAndTruncateAfter 在 DELETE 前先锁会话行', () => {
  it('事务 → 锁 → DELETE 的顺序成立,且既有 reset 语义保留', async () => {
    state.target = userRow()
    state.updateReturns = [userRow({ content: '新提问' })]

    const message = await editMessageAndTruncateAfter(CONV, 'u-1', '新提问')

    expect(idx('transaction')).toBeGreaterThanOrEqual(0)
    expect(idx('for:update')).toBeGreaterThan(idx('transaction'))
    expect(idx('delete')).toBeGreaterThan(idx('for:update'))
    expect(state.events).toContain('select:projection')
    expect(message).toMatchObject({ id: 'u-1', content: '新提问' })
  })

  it('目标不存在时不进事务、不发删除(错误语义不变)', async () => {
    state.target = null
    await expect(editMessageAndTruncateAfter(CONV, 'nope', 'x')).rejects.toThrow(
      '消息不存在或不属于该对话',
    )
    expect(state.events).toEqual([])
  })
})

describe('F-297④:正常编辑仍返回正确的新版本行', () => {
  it('rootId / siblingIndex(= 族内 max+1)/ 内容 / 编辑来源均正确', async () => {
    state.familyRows = [{ siblingIndex: 0 }, { siblingIndex: 7 }]
    state.insertRow = assistantRow({
      id: 'm-8',
      content: '改后的回答',
      parentMessageId: 'm-1',
      siblingIndex: 8,
    })

    const res = await editAiMessageAsVersion({
      messageId: 'm-1',
      userId: 'u-1',
      content: '改后的回答',
    })

    expect(res.message.id).toBe('m-8')
    expect(res.rootId).toBe('m-1')
    expect(res.siblingIndex).toBe(8)
    expect(state.insertPayload).toMatchObject({
      conversationId: CONV,
      role: 'assistant',
      content: '改后的回答',
      turnOrdinal: 3,
      parentMessageId: 'm-1',
      siblingIndex: 8,
    })
    expect((state.insertPayload?.metadata as Record<string, unknown>).editedFromMessageId).toBe(
      'm-1',
    )
    // 原行零改动:覆写历史这条路仍然关着
    expect(state.updates.some((u) => 'content' in u)).toBe(false)
  })

  it('非 assistant 目标仍拒(not_assistant),且不开启事务、不落新行', async () => {
    state.target = assistantRow({ role: 'user' })
    await expect(
      editAiMessageAsVersion({ messageId: 'm-1', userId: 'u-1', content: 'x' }),
    ).rejects.toMatchObject({ code: 'not_assistant' })
    expect(state.events).not.toContain('transaction')
    expect(state.insertPayload).toBeNull()
  })
})
