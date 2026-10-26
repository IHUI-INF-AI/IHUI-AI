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
 * 交付边界(2026-10-26 现读):
 * - 已定:事件形状、幂等主键、rev 语义、接收端四态裁定、幂等判据(测试钉死)。
 * - 已收口:帧名与 packages/shared/src/sse/contract.ts 的收敛(`CHAT_SYNC_EVENT_NAMES`
 *   单源,sse 侧只引用、不重写值);resync 快照端点(`ChatSyncMessageSnapshot`)。
 * - 2026-10-26 contract 切片:terminal 帧(`message:terminal`,独立帧 + v2 信封 ——
 *   不是给 `message:patched` 加可选 `status?` 的假支持)与 resync 传输的客户端契约
 *   (`planChatSyncResync` / `mergeChatSyncResyncSnapshot`)落定。生产端发终态、
 *   web store 状态投影、WS 载体登记仍未接 —— 三者必须同批,见 docs/chat-sync-contract.md §7。
 * - 未定(接线票补):WS 房间订阅协议、meta 结构性 patch(与票64 pin/书签 sibling 存储共面)、
 *   非 web 端 store 接线。
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

/**
 * 协议版本。判据或事件形状做不兼容变更时递增后缀;接收端遇到不认识的版本按 gap 处理。
 *
 * v1 = created / patched 的线格式(与既有生产面、web store、shared sse 契约逐字一致)。
 * v2 = terminal 帧(2026-10-26 contract 切片)。终态做成**新增帧**而不是给 patched 加
 * 可选 `status?` —— 后者是"类型层加可选项、实现照旧"的假支持;按契约 §2 的口径,
 * 新增形态必须升 protocolVersion。只把 terminal 升 v2、既有两枚不动,是为了不把在飞的
 * 他席代码(web store 测试钉死 v1 字面量)连带打红;生产端开始发终态时,由通道接线票
 * 把整链路一次切到 v2。
 */
export const CHAT_SYNC_PROTOCOL_VERSION = 'chat-sync.v1' as const

/** terminal 帧的信封版本(见上;v2 目前只有这一枚帧)。 */
export const CHAT_SYNC_TERMINAL_PROTOCOL_VERSION = 'chat-sync.v2' as const

export type ChatSyncProtocolVersion =
  typeof CHAT_SYNC_PROTOCOL_VERSION | typeof CHAT_SYNC_TERMINAL_PROTOCOL_VERSION

/**
 * chat-sync 帧名常量 —— **全仓唯一真相源**(2026-10-25,票 B02 余面①)。
 *
 * 为什么必须只有一份:同一逻辑变更要在两条通道上携带逐字相同的键(§2 第 1 条),
 * 而帧名是两条通道唯一共用的线上锚点 —— 生产构造器、广播载体注册、送信契约、端侧订阅
 * 各抄一份字面量,漂移的表现不是报错,是"一端收不到另一端的帧"(§0.6)。
 *
 * 现读的消费面:
 *  - 本文件 `ChatMessageCreatedEvent` / `ChatMessagePatchedEvent` 的 `type` 由本表派生;
 *  - `packages/shared/src/sse/contract.ts` 的 `SSE_CHAT_SYNC_EVENT_NAMES` **直接引用本对象**
 *    (不是第二份值),并刻意不并进 `SSE_EVENTS`(那一族与 ai-service 逐名对账,理由见该文件);
 *  - 生产构造器与广播载体注册在 `user-broadcast.ts`(票71 第二切片);其线格式字面量与本表
 *    是同一字面量类型,改名会当场编译失败。
 *
 * 改名 = 不兼容变更:必须同批升 `CHAT_SYNC_PROTOCOL_VERSION`、改 docs/chat-sync-contract.md
 * 与全部消费点(契约 §7 第 1 项已收口到本表)。
 */
export const CHAT_SYNC_EVENT_NAMES = {
  /** 房间内新消息的完整初面(以 messageId 判重,无修订号) */
  MESSAGE_CREATED: 'message:created',
  /** 对既有消息的一次修订(rev 链,从 1 起) */
  MESSAGE_PATCHED: 'message:patched',
  /** 消息/流的终态(v2 信封;rev = 终结时的链头,不新增修订号) */
  MESSAGE_TERMINAL: 'message:terminal',
} as const

/** 三枚帧名的联合类型(与 `SSEEventName` 是两个域,不得合并;见上表注释)。 */
export type ChatSyncEventName = (typeof CHAT_SYNC_EVENT_NAMES)[keyof typeof CHAT_SYNC_EVENT_NAMES]

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
 *
 * 2026-10-24(票71 第二切片):由裸类型升级为「封闭集 + 判据」—— 服务端发射口要按同一张表
 * 把库里的 role 字符串折成契约角色,消费端也要按同一张表判帧;两处各写一份必然漂移。
 */
export const CHAT_SYNC_ROLES = ['user', 'assistant', 'system'] as const

export type ChatSyncRole = (typeof CHAT_SYNC_ROLES)[number]

/** 不可识别的角色 ⇒ false(发射口据此跳过并点名,消费端据此判「未判定」) */
export function isChatSyncRole(v: unknown): v is ChatSyncRole {
  return typeof v === 'string' && (CHAT_SYNC_ROLES as readonly string[]).includes(v)
}

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

/** patch 形态封闭集 + 判据(同 CHAT_SYNC_ROLES:生产面与消费面共用一张表) */
export const CHAT_PATCH_KINDS = ['delta', 'snapshot'] as const

export function isChatPatchKind(v: unknown): v is ChatPatchKind {
  return typeof v === 'string' && (CHAT_PATCH_KINDS as readonly string[]).includes(v)
}

/**
 * 终态原因封闭集(2026-10-26)。语义不是"HTTP 状态",而是**流为什么收尾**:
 * - `stop`:模型正常结束;
 * - `length`:撞到长度/输出上限被截断(内容可信但可能不完整);
 * - `content_filter`:被内容策略截断;
 * - `error`:生成期错误(服务端已写库并广播的终态,不是网络错误);
 * - `aborted`:用户/客户端主动停止。
 *
 * 封闭而不开字符串有同一个理由(CHAT_SYNC_ROLES / MCP_CONNECTION_STATES 同纪律):
 * 消费端要为每一档给一句可操作的话,开放集会让"多出来的一档"静默渲染成空白 ——
 * 而终态恰恰是用户最需要看懂的那一格。
 */
export const CHAT_SYNC_TERMINAL_REASONS = [
  'stop',
  'length',
  'content_filter',
  'error',
  'aborted',
] as const

export type ChatSyncTerminalReason = (typeof CHAT_SYNC_TERMINAL_REASONS)[number]

/** 不可识别的终态原因 ⇒ false(发射口据此跳过并点名,消费端据此判「未判定」) */
export function isChatSyncTerminalReason(v: unknown): v is ChatSyncTerminalReason {
  return typeof v === 'string' && (CHAT_SYNC_TERMINAL_REASONS as readonly string[]).includes(v)
}

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
  /** created 的线格式没有不兼容变更,恒为 v1(见协议版本注释)。 */
  protocolVersion: typeof CHAT_SYNC_PROTOCOL_VERSION
  type: typeof CHAT_SYNC_EVENT_NAMES.MESSAGE_CREATED
  messageId: string
  role: ChatSyncRole
  content: string
  reasoning?: string
}

/**
 * `message:patched`:对既有消息的一次修订。rev 从 1 起(0 是 created 的哨兵,不落链)。
 * - kind='delta':`textDelta` 必填,追加到 content 末尾。
 * - kind='snapshot':`content` 必填(全量);`reasoning` 可选,缺省 = 保持原值。
 *
 * 终态**不是**第三种 kind:它走独立帧 `message:terminal`(v2),见 ChatMessageTerminalEvent。
 */
export interface ChatMessagePatchedEvent extends ChatSyncEventBase {
  /** patched 的线格式没有不兼容变更,恒为 v1(见协议版本注释)。 */
  protocolVersion: typeof CHAT_SYNC_PROTOCOL_VERSION
  type: typeof CHAT_SYNC_EVENT_NAMES.MESSAGE_PATCHED
  messageId: string
  rev: number
  kind: ChatPatchKind
  textDelta?: string
  content?: string
  reasoning?: string
}

/**
 * `message:terminal`(2026-10-26 contract 切片):消息/流的终态。
 *
 * 三条判据:
 * 1. **独立帧、不是 patched 的可选字段**:终态要在生产端(流收尾写库 + 广播)与消费端
 *    (各端 store 状态投影)同批落地;只在 `message:patched` 上加 `status?` 会变成
 *    "类型层加可选项、实现照旧"的假支持(契约 §7 第 4 项的原判定)。独立帧 + v2 信封
 *    让"没实现"在线上是可判的,而不是看起来支持。
 * 2. **rev = 终结时已到达的链头,不新增修订号**:终态是状态位,不携带内容;它只能落在
 *    已应用的链头上(`rev === lastAppliedRev`)。超前 = 缺内容 rev ⇒ gap(resync);
 *    滞后 = stale;同 rev 重复 = duplicate。这样 (messageId, rev) 主键不必新增形态。
 * 3. **粘性**:终态一旦打上,后续 delta 即便 rev 恰好 = last+1 也判 gap(流已收尾,
 *    同一消息的续写应是一条新消息);snapshot 仍可推进内容(服务端权威修正),
 *    但不会把终态打回"进行中"。
 */
export interface ChatMessageTerminalEvent extends ChatSyncEventBase {
  /** 终态属新增形态,按契约 §2 升 v2(见协议版本注释)。 */
  protocolVersion: typeof CHAT_SYNC_TERMINAL_PROTOCOL_VERSION
  type: typeof CHAT_SYNC_EVENT_NAMES.MESSAGE_TERMINAL
  messageId: string
  /** 终结时的修订链头(必须等于端侧 lastAppliedRev 才可应用;0 = 只有 created)。 */
  rev: number
  reason: ChatSyncTerminalReason
}

export type ChatSyncEvent =
  ChatMessageCreatedEvent | ChatMessagePatchedEvent | ChatMessageTerminalEvent

/** 已落地的终态标记(挂在消息面上;rev = 宣告终结时的链头)。 */
export interface ChatSyncTerminalState {
  rev: number
  reason: ChatSyncTerminalReason
}

/** 契约管得到的消息面(各端自有 store 形状的投影;接线票把内核嵌进 store 时由此对齐)。 */
export interface ChatSyncMessageSurface {
  id: string
  role: ChatSyncRole
  content: string
  reasoning?: string
  /** 终态标记;缺省 = 尚无终态(或该端尚未接终态投影,见契约 §7)。 */
  terminal?: ChatSyncTerminalState
}

/**
 * resync 权威快照(契约 §7 第 3 项,2026-10-25 第三切片落地):
 * `GET /conversations/:id/messages/:messageId/sync-snapshot` 的 data 形状。
 *
 * "rev=N 全量"语义:rev 即该消息当前修订链头,content/reasoning 是**链头时刻的全量自包含面**
 * —— 契约 §2 第 3 条(snapshot 自包含判据)在传输面的投影。接收端把本形状折成
 * created(判据面缺行时)+ patched(kind='snapshot', rev=N)两步喂内核 applyChatSyncEvent,
 * 不经任何旁路写状态。
 *
 * rev=0 = 该消息从未广播过 patch(created 初面即权威;0 是 created 的链下哨兵,见下)。
 *
 * 2026-10-26:新增可选 `terminal`。判据面缺行/断链的端侧拉回本快照时,除了内容还要知道
 * "这条流是不是已经收尾" —— 否则错过 terminal 帧的端会永远停在"进行中"。
 * `mergeChatSyncResyncSnapshot` 先落内容快照、再按同一 rev 打终态标记。
 */
export interface ChatSyncMessageSnapshot {
  conversationId: string
  messageId: string
  /** 当前修订链头;0 = 链上无 patch(created 初面即权威)。 */
  rev: number
  role: ChatSyncRole
  content: string
  reasoning?: string
  /** 链头是否已收尾;有值 = 该消息的流在 rev 处终止(与 terminal 帧的 reason 同域)。 */
  terminal?: ChatSyncTerminalReason
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
  /** created 命中时为 0(哨兵);patched / terminal 时为本次事件的 rev(terminal 不新增修订号)。 */
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
  return event.type === CHAT_SYNC_EVENT_NAMES.MESSAGE_CREATED
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
 * | delta,已存在终态标记                   | gap       | 不变(终态粘性) |
 * | terminal,消息不存在                    | gap       | 不变 |
 * | terminal,rev <  lastAppliedRev         | stale     | 不变 |
 * | terminal,rev >  lastAppliedRev         | gap       | 不变(缺内容 rev) |
 * | terminal,rev === lastAppliedRev(已同 rev 终态) | duplicate | 不变 |
 * | terminal,rev === lastAppliedRev(未终态) | 应用(只打终态标记,不新增 rev) |
 */
export function applyChatSyncEvent(
  state: ChatSyncState,
  event: ChatSyncEvent,
): { state: ChatSyncState; result: ChatSyncApplyResult } {
  if (event.type === CHAT_SYNC_EVENT_NAMES.MESSAGE_CREATED) {
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

  if (event.type === CHAT_SYNC_EVENT_NAMES.MESSAGE_TERMINAL) {
    const { messageId, rev } = event
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
    if (rev < lastAppliedRev) {
      return { state, result: { applied: false, reason: 'stale', messageId, rev, lastAppliedRev } }
    }
    // 终态必须落在已应用的链头上:超前 = 缺内容 rev,先 resync;凭空宣告结束会把
    // "内容还没到"渲染成"已收尾",且此后的 delta 全被判 gap。
    if (rev > lastAppliedRev) {
      return { state, result: { applied: false, reason: 'gap', messageId, rev, lastAppliedRev } }
    }
    // 同 rev 已宣告过终态 ⇒ duplicate;同 rev 不同 reason 属生产端违约,同样零变化。
    if (surface.terminal?.rev === rev) {
      return {
        state,
        result: { applied: false, reason: 'duplicate', messageId, rev, lastAppliedRev },
      }
    }
    const messages = new Map(state.messages)
    messages.set(messageId, { ...surface, terminal: { rev, reason: event.reason } })
    // 终态是状态位、不是新修订:appliedRevs 不动(rev 已由内容 patch 走过)。
    return {
      state: { messages, appliedRevs: state.appliedRevs },
      result: { applied: true, messageId, rev },
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
  // 终态粘性:已收尾的消息不再接 delta(即便 rev 恰好 = last+1)。同一消息的续写应是
  // 一条新消息;此处判 gap 交给 resync 确认,而不是把终态打回"进行中"。
  if (kind === 'delta' && surface.terminal) {
    return { state, result: { applied: false, reason: 'gap', messageId, rev, lastAppliedRev } }
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

/* ==================== resync 传输契约(2026-10-26 contract 切片) ==================== */

/**
 * 一次 resync 的请求坐标 —— 对应 `GET /conversations/:id/messages/:messageId/sync-snapshot`
 * 的三个入参。端侧只在**判 gap** 时发(契约 §4:缺 rev 的帧可原样缓存重投,但缺到无法补齐时
 * 直接拉服务端权威快照更快;拉回后走 mergeChatSyncResyncSnapshot 并回)。
 */
export interface ChatSyncResyncRequest {
  conversationId: string
  messageId: string
  /**
   * 端侧已应用的链头。服务端据此可判端侧是否落后(诊断/日志用),**不是授权凭据**
   * —— 归属由查询侧按 (conversationId, messageId) 一查定案(同 sync-snapshot 路由)。
   */
  lastAppliedRev: number
}

/**
 * 是否发起 resync。只有 gap 发:
 * - `applied`(正常应用)→ 不发;
 * - `duplicate`(双通道/重放)→ 不发;
 * - `stale`(低 rev 迟到)→ 不发;
 * 三者发出去 = 每帧都去拉一整套快照,把幂等做成 DDoS。只有 gap 是"本地缺一块、
 * 自愈不了"的信号,而 duplicate/stale 是契约规定的正常路径。
 */
export type ChatSyncResyncPlan =
  { needed: false } | { needed: true; request: ChatSyncResyncRequest }

/** gap 判定的唯一转译点:内核结果 → resync 请求(端侧不得在 store/hook 里另写一套判据)。 */
export function planChatSyncResync(input: {
  conversationId: string
  result: ChatSyncApplyResult
}): ChatSyncResyncPlan {
  const { conversationId, result } = input
  if (result.applied || result.reason !== 'gap') return { needed: false }
  return {
    needed: true,
    request: {
      conversationId,
      messageId: result.messageId,
      lastAppliedRev: result.lastAppliedRev,
    },
  }
}

/** resync 快照并回的逐步裁定(两步全走 applyChatSyncEvent,无旁路写状态)。 */
export interface ChatSyncResyncMergeOutcome {
  state: ChatSyncState
  /** 缺行时的 created 补达裁定;判据面已有该行时为 null。 */
  created: ChatSyncApplyResult | null
  /** 内容快照(kind='snapshot', rev=N)的裁定。 */
  content: ChatSyncApplyResult
  /** 终态步裁定;快照未携带 terminal 时为 null。 */
  terminal: ChatSyncApplyResult | null
  /** 本次合并是否真的改过状态(created/content/terminal 任一 applied)。 */
  applied: boolean
}

/**
 * 把 resync 拉回的权威快照并回本地判据面。纯函数、不改入参、不碰网络/UI。
 *
 * 顺序固定为 created(仅缺行)→ snapshot → terminal:
 *   ① created 先落初面,让 snapshot 有"已有行"可判(否则 rev>0 的 snapshot 会判 gap);
 *   ② snapshot 是自包含全量,可跨 gap 应用;
 *   ③ terminal 按**同一 rev**打标记(终态不新增修订号,所以此时 rev === lastAppliedRev,
 *      未终态 ⇒ 应用、已终态 ⇒ duplicate)。
 *
 * 坏快照(rev 非非负整数 / terminal 不在封闭集)判 gap 并**零写入** —— 拿坏快照写状态
 * 等于让 resync 变成新的分叉源;消费端据此保留 gap 旗、下一轮再拉。
 */
export function mergeChatSyncResyncSnapshot(
  state: ChatSyncState,
  snapshot: ChatSyncMessageSnapshot,
): ChatSyncResyncMergeOutcome {
  const { conversationId, messageId, rev } = snapshot
  const lastAppliedRev = state.appliedRevs.get(messageId) ?? CREATED_REV_SENTINEL
  const invalidRev = !Number.isInteger(rev) || rev < 0
  const invalidTerminal =
    snapshot.terminal !== undefined && !isChatSyncTerminalReason(snapshot.terminal)
  if (invalidRev || invalidTerminal) {
    return {
      state,
      created: null,
      content: {
        applied: false,
        reason: 'gap',
        messageId,
        rev: Number.isInteger(rev) ? rev : CREATED_REV_SENTINEL,
        lastAppliedRev,
      },
      terminal: null,
      applied: false,
    }
  }

  // REST resync 不是第三条通道:channel 只是投递元数据、内核不读,沿用既有 'ws' 标记
  // (web store 的 applyChatSyncSnapshot 同款),免得为它扩一条 Channel 值域。
  const envelope = {
    channel: 'ws' as const,
    room: { kind: 'conversation' as const, conversationId },
  }

  let next = state
  let created: ChatSyncApplyResult | null = null
  if (!state.messages.has(messageId)) {
    const seeded = applyChatSyncEvent(next, {
      ...envelope,
      protocolVersion: CHAT_SYNC_PROTOCOL_VERSION,
      type: CHAT_SYNC_EVENT_NAMES.MESSAGE_CREATED,
      messageId,
      role: snapshot.role,
      content: snapshot.content,
      ...(snapshot.reasoning !== undefined ? { reasoning: snapshot.reasoning } : {}),
    })
    next = seeded.state
    created = seeded.result
  }

  const patched = applyChatSyncEvent(next, {
    ...envelope,
    protocolVersion: CHAT_SYNC_PROTOCOL_VERSION,
    type: CHAT_SYNC_EVENT_NAMES.MESSAGE_PATCHED,
    messageId,
    rev,
    kind: 'snapshot',
    content: snapshot.content,
    ...(snapshot.reasoning !== undefined ? { reasoning: snapshot.reasoning } : {}),
  })
  next = patched.state

  let terminal: ChatSyncApplyResult | null = null
  if (snapshot.terminal !== undefined) {
    const declared = applyChatSyncEvent(next, {
      ...envelope,
      protocolVersion: CHAT_SYNC_TERMINAL_PROTOCOL_VERSION,
      type: CHAT_SYNC_EVENT_NAMES.MESSAGE_TERMINAL,
      messageId,
      rev,
      reason: snapshot.terminal,
    })
    next = declared.state
    terminal = declared.result
  }

  return {
    state: next,
    created,
    content: patched.result,
    terminal,
    applied: created?.applied === true || patched.result.applied || terminal?.applied === true,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
