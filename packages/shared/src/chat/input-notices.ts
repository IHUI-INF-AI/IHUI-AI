// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D69 输入区文案族补齐 —— 判定层(G-91/G-92 + D38/D43 规格补强,2026-09-24 立)
//
// **自证结论(改本文件前先读)**:
//   · 压缩链:已有「压缩中/压缩完成」状态栏(compaction-status-bar.tsx,文案硬编码中文)
//     与消息级压缩分隔线(compression-divider.tsx,incompressible 触发 ceilingTitle/
//     ceilingHint);但**压缩不可用的「因与后果」文案族为零** ——
//     「压缩会消耗少量积分」「压缩在当前 Turn 完成后执行,不能插入正在运行的 Turn」
//     两条原文在 HEAD 全仓无命中。
//   · 排队链:已有 SideQueue 三 action(chat.ts enqueue/remove/shift)与 W27 预备消息
//     优先规则(message-input.tsx 流结束 effect + use-message-send.ts 短路)、SteerNoticeBar
//     (事后回看,不是排队交互);但**排队交互文案与判定层为零** —— 排队原因 / 拖动 aria /
//     无法撤回 / 无法调整顺序 / Runtime 不支持插话降级句,五条判据原文 HEAD 全无命中。
//   · D38(拖拽重排/撤回/插话交互本体)**未做** ⇒ 本模块交付的是**文案族 + 判定层**
//     (原因分类/许可判定),交互本体属 D38。
//
// 范式同 D71 turn-status / D67 quota-ownership / D72 worktree-lifecycle:
// 常量 + 纯函数 + 穷尽 switch 零 default + assertNever;端内不得再建第二套判定。
//
// **与 W27 不冲突(判定层纪律,同 D75)**:本模块**只读不写** —— 所有函数都是纯函数,
// 不触碰任何队列状态(不 enqueue/remove/shift/reorder),W27 预备消息优先规则
// (message-input.tsx 流结束 effect + use-message-send.ts 短路)原样保持。

/** 词包命名空间(web 侧 `useTranslations('ai.pane.inputNotices')`) */
export const INPUT_NOTICES_NAMESPACE = 'ai.pane.inputNotices' as const

// ---------------------------------------------------------------------------
// ① 压缩不可用:原因分类 + 因与后果成对文案键
// ---------------------------------------------------------------------------

/**
 * 压缩不可用原因三类(取值即 i18n 键片段;`ai.pane.inputNotices.compaction.block.*`)。
 *
 * 定名依据(自证):压缩由后端 AgentLoopV2 在 Turn 边界触发(web 只展示结果),
 * 因此"不可用"只可能来自三处:
 *   · runningTurn        —— 当前 Turn 仍在运行,压缩不能插入运行中的 Turn(原文判据)
 *   · insufficientCredits —— 压缩会消耗少量积分(原文判据),积分不足即不执行
 *   · noTurnBoundary     —— 没有可用的 Turn 边界,压缩无处执行
 */
export const COMPACTION_BLOCK_REASONS = [
  'runningTurn',
  'insufficientCredits',
  'noTurnBoundary',
] as const
export type CompactionBlockReason = (typeof COMPACTION_BLOCK_REASONS)[number]

export interface CompactionBlockContext {
  /** 当前 Turn 是否仍在运行(运行中 ⇒ 压缩只能排队到本轮结束) */
  readonly turnRunning: boolean
  /** 积分是否足够支付本次压缩(压缩会消耗少量积分) */
  readonly creditsSufficient: boolean
  /** 是否存在可用的 Turn 边界(压缩只能在边界执行) */
  readonly turnBoundaryAvailable: boolean
}

export interface CompactionBlockView {
  readonly reason: CompactionBlockReason
  /** 「因」文案键(`ai.pane.inputNotices.compaction.block.cause.<key>`) */
  readonly causeKey: string
  /** 「果」文案键(`ai.pane.inputNotices.compaction.block.consequence.<key>`) —— 与因**成对**,不是一句拼凑 */
  readonly consequenceKey: string
  /** 本轮结束后是否可自动重试(有 Turn 边界才可;无边界时渲染层不得给"稍后自动执行"预期) */
  readonly retryAfterTurn: boolean
}

const COMPACTION_REASON_SET: ReadonlySet<string> = new Set<string>(COMPACTION_BLOCK_REASONS)

export function isCompactionBlockReason(value: string): value is CompactionBlockReason {
  return COMPACTION_REASON_SET.has(value)
}

/** 原因 → 「因」文案键(`compaction.block.cause.<key>`) */
export function compactionBlockCauseKey(reason: CompactionBlockReason): string {
  return `cause.${reason}`
}

/** 原因 → 「果」文案键(`compaction.block.consequence.<key>`) */
export function compactionBlockConsequenceKey(reason: CompactionBlockReason): string {
  return `consequence.${reason}`
}

/**
 * 从原始状态解析当前压缩不可用原因(优先级:积分 > 运行中 > 无边界)。
 * 全部满足 ⇒ null(压缩可用,不渲染不可用提示)。
 */
export function resolveCompactionBlockReason(ctx: CompactionBlockContext): CompactionBlockReason | null {
  if (!ctx.creditsSufficient) return 'insufficientCredits'
  if (ctx.turnRunning) return 'runningTurn'
  if (!ctx.turnBoundaryAvailable) return 'noTurnBoundary'
  return null
}

/**
 * 原因 → 因/果成对视图判据的**唯一**派发点。
 *
 * switch 穷尽三类、**无 default**:漏改任一类 ⇒ `reason` 无法收窄为 `never`,
 * assertNeverReason 处编译失败(新增原因必须同步补因/果,否则构建拦截)。
 */
export function compactionBlockView(
  reason: CompactionBlockReason,
  ctx: CompactionBlockContext,
): CompactionBlockView {
  switch (reason) {
    case 'runningTurn':
      // 运行中:压缩不能插入正在运行的 Turn,只能等本轮结束(原文判据)。
      return {
        reason,
        causeKey: compactionBlockCauseKey(reason),
        consequenceKey: compactionBlockConsequenceKey(reason),
        retryAfterTurn: ctx.turnBoundaryAvailable,
      }
    case 'insufficientCredits':
      // 积分不足:压缩会消耗少量积分(原文判据),不足即不执行;与充值诱导无关,
      // 这里只陈述事实与后果,不推销(与 D67「不充值可用心智」同边界)。
      return {
        reason,
        causeKey: compactionBlockCauseKey(reason),
        consequenceKey: compactionBlockConsequenceKey(reason),
        retryAfterTurn: false,
      }
    case 'noTurnBoundary':
      // 无边界:压缩只能在 Turn 边界执行,当前没有可用的边界。
      return {
        reason,
        causeKey: compactionBlockCauseKey(reason),
        consequenceKey: compactionBlockConsequenceKey(reason),
        retryAfterTurn: false,
      }
  }
  return assertNeverReason(reason)
}

/** 编译期穷尽性断言(运行时兜底;正常路径不可达) */
function assertNeverReason(reason: never): never {
  throw new Error(`unhandled compaction block reason: ${String(reason)}`)
}

// ---------------------------------------------------------------------------
// ② 排队:原因标签 + 交互许可 + 拒绝提示(本票核心)
// ---------------------------------------------------------------------------

/**
 * 排队原因三类(取值即 i18n 键片段;`ai.pane.inputNotices.queue.reason.<key>`)。
 *
 *   · turnRunning          —— 当前回复正在生成,消息将在本轮结束后发送(W27 流结束 effect 出队)
 *   · queueAhead           —— 队首消息尚未完成,正在按顺序等待
 *   · runtimeNoInterject   —— Runtime 不支持插话,消息将继续排队(原文判据,能力协商降级句)
 */
export const QUEUE_REASONS = ['turnRunning', 'queueAhead', 'runtimeNoInterject'] as const
export type QueueReason = (typeof QUEUE_REASONS)[number]

export interface QueueInteractionContext {
  /** 当前 Runtime 是否支持插话(steer 注入能力协商结果) */
  readonly runtimeSupportsInterjection: boolean
  /** 是否处于流式生成中 */
  readonly streaming: boolean
  /** 队列中是否有消息 */
  readonly hasQueuedMessages: boolean
}

export interface QueueReasonView {
  readonly reason: QueueReason
  /** 排队原因文案键(`queue.reason.<key>`) */
  readonly reasonKey: string
}

const QUEUE_REASON_SET: ReadonlySet<string> = new Set<string>(QUEUE_REASONS)

export function isQueueReason(value: string): value is QueueReason {
  return QUEUE_REASON_SET.has(value)
}

/** 排队原因 → 文案键(`queue.reason.<key>`) */
export function queueReasonKey(reason: QueueReason): string {
  return `reason.${reason}`
}

/**
 * 排队上下文 → 排队原因标签(**为何这条消息在排队**)。
 *
 * 优先级:Runtime 不支持插话(能力硬缺口,必须先说)> 流式中(W27 主因)>
 * 队首未完成。队列里没有消息时不渲染任何原因(null,不空转)。
 */
export function queueReasonView(ctx: QueueInteractionContext): QueueReasonView | null {
  if (!ctx.hasQueuedMessages) return null
  const reason: QueueReason = !ctx.runtimeSupportsInterjection
    ? 'runtimeNoInterject'
    : ctx.streaming
      ? 'turnRunning'
      : 'queueAhead'
  return { reason, reasonKey: queueReasonKey(reason) }
}

/**
 * 排队原因 → 视图(供渲染层直取,与 queueReasonView 同判据的穷尽版本)。
 * switch 穷尽三类、零 default。
 */
export function queueReasonDetailedView(reason: QueueReason): QueueReasonView {
  switch (reason) {
    case 'turnRunning':
    case 'queueAhead':
    case 'runtimeNoInterject':
      return { reason, reasonKey: queueReasonKey(reason) }
  }
  return assertNeverQueueReason(reason)
}

function assertNeverQueueReason(reason: never): never {
  throw new Error(`unhandled queue reason: ${String(reason)}`)
}

// ---------------------------------------------------------------------------

export interface QueueInteractionPerms {
  /** 是否可拖动调整排队顺序(流式中锁定 —— 重排会打乱 W27 出队顺序预期) */
  readonly canReorder: boolean
  /** 是否可撤回排队消息(只要还在队列里就可撤;队列空自然无可撤) */
  readonly canUndo: boolean
  /** 是否可插话(仅取决于 Runtime 能力协商,与流式无关 —— 插话本身发生在流式中) */
  readonly canInterject: boolean
  /**
   * 当前最需要向用户解释的受限原因键(`queue.reason.<key>`);null = 无需解释。
   * 优先级:Runtime 不支持插话 > 流式中;队列空时无排队之事,不给原因。
   */
  readonly reasonKey: string | null
}

/**
 * 排队交互许可判定(**纯函数,只读不写** —— 不触碰任何队列状态,交互本体属 D38)。
 *
 * 判定依据(自证定名):Runtime 插话能力 / 流式状态 / 队列存在性。
 */
export function queueInteractionPerms(ctx: QueueInteractionContext): QueueInteractionPerms {
  const canInterject = ctx.runtimeSupportsInterjection
  const canReorder = ctx.hasQueuedMessages && !ctx.streaming
  const canUndo = ctx.hasQueuedMessages

  const reasonKey: string | null = !ctx.hasQueuedMessages
    ? null
    : !ctx.runtimeSupportsInterjection
      ? queueReasonKey('runtimeNoInterject')
      : ctx.streaming
        ? queueReasonKey('turnRunning')
        : null

  return { canReorder, canUndo, canInterject, reasonKey }
}

// ---------------------------------------------------------------------------

/**
 * 排队交互三动作(拒绝提示的动作维度)。
 *   · reorder   —— 拖动调整排队顺序
 *   · undo      —— 撤回排队消息
 *   · interject —— 向运行中的 Turn 插话
 */
export const QUEUE_DENIED_ACTIONS = ['reorder', 'undo', 'interject'] as const
export type QueueDeniedAction = (typeof QUEUE_DENIED_ACTIONS)[number]

/** 拒绝原因维度(与动作的组合见 DENIED_COMBOS) */
export const QUEUE_DENY_REASONS = ['streaming', 'emptyQueue', 'runtimeNoInterject'] as const
export type QueueDenyReason = (typeof QUEUE_DENY_REASONS)[number]

/**
 * 合法 (action, reason) 组合矩阵:撤回/重排被拒只看队列态与流式态;
 * 插话被拒只看 Runtime 能力协商。组合外一律 null(宁可不渲染,也不臆造)。
 */
const DENIED_COMBOS: Record<QueueDeniedAction, readonly QueueDenyReason[]> = {
  reorder: ['streaming', 'emptyQueue'],
  undo: ['emptyQueue'],
  interject: ['runtimeNoInterject'],
}

/**
 * 拒绝动作时的提示键(判据原文同族,不新增自创措辞):
 *   · reorder   → `denied.reorder`   = 「无法调整排队顺序」
 *   · undo      → `denied.undo`      = 「无法撤回排队消息」
 *   · interject → `denied.interject` = 「当前 Runtime 不支持插话,消息将继续排队」
 * 非法组合 → null。
 */
export function deniedNotice(action: QueueDeniedAction, reason: QueueDenyReason): string | null {
  if (!DENIED_COMBOS[action].includes(reason)) return null
  switch (action) {
    case 'reorder':
      return 'denied.reorder'
    case 'undo':
      return 'denied.undo'
    case 'interject':
      return 'denied.interject'
  }
  return assertNeverDeniedAction(action)
}

function assertNeverDeniedAction(action: never): never {
  throw new Error(`unhandled queue denied action: ${String(action)}`)
}

// ---------------------------------------------------------------------------

/**
 * 拖动调整排队顺序的读屏提示键(判据原文:「拖动调整排队顺序;聚焦后可使用上下方向键」)。
 * 仅当 canReorder=true 时渲染层才应挂到可拖动把手/列表容器上。
 */
export function queueReorderAria(): string {
  return 'reorderAria'
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
