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

// ===================== 事件名 =====================

/**
 * 本通道**全部**已定义的事件名。
 * D154(MCP 连接状态下行)按拍板与 D153 共用同一载体:`'mcp:status'` 已于 2026-09-30 追加,
 * 判别成员 + 一条 DATA_GUARDS 判据同笔落地。**不得**另建第二条 per-user 通道。
 */
export const USER_BROADCAST_EVENT_NAMES = ['conversation:updated', 'mcp:status'] as const

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
export const MCP_CONNECTION_STATES = [
  'connecting',
  'connected',
  'failed',
  'reconnecting',
] as const

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

// ===================== 联合本体与线上帧形态 =====================

export type UserBroadcastEvent = ConversationUpdatedEvent | McpStatusEvent

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

/** 事件名 → 值判据的唯一映射(新增事件名而不在此登记 ⇒ TS 报错,联合不会静默扩宽) */
const DATA_GUARDS: Record<UserBroadcastEventName, (v: unknown) => boolean> = {
  'conversation:updated': isConversationUpdatedData,
  'mcp:status': isMcpStatusData,
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
    throw new Error(`mcpStatusEvent: 未知状态 ${String(input.state)}(封闭集见 MCP_CONNECTION_STATES)`)
  }
  const data: McpStatusData = { server, state: input.state }
  if (input.reason !== undefined) data.reason = input.reason
  if (input.attempt !== undefined) {
    if (!isPositiveInt(input.attempt)) throw new Error(`mcpStatusEvent: attempt 非法:${String(input.attempt)}`)
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
