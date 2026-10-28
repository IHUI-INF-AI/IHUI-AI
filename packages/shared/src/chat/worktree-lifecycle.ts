// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D72 Worktree 生命周期对话流卡 · 共享层判定(G-99,2026-09-23 立)
//
// **数据面纪律**:本模块**不取数**。web 侧当前**没有** worktree 数据面
// (无 API 路由、无 SSE 帧),故本票交付「判定层 + 渲染件」:事件由调用方注入,
// 卡片自己不 fetch;状态判定一律走本模块,禁止在端内另建一套 worktree 状态判定。
//
// 八态是**唯一真相源**,与 §12d(git worktree 多会话隔离规范)对齐:
//   creating      创建中
//   ready         已创建
//   initFailed    初始化失败
//   timeout       超时(**必须**带"请检查仓库状态"提示键,不得只显示"超时")
//   cleaned       已被清理(收编终态;文案逐字见词包 `state.cleaned`)
//   restoring     恢复中
//   restored      已恢复(**可恢复终态**)
//   restoreFailed 无法恢复(**不可恢复终态**;必须显式渲染,不得静默留空)
//
// 与 §12d 收编流程的关系:收编 = `cherry-pick` → `worktree remove` → `prune` 三阶段;
// `stageToState` 把阶段进度映射回八态,**三阶段全完成 ⇒ cleaned**(与收编终态一致,
// 不得提前宣称已清理)。
//
// 单写者原则(§12d 第一优先):同一 task 同时只允许一个**活跃** worktree,
// `isSingleWriterViolation` 是这条约束的判定层(不新增第二套写者模型)。

/** Worktree 生命周期八态(取值即 i18n 键片段) */
export const WORKTREE_STATES = [
  'creating',
  'ready',
  'initFailed',
  'timeout',
  'cleaned',
  'restoring',
  'restored',
  'restoreFailed',
] as const
export type WorktreeState = (typeof WORKTREE_STATES)[number]

/** 语义色档(判定层只给语义,具体样式由渲染件决定) */
export const WORKTREE_TONES = ['neutral', 'success', 'warning', 'danger'] as const
export type WorktreeTone = (typeof WORKTREE_TONES)[number]

/** 生命周期事件(数据面接入前由调用方构造;`at` 为 ISO 时间串,可选) */
export interface WorktreeLifecycleEvent {
  readonly state: WorktreeState
  /** 归属 task(单写者守卫的判据之一;缺失时守卫不臆断) */
  readonly taskId?: string
  readonly branch?: string
  /** worktree 路径(§12d 约定 `.worktrees/<task_id>`) */
  readonly path?: string
  /** 失败 / 超时原因(诊断用,原样展示,不翻译) */
  readonly reason?: string
  readonly at?: string
}

/** 活跃态:真正持有 working tree 的两个态(单写者约束的作用域) */
export const ACTIVE_WORKTREE_STATES = ['creating', 'ready'] as const

/** 终态:不再有进行中的写者(cleaned 已在收编终态;restored / restoreFailed 是恢复终态) */
export const TERMINAL_WORKTREE_STATES = ['cleaned', 'restored', 'restoreFailed'] as const

/** 恢复 / 回收入口动作族(渲染件按 view 的开关取用) */
export const WORKTREE_ACTIONS = ['restore', 'retryRestore', 'reclaimDisk', 'dismiss'] as const
export type WorktreeAction = (typeof WORKTREE_ACTIONS)[number]

/** 提示三类:超时检查仓库 / 已清理 / 单写者约束 */
export const WORKTREE_HINTS = ['timeout', 'cleaned', 'singleWriter'] as const
export type WorktreeHint = (typeof WORKTREE_HINTS)[number]
export type WorktreeHintKey = `hint.${WorktreeHint}`

const STATE_SET: ReadonlySet<string> = new Set<string>(WORKTREE_STATES)
const ACTIVE_STATE_SET: ReadonlySet<string> = new Set<string>(ACTIVE_WORKTREE_STATES)
const TERMINAL_STATE_SET: ReadonlySet<string> = new Set<string>(TERMINAL_WORKTREE_STATES)

export function isWorktreeState(value: string): value is WorktreeState {
  return STATE_SET.has(value)
}

export function isActiveWorktreeState(state: WorktreeState): boolean {
  return ACTIVE_STATE_SET.has(state)
}

export function isTerminalWorktreeState(state: WorktreeState): boolean {
  return TERMINAL_STATE_SET.has(state)
}

/** 视图派发结果(渲染件只读这五个字段,判据一律不落回端内) */
export interface WorktreeView {
  readonly state: WorktreeState
  readonly tone: WorktreeTone
  /** 是否给恢复入口(timeout / initFailed / cleaned / restoreFailed) */
  readonly showRestore: boolean
  /** 是否给磁盘回收入口(仅 cleaned) */
  readonly showReclaim: boolean
  readonly hintKey: WorktreeHintKey | null
}

/**
 * 事件 → 视图判据的**唯一**派发点。
 *
 * switch 穷尽八态、**无 default**:漏改任一态 ⇒ `event.state` 无法收窄为 `never`,
 * `assertNeverState` 处编译失败(新增态必须同步补判据,否则构建拦截)。
 */
export function worktreeView(
  event: WorktreeLifecycleEvent | null | undefined,
): WorktreeView | null {
  if (!event) return null
  switch (event.state) {
    case 'creating':
      return { state: 'creating', tone: 'neutral', showRestore: false, showReclaim: false, hintKey: null }
    case 'ready':
      // 已就绪即活跃写者:提示单写者约束(同一 task 不得再取第二个 worktree)
      return { state: 'ready', tone: 'success', showRestore: false, showReclaim: false, hintKey: 'hint.singleWriter' }
    case 'initFailed':
      return { state: 'initFailed', tone: 'danger', showRestore: true, showReclaim: false, hintKey: null }
    case 'timeout':
      // 超时不得只显示"超时":必须同时给出"请检查仓库状态"
      return { state: 'timeout', tone: 'warning', showRestore: true, showReclaim: false, hintKey: 'hint.timeout' }
    case 'cleaned':
      // 已清理:给恢复入口 + 额外给磁盘回收入口
      return { state: 'cleaned', tone: 'warning', showRestore: true, showReclaim: true, hintKey: 'hint.cleaned' }
    case 'restoring':
      return { state: 'restoring', tone: 'neutral', showRestore: false, showReclaim: false, hintKey: null }
    case 'restored':
      // 可恢复终态:已恢复完成,不再给恢复入口(与 restoreFailed 必须不同形)
      return { state: 'restored', tone: 'success', showRestore: false, showReclaim: false, hintKey: null }
    case 'restoreFailed':
      // 不可恢复终态:必须显式渲染并给"重试恢复"入口,不得静默留空
      return { state: 'restoreFailed', tone: 'danger', showRestore: true, showReclaim: false, hintKey: null }
  }
  return assertNeverState(event.state)
}

/** 编译期穷尽性断言(运行时兜底;正常路径不可达) */
function assertNeverState(state: never): never {
  throw new Error(`unhandled worktree state: ${String(state)}`)
}

/** §12d 收编三阶段(顺序即执行顺序) */
export const WORKTREE_ACQUIRE_STAGES = ['cherryPick', 'worktreeRemove', 'prune'] as const
export type WorktreeAcquireStage = (typeof WORKTREE_ACQUIRE_STAGES)[number]

const STAGE_SET: ReadonlySet<string> = new Set<string>(WORKTREE_ACQUIRE_STAGES)

export function isWorktreeAcquireStage(value: string): value is WorktreeAcquireStage {
  return STAGE_SET.has(value)
}

/**
 * 收编阶段进度 → 八态(与 §12d 收编流程状态一致):
 *   · 未开始(0 阶段)     ⇒ `ready`(worktree 仍在,可正常使用)
 *   · 已完成 1~2 阶段      ⇒ `restoring`(收编进行中;**不得**提前宣称已清理)
 *   · 三阶段全完成         ⇒ `cleaned`(收编终态:已 cherry-pick、已 remove、已 prune)
 *
 * 只按"阶段是否完成"计数,不依赖传入顺序(乱序亦等价)。
 */
export function stageToState(completed: readonly WorktreeAcquireStage[]): WorktreeState {
  const done = new Set<WorktreeAcquireStage>(completed)
  const count = WORKTREE_ACQUIRE_STAGES.reduce((acc, stage) => (done.has(stage) ? acc + 1 : acc), 0)
  if (count === WORKTREE_ACQUIRE_STAGES.length) return 'cleaned'
  if (count > 0) return 'restoring'
  return 'ready'
}

/**
 * 单写者守卫(§12d 第一优先):同一 task 同时只允许一个**活跃** worktree。
 *
 * 判据(逐条可测,不臆断):
 *   1. 任一侧缺失 / 任一侧 `taskId` 缺失 ⇒ `false`(taskId 未知时不判违规);
 *   2. `taskId` 不同 ⇒ `false`(不同任务各写各的);
 *   3. 两侧路径都已知且相同 ⇒ `false`(同一 worktree 的重复上报,不是第二个写者);
 *   4. 其余:两侧同为活跃态(creating / ready)⇒ `true`。
 */
export function isSingleWriterViolation(
  existing: WorktreeLifecycleEvent | null | undefined,
  incoming: WorktreeLifecycleEvent | null | undefined,
): boolean {
  if (!existing || !incoming) return false
  if (!existing.taskId || !incoming.taskId) return false
  if (existing.taskId !== incoming.taskId) return false
  if (existing.path && incoming.path && existing.path === incoming.path) return false
  return isActiveWorktreeState(existing.state) && isActiveWorktreeState(incoming.state)
}

/** 八态 → i18n 键名(`ai.pane.worktree.state.<key>`) */
export function worktreeStateKey(state: WorktreeState): string {
  return `state.${state}`
}

/** 动作 id → i18n 键名(`ai.pane.worktree.action.<key>`) */
export function worktreeActionKey(action: WorktreeAction): string {
  return `action.${action}`
}

/** 提示 → i18n 键名(`ai.pane.worktree.hint.<key>`) */
export function worktreeHintKey(hint: WorktreeHint): WorktreeHintKey {
  return `hint.${hint}`
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
