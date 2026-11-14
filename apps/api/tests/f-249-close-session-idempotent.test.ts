// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-249 回归锁(2026-11-13):closeSession 重复关闭不得重复递减坐席负载。
 *
 * 病灶(修前):UPDATE 只按 session_id 定位、不判当前状态,关闭后再按历史 agentId
 * 递减一次;客户断开 → 重连 → 再断开,或坐席端与后台几乎同时关闭时,同一坐席
 * currentLoad 被反复 -1 至 0,可用坐席数虚高而超量派单,endedAt 也被覆盖失真。
 *
 * 本文件锁:
 *   ① 纯判据:UPDATE 命中 0 行 → 不递减;命中 1 行且有 agentId → 递减一次;
 *   ② 行为:closeSession 只在真正关闭(命中行)时才多发一条负载 UPDATE;
 *   ③ 源锁:closeSession 必须带 `status <> 'closed'` 与 RETURNING,
 *      且全文件负向 adjustAgentLoad 仅此一处(所有递减路径收敛到同一判据)。
 *
 * 零真实 PG/Redis:db/index 链式打桩,不连库。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const state = vi.hoisted(() => ({
  rows: [] as Array<Record<string, unknown>>,
  updateCalls: 0,
}))

vi.mock('../src/db/index.js', () => {
  const withSettlers = (step: Record<string, unknown>, resolver: () => unknown) => {
    step.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve().then(resolver).then(resolve, reject)
    step.catch = (reject?: (e: unknown) => void) => Promise.resolve().then(resolver).catch(reject)
    step.finally = (fn?: () => void) => Promise.resolve().then(resolver).finally(fn)
    return step
  }
  const chain = () => {
    const step: Record<string, unknown> = {}
    for (const m of ['set', 'where', 'returning', 'values', 'from', 'limit', 'orderBy']) {
      step[m] = vi.fn(() => step)
    }
    return withSettlers(step, () => state.rows)
  }
  const update = vi.fn(() => {
    state.updateCalls += 1
    return chain()
  })
  return {
    db: {
      update,
      select: vi.fn(() => chain()),
      insert: vi.fn(() => chain()),
      delete: vi.fn(() => chain()),
      execute: vi.fn(async () => []),
    },
    dbRead: { select: vi.fn(() => chain()) },
  }
})

import { closeSession, shouldDecrementAgentLoadOnClose } from '../src/db/customer-service-queries.js'

const sourcePath = fileURLToPath(new URL('../src/db/customer-service-queries.ts', import.meta.url))
const source = readFileSync(sourcePath, 'utf8')
const closeStart = source.indexOf('export async function closeSession')
const closeEnd = source.indexOf('\n}\n', closeStart)
const closeBody = source.slice(closeStart, closeEnd + 3)

beforeEach(() => {
  state.rows = []
  state.updateCalls = 0
})

describe('F-249 shouldDecrementAgentLoadOnClose 纯判据', () => {
  it('UPDATE 命中 0 行(已关闭/不存在)→ 不递减', () => {
    expect(shouldDecrementAgentLoadOnClose([])).toBe(false)
  })

  it('UPDATE 命中 1 行且有 agentId → 递减一次', () => {
    expect(shouldDecrementAgentLoadOnClose([{ agentId: 'agent-1' }])).toBe(true)
  })

  it('命中 1 行但未派单(agentId 为空)→ 不递减', () => {
    expect(shouldDecrementAgentLoadOnClose([{ agentId: null }])).toBe(false)
  })
})

describe('F-249 closeSession 行为:重复关闭不再递减', () => {
  it('真正关闭一次:状态 UPDATE + 负载 UPDATE(共 2 次)', async () => {
    state.rows = [{ agentId: 'agent-1', status: 'closed' }]
    const closed = await closeSession('sess-1')
    expect(closed?.status).toBe('closed')
    expect(state.updateCalls).toBe(2)
  })

  it('重复关闭:命中 0 行(已 closed)→ 只有状态 UPDATE,不递减', async () => {
    state.rows = [{ agentId: 'agent-1', status: 'closed' }]
    await closeSession('sess-1')
    state.updateCalls = 0
    state.rows = [] // 第二次 UPDATE 被 status <> 'closed' 挡住
    const again = await closeSession('sess-1')
    expect(again).toBeUndefined()
    expect(state.updateCalls).toBe(1)
  })
})

describe('F-249 源锁', () => {
  it("closeSession 的 UPDATE 必须带 status <> 'closed' 且 RETURNING", () => {
    expect(closeBody).toContain("<> 'closed'")
    expect(closeBody).toContain('.returning()')
  })

  it('关闭路径不再先查后减(findSessionBySessionId)', () => {
    expect(closeBody).not.toContain('findSessionBySessionId')
  })

  it('递减判据唯一:closeSession 走纯函数,全文件负向 adjustAgentLoad 仅 1 处', () => {
    expect(closeBody).toContain('shouldDecrementAgentLoadOnClose')
    const negativeDecrements = source.match(/adjustAgentLoad\([^)]*-\s*1\s*\)/g) ?? []
    expect(negativeDecrements).toHaveLength(1)
  })
})
