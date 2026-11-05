// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 回收站到期清理 —— 结论对象与入参(goal-b49 W7 未竟 1)。
 * 单列一档只为守住「每文件 < 250 行」;判据一律不在这里,见 `./trash-prune.js`。
 */

import type {
  ExpiryRunGate,
  ExpiryRunLedger,
  TrashExpiryPlan,
  TrashExpiryUnit,
  TrashManifest,
} from '@ihui/shared/delete-guard';

/** 结论三态(gate = 闸门怎么说,state = 这一轮到底发生了什么;两者不是一回事) */
export type TrashPruneState = 'clean' | 'pruned' | 'undetermined';
/** 闸门态 + 空账档(空账连闸门都不进 ⇒ 零写零噪声) */
export type TrashPruneGate = ExpiryRunGate | 'empty';

/** 一次成功摘除(件已按判据层放行并真删) */
export interface TrashPruneRemoval {
  readonly trashId: string;
  readonly relativeTrashPath: string;
  readonly bytes: number;
}

/** 未删原因(逐条点名:判不出 / 超上限 / 清单坏 / 删除失败)—— 空账时不产生任何条目 */
export interface TrashPruneSkip {
  readonly trashId: string | null;
  readonly relativeTrashPath: string | null;
  readonly reason: string;
}

/** 一份在册清单的现场快照(枚举腿产出;判据层不读它,只读摊平后的 unit) */
export interface ScannedTrash {
  readonly trashId: string;
  readonly dir: string;
  readonly manifest: TrashManifest;
}

/**
 * 逐行现场分桶(Z7 未竟 1 的隔离腿)。**端内 IO 事实,不是到期判据**:
 * `units` 才有资格进判据层;`quarantined` 只改索引(件已实证不在 ⇒ 零字节删除);
 * `frozen` 不碰不删不改清单,只逐条点名。三者互斥,一条行只落一桶。
 */
export interface RowBuckets {
  readonly units: TrashExpiryUnit[];
  readonly quarantined: TrashPruneSkip[];
  readonly frozen: TrashPruneSkip[];
  /** trashId → 该剔出清单的 relativeTrashPath(件已不在的坏账行) */
  readonly indexHits: Map<string, Set<string>>;
}

/** 人工复位连败账目的结论(ok ⇒ 已写回并留痕;拒 ⇒ 一个字没写) */
export type TrashPruneResetOutcome = { ok: true; before: ExpiryRunLedger } | { ok: false; reason: string };

export interface TrashPruneResult {
  readonly state: TrashPruneState;
  readonly gate: TrashPruneGate;
  readonly reason: string;
  readonly scanned: { readonly manifests: number; readonly entries: number };
  readonly removed: readonly TrashPruneRemoval[];
  /** 删除腿真失败(ACL 拒 / fs 抛错 / 清单改不回去)——与"判不出"分开记 */
  readonly failed: readonly TrashPruneSkip[];
  /** 未删原因(判不出 / 超上限 / 清单坏);空账时恒为空数组 */
  readonly skipped: readonly TrashPruneSkip[];
  /** 坏账行(件已删、清单没改回):只改索引 + 留痕,不让它冻结其余条目(Z7 未竟 1) */
  readonly quarantined: readonly TrashPruneSkip[];
  /** 量不到的活行(权限/超枚举预算/非文件):盘上原样、清单原样、逐条点名(Z7 未竟 1) */
  readonly frozen: readonly TrashPruneSkip[];
  /** 剔空后仍留有未登记内容的目录壳:不摘壳,只具名(不新增删除面) */
  readonly ghosts: readonly string[];
  readonly reclaimedBytes: number;
  /** 判据层"超上限只报数"的读数(不是本层算的) */
  readonly overBudget: { readonly entries: number; readonly bytes: number };
  /** 判据层原样透出(要逐桶读数读它,别读 summary) */
  readonly plan: TrashExpiryPlan | null;
  /** 写回的账目;未写(空账 / 闸门未放行)⇒ null */
  readonly ledger: ExpiryRunLedger | null;
  /** 判据层生成的结论行原文(不重算) */
  readonly lines: readonly string[];
  /** 守护日志用单行 ASCII(不含绝对路径原文) */
  readonly summary: string;
}

export interface TrashPruneOptions {
  /** 注入时钟(缺省取系统时刻);解析不出 ⇒ 闸门与判据均判未判定 */
  readonly nowIso?: string;
  readonly retentionMs?: number;
  readonly maxEntries?: number;
  readonly maxBytes?: number;
  readonly minIntervalMs?: number;
  readonly quarantineMs?: number;
  readonly maxStrikes?: number;
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
