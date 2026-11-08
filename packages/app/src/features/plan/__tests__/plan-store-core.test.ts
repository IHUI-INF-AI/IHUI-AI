// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

//
// XUI-029:水合读取/解析失败时不得把内存空列表写回,否则会覆盖原计划数据。
import { describe, expect, it, vi } from 'vitest'
import { createPlanLocalStore, type PlanStorage } from '../plan-store-core'

function makeStorage(initial: string | null) {
  const setItem = vi.fn(async () => undefined)
  const getItem = vi.fn(async () => initial)
  return { storage: { getItem, setItem } as PlanStorage, setItem, getItem }
}

const input = { title: '新计划', goal: '目标', scope: '范围', constraints: [], steps: [] }

describe('XUI-029 plan store 水合失败保护', () => {
  it('JSON 损坏 → 不落盘覆盖,内存写入只留在内存', async () => {
    const { storage, setItem } = makeStorage('{ broken json')
    const store = createPlanLocalStore({ storage })
    await store.hydrate()
    store.create(input)
    await Promise.resolve()
    expect(store.getSnapshot().length).toBe(1)
    expect(setItem).not.toHaveBeenCalled()
  })

  it('结构非法(plans 非数组)→ 同样按失败处理,不落盘', async () => {
    const { storage, setItem } = makeStorage(JSON.stringify({ plans: 'oops' }))
    const store = createPlanLocalStore({ storage })
    await store.hydrate()
    store.create(input)
    await Promise.resolve()
    expect(setItem).not.toHaveBeenCalled()
  })

  it('阴性对照:首次使用(null)可正常水合并持久化', async () => {
    const { storage, setItem } = makeStorage(null)
    const store = createPlanLocalStore({ storage })
    await store.hydrate()
    store.create(input)
    await Promise.resolve()
    expect(setItem).toHaveBeenCalledTimes(1)
  })

  it('阴性对照:合法 plans 正常读回', async () => {
    const plan = {
      id: 'p-1',
      title: '旧计划',
      goal: 'g',
      scope: 's',
      constraints: [],
      steps: [],
      status: 'draft',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }
    const { storage } = makeStorage(JSON.stringify({ plans: [plan] }))
    const store = createPlanLocalStore({ storage })
    await store.hydrate()
    expect(store.getSnapshot().map((p) => p.id)).toEqual(['p-1'])
  })
})
