// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { fetchApi, fetchText } from '../client.js'

export type ChatRole = 'user' | 'assistant' | 'system'

export interface ConversationDetail {
  id: string
  userId: string
  title: string
  model: string
  systemPrompt: string | null
  metadata: unknown
  lastMessageAt: string | null
  createdAt: string
  updatedAt: string
  /** 2026-08-30 立:会话置顶标记;true=置顶(列表排最前) */
  pinned?: boolean
  /** 置顶时间(排序用);未置顶为 null/undefined */
  pinnedAt?: string | null
  /** 2026-09-05 立:会话收藏标记(POST/DELETE /api/chat/conversations/:id/favorite) */
  favorite?: boolean
}

/** AI 主动提问选项(与 @ihui/types QuestionOptionPayload 结构一致) */
export interface QuestionOption {
  id: string
  label: string
}

/** AI 主动提问载荷(持久化到 chat_messages.metadata.pendingQuestion) */
export interface PendingQuestionPayload {
  questionId: string
  prompt: string
  options: QuestionOption[]
  allowCustom: boolean
  allowMultiple: boolean
  /** 关联的 assistant 消息 ID(DB id),用于持久化 metadata 到该消息 */
  assistantMessageId?: string
}

/** chat_messages.metadata 的结构化类型(P2 多端同步持久化用)
 *  - pendingQuestion: 非空表示该 assistant 消息触发了提问且未回答
 *  - answeredQuestionId: 标记该提问已被回答(与 pendingQuestion: null 同时设置)
 *  - questionId + isAnswer: user 消息标记,表示这是对某提问的回答
 *  - toolCalls/terminalTasks: D24(2026-09-19 立)工具调用与终端任务持久化数组
 *    (ai-service 回调 → ai-callback 入队 → worker 落库),恢复会话/回放/审计时还原
 *  - 其他 key(model/usage/stub 等)由 ai-callback-worker 写入,保持向后兼容 */
export interface ChatMessageMetadata {
  pendingQuestion?: PendingQuestionPayload | null
  answeredQuestionId?: string
  questionId?: string
  isAnswer?: boolean
  /** D24:工具调用持久化数组(结构与 @ihui/types BaseToolCall 对齐,跨包松耦合用 Record) */
  toolCalls?: Array<Record<string, unknown>>
  /** D24:终端任务持久化数组(结构与 @ihui/types TerminalTask 对齐) */
  terminalTasks?: Array<Record<string, unknown>>
  /** planSteps(2026-09-21 立):计划快照持久化数组(结构与 @ihui/types PlanStep 对齐)。
   *  来源:ai-service plan_updated 同源快照 → /api/ai/callback → worker 浅合并落库;
   *  消费:web 历史水合映射回 message.planSteps(缺失 = 老消息,安静降级) */
  planSteps?: Array<Record<string, unknown>>
  /** permissionMode(G-165 立):这条回答生成时**服务端自己的**权限档记录。
   *  来源:ai-callback 侧按 会话 metadata.workspacePath → workspace_permissions 反查后盖章
   *  (不采信客户端自报);拼写是 wire(kebab)值,与 @ihui/types/permission-mode 同源。
   *  消费:web 历史水合映射回 message.permissionMode(徽章跨刷新/跨端可见),
   *  小程序/RN 亦按同一 key 渲染档位行 —— 缺失 = 老消息或未绑定工作区,安静降级。 */
  permissionMode?: string
  /** citations(G-166 立):这条回答**实际引用**的来源清单,服务端在流收尾时按
   *  与 SSE `citations` 事件同一个 `_collect_citations` 产出落库(同源同去重同 10 条上限)。
   *  消费:web 历史水合映射回 `ChatMessage.citations`(CitationBar),缺失 = 老消息/本轮无引用。 */
  citations?: Array<Record<string, unknown>>
  /** injections(G-166 立):这条回答**带了哪些上下文**的交代帧列表,服务端按与 SSE
   *  `injection_applied` 同一份列表落库(剥掉帧判别字 `type`)。
   *  消费:web 历史水合映射回 `ChatMessage.injections`(注入交代区),缺失安静降级。 */
  injections?: Array<Record<string, unknown>>
  /** compaction(G-166 第②步立):这条回答生成前**发生过多少上下文压缩**的统计,
   *  与 SSE `compaction` 帧同一载荷(ai-service `_compaction_payload` 单一真相源)。
   *  消费:web 历史水合映射回 `ChatMessage.compaction`(CompressionDivider),
   *  缺失 = 老消息 / 本轮未压缩也未撞上限 —— 不渲染分隔线。 */
  compaction?: {
    triggered?: boolean
    tokensBefore?: number
    tokensAfter?: number
    removedCount?: number
    usageRatio?: number
    trigger?: string
  }
  /** retryNotice(G-166 第⑥步立):这轮回答期间上游网关**换 key / 退避重试**的最终一次记账,
   *  字段与 SSE `retry_scheduled` 契约同一套(attempt / maxRetries / retryInMs / httpStatus?)。
   *  消费:web 历史水合映射回 `ChatMessage.retryNotice`(RetryNotice 条),
   *  缺失 = 老消息或本轮没重试过 —— 不渲染"重试过"的假交代。 */
  retryNotice?: { attempt: number; maxRetries: number; retryInMs: number; httpStatus?: number }
  /** usageDetail(D33 剩余类,2026-09-23 立):与 SSE `usage` 帧同源的用量明细
   *  (token 分项 + 首 token 计时 + 总耗时 + 成本 + 实际计费模型)。
   *  来源:ai-service 流收尾 → /api/ai callback persistedUsageDetailSchema(子字段宽松,
   *  部分 provider 不给 reasoningTokens / costUsd)。
   *  消费:web 历史水合按行 seed 进 store.usageByMessageId(刷新后消息底部用量徽章行仍在),
   *  缺失 = 老消息或本轮未记账。 */
  usageDetail?: {
    promptTokens?: unknown
    completionTokens?: unknown
    totalTokens?: unknown
    reasoningTokens?: unknown
    firstTokenMs?: unknown
    durationMs?: unknown
    model?: string | null
    costUsd?: unknown
  }
  /** fallback(D33 剩余类立):主模型失败切换备用模型的交代,与 SSE `fallback` 帧同源。
   *  落库保留线上 snake_case(primary_model / backup_model / reason,三字段契约必带、缺一不落);
   *  消费:web 历史水合换算为 FallbackEvent(camel)挂消息级提示行。 */
  fallback?: { primary_model: string; backup_model: string; reason: string }
  /** memoryUpdates(D33 剩余类立):本轮同步提炼出的长期记忆条目摘要数组
   *  (与 done 事件 memoryUpdates 同源,字符串数组)。
   *  消费:web 历史水合 seed 进 store.memoryUpdateNotices(MemoryNoticeBar 既有渲染位)。 */
  memoryUpdates?: string[]
  [key: string]: unknown
}

export interface ConversationMessage {
  id: string
  conversationId: string
  role: ChatRole
  content: string
  reasoning?: string
  tokens: number | null
  metadata: ChatMessageMetadata | null
  createdAt: string
}

/** 创建对话 */
export function createConversation(input: { title?: string; model?: string } = {}) {
  return fetchApi<{ conversation: ConversationDetail }>('/api/chat/conversations', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** 对话列表查询参数 */
export interface ListConversationsParams {
  page?: number
  pageSize?: number
  search?: string
}

/** 对话列表响应 */
export interface ListConversationsResult {
  conversations: ConversationDetail[]
  page: number
  pageSize: number
  total: number
}

/** 获取对话列表(分页 + 按 title 搜索) */
export function listConversations(params: ListConversationsParams = {}) {
  const qs = new URLSearchParams()
  qs.set('page', String(params.page ?? 1))
  qs.set('pageSize', String(params.pageSize ?? 20))
  if (params.search) qs.set('search', params.search)
  return fetchApi<ListConversationsResult>(`/api/chat/conversations?${qs.toString()}`)
}

/** 获取对话详情 */
export function getConversation(id: string) {
  return fetchApi<{ conversation: ConversationDetail }>(
    `/api/chat/conversations/${encodeURIComponent(id)}`,
  )
}

/** 更新会话标题/模型/系统提示词/元数据/置顶状态(PATCH 增量更新) */
export function updateConversation(
  id: string,
  patch: {
    title?: string
    model?: string
    systemPrompt?: string
    metadata?: unknown
    pinned?: boolean
  },
) {
  return fetchApi<{ conversation: ConversationDetail }>(
    `/api/chat/conversations/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(patch),
    },
  )
}

/** 置顶/取消置顶会话(2026-08-30 立,复用 PATCH 端点,仅透传 pinned) */
export function setConversationPinned(id: string, pinned: boolean) {
  return fetchApi<{ conversation: ConversationDetail }>(
    `/api/chat/conversations/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ pinned }),
    },
  )
}

/** 重新生成对话(2026-08-30 立):删除指定 AI 消息及其之后的所有消息(后端事务) */
export function regenerateConversation(conversationId: string, messageId: string) {
  return fetchApi<{ regeneratedFrom: string; remainingCount: number }>(
    `/api/chat/conversations/${encodeURIComponent(conversationId)}/regenerate`,
    {
      method: 'POST',
      body: JSON.stringify({ messageId }),
    },
  )
}

/** 编辑重跑(2026-09-12 立,四竞品对标 P0-1):更新目标用户消息内容并删除其后的所有消息(后端事务) */
export function editAndRerunConversation(
  conversationId: string,
  messageId: string,
  content: string,
) {
  return fetchApi<{ message: { id: string; role: string; content: string } }>(
    `/api/chat/conversations/${encodeURIComponent(conversationId)}/edit-rerun`,
    {
      method: 'POST',
      body: JSON.stringify({ messageId, content }),
    },
  )
}

/** 会话标题自动生成(2026-09-15 立,四竞品对标 V2 #15):
 * 首轮回复完成后由前端 fire-and-forget 调用,LLM 依据首条用户消息生成标题。
 * 仅默认标题「新对话」会被覆盖;生成失败静默返回 ok:true/updated:false,调用方无需重试。 */
export function autoTitleConversation(
  conversationId: string,
  text: string,
  options?: { model?: string },
) {
  return fetchApi<{ ok: boolean; title?: string; updated: boolean }>(
    `/api/chat/conversations/${encodeURIComponent(conversationId)}/auto-title`,
    {
      method: 'POST',
      body: JSON.stringify({ text, model: options?.model }),
    },
  )
}

/** 分支/回退(2026-08-30 立):基于指定消息之前的内容创建新会话,返回新会话 */
export function branchConversation(
  conversationId: string,
  messageId: string,
  options?: { title?: string; model?: string },
) {
  return fetchApi<{ conversation: ConversationDetail }>(
    `/api/chat/conversations/${encodeURIComponent(conversationId)}/branch`,
    {
      method: 'POST',
      body: JSON.stringify({ messageId, ...options }),
    },
  )
}

/** 获取对话消息列表(时间正序,单页最多 100 条)
 *  分页参数(2026-07-25 立):支持 page/pageSize offset 分页和 before 游标分页。
 *  - 默认加载最新页(page=1, pageSize=20)
 *  - before:游标模式,返回此 message id 之前的消息(用于滚动到顶部加载更多历史)
 *  - 返回 hasMore/nextCursor 用于前端判断是否还有更早的历史 */
export interface GetMessagesParams {
  page?: number
  pageSize?: number
  before?: string
  after?: string
  /** P1 #24 keyset 复合游标:传此值走 findMessagesCursor 模式(direction 默认 'older')。
   * 值为 base64url JSON {createdAt,id},由服务端生成、客户端透明回传,无需解析。 */
  cursor?: string
  /** 仅与 cursor 配合使用:initial=取最新 N 条;older=向前翻更早的消息 */
  direction?: 'initial' | 'older'
}

export interface GetMessagesResult {
  messages: ConversationMessage[]
  page: number
  pageSize: number
  total: number
  hasMore: boolean
  /** 旧模式为消息 id;keyset 模式为 base64url 复合游标字符串。均透明回传即可。 */
  nextCursor: string | null
}

/**
 * D35 turn 分片拉取参数(2026-09-26 立)。契约逐字取自
 * `apps/api/src/routes/chat.ts` 的 `GET /conversations/:id/history` 与其
 * `historyListSchema`:limit 是**每页 turn 数**(非消息数)∈[1,100],默认 20,
 * 越界由服务端 400 —— 本包只做传输,不夹取、不重试。
 */
export interface GetConversationHistoryParams {
  limit?: number
  /** 回放断点(base64url JSON {turnOrdinal}),由服务端生成、客户端透明回传。 */
  cursor?: string
  /**
   * newest=取最新 N turn;older=断点之前(上翻);newer=断点之后(增量续读)。
   * 字面量集合与 `@ihui/shared/chat` 的 `HistoryTurnDirection` / `HISTORY_TURN_DIRECTIONS` 同集;
   * 本包刻意不 import 那个类型 —— api-client 的运行时依赖面只有 `@ihui/types`,
   * 为一个类型引入 `@ihui/shared` 会把共享层拖进发布物依赖(见 client.ts 头注同一处置)。
   */
  direction?: 'newest' | 'older' | 'newer'
}

/** 一个 turn 分片(一轮 user→assistant 交互),messages 按 (createdAt,id) 稳定升序。 */
export interface ConversationHistoryTurn {
  turnOrdinal: number
  messages: ConversationMessage[]
}

/**
 * D35:会话历史 turn 分片响应。投影语义(合并去重/边界判定)**不在本包实现**,
 * 一律交 `@ihui/shared/chat` 的 `history-projection` —— 本包只做传输,
 * 否则三端各拼一份时间线就是"手机上改了 web 没改"的成因(AGENTS §3)。
 */
export interface ConversationHistoryResult {
  turns: ConversationHistoryTurn[]
  limit: number
  hasMore: boolean
  nextCursor: string | null
  /** 会话投影状态透传;null = 尚未投影。本包不解释其形状。 */
  projectionState: unknown
}

/** D35 turn 分片拉取 — GET /api/chat/conversations/:id/history */
export function getConversationHistory(id: string, params: GetConversationHistoryParams = {}) {
  const qs = new URLSearchParams()
  if (params.limit !== undefined) qs.set('limit', String(params.limit))
  if (params.cursor) qs.set('cursor', params.cursor)
  if (params.direction) qs.set('direction', params.direction)
  return fetchApi<ConversationHistoryResult>(
    `/api/chat/conversations/${encodeURIComponent(id)}/history?${qs.toString()}`,
  )
}

export function getMessages(id: string, params: GetMessagesParams = {}) {
  const qs = new URLSearchParams()
  qs.set('page', String(params.page ?? 1))
  qs.set('pageSize', String(params.pageSize ?? 20))
  if (params.before) qs.set('before', params.before)
  if (params.after) qs.set('after', params.after)
  // P1 #24(2026-09-16):keyset 复合游标透传
  if (params.cursor) qs.set('cursor', params.cursor)
  if (params.direction) qs.set('direction', params.direction)
  return fetchApi<GetMessagesResult>(
    `/api/chat/conversations/${encodeURIComponent(id)}/messages?${qs.toString()}`,
  )
}

/** 持久化一条消息
 *  P2 多端同步:metadata 参数用于标记 questionId/isAnswer(用户回答)或其他业务元数据 */
export function sendMessage(
  id: string,
  content: string,
  role: ChatRole = 'user',
  metadata?: ChatMessageMetadata,
  reasoning?: string,
) {
  return fetchApi<{ message: ConversationMessage }>(
    `/api/chat/conversations/${encodeURIComponent(id)}/messages`,
    {
      method: 'POST',
      body: JSON.stringify({ content, role, metadata, reasoning }),
    },
  )
}

/** 持久化 AI 主动提问挂起状态 + WS 广播到多端
 *  前端收到 SSE question 事件时调用,把 pendingQuestion 写入 chat_conversations.metadata
 *  其他端通过 WS ai_question 事件收到后弹窗,实现多端同步
 *
 *  设计说明:不传 assistantMessageId,因为前端 onQuestion 时 assistantMessageId 是前端 UUID(占位),
 *  DB id 要等 ai-callback 完成后才落地。用 conversation.metadata(对话级挂起状态)更合适。 */
export function persistQuestion(input: {
  conversationId: string
  questionId: string
  prompt: string
  options: QuestionOption[]
  allowCustom: boolean
  allowMultiple: boolean
}) {
  return fetchApi<{ ok: boolean; persisted: boolean }>('/api/ai/chat/questions', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** 删除对话（级联删除消息） */
export function deleteConversation(id: string) {
  return fetchApi<{ deleted: boolean }>(`/api/chat/conversations/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

/** 批量操作对话 action 类型(2026-07-31 立,对话历史批量删除/收藏/归档) */
export type BatchConversationAction = 'delete' | 'favorite' | 'unfavorite' | 'archive' | 'unarchive'

/** 收藏会话(幂等;已收藏 200,新建 201)— POST /api/chat/conversations/:id/favorite */
export function favoriteConversation(id: string) {
  return fetchApi<{ favorited: boolean; created: boolean }>(
    `/api/chat/conversations/${encodeURIComponent(id)}/favorite`,
    { method: 'POST' },
  )
}

/** 取消收藏会话(幂等)— DELETE /api/chat/conversations/:id/favorite */
export function unfavoriteConversation(id: string) {
  return fetchApi<{ favorited: boolean }>(
    `/api/chat/conversations/${encodeURIComponent(id)}/favorite`,
    { method: 'DELETE' },
  )
}

export interface BatchOperateResult {
  action: BatchConversationAction
  affected: number
}

/** 批量操作对话(删除/收藏/取消收藏/归档/取消归档)
 *  用户归属校验由后端 userId + inArray(ids) 一次过滤,防越权
 *  单次最多 100 个 ids */
export function batchOperateConversations(action: BatchConversationAction, ids: string[]) {
  return fetchApi<BatchOperateResult>('/api/chat/conversations/batch', {
    method: 'POST',
    body: JSON.stringify({ action, ids }),
  })
}

/** 清空对话消息（保留对话本身） */
export function clearMessages(id: string) {
  return fetchApi<{ cleared: boolean }>(`/api/chat/conversations/${encodeURIComponent(id)}/clear`, {
    method: 'POST',
  })
}

/** 归档对话 */
export function archiveConversation(id: string) {
  return fetchApi<ConversationDetail>(`/api/chat/conversations/${encodeURIComponent(id)}/archive`, {
    method: 'POST',
  })
}

/** 取消归档对话 */
export function unarchiveConversation(id: string) {
  return fetchApi<ConversationDetail>(`/api/chat/conversations/${encodeURIComponent(id)}/archive`, {
    method: 'DELETE',
  })
}

/** 导出对话为纯文本（txt/md） */
export function exportConversation(id: string, format: 'txt' | 'md' = 'md'): Promise<string> {
  return fetchText(`/api/chat/conversations/${encodeURIComponent(id)}/export?format=${format}`)
}

/** 压缩归档列表项("归档记忆" 2026-09-01 立;列表不含 messages 大字段) */
export interface CompactionArchiveItem {
  id: string
  conversationId: string
  messageCount: number
  coveredChars: number | null
  createdAt: string
}

/** 压缩归档详情(含被压缩的原始消息数组,结构与 replaceMessages 持久化消息一致) */
export interface CompactionArchiveMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  [key: string]: unknown
}

export interface CompactionArchiveDetail extends CompactionArchiveItem {
  messages: CompactionArchiveMessage[]
}

/** 获取对话的压缩归档列表(压缩前的原始消息存档,按时间倒序) */
export function listCompactionArchives(conversationId: string) {
  return fetchApi<{ archives: CompactionArchiveItem[] }>(
    `/api/chat/conversations/${encodeURIComponent(conversationId)}/archives`,
  )
}

/** 获取单条压缩归档详情(含被压缩的原始消息) */
export function getCompactionArchive(conversationId: string, archiveId: string) {
  return fetchApi<{ archive: CompactionArchiveDetail }>(
    `/api/chat/conversations/${encodeURIComponent(conversationId)}/archives/${encodeURIComponent(archiveId)}`,
  )
}

/** 压缩对话历史至目标字符数 */
export function compressConversation(id: string, targetChars: 200000 | 1000000) {
  return fetchApi<{
    content: string
    model: string
    usage: Record<string, unknown>
    originalChars: number
    compressedChars: number
  }>(`/api/chat/conversations/${encodeURIComponent(id)}/compress`, {
    method: 'POST',
    body: JSON.stringify({ targetChars }),
  })
}

/** POST /api/chat/compact 手动压缩响应(与后端契约一致,2026-09-02 立) */
export interface CompactConversationResult {
  compressed: boolean
  /** compressed=false 时的原因:too_few_messages(消息太少) / incompressible(无可压缩空间) */
  reason?: 'too_few_messages' | 'incompressible'
  originalTokens: number
  compressedTokens: number
  removedCount: number
  /** 压缩触发方式(手动压缩伪造阈值后由共享包给出,如 'ratio'/'truncated'/'none'/'incompressible') */
  trigger?: string
}

/** 手动压缩对话上下文(对标 CLI /compact):无视 88% 自动压缩阈值立即压缩,语义摘要 + 归档落库 */
export function compactConversation(conversationId: string) {
  return fetchApi<CompactConversationResult>('/api/chat/compact', {
    method: 'POST',
    body: JSON.stringify({ conversationId }),
  })
}

/** Steer(中途引导)入队结果:ai-service 原样转发的 ok/queued 计数 */
export interface SteerChatStreamResult {
  ok: boolean
  /** 入队后队列长度(仅 ok=true 时有意义) */
  queued?: number
}

/**
 * Steer(中途引导,2026-09-19 立):流式 AI 对话期间立即引导,不打断当前工具执行。
 *
 * 前端闪电按钮触发 → 网关凭 conversationId+messageId(replayKey)在 SSE 流注册表
 * 找回 upstreamSessionId → 转发 ai-service POST /llm/complete/stream/{session_id}/steer
 * → tool loop 每轮 LLM 调用前 drain 注入 messages,注入时经 SSE steer 事件回执。
 *
 * 与 Enter 的 FIFO 排队互不影响:本端点仅由闪电按钮显式触发。
 */
export function steerChatStream(input: {
  conversationId: string
  messageId: string
  text: string
}) {
  // 2026-09-19 修正:网关 aiChatStreamRoutes 插件 prefix=/api/ai,端点实际注册于
  // /api/ai/chat/steer(与 use-chat.ts 的 /api/ai/chat/abort 同前缀),此前写
  // /api/chat/steer 会 404(normalizeUrl 对 /api/ 开头路径原样透传,不重写)。
  return fetchApi<SteerChatStreamResult>('/api/ai/chat/steer', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/**
 * AI 对话选项(跨端共享,从 miniapp-taro 下沉)
 *
 * 用于 POST /ai/chat 和 POST /ai/chat/stream 的可选参数。
 */
export interface ChatOptions {
  /** 模型 ID(优先使用,与 AI-service LLMCompleteRequest 对齐) */
  model?: string
  /** 向后兼容 alias,优先级低于 model */
  modelId?: string
  agentId?: string
  materialContent?: string
  /** 模型上下文窗口大小(tokens),达 88% 阈值自动压缩(跨端统一)。
   * 由调用方调 getModelContextCapacity(model) 取得,后端不传则不压缩。 */
  contextLimit?: number
}

/**
 * AI 对话结果(跨端共享,从 miniapp-taro 下沉)
 *
 * 用于 POST /ai/chat 的响应类型。
 */
export interface ChatResult {
  reply: string
  sessionId: string
  reasoning?: string
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// ============================================================================
// 消息点赞/点踩(D49①,2026-09-23):右键菜单评价落库,一人一消息一票,改票覆盖
// ============================================================================

export type MessageRating = 'like' | 'dislike'

export interface RateChatMessageResult {
  rated: boolean
  rating: MessageRating
}

export async function rateChatMessage(input: {
  messageId: string
  rating: MessageRating
}): Promise<RateChatMessageResult> {
  const res = await fetchApi<RateChatMessageResult>('/api/chat/messages/feedback', {
    method: 'POST',
    body: JSON.stringify({ messageId: input.messageId, rating: input.rating }),
  })
  if (!res.success) throw new Error(res.error ?? '反馈提交失败')
  return res.data
}
