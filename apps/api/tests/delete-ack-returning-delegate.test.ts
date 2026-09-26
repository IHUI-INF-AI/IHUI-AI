// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 2026-09-27 第二十七批「删除 ack 的一跳委托」—— 逐体定性泳道的回归锁。
//
// 这一票的产出是**定性**而不是改写:`agents.ts:403 / :515 / :988` 与
// `admin-extended.ts:288` 四处 `deleted: true`,其委托函数
// (`deleteAgent` / `deleteCategory` / `deleteExamine`)的删除链**本身就带 RETURNING**,
// 返回值 `rows[0]` 是库侧对「这一行真被删了」的答复,不是删之前先 select 出来的那行。
// 所以四处已诚实,按作战书「来自库侧 ⇒ 不改它」处置。
//
// 但「已诚实」今天成立不等于明天成立:把它变成谎报的那次改动长这样 ——
//   const row = await db.select(...).where(...)      // 先查
//   if (!row) return undefined
//   await db.delete(...).where(...)                   // 再删,删除链的回报被丢弃
//   return row                                        // 把「删之前存在」当「删除命中」
// 签名一字不变(`Promise<Agent | undefined>`),typecheck 不红,守门 134 的布尔档也只报数不判红
// —— 而窗口期与「delete 未命中」都看不见。所以本锁钉的不是布尔,而是**证据的来源**:
// 返回值必须出自删除链自己的 returning(),且删除路径上不出现 select。

import { describe, it, expect, beforeEach, vi } from 'vitest'

// 只替 db 实例:表对象走真实 `@ihui/database`(drizzle 的 eq/and 需要真列,假列会炸)。
const state = vi.hoisted(() => ({
  rows: [] as Record<string, unknown>[],
  returningCalls: 0,
  deleteCalls: 0,
  selectCalls: 0,
}))

vi.mock('../src/db/index.js', () => {
  function createChain() {
    const chain: Record<string, unknown> = {}
    chain.then = (res: (v: unknown[]) => unknown, rej?: (e: unknown) => unknown) =>
      Promise.resolve(state.rows).then(res, rej)
    chain.where = () => chain
    chain.from = () => chain
    chain.limit = () => chain
    chain.orderBy = () => chain
    chain.values = () => chain
    chain.set = () => chain
    chain.returning = () => {
      state.returningCalls += 1
      return chain
    }
    return chain
  }
  const db = {
    execute: vi.fn().mockResolvedValue([]),
    delete: vi.fn(() => {
      state.deleteCalls += 1
      return createChain()
    }),
    select: vi.fn(() => {
      state.selectCalls += 1
      return createChain()
    }),
    update: vi.fn(() => createChain()),
    insert: vi.fn(() => createChain()),
  }
  return { db, dbRead: { ...db, select: db.select } }
})

const { deleteAgent, deleteCategory, deleteExamine } = await import('../src/db/agents-queries.js')

describe('deleteAgent / deleteCategory / deleteExamine 的返回值必须来自删除链的 RETURNING', () => {
  beforeEach(() => {
    state.rows = []
    state.returningCalls = 0
    state.deleteCalls = 0
    state.selectCalls = 0
  })

  const sites = [
    {
      name: 'deleteAgent(带 userId ⇒ where 含归属过滤)',
      call: () => deleteAgent('a-1', 'u-1'),
      row: { agentId: 'a-1', userId: 'u-1' },
    },
    {
      name: 'deleteCategory',
      call: () => deleteCategory('c-1'),
      row: { categoryId: 'c-1' },
    },
    {
      name: 'deleteExamine',
      call: () => deleteExamine('e-1'),
      row: { id: 'e-1' },
    },
  ]

  for (const site of sites) {
    describe(site.name, () => {
      it('删除链回报一行 → 返回该行(库侧确认命中)', async () => {
        state.rows = [site.row]
        await expect(site.call()).resolves.toEqual(site.row)
      })

      it('删除链回报空集合(删 0 行)→ undefined,不得凭空造出一行', async () => {
        state.rows = []
        await expect(site.call()).resolves.toBeUndefined()
      })

      it('证据取自 DELETE 链自己的 returning(),而不是删除前的 select', async () => {
        state.rows = [site.row]
        await site.call()
        expect(state.deleteCalls).toBe(1)
        // 这一条就是本锁的牙:改成「先 select 再 delete 并丢弃回报」时 returningCalls 会是 0。
        expect(state.returningCalls).toBe(1)
        expect(state.selectCalls).toBe(0)
      })
    })
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
