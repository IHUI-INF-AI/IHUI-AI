// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { beforeEach, describe, expect, it, vi } from 'vitest'

// 票64(消息级 pin/书签 + AI 消息可编辑)的库表层判据锁(零连接档:链式假 db)。
// 判的都是"这一步究竟写了什么",不是"函数跑没跑通":
//  ① 标记只认给到的维度 —— 只改钉选时,收藏列不得被顺手清掉(空补丁连 UPDATE 都不发);
//  ② 编辑 AI 消息必须落**新 sibling**,原行零改动(覆写就把可回退的多版本抹成单点历史);
//  ③ root 首次入族补 0,序号 = 族内最大 + 1(与票59 的 regenerate 同一族规则);
//  ④ 非 assistant 与跨会话目标必须拒(角色不符是输入错 400,不是服务端 500)。
const state = vi.hoisted(() => ({
  updates: [] as { set: Record<string, unknown>; whereSql: string }[],
  inserts: [] as Record<string, unknown>[],
  selects: [] as { whereSql: string }[],
  messageRows: [] as unknown[],
  familyRows: [] as { siblingIndex: number | null }[],
}))

vi.mock('../src/db/index.js', async () => {
  const { PgDialect } = await import('drizzle-orm/pg-core')
  const dialect = new PgDialect()
  const sqlOf = (w: unknown): string => {
    const wrapper = w as { getSQL?: () => unknown }
    if (typeof wrapper?.getSQL !== 'function') return ''
    // 与门 71/161 同一渲染口径:片段交 PgDialect 出串,端内不自己拼。
    return dialect.sqlToQuery(wrapper.getSQL() as never).sql
  }
  function chain(kind: 'selectRows' | 'selectFamily' | 'update' | 'insert') {
    const holder: { set?: Record<string, unknown>; where?: unknown } = {}
    const api: Record<string, unknown> = {
      from: () => api,
      where: (w: unknown) => {
        holder.where = w
        if (kind === 'selectRows' || kind === 'selectFamily')
          state.selects.push({ whereSql: sqlOf(w) })
        else state.updates.push({ set: holder.set ?? {}, whereSql: sqlOf(w) })
        return api
      },
      set: (v: Record<string, unknown>) => {
        holder.set = v
        return api
      },
      values: (v: Record<string, unknown>) => {
        holder.set = v
        return api
      },
      orderBy: () => api,
      innerJoin: () => api,
      leftJoin: () => api,
      limit: () => api,
      offset: () => api,
      returning: () => {
        if (kind === 'insert') {
          const row = state.insertRow ?? {}
          // 断言要看的是**递给库的载荷**(holder.set),罐头行只是库的回执
          state.inserts.push({ ...(holder.set ?? {}) })
          return Promise.resolve([row])
        }
        return Promise.resolve(state.updateResult ?? [])
      },
      then: (res?: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => {
        const payload =
          kind === 'selectFamily'
            ? state.familyRows
            : kind === 'selectRows'
              ? state.messageRows
              : (state.updateResult ?? [])
        return Promise.resolve(payload).then(res, rej)
      },
    }
    return api
  }
  return {
    db: {
      select: (shape?: Record<string, unknown>) =>
        chain(shape && 'siblingIndex' in shape ? 'selectFamily' : 'selectRows'),
      update: () => chain('update'),
      insert: () => chain('insert'),
    },
  }
})

import { editAiMessageAsVersion, setMessageFlags } from '../src/db/chat-queries.js'

function assistantRow(over: Record<string, unknown> = {}) {
  return {
    id: 'm-1',
    conversationId: 'c-1',
    role: 'assistant',
    content: '原回答',
    reasoning: null,
    turnOrdinal: 3,
    parentMessageId: null,
    siblingIndex: null,
    metadata: { model: 'gpt-x' },
    ...over,
  }
}

beforeEach(() => {
  state.updates.length = 0
  state.inserts.length = 0
  state.selects.length = 0
  state.messageRows = [assistantRow()]
  state.familyRows = [{ siblingIndex: 0 }]
  state.updateResult = [assistantRow()]
  state.insertRow = assistantRow({ id: 'm-2', siblingIndex: 1, parentMessageId: 'm-1' })
})

describe('票64 setMessageFlags', () => {
  it('只给 pinned=true ⇒ 写 pinned_at 时刻,收藏列不出现在 SET 里', async () => {
    await setMessageFlags({ messageId: 'm-1', userId: 'u-1', pinned: true })
    expect(state.updates.length).toBe(1)
    const set = state.updates[0]?.set ?? {}
    expect(set.pinnedAt).toBeInstanceOf(Date)
    expect('bookmarkedAt' in set).toBe(false)
    expect(state.updates[0]?.whereSql).toContain('"id"')
  })

  it('pinned=false ⇒ 显式写 null(撤销态不是"少写一个字段")', async () => {
    await setMessageFlags({ messageId: 'm-1', userId: 'u-1', pinned: false })
    expect(state.updates[0]?.set).toEqual({ pinnedAt: null })
  })

  it('两个维度都给 ⇒ 一次 UPDATE 同时落(不发第二条)', async () => {
    await setMessageFlags({ messageId: 'm-1', userId: 'u-1', pinned: true, bookmarked: true })
    expect(state.updates.length).toBe(1)
    const set = state.updates[0]?.set ?? {}
    expect(set.pinnedAt).toBeInstanceOf(Date)
    expect(set.bookmarkedAt).toBeInstanceOf(Date)
  })

  it('阳性对照:一个维度都不给 ⇒ 零 UPDATE、只回读(空 body 不得被读成"两把都清")', async () => {
    const before = state.updates.length
    const got = await setMessageFlags({ messageId: 'm-1', userId: 'u-1' })
    expect(state.updates.length).toBe(before)
    expect(got).toMatchObject({ id: 'm-1' })
  })

  it('归属预查询判不出主体 ⇒ undefined 且零 UPDATE(别人的消息改不动,也不报错遮成"成功")', async () => {
    state.messageRows = []
    const got = await setMessageFlags({ messageId: 'm-1', userId: 'u-other', pinned: true })
    expect(got).toBeUndefined()
    expect(state.updates.length).toBe(0)
  })
})

describe('票64 editAiMessageAsVersion', () => {
  it('编辑落新行:原行零改动,新行带 rootId/next 序号与编辑来源', async () => {
    const res = await editAiMessageAsVersion({
      messageId: 'm-1',
      userId: 'u-1',
      content: '改后的回答',
    })
    // root 自身补 0(唯一一次 UPDATE 落在 sibling_index 上,不是 content)
    const rootMark = state.updates.find((u) => 'siblingIndex' in u.set)
    expect(rootMark?.set).toEqual({ siblingIndex: 0 })
    expect(state.inserts.length).toBe(1)
    const inserted = state.inserts[0] ?? {}
    expect(inserted).toMatchObject({
      role: 'assistant',
      content: '改后的回答',
      parentMessageId: 'm-1',
      siblingIndex: 1,
      conversationId: 'c-1',
      turnOrdinal: 3,
    })
    expect((inserted.metadata as Record<string, unknown>).editedFromMessageId).toBe('m-1')
    // 原行的 content 从未被写过 ⇒ 覆写历史这条路是关着的
    expect(state.updates.some((u) => 'content' in u.set)).toBe(false)
    expect(res.rootId).toBe('m-1')
    expect(res.siblingIndex).toBe(1)
  })

  it('序号取族内最大值 +1(不是数组长度,乱序也不撞号)', async () => {
    state.familyRows = [{ siblingIndex: 0 }, { siblingIndex: 7 }, { siblingIndex: null }]
    const res = await editAiMessageAsVersion({
      messageId: 'm-1',
      userId: 'u-1',
      content: 'x',
    })
    expect(res.siblingIndex).toBe(8)
  })

  it('归属预查询判不出主体 ⇒ 抛 not_found(库层先问主人,不是拿会话 id 反推),且不落任何行', async () => {
    state.messageRows = []
    await expect(
      editAiMessageAsVersion({ messageId: 'm-1', userId: 'u-1', content: 'x' }),
    ).rejects.toMatchObject({ code: 'not_found' })
    expect(state.inserts.length).toBe(0)
    expect(state.updates.length).toBe(0)
  })

  it('非 AI 消息 ⇒ 明确拒(用户消息走既有的编辑重跑,两格不混),且不落任何行', async () => {
    state.messageRows = [assistantRow({ role: 'user' })]
    await expect(
      editAiMessageAsVersion({ messageId: 'm-1', userId: 'u-1', content: 'x' }),
    ).rejects.toMatchObject({ code: 'not_assistant' })
    expect(state.inserts.length).toBe(0)
    expect(state.updates.length).toBe(0)
  })

  it('目标自身已是再生版本 ⇒ root 取其 parentMessageId,序号挂到根上', async () => {
    state.messageRows = [assistantRow({ parentMessageId: 'root-9', siblingIndex: 2 })]
    state.insertRow = assistantRow({ id: 'm-3', parentMessageId: 'root-9', siblingIndex: 3 })
    const res = await editAiMessageAsVersion({
      messageId: 'm-1',
      userId: 'u-1',
      content: 'x',
    })
    expect(res.rootId).toBe('root-9')
    expect(state.inserts[0]).toMatchObject({ parentMessageId: 'root-9' })
    // root 已标记过 ⇒ 不该再发一次 siblingIndex=0 的写(幂等)
    expect(state.updates.some((u) => 'siblingIndex' in u.set)).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
