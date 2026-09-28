// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

// 第二十六批·续(本泳道 B27):删除 ack 的"一跳委托"清账 —— 委托函数必须把**库确认的命中集合**交回调用方。
//
// 这一把尺子量的是委托函数本身(路由那半见 delete-ack-b27-route-ack.test.ts):
// `deleteXxx()` 原来的形状是 `Promise<void>` —— 调用方拿不到任何回报,于是只能凭空写 `deleted: true`。
// 收口后的唯一形态是 `.delete().where().returning({ id })` → `rows.map(r => r.id)`,即
// **返回值必须取自 DELETE 链自己的 RETURNING**,删 0 行就交空数组。
//
// 夹具纪律(与 tests/oss-files-delete.test.ts、src/routes/__tests__/gen-table.test.ts 已入库的两处同形):
// 真 drizzle 的 `where()` 产物**既可 await 也可再 `.returning()`**;旧夹具只给 await 一侧,
// `.returning` 就是 undefined ⇒ 500,那是夹具比真库更弱,不是被测代码错。

import { describe, it, expect, beforeEach, vi } from 'vitest'

const USER_ID = '00000000-0000-4000-8000-000000000001'
const TEAM_ID = '22222222-2222-4222-8222-222222222222'
const ROW_ID = '11111111-1111-4111-8111-111111111111'

/**
 * 删除链的台账:
 * - `returningQueue` 每次 `where()` 交出一批"被删掉的那一行"(空数组 = 删 0 行)
 * - `deleteCalls` / `whereCalls` / `selectCalls` / `returningCalls` 用来证明
 *   证据路径只走 DELETE 链,不碰 select(碰了就是把"删除前查到过"当成"删除成功")
 */
const { chain } = vi.hoisted(() => ({
  chain: {
    returningQueue: [] as Array<Array<{ id: string }>>,
    deleteCalls: 0,
    whereCalls: 0,
    returningCalls: 0,
    selectCalls: 0,
  },
}))

vi.mock('../src/db/index.js', () => {
  const deleteFn = vi.fn(() => ({
    where: vi.fn(() => {
      chain.whereCalls += 1
      const settled = Promise.resolve(chain.returningQueue.shift() ?? [])
      return {
        returning: () => {
          chain.returningCalls += 1
          return settled
        },
        then: (res: (v: unknown) => void, rej?: (e: unknown) => void) => settled.then(res, rej),
      }
    }),
  }))
  const selectFn = vi.fn(() => {
    chain.selectCalls += 1
    // 删除确认的读源被抢跑 ⇒ 当场喊出来,不让它安静地变成"先查再删然后 return true"
    throw new Error('删除命中集合不得由 select 预查询伪造')
  })
  const db = {
    delete: (...args: unknown[]) => {
      chain.deleteCalls += 1
      return deleteFn(...args)
    },
    select: selectFn,
    update: vi.fn(),
    insert: vi.fn(),
    execute: vi.fn(),
  }
  return { db, dbRead: db, dbClient: {} }
})

import { deleteStatisticsSnapshot } from '../src/db/statistics-queries.js'
import { deleteTeam, removeTeamMember } from '../src/db/team-queries.js'
import { deleteFeedback } from '../src/db/comment-queries.js'
import { deleteCircle } from '../src/db/community-queries.js'
import { deleteTicket } from '../src/db/customer-service-queries.js'

/** 六处委托函数(签名收口后一律 `Promise<string[]>`)。 */
const DELEGATES: Array<{ name: string; call: () => Promise<string[]> }> = [
  {
    name: 'deleteStatisticsSnapshot(statistics-queries)',
    call: () => deleteStatisticsSnapshot(ROW_ID),
  },
  { name: 'deleteTeam(team-queries)', call: () => deleteTeam(TEAM_ID) },
  {
    name: 'removeTeamMember(team-queries,where 除 teamId 还带 userId)',
    call: () => removeTeamMember(TEAM_ID, USER_ID),
  },
  { name: 'deleteFeedback(comment-queries)', call: () => deleteFeedback(ROW_ID) },
  { name: 'deleteCircle(community-queries)', call: () => deleteCircle(ROW_ID) },
  { name: 'deleteTicket(customer-service-queries)', call: () => deleteTicket(ROW_ID) },
]

describe('一跳委托的删除函数必须回报库确认的命中集合', () => {
  beforeEach(() => {
    chain.returningQueue = []
    chain.deleteCalls = 0
    chain.whereCalls = 0
    chain.returningCalls = 0
    chain.selectCalls = 0
  })

  for (const site of DELEGATES) {
    describe(site.name, () => {
      it('DELETE 链回报一行 → 交出被删的那一行的 id', async () => {
        chain.returningQueue.push([{ id: ROW_ID }])
        expect(await site.call()).toEqual([ROW_ID])
      })

      it('DELETE 链回报空集合(删 0 行)→ 空数组,不得凭空造出命中', async () => {
        chain.returningQueue.push([])
        expect(await site.call()).toEqual([])
      })

      it('证据取自 DELETE 链自己的 returning(),整条路径不碰 select', async () => {
        chain.returningQueue.push([{ id: ROW_ID }])
        await site.call()
        expect(chain.deleteCalls).toBe(1)
        expect(chain.whereCalls).toBe(1)
        expect(chain.returningCalls).toBe(1)
        // 旧形态(先 select 判存在、再 delete 丢弃回报)正是靠这一步露形:一碰 select 就红。
        expect(chain.selectCalls).toBe(0)
      })
    })
  }
})
