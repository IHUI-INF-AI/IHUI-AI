// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { sql, and, eq, inArray } from 'drizzle-orm'
// D153(2026-09-29 立):会话元数据变更的 per-user 下行广播。
// 事件形态与构造的唯一出口在 @ihui/types(三个消费面共用一份描述),
// 路由内不得手拼 `{event,data}` 字面量,也不得把"哪些字段真的变了"照抄请求体键名。
import { conversationUpdatedEvent, type ConversationMetaField } from '@ihui/types'
import {
  compressContextIfNeeded,
  estimateMessagesTokens,
  type ChatMessage,
} from '@ihui/context-compaction'
import { authenticate } from '../plugins/auth.js'
import { db } from '../db/index.js'
import { dedupeIds, batchWriteOutcome } from '../utils/batch-outcome.js'
// 批量操作的"哪些 id 根本没被写"对账需要直接按 (userId, ids) 查一次归属(见 POST /conversations/batch)
import { chatConversations } from '@ihui/database'
import {
  createConversationGroup,
  deleteConversationGroup,
  listConversationGroupIds,
  listConversationGroups,
  moveConversationsToGroup,
  renameConversationGroup,
  setConversationGroupPinned,
} from '../db/chat-group-queries.js'
import {
  createConversation,
  findConversationsByUser,
  findConversationById,
  updateConversation,
  deleteConversation,
  deleteConversationsBatch,
  favoriteConversationsBatch,
  unfavoriteConversationsBatch,
  setConversationsArchivedBatch,
  findMessages,
  createMessage,
  findMessageById,
  deleteMessage,
  clearMessages,
  favoriteConversation,
  unfavoriteConversation,
  rateChatMessage,
  findFavoriteConversations,
  archiveConversation,
  unarchiveConversation,
  findMessagesForExport,
  findMessagesCursor,
  encodeMessageCursor,
  decodeMessageCursor,
  findHistoryTurnPage,
  encodeHistoryCursor,
  decodeHistoryCursor,
  findMessagesForShare,
  saveCompressedContext,
  setConversationShareToken,
  findConversationByShareToken,
  regenerateConversationMessages,
  editMessageAndTruncateAfter,
  branchConversationFrom,
  replaceMessages,
  updateConversationTitle,
} from '../db/chat-queries.js'
import { success, error } from '../utils/response.js'
import { generateSemanticSummary, getCachedSemanticSummary } from '../utils/semantic-summary.js'
import {
  generateConversationTitle,
  DEFAULT_CONVERSATION_TITLE,
} from '../utils/conversation-title.js'
import {
  listMessageArchives,
  findMessageArchive,
  persistMessageArchive,
} from '../utils/conversation-archive.js'
import { aiServiceFetch } from '../utils/ai-service-fetch.js'

// 压缩调用兜底模型(2026-09-12 去硬编码):优先取请求上下文的对话模型,
// 其次读环境变量 LITELLM_MODEL(与 utils/semantic-summary.ts 同源,最终默认值由部署环境 .env 决定);
// 二者皆空时不传 model,由 ai-service 网关按自身默认模型处理。
const FALLBACK_MODEL = process.env.LITELLM_MODEL

// =============================================================================
// Coze conversation_id 自动管理（迁移自 coze_zhs_py/api/chat.py）
// =============================================================================

const cozeStreamSchema = z.object({
  botId: z.string().min(1),
  userId: z.string().min(1),
  query: z.string().min(1),
  conversationId: z.string().optional().default(''),
})
import { buildResponseSchema, paginationQuerySchema } from '../utils/api-schemas.js'

async function getCozeConversationId(uuid: string, botId: string): Promise<string> {
  const rows = await db.execute(
    sql`SELECT conversation_id FROM coze_chat_history WHERE uuid = ${uuid} AND bot_id = ${botId} ORDER BY created_at DESC LIMIT 1`,
  )
  const row = rows[0] as { conversation_id?: string } | undefined
  return row?.conversation_id ?? ''
}

async function saveCozeConversationId(
  uuid: string,
  botId: string,
  conversationId: string,
): Promise<void> {
  await db.execute(sql`
    INSERT INTO coze_chat_history (uuid, bot_id, conversation_id, created_at)
    VALUES (${uuid}, ${botId}, ${conversationId}, now())
    ON CONFLICT DO NOTHING
  `)
}

function extractConversationId(data: unknown): string | null {
  if (data === null || data === undefined) return null
  if (typeof data === 'object') {
    const obj = data as Record<string, unknown>
    if (typeof obj.conversation_id === 'string' && obj.conversation_id) return obj.conversation_id
    for (const value of Object.values(obj)) {
      const found = extractConversationId(value)
      if (found) return found
    }
  }
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = extractConversationId(item)
      if (found) return found
    }
  }
  return null
}

// =============================================================================
// Zod schemas
// =============================================================================

const createConversationSchema = z.object({
  title: z.string().max(255).optional(),
  model: z.string().max(64).optional(),
  systemPrompt: z.string().optional(),
  metadata: z.unknown().optional(),
})

const updateConversationSchema = z.object({
  title: z.string().max(255).optional(),
  model: z.string().max(64).optional(),
  systemPrompt: z.string().optional(),
  metadata: z.unknown().optional(),
  pinned: z.boolean().optional(),
})

// D165 会话分组(2026-10-01 立)。名字长度上限只在这里出现一次,与库面 varchar(64) 对齐;
// 分组名同时受 (user_id, name) 唯一约束,重名走"复用已有分组"的幂等出口而不是报错。
const GROUP_NAME_MAX = 64
const groupNameSchema = z
  .string()
  .trim()
  .min(1, '分组名不能为空')
  .max(GROUP_NAME_MAX, `分组名最长 ${GROUP_NAME_MAX} 个字符`)
const createGroupSchema = z.object({ name: groupNameSchema }).strict()
// 改名与置顶共用一条 PATCH(两个动作都是"改这一行",失败原因同形:404 不存在/无权)
const updateGroupSchema = z
  .object({ name: groupNameSchema.optional(), pinned: z.boolean().optional() })
  .strict()
  .refine((v) => v.name !== undefined || v.pinned !== undefined, {
    message: 'name 与 pinned 至少要给一个',
  })
const moveConversationsSchema = z
  .object({
    conversationIds: z.array(z.string().uuid()).min(1, '请至少选择一条会话').max(200),
    // null = 移出分组(回未分组);非 null = 移入该分组,归属由数据层验
    groupId: z.string().uuid().nullable(),
  })
  .strict()

const createMessageSchema = z
  .object({
    content: z.string().min(1, '消息内容不能为空'),
    // role 白名单:user(用户输入)/ assistant(斜杠命令 skill 结果等本地生成的 AI 文本)。
    // 主 chat 流的 assistant 消息由 ai-callback worker 权威持久化(带扣费/幂等),
    // 前端只在无 LLM 流的 skill 场景(如 /wechat-article)直接写 assistant,需登录 + 会话归属校验。
    // system 仍被拒绝:允许客户端持久化 system 消息等于开放历史上下文注入通道(见下方 refine)。
    role: z.enum(['user', 'assistant', 'system']).optional(),
    tokens: z.number().int().nonnegative().optional(),
    metadata: z.unknown().optional(),
    reasoning: z.string().optional(),
  })
  .refine(
    (data) => {
      // 强制拒绝 system:system 消息会进入后续 LLM 上下文(repairMessages 历史),
      // 客户端可持久化 system 即可实施 prompt 注入,必须服务端独占。
      if (data.role === 'system') {
        return false
      }
      return true
    },
    { message: '客户端不能创建 system 消息' },
  )

const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().max(255).optional(),
})

const messageListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  before: z.uuid().optional(),
  after: z.uuid().optional(),
  // 2026-09-16 P1 #24:keyset 复合游标(createdAt|id 的 base64url JSON)。
  // 带 cursor 或显式 direction 时走 findMessagesCursor;否则走旧 findMessages(向后兼容)。
  cursor: z.string().min(1).max(512).optional(),
  direction: z.enum(['initial', 'older']).optional(),
})

// D35(2026-09-24):turn 分片拉取参数 —— limit 是「每页 turn 数」而非消息数;
// cursor 为 base64url JSON {turnOrdinal},direction newest/older/newer 语义见 findHistoryTurnPage。
const historyListSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().min(1).max(512).optional(),
  direction: z.enum(['newest', 'older', 'newer']).optional(),
})

// POST /compact 请求体(2026-09-02 立):最简契约,仅 conversationId,无 messageRange 等可选参数
const compactSchema = z.object({
  conversationId: z.string().min(1),
})

const COMPRESS_TARGETS = (() => {
  const raw = process.env.COMPRESS_TARGET_CHARS
  if (!raw) return [200000, 1000000]
  const parsed = raw
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0)
  return parsed.length > 0 ? parsed : [200000, 1000000]
})()

const compressSchema = z.object({
  targetChars: z
    .number()
    .int()
    .positive()
    .refine((n) => COMPRESS_TARGETS.includes(n), {
      message: `targetChars 必须是以下值之一: ${COMPRESS_TARGETS.join(', ')}`,
    }),
})

// 重新生成(2026-08-30 立):指定要重新生成的 AI 消息 id
const regenerateSchema = z.object({
  messageId: z.uuid('messageId 必须是有效的 UUID'),
})

// 编辑重跑(2026-09-12 立,四竞品对标 P0-1):目标用户消息 id + 新内容
// 2026-09-15 补回:65ecb9dd9「gitdir 灾难后完整重建」在旧基线上覆盖提交,误删本路由,
// 而 packages/api-client 的 editAndRerunConversation 仍在调用它(前端 404)。
const editRerunSchema = z.object({
  messageId: z.uuid('messageId 必须是有效的 UUID'),
  content: z
    .string()
    .min(1, '消息内容不能为空')
    .max(64 * 1024, '消息内容过长(最大 64KB)'),
})

// 分支(2026-08-30 立):指定从哪条消息开始分叉,可选覆盖新会话标题/模型
const branchSchema = z.object({
  messageId: z.uuid('messageId 必须是有效的 UUID'),
  title: z.string().max(255).optional(),
  model: z.string().max(64).optional(),
})

// 批量操作 schema(2026-07-31 立,对话历史批量删除/收藏/归档)
const batchActionSchema = z.object({
  action: z.enum(['delete', 'favorite', 'unfavorite', 'archive', 'unarchive']),
  ids: z.array(z.uuid()).min(1, '至少选择一个对话').max(100, '单次最多 100 个对话'),
})

// =============================================================================
// 序列化辅助
// =============================================================================

function serializeConversation(c: {
  id: string
  userId: string
  title: string
  model: string
  systemPrompt: string | null
  metadata: unknown
  lastMessageAt: Date | null
  createdAt: Date
  updatedAt: Date
  archivedAt: Date | null
  compressedAt: Date | null
  compressedContext: string | null
  pinned?: boolean
  pinnedAt?: Date | null
  messageCount?: number
  favorite?: boolean
}) {
  return {
    id: c.id,
    userId: c.userId,
    title: c.title,
    model: c.model,
    systemPrompt: c.systemPrompt,
    metadata: c.metadata,
    lastMessageAt: c.lastMessageAt,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    archivedAt: c.archivedAt,
    compressedAt: c.compressedAt,
    compressedContext: c.compressedContext,
    ...(c.pinned !== undefined && { pinned: c.pinned }),
    ...(c.pinnedAt !== undefined && { pinnedAt: c.pinnedAt }),
    ...(c.messageCount !== undefined && { messageCount: c.messageCount }),
    ...(c.favorite !== undefined && { favorite: c.favorite }),
  }
}

// 公开分享用：不暴露 userId，避免隐私泄露
function serializeConversationPublic(c: {
  id: string
  title: string
  model: string
  systemPrompt: string | null
  metadata: unknown
  lastMessageAt: Date | null
  createdAt: Date
  updatedAt: Date
  archivedAt: Date | null
  compressedAt: Date | null
  compressedContext: string | null
  pinned?: boolean
  pinnedAt?: Date | null
  messageCount?: number
  favorite?: boolean
}) {
  return {
    id: c.id,
    title: c.title,
    model: c.model,
    systemPrompt: c.systemPrompt,
    metadata: c.metadata,
    lastMessageAt: c.lastMessageAt,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    archivedAt: c.archivedAt,
    compressedAt: c.compressedAt,
    compressedContext: c.compressedContext,
    ...(c.pinned !== undefined && { pinned: c.pinned }),
    ...(c.pinnedAt !== undefined && { pinnedAt: c.pinnedAt }),
    ...(c.messageCount !== undefined && { messageCount: c.messageCount }),
    ...(c.favorite !== undefined && { favorite: c.favorite }),
  }
}

function serializeMessage(m: {
  id: string
  conversationId: string
  role: string
  content: string
  reasoning?: string | null
  tokens: number | null
  metadata: unknown
  createdAt: Date
}) {
  return {
    id: m.id,
    conversationId: m.conversationId,
    role: m.role,
    content: m.content,
    reasoning: m.reasoning,
    tokens: m.tokens,
    metadata: m.metadata,
    createdAt: m.createdAt,
  }
}

// =============================================================================
// 路由
// =============================================================================

export const chatRoutes: FastifyPluginAsync = async (server) => {
  const idParam = z.object({ id: z.string() })
  // G-261(2026-09-27):/messages 与 /history 两路把 uuid 校验从 ajv(format:'uuid')迁到本 schema。
  // 迁出后非法 uuid 不再被 ajv 先拒(那会因 400 响应 schema 的 code:number 序列化不匹配而掩盖成 500),
  // 改由 safeParse 产统一错误信封。刻意不复用 idParam(z.string()):那会把非法 uuid 放进 DB 查询。
  // 正则逐字取 ajv-formats 的 uuid 形态(松散十六进制形状,不校验 version/variant 位)——
  // 用 z.uuid() 会比原 ajv 更严(zod v4 校 variant),把既有合法调用方(如测试里的 1111-…-1111)
  // 从 404/200 改成 400,违反本票"合法参数响应逐字不变"判据。
  const conversationIdParam = z.object({
    id: z
      .string()
      .regex(/^(?:urn:uuid:)?[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i, '无效的对话 ID'),
  })
  const requireAuth = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await authenticate(request)
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      // 统一返回中文消息:authenticate() 内部大部分已是中文(封禁/注销/CSRF),
      // 仅 Authentication required / Invalid or expired token / Challenge token 是英文,
      // 统一兜底为"操作失败,请稍后重试",避免英文错误消息到达前端用户。
      return reply.status(statusCode).send(error(statusCode, '操作失败,请稍后重试'))
    }
  }

  // 校验对话归属：存在且属于当前用户
  const ensureOwnedConversation = async (id: string, userId: string, reply: FastifyReply) => {
    const conversation = await findConversationById(id)
    if (!conversation) {
      reply.status(404).send(error(404, '对话不存在'))
      return { conversation: null as null }
    }
    if (conversation.userId !== userId) {
      reply.status(403).send(error(403, '无权访问该对话'))
      return { conversation: null as null }
    }
    return { conversation }
  }

  /**
   * D153(2026-09-29 立)会话元数据变更的 per-user 下行广播 —— 本文件**唯一**发射口。
   *
   * 三条不可漂的写法:
   *  ① **只在写库成功之后调用**(票第 3 栏)。写在 await 之前 = 推一个库里没有的状态,
   *     另一端按它渲染就成了新的分叉源,比不推更糟。
   *  ② `fields` 一律按**落库结果与写前那份行的差集**算,不得照抄请求体键名 ——
   *     请求带 `title:"新对话"` 而库里本来就是这句时,照抄键名会推一帧"标题变了",
   *     消费端就会给自己刚写的字段弹一条"其他设备改过"的假提示。
   *  ③ 广播失败**不得**改响应:这一帧丢了,另一端退化为"下次打开才同步"(既有拉取制),
   *     而把 200 变成 500 是把"下行没到"伪装成"写库失败"—— 症状与病因都会被判错。
   *     所以这里 catch 之后必须出声(request.log.warn),不得静默(§5e「失败必须响」)。
   */
  const broadcastConversationMeta = (
    request: FastifyRequest,
    userId: string,
    conversationId: string,
    fields: ConversationMetaField[],
    at: Date | string,
    values?: Partial<Record<ConversationMetaField, string | boolean | null>>,
  ): void => {
    if (fields.length === 0) return
    try {
      const evt = conversationUpdatedEvent({
        conversationId,
        fields,
        changedBy: userId,
        at,
        values,
      })
      server.broadcastToUser(userId, evt.event, evt.data)
    } catch (err) {
      request.log.warn(
        { err, userId, conversationId, fields },
        'D153 会话元数据广播发射失败(写库已成功,另一端退回下次打开时同步)',
      )
    }
  }

  /** 会话行 → 本次变更字段的**新值**(@ihui/types 的 `values` 成员;验收①要靠它落 UI) */
  const conversationMetaValues = (row: {
    title: string
    model: string | null
    archivedAt: Date | null
  }): Partial<Record<ConversationMetaField, string | boolean | null>> => ({
    title: row.title,
    model: row.model,
    archive: row.archivedAt !== null,
  })

  /**
   * 写前后两行 → 本次**真正**变化的可同步字段集合(D153 判据②的实现)。
   * 只覆盖服务端持有主副本的三列;`pinned` / `metadata` 不在封闭字段集里,
   * 那是另一型(置顶排序与挂起态),要同步得先扩 @ihui/types 的 CONVERSATION_META_FIELDS。
   */
  const diffConversationMetaFields = (
    before: { title: string; model: string | null; archivedAt: Date | null },
    after: { title: string; model: string | null; archivedAt: Date | null },
  ): ConversationMetaField[] => {
    const fields: ConversationMetaField[] = []
    if (before.title !== after.title) fields.push('title')
    if (before.model !== after.model) fields.push('model')
    // 归档按"有没有归档时刻"比,不比 Date 对象本身(两行各 new Date() 必然不等)
    if (Boolean(before.archivedAt) !== Boolean(after.archivedAt)) fields.push('archive')
    return fields
  }

  // ===========================================================================
  // 会话分组(D165,2026-10-01 立)
  //   三个动作分别是:移动到分组 / 移动所选(同一条 move 出口,1..n 条) / 分组置顶。
  //   失败必须给原因:分组不存在或不属于本人 = 404;批量移动回报取**库确认集**
  //   (affected + missedIds 逐条点名),不把请求数组长度当结果(AGENTS §5「计数要取库确认集」)。
  //   路径静态段 `/conversations/groups` 与参数路由 `/conversations/:id` 不同段数,
  //   且全部经 requireAuth + 属主过滤 —— 不存在"游客可读到别人的分组"那一格。
  // ===========================================================================

  server.get(
    '/conversations/groups',
    { schema: { summary: '分组清单', tags: ['chat'], response: buildResponseSchema(401) } },
    async (request, reply) => {
      await requireAuth(request, reply)
      if (!request.userId) return
      const groups = await listConversationGroups(request.userId)
      return reply.send(success({ groups }))
    },
  )

  // 分组归属表:会话列表本身的投影是既有的白名单序列化(不属本票射程,不扩列),
  // 所以这里单独给一张 (conversationId → groupId) 表,让侧栏能渲染"哪些在组里"。
  server.get(
    '/conversations/groups/assignments',
    { schema: { summary: '分组归属表', tags: ['chat'], response: buildResponseSchema(401) } },
    async (request, reply) => {
      await requireAuth(request, reply)
      if (!request.userId) return
      const map = await listConversationGroupIds(request.userId)
      const assignments = [...map.entries()].map(([conversationId, groupId]) => ({
        conversationId,
        groupId,
      }))
      return reply.send(success({ assignments }))
    },
  )

  server.post(
    '/conversations/groups',
    {
      schema: {
        summary: '新建分组',
        tags: ['chat'],
        body: { type: 'object', required: ['name'] },
        response: buildResponseSchema(400, 401),
      },
    },
    async (request, reply) => {
      await requireAuth(request, reply)
      if (!request.userId) return
      const parsed = createGroupSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      try {
        const group = await createConversationGroup(request.userId, parsed.data.name)
        // 同名不报错:回已有那条并标 reused,让 UI 能把"已在这个组里"如实说出来
        return reply.status(group.created ? 201 : 200).send(
          success({
            group: { id: group.id, name: group.name, pinned: group.pinned },
            reused: !group.created,
          }),
        )
      } catch (e) {
        if (e instanceof Error && e.message === 'group_create_race') {
          return reply.status(409).send(error(409, '分组刚被并发修改,请重试'))
        }
        throw e
      }
    },
  )

  server.patch(
    '/conversations/groups/:id',
    {
      schema: {
        summary: '改名 / 分组置顶',
        tags: ['chat'],
        params: {
          type: 'object',
          properties: { id: { type: 'string', format: 'uuid' } },
          required: ['id'],
        },
        response: buildResponseSchema(400, 401, 404),
      },
    },
    async (request, reply) => {
      await requireAuth(request, reply)
      if (!request.userId) return
      const { id } = request.params as { id: string }
      const parsed = updateGroupSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      if (parsed.data.name !== undefined) {
        const renamed = await renameConversationGroup(request.userId, id, parsed.data.name)
        if (!renamed.ok) return reply.status(404).send(error(404, '分组不存在或无权修改'))
      }
      if (parsed.data.pinned !== undefined) {
        const pinned = await setConversationGroupPinned(request.userId, id, parsed.data.pinned)
        if (!pinned.ok) return reply.status(404).send(error(404, '分组不存在或无权修改'))
      }
      return reply.send(
        success({
          id,
          renamed: parsed.data.name !== undefined,
          pinned: parsed.data.pinned ?? null,
        }),
      )
    },
  )

  server.delete(
    '/conversations/groups/:id',
    {
      schema: {
        summary: '删除分组(只清归类,不删会话)',
        tags: ['chat'],
        params: {
          type: 'object',
          properties: { id: { type: 'string', format: 'uuid' } },
          required: ['id'],
        },
        response: buildResponseSchema(401, 404),
      },
    },
    async (request, reply) => {
      await requireAuth(request, reply)
      if (!request.userId) return
      const { id } = request.params as { id: string }
      const result = await deleteConversationGroup(request.userId, id)
      if (!result.ok) return reply.status(404).send(error(404, '分组不存在或无权删除'))
      return reply.send(success({ id, deleted: true }))
    },
  )

  server.post(
    '/conversations/groups/move',
    {
      schema: {
        summary: '移动会话到分组 / 移出分组',
        tags: ['chat'],
        body: { type: 'object', required: ['conversationIds', 'groupId'] },
        response: buildResponseSchema(400, 401, 404),
      },
    },
    async (request, reply) => {
      await requireAuth(request, reply)
      if (!request.userId) return
      const parsed = moveConversationsSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const requested = dedupeIds(parsed.data.conversationIds)
      try {
        const moved = await moveConversationsToGroup(request.userId, requested, parsed.data.groupId)
        return reply.send(
          success({
            requested: moved.requestedIds.length,
            affected: moved.affected,
            // 逐条点名"没动成的那些",UI 才能说"3 条里有 1 条已不存在",而不是整批报成功
            missedIds: moved.missedIds,
            groupId: parsed.data.groupId,
          }),
        )
      } catch (e) {
        if (e instanceof Error && e.message === 'group_not_owned') {
          return reply.status(404).send(error(404, '目标分组不存在或无权使用'))
        }
        throw e
      }
    },
  )

  // POST /conversations - 创建对话
  server.post(
    '/conversations',
    {
      schema: {
        summary: '创建对话',
        description: '已登录用户创建新对话,可指定标题/模型/系统提示词/元数据',
        tags: ['chat'],
        body: {
          type: 'object',
          properties: {
            title: { type: 'string', maxLength: 255, description: '对话标题' },
            model: { type: 'string', maxLength: 64, description: '模型标识' },
            systemPrompt: { type: 'string', description: '系统提示词' },
            metadata: {
              type: 'object',
              additionalProperties: true,
              description: '元数据(任意键值)',
            },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              code: { type: 'number' },
              message: { type: 'string' },
              data: { type: 'object', additionalProperties: true },
            },
          },
          400: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
          401: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
          500: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      await requireAuth(request, reply)
      if (!request.userId) return
      const userId = request.userId

      const parsed = createConversationSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }

      try {
        const conversation = await createConversation({
          userId,
          title: parsed.data.title,
          model: parsed.data.model,
          systemPrompt: parsed.data.systemPrompt,
          metadata: parsed.data.metadata,
        })

        return reply
          .status(201)
          .send(success({ conversation: serializeConversation(conversation) }))
      } catch (err) {
        // 2026-07-27 修复:500 空 body 不友好,打印堆栈 + 返回错误消息
        request.log.error({ err }, '创建对话失败')
        const msg = err instanceof Error ? err.message : '创建对话失败'
        return reply.code(500).send(error(500, msg))
      }
    },
  )

  // GET /conversations - 对话列表（分页 + 按 title 搜索）
  server.get(
    '/conversations',
    {
      schema: {
        summary: '对话列表',
        description: '已登录用户对话列表(分页,可按标题搜索)',
        tags: ['chat'],
        querystring: {
          type: 'object',
          properties: {
            ...paginationQuerySchema,
            search: { type: 'string', maxLength: 255, description: '按标题搜索' },
          },
        },
        response: buildResponseSchema(400, 401),
      },
    },
    async (request, reply) => {
      await requireAuth(request, reply)
      if (!request.userId) return
      const userId = request.userId

      const parsed = paginationSchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }

      const { list, total } = await findConversationsByUser(userId, {
        page: parsed.data.page,
        pageSize: parsed.data.pageSize,
        search: parsed.data.search,
      })

      return reply.send(
        success({
          conversations: list.map(serializeConversation),
          page: parsed.data.page,
          pageSize: parsed.data.pageSize,
          total,
        }),
      )
    },
  )

  // GET /conversations/:id - 对话详情
  server.get('/conversations/:id', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const userId = request.userId

    const { id } = idParam.parse(request.params)
    const { conversation } = await ensureOwnedConversation(id, userId, reply)
    if (!conversation) return

    return reply.send(success({ conversation: serializeConversation(conversation) }))
  })

  // PATCH /conversations/:id - 更新对话
  server.patch('/conversations/:id', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const userId = request.userId

    const { id } = idParam.parse(request.params)
    const parsed = updateConversationSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    const owned = await ensureOwnedConversation(id, userId, reply)
    if (!owned.conversation) return

    const updated = await updateConversation(id, parsed.data)
    // D153:写库成功后按"库里到底变了哪一列"广播(见 broadcastConversationMeta 判据②)
    broadcastConversationMeta(
      request,
      userId,
      id,
      diffConversationMetaFields(owned.conversation, updated),
      updated.updatedAt,
      conversationMetaValues(updated),
    )
    return reply.send(success({ conversation: serializeConversation(updated) }))
  })

  // POST /conversations/:id/auto-title - 会话标题自动生成(2026-09-15 立,四竞品对标 V2 #15)
  // 首轮回复完成后由前端 fire-and-forget 调用:LLM 依据首条用户消息生成 ≤24 字标题回写。
  // 仅当当前标题仍为默认值「新对话」时才覆盖(schema 默认值)——用户手动重命名后不再自动改。
  // 失败(超时/stub/上游错误)一律 success({ok:false}) 静默返回,保持默认标题,绝不打扰用户。
  const autoTitleSchema = z.object({
    /** 首条用户消息文本(用于生成标题;后端再截断到 2000 字符) */
    text: z.string().min(1).max(4_000),
    /** 当前会话模型(标题生成沿用,undefined 时用 LITELLM_MODEL 兜底) */
    model: z.string().max(200).optional(),
  })
  server.post('/conversations/:id/auto-title', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const userId = request.userId

    const { id } = idParam.parse(request.params)
    const parsed = autoTitleSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    const owned = await ensureOwnedConversation(id, userId, reply)
    if (!owned.conversation) return

    // 用户已手动重命名(标题 ≠ 默认值)→ 不覆盖,直接 OK
    if (owned.conversation.title !== DEFAULT_CONVERSATION_TITLE) {
      return reply.send(success({ ok: true, title: owned.conversation.title, updated: false }))
    }

    const title = await generateConversationTitle(request, parsed.data.text, parsed.data.model)
    if (!title) {
      // 生成失败:静默成功(前端保持默认标题,不重试不报错)
      return reply.send(success({ ok: true, updated: false }))
    }
    const updated = await updateConversationTitle(id, userId, title)
    if (!updated) {
      return reply.status(404).send(error(404, '对话不存在'))
    }
    // D153:自动标题**也**要下行。这一型最容易漏,因为它是后台 fire-and-forget 写的,
    // 用户没在任何端按"重命名" —— 另一端侧栏于是长期挂着「新对话」而无人喊。
    broadcastConversationMeta(request, userId, id, ['title'], updated.updatedAt, {
      title: updated.title,
    })
    return reply.send(success({ ok: true, title, updated: true }))
  })

  // DELETE /conversations/:id - 删除对话（级联删除消息）
  server.delete('/conversations/:id', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const userId = request.userId

    const { id } = idParam.parse(request.params)
    const owned = await ensureOwnedConversation(id, userId, reply)
    if (!owned.conversation) return

    // deleted 由库侧 RETURNING 派生,不是代码常量(2026-09-27):上面的归属预查与这次
    // 删除之间若有并发,行已不在 ⇒ 这里必须如实报 false,而不是照旧回 true。
    const removed = await deleteConversation(id)
    return reply.send(success({ deleted: removed.length > 0 }))
  })

  // POST /conversations/batch - 批量操作对话(删除/收藏/取消收藏/归档/取消归档)
  // 用户归属校验由 DB 层 userId + inArray(ids) 一次过滤,防越权
  // 批量导出由前端循环单条 export + 逐个下载,不在此接口
  server.post('/conversations/batch', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const userId = request.userId

    const parsed = batchActionSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    const { action, ids } = parsed.data

    try {
      // 2026-09-26 修"改了 0 行"与"改成功"同形(现读实测:原第 619 行在 affected=0 时
      // 仍回 success(),客户端以为改成了而实际一行没动)。
      // 五个批量写的 where 条件都是 userId + inArray(ids),所以"哪些 id 根本没进这一次写"
      // 可由一次归属预查询逐条回答(别人的 id / 已删的 id / id 写错),而不是只给一个总数。
      // 兼容性:响应只**新增** missedIds 字段,既有 action/affected 语义与字段名逐字不变。
      // 已知粒度限制(如实登记):unfavorite 的 affected 计的是真删掉的收藏行数,
      // "属于本人但本就没收藏"的 id 不进 missedIds —— 那已是要达到的状态,不是未命中。
      const uniqueIds = dedupeIds(ids)
      const ownedRows = await db
        .select({ id: chatConversations.id })
        .from(chatConversations)
        .where(and(eq(chatConversations.userId, userId), inArray(chatConversations.id, uniqueIds)))
      const { missedIds } = batchWriteOutcome(
        uniqueIds,
        ownedRows.map((r) => r.id),
      )

      let affected = 0
      switch (action) {
        case 'delete':
          affected = await deleteConversationsBatch(userId, ids)
          break
        case 'favorite':
          affected = await favoriteConversationsBatch(userId, ids)
          break
        case 'unfavorite':
          affected = await unfavoriteConversationsBatch(userId, ids)
          break
        case 'archive':
          affected = await setConversationsArchivedBatch(userId, ids, true)
          break
        case 'unarchive':
          affected = await setConversationsArchivedBatch(userId, ids, false)
          break
      }
      // D153(2026-09-29):归档是"另一台设备最看不出来"的一类变更 —— 侧栏少一行没有报错,
      // 只有沉默分叉。所以只对**库里真的被这次写命中**的那些 id 发帧:上面的归属预查询
      // (ownedRows)就是命中集,别人的 id / 已删的 id / 写错的 id 一条都不推
      // (守门 134 的同一条判据:回报集合取库侧确认集,不取请求侧数组)。
      // 时机:写在 switch 之后 ⇒ 五个 action 的写链都已 await 完成。
      if (action === 'archive' || action === 'unarchive') {
        for (const row of ownedRows) {
          broadcastConversationMeta(request, userId, row.id, ['archive'], new Date(), {
            archive: action === 'archive',
          })
        }
      }
      return reply.send(success({ action, affected, missedIds }))
    } catch (err) {
      request.log.error({ err }, '批量操作失败')
      const msg = err instanceof Error ? err.message : '批量操作失败'
      return reply.code(500).send(error(500, msg))
    }
  })

  // GET /conversations/:id/messages - 消息列表（分页/游标，按时间正序）
  server.get(
    '/conversations/:id/messages',
    {
      schema: {
        summary: '消息列表',
        description: '获取指定对话的消息列表(分页/游标,按时间正序)',
        tags: ['chat'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            // G-261:type-only,uuid 由 conversationIdParam(Zod)校验;format:'uuid' 走 ajv 先拒会被掩盖成 500
            id: { type: 'string', description: '对话 ID(UUID,服务端 Zod 校验)' },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            // G-261:querystring 一律 type:'string'(传输线本就是字符串,ajv 的 integer 强转/minimum/
            // maximum/default/enum/format 同属校验行为,非法值走 ajv 先拒 ⇒ 500);
            // 真实校验一律 messageListSchema(Zod:page≥1 默认1,pageSize 1-100 默认20,before/after uuid,direction enum)。
            page: { type: 'string', description: '页码(整数,默认 1;服务端 Zod 校验)' },
            pageSize: {
              type: 'string',
              description: '每页条数(1-100,默认 20;服务端 Zod 校验)',
            },
            before: {
              type: 'string',
              description: '游标:返回该消息 ID 之前的记录(UUID,服务端 Zod 校验)',
            },
            after: {
              type: 'string',
              description: '游标:返回该消息 ID 之后的记录(UUID,服务端 Zod 校验)',
            },
            // 2026-09-16 P1 #24:keyset 复合游标(与旧 before/after 互斥但可并存,路由优先用 cursor)
            cursor: {
              type: 'string',
              description: 'keyset 复合游标(base64url JSON {createdAt,id}),与 direction 配合使用',
            },
            direction: {
              type: 'string',
              description: 'initial=取最新 N 条;older=在 cursor 之前取更早的消息(服务端 Zod 校验)',
            },
          },
        },
        response: buildResponseSchema(400, 401, 403, 404),
      },
    },
    async (request, reply) => {
      await requireAuth(request, reply)
      if (!request.userId) return
      const userId = request.userId

      const parsedId = conversationIdParam.safeParse(request.params)
      if (!parsedId.success) {
        return reply.status(400).send(error(400, parsedId.error.issues[0]?.message ?? '参数错误'))
      }
      const { id } = parsedId.data
      const owned = await ensureOwnedConversation(id, userId, reply)
      if (!owned.conversation) return

      const parsed = messageListSchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }

      const { page, pageSize, before, after, cursor, direction } = parsed.data

      // P1 #24(2026-09-16):keyset 复合游标模式。带 cursor 或显式 direction 时走
      // findMessagesCursor;否则走旧 findMessages(offset / before / after),保证旧调用方零感知。
      const useKeyset = cursor !== undefined || direction !== undefined
      if (useKeyset) {
        const decoded = cursor ? decodeMessageCursor(cursor) : null
        if (cursor && !decoded) {
          return reply.status(400).send(error(400, '游标格式非法'))
        }
        const dir: 'initial' | 'older' = direction ?? (decoded ? 'older' : 'initial')
        const result = await findMessagesCursor(id, {
          cursor: decoded,
          limit: pageSize,
          direction: dir,
        })
        return reply.send(
          success({
            messages: result.messages.map(serializeMessage),
            page,
            pageSize,
            // keyset 模式无需总数,固定 0 保持响应结构稳定(前端以 hasMore/nextCursor 判定)
            total: 0,
            hasMore: result.hasMore,
            nextCursor: result.nextCursor ? encodeMessageCursor(result.nextCursor) : null,
          }),
        )
      }

      const { list, total, hasMore, nextCursor } = await findMessages(id, {
        page,
        pageSize,
        before,
        after,
      })

      return reply.send(
        success({
          messages: list.map(serializeMessage),
          page,
          pageSize,
          total,
          hasMore,
          nextCursor,
        }),
      )
    },
  )

  // GET /conversations/:id/history - D35 turn 分片拉取(2026-09-24,增量回放数据面)
  // 每页 = N 个 turn(一轮 user→assistant 交互);cursor 为 base64url JSON {turnOrdinal}。
  // direction: newest=首屏取最新 N turn;older=断点之前(上翻,追加后旧 cursor 仍有效);
  // newer=断点之后(增量续读)。projectionState 透传会话的投影状态(可空=尚未投影)。
  server.get(
    '/conversations/:id/history',
    {
      schema: {
        summary: '会话历史 turn 分片',
        description: '按 turn 分片拉取会话历史(D35 分页投影/增量回放,时间正序)',
        tags: ['chat'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            // G-261:type-only,uuid 由 conversationIdParam(Zod)校验(同 /messages)
            id: { type: 'string', description: '对话 ID(UUID,服务端 Zod 校验)' },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            // G-261:querystring 一律 type:'string',真实校验一律 historyListSchema
            // (Zod:limit 1-100 默认 20,direction enum newest/older/newer)。
            limit: {
              type: 'string',
              description: '每页 turn 数(1-100,默认 20;非消息数,服务端 Zod 校验)',
            },
            cursor: {
              type: 'string',
              description: '回放断点(base64url JSON {turnOrdinal})',
            },
            direction: {
              type: 'string',
              description:
                'newest=取最新 N turn;older=断点之前;newer=断点之后(增量续读;服务端 Zod 校验)',
            },
          },
        },
        response: buildResponseSchema(400, 401, 403, 404),
      },
    },
    async (request, reply) => {
      await requireAuth(request, reply)
      if (!request.userId) return
      const userId = request.userId

      const parsedId = conversationIdParam.safeParse(request.params)
      if (!parsedId.success) {
        return reply.status(400).send(error(400, parsedId.error.issues[0]?.message ?? '参数错误'))
      }
      const { id } = parsedId.data
      const owned = await ensureOwnedConversation(id, userId, reply)
      if (!owned.conversation) return

      const parsed = historyListSchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { limit, cursor, direction } = parsed.data

      let cursorTurnOrdinal: number | null = null
      if (cursor !== undefined) {
        const decoded = decodeHistoryCursor(cursor)
        if (!decoded) {
          return reply.status(400).send(error(400, '游标格式非法'))
        }
        cursorTurnOrdinal = decoded.turnOrdinal
      }

      const result = await findHistoryTurnPage(id, {
        limit,
        cursorTurnOrdinal,
        direction: direction ?? 'newest',
      })

      return reply.send(
        success({
          turns: result.turns.map((t) => ({
            turnOrdinal: t.turnOrdinal,
            messages: t.messages.map(serializeMessage),
          })),
          limit,
          hasMore: result.hasMore,
          nextCursor: result.nextCursor ? encodeHistoryCursor(result.nextCursor) : null,
          // 断点存续性(stale = 游标那一轮已被删除/压缩重编号)。服务端在 stale 时给的是
          // 空页(见 findHistoryTurnPage),客户端据此重锚而不是把两段不相邻的窗口拼起来。
          cursorState: result.cursorState,
          // 投影状态透传(可空=尚未投影);写入侧见 chat-queries.rollHistoryProjection,
          // 由 createMessage / replaceMessages 在同一事务内推进断点后落库。
          projectionState: owned.conversation.historyProjectionState ?? null,
        }),
      )
    },
  )

  // POST /conversations/:id/messages - 发送消息（更新 last_message_at）
  server.post('/conversations/:id/messages', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const userId = request.userId

    const { id } = idParam.parse(request.params)
    const owned = await ensureOwnedConversation(id, userId, reply)
    if (!owned.conversation) return

    const parsed = createMessageSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    const message = await createMessage({
      conversationId: id,
      role: parsed.data.role,
      content: parsed.data.content,
      tokens: parsed.data.tokens,
      metadata: parsed.data.metadata,
      reasoning: parsed.data.reasoning,
    })

    // WebSocket 实时推送：新消息即时通知客户端刷新（多端同步）
    // 通过 server.pushNotification 自动处理本机 + 多实例广播
    try {
      server.pushNotification(userId, {
        type: 'chat_message',
        conversationId: id,
        message: serializeMessage(message),
      })
    } catch {
      // 推送失败不阻塞消息创建
    }

    return reply.status(201).send(success({ message: serializeMessage(message) }))
  })

  // DELETE /messages/:id - 删除单条消息
  server.delete('/messages/:id', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const userId = request.userId

    const { id } = idParam.parse(request.params)
    const message = await findMessageById(id)
    if (!message) {
      return reply.status(404).send(error(404, '消息不存在'))
    }

    // 校验消息所属对话属于当前用户
    const conversation = await findConversationById(message.conversationId)
    if (!conversation || conversation.userId !== userId) {
      return reply.status(403).send(error(403, '无权删除该消息'))
    }

    // deleted 由库侧 RETURNING 派生,不是代码常量(2026-09-27)
    const removed = await deleteMessage(id)
    return reply.send(success({ deleted: removed.length > 0 }))
  })

  // POST /conversations/:id/regenerate - 重新生成
  // 2026-08-30 立;票59(2026-10-07)改 sibling 语义:不再物理删除 —— 目标 AI 消息保留为
  // 版本族根,返回 rootId/nextSiblingIndex 供后续新回复以 sibling 身份入族
  // (createMessage 已放通 parentMessageId/siblingIndex),版本切换由前端复用 CanvasVersionMenu 交互(2/3、3/3)。
  server.post('/conversations/:id/regenerate', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const userId = request.userId

    const { id } = idParam.parse(request.params)
    const owned = await ensureOwnedConversation(id, userId, reply)
    if (!owned.conversation) return

    const parsed = regenerateSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    try {
      const result = await regenerateConversationMessages(id, parsed.data.messageId)
      return reply.send(success(result))
    } catch (err) {
      request.log.error({ err }, '重新生成失败')
      const msg = err instanceof Error ? err.message : '重新生成失败'
      return reply.code(500).send(error(500, msg))
    }
  })

  // POST /conversations/:id/edit-rerun - 编辑重跑(2026-09-12 立,四竞品对标 P0-1)
  // 对标 Cursor/Trae 消息编辑:更新目标用户消息内容(事务),并删除其后的所有消息;
  // 前端随后以新内容复用 sendMessage(regenerate 模式)重新流式生成回复。
  // 2026-09-15 补回:被 65ecb9dd9 误删,而 api-client 的 editAndRerunConversation 仍在调用。
  server.post('/conversations/:id/edit-rerun', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const userId = request.userId

    const { id } = idParam.parse(request.params)
    const owned = await ensureOwnedConversation(id, userId, reply)
    if (!owned.conversation) return

    const parsed = editRerunSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    try {
      const message = await editMessageAndTruncateAfter(
        id,
        parsed.data.messageId,
        parsed.data.content,
      )
      return reply.send(success({ message: serializeMessage(message) }))
    } catch (err) {
      request.log.error({ err }, '编辑重跑失败')
      const msg = err instanceof Error ? err.message : '编辑重跑失败'
      const isNotFound = msg.includes('不存在或不属于')
      return reply.code(isNotFound ? 404 : 500).send(error(isNotFound ? 404 : 500, msg))
    }
  })

  // POST /conversations/:id/branch - 分支/回退
  // 2026-08-30 立:基于指定消息(含该消息)之前的内容创建新会话,旧会话原样保留。
  // 相当于 Git 分支:从历史某条消息处"重新分叉",而非删除旧内容。
  server.post('/conversations/:id/branch', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const userId = request.userId

    const { id } = idParam.parse(request.params)
    const owned = await ensureOwnedConversation(id, userId, reply)
    if (!owned.conversation) return

    const parsed = branchSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    try {
      const conversation = await branchConversationFrom(id, parsed.data.messageId, {
        userId,
        title: parsed.data.title,
        model: parsed.data.model,
      })
      return reply.status(201).send(success({ conversation: serializeConversation(conversation) }))
    } catch (err) {
      request.log.error({ err }, '创建分支失败')
      const msg = err instanceof Error ? err.message : '创建分支失败'
      return reply.code(500).send(error(500, msg))
    }
  })

  // POST /conversations/:id/favorite - 收藏对话
  server.post('/conversations/:id/favorite', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const userId = request.userId

    const { id } = idParam.parse(request.params)
    const owned = await ensureOwnedConversation(id, userId, reply)
    if (!owned.conversation) return

    const created = await favoriteConversation(userId, id)
    return reply.status(created ? 201 : 200).send(success({ favorited: true, created }))
  })

  // DELETE /conversations/:id/favorite - 取消收藏
  server.delete('/conversations/:id/favorite', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const userId = request.userId

    const { id } = idParam.parse(request.params)
    // 取消收藏前仍校验对话归属，避免越权操作
    const owned = await ensureOwnedConversation(id, userId, reply)
    if (!owned.conversation) return

    await unfavoriteConversation(userId, id)
    return reply.send(success({ unfavorited: true }))
  })

  // POST /messages/feedback - 消息点赞/点踩落库(D49①,2026-09-23):此前右键反馈仅 toast
  // D64⑤(2026-09-26):问卷化扩展 —— reason(五类原因)/comment(≤500)可选字段;
  // 旧载荷(仅 messageId+rating)完全兼容,未传扩展字段时行为不变。
  server.post('/messages/feedback', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const userId = request.userId

    const parsed = z
      .object({
        messageId: z.string().uuid(),
        rating: z.enum(['like', 'dislike']),
        // D64⑤ 可选扩展载荷:旧客户端不传 ⇒ 完全兼容
        reason: z.enum(['inaccurate', 'incomplete', 'offTopic', 'style', 'other']).optional(),
        comment: z.string().max(500).optional(),
      })
      .safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    // 问卷载荷:comment trim 后为空视同未填,不落脏数据;两者皆空 = 纯评分(D49① 原语义)
    const comment = parsed.data.comment?.trim() || undefined
    const survey =
      parsed.data.reason || comment ? { reason: parsed.data.reason, comment } : undefined

    const result = await rateChatMessage(userId, parsed.data.messageId, parsed.data.rating, survey)
    if (!result.ok) {
      // 不区分"不存在"与"无权":对外一致 404,不泄露他人消息 id 有效性
      return reply.status(404).send(error(404, '消息不存在或无权操作'))
    }
    return reply.send(success({ rated: true, rating: parsed.data.rating }))
  })

  // GET /favorites - 收藏对话列表
  server.get('/favorites', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const userId = request.userId

    const parsed = paginationSchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    const { list, total } = await findFavoriteConversations(userId, {
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
    })

    return reply.send(
      success({
        favorites: list.map((row) => ({
          ...serializeConversation(row),
          favoriteId: row.favoriteId,
          favoriteCreatedAt: row.favoriteCreatedAt,
        })),
        page: parsed.data.page,
        pageSize: parsed.data.pageSize,
        total,
      }),
    )
  })

  // POST /conversations/:id/clear - 清空对话消息（保留对话）
  server.post('/conversations/:id/clear', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const userId = request.userId

    const { id } = idParam.parse(request.params)
    const owned = await ensureOwnedConversation(id, userId, reply)
    if (!owned.conversation) return

    const cleared = await clearMessages(id)
    return reply.send(success({ cleared: cleared.length > 0 }))
  })

  // POST /conversations/:id/archive - 归档对话
  server.post('/conversations/:id/archive', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const userId = request.userId

    const { id } = idParam.parse(request.params)
    const owned = await ensureOwnedConversation(id, userId, reply)
    if (!owned.conversation) return

    const updated = await archiveConversation(id)
    // D153:归档态是沉默分叉最重的一型(另一端侧栏里这行还在,点开才发现已归档)
    broadcastConversationMeta(request, userId, id, ['archive'], updated.updatedAt, {
      archive: true,
    })
    return reply.send(success({ conversation: serializeConversation(updated) }))
  })

  // DELETE /conversations/:id/archive - 取消归档
  server.delete('/conversations/:id/archive', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const userId = request.userId

    const { id } = idParam.parse(request.params)
    const owned = await ensureOwnedConversation(id, userId, reply)
    if (!owned.conversation) return

    const updated = await unarchiveConversation(id)
    // D153:与归档同形 —— 取消归档同样是"另一端看不出来"的沉默变更
    broadcastConversationMeta(request, userId, id, ['archive'], updated.updatedAt, {
      archive: false,
    })
    return reply.send(success({ conversation: serializeConversation(updated) }))
  })

  // GET /conversations/:id/export - 导出对话消息(md/txt)
  server.get('/conversations/:id/export', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const userId = request.userId

    const { id } = idParam.parse(request.params)
    const owned = await ensureOwnedConversation(id, userId, reply)
    if (!owned.conversation) return

    const formatQuery = z.object({ format: z.enum(['txt', 'md']).default('md') })
    const parsed = formatQuery.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const fmt = parsed.data.format

    const messages = await findMessagesForExport(id)
    const title = owned.conversation.title

    if (fmt === 'md') {
      const parts = [`# ${title}\n`]
      for (const m of messages) {
        parts.push(`## ${m.role} - ${new Date(m.createdAt).toISOString()}\n\n${m.content}\n`)
      }
      const content = parts.join('\n')
      reply
        .header('Content-Disposition', `attachment; filename="conversation-${id}.md"`)
        .type('text/markdown')
        .send(content)
    } else {
      const parts: string[] = []
      for (const m of messages) {
        parts.push(`[${m.role}] ${new Date(m.createdAt).toISOString()}\n${m.content}\n`)
      }
      const content = parts.join('\n')
      reply
        .header('Content-Disposition', `attachment; filename="conversation-${id}.txt"`)
        .type('text/plain')
        .send(content)
    }
  })

  // POST /conversations/:id/compress - 压缩对话上下文(调用 ai-service)
  server.post('/conversations/:id/compress', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const userId = request.userId

    const { id } = idParam.parse(request.params)
    const owned = await ensureOwnedConversation(id, userId, reply)
    if (!owned.conversation) return

    const parsed = compressSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { targetChars } = parsed.data

    const messages = await findMessagesForExport(id)
    const conversationText = messages.map((m) => `[${m.role}] ${m.content}`).join('\n\n')
    const llmMessages = [
      {
        role: 'system',
        content: `你是对话压缩助手。请把以下对话压缩到 ${targetChars} 字符以内,保留关键信息、用户意图、AI 回答要点,不要丢失重要上下文。直接输出压缩后的对话内容,不要附加说明。`,
      },
      { role: 'user', content: conversationText },
    ]

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5 * 60 * 1000)
    let aiResult: {
      content?: string
      model?: string
      usage?: unknown
      stub?: boolean
      error?: string
    }
    try {
      // aiServiceFetch:透传用户 JWT(ai-service jwt_auth 强制鉴权,裸 fetch 恒 401)
      const resp = await aiServiceFetch(request, '/api/llm/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: llmMessages,
          // 优先对话配置的模型(请求上下文),回退环境变量默认(LITELLM_MODEL)
          model: owned.conversation.model || FALLBACK_MODEL,
        }),
        signal: controller.signal,
      })
      if (!resp.ok) {
        const errText = await resp.text().catch(() => '')
        return reply
          .status(502)
          .send(error(502, `AI service error: HTTP ${resp.status} ${errText}`))
      }
      aiResult = (await resp.json()) as typeof aiResult
    } catch (e) {
      return reply.status(502).send(error(502, `AI service error: ${(e as Error).message}`))
    } finally {
      clearTimeout(timeout)
    }

    if (aiResult.error) {
      return reply.status(502).send(error(502, `AI service error: ${aiResult.error}`))
    }

    const content = aiResult.content ?? ''
    await saveCompressedContext(id, content)

    return reply.send(
      success({
        content,
        model: aiResult.model,
        usage: aiResult.usage,
        originalChars: conversationText.length,
        compressedChars: content.length,
      }),
    )
  })

  // POST /compact — API 端手动压缩上下文(2026-09-02 立,对标 CLI /compact + /chat/stream 自动压缩)
  // 契约:POST /api/chat/compact,body { conversationId }(web 端代理同构,字段命名保持驼峰)。
  // 语义:无视 88% 自动压缩触发阈值立即压缩,复用 /chat/stream 自动压缩同一套管线:
  // LLM 语义摘要(缓存命中优先)→ compressContextIfNeeded → 归档落库 → replaceMessages 持久化。
  // 手动压缩触发方式(CLI /compact 同构):伪造 contextLimit = max(2000, ceil(tokens / 0.87))
  // 并显式传 triggerRatio = 0.87 —— ceil(t/0.87)*0.87 ∈ [t, t+0.87) ⊂ [t, t+1),floor 后恰为 t,
  // 触发检查 originalTokens < triggerThreshold 恒不成立 → 必然进入压缩;
  // 压缩目标 targetRatio(0.6) × 伪造 limit ≈ 当前 ~69% tokens。
  // 响应 schema(success.data):
  //   - 压缩成功:{ compressed: true, originalTokens, compressedTokens, removedCount, trigger }
  //   - 消息太少:{ compressed: false, reason: 'too_few_messages', ... }(200,前端据此提示不报错)
  //   - 压不动:  { compressed: false, reason: 'incompressible', originalTokens, compressedTokens, ... }
  //   - 会话不存在/无权限:404(不泄露资源存在性);归档落库失败仅 console.warn 降级不阻塞。
  server.post('/compact', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const userId = request.userId

    const parsed = compactSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const conversationId = parsed.data.conversationId

    // 会话归属校验:不存在或非本人会话一律 404(与现有会话端点语义一致,不泄露存在性)
    const conversation = await findConversationById(conversationId)
    if (!conversation || conversation.userId !== userId) {
      return reply.status(404).send(error(404, '对话不存在或无权限'))
    }

    // 全量消息(findMessagesForExport 无分页上限),映射为压缩包 ChatMessage,
    // 与 /chat/stream 自动压缩的输入形态一致(仅 role/content,metadata 随压缩丢弃)
    const rows = await findMessagesForExport(conversationId)
    const messages: ChatMessage[] = rows.map((m) => ({
      role: m.role as ChatMessage['role'],
      content: m.content,
    }))

    // ① 消息太少,无压缩价值:200 + reason(不报错),token 字段保持响应 schema 统一
    if (messages.length < 3) {
      const tokens = Math.floor(estimateMessagesTokens(messages))
      return reply.send(
        success({
          compressed: false,
          reason: 'too_few_messages',
          originalTokens: tokens,
          compressedTokens: tokens,
          removedCount: 0,
        }),
      )
    }

    const conversationTail = conversationId.slice(-4)
    const forcedLimit = Math.max(
      2000,
      Math.ceil(Math.floor(estimateMessagesTokens(messages)) / 0.87),
    )

    // ② LLM 语义摘要(缓存命中优先,未命中实时生成;失败返回 null → 共享包静默降级规则摘要),
    //    与 /chat/stream 自动压缩同一套 [SemanticSummary] 管线。手动压缩立即执行,无需 70% 预热。
    let customSummary = getCachedSemanticSummary(conversationId, messages)
    if (customSummary !== null) {
      console.warn('[SemanticSummary] cache hit:', {
        conversationTail,
        summaryLength: customSummary.length,
      })
    } else {
      customSummary = await generateSemanticSummary(
        request,
        messages,
        conversation.model ?? undefined,
        conversationId,
      )
      console.warn(
        customSummary !== null ? '[SemanticSummary] generated:' : '[SemanticSummary] degraded:',
        { conversationTail, model: conversation.model ?? undefined },
      )
    }

    // ③ 手动压缩:伪造 contextLimit + triggerRatio 0.87 使触发检查自然通过(见函数头注释)
    const result = compressContextIfNeeded(messages, {
      contextLimit: forcedLimit,
      triggerRatio: 0.87,
      customSummary: customSummary ?? undefined,
    })
    console.warn('[Compaction][manual] result:', {
      conversationTail,
      compressed: result.compressed,
      trigger: result.trigger,
      originalTokens: result.originalTokens,
      compressedTokens: result.compressedTokens,
      removedCount: result.removedCount,
    })

    // ④ 无可压缩空间(trigger 'none':伪造阈值下 tokens 仍不足,如上下文本身很小;
    //    'incompressible':摘要/截断降级后仍压不动):200 + reason,保持原样
    if (!result.compressed) {
      return reply.send(
        success({
          compressed: false,
          reason: 'incompressible',
          originalTokens: result.originalTokens,
          compressedTokens: result.compressedTokens,
          removedCount: result.removedCount,
          trigger: result.trigger,
        }),
      )
    }

    // ⑤ 原子性持久化压缩结果(与 /chat/stream 自动压缩同一套 replaceMessages 管线):
    //    删除旧消息 + 批量插入压缩后消息。失败视为压缩未生效,返回 500 由前端提示重试
    try {
      await replaceMessages(conversationId, result.messages)
    } catch (e) {
      request.log.error({ err: e, conversationId }, '手动压缩持久化失败')
      return reply.status(500).send(error(500, '压缩结果持久化失败'))
    }

    // ⑥ 归档记忆:被压缩的原始消息落库 conversation_message_archives,前端"查看原始消息"可查。
    //    旁路降级:persistMessageArchive 内部吞掉一切失败(console.warn),绝不阻塞压缩返回
    void persistMessageArchive(conversationId, messages)

    return reply.send(
      success({
        compressed: true,
        originalTokens: result.originalTokens,
        compressedTokens: result.compressedTokens,
        removedCount: result.removedCount,
        trigger: result.trigger,
      }),
    )
  })

  // POST /coze/stream — Coze 流式聊天 + conversation_id 自动管理
  // 迁移自 coze_zhs_py/api/chat.py stream_generator
  server.post('/coze/stream', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const parsed = cozeStreamSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { botId, userId: targetUserId, query, conversationId } = parsed.data

    // 安全校验:客户端可控的 targetUserId 必须与登录用户一致,防止越权访问他人 Coze 会话
    if (targetUserId !== request.userId)
      return reply.status(403).send(error(403, '无权操作其他用户的会话'))

    const cozeKey = process.env.COZE_API_KEY
    if (!cozeKey) return reply.status(503).send(error(503, 'Coze 服务未配置'))

    const existingConvId = conversationId || (await getCozeConversationId(targetUserId, botId))

    // P1 修复:补齐 SSE 连接清理 — hijack + AbortController + close 监听 + 超时兜底
    reply.hijack()
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    })

    const controller = new AbortController()
    const onClose = () => controller.abort()
    request.raw.on('close', onClose)

    // 5 分钟兜底超时,防止上游挂住导致连接泄漏
    const timeoutGuard = setTimeout(() => controller.abort(), 5 * 60 * 1000)

    let newConversationId: string | null = null
    try {
      const resp = await fetch('https://api.coze.cn/v1/chat', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cozeKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bot_id: botId,
          user_id: targetUserId,
          query,
          conversation_id: existingConvId,
          stream: true,
        }),
        signal: controller.signal,
      })
      if (!resp.ok || !resp.body) {
        reply.raw.write(`data: ${JSON.stringify({ error: `Coze API ${resp.status}` })}\n\n`)
        return
      }
      const reader = resp.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data:')) continue
          const jsonStr = line.slice(5).trim()
          if (!jsonStr) continue
          try {
            const evt = JSON.parse(jsonStr) as unknown
            const extracted = extractConversationId(evt)
            if (extracted && extracted !== newConversationId) {
              newConversationId = extracted
              if (extracted !== existingConvId) {
                await saveCozeConversationId(targetUserId, botId, extracted).catch(() => {})
              }
            }
            reply.raw.write(`data: ${jsonStr}\n\n`)
          } catch {
            reply.raw.write(`data: ${jsonStr}\n\n`)
          }
        }
      }
      if (newConversationId) {
        await saveCozeConversationId(targetUserId, botId, newConversationId).catch(() => {})
      }
    } catch (e) {
      // 客户端断开导致的 AbortError 不写错误帧
      if (!(e instanceof Error && e.name === 'AbortError')) {
        reply.raw.write(`data: ${JSON.stringify({ error: (e as Error).message })}\n\n`)
      }
    } finally {
      clearTimeout(timeoutGuard)
      request.raw.removeListener('close', onClose)
      reply.raw.end()
    }
  })

  // POST /conversations/:id/share - 生成/获取分享token
  server.post('/conversations/:id/share', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const userId = request.userId
    const { id } = idParam.parse(request.params)
    const conversation = await findConversationById(id)
    if (!conversation) {
      return reply.status(404).send(error(404, '对话不存在'))
    }
    if (conversation.userId !== userId) {
      return reply.status(403).send(error(403, '无权访问该对话'))
    }
    // 跳过响应脱敏：share token 字段名为 token，会被 response-sanitizer 改写为 ***
    request.skipResponseSanitization = true
    const result = await setConversationShareToken(id, userId)
    return reply.send(success({ token: result.token }))
  })

  // GET /conversations/share/:token - 公开查看分享对话
  server.get('/conversations/share/:token', async (request, reply) => {
    const { token } = z.object({ token: z.string() }).parse(request.params)
    const conversation = await findConversationByShareToken(token)
    if (!conversation) {
      return reply.status(404).send(error(404, '对话不存在或已删除'))
    }
    const messages = await findMessagesForShare(conversation.id)
    return reply.send(
      success({ conversation: serializeConversationPublic(conversation), messages }),
    )
  })

  // GET /conversations/:id/archives - 压缩归档列表(2026-09-01 立,"归档记忆"能力)
  // 列出该会话每次自动压缩落库的原始消息归档(id/message_count/created_at,不含 messages 大字段)。
  // 归属校验:不存在或不属于当前用户一律 404(不泄露会话存在性)。
  server.get('/conversations/:id/archives', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const userId = request.userId

    const { id } = idParam.parse(request.params)
    const conversation = await findConversationById(id)
    if (!conversation || conversation.userId !== userId) {
      return reply.status(404).send(error(404, '对话不存在'))
    }

    const archives = await listMessageArchives(id)
    return reply.send(success({ archives }))
  })

  // GET /conversations/:id/archives/:archiveId - 压缩归档详情(含被压缩的原始消息 messages)
  // 查询限定 conversationId + archiveId 双条件,防跨会话越权读取归档。
  server.get('/conversations/:id/archives/:archiveId', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const userId = request.userId

    const { id, archiveId } = z
      .object({ id: z.string(), archiveId: z.string() })
      .parse(request.params)
    const conversation = await findConversationById(id)
    if (!conversation || conversation.userId !== userId) {
      return reply.status(404).send(error(404, '对话不存在'))
    }

    const archive = await findMessageArchive(id, archiveId)
    if (!archive) {
      return reply.status(404).send(error(404, '归档不存在'))
    }
    return reply.send(success({ archive }))
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
