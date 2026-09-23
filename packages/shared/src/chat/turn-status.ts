// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D71 统一 Turn 状态词汇表(G-97,2026-09-24 立)
//
// **自证结论(改本文件前先读)**:十态里只有 `thinking` 在 web 侧有真实渲染位
// (`TypingIndicator` / `ai.pane.thinkingStreaming` / D79 `waiting-pool`),`completed` /
// `failed` / `stopped` 散落在看板与任务卡上**各说各话**;而
//   · `waitingConfirm`(等待确认)—— 全仓唯一命中是 MCP 的 `bindingSubmitted`
//     「绑定请求已提交,等待确认」,**不是 turn 状态**;
//   · `backgroundRunning`(后台执行中)—— 只出现在 ai-service 的两处运维回执
//     (`db_sync_scheduler` / `cookie_refresh_daemon`),**不是 turn 状态**;
//   · `queued`(排队中)—— api-client 注释三次承诺「把消息 badge 从『排队中』换成…」,
//     但 web 词包里**根本没有「排队中」这条串**,即承诺的 badge 从未落地。
// 因此本票的真实缺口是:**十态没有统一真相源**,两态完全不可见。
//
// 本模块是十态的**唯一真相源**,与 D72 `worktree-lifecycle` 同范式:
//   常量 + 纯函数 + 穷尽 switch 零 default + `assertNever`。
// 端内不得再建第二套 turn 状态判定(禁止在组件里写 `state === 'thinking' ? … : …`)。
//
// **两态不得退化(台账硬要求)**:
//   · `waitingConfirm` —— **卡在用户动作上**:`waitsUser=true`,tone 走 warning,
//     且必带 `hint.waitingConfirm`。它**不是**"思考中"的别名:思考中是模型在跑,
//     等待确认是模型停下来了、球在用户这边。
//   · `backgroundRunning` —— **已离开本轮前台**:`offTurn=true`,`busy=false`
//     (本轮不再占用前台算力),必带 `hint.backgroundRunning`。它**不是**"运行中"
//     的别名:用户此刻可以去做别的事,前台不该假装还在等结果。
// 两者各占一个独立 case、各有一组独立判据字段,测试逐条断言"与思考中不同形"。

/** Turn 十态(取值即 i18n 键片段;`ai.pane.turnStatus.state.<key>`) */
export const TURN_STATES = [
  'queued',
  'preparing',
  'thinking',
  'usingTool',
  'waitingConfirm',
  'backgroundRunning',
  'stopping',
  'completed',
  'failed',
  'stopped',
] as const
export type TurnState = (typeof TURN_STATES)[number]

/** 语义色档(判定层只给语义,具体样式由渲染件决定) */
export const TURN_TONES = ['neutral', 'info', 'warning', 'success', 'danger'] as const
export type TurnTone = (typeof TURN_TONES)[number]

/** 徽章可给出的动作(渲染件按 view 的取值决定渲染哪个按钮) */
export const TURN_STATUS_ACTIONS = ['none', 'stop', 'retry', 'resume'] as const
export type TurnStatusAction = (typeof TURN_STATUS_ACTIONS)[number]

/** 需要额外说明(hover / 副标题)的四态;其余态不画蛇添足 */
export const TURN_STATUS_HINTS = ['queued', 'waitingConfirm', 'backgroundRunning', 'stopping'] as const
export type TurnStatusHint = (typeof TURN_STATUS_HINTS)[number]

/** 仍在进行中的态(未到终态) */
export const ACTIVE_TURN_STATES = [
  'queued',
  'preparing',
  'thinking',
  'usingTool',
  'waitingConfirm',
  'backgroundRunning',
  'stopping',
] as const

/** 终态:本轮已不再变化 */
export const TERMINAL_TURN_STATES = ['completed', 'failed', 'stopped'] as const

/** 词包命名空间(web 侧 `useTranslations('ai.pane.turnStatus')`) */
export const TURN_STATUS_NAMESPACE = 'ai.pane.turnStatus' as const

export interface TurnStatusView {
  readonly state: TurnState
  readonly tone: TurnTone
  /** `ai.pane.turnStatus` 内的标题键 */
  readonly titleKey: string
  /** `ai.pane.turnStatus` 内的 aria-label 键(读屏用,比标题更完整) */
  readonly ariaKey: string
  /** `ai.pane.turnStatus` 内的补充说明键;null = 该态无需补充说明 */
  readonly hintKey: string | null
  /** 本轮是否仍在消耗算力(驱动动画 / 是否还能点停止) */
  readonly busy: boolean
  /** 是否终态 */
  readonly terminal: boolean
  /** 是否卡在**用户动作**上(仅 `waitingConfirm` 为 true —— 球在用户这边) */
  readonly waitsUser: boolean
  /** 是否已在后台跑(仅 `backgroundRunning` 为 true —— 仍在进行,但已不在本轮前台) */
  readonly offTurn: boolean
  /** 是否给「停止」入口 */
  readonly showStop: boolean
  /** 徽章动作:`none` / `stop` / `retry`(失败可重试,D39 重试族不回退)/ `resume`(已停止可继续) */
  readonly action: TurnStatusAction
}

const STATE_SET: ReadonlySet<string> = new Set<string>(TURN_STATES)
const ACTIVE_STATE_SET: ReadonlySet<string> = new Set<string>(ACTIVE_TURN_STATES)
const TERMINAL_STATE_SET: ReadonlySet<string> = new Set<string>(TERMINAL_TURN_STATES)

export function isTurnState(value: string): value is TurnState {
  return STATE_SET.has(value)
}

export function isActiveTurnState(state: TurnState): boolean {
  return ACTIVE_STATE_SET.has(state)
}

export function isTerminalTurnState(state: TurnState): boolean {
  return TERMINAL_STATE_SET.has(state)
}

/**
 * 十态 → 视图判据的**唯一**派发点。
 *
 * switch 穷尽十态、**无 default**:漏改任一态 ⇒ `state` 无法收窄为 `never`,
 * `assertNeverState` 处编译失败(新增态必须同步补判据,否则构建拦截)。
 */
export function turnStatusView(state: TurnState): TurnStatusView {
  switch (state) {
    case 'queued':
      // 排队中:还没轮到本轮跑,但已经在队列里 —— 必须说明"排队"这件事本身,
      // 否则用户以为卡死(现有代码里这条提示完全缺失)。
      return {
        state,
        tone: 'neutral',
        titleKey: 'state.queued',
        ariaKey: 'aria.queued',
        hintKey: 'hint.queued',
        busy: true,
        terminal: false,
        waitsUser: false,
        offTurn: false,
        showStop: true,
        action: 'none',
      }
    case 'preparing':
      return {
        state,
        tone: 'neutral',
        titleKey: 'state.preparing',
        ariaKey: 'aria.preparing',
        hintKey: null,
        busy: true,
        terminal: false,
        waitsUser: false,
        offTurn: false,
        showStop: true,
        action: 'none',
      }
    case 'thinking':
      return {
        state,
        tone: 'info',
        titleKey: 'state.thinking',
        ariaKey: 'aria.thinking',
        hintKey: null,
        busy: true,
        terminal: false,
        waitsUser: false,
        offTurn: false,
        showStop: true,
        action: 'none',
      }
    case 'usingTool':
      return {
        state,
        tone: 'info',
        titleKey: 'state.usingTool',
        ariaKey: 'aria.usingTool',
        hintKey: null,
        busy: true,
        terminal: false,
        waitsUser: false,
        offTurn: false,
        showStop: true,
        action: 'none',
      }
    case 'waitingConfirm':
      // 等待确认:**模型已停下,球在用户这边**。与"思考中"的根本区别就在这里:
      // 思考中是模型在算,等待确认是模型在等 —— 因此 tone 走 warning,
      // 且必须给出"等你确认"的说明(不说明 = 用户以为卡住而中断/切走)。
      return {
        state,
        tone: 'warning',
        titleKey: 'state.waitingConfirm',
        ariaKey: 'aria.waitingConfirm',
        hintKey: 'hint.waitingConfirm',
        busy: true,
        terminal: false,
        waitsUser: true,
        offTurn: false,
        showStop: true,
        action: 'none',
      }
    case 'backgroundRunning':
      // 后台执行中:**仍在进行,但已不在本轮前台**。与"思考中/使用工具"的区别是
      // `busy=false`(前台不再为它转圈)+ `offTurn=true`;不说明 = 用户干等一个
      // 不会再回到前台的结果(这是"切走"的直接成因之一)。
      return {
        state,
        tone: 'info',
        titleKey: 'state.backgroundRunning',
        ariaKey: 'aria.backgroundRunning',
        hintKey: 'hint.backgroundRunning',
        busy: false,
        terminal: false,
        waitsUser: false,
        offTurn: true,
        showStop: true,
        action: 'none',
      }
    case 'stopping':
      // 正在停止:点了停止但还没停完 —— 不得再给"停止"入口(重复点击无意义)
      return {
        state,
        tone: 'neutral',
        titleKey: 'state.stopping',
        ariaKey: 'aria.stopping',
        hintKey: 'hint.stopping',
        busy: true,
        terminal: false,
        waitsUser: false,
        offTurn: false,
        showStop: false,
        action: 'none',
      }
    case 'completed':
      return {
        state,
        tone: 'success',
        titleKey: 'state.completed',
        ariaKey: 'aria.completed',
        hintKey: null,
        busy: false,
        terminal: true,
        waitsUser: false,
        offTurn: false,
        showStop: false,
        action: 'none',
      }
    case 'failed':
      // 失败:必须给重试入口(D39 重试族的落点,本票不得让它回退)
      return {
        state,
        tone: 'danger',
        titleKey: 'state.failed',
        ariaKey: 'aria.failed',
        hintKey: null,
        busy: false,
        terminal: true,
        waitsUser: false,
        offTurn: false,
        showStop: false,
        action: 'retry',
      }
    case 'stopped':
      // 已停止:用户主动停的,与"失败"不同形 —— 给"继续"而不是"重试"
      return {
        state,
        tone: 'neutral',
        titleKey: 'state.stopped',
        ariaKey: 'aria.stopped',
        hintKey: null,
        busy: false,
        terminal: true,
        waitsUser: false,
        offTurn: false,
        showStop: false,
        action: 'resume',
      }
  }
  return assertNeverState(state)
}

/** 编译期穷尽性断言(运行时兜底;正常路径不可达) */
function assertNeverState(state: never): never {
  throw new Error(`unhandled turn state: ${String(state)}`)
}

/** 十态 → i18n 标题键(`ai.pane.turnStatus.state.<key>`) */
export function turnStatusTitleKey(state: TurnState): string {
  return `state.${state}`
}

/** 十态 → i18n aria-label 键(`ai.pane.turnStatus.aria.<key>`) */
export function turnStatusAriaKey(state: TurnState): string {
  return `aria.${state}`
}

/** 说明 → i18n 键(`ai.pane.turnStatus.hint.<key>`) */
export function turnStatusHintKey(hint: TurnStatusHint): string {
  return `hint.${hint}`
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
