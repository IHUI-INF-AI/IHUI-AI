// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 回合答案兜底的端内接线(web 腿)—— `@ihui/shared/chat/turn-answer-integrity` 的唯一消费者。
 *
 * 判据全在共享层(`shouldAppendTurnFallback` / `applyTurnFallbackAnswer` /
 * `hasTurnAnswerText` / `TURN_FALLBACK_KINDS`),本文件只做"把判定结果落到 chat store"这几行:
 * 共享层不生成消息 id、不认识 zustand,那是宿主的事(见其 `TurnAnswerRowHost` 注释)。
 *
 * ## 为什么接在**收尾**而不是渲染时兜
 * 空气泡的成因是"回合结束时没有任何一条权威答案的落点"(模块头注的现读定位:`onDone` 只翻标志位)。
 * 渲染时兜会把"这轮还没开始"和"这轮结束了但没答案"画成同一个屏幕 —— 前者本该显示转圈。
 * 收尾是这两个状态唯一分开的地方,所以判据必须落在这里。
 *
 * ## 三种结局各自的落法(与模块头注三句设计意图逐条对应)
 * - `empty`    :**不新增 agent 行**(渲染模型从未发送的回复 = 伪造),整轮落非"完成"终态
 *                (D71 `failed` 十态里的"失败",可重试)。web 侧落点是 `setMessageError` ——
 *                既有唯一能把内容为空的占位换成失败卡 + 重试钮的出口。
 * - `duplicate`:内容已在本轮转写里 ⇒ 一条都不加(按内容幂等,不看时序/位置)。
 * - `append`   :本轮确实缺这段答案 ⇒ 经 `applyTurnFallbackAnswer` 补**唯一**一条
 *                (尾行是空白 assistant 就就地补字,不再新建第二个气泡)。
 *
 * ## 可重入
 * 收尾可能发生多次(断线续接后再收尾 / 重连后再收尾),第二次拿到的转写里已有答案
 * ⇒ `duplicate` ⇒ 零写入。幂等由共享层判据保证,不靠调用方自觉只调一次。
 *
 * ## 如实登记的边界
 * `append` 档要"权威答案文本",而 web 当前的终态契约里没有全文来源:api-client 的 `onDone`
 * 无参、SSE 也没有携带全文的终态帧(见模块头注"尚未接线的一格")。所以生产路径上
 * 真实生效的是 `empty` / `duplicate` 两档;`append` 是给"终态帧带全文"那一天留的路径,
 * 本刀**不得**声称它已端到端生效。
 */

import {
  applyTurnFallbackAnswer,
  type TurnAnswerEntry,
  type TurnFallbackDecision,
} from '@ihui/shared/chat/turn-answer-integrity'
import type { ChatMessage } from '@/stores/chat'
import type { ChatStore } from '@/stores/chat-pane-context'

/** 新建兜底答案行时宿主必须补齐的平台字段(共享层刻意不生成 id) */
export interface TurnFallbackHostFields {
  /** 本轮模型档位(消息徽章用;与占位行同源) */
  model: string
  /** 权限模式档位(与占位行同源,可缺省) */
  permissionMode?: ChatMessage['permissionMode']
}

export interface ApplyTurnAnswerFallbackInput {
  chatStore: ChatStore
  /**
   * 本轮的权威答案文本。web 主链这里就是"流式累加进占位行的正文"——
   * 传进来只为按**内容**判幂等(同一文本已在转写里 ⇒ 不补),不参与写入。
   * 空串 / null / undefined = 上游没产出答案。
   */
  answer: string | null | undefined
  /** 该轮已落失败态(error 已由 stream-error 的出口写过)⇒ 本函数整轮不动 */
  alreadyFailed: boolean
  /** 该轮由用户主动停止 ⇒ 不落失败态(那是"已停止"终态,不是"失败") */
  userStopped: boolean
  host: TurnFallbackHostFields
}

export interface ApplyTurnAnswerFallbackResult {
  readonly decision: TurnFallbackDecision
  /** 本次是否真的向 store 写过转写(false = 幂等命中 / 空内容 / 已失败 / 用户停止) */
  readonly wrote: boolean
}

/** 生成本地消息 id:与 chat store 的 genId 同源语义(crypto.randomUUID) */
function newAnswerRow(content: string, host: TurnFallbackHostFields): ChatMessage {
  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `fallback-${Date.now().toString(36)}`
  return {
    id,
    role: 'assistant',
    content,
    createdAt: Date.now(),
    model: host.model,
    permissionMode: host.permissionMode,
  }
}

/**
 * 落一次兜底判定。可重入(幂等由共享层判据保证)。
 *
 * `alreadyFailed` / `userStopped` 在判据**之后、写入之前**短路,理由:
 * - 失败轮的 content 是错误文案而非回答。共享层已把失败轮排除在"答案已在"之外
 *   (`answerRowsOf` 过滤 `isErrorTurn`),所以判定不会误判成 duplicate;但写入必须跳过 ——
 *   否则会在错误卡之后再加一条回答,把"这轮失败了"说成"这轮答了"。
 * - 用户自己按了停止属"已停止",把它改判成 failed 就是把用户的选择说成故障。
 */
export function applyTurnAnswerFallback(
  input: ApplyTurnAnswerFallbackInput,
): ApplyTurnAnswerFallbackResult {
  const { chatStore, answer, host } = input
  const entries = chatStore.getState().messages

  const applied = applyTurnFallbackAnswer(entries, answer, {
    createAnswerRow: (content) => newAnswerRow(content, host),
  })

  if (applied.decision.kind !== 'append') {
    // empty / duplicate:零写入 —— 空响应不伪造 agent 气泡;同内容不追加第二遍(内容幂等)
    return { decision: applied.decision, wrote: false }
  }
  if (input.alreadyFailed || input.userStopped) {
    return { decision: applied.decision, wrote: false }
  }
  if (applied.entries === entries) {
    // 理论上不可达(append 必然产出新数组);保持"没写就不说写了"
    return { decision: applied.decision, wrote: false }
  }

  chatStore.getState().setMessages([...applied.entries] as ChatMessage[])
  return { decision: applied.decision, wrote: true }
}

/**
 * 空响应档的端内落点:把空占位换成非"完成"的终态卡。
 *
 * 为什么走 `setMessageError`:它是既有唯一能让"内容为空的 assistant 行"不再渲染成
 * 空气泡、且自带重试入口的出口(`markStreamError` 只在内容为空时写入文案)。
 * 文案与错误码由调用方传入(本层不编造),二者都取既有词条,零新增 i18n 键。
 */
export function markEmptyTurn(
  chatStore: ChatStore,
  assistantId: string,
  emptyText: string,
  errorCode?: string,
): void {
  chatStore.getState().setMessageError(assistantId, emptyText, errorCode)
}

export const __test__ = {
  toEntry: (row: ChatMessage): TurnAnswerEntry => ({ role: row.role, content: row.content }),
  newAnswerRow,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
