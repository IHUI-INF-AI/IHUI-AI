// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * D165 会话分组的数据访问判据(2026-10-01 立)。
 *
 * 只测这一层真正能被本机证明的两件事,不假装测了 HTTP:
 *  ① 目标分组不属于本人 ⇒ **整笔拒发**,一条 UPDATE 都不许出去
 *     (AGENTS §5:越权用例必须断言"未发出查询",只断错误码会放过"先改了再抛错");
 *  ② 批量移动回报的是**库确认集** ⇒ 没命中的 id 逐条落 missedIds,
 *     而不是把请求数组长度当 affected(守门 134 那一族:"改 0 行"与"改成功"同形)。
 */

const calls: string[] = []
const whereArgs: unknown[] = []

const CHAIN_METHODS = [
  'from',
  'where',
  'set',
  'values',
  'returning',
  'limit',
  'orderBy',
  'onConflictDoNothing',
  'innerJoin',
  'leftJoin',
] as const

function chain(result: unknown): unknown {
  const node: Record<string, unknown> = {}
  for (const m of CHAIN_METHODS) {
    node[m] = (arg: unknown) => {
      calls.push(m)
      if (m === 'where') whereArgs.push(arg)
      return node
    }
  }
  node.then = (resolve: (v: unknown) => unknown) => resolve(result)
  return node
}

const db = {
  select: (proj: unknown) => {
    calls.push('select')
    void proj
    return chain(db.nextRows)
  },
  update: (t: unknown) => {
    calls.push('update')
    void t
    return chain(db.nextRows)
  },
  insert: (t: unknown) => {
    calls.push('insert')
    void t
    return chain(db.nextRows)
  },
  delete: (t: unknown) => {
    calls.push('delete')
    void t
    return chain(db.nextRows)
  },
  nextRows: [] as unknown[],
}

vi.mock('../src/db/index.js', () => ({ db }))

const { moveConversationsToGroup, createConversationGroup } =
  await import('../src/db/chat-group-queries.js')

beforeEach(() => {
  calls.length = 0
  whereArgs.length = 0
  db.nextRows = []
})

describe('moveConversationsToGroup', () => {
  it('G1 目标分组不属于本人 ⇒ 整笔拒发,一条 UPDATE 都不发出', async () => {
    db.nextRows = [] // 分组归属查询 0 命中
    await expect(
      moveConversationsToGroup('user-1', ['c-1', 'c-2'], 'other-users-group'),
    ).rejects.toThrow('group_not_owned')
    expect(calls).not.toContain('update')
  })

  it('G2 回报取库确认集:2 请求 1 命中 ⇒ affected=1 且 missedIds 点名未命中的那条', async () => {
    // 第一次 select = 目标分组存在且属本人;update.returning 只回一条
    let selectCalls = 0
    db.select = ((proj: unknown) => {
      calls.push('select')
      void proj
      selectCalls += 1
      return chain(selectCalls === 1 ? [{ id: 'g-1' }] : [])
    }) as typeof db.select
    db.nextRows = [{ id: 'c-1' }]

    const r = await moveConversationsToGroup('user-1', ['c-1', 'c-2'], 'g-1')
    expect(r.affected).toBe(1)
    expect(r.missedIds).toEqual(['c-2'])
    expect(calls).toContain('update')
  })

  it('G3 移出分组(groupId=null)不做归属预查,但仍只认库确认集', async () => {
    db.nextRows = [{ id: 'c-1' }, { id: 'c-2' }]
    const r = await moveConversationsToGroup('user-1', ['c-1', 'c-2', 'c-2'], null)
    expect(calls.filter((c) => c === 'select')).toHaveLength(0)
    expect(r.affected).toBe(2)
    expect(r.requestedIds).toEqual(['c-1', 'c-2']) // 请求侧重复被去掉,不虚报份数
    expect(r.missedIds).toEqual([])
  })

  it('G4 空请求 ⇒ 不发出任何写,也不虚报 affected', async () => {
    const r = await moveConversationsToGroup('user-1', [], null)
    expect(r).toEqual({ requestedIds: [], affected: 0, missedIds: [] })
    expect(calls).not.toContain('update')
  })
})

describe('createConversationGroup', () => {
  it('G5 同名冲突走幂等出口:回已有那条并标 created=false,不抛"已存在"', async () => {
    let selectCalls = 0
    db.select = ((proj: unknown) => {
      calls.push('select')
      void proj
      selectCalls += 1
      return chain(selectCalls === 1 ? [{ id: 'g-9', name: '项目', pinned: false }] : [])
    }) as typeof db.select
    db.nextRows = [] // insert ... onConflictDoNothing().returning() 空 ⇒ 说明撞了唯一约束
    const r = await createConversationGroup('user-1', '项目')
    expect(r).toEqual({ id: 'g-9', name: '项目', pinned: false, created: false })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
