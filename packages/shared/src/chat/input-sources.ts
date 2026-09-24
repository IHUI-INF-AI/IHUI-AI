// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D89 输入源与队列小项打包 —— 判定层(G-119/G-121/G-122,2026-09-24 立)
//
// **自证结论(改本文件前先读)**:
//   · 智能快照:HEAD `apps/web/src` 内「智能快照」零命中(snapshot 命中均为 git/
//     environment 语境);`add-menu-popover.tsx` 现有菜单(模板/引用/Skill 库/附件/
//     语音/插件市场/深度研究/压缩)**没有**智能快照入口,更没有「附加 {appName}」
//     与首次使用引导 —— 本票三态判定层为零,全缺。
//   · 队列命令化 + Undo:D89 主线已在 `apps/web/src/lib/command-registry.ts` 落
//     `CHAT_QUEUE_COMMANDS`(queuePrompt/steerPrompt,词键 commandPalette.commands.*)
//     与 `chat.queueUndoRestored*` 词键;本模块是**同语义的判定层镜像**(同一组 id、
//     同一组 semantic),不立第二套排队,词文案以 `ai.pane.inputSources` 为本票词域。
//   · 记忆引用:「记忆引用 / memoryRef」HEAD 全仓零命中 —— 计数条全缺。
//     goal 成就耗时条:`goal-card.tsx` 已落 `achievedInTime` 渲染(内置 h/m/s 格式化);
//     本模块提供**人类可读本地化时长**的判定层(复用 D67 `formatDurationHuman`,
//     不重复造轮子)。
//
// 范式同 D71 turn-status / D67 quota-ownership / D69 input-notices:
// 常量 + 纯函数 + 穷尽 switch 零 default + assertNever;端内不得再建第二套判定。
//
// **与 W27 不冲突(判定层纪律,同 D75/D69)**:本模块**只读不写** —— 三段全部是
// 纯函数,不 import 任何队列 store 与发送短路链(结构断言在测试里锁死),不产出
// 任何会改变队首选择的状态;QUEUE_COMMANDS 只是命令项的**描述性视图**(id/文案键/
// 语义归属标签),真正的入队/出队仍由 W27 预备消息优先规则原样执行,Undo 的三态
// 视图同样只描述"恢复动作进行到哪一步",恢复本体在调用方。

import { formatDurationHuman, ZH_DURATION_UNITS, type DurationUnitLabels } from './quota-ownership'

/** 词包命名空间(web 侧 `useTranslations('ai.pane.inputSources')`) */
export const INPUT_SOURCES_NAMESPACE = 'ai.pane.inputSources' as const

// ---------------------------------------------------------------------------
// ① 智能快照:三态 + 首次使用引导 + 「附加 {appName}」 + 分流判定
// ---------------------------------------------------------------------------

/**
 * 智能快照三态(自证定名:快照能力只有「关/开/开但失败」三种真实状态,
 * 首次使用引导不是独立状态而是 enabled 态上的一次性提示,判据见 firstRunGuideNeeded)。
 * 取值即 i18n 键片段;`ai.pane.inputSources.snapshot.state.<key>` 由 snapshotView 派发。
 */
export const SNAPSHOT_STATES = ['disabled', 'enabled', 'failed'] as const
export type SnapshotState = (typeof SNAPSHOT_STATES)[number]

/** 语义色档(判定层只给语义,样式由渲染件决定;复用 turn-status 同族五档) */
export const SNAPSHOT_TONES = ['neutral', 'info', 'success', 'warning', 'danger'] as const
export type SnapshotTone = (typeof SNAPSHOT_TONES)[number]

export interface SnapshotView {
  readonly state: SnapshotState
  readonly tone: SnapshotTone
  /** `ai.pane.inputSources.snapshot` 内的状态文案键 */
  readonly labelKey: string
  /** 主动作文案键;null = 该态无动作(enabled 无需再启用/重试) */
  readonly actionKey: string | null
  /** 补充说明键;null = 该态无需说明 */
  readonly hintKey: string | null
}

const SNAPSHOT_STATE_SET: ReadonlySet<string> = new Set<string>(SNAPSHOT_STATES)

export function isSnapshotState(value: string): value is SnapshotState {
  return SNAPSHOT_STATE_SET.has(value)
}

/**
 * 三态 → 视图判据的**唯一**派发点。
 *
 * switch 穷尽三态、**无 default**:漏改任一态 ⇒ `state` 无法收窄为 `never`,
 * assertNeverSnapshotState 处编译失败(新增态必须同步补判据,否则构建拦截)。
 */
export function snapshotView(state: SnapshotState): SnapshotView {
  switch (state) {
    case 'disabled':
      // 未启用:主动作是「启用智能快照」,不给失败暗示(没开过谈不上失败)。
      return {
        state,
        tone: 'neutral',
        labelKey: 'state.disabled',
        actionKey: 'enable',
        hintKey: null,
      }
    case 'enabled':
      // 已启用:动作已完成,不重复给「启用」入口(避免二次点击歧义)。
      return {
        state,
        tone: 'success',
        labelKey: 'state.enabled',
        actionKey: null,
        hintKey: null,
      }
    case 'failed':
      // 失败:必须显式渲染失败态(静默留空 = 把失败伪装成一切正常),给重试入口。
      return {
        state,
        tone: 'danger',
        labelKey: 'state.failed',
        actionKey: 'enable',
        hintKey: 'failedHint',
      }
  }
  return assertNeverSnapshotState(state)
}

/** 编译期穷尽性断言(运行时兜底;正常路径不可达) */
function assertNeverSnapshotState(state: never): never {
  throw new Error(`unhandled snapshot state: ${String(state)}`)
}

export interface FirstRunGuideContext {
  /**
   * 是否**已经展示过**首次使用引导(调用方负责落库/落本地态;本判定层只读)。
   * 判据:引导只出一次 ⇒「enabled 且从未展示过」才需要,失败/未启用态不出引导
   * (没开成功就引导是空谈;失败态的出路是重试,不是教学)。
   */
  readonly guidedBefore: boolean
}

/**
 * 首次使用引导判据(只出一次):enabled 且 guidedBefore=false ⇒ true。
 * 展示一次后调用方把 guidedBefore 置 true,本函数即永远返回 false。
 */
export function firstRunGuideNeeded(state: SnapshotState, ctx: FirstRunGuideContext): boolean {
  return state === 'enabled' && !ctx.guidedBefore
}

export interface AttachAppView {
  /** `ai.pane.inputSources.snapshot.attachApp`,词包原文:「附加 {appName}」 */
  readonly labelKey: 'snapshot.attachApp'
  /** 插值参数(appName 由调用方取当前应用真实名,判定层不臆造) */
  readonly values: { readonly appName: string }
}

/** 「附加 {appName}」键生成(appName 空串视为无应用名,渲染层对 null 不渲染该片段) */
export function attachAppView(appName: string): AttachAppView | null {
  const trimmed = appName.trim()
  if (!trimmed) return null
  return { labelKey: 'snapshot.attachApp', values: { appName: trimmed } }
}

// ---------------------------------------------------------------------------
// ①b 添加远程文件/照片:分流判定(哪个入口处理哪类源)
// ---------------------------------------------------------------------------

/**
 * 输入源三类(取值即 i18n 键片段;`ai.pane.inputSources.route.<key>`)。
 *   · appSnapshot —— 来自应用快照的上下文(「附加 {appName}」链路)
 *   · remoteFile  —— 远程文件(URL 指向的文档/任意文件)
 *   · remotePhoto —— 远程照片(URL 指向的图片,走图片预览/视觉通道)
 */
export const INPUT_SOURCE_ROUTES = ['appSnapshot', 'remoteFile', 'remotePhoto'] as const
export type InputSourceRoute = (typeof INPUT_SOURCE_ROUTES)[number]

/** 附件处理方式(渲染层按 attach 决定以什么形态进入附件链) */
export const INPUT_SOURCE_ATTACH_KINDS = ['app', 'file', 'image'] as const
export type InputSourceAttachKind = (typeof INPUT_SOURCE_ATTACH_KINDS)[number]

export interface InputSourceRouteView {
  readonly source: InputSourceRoute
  /** 处理入口(与 source 同名:三类源各有一个专属入口,不混用) */
  readonly entry: InputSourceRoute
  /** 入口文案键(`ai.pane.inputSources.route.<key>`) */
  readonly entryKey: string
  /** 附件处理方式 */
  readonly attach: InputSourceAttachKind
}

const ROUTE_SET: ReadonlySet<string> = new Set<string>(INPUT_SOURCE_ROUTES)

export function isInputSourceRoute(value: string): value is InputSourceRoute {
  return ROUTE_SET.has(value)
}

/**
 * 输入源 → 处理入口的**唯一**分流判定。
 *
 * switch 穷尽三类、**无 default**:漏改任一类 ⇒ `source` 无法收窄为 `never`,
 * assertNeverRoute 处编译失败(新增源必须同步补入口,否则构建拦截)。
 */
export function inputSourceRoute(source: InputSourceRoute): InputSourceRouteView {
  switch (source) {
    case 'appSnapshot':
      // 应用快照:走快照入口,以 app 形态附加(「附加 {appName}」)。
      return { source, entry: 'appSnapshot', entryKey: 'route.appSnapshot', attach: 'app' }
    case 'remoteFile':
      // 远程文件:走文件入口,以普通文件形态进入附件链。
      return { source, entry: 'remoteFile', entryKey: 'route.remoteFile', attach: 'file' }
    case 'remotePhoto':
      // 远程照片:走照片入口,以图片形态进入(预览/视觉通道)。
      return { source, entry: 'remotePhoto', entryKey: 'route.remotePhoto', attach: 'image' }
  }
  return assertNeverRoute(source)
}

function assertNeverRoute(source: never): never {
  throw new Error(`unhandled input source route: ${String(source)}`)
}

// ---------------------------------------------------------------------------
// ② 队列与引导命令化 + Undo(与 W27 不冲突:只读不写,见文件头纪律)
// ---------------------------------------------------------------------------

/**
 * 排队语义命令 id(与 D89 主线 `apps/web/src/lib/command-registry.ts` 的
 * CHAT_QUEUE_COMMANDS **同一组 id、同一组 semantic**,不立第二套):
 *   · queuePrompt —— 「将提示加入队列」→ W27 预备消息 FIFO(semantic: w27-pending)
 *   · steerPrompt —— 「引导提示」→ steer 中途引导(semantic: steer)
 */
export const QUEUE_COMMAND_IDS = ['queuePrompt', 'steerPrompt'] as const
export type QueueCommandId = (typeof QUEUE_COMMAND_IDS)[number]

/** 语义归属标签(描述性只读;真正入队/插话仍走既有排队体系) */
export const QUEUE_COMMAND_SEMANTICS = {
  queuePrompt: 'w27-pending',
  steerPrompt: 'steer',
} as const
export type QueueCommandSemantic = (typeof QUEUE_COMMAND_SEMANTICS)[QueueCommandId]

export interface QueueCommandView {
  readonly id: QueueCommandId
  /** 命令项文案键(`ai.pane.inputSources.command.<key>`) */
  readonly labelKey: string
  /** 命令描述文案键(`ai.pane.inputSources.command.<key>`) */
  readonly descKey: string
  /** 语义归属(与 command-registry 一致:queuePrompt=w27-pending / steerPrompt=steer) */
  readonly semantic: QueueCommandSemantic
}

const QUEUE_PROMPT_VIEW: QueueCommandView = {
  id: 'queuePrompt',
  labelKey: 'command.queuePrompt',
  descKey: 'command.queuePromptDesc',
  semantic: 'w27-pending',
}

const STEER_PROMPT_VIEW: QueueCommandView = {
  id: 'steerPrompt',
  labelKey: 'command.steerPrompt',
  descKey: 'command.steerPromptDesc',
  semantic: 'steer',
}

/**
 * 两命令项 + 各自描述键(只读静态表)。
 * **本表不触发任何队列写操作**:渲染层拿到的是"命令长什么样、归属哪条语义",
 * 点击后的入队/插话由调用方走既有通道(W27 FIFO / steer 端点)。
 */
export const QUEUE_COMMANDS: readonly QueueCommandView[] = [QUEUE_PROMPT_VIEW, STEER_PROMPT_VIEW]

/** 命令 id → 视图的**唯一**派发点。switch 穷尽两命令、零 default。 */
export function queueCommandView(id: QueueCommandId): QueueCommandView {
  switch (id) {
    case 'queuePrompt':
      return QUEUE_PROMPT_VIEW
    case 'steerPrompt':
      return STEER_PROMPT_VIEW
  }
  return assertNeverQueueCommand(id)
}

function assertNeverQueueCommand(id: never): never {
  throw new Error(`unhandled queue command: ${String(id)}`)
}

// ---------------------------------------------------------------------------

/** Undo 恢复三态(恢复进行中 / 已恢复 / 恢复失败) */
export const UNDO_RESTORE_PHASES = ['restoring', 'restored', 'failed'] as const
export type UndoRestorePhase = (typeof UNDO_RESTORE_PHASES)[number]

/**
 * 文案变体(判据原文同族两条,按队列语义择一):
 *   · queue  —— 「已恢复队列中的消息」
 *   · queued —— 「已恢复排队的消息」
 */
export const UNDO_VARIANTS = ['queue', 'queued'] as const
export type UndoVariant = (typeof UNDO_VARIANTS)[number]

export interface UndoRestoreView {
  readonly phase: UndoRestorePhase
  readonly tone: SnapshotTone
  /** `ai.pane.inputSources.undo` 内的文案键 */
  readonly labelKey: string
}

/**
 * Undo 恢复三态 → 文案视图(纯函数,只读不写:恢复本体在调用方,
 * 本函数不触碰任何队列状态)。
 *
 * switch 穷尽三态、**无 default**。
 */
export function undoRestoreView(phase: UndoRestorePhase, variant: UndoVariant = 'queue'): UndoRestoreView {
  switch (phase) {
    case 'restoring':
      return { phase, tone: 'info', labelKey: 'undo.restoring' }
    case 'restored':
      // 同族两条判据原文,按调用方队列语义择一(queue=队列 / queued=排队)。
      return {
        phase,
        tone: 'success',
        labelKey: variant === 'queued' ? 'undo.restoredQueued' : 'undo.restored',
      }
    case 'failed':
      // 恢复失败:消息仍在队列中(不得让用户以为消息丢了)。
      return { phase, tone: 'danger', labelKey: 'undo.failed' }
  }
  return assertNeverUndoPhase(phase)
}

function assertNeverUndoPhase(phase: never): never {
  throw new Error(`unhandled undo restore phase: ${String(phase)}`)
}

// ---------------------------------------------------------------------------
// ③ 记忆引用计数条 + goal 成就耗时条
// ---------------------------------------------------------------------------

export interface MemoryRefCountView {
  readonly count: number
  /** true = 空态(count 为 0/非法):渲染层必须用空态文案,**不得显示「0 条」** */
  readonly empty: boolean
  /** `ai.pane.inputSources.memoryRefs` 内的计数/空态文案键 */
  readonly labelKey: 'memoryRefs.count' | 'memoryRefs.empty'
  /** tooltip 键「引用的记忆」;空态无 tooltip(null) */
  readonly tooltipKey: 'memoryRefs.tooltip' | null
  /** 插值参数(与 labelKey 配套;空态 count 归零) */
  readonly values: { readonly count: number }
}

/**
 * 记忆引用计数 → 视图。0 / 负数 / 非有限数 ⇒ 空态(明确空态文案,不显示「0 条」)。
 */
export function memoryRefCountView(count: number): MemoryRefCountView {
  const safe = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0
  if (safe === 0) {
    return { count: 0, empty: true, labelKey: 'memoryRefs.empty', tooltipKey: null, values: { count: 0 } }
  }
  return { count: safe, empty: false, labelKey: 'memoryRefs.count', tooltipKey: 'memoryRefs.tooltip', values: { count: safe } }
}

export interface GoalAchievementView {
  /** `ai.pane.inputSources.goal.achievedIn`,词包原文:「已在 {totalTime} 内达成目标」 */
  readonly labelKey: 'goal.achievedIn'
  /** totalTime 为人类可读本地化时长(复用 D67 formatDurationHuman,不重复造轮子) */
  readonly values: { readonly totalTime: string }
}

/**
 * goal 成就耗时 → 视图。totalTimeMs 毫秒差值由调用方提供(done 态 updatedAt -
 * createdAt);非法输入由 formatDurationHuman 兜底为「0分」,不抛异常。
 * units 缺省中文单位;多语言渲染层可传词包 `ai.pane.quotaOwnership.duration`。
 */
export function goalAchievementView(
  totalTimeMs: number,
  units: DurationUnitLabels = ZH_DURATION_UNITS,
): GoalAchievementView {
  return { labelKey: 'goal.achievedIn', values: { totalTime: formatDurationHuman(totalTimeMs, units) } }
}
// ⁠[tail-watermark-placeholder]
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
