// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 第二十八批(泳道 2/5):布尔写 ack 的键族从 `deleted` 扩到 `removed / restored / revoked / cleared`。
//
// 这一枚量的是**委托层**:`restoreFile` 原来返回 `Promise<void>` —— 它连"这次写命中了几行"
// 都不回报,所以路由那句 `restored: true` 是一张空支票(与同文件已修的 softDeleteFile 同形,
// 只是上一泳道的票面没盖到它)。现要求它交出 UPDATE ... RETURNING 命中的 id 集合。
//
// 夹具与真 drizzle 同形:`db.update().set().where()` 的产物**既可 await 也可再 .returning()**,
// 队列交出的是"被处理的那一行",空队列 = 恢复 0 行(旧夹具喂空集合 = 替谎报打掩护)。
// 判据只走 UPDATE 链自己的 returning();select 预查询一旦出现在这条路上就当场喊出来 ——
// 那等于把"改之前读到过"当成"改到了"。

import { describe, it, expect, beforeEach, vi } from 'vitest'

const USER_ID = '00000000-0000-4000-8000-000000000001'
const ROW_ID = '11111111-1111-4111-8111-111111111111'

const { chain } = vi.hoisted(() => ({
  chain: {
    /** 每次 `where()` 交出一批"被这次 UPDATE 命中的行"(空数组 = 恢复 0 行)。 */
    returningQueue: [] as Array<Array<{ id: string }>>,
    updateCalls: 0,
    setCalls: 0,
    whereCalls: 0,
    returningCalls: 0,
    selectCalls: 0,
  },
}))

vi.mock('../src/db/index.js', () => {
  const whereProduct = () => {
    chain.whereCalls += 1
    const settled = Promise.resolve(chain.returningQueue.shift() ?? [])
    return {
      returning: () => {
        chain.returningCalls += 1
        return settled
      },
      // 同形:不接 .returning() 的直接 await 也要能跑(真 drizzle 两种都是 thenable)。
      then: (res: (v: unknown) => void, rej?: (e: unknown) => void) => settled.then(res, rej),
    }
  }
  const db = {
    update: () => {
      chain.updateCalls += 1
      return {
        set: () => {
          chain.setCalls += 1
          return { where: whereProduct }
        },
      }
    },
    select: () => {
      chain.selectCalls += 1
      throw new Error('恢复命中集合不得由 select 预查询伪造')
    },
    insert: vi.fn(),
    delete: vi.fn(),
    execute: vi.fn(),
  }
  return { db, dbRead: db, dbClient: {} }
})

import { restoreFile } from '../src/db/workspace-queries.js'

describe('restoreFile 必须回报库确认的命中集合(而非 void)', () => {
  beforeEach(() => {
    chain.returningQueue = []
    chain.updateCalls = 0
    chain.setCalls = 0
    chain.whereCalls = 0
    chain.returningCalls = 0
    chain.selectCalls = 0
  })

  it('UPDATE 链回报命中一行 → 交出被恢复的那一行的 id', async () => {
    chain.returningQueue.push([{ id: ROW_ID }])
    await expect(restoreFile(ROW_ID)).resolves.toEqual([ROW_ID])
    expect(chain.updateCalls).toBe(1)
    expect(chain.whereCalls).toBe(1)
    expect(chain.returningCalls).toBe(1)
  })

  it('UPDATE 链回报空集合(恢复 0 行)→ 空数组,不得凭空造出命中', async () => {
    chain.returningQueue.push([])
    await expect(restoreFile(USER_ID)).resolves.toEqual([])
    expect(chain.returningCalls).toBe(1)
  })

  it('证据取自 UPDATE 链自己的 returning(),整条路径不碰 select', async () => {
    chain.returningQueue.push([{ id: ROW_ID }])
    await restoreFile(ROW_ID)
    expect(chain.selectCalls).toBe(0)
    expect(chain.setCalls).toBe(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
