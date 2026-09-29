// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 一次性事件两态分离 hook(G-646 立):claim(申请占用)与 commit(提交事实)分离。
 *
 * 背景:一次性提示/徽标的已读游标,若在"弹出申请"时就落盘,claim 成功 ≠ 已消费 ——
 * 弹出后崩溃/被杀,用户永远看不到提示。本 hook 把两态拆开:
 * - claim(eventKey):仅内存占用(会话级),不写持久游标;返回 true = 本次获得弹出权。
 *   崩溃/重启后内存占用消失,下次仍会弹(验收:claim 后崩溃 ⇒ 下次仍会弹)。
 * - commit(eventKey):候选复核后提交事实,经注入 store 持久化 consumed 游标。
 *   此后重放(重挂载/重启)不再弹(验收:commit 后重放 ⇒ 不重复弹)。
 * 即:只有 consumed 后重放才不再弹;仅 claim 不构成消费事实。
 *
 * 设计模式:与 use-storage 共享层模式对齐(工厂函数 + 平台 adapter 注入)。
 * - 调用方传 OncePerEventStore 实例(getConsumed/setConsumed)
 * - hook 负责 hydrate consumed 游标到内存 + 暴露 ready/isConsumed/claim/commit
 *
 * 平台无关:不依赖 RN/Taro/DOM,只基于 React useState/useEffect + 注入 store。
 *
 * 各端接入:
 * ```ts
 * // mobile-rn / miniapp-taro / web:用各自 transport 构造 JsonStorage 再适配
 * const storage = createJsonStorage<string[]>(transport, 'ihui-once-consumed')
 * const store: OncePerEventStore = {
 *   getConsumed: () => storage.get(),
 *   setConsumed: (keys) => storage.set([...keys]),
 * }
 * export const useOncePerEvent = createUseOncePerEvent({ store })
 *
 * // 组件
 * const { ready, isConsumed, claim, commit } = useOncePerEvent()
 * React.useEffect(() => {
 *   if (!ready) return
 *   if (claim('welcome.v1')) setShowWelcome(true) // 申请占用,不落盘
 * }, [ready, claim])
 * const handleConfirm = async () => {
 *   await commit('welcome.v1') // 复核后提交事实,consumed 游标才落盘
 *   setShowWelcome(false)
 * }
 * ```
 */

import * as React from 'react'

/** 持久 consumed 游标存储 adapter(各端注入:AsyncStorage / Taro storage / localStorage) */
export interface OncePerEventStore {
  /** 读取已消费 eventKey 全集(从未消费过时返回 null 或空数组均可) */
  getConsumed(): Promise<readonly string[] | null>
  /** 全量写入已消费 eventKey 集合 */
  setConsumed(keys: readonly string[]): Promise<void>
}

/** 会话级状态机核心(与 React 解耦;无渲染环境可直接单测) */
export interface OncePerEventCore {
  /** hydrate 是否完成(完成前 claim/isConsumed 基于空 consumed 集,调用方须等待) */
  isReady(): boolean
  /** 从 store 拉取 consumed 游标到内存(幂等;并发调用合并为一次读取) */
  hydrate(): Promise<void>
  /** eventKey 是否已 commit 消费 */
  isConsumed(eventKey: string): boolean
  /** 申请占用(仅内存,不持久化):true = 获得弹出权;已消费或本会话已占用均返回 false */
  claim(eventKey: string): boolean
  /** 提交消费事实:持久化 consumed 游标;成功后 isConsumed 即为 true */
  commit(eventKey: string): Promise<void>
  /** consumed 快照(供 React 层镜像为状态) */
  snapshot(): readonly string[]
}

export function createOncePerEventCore(store: OncePerEventStore): OncePerEventCore {
  let ready = false
  let consumed: ReadonlySet<string> = new Set()
  /** 会话级内存占用:不落盘,进程死亡即消失 —— 这是"claim ≠ 已消费"的机制本体 */
  const claimed = new Set<string>()
  let hydratePromise: Promise<void> | null = null
  /** 串行化持久化写入:consumed 是全量写,并发 commit 须按序合并,防丢更新 */
  let persistChain: Promise<void> = Promise.resolve()

  return {
    isReady: () => ready,

    hydrate: () => {
      if (hydratePromise) return hydratePromise
      hydratePromise = (async () => {
        const keys = await store.getConsumed()
        // 合并而非替换:hydrate 期间若有 commit 先落内存,不得被过期快照冲掉
        consumed = new Set([...consumed, ...(keys ?? [])])
        ready = true
      })()
      return hydratePromise
    },

    isConsumed: (eventKey) => consumed.has(eventKey),

    claim: (eventKey) => {
      if (consumed.has(eventKey)) return false // 已消费 ⇒ 永不再弹
      if (claimed.has(eventKey)) return false // 本会话已占用 ⇒ 不重复弹
      claimed.add(eventKey)
      return true
    },

    commit: (eventKey) => {
      const run = async (): Promise<void> => {
        const next = consumed.has(eventKey) ? [...consumed] : [...consumed, eventKey]
        await store.setConsumed(next)
        consumed = new Set(next)
        claimed.delete(eventKey)
      }
      const result = persistChain.then(run, run) // 上一笔失败不阻断本笔
      persistChain = result.then(
        () => undefined,
        () => undefined,
      )
      return result
    },

    snapshot: () => [...consumed],
  }
}

/** createUseOncePerEvent 返回值 */
export interface UseOncePerEventReturn {
  /** hydrate 是否完成(未完成前 claim/isConsumed 结果未定,渲染层应等待) */
  ready: boolean
  /** eventKey 是否已 commit 消费(响应式:hydrate/commit 成功后更新) */
  isConsumed(eventKey: string): boolean
  /** 申请占用(仅内存,不持久化):true = 本次获得弹出权 */
  claim(eventKey: string): boolean
  /** 提交消费事实:持久化 consumed 游标(失败时抛错且不构成消费) */
  commit(eventKey: string): Promise<void>
}

export interface UseOncePerEventOptions {
  store: OncePerEventStore
}

/**
 * 一次性事件 hook 工厂:一次工厂调用 = 一个会话状态机(claim 占用与 consumed 游标
 * 在该工厂返回的所有 hook 实例间共享);需要隔离会话时,另起一次工厂调用即可。
 */
export function createUseOncePerEvent(options: UseOncePerEventOptions) {
  const core = createOncePerEventCore(options.store)
  return function useOncePerEvent(): UseOncePerEventReturn {
    const [ready, setReady] = React.useState(false)
    // consumed 镜像为 React 状态:hydrate/commit 成功后触发重渲染,isConsumed 才是响应式的
    const [consumed, setConsumed] = React.useState<readonly string[]>(() => core.snapshot())

    React.useEffect(() => {
      let cancelled = false
      void core.hydrate().then(() => {
        if (cancelled) return
        setConsumed(core.snapshot())
        setReady(true)
      })
      return () => {
        cancelled = true
      }
    }, [core])

    const isConsumed = React.useCallback(
      (eventKey: string): boolean => consumed.includes(eventKey),
      [consumed],
    )

    const claim = React.useCallback((eventKey: string): boolean => core.claim(eventKey), [core])

    const commit = React.useCallback(
      async (eventKey: string): Promise<void> => {
        await core.commit(eventKey)
        setConsumed(core.snapshot())
      },
      [core],
    )

    return { ready, isConsumed, claim, commit }
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
