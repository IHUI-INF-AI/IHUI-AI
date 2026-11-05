// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 回收站到期清理 —— 结论对象与入参(goal-b49 W7 未竟 1)。
 * 单列一档只为守住「每文件 < 250 行」;判据一律不在这里,见 `./trash-prune.js`。
 */

import type { ExpiryRunGate, ExpiryRunLedger, TrashExpiryPlan } from '@ihui/shared/delete-guard';
import type { TrashPruneRemoval, TrashPruneSkip } from './trash-prune-io.js';

/** 结论三态(gate = 闸门怎么说,state = 这一轮到底发生了什么;两者不是一回事) */
export type TrashPruneState = 'clean' | 'pruned' | 'undetermined';
/** 闸门态 + 空账档(空账连闸门都不进 ⇒ 零写零噪声) */
export type TrashPruneGate = ExpiryRunGate | 'empty';

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
