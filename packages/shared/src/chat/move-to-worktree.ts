// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D102 对话移交工作树 · 共享层判定(G-140,2026-09-24 立)
//
// **自证结论(改本文件前先读)**:服务端 worktree 能力已存在
// (`apps/ai-service/app/services/worktree.py`,另 core/sandbox_policy.py、
// services/dag_scheduler.py 引用),缺的是 api 路由面与 web 交互面;web 侧
// D72 已落地 `worktree-lifecycle.ts`(八态 / 单写者守卫)。本模块**不新写
// worktree 底层**,只做「取能力 → 表达层」:与 D72/D71 同范式
// (常量 + 纯函数 + 穷尽 switch 零 default + assertNever),判定复用点:
//   · 运行中禁止态 `canMoveNow` 直接复用 D71 `turn-status` 的
//     `isActiveTurnState`(turn 未到终态 ⇒ 禁止移交),不另立第二套运行判定;
//   · 本模块**不重复** D72 的八态生命周期判定 —— 移交弹层只关心"现在能不能走",
//     worktree 创建后的生命周期仍由 `worktree-lifecycle` 唯一裁决。

import { isActiveTurnState, type TurnState } from './turn-status'

/** 移交目标两态:创建新工作树 / 移入已有工作树 */
export const MOVE_TO_WORKTREE_TARGETS = ['createNew', 'existing'] as const
export type MoveToWorktreeTarget = (typeof MOVE_TO_WORKTREE_TARGETS)[number]

/**
 * 能力前置检查三态(即分支可用性异步三态):
 *   loading 分支加载中(键 branchesLoading,弹层主行同时给 `loading`)
 *   ready   检查通过,可继续
 *   error   加载失败(键 branchesError,附 branchesRetry 重试入口)
 */
export const MOVE_TO_WORKTREE_PRECHECKS = ['loading', 'ready', 'error'] as const
export type MoveToWorktreePrecheck = (typeof MOVE_TO_WORKTREE_PRECHECKS)[number]

/** 四条分支名校验错误键(校验顺序即数组顺序,见 validateWorktreeBranch) */
export const WORKTREE_BRANCH_ERRORS = [
  'worktreeBranchRequired',
  'trailingSlashError',
  'defaultBranchError',
  'branchAlreadyExists',
] as const
export type WorktreeBranchErrorKey = (typeof WORKTREE_BRANCH_ERRORS)[number]

/** 提交门的全部阻断键(运行中禁止态 + 前置检查 + 分支名校验) */
export const MOVE_TO_WORKTREE_BLOCK_KEYS = [
  'existingWorktreeRunning',
  'branchesLoading',
  'branchesError',
  ...WORKTREE_BRANCH_ERRORS,
] as const
export type MoveToWorktreeBlockKey = (typeof MOVE_TO_WORKTREE_BLOCK_KEYS)[number]

/** 词包命名空间(web 侧 `useTranslations('ai.pane.moveToWorktree')`) */
export const MOVE_TO_WORKTREE_NAMESPACE = 'ai.pane.moveToWorktree' as const

/** 词包 21 键白名单(title/subtitle/continue/cancel/loading/运行禁止/两目标/本地联动/空态/分支三态/四校验/ariaLabel) */
export const MOVE_TO_WORKTREE_KEYS = [
  'title',
  'subtitle',
  'continue',
  'cancel',
  'loading',
  'existingWorktreeRunning',
  'existingWorktreeLabel',
  'createNewLabel',
  'targetLabel',
  'localCheckoutLabel',
  'localBranchPlaceholder',
  'noTargetBranch',
  'branchesLoading',
  'branchesError',
  'branchesRetry',
  'branchAlreadyExists',
  'defaultBranchError',
  'trailingSlashError',
  'worktreeBranchRequired',
  'worktreeBranchAriaLabel',
  'worktreeBranchLabel',
] as const
export type MoveToWorktreeMessageKey = (typeof MOVE_TO_WORKTREE_KEYS)[number]

/** 键名生成器:白名单内的键原样下发(防调用点手写错键编译报错) */
export function moveToWorktreeKey(key: MoveToWorktreeMessageKey): MoveToWorktreeMessageKey {
  return key
}

/**
 * 前置检查三态 → 分支区状态键(穷尽 switch 零 default;ready 无状态键)。
 * 漏改任一态 ⇒ `assertNeverPrecheck` 处编译失败。
 */
export function precheckStatusKey(precheck: MoveToWorktreePrecheck): 'branchesLoading' | 'branchesError' | null {
  switch (precheck) {
    case 'loading':
      return 'branchesLoading'
    case 'error':
      return 'branchesError'
    case 'ready':
      return null
  }
  return assertNeverPrecheck(precheck)
}

/** 编译期穷尽性断言(运行时兜底;正常路径不可达) */
function assertNeverPrecheck(precheck: never): never {
  throw new Error(`unhandled move-to-worktree precheck: ${String(precheck)}`)
}

/**
 * 运行中禁止态判定:会话仍在跑(turn 未到终态)时必须禁止移交。
 *
 * **复用点**:turn 活跃性判定直接取 D71 `turn-status.isActiveTurnState`,
 * 不另立第二套"运行中"模型;turn 状态缺失(null/undefined)时不臆断,
 * 与 D72 `isSingleWriterViolation` 的"缺失不判违规"同纪律。
 */
export function canMoveNow(turnState: TurnState | null | undefined): boolean {
  if (turnState === null || turnState === undefined) return true
  return !isActiveTurnState(turnState)
}

export interface WorktreeBranchContext {
  /** 默认分支名(main/master);未知传 null,不触发 defaultBranchError */
  readonly defaultBranch?: string | null
  /** 已存在工作树的分支名单(含当前对话所在分支) */
  readonly existingBranches?: readonly string[]
}

export interface WorktreeBranchValidation {
  readonly ok: boolean
  /** 首个命中的错误键;ok 时为 null(四条固定顺序,只报第一条) */
  readonly errorKey: WorktreeBranchErrorKey | null
}

/**
 * 四条分支名校验,顺序**固定**:
 *   1. worktreeBranchRequired —— 空名连校验对象都没有,必须最先挡;
 *   2. trailingSlashError     —— 语法缺陷,名字本身非法,先于语义类检查;
 *   3. defaultBranchError     —— 语义规则一:工作树分支必须不同于默认分支;
 *   4. branchAlreadyExists    —— 语义规则二:该分支已有工作树(依赖外部名单,
 *      最"贵"且最易变,放最后;前两条不过时查它没有意义)。
 * 只报**第一条**命中项:弹层一次只提示一条,修一条再看下一条。
 */
export function validateWorktreeBranch(
  name: string | null | undefined,
  ctx: WorktreeBranchContext = {},
): WorktreeBranchValidation {
  const trimmed = typeof name === 'string' ? name.trim() : ''
  if (trimmed.length === 0) return { ok: false, errorKey: 'worktreeBranchRequired' }
  if (trimmed.endsWith('/')) return { ok: false, errorKey: 'trailingSlashError' }
  if (
    (ctx.defaultBranch !== null && ctx.defaultBranch !== undefined) &&
    ctx.defaultBranch.length > 0 &&
    trimmed === ctx.defaultBranch
  ) {
    return { ok: false, errorKey: 'defaultBranchError' }
  }
  if (ctx.existingBranches?.includes(trimmed)) {
    return { ok: false, errorKey: 'branchAlreadyExists' }
  }
  return { ok: true, errorKey: null }
}

export interface BranchListView {
  /** 分支区状态键(loading/error);ready 为 null */
  readonly statusKey: 'branchesLoading' | 'branchesError' | null
  /** ready 且无其他本地分支 ⇒ 空态 noTargetBranch */
  readonly empty: boolean
  /** ready 且有分支 ⇒ 下拉可选的本地分支名单 */
  readonly branches: readonly string[]
}

/**
 * 空态判定:无其他本地分支可用时给 noTargetBranch。
 * 分支名单缺失(null/undefined)按空态处理 —— "不知道有什么分支"不能伪装成"有分支可选"。
 */
export function branchListView(
  precheck: MoveToWorktreePrecheck,
  branches?: readonly string[] | null,
): BranchListView {
  const statusKey = precheckStatusKey(precheck)
  if (statusKey !== null) return { statusKey, empty: false, branches: [] }
  const list = branches ?? []
  return { statusKey: null, empty: list.length === 0, branches: list }
}

export interface MoveToWorktreeSubmitInput {
  /** 当前 turn 状态(缺失不臆断,见 canMoveNow) */
  readonly turnState?: TurnState | null
  readonly precheck?: MoveToWorktreePrecheck
  readonly target: MoveToWorktreeTarget
  /** createNew ⇒ 手输分支名;existing ⇒ 从已有工作树分支中选定 */
  readonly branch?: string | null
  readonly defaultBranch?: string | null
  readonly existingWorktreeBranches?: readonly string[]
}

export interface MoveToWorktreeSubmitView {
  readonly canContinue: boolean
  /** 阻断原因键(词包 `ai.pane.moveToWorktree` 内);可继续时为 null */
  readonly blockKey: MoveToWorktreeBlockKey | null
}

/**
 * 提交判定(continue 门的**唯一**真相源),检查顺序:
 *   1. 运行中禁止(turn 活跃)—— 硬闸,任何其余检查都在它之后;
 *   2. 前置检查未通过(loading/error)—— 还不知道"能不能移",不许提交;
 *   3. 分支校验 —— createNew 走四条固定顺序全量校验;existing **只**校验
 *      "必须选定"(worktreeBranchRequired):所选分支本就来自已有工作树名单,
 *      branchAlreadyExists 对它恒真、defaultBranch/trailingSlash 由名单数据面
 *      保证,套用反而把提交门焊死;
 *   4. 全过 ⇒ canContinue。
 */
export function submitView(input: MoveToWorktreeSubmitInput): MoveToWorktreeSubmitView {
  if (!canMoveNow(input.turnState)) {
    return { canContinue: false, blockKey: 'existingWorktreeRunning' }
  }
  const precheck = input.precheck ?? 'ready'
  if (precheck === 'loading') return { canContinue: false, blockKey: 'branchesLoading' }
  if (precheck === 'error') return { canContinue: false, blockKey: 'branchesError' }
  if (input.target === 'existing') {
    const chosen = typeof input.branch === 'string' ? input.branch.trim() : ''
    return chosen.length > 0
      ? { canContinue: true, blockKey: null }
      : { canContinue: false, blockKey: 'worktreeBranchRequired' }
  }
  const validation = validateWorktreeBranch(input.branch, {
    defaultBranch: input.defaultBranch,
    existingBranches: input.existingWorktreeBranches,
  })
  if (!validation.ok) return { canContinue: false, blockKey: validation.errorKey }
  return { canContinue: true, blockKey: null }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
