// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D153(2026-09-29 立)per-user 常连广播事件的**唯一**类型源。
 *
 * 为什么住在这里而不是端内:同一条 WS 帧有三个消费面(web / packages/app / miniapp-taro),
 * 任何一处自己声明形态就必然与另两处漂移(AGENTS §3 共享层优先)。载荷形态的拍板在
 * `docs/AI_CHAT_BENCHMARK_ANALYSIS_V4.md` §11.3 D153 第 3 栏:`{event, data}`。
 *
 * **封闭判别联合**:新增事件必须同时
 *  ① 进 `USER_BROADCAST_EVENT_NAMES`(名字是唯一真相,端内不得抄字符串字面量),
 *  ② 进 `UserBroadcastEvent` 联合本体,
 *  ③ 在 `DATA_GUARDS` 里为该事件给出字段判据。
 * ③ 缺项时 `DATA_GUARDS` 的 `Record<UserBroadcastEventName, …>` 直接编译不过 ——
 * 刻意如此:开放联合会让"收到不认识的事件"静默变成"什么都没发生",
 * 而把没判写成判过了是本仓最高频的失效型。
 *
 * 刻意**不含**档位/采样参数(D153 第 2 栏否证,拍板见 §11.3):
 * `permissionMode` 是 workspace 级 REST、采样参数是发送时从**本机** localStorage 取的客户端态,
 * 服务端没有 per-conversation 的主副本 —— 推一个不存在的主人等于制造分叉源。
 * 谁要加 `fields: 'permissionMode' | 'sampling'`,前置是先把档位服务端主副本化(另计一票)。
 */

import {
  CHAT_SYNC_PROTOCOL_VERSION,
  isChatPatchKind,
  isChatSyncRole,
  type ChatMessageCreatedEvent,
  type ChatMessagePatchedEvent,
  type ChatPatchKind,
  type ChatSyncRole,
} from './chat-sync-contract.js'

// ===================== 事件名 =====================

/**
 * 本通道**全部**已定义的事件名。
 * D154(MCP 连接状态下行)按拍板与 D153 共用同一载体:`'mcp:status'` 已于 2026-09-30 追加,
 * 判别成员 + 一条 DATA_GUARDS 判据同笔落地。**不得**另建第二条 per-user 通道。
 * D163 残余(检查点可用性上报)同型追加 `'checkpoint:availability'`(2026-10-18),
 * 同笔进 api-client 的 `USER_BROADCAST_SUBSCRIBABLE_EVENTS`(d153 测试硬断言两表等值)。
 */
export const USER_BROADCAST_EVENT_NAMES = [
  'conversation:updated',
  'mcp:status',
  'checkpoint:availability',
  // D125(2026-10-23 立,设计稿 docs/d125-session-collab-design.md):协作会话事件族,
  // 与上面同载体同纪律(前缀 `collab:` 进 ws-broadcast 的帧类别推导)。
  'collab:invitation',
  'collab:comment',
  // D125 另批收口(2026-10-23):写锁/接管发言事件,设计稿 §6 预留的"同三步追加"落地。
  'collab:lock',
  // 票71(V2 #23)第二切片(2026-10-24):chat 消息面房间广播。
  // 载荷**就是** chat-sync-contract 的事件本体(不另定义第二份形状)—— 契约 §6 要求
  // 同一逻辑变更在两条通道上携带逐字相同的 `(messageId, rev, kind, 载荷)`,
  // 另起一份"投递用载荷"就必然在两份之间漂移,故这里只做载体声明 + 房间校验。
  'message:created',
  'message:patched',
] as const

export type UserBroadcastEventName = (typeof USER_BROADCAST_EVENT_NAMES)[number]

/** 名字判别:不在封闭集里 ⇒ false,由消费端计成「未判定」并点名,不得静默丢弃 */
export function isUserBroadcastEventName(v: unknown): v is UserBroadcastEventName {
  return typeof v === 'string' && (USER_BROADCAST_EVENT_NAMES as readonly string[]).includes(v)
}

// ===================== conversation:updated =====================

/**
 * 会话元数据里**服务端持有主副本**、因此可同步的字段。
 * 与 `packages/database/src/schema/chat.ts` 的列对应:
 *  - `title`   → `chatConversations.title`
 *  - `model`   → `chatConversations.model`
 *  - `archive` → `chatConversations.archivedAt`(布尔化:有值 = 已归档)
 */
export const CONVERSATION_META_FIELDS = ['title', 'model', 'archive'] as const

export type ConversationMetaField = (typeof CONVERSATION_META_FIELDS)[number]

/** `fields` 里出现不认识的成员 ⇒ 整帧判「未判定」,不做部分应用(半更新本身就是新分叉) */
export function isConversationMetaField(v: unknown): v is ConversationMetaField {
  return typeof v === 'string' && (CONVERSATION_META_FIELDS as readonly string[]).includes(v)
}

/**
 * `conversation:updated` 载荷。
 *
 * `changedBy` 是票面验收②/③的落点,**必填且非空**:消费端要靠它认出
 * "这一帧是本端那次写的回声"与"别的设备改的",前者静默对账、后者给一次性提示条。
 * 缺它就没有这条判据 ⇒ parse 层直接拒收整帧(而不是当成"不知道谁改的"照用)。
 */
export interface ConversationUpdatedData {
  conversationId: string
  /** 本次写库真正变化的字段(服务端按落库结果给,不得照抄请求体键名) */
  fields: ConversationMetaField[]
  /** 变更主体 = 令牌主体 userId */
  changedBy: string
  /** ISO 8601;取库侧 `updatedAt`,同会话以此做"以库为准"的新旧判定 */
  at: string
  /**
   * 变化后的**新值**(票第 3 栏的四个必填成员之外新增的可选成员)。
   *
   * 为什么必须有它:票第 6 栏验收①要求"B 端**不发 HTTP 请求**即更新(网络计数=0 且 UI 值变)",
   * 而 `{conversationId, fields, changedBy, at}` 只说"哪一列变了",不说变成什么 ——
   * 只带字段名的话,B 端要么去 GET 一次(直接违反①),要么把 UI 停在旧值(就是原缺陷)。
   * 第 5 栏的文案 `chat.meta.changedElsewhere` 也需要 `{{value}}`。
   * 所以这一格是**验收①与第3栏形态之间唯一的调和**:保持事件名/通道/四个必填成员不变,
   * 加一个可选成员。缺它 ⇒ 消费端不猜值,按"未判定"走 pullOnly 明示,绝不静默留在旧值。
   *
   * `archive` 的值是布尔(归档与否),`title`/`model` 是字符串;`model` 库里可为 null。
   */
  values?: Partial<Record<ConversationMetaField, string | boolean | null>>
}

export interface ConversationUpdatedEvent {
  event: 'conversation:updated'
  data: ConversationUpdatedData
}

// ===================== mcp:status(D154)=====================

/**
 * MCP Server 连接生命周期的封闭状态集 —— 与 ai-service
 * `app/services/mcp_client.py` 的 `MCP_CONNECTION_STATES` 逐项对应(两侧同笔,新增须同枚提交)。
 *
 * 为什么是封闭集而不是字符串:消费端要为每一档给一句可操作的话(票第 1 栏),
 * 开放集会让"多出来的一档"静默渲染成空白,而这一族的缺陷形态恰恰是"什么都看不到"。
 */
export const MCP_CONNECTION_STATES = ['connecting', 'connected', 'failed', 'reconnecting'] as const

export type McpConnectionState = (typeof MCP_CONNECTION_STATES)[number]

export function isMcpConnectionState(v: unknown): v is McpConnectionState {
  return typeof v === 'string' && (MCP_CONNECTION_STATES as readonly string[]).includes(v)
}

/**
 * D154 载荷(票第 3 栏钉的形状:`{server, state, reason?, attempt?, maxAttempts?}`)。
 *
 * **没有 userId 成员** —— 主体只能从承载层进来(AGENTS §5「认证不等于授权」):
 * 上报端点用的是内部服务凭据 + `X-User-Id`(验票方查过 users 表才注入 `request.userId`),
 * 请求体自报的身份结构上无处可去(路由的 zod 是 strict,多一个键就 400)。
 * 谁收到这一帧,由"这台 server 的注册者是谁"决定,而不是由发帧的人决定。
 */
export interface McpStatusData {
  /** server 名(MCPClientManager 的注册名,全站共享命名空间) */
  server: string
  state: McpConnectionState
  /**
   * 技术性原因(诊断用,不是界面文案)。界面句子一律由 `state` + 五语言词表产出,
   * 后端不得往这里塞中文 —— 那会让另一端拿到没人翻译过的字符串(D155 同一条边界)。
   */
  reason?: string
  /** 第几次重连(仅 `reconnecting` 携带;`failed` 的放弃位不带,因为分母已用完) */
  attempt?: number
  maxAttempts?: number
  /**
   * 该 server 当前对外提供的工具名(可选,消费端"这次对话会不会用到它"的升级判据输入)。
   *
   * 为什么加它(与 D153 的 `values?` 同一类调和):票第 8 栏要求
   * "只在本次对话会用到该 server 的工具时升级为对话内行",而 web 手里只有工具名 ——
   * 外部 MCP 工具按**原始名**注册(`mcp_stdio_bridge.py:288-295`,不带 server 前缀),
   * 所以"用到没用到"必须靠这份名单判,不能靠名字猜。
   * 缺席 = 生产面判不出(例如从未连接成功过、没有工具清单),
   * 消费端此时**按可见处理**(判不出不得写成"没用到",否则正是要提示的那一型被静默吞掉)。
   */
  tools?: string[]
}

export interface McpStatusEvent {
  event: 'mcp:status'
  data: McpStatusData
}

// ===================== checkpoint:availability(D163 残余)=====================

/**
 * 检查点可用性的封闭状态集。
 *
 * 两档而不是三档是有意的:消费端要回答的是"别的设备上现在有没有一个可用的检查点",
 * `available` 必须说得出**哪一个**(checkpointId),`unavailable` 必须说得出**为什么**,
 * 中间态("正在建")没有对应的用户动作 —— 造一档没人能操作的词只会渲染成空白。
 * 与 `MCP_CONNECTION_STATES` 同一条纪律:状态词是契约,新增须同笔进五语言词表。
 */
export const CHECKPOINT_AVAILABILITY_STATES = ['available', 'unavailable'] as const

export type CheckpointAvailabilityState = (typeof CHECKPOINT_AVAILABILITY_STATES)[number]

export function isCheckpointAvailabilityState(v: unknown): v is CheckpointAvailabilityState {
  return typeof v === 'string' && (CHECKPOINT_AVAILABILITY_STATES as readonly string[]).includes(v)
}

/**
 * `checkpoint:availability` 载荷。
 *
 * 为什么需要这条事件(而不是端上各自轮询):检查点的写链住在 apps/api(原子快照在服务端
 * 工作区),而"另一台设备刚建了一个检查点 / 这台设备的检查点服务不可用"这两件事
 * 端上不轮询就永远不知道。D163 要求撤销结论必须由事实驱动 —— 没有这条下行,
 * 另一端的"可用"只能靠用户手动刷新碰运气。
 *
 * **没有 userId 成员**:主体只能从承载层进来(AGENTS §5),收信人由 token 钉死的
 * userId 决定;载荷里出现身份键 ⇒ 整帧判「未判定」。
 */
export interface CheckpointAvailabilityData {
  /** 哪个工作区的可用性(工作区 = 检查点的归属对象;跨端必须能对上是同一片盘) */
  workspacePath: string
  state: CheckpointAvailabilityState
  /**
   * `available` 必填:刚可用的那个检查点 id。
   * 说不出 id 的"可用"消费端无法采取任何动作(它连去取哪个都不知道),
   * 与"可用"这个断言本身矛盾 ⇒ 构造侧直接拒。
   */
  checkpointId?: string
  /** 技术性原因(诊断用,不是界面文案);`unavailable` 时应尽量给 */
  reason?: string
  /** ISO 8601;生产面落库/建快照的完成时刻,同工作区以此做新旧判定 */
  at: string
}

export interface CheckpointAvailabilityEvent {
  event: 'checkpoint:availability'
  data: CheckpointAvailabilityData
}

// ===================== collab:invitation / collab:comment(D125)=====================

/**
 * 协作邀请的封闭状态集(与 packages/database chat_conversation_collaborators.status 同值域)。
 * 三档各有唯一可操作语义:pending=待被邀请人裁决,accepted=协作生效(只读+评论),
 * revoked=属主撤销。中间态没有第三方的动作可挂,不开第四档(同 CHECKPOINT_AVAILABILITY 纪律)。
 */
export const COLLAB_INVITATION_STATES = ['pending', 'accepted', 'revoked'] as const

export type CollabInvitationState = (typeof COLLAB_INVITATION_STATES)[number]

export function isCollabInvitationState(v: unknown): v is CollabInvitationState {
  return typeof v === 'string' && (COLLAB_INVITATION_STATES as readonly string[]).includes(v)
}

/**
 * `collab:invitation` 载荷。
 *
 * 收信人由 broadcastToUser 的 userId 参数钉死(建邀请→被邀请人;接受→属主;撤销→被撤销人),
 * 载荷里**没有收信人身份**:`invitedBy` 是行为主体(与 `conversation:updated.changedBy` 同性质),
 * 出现 `userId`/`user_id` 键 ⇒ 整帧判「未判定」(§5 认证不等于授权)。
 * 不带会话标题等正文性内容:端上按 conversationId 走既有拉取面,帧只做失效信号。
 */
export interface CollabInvitationData {
  conversationId: string
  invitationId: string
  /** 邀请动作主体 = 属主 userId(服务端盖章,不是载荷自报的收信人) */
  invitedBy: string
  state: CollabInvitationState
  /** ISO 8601;服务端写库完成时刻,同邀请以此做新旧判定 */
  at: string
}

export interface CollabInvitationEvent {
  event: 'collab:invitation'
  data: CollabInvitationData
}

/**
 * `collab:comment` 载荷 —— **刻意不带评论正文**(拉取制,设计稿 §4.2):
 * 评论是追加型集合,推正文会造出"帧到了、库里还有别的没看到"的半态;
 * 帧只说"这条消息的评论变了",消费端按 (conversationId, messageId) 重取库确认集。
 */
export interface CollabCommentData {
  conversationId: string
  messageId: string
  commentId: string
  /** 评论作者(行为主体);收信人 = 属主 + 其余 accepted 协作者,作者本人的回声由发射侧排除 */
  authorId: string
  at: string
}

export interface CollabCommentEvent {
  event: 'collab:comment'
  data: CollabCommentData
}

function isCollabInvitationData(v: unknown): v is CollabInvitationData {
  if (typeof v !== 'object' || v === null) return false
  const d = v as Record<string, unknown>
  if (typeof d.conversationId !== 'string' || d.conversationId.length === 0) return false
  if (typeof d.invitationId !== 'string' || d.invitationId.length === 0) return false
  if (typeof d.invitedBy !== 'string' || d.invitedBy.length === 0) return false
  if (!isCollabInvitationState(d.state)) return false
  if (typeof d.at !== 'string' || Number.isNaN(Date.parse(d.at))) return false
  if ('userId' in d || 'user_id' in d) return false
  return true
}

function isCollabCommentData(v: unknown): v is CollabCommentData {
  if (typeof v !== 'object' || v === null) return false
  const d = v as Record<string, unknown>
  if (typeof d.conversationId !== 'string' || d.conversationId.length === 0) return false
  if (typeof d.messageId !== 'string' || d.messageId.length === 0) return false
  if (typeof d.commentId !== 'string' || d.commentId.length === 0) return false
  if (typeof d.authorId !== 'string' || d.authorId.length === 0) return false
  if (typeof d.at !== 'string' || Number.isNaN(Date.parse(d.at))) return false
  if ('userId' in d || 'user_id' in d) return false
  return true
}

// ===================== collab:lock(D125 另批:写锁/接管发言)=====================

/**
 * 写锁生命周期的封闭状态集。
 * 三档与消费端动作一一对应:acquired=无人占时有人拿麦,taken=从他人手里夺麦
 * (UI 须点名被夺者),released=交麦(锁空出)。没有"即将过期"档 —— 锁无 TTL,
 * 造一档没人能操作的词同 CHECKPOINT_AVAILABILITY 纪律不开。
 */
export const COLLAB_LOCK_STATES = ['acquired', 'taken', 'released'] as const

export type CollabLockState = (typeof COLLAB_LOCK_STATES)[number]

export function isCollabLockState(v: unknown): v is CollabLockState {
  return typeof v === 'string' && (COLLAB_LOCK_STATES as readonly string[]).includes(v)
}

/**
 * `collab:lock` 载荷(设计稿 §6 预留帧族的落地形态)。
 *
 * `holderUserId` 是**当前持麦人**(服务端盖章的事实,不是收信人身份):
 * acquired/taken 必填非空,released 恒为 null —— 与 checkpoint 的 checkpointId
 * 同一条"说不出人/说错人即矛盾"判据。收信人 = 属主 + 全部 accepted 协作者
 * (排除行为主体本人),仍由 broadcastToUser 的 userId 钉死,载荷不得出现
 * `userId`/`user_id` 键(§5)。
 */
export interface CollabLockData {
  conversationId: string
  /** 当前持麦人;released 时为 null(锁空出) */
  holderUserId: string | null
  state: CollabLockState
  /** ISO 8601;服务端写库完成时刻,同会话以此做新旧判定 */
  at: string
}

export interface CollabLockEvent {
  event: 'collab:lock'
  data: CollabLockData
}

function isCollabLockData(v: unknown): v is CollabLockData {
  if (typeof v !== 'object' || v === null) return false
  const d = v as Record<string, unknown>
  if (typeof d.conversationId !== 'string' || d.conversationId.length === 0) return false
  if (!isCollabLockState(d.state)) return false
  if (typeof d.at !== 'string' || Number.isNaN(Date.parse(d.at))) return false
  if (d.state === 'released') {
    // 交麦却还挂着持麦人:两个断言互相矛盾,照用会把"没人能发言"渲染成"有人能发言"
    if (d.holderUserId !== null) return false
  } else {
    if (typeof d.holderUserId !== 'string' || d.holderUserId.length === 0) return false
  }
  if ('userId' in d || 'user_id' in d) return false
  return true
}

// ===================== message:created / message:patched(票71 第二切片)=====================

/**
 * 投递载体声明:data **就是**契约事件本体(`ChatMessageCreatedEvent` / `ChatMessagePatchedEvent`)。
 *
 * 为什么不另写一份 `{conversationId, messageId, content, …}`:
 * 契约 §6「生产端义务」要求同一逻辑变更在 sse/ws 两条通道上携带逐字相同的
 * `(messageId, rev, kind, 载荷)`;第二份形状一旦落地,两端各读一份,漂移的第一个表现
 * 不是报错,而是"另一台设备上看到的是半截回复"。
 *
 * `channel` 在本载体上恒为 `'ws'`(它只是投递元数据,不参与幂等判定,见契约 §3),
 * 守卫据此拒收"通道标错"的帧 —— 那说明生产面有两个发射口。
 */
export type MessageCreatedData = ChatMessageCreatedEvent
export type MessagePatchedData = ChatMessagePatchedEvent

export interface MessageCreatedEvent {
  event: 'message:created'
  data: MessageCreatedData
}

export interface MessagePatchedEvent {
  event: 'message:patched'
  data: MessagePatchedData
}

/** 房间必须是 conversation 房间且 id 非空 —— 空房间键没人能订阅,等于一帧发给空气 */
function isChatSyncRoom(v: unknown): boolean {
  if (typeof v !== 'object' || v === null) return false
  const r = v as Record<string, unknown>
  return (
    r.kind === 'conversation' && typeof r.conversationId === 'string' && r.conversationId.length > 0
  )
}

/** `{protocolVersion, channel:'ws', room, emittedAt?}` 四格封套的公共判据 */
function isChatSyncEnvelope(d: Record<string, unknown>): boolean {
  if (d.protocolVersion !== CHAT_SYNC_PROTOCOL_VERSION) return false
  // 本载体只发 ws 面;收到别家通道的帧 ⇒ 生产面有两个发射口,整帧判「未判定」
  if (d.channel !== 'ws') return false
  if (!isChatSyncRoom(d.room)) return false
  if (d.emittedAt !== undefined) {
    if (typeof d.emittedAt !== 'string' || Number.isNaN(Date.parse(d.emittedAt))) return false
  }
  if ('userId' in d || 'user_id' in d) return false
  return true
}

function isMessageCreatedData(v: unknown): v is MessageCreatedData {
  if (typeof v !== 'object' || v === null) return false
  const d = v as Record<string, unknown>
  if (d.type !== 'message:created') return false
  if (!isChatSyncEnvelope(d)) return false
  if (typeof d.messageId !== 'string' || d.messageId.length === 0) return false
  if (!isChatSyncRole(d.role)) return false
  if (typeof d.content !== 'string') return false
  if (d.reasoning !== undefined && typeof d.reasoning !== 'string') return false
  return true
}

function isMessagePatchedData(v: unknown): v is MessagePatchedData {
  if (typeof v !== 'object' || v === null) return false
  const d = v as Record<string, unknown>
  if (d.type !== 'message:patched') return false
  if (!isChatSyncEnvelope(d)) return false
  if (typeof d.messageId !== 'string' || d.messageId.length === 0) return false
  // rev 由服务端分配、从 1 起(0 是 created 的哨兵,链上不存在 rev 0 的 patch)
  if (typeof d.rev !== 'number' || !Number.isInteger(d.rev) || d.rev < 1) return false
  if (!isChatPatchKind(d.kind)) return false
  // 载荷形态与 kind 必须同域:delta 缺 textDelta / snapshot 缺 content 都无人能应用
  if (d.kind === 'delta') {
    if (typeof d.textDelta !== 'string') return false
  } else if (typeof d.content !== 'string') {
    return false
  }
  if (d.textDelta !== undefined && typeof d.textDelta !== 'string') return false
  if (d.content !== undefined && typeof d.content !== 'string') return false
  if (d.reasoning !== undefined && typeof d.reasoning !== 'string') return false
  return true
}

/**
 * 生产侧构造 `message:created` 的唯一出口(路由内不得手拼 `{event,data}` 字面量)。
 * 空 id / 空会话 / 未知角色 ⇒ 构造点直接拒(与另几个构造器同一条纪律):
 * 这种帧推上线,接收端只会把它计成「未判定」,用户看到的是"另一台设备没同步"。
 */
export function messageCreatedEvent(input: {
  conversationId: string
  messageId: string
  role: ChatSyncRole
  content: string
  reasoning?: string
  at?: Date | string
}): MessageCreatedEvent {
  if (!input.conversationId) throw new Error('messageCreatedEvent: conversationId 不得为空')
  if (!input.messageId) throw new Error('messageCreatedEvent: messageId 不得为空')
  if (!isChatSyncRole(input.role)) {
    throw new Error(`messageCreatedEvent: 未知角色 ${String(input.role)}`)
  }
  const data: MessageCreatedData = {
    protocolVersion: CHAT_SYNC_PROTOCOL_VERSION,
    channel: 'ws',
    room: { kind: 'conversation', conversationId: input.conversationId },
    type: 'message:created',
    messageId: input.messageId,
    role: input.role,
    content: input.content,
  }
  if (input.at !== undefined) data.emittedAt = toIsoAt('messageCreatedEvent', input.at)
  if (input.reasoning !== undefined) data.reasoning = input.reasoning
  return { event: 'message:created', data }
}

/**
 * 生产侧构造 `message:patched` 的唯一出口。
 * `rev` 必须由服务端分配(调用方传入):端侧自造 rev 混入同一条链 = 契约 §2 第 2 条违约。
 */
export function messagePatchedEvent(input: {
  conversationId: string
  messageId: string
  rev: number
  kind: ChatPatchKind
  textDelta?: string
  content?: string
  reasoning?: string
  at?: Date | string
}): MessagePatchedEvent {
  if (!input.conversationId) throw new Error('messagePatchedEvent: conversationId 不得为空')
  if (!input.messageId) throw new Error('messagePatchedEvent: messageId 不得为空')
  if (!Number.isInteger(input.rev) || input.rev < 1) {
    throw new Error(`messagePatchedEvent: rev 必须是 ≥1 的整数(实际 ${String(input.rev)})`)
  }
  if (!isChatPatchKind(input.kind)) {
    throw new Error(`messagePatchedEvent: 未知 patch 形态 ${String(input.kind)}`)
  }
  const data: MessagePatchedData = {
    protocolVersion: CHAT_SYNC_PROTOCOL_VERSION,
    channel: 'ws',
    room: { kind: 'conversation', conversationId: input.conversationId },
    type: 'message:patched',
    messageId: input.messageId,
    rev: input.rev,
    kind: input.kind,
  }
  if (input.kind === 'delta') {
    if (typeof input.textDelta !== 'string') {
      throw new Error('messagePatchedEvent: kind=delta 必须带 textDelta')
    }
    data.textDelta = input.textDelta
  } else {
    if (typeof input.content !== 'string') {
      throw new Error('messagePatchedEvent: kind=snapshot 必须带 content')
    }
    data.content = input.content
  }
  if (input.at !== undefined) data.emittedAt = toIsoAt('messagePatchedEvent', input.at)
  if (input.reasoning !== undefined) data.reasoning = input.reasoning
  return { event: 'message:patched', data }
}

function toIsoAt(fn: string, at: Date | string): string {
  const iso = typeof at === 'string' ? at : at.toISOString()
  if (Number.isNaN(Date.parse(iso))) throw new Error(`${fn}: at 不是时间:${iso}`)
  return iso
}

// ===================== 联合本体与线上帧形态 =====================

export type UserBroadcastEvent =
  | ConversationUpdatedEvent
  | McpStatusEvent
  | CheckpointAvailabilityEvent
  | CollabInvitationEvent
  | CollabCommentEvent
  | CollabLockEvent
  | MessageCreatedEvent
  | MessagePatchedEvent

/** 传输线上的裸帧形态:`/ws/broadcast` 推送的就是这个对象 */
export interface UserBroadcastFrame {
  event: string
  data: unknown
}

// ===================== 判据与解析 =====================

function isConversationUpdatedData(v: unknown): v is ConversationUpdatedData {
  if (typeof v !== 'object' || v === null) return false
  const d = v as Record<string, unknown>
  if (typeof d.changedBy !== 'string' || d.changedBy.length === 0) return false
  if (typeof d.conversationId !== 'string' || d.conversationId.length === 0) return false
  if (typeof d.at !== 'string' || Number.isNaN(Date.parse(d.at))) return false
  if (!Array.isArray(d.fields)) return false
  const fields = d.fields as unknown[]
  if (fields.length === 0) return false
  if (!fields.every((f) => isConversationMetaField(f))) return false
  // 同帧同字段重复 = 生产面拼错了;不去重照用,那会把 bug 洗成正常
  if (new Set(fields as ConversationMetaField[]).size !== fields.length) return false
  // values 是可选成员,但**给了就必须与 fields 同域**:多出来的键无人应用,
  // 少掉的键消费端会照旧显示旧值而账面"已同步"—— 两种都是把没判写成判过了。
  if (d.values !== undefined) {
    if (typeof d.values !== 'object' || d.values === null || Array.isArray(d.values)) return false
    const keys = Object.keys(d.values as Record<string, unknown>)
    if (!keys.every((k) => (fields as string[]).includes(k))) return false
  }
  return true
}

/** `mcp:status` 的字段判据(与 `mcpStatusEvent` 同源同规则,构造侧与解析侧不得两套标准) */
function isMcpStatusData(v: unknown): v is McpStatusData {
  if (typeof v !== 'object' || v === null) return false
  const d = v as Record<string, unknown>
  if (typeof d.server !== 'string' || d.server.length === 0 || d.server.length > 128) return false
  if (!isMcpConnectionState(d.state)) return false
  if (d.reason !== undefined && typeof d.reason !== 'string') return false
  if (d.attempt !== undefined) {
    // 有分子必须有分母:文案 `chat.mcp.state.reconnecting` 要 {{attempt}}/{{maxAttempts}} 两格,
    // 只给一半会渲染成"第 2/ 次重连"—— 半句话比不发帧更糟。
    if (!isPositiveInt(d.attempt)) return false
    if (d.maxAttempts === undefined) return false
  }
  if (d.maxAttempts !== undefined && !isPositiveInt(d.maxAttempts)) return false
  if (d.tools !== undefined) {
    if (!Array.isArray(d.tools)) return false
    if (!(d.tools as unknown[]).every((t) => typeof t === 'string' && t.length > 0)) return false
  }
  // 主体不得从载荷进来(§5):这一格判据与 zod strict 是同一件事的两层,
  // 少任何一层,"客户端自报 userId" 就还有一条路。
  if ('userId' in d || 'user_id' in d) return false
  return true
}

function isPositiveInt(v: unknown): boolean {
  return typeof v === 'number' && Number.isInteger(v) && v > 0
}

/** `checkpoint:availability` 的字段判据(与 `checkpointAvailabilityEvent` 同源同规则) */
function isCheckpointAvailabilityData(v: unknown): v is CheckpointAvailabilityData {
  if (typeof v !== 'object' || v === null) return false
  const d = v as Record<string, unknown>
  if (typeof d.workspacePath !== 'string' || d.workspacePath.length === 0) return false
  if (!isCheckpointAvailabilityState(d.state)) return false
  if (typeof d.at !== 'string' || Number.isNaN(Date.parse(d.at))) return false
  if (d.reason !== undefined && typeof d.reason !== 'string') return false
  if (d.state === 'available') {
    // 说不出 id 的"可用"消费端无从取用(见 CheckpointAvailabilityData 注释)
    if (typeof d.checkpointId !== 'string' || d.checkpointId.length === 0) return false
  } else if (d.checkpointId !== undefined) {
    // 不可用却带着 id:两个断言互相矛盾,照用就会去取一个服务端刚说不可用的检查点
    return false
  }
  if ('userId' in d || 'user_id' in d) return false
  return true
}

/** 事件名 → 值判据的唯一映射(新增事件名而不在此登记 ⇒ TS 报错,联合不会静默扩宽) */
const DATA_GUARDS: Record<UserBroadcastEventName, (v: unknown) => boolean> = {
  'conversation:updated': isConversationUpdatedData,
  'mcp:status': isMcpStatusData,
  'checkpoint:availability': isCheckpointAvailabilityData,
  'collab:invitation': isCollabInvitationData,
  'collab:comment': isCollabCommentData,
  'collab:lock': isCollabLockData,
  // 票71 第二切片:chat 消息面房间广播(形状与 chat-sync-contract 逐字同源)
  'message:created': isMessageCreatedData,
  'message:patched': isMessagePatchedData,
}

/**
 * 把一帧 `{event, data}` 解析成判别联合;不成立返回 null。
 * 返回 null 的三个原因(消费端**必须**计数并点名,不得静默):
 *  ① 输入不是对象;② 事件名不在封闭集里;③ 名字对但字段判据不成立(含缺 `changedBy`)。
 */
export function parseUserBroadcastFrame(raw: unknown): UserBroadcastEvent | null {
  if (typeof raw !== 'object' || raw === null) return null
  const frame = raw as Partial<UserBroadcastFrame>
  if (!isUserBroadcastEventName(frame.event)) return null
  if (!DATA_GUARDS[frame.event](frame.data)) return null
  return frame as UserBroadcastEvent
}

/** 生产侧构造线上帧的唯一写法(端内/路由内不得手拼 `{event, data}` 字面量) */
export function toUserBroadcastFrame(evt: UserBroadcastEvent): UserBroadcastFrame {
  return { event: evt.event, data: evt.data }
}

/**
 * 生产侧构造 `conversation:updated` 事件的唯一出口。
 *
 * 为什么要有它而不是让每个路由各拼对象:`changedBy` 是消费端区分
 * "本端写的回声"与"别的设备改的"的唯一凭据,漏传它的表现不是报错而是
 * 另一端静默覆盖/静默不分叉。所以这里**在构造点就拒空**(票第 6 栏验收③),
 * 而不是等到消费端的 parse 层再把它判成「未判定」—— 那是把生产面的 bug
 * 推到用户可见的"同步没生效"上。
 *
 * `fields` 去重后为空 ⇒ 同样拒:一帧"什么都没变"的更新事件会让消费端
 * 收到一个无法应用的载荷,而账面上一切正常。
 */
export function conversationUpdatedEvent(input: {
  conversationId: string
  fields: readonly ConversationMetaField[]
  changedBy: string
  at: Date | string
  values?: Partial<Record<ConversationMetaField, string | boolean | null>>
}): ConversationUpdatedEvent {
  const { conversationId, changedBy } = input
  if (!conversationId) throw new Error('conversationUpdatedEvent: conversationId 不得为空')
  if (!changedBy) throw new Error('conversationUpdatedEvent: changedBy 不得为空(消费端无从判回声)')
  const fields = Array.from(new Set(input.fields))
  if (fields.length === 0) throw new Error('conversationUpdatedEvent: fields 去重后为空')
  const at = typeof input.at === 'string' ? input.at : input.at.toISOString()
  if (Number.isNaN(Date.parse(at))) throw new Error(`conversationUpdatedEvent: at 不是时间:${at}`)
  const data: ConversationUpdatedData = { conversationId, fields, changedBy, at }
  // values 只保留与 fields 同域的键:多出来的键无人应用(见上面的判据注释),
  // 与其静默带着走不如当场丢掉 —— 但丢掉必须在构造点做,而不是等消费端 parse 拒整帧。
  if (input.values) {
    const picked: Partial<Record<ConversationMetaField, string | boolean | null>> = {}
    for (const f of fields) {
      const value = (input.values as Record<string, unknown>)[f]
      if (value === undefined) continue
      if (typeof value === 'string' || typeof value === 'boolean' || value === null) {
        picked[f] = value
      }
    }
    if (Object.keys(picked).length > 0) data.values = picked
  }
  return { event: 'conversation:updated', data }
}

// ===================== 生产侧构造 mcp:status 的唯一出口 =====================

/**
 * 构造 `mcp:status` 事件(D154 生产侧唯一写法;路由内不得手拼 `{event,data}` 字面量)。
 *
 * 与 `conversationUpdatedEvent` 同一条设计:**在构造点就拒坏值**,而不是等消费端
 * 把整帧判成「未判定」—— 后者等于把生产面的 bug 换成用户可见的"什么都没提示"。
 * `server` 为空 ⇒ 这一帧没人能应用;未知 `state` ⇒ 词表里没有对应句子,渲染出的是空白。
 */
export function mcpStatusEvent(input: {
  server: string
  state: McpConnectionState
  reason?: string
  attempt?: number
  maxAttempts?: number
  tools?: readonly string[]
}): McpStatusEvent {
  const server = input.server.trim()
  if (!server) throw new Error('mcpStatusEvent: server 名不得为空')
  if (!isMcpConnectionState(input.state)) {
    throw new Error(
      `mcpStatusEvent: 未知状态 ${String(input.state)}(封闭集见 MCP_CONNECTION_STATES)`,
    )
  }
  const data: McpStatusData = { server, state: input.state }
  if (input.reason !== undefined) data.reason = input.reason
  if (input.attempt !== undefined) {
    if (!isPositiveInt(input.attempt))
      throw new Error(`mcpStatusEvent: attempt 非法:${String(input.attempt)}`)
    if (input.maxAttempts === undefined) {
      throw new Error('mcpStatusEvent: 带 attempt 必须同时带 maxAttempts(否则文案只有分子)')
    }
    data.attempt = input.attempt
  }
  if (input.maxAttempts !== undefined) {
    if (!isPositiveInt(input.maxAttempts)) {
      throw new Error(`mcpStatusEvent: maxAttempts 非法:${String(input.maxAttempts)}`)
    }
    data.maxAttempts = input.maxAttempts
  }
  if (input.tools !== undefined) {
    const tools = Array.from(new Set(input.tools.map((t) => t.trim()).filter((t) => t.length > 0)))
    // 给了 tools 键却全被滤空 ⇒ 丢掉该键:留着会让消费端把"名单为空"读成"这次用不到"
    if (tools.length > 0) data.tools = tools
  }
  return { event: 'mcp:status', data }
}

// ===================== 生产侧构造 checkpoint:availability 的唯一出口 =====================

/**
 * 构造 `checkpoint:availability` 事件(生产侧唯一写法;路由内不得手拼 `{event,data}`)。
 *
 * 与另两个构造器同一条设计:**在构造点就拒坏值**。`available` 却说不出 checkpointId
 * ⇒ 消费端取不到任何东西;`unavailable` 却带着 id ⇒ 两个断言互相矛盾。这两种都应在
 * 生产面抛错(路由落 500/400 并留日志),而不是推上线让端上渲染成"什么都没发生"。
 * `at` 缺省取调用时刻:生产面刚完成写链,这个时刻就是消费端判新旧的事实源。
 */
export function checkpointAvailabilityEvent(input: {
  workspacePath: string
  state: CheckpointAvailabilityState
  checkpointId?: string
  reason?: string
  at?: Date | string
}): CheckpointAvailabilityEvent {
  const workspacePath = input.workspacePath.trim()
  if (!workspacePath) throw new Error('checkpointAvailabilityEvent: workspacePath 不得为空')
  if (!isCheckpointAvailabilityState(input.state)) {
    throw new Error(
      `checkpointAvailabilityEvent: 未知状态 ${String(input.state)}(封闭集见 CHECKPOINT_AVAILABILITY_STATES)`,
    )
  }
  if (input.state === 'available') {
    if (typeof input.checkpointId !== 'string' || input.checkpointId.length === 0) {
      throw new Error('checkpointAvailabilityEvent: available 必须带 checkpointId')
    }
  } else if (input.checkpointId !== undefined) {
    throw new Error('checkpointAvailabilityEvent: unavailable 不得携带 checkpointId')
  }
  const at =
    input.at === undefined
      ? new Date().toISOString()
      : typeof input.at === 'string'
        ? input.at
        : input.at.toISOString()
  if (Number.isNaN(Date.parse(at))) {
    throw new Error(`checkpointAvailabilityEvent: at 不是时间:${at}`)
  }
  const data: CheckpointAvailabilityData = { workspacePath, state: input.state, at }
  if (input.checkpointId !== undefined) data.checkpointId = input.checkpointId
  if (input.reason !== undefined) data.reason = input.reason
  return { event: 'checkpoint:availability', data }
}

// ===================== 生产侧构造 collab 事件(D125)=====================

/**
 * 构造 `collab:invitation` 事件(生产侧唯一写法;路由内不得手拼 `{event,data}` 字面量)。
 * 与另两个构造器同一条设计:**在构造点就拒坏值** —— 空 id 的邀请帧没人能应用,
 * 未知 state 在词表里没有对应句子。`at` 缺省取调用时刻(路由在写库成功后调用,
 * 该时刻即消费端判新旧的事实源,D163 同型)。
 */
export function collabInvitationEvent(input: {
  conversationId: string
  invitationId: string
  invitedBy: string
  state: CollabInvitationState
  at?: Date | string
}): CollabInvitationEvent {
  if (!input.conversationId) throw new Error('collabInvitationEvent: conversationId 不得为空')
  if (!input.invitationId) throw new Error('collabInvitationEvent: invitationId 不得为空')
  if (!input.invitedBy) throw new Error('collabInvitationEvent: invitedBy 不得为空')
  if (!isCollabInvitationState(input.state)) {
    throw new Error(
      `collabInvitationEvent: 未知状态 ${String(input.state)}(封闭集见 COLLAB_INVITATION_STATES)`,
    )
  }
  const at =
    input.at === undefined
      ? new Date().toISOString()
      : typeof input.at === 'string'
        ? input.at
        : input.at.toISOString()
  if (Number.isNaN(Date.parse(at))) {
    throw new Error(`collabInvitationEvent: at 不是时间:${at}`)
  }
  return {
    event: 'collab:invitation',
    data: {
      conversationId: input.conversationId,
      invitationId: input.invitationId,
      invitedBy: input.invitedBy,
      state: input.state,
      at,
    },
  }
}

/**
 * 构造 `collab:comment` 事件(生产侧唯一写法)。三个 id 任缺其一,消费端都无从定位
 * "哪条消息的评论变了" ⇒ 构造点直接拒;正文不在帧里(拉取制,见 CollabCommentData)。
 */
export function collabCommentEvent(input: {
  conversationId: string
  messageId: string
  commentId: string
  authorId: string
  at?: Date | string
}): CollabCommentEvent {
  if (!input.conversationId) throw new Error('collabCommentEvent: conversationId 不得为空')
  if (!input.messageId) throw new Error('collabCommentEvent: messageId 不得为空')
  if (!input.commentId) throw new Error('collabCommentEvent: commentId 不得为空')
  if (!input.authorId) throw new Error('collabCommentEvent: authorId 不得为空')
  const at =
    input.at === undefined
      ? new Date().toISOString()
      : typeof input.at === 'string'
        ? input.at
        : input.at.toISOString()
  if (Number.isNaN(Date.parse(at))) {
    throw new Error(`collabCommentEvent: at 不是时间:${at}`)
  }
  return {
    event: 'collab:comment',
    data: {
      conversationId: input.conversationId,
      messageId: input.messageId,
      commentId: input.commentId,
      authorId: input.authorId,
      at,
    },
  }
}

/**
 * 构造 `collab:lock` 事件(生产侧唯一写法;路由内不得手拼 `{event,data}` 字面量)。
 * 与另几个构造器同一条设计:**在构造点就拒坏值** —— 空 conversationId 的锁帧没人能应用;
 * `released` 却带着持麦人、`acquired`/`taken` 却说不出持麦人,两个断言互相矛盾,
 * 照用会把"没人能发言"渲染成"有人能发言"(或反之),正是本票要消灭的分叉形态。
 * `at` 缺省取调用时刻(路由在写库成功后调用,该时刻即消费端判新旧的事实源)。
 */
export function collabLockEvent(input: {
  conversationId: string
  holderUserId: string | null
  state: CollabLockState
  at?: Date | string
}): CollabLockEvent {
  if (!input.conversationId) throw new Error('collabLockEvent: conversationId 不得为空')
  if (!isCollabLockState(input.state)) {
    throw new Error(`collabLockEvent: 未知状态 ${String(input.state)}(封闭集见 COLLAB_LOCK_STATES)`)
  }
  if (input.state === 'released') {
    if (input.holderUserId !== null) {
      throw new Error('collabLockEvent: released 不得携带 holderUserId(交麦即空出)')
    }
  } else if (typeof input.holderUserId !== 'string' || input.holderUserId.length === 0) {
    throw new Error(`collabLockEvent: ${input.state} 必须携带非空 holderUserId`)
  }
  const at =
    input.at === undefined
      ? new Date().toISOString()
      : typeof input.at === 'string'
        ? input.at
        : input.at.toISOString()
  if (Number.isNaN(Date.parse(at))) {
    throw new Error(`collabLockEvent: at 不是时间:${at}`)
  }
  return {
    event: 'collab:lock',
    data: {
      conversationId: input.conversationId,
      holderUserId: input.holderUserId,
      state: input.state,
      at,
    },
  }
}

// ===================== 同字段"以库为准"的新旧判定 =====================

/**
 * 票第 3 栏冲突语义:同字段两连击**以库为准**。
 * 判据 = 库里那一行的 `updatedAt` 不早于已有认知;`at` 解析不出来时**保守地认为更新**
 * (宁可覆盖也不静默留着旧值 —— 旧值就是"沉默分叉"本身)。
 */
export function isNewerThan(incomingAt: string, knownAt: string | null | undefined): boolean {
  if (!knownAt) return true
  const incoming = Date.parse(incomingAt)
  const known = Date.parse(knownAt)
  if (Number.isNaN(incoming)) return false
  if (Number.isNaN(known)) return true
  return incoming >= known
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
