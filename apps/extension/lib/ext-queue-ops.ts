// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D38 队列语义完整交互 — extension(浏览器扩展)端判定适配器(G-42 / H18 跨端消费矩阵)
//
// 本文件是 apps/extension 对真相源 `@ihui/shared/chat/queue-interactions`(+ D69
// `input-notices` 许可判定)的**唯一**消费出口:ChatPage 的排队/重排/撤回/编辑/
// 「打断并执行」/模式切换全部经这里取判据,端内不得再手写第二套许可/模式/打断判定
// (范式同 apps/cli/src/commands/queue-ops.ts,§3 共享层优先)。
//
// extension 端事实(判据输入的依据,均可复测):
//   · Runtime 插话能力**未知,按诚实口径传 false** —— 全仓尚无
//     `runtimeSupportsInterjection` 能力协商生产者(PROJECT_PLAN D38 未闭环③),
//     接线前宿主不得写死 true;该值一旦接入 SSE 协商位,只改 ChatPage 传参,不改本层判定。
//   · 「流式中」即 ChatPage 的 streaming state(onSend 置真,onDone/onError 置假)。
//   · follow-up 模式是用户偏好:steer = 插话优先;queue = 排队优先。本端 runtime 支持位
//     传 false 时,steer 请求经 effectiveMode 降级为 queue 并给出降级句键
//     (「当前 Runtime 不支持插话,消息将继续排队」,shared 词包 ai.pane.queueOps.* 已可解析)。
//   · 队列状态本体是 ChatPage 的本地 state(本端无 web 式 chat store),数组变换
//     **只经** reorderQueue/applyQueueEdit 共享纯函数(W27 不变式由 shared 用例锁死)。

import {
  effectiveMode,
  interactionAllowed,
  interruptPlan,
  isFollowUpMode,
  reorderQueue,
  applyQueueEdit,
  type EditableQueueItem,
  type FollowUpMode,
  type FollowUpModeResolution,
  type InteractionVerdict,
  type QueueInteractionKind,
} from '@ihui/shared/chat/queue-interactions'
import { queueInteractionPerms, type QueueInteractionPerms } from '@ihui/shared/chat/input-notices'

/** 队列项形状直接复用共享层最小结构(id/text/createdAt),禁止端内重定义 */
export type ExtQueueItem = EditableQueueItem

/** 适配器可从端内 state 取到的最小队列事实(纯数据,便于测试注入) */
export interface ExtQueueFacts {
  readonly hasQueuedMessages: boolean
  readonly streaming: boolean
  /** Runtime 插话能力协商位;全仓生产者未落地前宿主必须传 false(见文件头) */
  readonly runtimeSupportsInterjection: boolean
}

/** 许可判定唯一入口:D69 queueInteractionPerms,插话能力由调用方如实注入 */
export function extQueuePerms(facts: ExtQueueFacts): QueueInteractionPerms {
  return queueInteractionPerms({
    hasQueuedMessages: facts.hasQueuedMessages,
    streaming: facts.streaming,
    runtimeSupportsInterjection: facts.runtimeSupportsInterjection,
  })
}

/** 动词 → 许可结论(与 web 交互条 / cli queue-ops 同一判定,零端内分支) */
export function extQueueInteractionAllowed(
  kind: QueueInteractionKind,
  facts: ExtQueueFacts,
): InteractionVerdict {
  return interactionAllowed(kind, extQueuePerms(facts))
}

export interface ExtInterruptRunPlan {
  readonly allowed: boolean
  /** 被拒时的 D69 deniedNotice 键(`denied.<action>`);allowed 时恒 null */
  readonly deniedKey: string | null
  /** 是否需要先停当前流(W2 既有 abort 通道) */
  readonly stopFirst: boolean
  /** 打断后要执行的队首 id;null = 队列空(计划层不猜队首) */
  readonly thenRun: string | null
}

/**
 * 「打断并执行」计划:先过许可门(interruptAndRun → D69 interject 族),
 * 再经 interruptPlan 出 {stopFirst, thenRun} —— 队首由调用方以既有读取路径
 * (queue[0])传入,本函数不触碰队列数组(W27 不变式,shared 用例锁死输出键集)。
 */
export function extInterruptRunPlan(
  facts: ExtQueueFacts,
  headId: string | null,
): ExtInterruptRunPlan {
  const verdict = extQueueInteractionAllowed('interruptAndRun', facts)
  if (!verdict.allowed) {
    return { allowed: false, deniedKey: verdict.deniedKey, stopFirst: false, thenRun: null }
  }
  return {
    allowed: true,
    deniedKey: null,
    // extension 为单流(同 cli):streaming 时用稳定占位 messageId;
    // 队首 id 由调用方传入,本函数不做任何队列数组操作。
    ...interruptPlan(
      { streaming: facts.streaming, streamingMessageId: facts.streaming ? 'ext-chat-turn' : null },
      headId === null ? null : { id: headId },
    ),
  }
}

/**
 * 模式解析:用户输入 → FollowUpMode;非法值 ok=false(调用方不落脏状态)。
 * runtimeSupport 由调用方如实传入 —— 本端当前为 false ⇒ steer 恒降级为 queue,
 * resolution.degradedKey 即渲染层必须显式展示的降级句键(不得静默)。
 */
export function extResolveFollowUpMode(
  pref: string,
  runtimeSupport: boolean,
): { readonly ok: true; readonly resolution: FollowUpModeResolution } | { readonly ok: false } {
  if (!isFollowUpMode(pref)) return { ok: false }
  return { ok: true, resolution: effectiveMode(pref, runtimeSupport) }
}

/**
 * 队列重排(**仅委托** shared reorderQueue):越界/同位返回原数组同一引用,
 * 渲染层可据此跳过重渲染。硬指标「重排后发送顺序」= 逐位等于重排数组,
 * 由 tests/ext-queue-ops.test.ts 以 seed[a,b,c]→reorder(2,0)→['c','a','b'] 钉死。
 */
export function extReorderQueue(
  items: readonly ExtQueueItem[],
  fromIndex: number,
  toIndex: number,
): readonly ExtQueueItem[] {
  return reorderQueue(items, fromIndex, toIndex)
}

/** 编辑队列项(**仅委托** shared applyQueueEdit):只改 text,createdAt/id 不动 */
export function extEditQueueItem(
  items: readonly ExtQueueItem[],
  id: string,
  text: string,
): readonly ExtQueueItem[] {
  return applyQueueEdit(items, id, { text })
}

/**
 * 撤回队列项(undo 动词的数组变换)。许可判定在 interactionAllowed('undo', perms),
 * 这里只负责删除:未知 id ⇒ 返回原数组同一引用(与共享纯函数 no-op 口径一致)。
 */
export function extRemoveQueueItem(
  items: readonly ExtQueueItem[],
  id: string,
): readonly ExtQueueItem[] {
  if (!items.some((it) => it.id === id)) return items
  return items.filter((it) => it.id !== id)
}

/**
 * 拒绝键 → **本端可解析**的文案键(单点消费收口的端内投影):
 *   · deniedNotice 产出的三个 `denied.<action>` 键,文案本体在 D69
 *     `ai.pane.inputNotices.queue.denied.*` —— 该命名空间只随 web 词包加载
 *     (本端 mergeMessages 只并 shared + extension 两包,见 src/i18n/index.tsx)。
 *   · denied.interject 与 shared 既有键 `ai.pane.queueOps.degraded.runtimeNoInterject`
 *     **逐字同句**(「当前 Runtime 不支持插话,消息将继续排队」),引用既有键不构成
 *     同文副本(副本禁令针对的是 queueOps.denied.* 那一族,见 queue-interactions.ts 头注)。
 *   · denied.reorder / denied.undo 的文案本体在 web 词包,而本端 mergeMessages 只并
 *     shared + extension 两包 ⇒ 原缺口已按"取 web 定稿译文逐字补进本端语言包"闭合
 *     (`packages/i18n/messages/extension/*.json` 的 `ai.pane.inputNotices.queue.denied.*`,
 *     五语言对称,非机翻)。**新增用户可见文案一律写进本端语言包**,不得从端内引用
 *     web 包 —— 那条路在本端结构上取不到词,只会表现为回显键名。
 *   · 未映射的 `denied.<action>` 仍返回 null:渲染层省略该行。宁可少一句,也绝不把
 *     `ai.pane.…` 字面量甩到界面上(取词回显键名即红)。
 */
export function extDeniedNoticeKey(deniedKey: string | null): string | null {
  if (deniedKey === null) return null
  if (deniedKey === 'denied.interject') return 'ai.pane.queueOps.degraded.runtimeNoInterject'
  // D69 的 reorder/undo 拒绝文案此前只随 web 词包加载,本端 merge 链(shared ⊕ extension)
  // 永不解析 ⇒ 被拒时只能不渲染(宁可少一句,也不回显键名)。现已把这两枚键按 web 定稿
  // 译文逐字补进 packages/i18n/messages/extension/*,所以这里给出完整键。
  // 仍保留 null 兜底:判定层将来新增 `denied.<action>` 而本端词包没跟上时,
  // 表现必须是"不显示",不是把 `ai.pane.…` 字面量甩到界面上。
  if (deniedKey === 'denied.reorder') return 'ai.pane.inputNotices.queue.denied.reorder'
  if (deniedKey === 'denied.undo') return 'ai.pane.inputNotices.queue.denied.undo'
  return null
}

/** 模式解析的降级键(`degraded.runtimeNoInterject`)→ 本端可解析的 shared 完整键 */
export function extFollowUpDegradeKey(resolution: FollowUpModeResolution): string | null {
  if (!resolution.degraded || resolution.degradedKey === null) return null
  return `ai.pane.queueOps.${resolution.degradedKey}`
}

/** 供 ChatPage 声明默认模式用(与 cli repl 现状默认 steer 对齐;降级句由判定层给出) */
export const EXT_DEFAULT_FOLLOW_UP_MODE: FollowUpMode = 'steer'
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
