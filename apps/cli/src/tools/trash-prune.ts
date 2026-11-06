// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 回收站「到期清理」端内 adapter 唯一入口(goal-b49 W7 未竟 1;Z7 收 X1 未竟 1 的冻结容错)。
 *
 * 分工铁律(§0.6 / §22c):到期判定、双档上限裁剪、连败死亡机制**一行都不在这里复算** —— 全部
 * import `@ihui/shared/delete-guard`;端内 IO 原语在 `./trash-prune-io.js`,结论对象在 `./trash-prune-types.js`。
 * 上层读**字段**(`removed`/`skipped`/`quarantined`/`frozen`/`ghosts`/`reclaimedBytes`/`ledger`/`plan`)。
 *
 * 两档 fail-closed(Z7 定档,不再"一行坏账拖死整池"):
 *  ① **整池不出清**(`isCleared(plan.verdict)` 为假 / 闸门未放行)⇒ 一条都不删,这一档一个字没放宽;
 *  ② **逐行隔离**(X1 未竟 1 的正解):件已实证不在 = 「件已删、清单没改回」那一型 ⇒ 只改索引(零字节
 *     删除)+ 追写留痕;件在而量不到 ⇒ 盘上原样、清单原样、逐条点名。两者都**不新增删除**,只是不再让
 *     一行坏账把整池冻到退休(§0.10:失效方向恒为"多要一次定向说明",绝不是"多停一轮")。
 */

import {
  DEFAULT_EXPIRY_MAX_STRIKES, DEFAULT_EXPIRY_QUARANTINE_MS, DEFAULT_EXPIRY_RUN_MIN_INTERVAL_MS,
  decideExpiryRun, initialExpiryLedger, isCleared, nextExpiryLedger, planTrashExpiry,
  summarizeExpiryGate, summarizeTrashExpiryPlan, unitsFromManifest,
  type ExpiryRunDecision, type ExpiryRunLedger, type ExpiryRunOutcome, type ExpiryRunPolicy, type TrashExpiryItem,
} from '@ihui/shared/delete-guard';
import { getDeleteTrashDir } from './file-batch-edit.js';
import {
  applyManifestUpdates, deleteTrashEntry, getExpiryLedgerPath, measureTrashEntry, msgOf, probeRowPresence,
  readExpiryLedger, resetExpiryRunLedger, scanTrash, traceQuarantinedRows, writeExpiryLedger, type ScannedTrash,
} from './trash-prune-io.js';
import type {
  RowBuckets, TrashPruneOptions, TrashPruneRemoval, TrashPruneResetOutcome, TrashPruneResult, TrashPruneSkip, TrashPruneState,
} from './trash-prune-types.js';

export * from './trash-prune-types.js';
export { getExpiryLedgerPath } from './trash-prune-io.js';

/** 两条"零删除"结论(空账 / 闸门未放行)共用一具壳:默认字段只写一次,不各抄一份 */
function noAction(
  base: Pick<TrashPruneResult, 'state' | 'gate' | 'reason' | 'scanned' | 'summary'>,
  extra: Partial<TrashPruneResult> = {},
): TrashPruneResult {
  return {
    removed: [], failed: [], skipped: [], quarantined: [], frozen: [], ghosts: [],
    reclaimedBytes: 0, overBudget: { entries: 0, bytes: 0 }, plan: null, ledger: null, lines: [],
    ...base, ...extra,
  };
}

/** 判据层桶 → 逐条点名行(未删原因;桶里的行一条也没被本层删过) */
function rowOf(item: TrashExpiryItem): TrashPruneSkip {
  return { trashId: item.trashId, relativeTrashPath: item.relativeTrashPath, reason: item.reason ?? '判不出' };
}

/**
 * 逐行现场分桶(本层决定"哪些行有资格进判据层")。体积只问既有那把尺 `measureTrashEntry`,摊平只问
 * 既有那个出口 `unitsFromManifest`(同一映射,一次一行,不另写)。件已实证不在 ⇒ 隔离(只改索引);
 * 件在而量不到 / 路径越界 ⇒ 冻结那一格(不碰不删不改清单);真·视野坏仍走 `scanTrash` 的 bad 桶整池不出清。
 */
function classifyRows(manifests: readonly ScannedTrash[]): RowBuckets {
  const buckets: RowBuckets = { units: [], quarantined: [], frozen: [], indexHits: new Map() };
  for (const scanned of manifests) {
    for (const entry of scanned.manifest.entries) {
      const bytes = measureTrashEntry(scanned.dir, entry);
      if (bytes !== null) {
        buckets.units.push(...unitsFromManifest({ ...scanned.manifest, entries: [entry] }, bytes));
        continue;
      }
      const row = (why: string): TrashPruneSkip => ({
        trashId: scanned.trashId,
        relativeTrashPath: entry.relativeTrashPath,
        reason: why,
      });
      if (probeRowPresence(scanned.dir, entry.relativeTrashPath) !== 'absent') {
        buckets.frozen.push(row('件既量不到也未证实丢失(越界/权限/超枚举预算/非文件非目录):不判不删不改清单'));
        continue;
      }
      buckets.quarantined.push(row('件已不在、只剩索引行:只改索引 + 留痕,零字节删除'));
      const set = buckets.indexHits.get(scanned.trashId) ?? new Set<string>();
      set.add(entry.relativeTrashPath);
      buckets.indexHits.set(scanned.trashId, set);
    }
  }
  return buckets;
}

/**
 * 到期清理唯一入口(纯入口:不读 env、不写 stdout、不起调度 —— 调度归 `git-guardian` 巡检轮)。
 *
 * 七步:①枚举 ②闸门 ③现量 ④判到期(判据层)⑤逐条删除(既有通道)⑥更新清单 + 写账目 ⑦三态结论。
 * 本机 `.ihui/delete-trash` 现读 0 枚 ⇒ 走 `gate='empty'` 提前返回:零 fs 写、零账目、零日志行。
 */
function withReceipt(result: TrashPruneResult, nowIso: string, scanComplete: boolean): TrashPruneResult & { receipt: SentinelReceiptPlan } {
  return {
    ...result,
    receipt: admitSentinelReceipt({
      name: 'trash-prune',
      status: result.state,
      reason: result.reason,
      scanned: result.scanned.entries,
      linked: result.removed.length,
      reclaimedBytes: result.reclaimedBytes,
      scannedAt: nowIso,
      truncated: scanComplete ? false : null,
    }),
  };
}

export function pruneExpiredTrash(workspacePath: string, opts: TrashPruneOptions = {}): TrashPruneResult & { receipt: SentinelReceiptPlan } {
  const nowIso = opts.nowIso ?? new Date().toISOString();
  const policy: ExpiryRunPolicy = {
    nowIso, minIntervalMs: opts.minIntervalMs ?? DEFAULT_EXPIRY_RUN_MIN_INTERVAL_MS,
    quarantineMs: opts.quarantineMs ?? DEFAULT_EXPIRY_QUARANTINE_MS, maxStrikes: opts.maxStrikes ?? DEFAULT_EXPIRY_MAX_STRIKES,
  };

  // ① 枚举:空账(含"只剩空壳目录")no-op —— 没有东西可判,不冒充判过,也不累加连败(§0.3)
  const scanned = scanTrash(getDeleteTrashDir(workspacePath));
  const counts = { manifests: scanned.manifests.length, entries: scanned.manifests.reduce((n, m) => n + m.manifest.entries.length, 0) };
  if (counts.entries === 0 && scanned.bad.length === 0) {
    return withReceipt(noAction({
      state: 'clean', gate: 'empty', scanned: counts,
      reason: counts.manifests === 0 ? '回收站无在册清单:空账,零动作' : `回收站只剩 ${counts.manifests} 枚空壳目录(在册条目 0):零动作,不摘壳`,
      summary: `TRASH-PRUNE state=clean gate=empty manifests=${counts.manifests} entries=0 removed=0 failed=0 skipped=0 bytes=0`,
    }), nowIso, true);
  }

  // ② 闸门(死亡机制):账目坏 / 时刻取不到 ⇒ undetermined,不据此放行
  const ledgerFile = getExpiryLedgerPath(workspacePath);
  const ledgerRead = readExpiryLedger(ledgerFile, initialExpiryLedger(), opts.stat);
  const decision: ExpiryRunDecision = decideExpiryRun(ledgerRead.raw, policy);
  if (decision.gate !== 'run') {
    const blockedState: TrashPruneState = decision.gate === 'undetermined' ? 'undetermined' : 'clean';
    const failed: TrashPruneSkip[] = [];
    let ledger: ExpiryRunLedger | null = null;
    // 未判定也要落账:死亡机制靠它累计(连败达上限 ⇒ retired);其余闸态零写
    if (decision.gate === 'undetermined') {
      if (ledgerRead.note?.includes('读不到')) {
        failed.push({ trashId: null, relativeTrashPath: null, reason: ledgerRead.note });
      } else {
        try {
          const next = nextExpiryLedger(ledgerRead.raw, 'undetermined', policy);
          writeExpiryLedger(ledgerFile, next);
          ledger = next;
        } catch (err) {
          failed.push({ trashId: null, relativeTrashPath: null, reason: `运行账目写回失败(封票未落地):${msgOf(err)}` });
        }
      }
    }
    return withReceipt(noAction(
      {
        state: blockedState, gate: decision.gate, scanned: counts,
        reason: ledgerRead.note === null ? decision.reason : `${decision.reason};${ledgerRead.note}`,
        summary:
          `TRASH-PRUNE state=${blockedState} gate=${decision.gate} manifests=${counts.manifests}` +
          ` entries=${counts.entries} removed=0 failed=${failed.length} skipped=${scanned.bad.length}` +
          ` bytes=0 overBudget=0 streak=${ledger?.streak ?? decision.streak}`,
      },
      { failed, skipped: [...scanned.bad], ledger, lines: [summarizeExpiryGate(decision)] },
    ), nowIso, scanned.bad.length === 0);
  }

  // ③④ 逐行分桶(现量)+ 判到期(判据层唯一实现;被隔离的行根本不进这里)
  const buckets = classifyRows(scanned.manifests);
  const plan = planTrashExpiry(buckets.units, {
    nowIso,
    retentionMs: opts.retentionMs,
    maxEntries: opts.maxEntries,
    maxBytes: opts.maxBytes,
  });
  const skipped: TrashPruneSkip[] = [...scanned.bad, ...plan.undetermined.map(rowOf), ...plan.overBudget.map(rowOf), ...buckets.frozen];

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
  }

  // ⑥ 清单更新:先删件后改索引(反序会把"件还在、索引没了"变成不可见垃圾);坏账行同批只改索引
  const hits = new Map<string, Set<string>>(buckets.indexHits);
  for (const r of removed) {
    const set = hits.get(r.trashId) ?? new Set<string>();
    set.add(r.relativeTrashPath);
    hits.set(r.trashId, set);
  }
  const update = applyManifestUpdates(scanned.manifests, hits);
  for (const reason of update.failures) {
    failed.push({ trashId: null, relativeTrashPath: null, reason });
  }
  if (buckets.quarantined.length > 0) {
    try {
      traceQuarantinedRows(workspacePath, buckets.quarantined, nowIso);
    } catch (err) {
      failed.push({ trashId: null, relativeTrashPath: null, reason: `隔离留痕写不进(不写=没隔离):${msgOf(err)}` });
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

  const freezeNote = judgedUndetermined ? ';整轮判不出,逐条见 TRASH-PRUNE-SKIP' : '';
  const reason =
    scanned.bad.length > 0
      ? `${scanned.bad.length} 份清单判不出:那几份一份不动、整轮记为未判定(视野本身坏掉这一档不放宽),已核实条目不牵连${freezeNote}`
      : !isCleared(plan.verdict)
        ? `${plan.reason ?? '判据层结论非 clean:整池不出清'}${freezeNote}`
        : state === 'pruned'
          ? `已摘除 ${removed.length} 条到期回收件`
          : '全部在册条目仍在保留期内:未动';

  const lines = [
    summarizeExpiryGate(decision),
    summarizeTrashExpiryPlan(plan),
    ...buckets.frozen.map((f) => `TRASH-PRUNE-FROZEN trashId=${f.trashId ?? '-'} row=${f.relativeTrashPath ?? '-'} ${f.reason}`),
    ...buckets.quarantined.map((f) => `TRASH-PRUNE-QUARANTINE trashId=${f.trashId ?? '-'} row=${f.relativeTrashPath ?? '-'} 只改索引,零字节删除`),
    ...update.ghosts.map((g) => `TRASH-PRUNE-GHOST trashId=${g} 目录仍有未登记内容:不摘壳`),
    ...failed.map((f) => `TRASH-PRUNE-FAIL ${f.trashId ?? '-'} ${f.relativeTrashPath ?? '-'} ${f.reason}`),
  ];
  const overBudgetBytes = plan.overBudget.reduce((n, i) => n + (i.bytes ?? 0), 0);
  return withReceipt({
    state, gate: decision.gate, reason, scanned: counts, removed, failed, skipped, lines, plan, ledger,
    quarantined: buckets.quarantined, frozen: buckets.frozen, ghosts: update.ghosts, reclaimedBytes,
    overBudget: { entries: plan.overBudget.length, bytes: overBudgetBytes },
    summary:
      `TRASH-PRUNE state=${state} gate=${decision.gate} manifests=${counts.manifests}` +
      ` entries=${counts.entries} removed=${removed.length} failed=${failed.length}` +
      ` skipped=${skipped.length} bytes=${reclaimedBytes} overBudget=${plan.overBudget.length}` +
      ` streak=${ledger?.streak ?? -1} quarantined=${buckets.quarantined.length}` +
      ` frozen=${buckets.frozen.length} ghosts=${update.ghosts.length}`,
  }, nowIso, scanned.bad.length === 0);
}

/**
 * 人工复位连败账目(X1 未竟 1 的"一条可解释的复位出口"):退休是 fail-closed 的正当结局,但不是死胡同。
 * 定向说明不足 ⇒ 一个字不写(§0.10);复位前后逐枚追写 `expiry-run-reset.jsonl`(不写留痕的复位等于没复位)。
 */
export function resetTrashExpiryRun(workspacePath: string, reason: string, nowIso = new Date().toISOString()): TrashPruneResetOutcome {
  return resetExpiryRunLedger(getExpiryLedgerPath(workspacePath), reason, nowIso);
}

export type SentinelReceiptPlan = {
  disposition: 'complete' | 'unjudged' | 'refused';
  reason:
    | 'receipt-complete'
    | 'name-invalid'
    | 'name-versioned'
    | 'status-unmeasured'
    | 'reason-absent'
    | 'count-unmeasured'
    | 'count-invalid'
    | 'linked-exceeds-scanned'
    | 'clock-unmeasured'
    | 'truncated-unmeasured';
  scanned: number | null;
  linked: number | null;
  reclaimedBytes: number | null;
  truncated: boolean | null;
};

const SENTINEL_NAME_VERSIONED = /done\d+$/i;

function sentinelCountOk(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function sentinelClockOk(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0;
  if (typeof value !== 'string' || value.trim() === '') return false;
  return !Number.isNaN(Date.parse(value));
}

/**
 * 完成哨兵必须带量化回执。缺计数、缺时钟或缺截断旗时不记完成，也不把缺席编成 0。
 * 名字把版本号烤在末尾的旧形态直接拒绝。本函数不写盘。
 */
export function admitSentinelReceipt(input: {
  name: unknown;
  status: unknown;
  reason: unknown;
  scanned: unknown;
  linked: unknown;
  reclaimedBytes: unknown;
  scannedAt: unknown;
  truncated: unknown;
}): SentinelReceiptPlan {
  const blank = (reason: SentinelReceiptPlan['reason'], disposition: SentinelReceiptPlan['disposition']): SentinelReceiptPlan => ({
    disposition,
    reason,
    scanned: null,
    linked: null,
    reclaimedBytes: null,
    truncated: null,
  });
  if (typeof input.name !== 'string' || input.name.trim() === '') return blank('name-invalid', 'unjudged');
  if (SENTINEL_NAME_VERSIONED.test(input.name.trim())) return blank('name-versioned', 'refused');
  if (typeof input.status !== 'string' || input.status.trim() === '') return blank('status-unmeasured', 'unjudged');
  if (typeof input.reason !== 'string' || input.reason.trim() === '') return blank('reason-absent', 'unjudged');
  if (input.scanned === null || input.scanned === undefined || input.linked === null || input.linked === undefined || input.reclaimedBytes === null || input.reclaimedBytes === undefined) {
    return blank('count-unmeasured', 'unjudged');
  }
  if (!sentinelCountOk(input.scanned) || !sentinelCountOk(input.linked) || !sentinelCountOk(input.reclaimedBytes)) {
    return blank('count-invalid', 'unjudged');
  }
  if (input.linked > input.scanned) return blank('linked-exceeds-scanned', 'refused');
  if (!sentinelClockOk(input.scannedAt)) return blank('clock-unmeasured', 'unjudged');
  if (typeof input.truncated !== 'boolean') return blank('truncated-unmeasured', 'unjudged');
  return {
    disposition: 'complete',
    reason: 'receipt-complete',
    scanned: input.scanned,
    linked: input.linked,
    reclaimedBytes: input.reclaimedBytes,
    truncated: input.truncated,
  };
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
