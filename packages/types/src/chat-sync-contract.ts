// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 票71(V2 #23,2026-10-08 契约先行切片):chat 多端/多标签实时同步 ——
 * SSE 与 WS 双通道的「同一消息 patch 幂等」契约 + 接收端判据内核。
 *
 * 背景(台账 8056 行,现读为准):一条会话的同一份消息面会同时被两条通道喂——
 * SSE 是"生成端单播流"(delta/重连重放),WS(未来)是"多端房间广播"(message:created/patched)。
 * 两条通道都按 at-least-once 语义投递,同一逻辑变更大概率到达两次;若各端各写一套
 * 去重,表现不是报错,而是"看端文本翻倍/迟到的 delta 复活旧内容/断链后静默错位"
 * —— 与 traceparent(D147)同族:判据一旦放松,每一跳自己看都是好的。
 * 故契约与判据必须只有一份,先于通道落地(本文件),通道接线票只许消费、不许另写。
 *
 * 住在 packages/types 的理由:与 traceparent 同一判据(现读依赖图)——api-client
 * 依赖面为空,各端唯一的共享出口是 @ihui/types;放 shared 会逼出 workspace 依赖或
 * 各端抄一份。判据内核是纯函数(零平台依赖,不碰 node:*,守门 126 纯度同理)。
 *
 * 交付边界(本轮 = 契约先行,半程):
 * - 已定:事件形状、幂等主键、rev 语义、接收端四态裁定、幂等判据(测试钉死)。
 * - 未定(接线票补):通道帧名与 packages/shared/src/sse/contract.ts 的收敛、
 *   WS 房间协议、resync(断链补快照)的传输、terminal/done 帧、meta 结构性 patch
 *   (与票64 pin/书签 sibling 存储共面)。见 docs/chat-sync-contract.md §7。
 *
 * 三条不许漂(与 docs/chat-sync-contract.md 逐字同源,改必须两边一起改):
 * 1. 幂等主键 = `(messageId, rev)`。同一逻辑变更无论走哪条通道,这对键必须逐字相同;
 *    `message:created` 以 messageId 本身判重(创建天然唯一,无修订号)。
 * 2. rev 由**服务端**分配:每消息从 1 起、严格递增、不重号、不回退。端侧乐观本
 *    (未到服务端的本地改动)不在本契约内,不得自造 rev 混入同一条链。
 * 3. `snapshot` 自包含判据:rev=N 的 snapshot 必须已包含 ≤N 的全部内容变更。
 *    这一条成立,才有"低 rev 迟到一律丢弃(stale)永远安全"——它防的是
 *    "WS 快照落地后,SSE 迟到的 delta 把内容回退到半截"。
 */

/** 协议版本。判据或事件形状做不兼容变更时递增后缀;接收端遇到不认识的版本按 gap 处理。 */
export const CHAT_SYNC_PROTOCOL_VERSION = 'chat-sync.v1' as const
export type ChatSyncProtocolVersion = typeof CHAT_SYNC_PROTOCOL_VERSION

/**
 * 交付通道。内核刻意不读这个字段(见 applyChatSyncEvent):
 * 同一逻辑事件换通道重投必须被裁成 duplicate,这本身就是契约的一部分,由测试钉死。
 */
export type ChatSyncChannel = 'sse' | 'ws'

/** 房间作用域。v1 只有 conversation 房间;扩展(如 workspace 广播)须升 protocolVersion。 */
export interface ChatSyncRoom {
  kind: 'conversation'
  conversationId: string
}

/**
 * 消息角色。刻意不 import './chat.js' 的 ChatRole(2026-10-08 现读:该文件工作树副本
 * 正被并发会话持有,本切片不与之建立编译耦合;字面量完全同形,接线票收敛时一并归并)。
 */
export type ChatSyncRole = 'user' | 'assistant' | 'system'

/** patch 幂等主键。chatPatchKey() 给出它的 canonical 字符串形态(判重缓存/日志用)。 */
export interface ChatPatchIdempotencyKey {
  messageId: string
  rev: number
}

/**
 * patch 载荷形态(只此两种;meta/结构位等新增形态必须升 protocolVersion):
 * - `delta`:追加增量。rev 必须恰好 = 已应用 rev + 1(断链不可安全应用)。
 * - `snapshot`:全量替换。自包含,跨 gap 也可安全应用(恢复路径靠它)。
 */
export type ChatPatchKind = 'delta' | 'snapshot'

/** 双通道公共封套字段。channel/room/emittedAt 都是投递元数据,不参与幂等判定(时钟不可信)。 */
interface ChatSyncEventBase {
  protocolVersion: ChatSyncProtocolVersion
  channel: ChatSyncChannel
  room: ChatSyncRoom
  /** 生产时刻(ISO 8601),仅诊断用;接收端不得据它排序或判重。 */
  emittedAt?: string
}

/**
 * `message:created`:房间内新消息的完整初面。以 messageId 判重——
 * 重复投递(双通道齐发/重连重放)必须零变化,**不得**用它覆盖已收到 patch 的既有面
 * (否则重放会把流式增量打回初稿,这是本契约防的第二类自伤)。
 */
export interface ChatMessageCreatedEvent extends ChatSyncEventBase {
  type: 'message:created'
  messageId: string
  role: ChatSyncRole
  content: string
  reasoning?: string
}

/**
 * `message:patched`:对既有消息的一次修订。rev 从 1 起(0 是 created 的哨兵,不落链)。
 * - kind='delta':`textDelta` 必填,追加到 content 末尾。
 * - kind='snapshot':`content` 必填(全量);`reasoning` 可选,缺省 = 保持原值。
 */
export interface ChatMessagePatchedEvent extends ChatSyncEventBase {
  type: 'message:patched'
  messageId: string
  rev: number
  kind: ChatPatchKind
  textDelta?: string
  content?: string
  reasoning?: string
}

export type ChatSyncEvent = ChatMessageCreatedEvent | ChatMessagePatchedEvent

/** 契约管得到的消息面(各端自有 store 形状的投影;接线票把内核嵌进 store 时由此对齐)。 */
export interface ChatSyncMessageSurface {
  id: string
  role: ChatSyncRole
  content: string
  reasoning?: string
}

/** 判据内核的状态面:每消息已应用到的 rev + 消息面。两处 Map 均按不可变更新。 */
export interface ChatSyncState {
  messages: ReadonlyMap<string, ChatSyncMessageSurface>
  appliedRevs: ReadonlyMap<string, number>
}

/** 全空状态。内核永不改写入参,复用本值安全。 */
export const EMPTY_CHAT_SYNC_STATE: ChatSyncState = {
  messages: new Map(),
  appliedRevs: new Map(),
}

/** created 的 rev 哨兵(结果面用;链上不存在 rev 0 的 patch)。 */
const CREATED_REV_SENTINEL = 0

export type ChatSyncRejectReason = 'duplicate' | 'stale' | 'gap'

export interface ChatSyncApplyOk {
  applied: true
  messageId: string
  /** created 命中时为 0(哨兵);patched 时为本次应用的 rev。 */
  rev: number
}

export interface ChatSyncApplyRejected {
  applied: false
  reason: ChatSyncRejectReason
  messageId: string
  /** created 被拒时为 0(哨兵)。 */
  rev: number
  /** 应用本事件前该消息已到的 rev(created 判重时 = 它的 patch 链头,可能已 >0)。 */
  lastAppliedRev: number
}

export type ChatSyncApplyResult = ChatSyncApplyOk | ChatSyncApplyRejected

/** `(messageId, rev)` 的 canonical 字符串。形态被测试逐字锁定——改它 = 判重缓存互不相认。 */
export function chatPatchKey(key: ChatPatchIdempotencyKey): string {
  return `${key.messageId}#${key.rev}`
}

/** 事件的幂等键字符串。同一逻辑变更经 sse/ws 双投,此值必须相等(测试钉死)。 */
export function chatSyncIdempotencyKey(event: ChatSyncEvent): string {
  return event.type === 'message:created'
    ? `${event.messageId}#created`
    : chatPatchKey({ messageId: event.messageId, rev: event.rev })
}

/**
 * 接收端唯一入口:把一条同步事件应用到状态面上。纯函数、不可变更新;
 * **被拒时返回原 state 引用**(判据:拒绝不得触发状态发布/重渲染)。
 *
 * 裁定表(与 docs/chat-sync-contract.md §4 逐字同源):
 * | 输入                                   | 裁定      | 状态 |
 * |----------------------------------------|-----------|------|
 * | created,messages 已有该 id             | duplicate | 不变 |
 * | patched,消息不存在(含 created 未达)   | gap       | 不变 |
 * | patched,rev === lastAppliedRev         | duplicate | 不变 |
 * | patched,rev <  lastAppliedRev          | stale     | 不变 |
 * | delta,rev > lastAppliedRev + 1         | gap       | 不变 |
 * | snapshot,rev > lastAppliedRev          | 应用(自包含,可跨 gap) |
 * | delta,rev === lastAppliedRev + 1       | 应用 |
 */
export function applyChatSyncEvent(
  state: ChatSyncState,
  event: ChatSyncEvent,
): { state: ChatSyncState; result: ChatSyncApplyResult } {
  if (event.type === 'message:created') {
    if (state.messages.has(event.messageId)) {
      return {
        state,
        result: {
          applied: false,
          reason: 'duplicate',
          messageId: event.messageId,
          rev: CREATED_REV_SENTINEL,
          lastAppliedRev: state.appliedRevs.get(event.messageId) ?? CREATED_REV_SENTINEL,
        },
      }
    }
    const messages = new Map(state.messages)
    messages.set(event.messageId, {
      id: event.messageId,
      role: event.role,
      content: event.content,
      ...(event.reasoning !== undefined ? { reasoning: event.reasoning } : {}),
    })
    return {
      state: { messages, appliedRevs: state.appliedRevs },
      result: { applied: true, messageId: event.messageId, rev: CREATED_REV_SENTINEL },
    }
  }

  const { messageId, rev, kind } = event
  const surface = state.messages.get(messageId)
  if (!surface) {
    return {
      state,
      result: {
        applied: false,
        reason: 'gap',
        messageId,
        rev,
        lastAppliedRev: CREATED_REV_SENTINEL,
      },
    }
  }
  const lastAppliedRev = state.appliedRevs.get(messageId) ?? CREATED_REV_SENTINEL
  if (rev === lastAppliedRev) {
    return {
      state,
      result: { applied: false, reason: 'duplicate', messageId, rev, lastAppliedRev },
    }
  }
  if (rev < lastAppliedRev) {
    return { state, result: { applied: false, reason: 'stale', messageId, rev, lastAppliedRev } }
  }
  if (kind === 'delta' && rev > lastAppliedRev + 1) {
    return { state, result: { applied: false, reason: 'gap', messageId, rev, lastAppliedRev } }
  }

  const messages = new Map(state.messages)
  const appliedRevs = new Map(state.appliedRevs)
  if (kind === 'delta') {
    // 生产端义务:textDelta 必填;缺省按空串兜底(仍消耗 rev,保持链判定确定性)。
    messages.set(messageId, { ...surface, content: surface.content + (event.textDelta ?? '') })
  } else {
    messages.set(messageId, {
      ...surface,
      content: event.content ?? surface.content,
      ...(event.reasoning !== undefined ? { reasoning: event.reasoning } : {}),
    })
  }
  appliedRevs.set(messageId, rev)
  return { state: { messages, appliedRevs }, result: { applied: true, messageId, rev } }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
