// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * storage key 一次性迁移测试(G-645:一次性回填三态返回)
 *
 * 票面:迁移函数不得返回 void,须回 {completed, changed, skipped};源清理只在
 * completed 后做,removeItem(legacyKey) 前置"写回 newKey + 回读一致"成功判据;
 * 重跑幂等靠 migratedLegacyKeys 跳过集。
 *
 * 覆盖范围:
 * 1. completed → 源 key 清理执行,且判据顺序可证(写回+回读先于 removeItem)
 * 2. 写回失败(setItem 抛异常 / 回读不一致)→ 源 key 保留,绝不误删
 * 3. 重跑 → 命中跳过集短路 {completed:true, skipped:true},零 storage 调用
 * 4. 失败路径不入跳过集 → 修复后重跑可重试成功
 * 5. 边界:旧 key 无值 / 新旧 key 同名 → 完成态空操作,不丢数据
 *
 * 说明:跳过集 migratedLegacyKeys 是模块级单例,各用例使用互不相同的 key 名隔离。
 * 依赖:vitest(pnpm --filter @ihui/shared test)
 */
import { describe, it, expect } from 'vitest'
import { migrateLegacyStorageKey } from '../src/utils/storage-migration'
import { createSyncTransport, type SyncStorageAdapter } from '../src/stores/transport'

/** setItem 故障注入模式:ok 正常写 / throw 写入抛异常 / corrupt 写入脏值(模拟落盘未确认) */
type SetMode = 'ok' | 'throw' | 'corrupt'

/** 可编程内存同步 adapter:带调用计数、操作轨迹(方法:key 有序表)与故障注入 */
function createTrackedAdapter(opts: { initial?: Record<string, string>; setMode?: SetMode } = {}) {
  const store = new Map<string, string>(Object.entries(opts.initial ?? {}))
  const calls = { get: 0, set: 0, remove: 0 }
  const ops: string[] = []
  const adapter: SyncStorageAdapter = {
    getItem: (key) => {
      calls.get += 1
      ops.push(`get:${key}`)
      return store.get(key) ?? null
    },
    setItem: (key, value) => {
      calls.set += 1
      ops.push(`set:${key}`)
      if (opts.setMode === 'throw') throw new Error('storage 写入失败(quota 超限)')
      store.set(key, opts.setMode === 'corrupt' ? `${value}#corrupted` : value)
    },
    removeItem: (key) => {
      calls.remove += 1
      ops.push(`remove:${key}`)
      store.delete(key)
    },
  }
  return { adapter, store, calls, ops }
}

// ========== 1-3. 票面验收三场景 ==========
describe('G-645 票面验收三场景', () => {
  it('completed → 源 key 清理执行,removeItem 前置"写回+回读"判据', () => {
    const LEGACY = 'ihui_g645_a'
    const NEW = 'ihui-g645-a'
    const { adapter, store, calls, ops } = createTrackedAdapter({
      initial: { [LEGACY]: 'payload-a' },
    })
    const result = migrateLegacyStorageKey(createSyncTransport(adapter), LEGACY, NEW)

    expect(result).toEqual({ completed: true, changed: true, skipped: false })
    // 值已到新 key,源 key 已清理
    expect(store.get(NEW)).toBe('payload-a')
    expect(store.has(LEGACY)).toBe(false)
    expect(calls.remove).toBe(1)
    // 验收判据顺序:初始读 → 写回 → 回读校验 → 才允许删源 key
    expect(ops).toEqual([`get:${LEGACY}`, `set:${NEW}`, `get:${NEW}`, `remove:${LEGACY}`])
  })

  it('写回失败(setItem 抛异常)→ 源 key 保留,不触碰清理', () => {
    const LEGACY = 'ihui_g645_b'
    const NEW = 'ihui-g645-b'
    const { adapter, store, calls } = createTrackedAdapter({
      initial: { [LEGACY]: 'payload-b' },
      setMode: 'throw',
    })
    const result = migrateLegacyStorageKey(createSyncTransport(adapter), LEGACY, NEW)

    expect(result).toEqual({ completed: false, changed: false, skipped: true })
    expect(store.get(LEGACY)).toBe('payload-b') // 源 key 原样保留
    expect(store.has(NEW)).toBe(false)
    expect(calls.remove).toBe(0) // 从未触碰 removeItem
  })

  it('写回未确认(回读与旧值不一致)→ 源 key 保留,changed 如实上报', () => {
    const LEGACY = 'ihui_g645_c'
    const NEW = 'ihui-g645-c'
    const { adapter, store, calls } = createTrackedAdapter({
      initial: { [LEGACY]: 'payload-c' },
      setMode: 'corrupt',
    })
    const result = migrateLegacyStorageKey(createSyncTransport(adapter), LEGACY, NEW)

    expect(result).toEqual({ completed: false, changed: true, skipped: true })
    expect(store.get(LEGACY)).toBe('payload-c') // 判据未过 ⇒ 源 key 保留
    expect(calls.remove).toBe(0)
  })
})

// ========== 4. 重跑幂等(跳过集短路) ==========
describe('G-645 重跑幂等', () => {
  it('已完成 key 重跑 → 命中跳过集 {completed:true, skipped:true},零 storage 调用', () => {
    const LEGACY = 'ihui_g645_e'
    const NEW = 'ihui-g645-e'
    const { adapter, store, calls } = createTrackedAdapter({
      initial: { [LEGACY]: 'payload-e' },
    })
    const transport = createSyncTransport(adapter)
    expect(migrateLegacyStorageKey(transport, LEGACY, NEW)).toEqual({
      completed: true,
      changed: true,
      skipped: false,
    })

    const before = { ...calls }
    const rerun = migrateLegacyStorageKey(transport, LEGACY, NEW)
    expect(rerun).toEqual({ completed: true, changed: false, skipped: true })
    expect(calls).toEqual(before) // 重跑不重写不重删:storage 调用计数零增长
    expect(store.get(NEW)).toBe('payload-e')
    expect(store.has(LEGACY)).toBe(false)
  })

  it('失败路径不入跳过集 → 修复后重跑可重试成功', () => {
    const LEGACY = 'ihui_g645_d'
    const NEW = 'ihui-g645-d'
    const bad = createTrackedAdapter({ initial: { [LEGACY]: 'payload-d' }, setMode: 'throw' })
    expect(migrateLegacyStorageKey(createSyncTransport(bad.adapter), LEGACY, NEW).completed).toBe(
      false,
    )
    const good = createTrackedAdapter({ initial: { [LEGACY]: 'payload-d' } })
    const retry = migrateLegacyStorageKey(createSyncTransport(good.adapter), LEGACY, NEW)
    expect(retry).toEqual({ completed: true, changed: true, skipped: false })
    expect(good.store.get(NEW)).toBe('payload-d')
    expect(good.store.has(LEGACY)).toBe(false)
  })
})

// ========== 5. 幂等空操作边界 ==========
describe('G-645 边界:完成态空操作', () => {
  it('旧 key 无值 / 新旧 key 同名 → 完成态空操作,绝不删数据', () => {
    const absent = createTrackedAdapter()
    expect(
      migrateLegacyStorageKey(
        createSyncTransport(absent.adapter),
        'ihui_g645_f_absent',
        'ihui-g645-f',
      ),
    ).toEqual({ completed: true, changed: false, skipped: true })
    expect(absent.calls.remove).toBe(0)

    const same = createTrackedAdapter({ initial: { 'ihui-g645-g': 'payload-g' } })
    expect(
      migrateLegacyStorageKey(createSyncTransport(same.adapter), 'ihui-g645-g', 'ihui-g645-g'),
    ).toEqual({ completed: true, changed: false, skipped: true })
    expect(same.store.get('ihui-g645-g')).toBe('payload-g') // 同名守卫:不"写后删同 key"
    expect(same.calls.remove).toBe(0)
  })
})
