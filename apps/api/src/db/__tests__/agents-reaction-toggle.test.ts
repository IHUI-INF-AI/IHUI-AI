// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-80 回归(2026-11-13):点赞/收藏切换必须是**单事务 + 同键串行**,
 * 删除必须按**实际删行数**递减计数。
 *
 * 改前必红口径:
 *  - 路由先 `findThumb` 再 `addThumb/removeThumb`,三段各自独立连接,并发双击双插双 +1;
 *  - `removeThumb` 删掉全部同键行却固定 `-1`,历史重复行让计数永久漂移。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const state = vi.hoisted(() => ({
  deletedRows: [] as Array<{ id: string }>,
  exec: [] as unknown[],
  inserted: [] as unknown[],
  updates: [] as Array<{ values: Record<string, unknown> }>,
  transactions: 0,
}))

vi.mock('../index.js', () => {
  const tx = {
    execute: async (q: unknown) => {
      state.exec.push(q)
    },
    delete: () => ({
      where: () => ({
        returning: async () => state.deletedRows,
      }),
    }),
    insert: () => ({
      values: async (v: unknown) => {
        state.inserted.push(v)
        return []
      },
    }),
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: async () => {
          state.updates.push({ values })
          return []
        },
      }),
    }),
  }
  const db = {
    transaction: async (fn: (t: unknown) => unknown) => {
      state.transactions += 1
      return fn(tx)
    },
  }
  return {
    db,
    dbRead: {
      select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }),
    },
  }
})

import { toggleThumb, toggleCollect } from '../agents-queries.js'

/** 取出 drizzle SQL 片段里的绑定参数(0.45 直接内联原始值,Param 包一层则取 value)。 */
function paramsOf(value: unknown): unknown[] {
  const out: unknown[] = []
  const walk = (v: unknown): void => {
    if (typeof v === 'number' || typeof v === 'boolean') {
      out.push(v)
      return
    }
    if (!v || typeof v !== 'object') return
    const chunk = v as { queryChunks?: unknown[]; value?: unknown }
    if (!chunk.queryChunks) {
      if ('value' in chunk) walk(chunk.value)
      return
    }
    chunk.queryChunks.forEach(walk)
  }
  walk(value)
  return out
}

/** 取唯一一次 update 的 values(未发生即判失败,不做非空断言)。 */
function onlyUpdateValues(): Record<string, unknown> {
  const first = state.updates[0]
  if (!first) throw new Error('未记录到 update')
  return first.values
}

beforeEach(() => {
  state.deletedRows = []
  state.exec = []
  state.inserted = []
  state.updates = []
  state.transactions = 0
})

describe('F-80 点赞/收藏切换的原子性', () => {
  it('无既有行:同一事务内插入明细并递增 likeCount', async () => {
    await expect(toggleThumb('u1', 'b1')).resolves.toBe(true)
    expect(state.transactions).toBe(1)
    expect(state.exec).toHaveLength(1)
    expect(state.inserted).toEqual([{ uuid: 'u1', botId: 'b1' }])
    expect(state.updates).toHaveLength(1)
    expect(Object.keys(onlyUpdateValues())).toContain('likeCount')
  })

  it('有既有行:不插入,并按实际删行数递减(历史重复 2 行就减 2)', async () => {
    state.deletedRows = [{ id: 'a' }, { id: 'b' }]
    await expect(toggleThumb('u1', 'b1')).resolves.toBe(false)
    expect(state.transactions).toBe(1)
    expect(state.inserted).toHaveLength(0)
    expect(state.updates).toHaveLength(1)
    expect(paramsOf(onlyUpdateValues().likeCount)).toContain(2)
  })

  it('收藏走独立事务与 collectCount,锁键不得与点赞共用', async () => {
    await expect(toggleCollect('u1', 'b1')).resolves.toBe(true)
    expect(state.transactions).toBe(1)
    expect(state.updates).toHaveLength(1)
    expect(Object.keys(onlyUpdateValues())).toContain('collectCount')
    expect(state.exec).toHaveLength(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
