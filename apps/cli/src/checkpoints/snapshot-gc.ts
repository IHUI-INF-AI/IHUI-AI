// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 会话快照回收判据 —— 三条约束**同时成立**才删,判不出来就一律不删。纯判据层,零 fs。
 * 立因(goal-b49 S3,取证 Q1 §4 #16:对方 244 目录 65 版零清理、无到期概念)。
 * 三档:keepVersions(第 N+1 版才进射程)∧ maxAgeMs(窗内不删)∧ maxTotalBytes(删后仍超上限才删);
 * 任一档保住即记 retained 并写明是哪一档保住的。清单完整性只吃 manifest-integrity 的结果档
 * (type-only import ⇒ 运行时零 fs;AGENTS §0.6 单源),由调用方注入。
 * AGENTS §0.3/§0.10:取不到清单、量不出体积、序列重号或回退、枚举到 0 个候选、策略不合法
 * ⇒ state:'undetermined' 且 deletions 置空并逐条点名 —— 失效方向是「多要一次定向说明」,不是「多放一次删除」。
 */
import type { ManifestReadResult } from './manifest-integrity.js';
import { parseSnapshotSeriesDirName, type SnapshotSeriesRef } from './snapshot-series.js';

/** 清单里 GC 需要的最小自证字段(真实档 CheckpointMeta 结构上覆盖本接口) */
export interface SnapshotGcManifestMeta { id: string; createdAt: string }
/** 快照目录候选;bytes 量不出来传 null ⇒ 判不出 ⇒ 不删 */
export interface SnapshotGcCandidate { dirName: string; bytes: number | null }
export interface SnapshotGcPolicy { keepVersions: number; maxAgeMs: number; maxTotalBytes: number }
export interface SnapshotGcDeps<M extends SnapshotGcManifestMeta> {
  /** 唯一合法实现 = manifest-integrity 的 readManifestChecked;本模块绝不自己开文件 */
  readManifest(dirName: string): ManifestReadResult<M>;
  /** 时钟靠注入:判据不取时间,可重放、可测 */
  nowMs(): number;
}

export type SnapshotGcState = 'planned' | 'clean' | 'undetermined';
export type SnapshotGcRetainReason = 'within-keep-versions' | 'within-age-window' | 'within-size-cap';
export const SNAPSHOT_GC_UNDETERMINED_REASONS = [
  'invalid-policy',
  'no-candidates',
  'malformed-dir-name',
  'size-unmeasurable',
  'duplicate-version',
  'series-regression',
  'manifest-missing',
  'manifest-corrupt',
  'manifest-unreadable',
] as const;
export type SnapshotGcUndeterminedReason = (typeof SNAPSHOT_GC_UNDETERMINED_REASONS)[number];

export interface SnapshotGcDeletion {
  dirName: string;
  uuid: string;
  version: number;
  bytes: number;
  detail: string;
}
export interface SnapshotGcRetained { dirName: string; reason: SnapshotGcRetainReason; detail: string }
export interface SnapshotGcUndetermined {
  dirName: string | null;
  reason: SnapshotGcUndeterminedReason;
  detail: string;
}
export interface SnapshotGcTotals { candidates: number; classifiable: number; series: number; bytes: number }
export interface SnapshotGcPlan {
  state: SnapshotGcState;
  policy: SnapshotGcPolicy;
  totals: SnapshotGcTotals;
  deletions: SnapshotGcDeletion[];
  retained: SnapshotGcRetained[];
  undetermined: SnapshotGcUndetermined[];
  /** 点名行:未判定的必须让人看得出该补什么 */
  notes: string[];
}

/** 默认策略:保留最近 20 版 ∧ 30 天年龄窗 ∧ 单序列 256 MiB 总量上限 */
export const DEFAULT_SNAPSHOT_GC_POLICY: SnapshotGcPolicy = {
  keepVersions: 20,
  maxAgeMs: 30 * 86_400_000,
  maxTotalBytes: 256 * 1024 * 1024,
};

const DAY_MS = 86_400_000;
type Verdict<M> = { ok: true; meta: M } | { ok: false; reason: SnapshotGcUndeterminedReason; detail: string };

export function judgeSnapshotGcPolicy(p: SnapshotGcPolicy): string[] {
  const issues: string[] = [];
  if (!Number.isInteger(p.keepVersions) || p.keepVersions < 1) issues.push(`keepVersions 须 ≥1 整数,实得 ${String(p.keepVersions)}`);
  if (!Number.isFinite(p.maxAgeMs) || p.maxAgeMs < 0) issues.push(`maxAgeMs 须 ≥0 有限毫秒,实得 ${String(p.maxAgeMs)}`);
  if (!Number.isFinite(p.maxTotalBytes) || p.maxTotalBytes < 0) issues.push(`maxTotalBytes 须 ≥0 有限字节,实得 ${String(p.maxTotalBytes)}`);
  return issues;
}

function describeVerdict<M extends SnapshotGcManifestMeta>(name: string, v: ManifestReadResult<M>): Verdict<M> {
  if (v.status === 'ok') return { ok: true, meta: v.meta };
  if (v.status === 'missing') return { ok: false, reason: 'manifest-missing', detail: `${name}: 清单不存在` };
  return { ok: false, reason: 'manifest-corrupt', detail: `${name}: ${v.entry.reason} —— ${v.entry.detail}` };
}

interface Member { dirName: string; ref: SnapshotSeriesRef; bytes: number }
interface GroupOut {
  retained: SnapshotGcRetained[];
  undetermined: SnapshotGcUndetermined[];
  deletions: SnapshotGcDeletion[];
}

function finish(
  policy: SnapshotGcPolicy,
  totals: SnapshotGcTotals,
  out: GroupOut,
  deletions: SnapshotGcDeletion[],
): SnapshotGcPlan {
  const notes = out.undetermined.map((u) => `未判定 ${u.dirName ?? '(整轮)'}: ${u.reason} —— ${u.detail}`);
  const base = { policy, totals, retained: out.retained, undetermined: out.undetermined, notes };
  if (out.undetermined.length > 0) {
    notes.push(`本轮 ${out.undetermined.length} 条候选判不出来 ⇒ deletions 置空,不记绿也不冒红`);
    return { ...base, state: 'undetermined', deletions: [] };
  }
  if (deletions.length > 0) {
    notes.push(`本轮删除 ${deletions.length} 枚:三约束同时成立(最近 ${policy.keepVersions} 版之外 ∧ 超年龄窗 ∧ 删后仍超上限)`);
    return { ...base, state: 'planned', deletions };
  }
  notes.push(`判过 ${totals.classifiable} 枚候选:全部落在保留档内,无需删除`);
  return { ...base, state: 'clean', deletions: [] };
}

function tally(candidates: SnapshotGcCandidate[], addressable: Member[]): SnapshotGcTotals {
  return {
    candidates: candidates.length,
    classifiable: addressable.length,
    series: new Set(addressable.map((m) => m.ref.uuid)).size,
    bytes: addressable.reduce((sum, m) => sum + m.bytes, 0),
  };
}

/** 定序 → 保留档(最近 N 版)→ 清单自证 + 年龄窗 → 总量上限必要性;三档全过才落 deletions */
function judgeGroup<M extends SnapshotGcManifestMeta>(
  members: Member[],
  policy: SnapshotGcPolicy,
  deps: SnapshotGcDeps<M>,
  out: GroupOut,
): void {
  const counts = new Map<number, number>();
  members.forEach((m) => counts.set(m.ref.version, (counts.get(m.ref.version) ?? 0) + 1));
  const colliding = new Set<number>();
  counts.forEach((count, version) => {
    if (count > 1) colliding.add(version);
  });
  if (colliding.size > 0) {
    members
      .filter((m) => colliding.has(m.ref.version))
      .forEach((m) =>
        out.undetermined.push({
          dirName: m.dirName,
          reason: 'duplicate-version',
          detail: `序列 ${m.ref.uuid} 的 v${m.ref.version} 重号 ⇒ 无法定序,本组一枚不删`,
        }),
      );
    return;
  }
  const stale: Member[] = [];
  let newerCtimeMs: number | null = null;
  let regression = false;
  [...members]
    .sort((a, b) => b.ref.version - a.ref.version)
    .forEach((m, index) => {
      if (index < policy.keepVersions) {
        out.retained.push({ dirName: m.dirName, reason: 'within-keep-versions', detail: `第 ${index + 1} 新,在保留的最近 ${policy.keepVersions} 版之内` });
        return;
      }
      let raw: ManifestReadResult<M>;
      try {
        raw = deps.readManifest(m.dirName);
      } catch (err) {
        out.undetermined.push({ dirName: m.dirName, reason: 'manifest-unreadable', detail: `${m.dirName}: 清单读取抛错 —— ${err instanceof Error ? err.message : String(err)}` });
        return;
      }
      const described = describeVerdict(m.dirName, raw);
      if (!described.ok) {
        out.undetermined.push({ dirName: m.dirName, reason: described.reason, detail: described.detail });
        return;
      }
      const ctimeMs = Date.parse(described.meta.createdAt);
      if (!Number.isFinite(ctimeMs)) {
        out.undetermined.push({ dirName: m.dirName, reason: 'manifest-unreadable', detail: `${m.dirName}: createdAt=${described.meta.createdAt} 解析不出时刻` });
        return;
      }
      // 版本更新的一版不得比版本旧的更早;互相矛盾即回退 ⇒ 整组不删
      if (newerCtimeMs !== null && ctimeMs > newerCtimeMs) {
        regression = true;
        out.undetermined.push({ dirName: m.dirName, reason: 'series-regression', detail: `序列 ${m.ref.uuid}:v${m.ref.version} 的 createdAt 比更大版本号那一版还新 ⇒ 判不出谁更新,本组一枚不删` });
      }
      newerCtimeMs = ctimeMs;
      const ageMs = deps.nowMs() - ctimeMs;
      if (ageMs <= policy.maxAgeMs) {
        out.retained.push({ dirName: m.dirName, reason: 'within-age-window', detail: `距今 ${Math.round(ageMs / DAY_MS)} 天,仍在年龄窗内` });
        return;
      }
      stale.push(m);
    });
  if (regression) return;

  let groupBytes = members.reduce((sum, m) => sum + m.bytes, 0);
  for (const m of [...stale].reverse()) {
    if (groupBytes - m.bytes > policy.maxTotalBytes) {
      groupBytes -= m.bytes;
      out.deletions.push({ dirName: m.dirName, uuid: m.ref.uuid, version: m.ref.version, bytes: m.bytes, detail: `超出最近 ${policy.keepVersions} 版 ∧ 超年龄窗 ∧ 删后总量仍超 ${policy.maxTotalBytes} B` });
      continue;
    }
    out.retained.push({ dirName: m.dirName, reason: 'within-size-cap', detail: `删掉它后总量 ${groupBytes} B 已在上限内 ⇒ 不删` });
    break;
  }
}

export function planSnapshotGc<M extends SnapshotGcManifestMeta>(
  candidates: SnapshotGcCandidate[],
  policy: SnapshotGcPolicy,
  deps: SnapshotGcDeps<M>,
): SnapshotGcPlan {
  const out: GroupOut = { retained: [], undetermined: [], deletions: [] };
  const issues = judgeSnapshotGcPolicy(policy);
  if (issues.length > 0) {
    candidates.forEach((c) => out.undetermined.push({ dirName: c.dirName, reason: 'invalid-policy', detail: issues.join(';') }));
    return finish(policy, tally(candidates, []), out, out.deletions);
  }
  if (candidates.length === 0) {
    out.undetermined.push({ dirName: null, reason: 'no-candidates', detail: '枚举到 0 个候选:判「未判定」,不得用 0 冒充「没有可删」' });
    return finish(policy, tally(candidates, []), out, out.deletions);
  }
  const addressable: Member[] = [];
  candidates.forEach((c) => {
    const parsed = parseSnapshotSeriesDirName(c.dirName);
    if (!parsed.ok) {
      out.undetermined.push({ dirName: c.dirName, reason: 'malformed-dir-name', detail: parsed.detail });
      return;
    }
    if (c.bytes === null || !Number.isFinite(c.bytes) || c.bytes < 0) {
      out.undetermined.push({ dirName: c.dirName, reason: 'size-unmeasurable', detail: `${c.dirName}: 体积量不出来(bytes=${String(c.bytes)}),量不出就不删` });
      return;
    }
    addressable.push({ dirName: c.dirName, ref: parsed.ref, bytes: c.bytes });
  });
  const groups = new Map<string, Member[]>();
  addressable.forEach((m) => {
    const bucket = groups.get(m.ref.uuid);
    if (bucket) bucket.push(m);
    else groups.set(m.ref.uuid, [m]);
  });
  groups.forEach((members) => judgeGroup(members, policy, deps, out));
  return finish(policy, tally(candidates, addressable), out, out.deletions);
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
