// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 回收站「到期清理」端内 adapter 唯一入口(goal-b49 W7 未竟 1 的实现席)。
 *
 * 分工铁律(§0.6 / §22c):到期判定、双档上限裁剪、连败死亡机制**一行都不在这里复算** —— 全部
 * import `@ihui/shared/delete-guard`;端内 IO 在 `./trash-prune-io.js`,结论对象在 `./trash-prune-types.js`。
 * 上层读**字段**(`removed`/`skipped`/`reclaimedBytes`/`ledger`/`plan`);`summary` 只给守护日志看。
 *
 * fail-closed 一条(判据层口径,不是本层自创):`isCleared(plan.verdict)` 为假 ⇒ **一条都不删** ——
 * `seal()` 的 reason 写「整批不出清」,`verdict.ts` 的 `isCleared` 注释写「blocked/undetermined 都必须
 * 出声并拒绝执行」。代价是一条体积量不出的条目会冻结整池,故逐条报在 `skipped` 里点名。
 */

import {
  DEFAULT_EXPIRY_MAX_STRIKES,
  DEFAULT_EXPIRY_QUARANTINE_MS,
  DEFAULT_EXPIRY_RUN_MIN_INTERVAL_MS,
  decideExpiryRun,
  initialExpiryLedger,
  isCleared,
  nextExpiryLedger,
  planTrashExpiry,
  summarizeExpiryGate,
  summarizeTrashExpiryPlan,
  unitsFromManifest,
  type ExpiryRunDecision,
  type ExpiryRunLedger,
  type ExpiryRunOutcome,
  type ExpiryRunPolicy,
  type TrashExpiryUnit,
} from '@ihui/shared/delete-guard';
import { getDeleteTrashDir } from './file-batch-edit.js';
import {
  applyManifestUpdates,
  deleteTrashEntry,
  getExpiryLedgerPath,
  measureTrashEntry,
  msgOf,
  readExpiryLedger,
  scanTrash,
  writeExpiryLedger,
  type ScannedTrash,
  type TrashPruneRemoval,
  type TrashPruneSkip,
} from './trash-prune-io.js';
import type { TrashPruneOptions, TrashPruneResult, TrashPruneState } from './trash-prune-types.js';

export type { TrashPruneRemoval, TrashPruneSkip } from './trash-prune-io.js';
export { getExpiryLedgerPath } from './trash-prune-io.js';
export type {
  TrashPruneGate,
  TrashPruneOptions,
  TrashPruneResult,
  TrashPruneState,
} from './trash-prune-types.js';

/**
 * 清单 → 判据输入。`unitsFromManifest` 是这段映射的**唯一实现**(§0.6),但它按清单整批给一个
 * `measuredBytes`;本仓一份清单可含多条(批量删除),所以逐条喂它 —— 同一映射,一次一条,不另写。
 */
function unitsOf(manifests: readonly ScannedTrash[]): TrashExpiryUnit[] {
  const units: TrashExpiryUnit[] = [];
  for (const scanned of manifests) {
    for (const entry of scanned.manifest.entries) {
      const measured = measureTrashEntry(scanned.dir, entry);
      units.push(...unitsFromManifest({ ...scanned.manifest, entries: [entry] }, measured));
    }
  }
  return units;
}

/**
 * 到期清理唯一入口(纯入口:不读 env、不写 stdout、不起调度 —— 调度归 `git-guardian` 巡检轮)。
 *
 * 七步:①枚举 ②闸门 ③现量 ④判到期(判据层)⑤逐条删除(既有通道)⑥更新清单 + 写账目 ⑦三态结论。
 * 本机 `.ihui/delete-trash` 现读 0 枚 ⇒ 走 `gate='empty'` 提前返回:零 fs 写、零账目、零日志行。
 */
export function pruneExpiredTrash(workspacePath: string, opts: TrashPruneOptions = {}): TrashPruneResult {
  const nowIso = opts.nowIso ?? new Date().toISOString();
  const policy: ExpiryRunPolicy = {
    nowIso,
    minIntervalMs: opts.minIntervalMs ?? DEFAULT_EXPIRY_RUN_MIN_INTERVAL_MS,
    quarantineMs: opts.quarantineMs ?? DEFAULT_EXPIRY_QUARANTINE_MS,
    maxStrikes: opts.maxStrikes ?? DEFAULT_EXPIRY_MAX_STRIKES,
  };

  // ① 枚举:空账直接 no-op(§0.3「枚举到 0」在这里是"没有东西可清",不冒充判过)
  const scanned = scanTrash(getDeleteTrashDir(workspacePath));
  if (scanned.manifests.length === 0 && scanned.bad.length === 0) {
    return {
      state: 'clean',
      gate: 'empty',
      reason: '回收站无在册清单:空账,零动作',
      scanned: { manifests: 0, entries: 0 },
      removed: [],
      failed: [],
      skipped: [],
      reclaimedBytes: 0,
      overBudget: { entries: 0, bytes: 0 },
      plan: null,
      ledger: null,
      lines: [],
      summary: 'TRASH-PRUNE state=clean gate=empty manifests=0 entries=0 removed=0 failed=0 skipped=0 bytes=0',
    };
  }
  const entryCount = scanned.manifests.reduce((n, m) => n + m.manifest.entries.length, 0);
  const counts = { manifests: scanned.manifests.length, entries: entryCount };

  // ② 闸门(死亡机制):账目坏 / 时刻取不到 ⇒ undetermined,不据此放行
  const ledgerFile = getExpiryLedgerPath(workspacePath);
  const ledgerRead = readExpiryLedger(ledgerFile, initialExpiryLedger());
  const decision: ExpiryRunDecision = decideExpiryRun(ledgerRead.raw, policy);
  if (decision.gate !== 'run') {
    const blockedState: TrashPruneState = decision.gate === 'undetermined' ? 'undetermined' : 'clean';
    const failed: TrashPruneSkip[] = [];
    let ledger: ExpiryRunLedger | null = null;
    // 未判定也要落账:死亡机制靠它累计(连败达上限 ⇒ retired);其余闸态零写
    if (decision.gate === 'undetermined') {
      try {
        const next = nextExpiryLedger(ledgerRead.raw, 'undetermined', policy);
        writeExpiryLedger(ledgerFile, next);
        ledger = next;
      } catch (err) {
        failed.push({ trashId: null, relativeTrashPath: null, reason: `运行账目写回失败(封票未落地):${msgOf(err)}` });
      }
    }
    return {
      state: blockedState,
      gate: decision.gate,
      reason: ledgerRead.note === null ? decision.reason : `${decision.reason};${ledgerRead.note}`,
      scanned: counts,
      removed: [],
      failed,
      skipped: [...scanned.bad],
      reclaimedBytes: 0,
      overBudget: { entries: 0, bytes: 0 },
      plan: null,
      ledger,
      lines: [summarizeExpiryGate(decision)],
      summary:
        `TRASH-PRUNE state=${blockedState} gate=${decision.gate} manifests=${counts.manifests}` +
        ` entries=${counts.entries} removed=0 failed=${failed.length} skipped=${scanned.bad.length}` +
        ` bytes=0 overBudget=0 streak=${ledger?.streak ?? decision.streak}`,
    };
  }

  // ③④ 现量 + 判到期(判据层唯一实现)
  const plan = planTrashExpiry(unitsOf(scanned.manifests), {
    nowIso,
    retentionMs: opts.retentionMs,
    maxEntries: opts.maxEntries,
    maxBytes: opts.maxBytes,
  });

  const skipped: TrashPruneSkip[] = [...scanned.bad];
  for (const item of plan.undetermined) {
    skipped.push({ trashId: item.trashId, relativeTrashPath: item.relativeTrashPath, reason: item.reason ?? '判不出' });
  }
  for (const item of plan.overBudget) {
    skipped.push({ trashId: item.trashId, relativeTrashPath: item.relativeTrashPath, reason: item.reason ?? '超上限' });
  }

  const removed: TrashPruneRemoval[] = [];
  const failed: TrashPruneSkip[] = [];

  // ⑤ 逐条删除:判据层不放行 ⇒ 一条都不删(isCleared 是单源判序)
  if (isCleared(plan.verdict)) {
    const dirOf = new Map(scanned.manifests.map((m) => [m.trashId, m.dir] as const));
    for (const item of plan.cleanable) {
      const dir = dirOf.get(item.trashId);
      if (dir === undefined) {
        failed.push({ trashId: item.trashId, relativeTrashPath: item.relativeTrashPath, reason: '找不到该 trashId 的目录' });
        continue;
      }
      const outcome = deleteTrashEntry(workspacePath, dir, item.relativeTrashPath);
      if (!outcome.ok) {
        failed.push({ trashId: item.trashId, relativeTrashPath: item.relativeTrashPath, reason: outcome.reason });
        continue;
      }
      removed.push({ trashId: item.trashId, relativeTrashPath: item.relativeTrashPath, bytes: item.bytes ?? 0 });
    }

    // ⑥ 清单更新:先删件后改索引(反序会把"件还在、索引没了"变成不可见垃圾)
    const hits = new Map<string, Set<string>>();
    for (const r of removed) {
      const set = hits.get(r.trashId) ?? new Set<string>();
      set.add(r.relativeTrashPath);
      hits.set(r.trashId, set);
    }
    for (const reason of applyManifestUpdates(scanned.manifests, hits)) {
      failed.push({ trashId: null, relativeTrashPath: null, reason });
    }
  }

  const reclaimedBytes = removed.reduce((n, r) => n + r.bytes, 0);
  const judgedUndetermined = scanned.bad.length > 0 || !isCleared(plan.verdict);
  const state: TrashPruneState = judgedUndetermined ? 'undetermined' : removed.length > 0 ? 'pruned' : 'clean';

  // ⑦ 写账目:空账以外的每一次尝试都要落账(不写账目的封票等于没有封票)
  const outcome: ExpiryRunOutcome = failed.length > 0 ? 'failure' : judgedUndetermined ? 'undetermined' : 'ok';
  let ledger: ExpiryRunLedger | null = null;
  try {
    const next = nextExpiryLedger(ledgerRead.raw, outcome, policy);
    writeExpiryLedger(ledgerFile, next);
    ledger = next;
  } catch (err) {
    failed.push({ trashId: null, relativeTrashPath: null, reason: `运行账目写回失败(封票未落地):${msgOf(err)}` });
  }

  const reason =
    scanned.bad.length > 0
      ? `${scanned.bad.length} 份清单判不出:整批不出清(逐条见 skipped)`
      : !isCleared(plan.verdict)
        ? (plan.reason ?? '判据层结论非 clean:整批不出清')
        : state === 'pruned'
          ? `已摘除 ${removed.length} 条到期回收件`
          : '全部在册条目仍在保留期内:未动';

  const lines = [
    summarizeExpiryGate(decision),
    summarizeTrashExpiryPlan(plan),
    ...failed.map((f) => `TRASH-PRUNE-FAIL ${f.trashId ?? '-'} ${f.relativeTrashPath ?? '-'} ${f.reason}`),
  ];
  const overBudgetBytes = plan.overBudget.reduce((n, i) => n + (i.bytes ?? 0), 0);
  return {
    state,
    gate: decision.gate,
    reason,
    scanned: counts,
    removed,
    failed,
    skipped,
    reclaimedBytes,
    overBudget: { entries: plan.overBudget.length, bytes: overBudgetBytes },
    plan,
    ledger,
    lines,
    summary:
      `TRASH-PRUNE state=${state} gate=${decision.gate} manifests=${counts.manifests}` +
      ` entries=${counts.entries} removed=${removed.length} failed=${failed.length}` +
      ` skipped=${skipped.length} bytes=${reclaimedBytes} overBudget=${plan.overBudget.length}` +
      ` streak=${ledger?.streak ?? -1}`,
  };
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
