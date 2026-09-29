// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 有界持久化确认(ack)集合 + 版本谓词行选择(2026-09-30 立,吸收批 74 W5)。
 *
 * 机制(中性语义重述:运行记录行的"打开会话即清"小红点):
 *  1. 已结束的运行行要一直挂着,直到用户打开那个会话——没有计时器、没有 settledAt,
 *     只有这一份**有界、持久化**的 id 集合:打开会话时把它当时所有已结束的行整批放进来。
 *  2. 上限 256,插入序 = 确认序(Set 迭代序),满了淘汰最早确认的;
 *     256 远大于任何会话列表里同时挂着的已结束行数。
 *  3. 持久化走注入的 storage(桌面 localStorage / 移动端容器各自的存储);
 *     存储不可用(隐私模式、配额)本次会话内仍生效,只是不跨重启——只吞不抛。
 *  4. version 号 + 订阅通知:**谓词随版本换引用**驱动行选择重算
 *     (版本不变时谓词引用稳定,接入 useMemo/useSyncExternalStore 不触发无谓重算)。
 *  5. 行选择:在跑的永远画;已结束的只画未确认;折叠时把整批已结束行 ack 掉。
 */

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export interface BoundedAckSetOptions {
  /** 注入存储;null = 纯内存。缺省读 window.localStorage(不可用回退内存)。 */
  storage?: StorageLike | null
  storageKey?: string
  /** 集合上限;缺省 256。 */
  limit?: number
}

export interface BoundedAckSet {
  isAcknowledged(id: string): boolean
  acknowledge(ids: readonly string[]): void
  subscribe(listener: () => void): () => void
  /** 版本号快照:每次集合变化 +1,供 useSyncExternalStore 判等。 */
  getVersion(): number
  /**
   * 未确认谓词:随版本换引用(集合一变引用变化,调用方据此重算行选择);
   * 版本不变时引用稳定。
   */
  getUnacknowledged(): (id: string) => boolean
  /** 当前集合大小(测试/诊断用)。 */
  size(): number
}

/** 缺省上限;满了按确认序淘汰最早。 */
export const BOUNDED_ACK_DEFAULT_LIMIT = 256

export const BOUNDED_ACK_DEFAULT_STORAGE_KEY = 'ihui:bounded-ack-set'

function readStoredIds(storage: StorageLike | null, storageKey: string): string[] {
  if (storage === null) {
    return []
  }
  try {
    const raw = storage.getItem(storageKey)
    if (raw === null) {
      return []
    }
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed.filter((entry): entry is string => typeof entry === 'string')
  } catch {
    return []
  }
}

function getBrowserLocalStorage(): StorageLike | null {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function createBoundedAckSet(options: BoundedAckSetOptions = {}): BoundedAckSet {
  const storage = options.storage !== undefined ? options.storage : getBrowserLocalStorage()
  const storageKey = options.storageKey ?? BOUNDED_ACK_DEFAULT_STORAGE_KEY
  const limit = options.limit ?? BOUNDED_ACK_DEFAULT_LIMIT

  // 插入序 = 确认序;Set 的迭代序保证淘汰最早的。启动时裁剪到上限内。
  const acknowledged = new Set<string>(readStoredIds(storage, storageKey).slice(-limit))
  const listeners = new Set<() => void>()
  let version = 0
  // 谓词随版本换引用:版本不变时返回同一引用,驱动 useMemo 判等稳定。
  let cachedPredicateVersion = -1
  let cachedPredicate: ((id: string) => boolean) | null = null

  const persist = (): void => {
    if (storage === null) {
      return
    }
    try {
      storage.setItem(storageKey, JSON.stringify([...acknowledged]))
    } catch {
      // 存储不可用(隐私模式、配额):本次会话内仍生效,只是不跨重启。
    }
  }

  return {
    isAcknowledged: (id) => acknowledged.has(id),
    acknowledge: (ids) => {
      let changed = false
      for (const id of ids) {
        if (acknowledged.has(id)) {
          continue
        }
        acknowledged.add(id)
        changed = true
      }
      if (!changed) {
        return
      }
      while (acknowledged.size > limit) {
        const oldest = acknowledged.values().next().value
        if (oldest === undefined) {
          break
        }
        acknowledged.delete(oldest)
      }
      version += 1
      persist()
      for (const listener of listeners) {
        listener()
      }
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    getVersion: () => version,
    getUnacknowledged: () => {
      if (cachedPredicateVersion !== version || cachedPredicate === null) {
        cachedPredicateVersion = version
        cachedPredicate = (id: string) => !acknowledged.has(id)
      }
      return cachedPredicate
    },
    size: () => acknowledged.size,
  }
}

/* -------------------------------- 行选择(中性) -------------------------------- */

/** 可被确认的运行记录行最小形状。 */
export interface AckRowLike {
  id: string
  status: string
}

/** 在跑判定:在跑的行永远画,不受确认集合影响。 */
export function isLiveAckRow(row: AckRowLike): boolean {
  return row.status === 'running' || row.status === 'queued'
}

/**
 * 选出要画的行:在跑的永远画;已结束的只在**未确认**时画(确认 = 会话被打开过)。
 * 谓词从 `getUnacknowledged()` 取,版本不变引用稳定、集合变化换引用驱动重算。
 */
export function selectAckRows<T extends AckRowLike>(
  rows: readonly T[],
  unacknowledged: (id: string) => boolean,
): T[] {
  return rows.filter((row) => isLiveAckRow(row) || unacknowledged(row.id))
}

/** 已结束(可被确认)的行 id:打开会话时整批确认。 */
export function collectSettledAckIds(rows: readonly AckRowLike[]): string[] {
  return rows.filter((row) => !isLiveAckRow(row)).map((row) => row.id)
}
