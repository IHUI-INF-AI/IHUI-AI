// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * diff 暂存状态机(D88,2026-09-23 立:对标 Codex diff.actionButton.stage/unstage)。
 *
 * 与 W5 的「接受/拒绝」(accepted 维度)正交:`staged` 表示 hunk 是否已锁定进
 * 「已交付批次」(git 工作区暂存的对等语义)。staged 的 hunk 不再参与 accepted 切换
 * (UI 勾选框禁用),unstage(还原)后回到可选状态。revert = unstage + 恢复可选,
 * 本任务不做真实 git 工作区回滚(那是后端 apply-diff 链路的事)。
 *
 * 纯函数、确定性、可单测;不引入 React 依赖,便于在组件与单测间共享。
 */

/** 暂存集合:已锁定进交付批次的 hunk id 集合(不可变,返回新集合) */
export type StagedSet = ReadonlySet<number>

/** 空暂存集合 */
export function createStagedSet(): StagedSet {
  return new Set<number>()
}

/** 暂存单个 hunk */
export function stageHunk(staged: StagedSet, hunkId: number): Set<number> {
  const next = new Set(staged)
  next.add(hunkId)
  return next
}

/** 取消暂存单个 hunk(还原) */
export function unstageHunk(staged: StagedSet, hunkId: number): Set<number> {
  const next = new Set(staged)
  next.delete(hunkId)
  return next
}

/** 文件级/全部:把给定 hunk id 全部暂存(用于「全部暂存」) */
export function stageHunks(staged: StagedSet, hunkIds: Iterable<number>): Set<number> {
  const next = new Set(staged)
  for (const id of hunkIds) next.add(id)
  return next
}

/** 文件级/全部:清空暂存(用于「全部还原」) */
export function unstageAll(): Set<number> {
  return new Set<number>()
}

/** 判定 hunk 是否已暂存 */
export function isStaged(staged: StagedSet, hunkId: number): boolean {
  return staged.has(hunkId)
}

/**
 * staged 的 hunk 锁定,不再参与 accepted 切换(UI 勾选框禁用)。
 * 与 accepted 正交:staging 不改变 rejected/accepted 集合。
 */
export function canToggleAccepted(staged: StagedSet, hunkId: number): boolean {
  return !staged.has(hunkId)
}
