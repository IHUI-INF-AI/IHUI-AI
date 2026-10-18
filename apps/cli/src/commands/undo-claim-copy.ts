// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D163 收口刀:回退结论 → 用户看到的那一句。
 *
 * 分工:本模块只做"选哪一句、插哪些值",**不**做裁决。裁决在
 * `undo-workspace-state.ts` 的 `classifyUndoVerdict`(三态判据)与
 * `undo-redo.ts` 的 UndoResult 上。理由:判据要有牙(可单测、可变异对照),
 * 文案要可对账(五语齐、键名封闭);两者混在一个文件里就都测不干净。
 *
 * 与 web 侧 `apps/web/src/lib/undo-fact-check.ts` 的关系:同一个三态口径、
 * 同一句铁律 —— "工作区未发生变化"只在 verdict==='unchanged' 时出现。
 * 键名与 web 侧逐字对齐(见 `UNDO_CLAIM_KEYS`),唯独 `undoFailed` 不落 CLI
 * 词包:它在 web 侧的语义是"恢复失败 + 未变化",而 CLI 侧这个组合恰好就是
 * `partial`(部分文件写失败)⇒ 票面专为 CLI 写的那句 `undoPartialWarning`
 * 已完整覆盖。差异不静默漂移,由 `packages/i18n/tests/d163-cli-parity.test.ts`
 * 逐字钉住。
 */

/**
 * 文案键(相对 `cliEntry.` 命名空间,与 undoDesc/undoDone 同一层)。
 *
 * 顺序即票面六态 + 失败三拆:preparing → confirm → succeeded → partial →
 * unavailable → failed(changed / unverifiable)。
 */
export const UNDO_CLAIM_KEYS = [
  'undoPreparing',
  'undoConfirm',
  'undoSucceeded',
  'undoPartialWarning',
  'undoUnavailable',
  'undoFailedChanged',
  'undoFailedUnverifiable',
] as const;

export type UndoClaimKey = (typeof UNDO_CLAIM_KEYS)[number];

/** i18n 里七键挂在 cliEntry 下;渲染时才拼前缀,键表本身保持与 web 侧同名。 */
export const UNDO_CLAIM_KEY_PREFIX = 'cliEntry.';

/** 三态(与 `undo-workspace-state.ts` 的 UndoVerdict 同义,这里用结构型避免命令层被反依赖)。 */
export type UndoVerdictLike = 'unchanged' | 'changed' | 'unknown';

/** `selectUndoClaimKey` 的入参:只要"已经跑完的回退"这一份结论。 */
export interface UndoClaimInput {
  readonly verdict: UndoVerdictLike;
  /** 有文件没撤成 ⇒ 撤销结果不完整 */
  readonly partial: boolean;
  readonly undoneSteps: number;
}

/**
 * 回退结论 → 该说哪一句(纯函数:不插值、不碰 i18n、不读文件)。
 *
 * 互斥顺序写死,从上到下第一个命中即返回,每条对应票面一态:
 *   1. verdict==='changed'  ⇒ undoFailedChanged      (确证变了,明说)
 *   2. verdict==='unknown'  ⇒ undoFailedUnverifiable (判不了,不声称)
 *   3. partial              ⇒ undoPartialWarning     (部分修改不在检查点中)
 *   4. undoneSteps===0      ⇒ undoUnavailable        (没有可回滚的项)
 *   5. 其余                 ⇒ undoSucceeded          (干净成功)
 *
 * 反向锁(变异对照的依据):把 1、2 的顺序对调,会把"真变了、但另有一个文件
 * 读不出来"说成"判不了" —— 确证事实被降级成未决,这正是票面禁的那类谎。
 * 把 2 删掉则"无法核实"这句永远说不出口,失败全被读成"已发生变化"。
 */
export function selectUndoClaimKey(input: UndoClaimInput): UndoClaimKey {
  if (input.verdict === 'changed') return 'undoFailedChanged';
  if (input.verdict === 'unknown') return 'undoFailedUnverifiable';
  if (input.partial) return 'undoPartialWarning';
  if (input.undoneSteps === 0) return 'undoUnavailable';
  return 'undoSucceeded';
}

/** CLI `t()` 的签名(只依赖结构,不 import apps/cli 的 i18n 实例,防环)。 */
export type Translate = (key: string, params?: Record<string, string | number>) => string;

/** 准备态:快照采集之前。 */
export function renderUndoPreparing(t: Translate): string {
  return t(UNDO_CLAIM_KEY_PREFIX + 'undoPreparing');
}

/** 确认态:将恢复多少文件、影响多少轮(任务记录不动)。 */
export function renderUndoConfirm(fileCount: number, turnCount: number, t: Translate): string {
  return t(UNDO_CLAIM_KEY_PREFIX + 'undoConfirm', { fileCount, turnCount });
}

/** 成功态:带恢复文件数插值。 */
export function renderUndoSucceeded(count: number, t: Translate): string {
  return t(UNDO_CLAIM_KEY_PREFIX + 'undoSucceeded', { count });
}

/** 把 selectUndoClaimKey 选中的那句真正渲染出来(插值参数按各态给齐)。 */
export function renderUndoClaim(input: UndoClaimInput, t: Translate): string {
  const key = selectUndoClaimKey(input);
  if (key === 'undoSucceeded') return renderUndoSucceeded(input.undoneSteps, t);
  return t(UNDO_CLAIM_KEY_PREFIX + key);
}
