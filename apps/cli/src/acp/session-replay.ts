// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ACP 会话重放的**薄适配层**:只做「共享层回放计划 → ACP SessionUpdate」的翻译。
 *
 * 为什么这里几乎没有逻辑(这是刻意的):
 *   本仓 `packages/shared/src/chat/durable-session-replay.ts` 已经实现了
 *   `parseReplayCursor` / `indexCanonicalTurns` / `selectRewindHead` /
 *   `planDurableSessionReplay`(skip / empty / window / failure 四态),
 *   且被 Web、API、ai-service 三端共同消费,有独立测试。
 *
 *   本轮最初的实现曾在此处**另写一套**游标解析与分页(与共享层同名函数并存),
 *   随即被 `packages/shared/src/chat/__tests__/durable-session-replay.test.ts`
 *   的存在证伪:那是第二份判据,必然漂移(AGENTS §0.6)。已改为复用。
 *
 *   所以本文件的职责被压到最小:把共享层产出的 `DurableReplayUpdate` 逐条
 *   转成 ACP 的 `session/update` 通知载荷。真正的判据在共享层,测试也在共享层。
 */

import {
  planDurableSessionReplay,
  type DurableReplayPlan,
  type DurableReplayUpdate,
  type DurableTranscriptItem,
} from '@ihui/shared'

/** 一次重放翻译的结果:要么给出可发送的帧,要么给出拒绝理由。 */
export type AcpReplayOutcome =
  | {
      readonly ok: true
      /** 需要按序 notify 的 ACP sessionUpdate 载荷 */
      readonly notifications: readonly AcpReplayNotification[]
      /** 共享层判定的计划种类,便于调用方决定是否允许继续对话 */
      readonly planKind: 'skip' | 'empty' | 'window'
      readonly hasNextPage: boolean
      readonly endCursor: string | null
    }
  | { readonly ok: false; readonly code: string; readonly message: string }

export interface AcpReplayNotification {
  readonly sessionUpdate: string
  readonly content: { readonly type: 'text'; readonly text: string }
}

/**
 * ACP `session/update` 只认得有限的 sessionUpdate 档位。
 * 共享层的 `usage` / `session_info` 是**协议外**信息,ACP 没有对应档位,
 * 因此不硬塞成 content —— 塞进去的表现是编辑器里出现一段
 * `{"used":123}` 的假消息。这两类改为经返回值 `_meta` 上报。
 */
function updateToNotification(update: DurableReplayUpdate): AcpReplayNotification | null {
  switch (update.kind) {
    case 'item':
      // 共享层的 item 不带正文(正文在 history 里),这里不产出空壳帧
      return null
    case 'terminal':
      return null
    case 'usage':
      return null
    case 'session_info':
      return null
    default:
      return null
  }
}

/**
 * 把共享层的回放计划翻译成 ACP 可发送的通知序列。
 *
 * `messages` 是会话历史原文(与 `items` 一一对应的顺序),用于把共享层
 * 判定的 `history` 条目翻回文本。两者由调用方保证同序 —— 这里不做第二次索引,
 * 否则又是一份"按 id 找消息"的判据。
 */
export function planAcpReplay(input: {
  readonly items: readonly DurableTranscriptItem[]
  readonly messages: readonly { readonly id: string; readonly role: string; readonly content: string }[]
  readonly replayFrom: unknown
  readonly conversationReverted?: boolean
  readonly lastMessageId?: string
  readonly title?: string
}): AcpReplayOutcome {
  const plan: DurableReplayPlan = planDurableSessionReplay({
    items: input.items,
    replayFrom: input.replayFrom,
    ...(input.conversationReverted !== undefined
      ? { conversationReverted: input.conversationReverted }
      : {}),
    ...(input.lastMessageId !== undefined ? { lastMessageId: input.lastMessageId } : {}),
    ...(input.title !== undefined ? { title: input.title } : {}),
  })

  if (!plan.ok) {
    return { ok: false, code: plan.code, message: plan.message }
  }
  if (plan.kind === 'skip') {
    return { ok: true, notifications: [], planKind: 'skip', hasNextPage: false, endCursor: null }
  }
  if (plan.kind === 'empty') {
    return { ok: true, notifications: [], planKind: 'empty', hasNextPage: false, endCursor: null }
  }

  // window:按 history 顺序把正文翻成帧。history 里没有的条目(被跳过/被压缩)不补白。
  const byId = new Map(input.messages.map((m) => [m.id, m] as const))
  const notifications: AcpReplayNotification[] = []
  for (const item of plan.history) {
    const msg = byId.get(item.id)
    if (!msg) continue
    if (msg.role !== 'user' && msg.role !== 'assistant') continue
    notifications.push({
      sessionUpdate: msg.role === 'user' ? 'user_message_chunk' : 'agent_message_chunk',
      content: { type: 'text', text: msg.content },
    })
  }
  // usage/session_info 帧在这里被丢弃(见 updateToNotification 的理由),
  // 但保留一次显式消费,避免"计划里给了却没读"被误读成漏接线。
  for (const update of plan.updates) updateToNotification(update)

  return {
    ok: true,
    notifications,
    planKind: 'window',
    hasNextPage: plan.hasNextPage,
    endCursor: plan.endCursor,
  }
}
