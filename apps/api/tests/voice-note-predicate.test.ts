// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SQLWrapper } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'

const dialect = new PgDialect()

/**
 * D43 第②格(语音笔记落库)的谓词锁 —— 零连接档(与 notifications-archive-partition.test.ts 同款
 * 链式假 db):这里判的是"这条 where / set 究竟长什么样",不是"函数跑没跑通"。
 *
 * ① 归属维 user_id 必须与 id 同时在场:只按 id 写就是拿别人的笔记做状态迁移;
 * ② 关键词检索必须真的进 SQL 谓词(ilike title/transcript),而不是把整桶拉到前端 filter ——
 *    后者命中与否取决于本地恰好存了多少条,是假检索;
 * ③ 归档写时刻、恢复写 null(归档是可撤销状态,不是删除的副产品);
 * ④ 空 PATCH 不得动 updated_at(否则"什么都没改"把行的时序语义洗掉);
 * ⑤ 删除以 .returning 回库确认集合,不把请求侧长度当 affected。
 */
const state = vi.hoisted(() => ({
  wheres: [] as unknown[],
  sets: [] as Record<string, unknown>[],
  rows: [] as unknown[],
  counts: [{ total: 0 }] as { total: number }[],
  deletes: 0,
  inserts: [] as Record<string, unknown>[],
}))

function makeApi(kind: 'list' | 'count' | 'update' | 'delete' | 'insert') {
  const api: Record<string, unknown> = {
    from: () => api,
    orderBy: () => api,
    groupBy: () => api,
    limit: () => api,
    offset: () => api,
    values: (v: Record<string, unknown>) => {
      if (kind === 'insert') state.inserts.push(v)
      return api
    },
    where: (w: unknown) => {
      state.wheres.push(w)
      return api
    },
    set: (v: Record<string, unknown>) => {
      if (kind === 'update') state.sets.push(v)
      return api
    },
    returning: () => {
      if (kind === 'delete') state.deletes += 1
      return Promise.resolve(state.rows)
    },
    then: (res?: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
      Promise.resolve(kind === 'count' ? state.counts : state.rows).then(res, rej),
  }
  return api
}

vi.mock('../src/db/index.js', () => ({
  db: {
    select: (shape?: unknown) =>
      makeApi(shape && typeof shape === 'object' && 'total' in shape ? 'count' : 'list'),
    update: () => makeApi('update'),
    delete: () => makeApi('delete'),
    insert: () => makeApi('insert'),
  },
}))

/**
 * 谓词渲染口径唯一:交给 PgDizzle 的方言器 —— drizzle 0.45 的 SQL 片段没有 toSQL(),
 * 而"取不到就返回空串"会让整组断言静默通过(判据失明比红更糟),所以取不到必须显式报错。
 */
function render(condition: unknown): { sql: string; params: unknown[] } {
  const wrapper = condition as SQLWrapper | undefined
  if (!wrapper || typeof wrapper.getSQL !== 'function') {
    throw new Error('where 片段取不到 getSQL ⇒ 判据失效方向必须是显式报错,而不是静默通过')
  }
  const q = dialect.sqlToQuery(wrapper.getSQL())
  return { sql: q.sql, params: q.params as unknown[] }
}

const { createVoiceNote, deleteVoiceNotes, listVoiceNotes, setVoiceNoteArchived, updateVoiceNote } =
  await import('../src/db/voice-note-queries.js')

const USER = '11111111-1111-4111-8111-111111111111'
const NOTE_ID = '22222222-2222-4222-8222-222222222222'

function allSqlText(): string {
  return state.wheres.map((w) => render(w).sql).join('\n')
}

function allParams(): unknown[] {
  return state.wheres.flatMap((w) => render(w).params)
}

beforeEach(() => {
  state.wheres.length = 0
  state.sets.length = 0
  state.inserts.length = 0
  state.rows.length = 0
  state.counts[0] = { total: 0 }
  state.deletes = 0
})

describe('语音笔记查询层的归属与谓词形状', () => {
  it('列表:归属维恒在;带 q 时检索落在 SQL 谓词上而不是前端过滤', async () => {
    await listVoiceNotes(USER, { page: 1, pageSize: 20, q: '100%' })
    const text = allSqlText()
    expect(text).toContain('user_id')
    expect(text).toMatch(/ilike/i)
    expect(text).toContain('title')
    expect(text).toContain('transcript')
    // 关键词里的 % 必须转义成字面量(它走参数,不在 SQL 文本里):否则"搜 100%"命中一切
    expect(allParams().some((p) => typeof p === 'string' && p.includes('\\%'))).toBe(true)
  })

  it('归档分区:缺省 active 走 is null,archived 走 is not null(默认视图混入归档=没归档)', async () => {
    await listVoiceNotes(USER, { page: 1, pageSize: 20 })
    expect(allSqlText()).toMatch(/is null/i)
    state.wheres.length = 0
    await listVoiceNotes(USER, { page: 1, pageSize: 20, partition: 'archived' })
    expect(allSqlText()).toMatch(/is not null/i)
  })

  it('归档/恢复:必须同时按 user_id 与 id 命中;set 分别是时刻与 null', async () => {
    state.rows = [voiceNoteRow()]
    const archived = await setVoiceNoteArchived(USER, NOTE_ID, true)
    expect(allSqlText()).toContain('user_id')
    expect(allSqlText()).toContain('id')
    expect(state.sets[0]).toHaveProperty('archivedAt')
    expect(state.sets[0]?.archivedAt).toBeInstanceOf(Date)

    state.wheres.length = 0
    state.sets.length = 0
    // 恢复的前提是"当下确实归档着" —— 夹具喂一行带 archivedAt 的现值
    state.rows = [{ ...voiceNoteRow(), archivedAt: new Date() }]
    await setVoiceNoteArchived(USER, NOTE_ID, false)
    expect(state.sets[0]?.archivedAt).toBe(null)
    expect(archived?.id).toBe(NOTE_ID)
  })

  it('幂等重复(已归档再归档 / 未归档再恢复)⇒ 零 UPDATE、不盖 updated_at', async () => {
    state.rows = [{ ...voiceNoteRow(), archivedAt: new Date() }]
    state.sets.length = 0
    const again = await setVoiceNoteArchived(USER, NOTE_ID, true)
    expect(state.sets.length).toBe(0)
    expect(again?.id).toBe(NOTE_ID)

    state.rows = [{ ...voiceNoteRow(), archivedAt: null }]
    await setVoiceNoteArchived(USER, NOTE_ID, false)
    expect(state.sets.length).toBe(0)
  })

  it('空 PATCH 不动 updated_at、不发 update(否则"没改"也洗了时序)', async () => {
    state.rows = []
    const result = await updateVoiceNote(USER, NOTE_ID, {})
    expect(state.sets.length).toBe(0)
    expect(result).toBe(null)
  })

  it('同值 PATCH(把分组改成它本来的值)⇒ 零 UPDATE:门 198 的盲写形态就死在这一格', async () => {
    state.rows = [voiceNoteRow()]
    state.sets.length = 0
    const same = await updateVoiceNote(USER, NOTE_ID, { groupKey: 'inbox' })
    expect(state.sets.length).toBe(0)
    expect(same?.groupKey).toBe('inbox')
  })

  it('带字段的 PATCH:set 含 updated_at 且谓词含 user_id', async () => {
    state.rows = [voiceNoteRow()]
    await updateVoiceNote(USER, NOTE_ID, { groupKey: 'lectures' })
    expect(state.sets[0]).toMatchObject({ groupKey: 'lectures' })
    expect(state.sets[0]).toHaveProperty('updatedAt')
    expect(allSqlText()).toContain('user_id')
  })

  it('删除:空集合直接返回,不发查询;非空以 returning 回库确认命中集合', async () => {
    const empty = await deleteVoiceNotes(USER, [])
    expect(empty.deletedIds).toEqual([])
    expect(state.deletes).toBe(0)

    state.rows = [{ id: NOTE_ID }]
    const hit = await deleteVoiceNotes(USER, [NOTE_ID, NOTE_ID])
    expect(hit.deletedIds).toEqual([NOTE_ID])
    expect(state.deletes).toBe(1)
  })

  it('新建:归属由入参写进 values,不给客户端自报的机会', async () => {
    state.rows = [voiceNoteRow()]
    const created = await createVoiceNote(USER, { title: '例会纪要', durationMs: 1200 })
    expect(state.inserts[0]).toMatchObject({ userId: USER, title: '例会纪要', groupKey: 'inbox' })
    expect(created?.id).toBe(NOTE_ID)
  })
})

/** 服务端行的最小形状(时间戳用 Date,与 drizzle 的 timestamptz 读回一致)。 */
function voiceNoteRow() {
  return {
    id: NOTE_ID,
    userId: USER,
    conversationId: null,
    title: '例会纪要',
    transcript: '内容',
    durationMs: 1200,
    audioUrl: null,
    groupKey: 'inbox',
    archivedAt: null,
    createdAt: new Date('2026-10-18T06:00:00Z'),
    updatedAt: new Date('2026-10-18T06:00:00Z'),
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
