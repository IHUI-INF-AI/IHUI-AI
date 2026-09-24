// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D38 队列语义完整交互 —— 判定层 + 纯函数编排(G-42,2026-09-24 立,对标 Codex followUpQueueMode)
//
// **自证结论(改本文件前先读)**:
//   · D69 `input-notices.ts` 已落排队许可判定 `queueInteractionPerms`(canReorder/canUndo/
//     canInterject + deniedNotice 组合矩阵)与五条文案 —— 本模块**直接复用**该判定做许可门,
//     不另立第二套判定(纪律同 D69 注释)。
//   · 队列状态本体在 web chat store 的 `sideQueueByConversation`(D28 SideQueueItem:
//     id/text/createdAt),入队/消费三 action(enqueue/remove/shift)与 W27 预备消息优先
//     规则(message-input.tsx 流结束 effect + use-message-send.ts 短路)**已有**;
//     本模块补的是交互动作的纯函数编排与模式可配(steer vs queue)。
//
// 范式同 D69 input-notices / D71 turn-status:常量 + 纯函数 + 穷尽 switch 零 default +
// assertNever;端内不得再建第二套判定。
//
// **W27 不变式(专门用例锁死,见 __tests__/queue-interactions.test.ts)**:
//   本模块全部为纯函数,**不含队首选择语义** ——
//   · `reorderQueue` 输出与输入 length/元素引用集恒等(只重排,不增删);
//   · `applyQueueEdit` 只改目标项 text,入队时间戳 createdAt 等元数据字段引用不动;
//   · `interruptPlan` 不触碰任何队列数组,只产出 {stopFirst, thenRun} 计划,
//     队首由**调用方**以既有读取路径(queue[0])传入 —— 队首选择逻辑一行不动。

/** 词包命名空间(web 侧 `useTranslations('ai.pane.queueOps')`) */
export const QUEUE_OPS_NAMESPACE = 'ai.pane.queueOps' as const

import type { QueueInteractionPerms, QueueDeniedAction, QueueDenyReason } from './input-notices'
import { deniedNotice, queueReasonKey } from './input-notices'

// ---------------------------------------------------------------------------
// ① 交互动词五种 + 交互描述类型
// ---------------------------------------------------------------------------

/**
 * 队列交互动词五种(取值即语义;与 D69 QUEUE_DENIED_ACTIONS 的映射见 interactionAllowed)。
 *   · reorder        —— 拖动调整排队顺序
 *   · undo           —— 撤回排队消息
 *   · edit           —— 编辑队列项文本(元数据不动)
 *   · interruptAndRun —— 「打断并执行」:先停当前流,再跑队首
 *   · setMode        —— 队列模式可配(steer vs queue,用户偏好,恒可切)
 */
export const QUEUE_INTERACTION_KINDS = [
  'reorder',
  'undo',
  'edit',
  'interruptAndRun',
  'setMode',
] as const
export type QueueInteractionKind = (typeof QUEUE_INTERACTION_KINDS)[number]

const QUEUE_INTERACTION_KIND_SET: ReadonlySet<string> = new Set<string>(QUEUE_INTERACTION_KINDS)

export function isQueueInteractionKind(value: string): value is QueueInteractionKind {
  return QUEUE_INTERACTION_KIND_SET.has(value)
}

/** 队列项文本编辑补丁:**只携带 text** —— 类型层面封死"编辑改元数据"的可能 */
export interface QueueEditPatch {
  readonly text: string
}

/** 一次队列交互的完整描述(渲染层构造,store/编排层消费) */
export interface QueueInteraction {
  readonly kind: QueueInteractionKind
  /** reorder/undo/edit 的目标项 id;interruptAndRun 不需要(目标是队首,由调用方读取) */
  readonly itemId?: string
  /** edit 的文本补丁 */
  readonly patch?: QueueEditPatch
  /** setMode 的目标模式 */
  readonly mode?: FollowUpMode
}

// ---------------------------------------------------------------------------
// ② 许可门(复用 D69 queueInteractionPerms,不另立第二套判定)
// ---------------------------------------------------------------------------

/** 单次交互的许可结论;被拒时 deniedKey 非空(denied.<action> 族,与 D69 deniedNotice 同键) */
export interface InteractionVerdict {
  readonly allowed: boolean
  /** 拒绝提示键(`ai.pane.queueOps.denied.<key>`);allowed=true 时恒 null */
  readonly deniedKey: string | null
}

/**
 * D69 动作 ← D38 动词映射(唯一派发点):
 *   · reorder        → 'reorder'
 *   · undo / edit    → 'undo'   (编辑与撤回同门:项仍在队列才可动;被拒同族「无法撤回排队消息」)
 *   · interruptAndRun → 'interject'(打断并执行属插话族;Runtime 不支持时降级为继续排队)
 *   · setMode        → 无对应(用户偏好,恒可切)
 */
function d69ActionOf(kind: QueueInteractionKind): QueueDeniedAction | null {
  switch (kind) {
    case 'reorder':
      return 'reorder'
    case 'undo':
    case 'edit':
      return 'undo'
    case 'interruptAndRun':
      return 'interject'
    case 'setMode':
      return null
  }
  return assertNeverKind(kind)
}

function assertNeverKind(kind: never): never {
  throw new Error(`unhandled queue interaction kind: ${String(kind)}`)
}

/**
 * 从 D69 perms 推导 (action, reason) 合法组合里的拒绝原因
 * (deniedNotice 只对合法组合出键;这里保证喂进去的组合必合法)。
 */
function denyReasonFor(action: QueueDeniedAction, perms: QueueInteractionPerms): QueueDenyReason {
  switch (action) {
    case 'reorder':
      // 流式中锁定重排(W27 出队顺序预期);否则唯一可能是队列空。
      return perms.reasonKey === queueReasonKey('turnRunning') ? 'streaming' : 'emptyQueue'
    case 'undo':
      return 'emptyQueue'
    case 'interject':
      return 'runtimeNoInterject'
  }
  return assertNeverDeniedAction(action)
}

function assertNeverDeniedAction(action: never): never {
  throw new Error(`unhandled queue denied action: ${String(action)}`)
}

/**
 * 交互动词 → 许可结论(**许可门唯一入口**,perms 必须来自 D69 `queueInteractionPerms`)。
 *
 * setMode 恒可切(模式是用户偏好;Runtime 不支持插话时的降级由 `effectiveMode` 处理,
 * 不在这里拦)。其余动词被拒时 deniedKey 与 D69 `deniedNotice` 同键:
 *   reorder → denied.reorder / undo,edit → denied.undo / interruptAndRun → denied.interject
 */
export function interactionAllowed(
  kind: QueueInteractionKind,
  perms: QueueInteractionPerms,
): InteractionVerdict {
  const d69Action = d69ActionOf(kind)
  if (d69Action === null) return { allowed: true, deniedKey: null }

  const allowed =
    d69Action === 'reorder'
      ? perms.canReorder
      : d69Action === 'undo'
        ? perms.canUndo
        : perms.canInterject
  if (allowed) return { allowed: true, deniedKey: null }
  return {
    allowed: false,
    deniedKey: deniedNotice(d69Action, denyReasonFor(d69Action, perms)),
  }
}

// ---------------------------------------------------------------------------
// ③ 纯函数编排:重排 / 编辑 / 打断计划
// ---------------------------------------------------------------------------

/**
 * 队列重排(W27 不变式:输出与输入 length/元素引用集恒等)。
 * 越界 / 同位 / 非整数索引一律返回**原数组**(同一引用,渲染层可据此跳过重渲染)。
 * 语义:先摘除 fromIndex 项,再插到 toIndex(HTML5 DnD 常规语义)。
 */
export function reorderQueue<T>(
  items: readonly T[],
  fromIndex: number,
  toIndex: number,
): readonly T[] {
  const len = items.length
  if (fromIndex === toIndex) return items
  if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex)) return items
  if (fromIndex < 0 || fromIndex >= len || toIndex < 0 || toIndex >= len) return items
  const next = items.slice()
  const [moved] = next.splice(fromIndex, 1)
  if (moved === undefined) return items
  next.splice(toIndex, 0, moved)
  return next
}

/** 可编辑队列项的最小结构(SideQueueItem 同形:id/text/createdAt) */
export interface EditableQueueItem {
  readonly id: string
  readonly text: string
  readonly createdAt: number
}

/**
 * 编辑队列项(W27 纪律:编辑不得改变入队时间戳与优先级字段)。
 * patch 类型只携带 text(元数据在类型层面不可触碰);实现按 id 定位、浅展开替换,
 * 其余字段与**其他项的引用**全部原样保留。id 不存在 / trim 后空文本 ⇒ 返回原数组。
 */
export function applyQueueEdit<T extends EditableQueueItem>(
  items: readonly T[],
  id: string,
  patch: QueueEditPatch,
): readonly T[] {
  const text = patch.text.trim()
  if (!text) return items
  const idx = items.findIndex((it) => it.id === id)
  if (idx === -1) return items
  const target = items[idx]
  if (!target) return items
  const next = items.slice()
  next[idx] = { ...target, text }
  return next
}

/** 当前流式运行状态的最小描述(调用方从 store isStreaming / streamingAssistantId 取) */
export interface QueueRunningState {
  readonly streaming: boolean
  readonly streamingMessageId: string | null
}

/**
 * 「打断并执行」计划 = 先停当前再跑队首。
 *   · stopFirst —— 是否需要先停当前流(W2 abort 通道;非流式时无需打断)
 *   · thenRun   —— 打断后要执行的项 id;null = 队列空,无可执行
 *
 * **不含队首选择语义**:queueHead 由调用方以既有读取路径(queue[0])传入,
 * 本函数不做任何队列数组操作(结构性用例锁死输出键集)。
 */
export function interruptPlan(
  runningState: QueueRunningState,
  queueHead: { readonly id: string } | null,
): { readonly stopFirst: boolean; readonly thenRun: string | null } {
  return {
    stopFirst: runningState.streaming,
    thenRun: queueHead?.id ?? null,
  }
}

// ---------------------------------------------------------------------------
// ④ 队列模式可配(steer vs queue,对标 Codex followUpQueueMode)
// ---------------------------------------------------------------------------

/** 队列模式两种:steer = 插话优先(尽量注入运行中的 Turn)/ queue = 排队优先(顺序出队) */
export const FOLLOW_UP_MODES = ['steer', 'queue'] as const
export type FollowUpMode = (typeof FOLLOW_UP_MODES)[number]

const FOLLOW_UP_MODE_SET: ReadonlySet<string> = new Set<string>(FOLLOW_UP_MODES)

export function isFollowUpMode(value: string): value is FollowUpMode {
  return FOLLOW_UP_MODE_SET.has(value)
}

/** 模式文案键(`ai.pane.queueOps.mode.<mode>`) */
export function followUpModeKey(mode: FollowUpMode): string {
  return `mode.${mode}`
}

/**
 * 模式降级提示键(文案对齐 D69 「当前 Runtime 不支持插话,消息将继续排队」原句,
 * 键值落本命名空间 ai.pane.queueOps.degraded.runtimeNoInterject)。
 */
export const FOLLOW_UP_DEGRADE_KEY = 'degraded.runtimeNoInterject' as const

/** 模式解析结论:degraded=true 时 degradedKey 非空(渲染层必须显式渲染降级句) */
export interface FollowUpModeResolution {
  readonly mode: FollowUpMode
  readonly degraded: boolean
  readonly degradedKey: string | null
}

/**
 * 生效模式(**纯函数**):Runtime 不支持插话时,steer 请求降级为 queue 且给出降级文案键;
 * queue 请求不受 Runtime 能力影响(排队本就是插话的降级路径,无需再降)。
 */
export function effectiveMode(
  preference: FollowUpMode,
  runtimeSupport: boolean,
): FollowUpModeResolution {
  if (preference === 'steer' && !runtimeSupport) {
    return { mode: 'queue', degraded: true, degradedKey: FOLLOW_UP_DEGRADE_KEY }
  }
  return { mode: preference, degraded: false, degradedKey: null }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
