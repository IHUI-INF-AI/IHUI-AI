/**
 * 乐观锁工具 (bug197)。
 *
 * 迁移自旧架构 server/app/utils/bug197_optimistic.py。
 *
 * 设计要点：
 * 1. 基于 version 字段的 CAS (Compare-And-Swap) 更新。
 * 2. 流程: readVersion → check → write with version+1，失败重试到 maxAttempts。
 * 3. 抽象 VersionedStore 接口，兼容内存 / DB / Redis 实现。
 * 4. 提供 withOptimisticLock(store, id, updateFn) 高阶函数，自动重试冲突。
 * 5. 业务函数 (updateFn) 抛出的错误不重试，直接向上抛出。
 */

export class OptimisticLockError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OptimisticLockError'
  }
}

/** 带 version 字段的记录。 */
export interface VersionedRecord<T = unknown> {
  value: T
  version: number
}

/**
 * 版本化存储抽象。
 * - read: 读取当前值与版本号 (不存在返回 null)
 * - write: 仅当 expectedVersion 匹配时写入并 version+1，返回是否成功
 */
export interface VersionedStore<T = unknown> {
  read(id: string): Promise<VersionedRecord<T> | null>
  write(id: string, expectedVersion: number, newValue: T): Promise<boolean>
}

/**
 * 内存版 VersionedStore，用于单进程测试与轻量场景。
 * 线程模型: Node 单线程，Map 读写无需加锁。
 */
export class InMemoryVersionedStore<T = unknown> implements VersionedStore<T> {
  private readonly store = new Map<string, VersionedRecord<T>>()
  private stats = { success: 0, conflict: 0 }

  async read(id: string): Promise<VersionedRecord<T> | null> {
    return this.store.get(id) ?? null
  }

  /** 直接写入 (version=0)，用于初始化。 */
  async put(id: string, value: T): Promise<void> {
    this.store.set(id, { value, version: 0 })
  }

  async write(id: string, expectedVersion: number, newValue: T): Promise<boolean> {
    const rec = this.store.get(id)
    if (rec === undefined) {
      // 首次写入: 允许 expectedVersion=0
      if (expectedVersion !== 0) {
        this.stats.conflict++
        return false
      }
      this.store.set(id, { value: newValue, version: 1 })
      this.stats.success++
      return true
    }
    if (rec.version !== expectedVersion) {
      this.stats.conflict++
      return false
    }
    rec.value = newValue
    rec.version += 1
    this.stats.success++
    return true
  }

  getStats(): { success: number; conflict: number } {
    return { ...this.stats }
  }
}

export interface OptimisticLockOptions {
  /** 最大重试次数 (含首次)，默认 3。 */
  maxAttempts?: number
  /** 冲突重试前的退避毫秒，默认 0 (立即重试)。 */
  backoffMs?: number
}

export interface OptimisticLockResult<T> {
  value: T
  version: number
  attempts: number
}

/**
 * 乐观锁高阶函数。
 *
 * 读取 → 调用 updateFn 计算新值 → CAS 写入；冲突则重试。
 *
 * @param store   版本化存储
 * @param id      记录 ID
 * @param updateFn 接收 (当前值, 当前版本)，返回新值。其抛出的错误会直接向上抛出，不重试。
 *
 * @example
 * const result = await withOptimisticLock(store, 'order:123', async (cur) => {
 *   return { ...cur, status: 'paid' };
 * });
 */
export async function withOptimisticLock<T>(
  store: VersionedStore<T>,
  id: string,
  updateFn: (current: T | null, version: number) => Promise<T> | T,
  options: OptimisticLockOptions = {},
): Promise<OptimisticLockResult<T>> {
  const maxAttempts = options.maxAttempts ?? 3
  const backoffMs = options.backoffMs ?? 0

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const record = await store.read(id)
    const currentVersion = record ? record.version : 0
    const currentValue = record ? record.value : null

    // 业务函数错误直接抛出，不重试
    const newValue = await updateFn(currentValue, currentVersion)

    const ok = await store.write(id, currentVersion, newValue)
    if (ok) {
      return { value: newValue, version: currentVersion + 1, attempts: attempt }
    }

    // 冲突: 若非最后一次则退避后重试
    if (attempt < maxAttempts && backoffMs > 0) {
      await sleep(backoffMs)
    }
  }

  throw new OptimisticLockError(`CAS 失败 id=${id}, 已达最大重试 ${maxAttempts} 次`)
}

/**
 * 单次 CAS 操作 (不重试)。
 * 返回 { ok, version }：ok=true 表示写入成功，version 为新版本号；ok=false 表示冲突，version 为当前版本号。
 */
export async function casOnce<T>(
  store: VersionedStore<T>,
  id: string,
  expectedVersion: number,
  mutator: (current: T | null) => T,
): Promise<{ ok: boolean; version: number }> {
  const record = await store.read(id)
  if (!record) {
    // 不存在时仅允许 expectedVersion=0
    if (expectedVersion !== 0) {
      const again = await store.read(id)
      return { ok: false, version: again ? again.version : 0 }
    }
    const ok = await store.write(id, 0, mutator(null))
    return { ok, version: ok ? 1 : 0 }
  }
  if (record.version !== expectedVersion) {
    return { ok: false, version: record.version }
  }
  const newValue = mutator(record.value)
  const ok = await store.write(id, expectedVersion, newValue)
  return { ok, version: ok ? expectedVersion + 1 : record.version }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
