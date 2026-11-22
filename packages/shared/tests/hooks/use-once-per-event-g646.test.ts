// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 跨端 useOncePerEvent hook 测试(G-646:"申请占用"与"提交事实"两态分离)
 *
 * 覆盖范围:
 * 1. 票面成对验收用例:
 *    - claim 后崩溃 ⇒ 下次仍会弹(claim 不写持久游标,内存占用随进程死亡消失)
 *    - commit 后重放 ⇒ 不重复弹(consumed 游标已落盘)
 * 2. 两态分离语义:claim 不落盘 / commit 才落盘 / commit 失败不构成消费
 * 3. 游标状态机:会话内占用防重、幂等 commit、并发 commit 不丢更新、hydrate 合并
 * 4. 工厂 API 契约(与 use-storage.test.ts 同款约定:本包无 jsdom,不渲染 hook)
 * 5. 与 createJsonStorage 组合的真实持久化路径端到端
 */
import { describe, it, expect } from 'vitest'
import {
  createOncePerEventCore,
  createUseOncePerEvent,
  type OncePerEventStore,
} from '../../src/hooks/use-once-per-event'
import { createJsonStorage } from '../../src/utils/storage'
import { createMemoryTransport } from '../../src/stores/transport'

/** 内存版 OncePerEventStore:持久状态跨"会话"(core 实例)存活,模拟真实落盘 */
function createMemoryOnceStore(initial: readonly string[] = []) {
  const calls = { get: 0, set: 0 }
  let data: string[] | null = initial.length > 0 ? [...initial] : null
  const store: OncePerEventStore = {
    async getConsumed() {
      calls.get += 1
      return data === null ? null : [...data]
    },
    async setConsumed(keys) {
      calls.set += 1
      data = [...keys]
    },
  }
  return { store, calls }
}

// ========== 1. 票面成对验收用例 ==========
describe('G-646 票面成对验收用例', () => {
  it('claim 后崩溃 ⇒ 下次仍会弹(claim 不写持久游标)', async () => {
    const { store, calls } = createMemoryOnceStore()
    const session1 = createOncePerEventCore(store)
    await session1.hydrate()
    expect(session1.isReady()).toBe(true)
    expect(session1.claim('evt.welcome')).toBe(true)
    // 两态分离的本质:claim 只申请占用,持久游标纹丝不动
    expect(calls.set).toBe(0)

    // —— 崩溃:进程死亡,内存占用消失;持久层原样 ——
    const session2 = createOncePerEventCore(store)
    await session2.hydrate()
    expect(session2.isConsumed('evt.welcome')).toBe(false)
    expect(session2.claim('evt.welcome')).toBe(true) // 下次仍会弹
  })

  it('commit 后重放 ⇒ 不重复弹(consumed 游标已落盘)', async () => {
    const { store } = createMemoryOnceStore()
    const session1 = createOncePerEventCore(store)
    await session1.hydrate()
    expect(session1.claim('evt.badge')).toBe(true)
    // 候选复核后提交事实:此刻才写 consumed 游标
    await session1.commit('evt.badge')

    // —— 重放:新会话从持久层 hydrate ——
    const session2 = createOncePerEventCore(store)
    await session2.hydrate()
    expect(session2.isConsumed('evt.badge')).toBe(true)
    expect(session2.claim('evt.badge')).toBe(false) // 不重复弹
  })
})

// ========== 2. 两态分离语义 ==========
describe('两态分离:claim ≠ 已消费,commit 才构成消费事实', () => {
  it('claim 多次只占用一次,且始终不落盘', async () => {
    const { store, calls } = createMemoryOnceStore()
    const core = createOncePerEventCore(store)
    await core.hydrate()
    expect(core.claim('k')).toBe(true)
    expect(core.claim('k')).toBe(false) // 本会话已占用 ⇒ 不重复弹
    expect(calls.set).toBe(0) // 自始至终未写持久游标
    expect(core.isConsumed('k')).toBe(false)
  })

  it('commit 失败(落盘抛错)⇒ 不构成消费,下次仍会弹', async () => {
    const failingStore: OncePerEventStore = {
      async getConsumed() {
        return null
      },
      async setConsumed() {
        throw new Error('disk full')
      },
    }
    const core = createOncePerEventCore(failingStore)
    await core.hydrate()
    expect(core.claim('k')).toBe(true)
    await expect(core.commit('k')).rejects.toThrow('disk full')
    expect(core.isConsumed('k')).toBe(false) // 内存也不记消费

    const next = createOncePerEventCore(failingStore)
    await next.hydrate()
    expect(next.claim('k')).toBe(true) // 下次仍会弹
  })

  it('已消费(consumed)事件本会话内 claim 直接 false', async () => {
    const { store } = createMemoryOnceStore(['done'])
    const core = createOncePerEventCore(store)
    await core.hydrate()
    expect(core.isConsumed('done')).toBe(true)
    expect(core.claim('done')).toBe(false)
    expect(core.claim('fresh')).toBe(true)
  })
})

// ========== 3. consumed 游标状态机 ==========
describe('consumed 游标状态机', () => {
  it('commit 幂等:重复 commit 不产生重复条目', async () => {
    const { store } = createMemoryOnceStore()
    const core = createOncePerEventCore(store)
    await core.hydrate()
    await core.commit('k')
    await core.commit('k')
    await core.commit('k')
    expect(core.snapshot()).toEqual(['k'])
  })

  it('并发 commit 不同 eventKey 不丢更新(全量写串行化)', async () => {
    const { store } = createMemoryOnceStore()
    const core = createOncePerEventCore(store)
    await core.hydrate()
    await Promise.all([core.commit('a'), core.commit('b'), core.commit('c')])
    expect([...core.snapshot()].sort()).toEqual(['a', 'b', 'c'])
  })

  it('hydrate 并发调用合并为一次 store 读取', async () => {
    const { store, calls } = createMemoryOnceStore(['a'])
    const core = createOncePerEventCore(store)
    await Promise.all([core.hydrate(), core.hydrate(), core.hydrate()])
    expect(calls.get).toBe(1)
    expect(core.isConsumed('a')).toBe(true)
  })

  it('hydrate 过期快照不冲掉 hydrate 期间已 commit 的内存事实(合并而非替换)', async () => {
    let releaseGet: ((keys: readonly string[] | null) => void) | null = null
    const slowStore: OncePerEventStore = {
      getConsumed: () =>
        new Promise((resolve) => {
          releaseGet = resolve
        }),
      setConsumed: async () => undefined,
    }
    const core = createOncePerEventCore(slowStore)
    const hydrating = core.hydrate()
    await core.commit('k') // hydrate 挂起期间先提交事实(内存先记入)
    releaseGet?.(['other']) // 放行过期持久快照(不含 'k')
    await hydrating
    expect(core.isConsumed('k')).toBe(true) // 未被快照冲掉
    expect(core.isConsumed('other')).toBe(true)
  })

  it('未 hydrate 时 ready=false;hydrate 后 ready=true', async () => {
    const { store } = createMemoryOnceStore()
    const core = createOncePerEventCore(store)
    expect(core.isReady()).toBe(false)
    await core.hydrate()
    expect(core.isReady()).toBe(true)
  })
})

// ========== 4. 工厂 API 契约(本包无 jsdom,不渲染 hook,与 use-storage.test.ts 同约定) ==========
describe('createUseOncePerEvent — 工厂 API 契约', () => {
  it('工厂返回 callable hook', () => {
    const { store } = createMemoryOnceStore()
    const useOncePerEvent = createUseOncePerEvent({ store })
    expect(typeof useOncePerEvent).toBe('function')
  })

  it('多次调用工厂返回独立 hook(闭包隔离)', () => {
    const { store } = createMemoryOnceStore()
    const h1 = createUseOncePerEvent({ store })
    const h2 = createUseOncePerEvent({ store })
    expect(h1).not.toBe(h2)
  })
})

// ========== 5. 与 shared storage 工厂组合 — 真实持久化路径端到端 ==========
describe('与 createJsonStorage 组合 — 端到端 consumed 游标', () => {
  it('claim 后崩溃 ⇒ 仍弹;commit 后重放 ⇒ 不弹(JsonStorage 落盘)', async () => {
    const transport = createMemoryTransport()
    const storage = createJsonStorage<string[]>(transport, 'ihui-once-consumed-g646')
    const store: OncePerEventStore = {
      getConsumed: () => storage.get(),
      setConsumed: (keys) => storage.set([...keys]),
    }

    const session1 = createOncePerEventCore(store)
    await session1.hydrate()
    expect(session1.claim('evt.welcome')).toBe(true)

    // 崩溃重启:持久层只有 claim,没有 commit ⇒ 仍会弹
    const session2 = createOncePerEventCore(store)
    await session2.hydrate()
    expect(session2.claim('evt.welcome')).toBe(true)
    expect(await storage.get()).toBeNull() // claim 全程未落盘

    await session2.commit('evt.welcome')
    expect(await storage.get()).toEqual(['evt.welcome']) // commit 才落盘

    // 重放:已消费 ⇒ 不重复弹
    const session3 = createOncePerEventCore(store)
    await session3.hydrate()
    expect(session3.isConsumed('evt.welcome')).toBe(true)
    expect(session3.claim('evt.welcome')).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
