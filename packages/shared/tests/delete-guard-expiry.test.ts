// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 回收站「到期清理」行为钉(goal-b49 W7)。
 * 判据一律 import 源文件,本文件不复制任何算式(§22c);IO 不落盘 —— 清理器真正删东西在端内 adapter。
 */
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_BULK_DELETE_THRESHOLD,
  DEFAULT_TRASH_CLEANUP_MAX_ENTRIES,
  DEFAULT_TRASH_RETENTION_MS,
  TRASH_CLEANUP_ENTRY_HARD_CEILING,
} from '../src/delete-guard/constants.js'
import {
  effectiveEntryCap,
  planTrashExpiry,
  summarizeTrashExpiryPlan,
  unitsFromManifest,
} from '../src/delete-guard/expiry.js'
import { isTrashManifestShape } from '../src/delete-guard/recycle.js'
import type { TrashExpiryUnit, TrashManifest } from '../src/delete-guard/types.js'

const NOW = '2026-11-05T00:00:00.000Z'
const nowMs = Date.parse(NOW)

function unitAt(ageMs: number, over: Partial<TrashExpiryUnit> = {}): TrashExpiryUnit {
  return {
    trashId: `t-${ageMs}`,
    createdAtIso: new Date(nowMs - ageMs).toISOString(),
    entry: {
      originalPath: `C:/ws/old-${ageMs}.txt`,
      relativeTrashPath: `0-old-${ageMs}`,
      sizeBytes: 100,
      kind: 'file',
    },
    measuredBytes: null,
    ...over,
  }
}

describe('① TTL 解析:条目档 > 清单档 > 策略档', () => {
  it('三档皆无 ⇒ 落策略默认档(30d),到期即可清', () => {
    const plan = planTrashExpiry([unitAt(DEFAULT_TRASH_RETENTION_MS + 1)], { nowIso: NOW })
    expect(plan.cleanable).toHaveLength(1)
    expect(plan.items[0]!.retentionMs).toBe(DEFAULT_TRASH_RETENTION_MS)
    expect(plan.verdict).toBe('clean')
  })
  it('条目自带 TTL ⇒ 用它,不用默认档(1h 档,已过 2h ⇒ 到期)', () => {
    const u = unitAt(2 * 60 * 60 * 1000, {
      entry: { ...unitAt(0).entry, retentionMs: 60 * 60 * 1000 },
    })
    expect(planTrashExpiry([u], { nowIso: NOW }).cleanable).toHaveLength(1)
  })
  it('清单档生效(条目未自带):1s 档 ∧ 已过 1 天 ⇒ 到期', () => {
    const u = unitAt(24 * 60 * 60 * 1000, { manifestRetentionMs: 1000 })
    expect(planTrashExpiry([u], { nowIso: NOW }).cleanable).toHaveLength(1)
  })
  it('保留期内 ⇒ notExpired,一条都不清', () => {
    const plan = planTrashExpiry([unitAt(1000)], { nowIso: NOW })
    expect(plan.cleanable).toHaveLength(0)
    expect(plan.notExpired).toHaveLength(1)
    expect(plan.verdict).toBe('clean')
  })
  it('条目 TTL 形态非法(字符串/负数)⇒ 该条未判定,且**不回落**默认档', () => {
    for (const bad of ['3600000' as unknown as number, -1]) {
      const u = unitAt(DEFAULT_TRASH_RETENTION_MS + 1, {
        entry: { ...unitAt(0).entry, retentionMs: bad },
      })
      const plan = planTrashExpiry([u], { nowIso: NOW })
      expect(plan.undetermined).toHaveLength(1)
      expect(plan.cleanable).toHaveLength(0)
      expect(plan.verdict).toBe('undetermined')
    }
  })
})

describe('② 量不到体积 ⇒ 不清并点名(§0.3)', () => {
  it('manifest sizeBytes=null ∧ 端内未现量 ⇒ undetermined(目录型条目本仓常态)', () => {
    const u = unitAt(DEFAULT_TRASH_RETENTION_MS + 1, {
      entry: { ...unitAt(0).entry, sizeBytes: null, kind: 'directory' },
    })
    const plan = planTrashExpiry([u], { nowIso: NOW })
    expect(plan.cleanable).toHaveLength(0)
    expect(plan.undetermined[0]!.reason).toContain('量不到体积')
    expect(plan.verdict).toBe('undetermined')
  })
  it('端内现量回灌 measuredBytes ⇒ 同一条目转为可清(不清的根因是"没量",不是"是目录")', () => {
    const u = unitAt(DEFAULT_TRASH_RETENTION_MS + 1, {
      entry: { ...unitAt(0).entry, sizeBytes: null, kind: 'directory' },
      measuredBytes: 4096,
    })
    const plan = planTrashExpiry([u], { nowIso: NOW })
    expect(plan.cleanable).toHaveLength(1)
    expect(plan.reclaimedBytes).toBe(4096)
  })
})

describe('③ 单次批量上限:超限只报数,不硬删', () => {
  const expired = (n: number, bytes = 100): TrashExpiryUnit[] =>
    Array.from({ length: n }, (_, i) =>
      unitAt(DEFAULT_TRASH_RETENTION_MS + 1000 + i, {
        trashId: `t-${i}`,
        entry: { ...unitAt(0).entry, sizeBytes: bytes },
      }),
    )

  it('条目数超上限 ⇒ 多余者进 overBudget 桶,cleanable 恰为上限条', () => {
    const plan = planTrashExpiry(expired(DEFAULT_TRASH_CLEANUP_MAX_ENTRIES + 5), { nowIso: NOW })
    expect(plan.cleanable).toHaveLength(DEFAULT_TRASH_CLEANUP_MAX_ENTRIES)
    expect(plan.overBudget).toHaveLength(5)
    expect(plan.overBudget[0]!.reason).toContain('条目上限')
    expect(plan.verdict).toBe('clean')
  })
  it('字节数超上限 ⇒ 落榜者报数,已用字节不超过 byteCap', () => {
    const plan = planTrashExpiry(expired(5, 700), { nowIso: NOW, maxBytes: 1000 })
    expect(plan.cleanable.length).toBeLessThanOrEqual(1)
    expect(plan.reclaimedBytes).toBeLessThanOrEqual(1000)
    expect(plan.overBudget.length).toBeGreaterThan(0)
  })
  it('最老优先排队', () => {
    const plan = planTrashExpiry(expired(3), { nowIso: NOW, maxEntries: 1 })
    expect(plan.cleanable[0]!.ageMs).toBeGreaterThan(plan.overBudget[0]!.ageMs)
  })
  it('形状锁:条目硬顶 < 两阶段阈值 ⇒ 清理腿结构上不可能绕过护栏', () => {
    expect(TRASH_CLEANUP_ENTRY_HARD_CEILING).toBe(DEFAULT_BULK_DELETE_THRESHOLD - 1)
    expect(effectiveEntryCap(10_000)).toBe(TRASH_CLEANUP_ENTRY_HARD_CEILING)
    expect(effectiveEntryCap(DEFAULT_TRASH_CLEANUP_MAX_ENTRIES)).toBe(
      DEFAULT_TRASH_CLEANUP_MAX_ENTRIES,
    )
    expect(effectiveEntryCap(-3)).toBe(0)
    const plan = planTrashExpiry(expired(60), { nowIso: NOW, maxEntries: 60 })
    expect(plan.cleanable.length).toBeLessThan(DEFAULT_BULK_DELETE_THRESHOLD)
  })
})

describe('④ 取不到输入 ⇒ 未判定(不记绿也不冒红)', () => {
  it('条目集为 null/非数组 ⇒ undetermined 且零授权', () => {
    for (const bad of [null, undefined, 'x']) {
      const plan = planTrashExpiry(bad as unknown as TrashExpiryUnit[], { nowIso: NOW })
      expect(plan.verdict).toBe('undetermined')
      expect(plan.cleanable).toHaveLength(0)
    }
  })
  it('枚举到 0 条 ⇒ undetermined(不用 0 冒充"清干净了")', () => {
    const plan = planTrashExpiry([], { nowIso: NOW })
    expect(plan.verdict).toBe('undetermined')
    expect(plan.reason).toContain('无在册条目')
  })
  it('nowIso 不可解析 ⇒ 整批未判定', () => {
    const plan = planTrashExpiry([unitAt(DEFAULT_TRASH_RETENTION_MS + 1)], { nowIso: '昨天' })
    expect(plan.verdict).toBe('undetermined')
    expect(plan.cleanable).toHaveLength(0)
  })
  it('createdAtIso 不可解析 ⇒ 该条未判定', () => {
    const plan = planTrashExpiry([unitAt(0, { createdAtIso: 'not-a-date' })], { nowIso: NOW })
    expect(plan.undetermined[0]!.reason).toContain('createdAtIso')
  })
  it('清单创建在未来(时钟回拨)⇒ 未判定,不据此删', () => {
    const plan = planTrashExpiry([unitAt(-60_000)], { nowIso: NOW })
    expect(plan.undetermined[0]!.reason).toContain('时钟回拨')
    expect(plan.cleanable).toHaveLength(0)
  })
  it('一条判不出 ⇒ 整体 verdict=undetermined(优先级 undetermined > clean)', () => {
    const plan = planTrashExpiry(
      [unitAt(DEFAULT_TRASH_RETENTION_MS + 1), unitAt(0, { createdAtIso: 'bad' })],
      { nowIso: NOW },
    )
    expect(plan.cleanable).toHaveLength(1)
    expect(plan.verdict).toBe('undetermined')
  })
})

describe('⑤ 桶守恒 + 摊平入口 + 结论行', () => {
  it('四桶互斥且并集 == items(不丢条目)', () => {
    const units = [
      unitAt(DEFAULT_TRASH_RETENTION_MS + 1, { trashId: 'a' }),
      unitAt(1000, { trashId: 'b' }),
      unitAt(DEFAULT_TRASH_RETENTION_MS + 1, {
        trashId: 'c',
        entry: { ...unitAt(0).entry, sizeBytes: null },
      }),
      unitAt(0, { trashId: 'd', createdAtIso: 'bad' }),
    ]
    const plan = planTrashExpiry(units, { nowIso: NOW })
    const bucketTotal =
      plan.cleanable.length +
      plan.overBudget.length +
      plan.notExpired.length +
      plan.undetermined.length
    expect(plan.items).toHaveLength(4)
    expect(bucketTotal).toBe(plan.items.length)
  })
  it('unitsFromManifest 透传清单级 TTL 与 trashId', () => {
    const manifest: TrashManifest = {
      kind: 'ihui.delete-guard.trash-manifest',
      trashId: 'abc123',
      createdAtIso: new Date(nowMs - DEFAULT_TRASH_RETENTION_MS - 1).toISOString(),
      workspacePath: 'C:/ws',
      retentionMs: 1000,
      entries: [{ originalPath: 'C:/ws/x', relativeTrashPath: '0-x', sizeBytes: 7, kind: 'file' }],
    }
    const units = unitsFromManifest(manifest, null)
    expect(units).toHaveLength(1)
    expect(units[0]!.manifestRetentionMs).toBe(1000)
    expect(planTrashExpiry(units, { nowIso: NOW }).cleanable).toHaveLength(1)
  })
  it('结论行是单行 ASCII 且计数与计划一致', () => {
    const plan = planTrashExpiry([unitAt(DEFAULT_TRASH_RETENTION_MS + 1)], { nowIso: NOW })
    const line = summarizeTrashExpiryPlan(plan)
    expect(line).not.toContain('\n')
    expect(line).toContain(`cleanable=${plan.cleanable.length}`)
    expect(line.startsWith('TRASH-EXPIRY ')).toBe(true)
  })
  it('形状回归锁:新字段是**可选**的 —— 老清单(无 retentionMs)照旧通过形态校验', () => {
    const legacy = {
      kind: 'ihui.delete-guard.trash-manifest',
      trashId: 'legacy-1',
      createdAtIso: NOW,
      workspacePath: 'C:/ws',
      entries: [
        { originalPath: 'C:/ws/a', relativeTrashPath: '0-a', sizeBytes: null, kind: 'file' },
      ],
    }
    expect(isTrashManifestShape(legacy)).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
