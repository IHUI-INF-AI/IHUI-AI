// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import {
  DEFAULT_BULK_DELETE_THRESHOLD,
  DEFAULT_TRASH_CLEANUP_MAX_BYTES,
  DEFAULT_TRASH_CLEANUP_MAX_ENTRIES,
  DEFAULT_TRASH_RETENTION_MS,
  TRASH_CLEANUP_ENTRY_HARD_CEILING,
} from './constants'
import type {
  TrashExpiryItem,
  TrashExpiryOptions,
  TrashExpiryPlan,
  TrashExpiryUnit,
  TrashManifest,
} from './types'
import { aggregateGuardVerdict } from './verdict'

/**
 * 回收站「到期清理」判据(goal-b49 W7,纯判据、零 IO)。
 *
 * 分工:本层只算"哪些条目可清 / 该留 / 判不出 / 超上限",
 * 真实枚举与删除(读 `.ihui/delete-trash/<trashId>/manifest.json`、rm)留在端内 adapter
 * (apps/cli 工具层),满足门 126「shared 可达闭包禁 `node:` 内建」。
 *
 * 三条硬口径:
 * 1. 量不到体积 ⇒ **不清**,落 undetermined 并点名(§0.3:取不到不记绿,也不猜 0)。
 *    本仓目录型条目 manifest 里 sizeBytes 恒为 null,所以这一支是常态而非边角 —— 端内必须现量后回灌。
 * 2. 单次批量上限:条目数与字节数双档,超限只报数(overBudget 桶),绝不"为清完而突破上限"。
 * 3. 条目数硬顶 = 两阶段阈值 - 1:清理器自己就是一次批量删除,钉在阈值以下它才不可能绕过本链护栏。
 */

/** 字节数/TTL 等数值字段的宽容取数:非有限数 ⇒ null(不猜 0,不猜"没这个档") */
function asFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/** 保留期解析:条目档 > 清单档 > 策略档;任一档"存在但形态非法"⇒ 未判定(不跳过去拿下一档猜) */
function resolveRetention(
  unit: TrashExpiryUnit,
  policyMs: number,
): { ms: number } | { bad: string } {
  const entryRaw = unit.entry.retentionMs
  if (entryRaw !== undefined) {
    const ms = asFiniteNumber(entryRaw)
    if (ms === null || ms < 0) return { bad: `条目 retentionMs 形态非法(${String(entryRaw)})` }
    return { ms }
  }
  const manifestRaw = unit.manifestRetentionMs
  if (manifestRaw !== undefined && manifestRaw !== null) {
    const ms = asFiniteNumber(manifestRaw)
    if (ms === null || ms < 0) return { bad: `清单 retentionMs 形态非法(${String(manifestRaw)})` }
    return { ms }
  }
  return { ms: policyMs }
}

function itemOf(unit: TrashExpiryUnit, patch: Partial<TrashExpiryItem>): TrashExpiryItem {
  return {
    trashId: unit.trashId,
    relativeTrashPath: unit.entry.relativeTrashPath,
    originalPath: unit.entry.originalPath,
    kind: unit.entry.kind,
    state: 'undetermined',
    bytes: null,
    retentionMs: null,
    ageMs: null,
    ...patch,
  }
}

function undeterminedOf(unit: TrashExpiryUnit, reason: string): TrashExpiryItem {
  const bytes = asFiniteNumber(unit.measuredBytes) ?? asFiniteNumber(unit.entry.sizeBytes)
  return itemOf(unit, { bytes, state: 'undetermined', reason })
}

/** 条目数上限:调用方档与"两阶段阈值-1"硬顶取小,再夹到非负 */
export function effectiveEntryCap(maxEntries?: number): number {
  const asked = asFiniteNumber(maxEntries) ?? DEFAULT_TRASH_CLEANUP_MAX_ENTRIES
  return Math.max(0, Math.min(Math.floor(asked), TRASH_CLEANUP_ENTRY_HARD_CEILING))
}

/**
 * 到期清理计划。nowIso 解析不出 ⇒ 整批未判定(一条都不授权清),而不是"当作没到期"。
 * items 为空 ⇒ aggregateGuardVerdict 按§0.3 判未判定(枚举到 0 不记绿)。
 */
export function planTrashExpiry(
  units: readonly TrashExpiryUnit[] | null | undefined,
  opts: TrashExpiryOptions,
): TrashExpiryPlan {
  const policyMs = asFiniteNumber(opts.retentionMs) ?? DEFAULT_TRASH_RETENTION_MS
  const entryCap = effectiveEntryCap(opts.maxEntries)
  const byteCap = Math.max(0, asFiniteNumber(opts.maxBytes) ?? DEFAULT_TRASH_CLEANUP_MAX_BYTES)
  const base = { entryCap, byteCap }

  if (!Array.isArray(units)) {
    return {
      ...base,
      verdict: 'undetermined',
      items: [],
      cleanable: [],
      overBudget: [],
      notExpired: [],
      undetermined: [],
      reclaimedBytes: 0,
      reason: '回收站条目集取不到(非数组/为 null):未判定,一条都不授权清',
    }
  }

  const nowRaw = Date.parse(opts.nowIso)
  if (!Number.isFinite(nowRaw)) {
    const items = units.map((u) => undeterminedOf(u, `当前时刻不可解析(${String(opts.nowIso)})`))
    return seal({
      ...base,
      items,
      cleanable: [],
      overBudget: [],
      notExpired: [],
      undetermined: items,
      reclaimedBytes: 0,
    })
  }

  const items = units.map((unit): TrashExpiryItem => {
    const created = Date.parse(unit.createdAtIso)
    if (!Number.isFinite(created)) {
      return undeterminedOf(unit, `清单 createdAtIso 不可解析(${String(unit.createdAtIso)})`)
    }
    const ageMs = nowRaw - created
    if (ageMs < 0) {
      return undeterminedOf(unit, `时刻异常:清单创建在未来 ${-ageMs}ms(时钟回拨),不据此删`)
    }
    const retention = resolveRetention(unit, policyMs)
    if ('bad' in retention) {
      return undeterminedOf(unit, `${retention.bad}:未判定,不回落默认档猜`)
    }
    const bytes = asFiniteNumber(unit.measuredBytes) ?? asFiniteNumber(unit.entry.sizeBytes)
    if (bytes === null) {
      return itemOf(unit, {
        retentionMs: retention.ms,
        ageMs,
        reason: '量不到体积(manifest 未含量且端内现量未取得):不清并点名',
      })
    }
    if (ageMs < retention.ms) {
      return itemOf(unit, {
        state: 'notExpired',
        bytes,
        retentionMs: retention.ms,
        ageMs,
        reason: `保留期内(已过 ${ageMs}ms < ${retention.ms}ms)`,
      })
    }
    return itemOf(unit, { state: 'cleanable', bytes, retentionMs: retention.ms, ageMs })
  })

  // 已到期者按"最老优先"排队,再受条目数/字节数双档裁剪;落榜者进 overBudget 只报数
  const expired = items
    .filter((i) => i.state === 'cleanable')
    .sort((a, b) => (b.ageMs ?? 0) - (a.ageMs ?? 0))
  const taken: TrashExpiryItem[] = []
  const pushed: TrashExpiryItem[] = []
  let usedBytes = 0
  for (const item of expired) {
    const size = item.bytes ?? 0
    if (taken.length >= entryCap) {
      pushed.push({
        ...item,
        state: 'overBudget',
        reason: `超出单次条目上限 ${entryCap}(只报数,不硬删)`,
      })
      continue
    }
    if (usedBytes + size > byteCap) {
      pushed.push({
        ...item,
        state: 'overBudget',
        reason: `超出单次字节上限 ${byteCap}B(只报数,不硬删)`,
      })
      continue
    }
    taken.push(item)
    usedBytes += size
  }

  const cleanable: readonly TrashExpiryItem[] = taken
  const merged = items.map((i) => {
    const hit = pushed.find(
      (p) => p.trashId === i.trashId && p.relativeTrashPath === i.relativeTrashPath,
    )
    return hit ?? i
  })
  return seal({
    ...base,
    items: merged,
    cleanable,
    overBudget: pushed,
    notExpired: merged.filter((i) => i.state === 'notExpired'),
    undetermined: merged.filter((i) => i.state === 'undetermined'),
    reclaimedBytes: usedBytes,
  })
}

function seal(parts: {
  entryCap: number
  byteCap: number
  items: readonly TrashExpiryItem[]
  cleanable: readonly TrashExpiryItem[]
  overBudget: readonly TrashExpiryItem[]
  notExpired: readonly TrashExpiryItem[]
  undetermined: readonly TrashExpiryItem[]
  reclaimedBytes: number
  reason?: string
}): TrashExpiryPlan {
  const verdict = aggregateGuardVerdict(
    parts.items.length === 0
      ? []
      : parts.items.map((i) => (i.state === 'undetermined' ? 'undetermined' : 'clean')),
  )
  const reason =
    parts.reason ??
    (parts.items.length === 0
      ? '回收站无在册条目(枚举到 0 ⇒ 未判定,不记绿)'
      : verdict === 'undetermined'
        ? `存在 ${parts.undetermined.length} 条判不出:整批不出清`
        : undefined)
  return { ...parts, verdict, reason }
}

/**
 * 单行 ASCII 结论(供调度器日志/告警身份用,不含绝对路径原文)。
 * 计数一律现读自 plan,不在这里复算。
 */
export function summarizeTrashExpiryPlan(plan: TrashExpiryPlan): string {
  return (
    `TRASH-EXPIRY verdict=${plan.verdict} total=${plan.items.length}` +
    ` cleanable=${plan.cleanable.length} overBudget=${plan.overBudget.length}` +
    ` notExpired=${plan.notExpired.length} undetermined=${plan.undetermined.length}` +
    ` bytes=${plan.reclaimedBytes}/${plan.byteCap} cap=${plan.entryCap}` +
    ` bulkThreshold=${DEFAULT_BULK_DELETE_THRESHOLD}`
  )
}

/** 由已校验过的清单摊平成判据层输入(manifest 级字段自动透传,坏清单不进射程) */
export function unitsFromManifest(
  manifest: TrashManifest,
  measuredBytes?: number | null,
): TrashExpiryUnit[] {
  return manifest.entries.map((entry) => ({
    trashId: manifest.trashId,
    createdAtIso: manifest.createdAtIso,
    manifestRetentionMs: manifest.retentionMs ?? null,
    entry,
    measuredBytes: measuredBytes ?? null,
  }))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
