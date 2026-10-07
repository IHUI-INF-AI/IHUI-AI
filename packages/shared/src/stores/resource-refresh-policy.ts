// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-816011:失败也是共享事实 —— 资源刷新策略工厂(跨端共享,无端特定依赖)。
 *
 * 故障形态(上游 packages/ui/src/lib/usageEntitlementRefreshPolicy.ts:180-245 同型):
 * store 工厂此前"单 hook 各自请求、各自缓存",同一事实的两处副本可以一新一旧,
 * 且旧的那份不报错。三条判据:
 *
 * 1. **失败向所有订阅者广播**(上游 :185-190,注释:"否则设置页失败后,推荐入口仍
 *    认为旧余额查询成功"):通知形状 (current?.snapshot ?? null, reason)。
 * 2. **失败过就不供缓存**(上游 :238 `if (record.failureCount > 0) return null`):
 *    failureCount > 0 ⇒ getCachedSnapshot() 返回 null,A 处失败后 B 处不得读到旧成功快照。
 * 3. **身份变化使全部在途请求失效**(上游 :45-46 "不能仅依赖单个 hook 的 requestVersion"):
 *    requestVersion 是工厂级(不是单 hook 级),换代后在途请求的结果一律丢弃。
 *
 * 反向锁:成功后缓存恢复可命中(failureCount 归零)—— 不是做成"永远不缓存"。
 */

/** 失败广播的稳定 reason(上游同字符串;消费侧只认这个字面,不认 message)。 */
export const USAGE_ENTITLEMENT_REFRESH_FAILED = 'usage_entitlement_refresh_failed'

/** 刷新结果监听器:成功 (snapshot, null);失败 (current?.snapshot ?? null, 失败 reason)。 */
export type ResourceRefreshListener<T> = (snapshot: T | null, reason: string | null) => void

export interface CreateResourceRefreshPolicyOptions<T> {
  /** 按当前身份拉取最新快照(网络/存储 IO 由各端注入)。 */
  load: (identity: string) => Promise<T>
}

export interface ResourceRefreshPolicy<T> {
  /** 订阅刷新结果(成功与失败都广播到**所有**订阅者);返回退订函数。 */
  subscribe(listener: ResourceRefreshListener<T>): () => void
  /**
   * 读缓存:失败过(failureCount > 0)⇒ 返回 null(不供旧成功快照);
   * 否则返回最近一次成功快照(成功后缓存恢复可命中)。
   */
  getCachedSnapshot(): T | null
  /** 以当前身份发起刷新;结果(成功/失败)广播给所有订阅者。 */
  refresh(): Promise<void>
  /**
   * 身份变化:工厂级 requestVersion 递增,**全部在途请求**(不是只失效发起那一个)
   * 的结果一律丢弃;旧身份的缓存与失败计数一并作废。
   */
  setIdentity(identity: string): void
  /** 当前身份;未设置过为 null(refresh 在未设置身份时不动)。 */
  getIdentity(): string | null
  /** 失败计数(当前身份下,连续失败次数;成功归零)。 */
  getFailureCount(): number
}

export function createResourceRefreshPolicy<T>(
  options: CreateResourceRefreshPolicyOptions<T>,
): ResourceRefreshPolicy<T> {
  const listeners = new Set<ResourceRefreshListener<T>>()
  let identity: string | null = null
  let snapshot: T | null = null
  let failureCount = 0
  let requestVersion = 0

  /** 广播到**所有**订阅者(失败也是共享事实,不是发起那一个的私事)。 */
  const broadcast = (next: T | null, reason: string | null): void => {
    for (const listener of [...listeners]) listener(next, reason)
  }

  return {
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },

    getCachedSnapshot() {
      // 上游 :238:失败过就不供缓存 —— 旧成功快照可能正是这次失败要推翻的事实
      if (failureCount > 0) return null
      return snapshot
    },

    async refresh() {
      if (identity === null) return
      const myVersion = requestVersion
      try {
        const result = await options.load(identity)
        // 在途失效:身份已换代 ⇒ 本次结果作废,不写缓存、不广播
        if (myVersion !== requestVersion) return
        snapshot = result
        failureCount = 0
        broadcast(result, null)
      } catch {
        if (myVersion !== requestVersion) return
        failureCount += 1
        // 失败广播 (current?.snapshot ?? null, 失败 reason) —— 到所有订阅者
        broadcast(snapshot, USAGE_ENTITLEMENT_REFRESH_FAILED)
      }
    },

    setIdentity(next) {
      if (identity === next) return
      identity = next
      // 工厂级换代:全部在途请求作废;旧身份的缓存/失败计数一并作废
      requestVersion += 1
      snapshot = null
      failureCount = 0
    },

    getIdentity() {
      return identity
    },

    getFailureCount() {
      return failureCount
    },
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
