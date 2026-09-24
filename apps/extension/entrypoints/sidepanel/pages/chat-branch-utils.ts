// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 会话分叉(branch)端内纯逻辑(2026-09-25 立)。
 *
 * 后端与客户端出口早已入库(POST /api/chat/conversations/:id/branch,
 * 经 @ihui/api-client 的 branchConversation),extension 缺的只是宿主接线。
 * 本文件把宿主里"能判对错的三步"抽成无副作用纯函数,便于测真模块:
 * 1. 哪条消息可以分叉(必须是**已落库的 assistant 回复**,且当前不在流式生成中)
 * 2. 分支回来的服务端消息列表 → 端内本地消息 + 本地 id↔服务端 id 映射
 * 3. 失败文案必须带服务状态码(禁止静默 return,见 AGENTS.md「失败要响」)
 *
 * 语义与 web 消费点对齐:apps/web/src/hooks/use-chat/send-message.ts `branchMessage`。
 */

/** 端内本地消息的最小投影(与 @ihui/shared ChatMessage 结构兼容) */
export interface LocalMessageLike {
  id: string
  role: string
  content: string
}

/** 服务端已落库消息的最小投影(ConversationMessage 的结构子集) */
export interface PersistedMessageLike {
  id: string
  role: string
  content: string
}

/** 本地消息 id → 后端 chat_messages.id。
 *  扩展端流式消息的 id 是本地生成的,只有持久化成功才拿得到服务端 id;
 *  分叉接口只认服务端 id,所以这张表是分叉的唯一准入依据。 */
export type ServerIdMap = Readonly<Record<string, string>>

/**
 * 取该消息可分叉的后端 messageId,不可分叉返回 null。
 *
 * 三条判据缺一不可:
 * - role === 'assistant':用户消息不是"AI 回复",分叉它等于复制自己的话;
 * - 流式生成中不给分叉:该条正文还没落库,分过去是半截回复;
 * - 必须有服务端 id:没持久化成功的消息在后端不存在,branch 必然 404。
 */
export function branchTargetServerId(
  message: LocalMessageLike,
  serverIds: ServerIdMap,
  opts: { streaming: boolean },
): string | null {
  if (opts.streaming) return null
  if (message.role !== 'assistant') return null
  if (message.content.trim() === '') return null
  return serverIds[message.id] ?? null
}

/**
 * 分支返回的服务端消息列表 → 端内可渲染状态。
 *
 * 只保留 user / assistant 且正文非空的消息(system 由后端 systemPrompt 承担,
 * 端内气泡没有对应形态);返回的 serverIds 是**恒等映射**——这批消息的本地 id
 * 就是服务端 id,后续在该分支上继续对话仍可逐条分叉。
 */
export function hydrateBranchTranscript(list: readonly PersistedMessageLike[]): {
  messages: Array<{ id: string; role: 'user' | 'assistant'; content: string }>
  serverIds: Record<string, string>
} {
  const messages: Array<{ id: string; role: 'user' | 'assistant'; content: string }> = []
  const serverIds: Record<string, string> = {}
  for (const item of list) {
    if (item.role !== 'user' && item.role !== 'assistant') continue
    if (item.content.trim() === '') continue
    messages.push({ id: item.id, role: item.role, content: item.content })
    serverIds[item.id] = item.id
  }
  return { messages, serverIds }
}

/**
 * 失败文案的"服务状态码"位。
 *
 * 状态码取不到时如实写 unknown,不得留空 —— 空串会让用户看到
 * "分叉失败(服务状态 )"这种无信息量文案,也无法据此判断是网关还是业务错。
 */
export function failureStatusText(status: number | undefined): string {
  return typeof status === 'number' ? String(status) : 'unknown'
}

/** 失败文案的"原因"位:后端 message 优先,网络异常时退到 Error.message。 */
export function failureReasonText(reason: string | undefined | null): string {
  const trimmed = reason?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : 'network error'
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
