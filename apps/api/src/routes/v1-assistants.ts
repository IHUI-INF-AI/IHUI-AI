// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * /v1/assistants + /v1/threads + /v1/messages + /v1/runs 路由(2026-07-31 立)。
 *
 * OpenAI Assistants API v2 兼容端点,让第三方 SDK(LangChain/LlamaIndex)可直接接入。
 * 端点清单(共 17 个):
 *   Assistants:POST /assistants | GET /assistants/:id | POST /assistants/:id | DELETE /assistants/:id | GET /assistants
 *   Threads:   POST /threads | GET /threads/:id | POST /threads/:id | DELETE /threads/:id
 *   Messages:  POST /threads/:threadId/messages | GET /threads/:threadId/messages/:id | GET /threads/:threadId/messages
 *   Runs:      POST /threads/:threadId/runs | GET /threads/:threadId/runs/:id | POST /threads/:threadId/runs/:id | GET /threads/:threadId/runs
 *   Run Steps: GET /threads/:threadId/runs/:runId/steps
 *   Run Refs:  GET /run-refs/:ref(IHUI 发的 irun_ 句柄,O10b)
 *              GET /threads/runs/by-external-id/:externalId(第三方自带业务键反查,O10c)
 *
 * 内部映射:Assistant → ai-service 的 agent 配置;Thread → 会话;Run → agent 执行(调用 /api/llm/complete)。
 * 存储:助手/线程/消息/run 元数据存 Redis(key 前缀 assistant: / thread: / run:),TTL 90 天。
 * 鉴权:requireApiKeyAuth preHandler(Bearer token + developer_api_keys 表)。
 * 计费:Run 完成时 recordCall(model 从 assistant 配置读取)。
 *
 * 待主 agent 在 routes/index.ts 注册:
 *   import v1Assistants from './v1-assistants.js'
 *   server.register(v1Assistants, { prefix: '/v1' })
 *
 * 响应格式:OpenAI 兼容(不套 { code, message, data } 壳,与 v1-public.ts / v1-rerank-moderations.ts 一致)。
 * 错误格式:{ code, message } + HTTP 状态码(400/401/403/404/500/502/503)。
 */
import type { FastifyPluginAsync } from 'fastify'
import { randomBytes, randomUUID } from 'node:crypto'
import type { Redis } from 'ioredis'
import { z } from 'zod'
import { config } from '../config/index.js'
import { requireCapability, requireCapabilityRules } from '../utils/capability-guard.js'
import { requireApiKeyAuth } from '../plugins/api-key-auth.js'
import { error } from '../utils/response.js'
import { aiServiceFetch } from '../utils/ai-service-fetch.js'
import { recordCall, modelToProviderCode } from '../services/relay-billing-service.js'
// 格②(2026-09-26):耗时一律走单调钟出口,落库形态经唯一适配器投影
import { startStopwatch } from '../utils/elapsed-ms.js'
import { persistableLatency } from '../utils/latency-persistence.js'
import {
  CURSOR_KIND,
  pageOf,
  readCursorPageRequest,
  resolveAfter,
  wantsCursorPageFormat,
  withNextCursor,
  type CursorBinding,
  type PageRequest,
} from '../utils/cursor-page.js'

// =============================================================================
// 类型定义(OpenAI Assistants API v2 兼容,inline 定义避免污染 @ihui/types)
// =============================================================================

/** Assistant 工具定义(OpenAI 兼容:code_interpreter / retrieval / function) */
interface AssistantTool {
  type: string
  function?: {
    name: string
    description?: string
    parameters?: Record<string, unknown>
  }
}

/** OpenAI Assistant 对象 */
interface Assistant {
  id: string
  object: 'assistant'
  created_at: number
  name: string | null
  description: string | null
  model: string
  instructions: string | null
  tools: AssistantTool[]
  metadata: Record<string, string> | null
  /** 内部字段:所有者用户 id(不返回给客户端,见 toAssistantResponse) */
  userId: string
}

/** OpenAI Thread 对象 */
interface Thread {
  id: string
  object: 'thread'
  created_at: number
  metadata: Record<string, string> | null
  userId: string
}

/** Message 内容块(OpenAI v2 仅支持 text 类型) */
interface MessageContent {
  type: 'text'
  text: { value: string; annotations: unknown[] }
}

/** OpenAI Thread Message 对象 */
interface ThreadMessage {
  id: string
  object: 'thread.message'
  created_at: number
  thread_id: string
  role: 'user' | 'assistant'
  content: MessageContent[]
  assistant_id: string | null
  run_id: string | null
  metadata: Record<string, string> | null
}

type RunStatus = 'queued' | 'in_progress' | 'completed' | 'failed' | 'cancelled' | 'expired'

/** Run 用量统计 */
interface RunUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

/** OpenAI Run 对象 */
interface Run {
  id: string
  object: 'thread.run'
  created_at: number
  thread_id: string
  status: RunStatus
  assistant_id: string
  model: string
  instructions: string | null
  tools: AssistantTool[]
  metadata: Record<string, string> | null
  started_at: number | null
  completed_at: number | null
  failed_at: number | null
  usage: RunUsage | null
  /** 内部字段:所有者用户 id */
  userId: string
}

/** Run Step 详情(message_creation / tool_calls) */
interface RunStepDetails {
  type: 'message_creation' | 'tool_calls'
  message_creation?: { message_id: string }
  tool_calls?: unknown[]
}

/** OpenAI Run Step 对象 */
interface RunStep {
  id: string
  object: 'thread.run.step'
  created_at: number
  run_id: string
  assistant_id: string
  thread_id: string
  type: 'message_creation' | 'tool_calls'
  status: 'in_progress' | 'completed' | 'failed'
  step_details: RunStepDetails
  last_error: { code: string; message: string } | null
}

/** OpenAI 列表响应外壳(游标分页由 utils/cursor-page 产出,这里只描述信封形状) */
interface ListEnvelope<T> {
  object: 'list'
  data: T[]
  first_id: string | null
  last_id: string | null
  has_more: boolean
  /** 仅 `page_format=cursor` 时出现;旧模式下这个键根本不在响应里 */
  next_cursor?: string
}

// =============================================================================
// 常量
// =============================================================================

/** Redis TTL:90 天(秒) */
const TTL_SECONDS = 90 * 24 * 60 * 60

/** 列表分页默认 limit */
const DEFAULT_LIMIT = 20

/** 列表分页最大 limit */
const MAX_LIMIT = 100

/**
 * 自带业务键(O10c)边界:1-128 字符,字符集**白名单式**收窄到 `[A-Za-z0-9_.-]`。
 * - 空白、控制字符、零宽字符(U+200B/200C/200D/2060)一律进不来:它们能被 JSON 原样带进来,
 *   却会在 Redis 里造出两个肉眼无法区分、实际不同的键,也会在下次 URL 拼接时被百分号编码
 *   改形。入口判 400 比事后对不上账便宜得多。
 * - 长度按 UTF-16 码元计;params schema 复用同一条 pattern,不另立 `maxLength`,
 *   免得 Ajv 与 zod 两套口径(与 `run-refs/:ref` 一致)。
 * - 刻意**不含** `:`:`run_ext:<userId>:<external_id>` 的分隔符不可能出现在键体里,
 *   否则 `b:c` 与 `c` 这类形状会让命名空间产生歧义。
 */
const EXTERNAL_ID_MAX = 128
const EXTERNAL_ID_PATTERN = `^[A-Za-z0-9_.-]{1,${EXTERNAL_ID_MAX}}$`

// =============================================================================
// Zod schemas(请求体校验)
// =============================================================================

const toolSchema = z.object({
  type: z.string().min(1),
  function: z
    .object({
      name: z.string().min(1),
      description: z.string().optional(),
      parameters: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
})

const metadataSchema = z.record(z.string(), z.string()).nullable().default(null)

const createAssistantSchema = z.object({
  model: z.string().min(1),
  name: z.string().max(256).nullable().default(null),
  description: z.string().nullable().default(null),
  instructions: z.string().nullable().default(null),
  tools: z.array(toolSchema).optional().default([]),
  metadata: metadataSchema,
})

const updateAssistantSchema = z.object({
  model: z.string().min(1).optional(),
  name: z.string().max(256).nullable().optional(),
  description: z.string().nullable().optional(),
  instructions: z.string().nullable().optional(),
  tools: z.array(toolSchema).optional(),
  metadata: z.record(z.string(), z.string()).nullable().optional(),
})

const createThreadSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.literal('user'),
        content: z.string(),
      }),
    )
    .optional(),
  metadata: metadataSchema,
})

const updateThreadSchema = z.object({
  metadata: z.record(z.string(), z.string()).nullable().optional(),
})

const createMessageSchema = z.object({
  role: z.literal('user'),
  content: z.string(),
  metadata: metadataSchema,
})

/**
 * 自带业务键的 zod 版判据(与路由 params schema 共用 `EXTERNAL_ID_PATTERN` 一条真相)。
 * 边界说明见上方常量段。
 */
const externalIdSchema = z
  .string()
  .regex(
    new RegExp(EXTERNAL_ID_PATTERN),
    `external_id must be 1-${EXTERNAL_ID_MAX} chars of [A-Za-z0-9_.-]`,
  )

const createRunSchema = z.object({
  assistant_id: z.string().min(1),
  model: z.string().min(1).optional(),
  instructions: z.string().optional(),
  metadata: metadataSchema,
  // O10c:调用方自带业务键(可选)。登记后即可凭它反查本 run,不需要先存 IHUI 发的句柄。
  external_id: externalIdSchema.optional(),
})

const updateRunSchema = z.object({
  metadata: z.record(z.string(), z.string()).nullable().optional(),
})

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).optional().default(DEFAULT_LIMIT),
  after: z.string().optional(),
})

/**
 * 列表族分页的对外契约(OpenAPI query 参数)。刻意只声明类型与说明,**不设**
 * `minimum`/`maximum`/`default`/`enum`:那些约束会由 Ajv 抢先返回 400,把旧模式
 * `limit=500` 的响应体从 `{code,message}` 换成 Fastify 的 `{statusCode,error}`,
 * 老客户端看到的字节就变了。边界仍由 `listQuerySchema`(旧)/`clampLimit`(新)把关。
 * 每次调用返回新对象,避免同一 schema 引用被多路由共享时编译器就地补关键字。
 */
function listPageQuerySchema(): Record<string, unknown> {
  return {
    type: 'object',
    properties: {
      limit: {
        type: 'string',
        description: `每页条数(1-${MAX_LIMIT},默认 ${DEFAULT_LIMIT});page_format=cursor 时越界夹紧,省略则越界 400`,
      },
      after: {
        type: 'string',
        description: '分页锚点:旧模式传上一页 last_id;page_format=cursor 时传 next_cursor 返回的不透明游标',
      },
      page_format: {
        type: 'string',
        description: "传 'cursor' 启用不透明游标分页,响应追加 next_cursor;省略即既有 limit/after 语义",
      },
    },
  }
}

// =============================================================================
// 分页参数解析(O10b:不透明游标与既有 limit/after 并存)
// =============================================================================

/** 列表分页解析结果:`ok:false` 一律由调用方转 400。 */
type PageRead =
  { ok: true; request: PageRequest; cursorMode: boolean } | { ok: false; message: string }

/**
 * 读一页的分页参数。两条来路刻意分开:
 * - **默认(旧)**:原样跑 `listQuerySchema`,`limit` 越界照旧 400,响应不加键 ——
 *   这是回归底线,任何"顺手统一一下"的改动都会改掉老客户端看到的字节。
 * - **`page_format=cursor`(新)**:走 `readCursorPageRequest`,`limit` 改为夹紧,
 *   响应末尾追加 `next_cursor`。
 * 两条路都会把 `after` 交给 `resolveAfter`:游标串必须解得开(解不开宁可 400,
 * 绝不静默从头再翻一遍),裸 id 则原样透传,与今天完全一致。
 */
function readPage(query: Record<string, unknown>, binding: CursorBinding): PageRead {
  const secret = config.JWT_SECRET
  if (wantsCursorPageFormat(query)) {
    const parsed = readCursorPageRequest({
      query,
      binding,
      secret,
      limits: { def: DEFAULT_LIMIT, max: MAX_LIMIT },
    })
    return parsed.ok
      ? { ok: true, request: parsed.request, cursorMode: true }
      : { ok: false, message: parsed.message }
  }
  const legacy = listQuerySchema.safeParse(query)
  if (!legacy.success) return { ok: false, message: legacy.error.issues[0]?.message ?? '参数错误' }
  const after = resolveAfter(legacy.data.after, binding, secret)
  if (!after.ok) return { ok: false, message: after.message }
  return {
    ok: true,
    request: { limit: legacy.data.limit, afterId: after.afterId },
    cursorMode: false,
  }
}

/**
 * 一页列表 → OpenAI list 信封(assistants / messages / runs / steps 四条路由共用)。
 * 键序与改造前逐字一致:object → data → first_id → last_id → has_more;
 * `next_cursor` 只在游标模式下追加在末尾,旧模式一个键都不加。
 * 游标模式下锚点找不到(记录已随 TTL 蒸发 / 游标跨列表复用)判 400 —— 宁可让客户端
 * 从头翻,也不许悄悄把第一页再吐一遍;旧模式保留它既有的"找不到就从头"行为。
 */
function listPage<Internal extends { id: string }, Public>(input: {
  items: readonly Internal[]
  page: PageRead
  binding: CursorBinding
  map: (item: Internal) => Public
}): { ok: true; body: ListEnvelope<Public> } | { ok: false; message: string } {
  if (!input.page.ok) return { ok: false, message: input.page.message }
  const outcome = pageOf(input.items, {
    request: input.page.request,
    idOf: (item) => item.id,
    hasMoreRule: 'beyond-page',
    cursor: input.page.cursorMode ? { binding: input.binding, secret: config.JWT_SECRET } : null,
  })
  if (input.page.cursorMode && outcome.anchor_missing) {
    return { ok: false, message: 'Invalid or expired cursor' }
  }
  return {
    ok: true,
    body: withNextCursor(
      {
        object: 'list' as const,
        data: outcome.data.map(input.map),
        first_id: outcome.first_id,
        last_id: outcome.last_id,
        has_more: outcome.has_more,
      },
      outcome.next_cursor,
    ),
  }
}

// =============================================================================
// 对外 run 句柄(O10b:`irun_<ulid>` → 内部 runId)
// =============================================================================

/** 句柄前缀:与内部 `run_<uuid>` 肉眼可分,第三方拿到它也不需要知道内部 id 形态。 */
const RUN_REF_PREFIX = 'irun'

/** Crockford base32 字母表(ULID 用,剔除 I/L/O/U 以免手抄歧义)。 */
const ULID_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

/** 大端 5 bit 一切:6 字节 → 10 字符,10 字节 → 16 字符(余数左移补齐,同 ULID 规约)。 */
function encodeCrockford(bytes: Uint8Array): string {
  let out = ''
  let buffer = 0
  let bits = 0
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte
    bits += 8
    while (bits >= 5) {
      bits -= 5
      out += ULID_ALPHABET.charAt((buffer >>> bits) & 31)
    }
  }
  if (bits > 0) out += ULID_ALPHABET.charAt((buffer << (5 - bits)) & 31)
  return out
}

/** 标准 ULID:48 bit 毫秒时间戳(可排序)+ 80 bit 随机 = 26 字符。 */
function newUlid(nowMs: number): string {
  const time = new Uint8Array(6)
  let rest = Math.max(0, Math.floor(nowMs))
  for (let i = 5; i >= 0; i -= 1) {
    time[i] = rest & 0xff
    rest = Math.floor(rest / 256)
  }
  return encodeCrockford(time) + encodeCrockford(randomBytes(10))
}

/** 生成对外句柄。 */
function newRunRef(nowMs: number): string {
  return `${RUN_REF_PREFIX}_${newUlid(nowMs)}`
}

/**
 * 句柄 → 内部 runId 的单向映射;TTL 与 run 记录一致(句柄不能比它指的东西活得更久)。
 *
 * O17b-⑤:同时写**反向**键 `run_ref_of:<runId>`,否则"客户端没接住创建响应"时,
 * 单条详情(`GET /threads/:threadId/runs/:id`)无从回显句柄 —— 正向键只能由句柄查 runId,
 * 不能由 runId 查句柄。反向键与正向键同 TTL、同一次写入落地,不引入第二条生命周期。
 */
async function storeRunRef(redis: Redis, runRef: string, runId: string): Promise<void> {
  await redis.set(`run_ref:${runRef}`, runId, 'EX', TTL_SECONDS)
  await redis.set(`run_ref_of:${runId}`, runRef, 'EX', TTL_SECONDS)
}

/** 句柄反查内部 runId;不存在(或已随 run 一起过期)返回 null。 */
async function resolveRunRef(redis: Redis, runRef: string): Promise<string | null> {
  return await redis.get(`run_ref:${runRef}`)
}

/**
 * 内部 runId → 对外句柄(反向读)。本 O17b-⑤ 之前落库的 run 没有反向键,
 * 此时**返回 null 而不是现造一个**:句柄必须真能反查到对象,否则回显出去就是假地址。
 */
async function readRunRefOf(redis: Redis, runId: string): Promise<string | null> {
  const ref = await redis.get(`run_ref_of:${runId}`)
  return ref ? ref : null
}

// =============================================================================
// 自带业务键反查(O10c:第三方自己的 external_id → 内部 runId)
//
// 与上面 `irun_` 句柄是**两条独立通道**:各占各的 Redis 前缀(`run_ref:` / `run_ext:`),
// 键形态互不重叠,谁也不会覆盖谁 —— 第三方既可以凭 IHUI 发的句柄查,也可以凭自己库里
// 的业务主键查,拿到的是同一个 run。
// 边界常量与 zod schema 在文件上方「常量 / Zod schemas」段(声明先于使用)。
// =============================================================================

/**
 * 业务键 → 内部 runId。**键名带 userId 前缀就是本条链路的归属边界**:反查永远只在
 * 调用方自己的命名空间里寻址,机器凭据 A 查不到 B 的 run —— 连"这个键存在吗"都探不出来
 * (两条路径回同一个 404 响应体)。TTL 与 run 记录一致,句柄不能比它指的东西活得更久。
 */
async function storeExternalRunId(
  redis: Redis,
  userId: string,
  externalId: string,
  runId: string,
): Promise<void> {
  await redis.set(`run_ext:${userId}:${externalId}`, runId, 'EX', TTL_SECONDS)
}

/** 按 (调用方 userId, 业务键) 反查内部 runId;不存在(或已随 run 过期)返回 null。 */
async function resolveExternalRunId(
  redis: Redis,
  userId: string,
  externalId: string,
): Promise<string | null> {
  return await redis.get(`run_ext:${userId}:${externalId}`)
}

// =============================================================================
// Redis 存储辅助函数
// =============================================================================

/** 存储助手 + 加入用户助手集合 */
async function storeAssistant(redis: Redis, assistant: Assistant): Promise<void> {
  const key = `assistant:${assistant.id}`
  await redis.set(key, JSON.stringify(assistant), 'EX', TTL_SECONDS)
  const setKey = `assistant:user:${assistant.userId}`
  await redis.sadd(setKey, assistant.id)
  await redis.expire(setKey, TTL_SECONDS)
}

/** 读取助手 */
async function getAssistant(redis: Redis, id: string): Promise<Assistant | null> {
  const raw = await redis.get(`assistant:${id}`)
  if (!raw) return null
  return JSON.parse(raw) as Assistant
}

/** 取用户全部助手(按 created_at 升序);分页交给 utils/cursor-page 的内核 */
async function collectAssistants(redis: Redis, userId: string): Promise<Assistant[]> {
  const setKey = `assistant:user:${userId}`
  const ids = await redis.smembers(setKey)
  const items: Assistant[] = []
  for (const id of ids) {
    const a = await getAssistant(redis, id)
    if (a) items.push(a)
  }
  items.sort((a, b) => a.created_at - b.created_at)
  return items
}

/** 存储线程 */
async function storeThread(redis: Redis, thread: Thread): Promise<void> {
  await redis.set(`thread:${thread.id}`, JSON.stringify(thread), 'EX', TTL_SECONDS)
}

/** 读取线程 */
async function getThread(redis: Redis, id: string): Promise<Thread | null> {
  const raw = await redis.get(`thread:${id}`)
  if (!raw) return null
  return JSON.parse(raw) as Thread
}

/** 追加消息到线程消息列表 + 存储消息体 */
async function storeMessage(redis: Redis, threadId: string, msg: ThreadMessage): Promise<void> {
  const listKey = `thread:${threadId}:msgs`
  const msgKey = `thread:${threadId}:msg:${msg.id}`
  await redis.rpush(listKey, msg.id)
  await redis.set(msgKey, JSON.stringify(msg), 'EX', TTL_SECONDS)
  await redis.expire(listKey, TTL_SECONDS)
}

/** 读取单条消息 */
async function getMessage(
  redis: Redis,
  threadId: string,
  msgId: string,
): Promise<ThreadMessage | null> {
  const raw = await redis.get(`thread:${threadId}:msg:${msgId}`)
  if (!raw) return null
  return JSON.parse(raw) as ThreadMessage
}

/** 取线程全部消息(写入顺序);分页交给 utils/cursor-page 的内核 */
async function collectMessages(redis: Redis, threadId: string): Promise<ThreadMessage[]> {
  const ids = await redis.lrange(`thread:${threadId}:msgs`, 0, -1)
  const items: ThreadMessage[] = []
  for (const id of ids) {
    const m = await getMessage(redis, threadId, id)
    if (m) items.push(m)
  }
  return items
}

/** 追加 run 到线程 run 列表 + 存储 run 体 */
async function storeRun(redis: Redis, run: Run): Promise<void> {
  const listKey = `thread:${run.thread_id}:runs`
  await redis.rpush(listKey, run.id)
  await redis.set(`run:${run.id}`, JSON.stringify(run), 'EX', TTL_SECONDS)
  await redis.expire(listKey, TTL_SECONDS)
}

/** 更新 run(覆盖写) */
async function updateRun(redis: Redis, run: Run): Promise<void> {
  await redis.set(`run:${run.id}`, JSON.stringify(run), 'EX', TTL_SECONDS)
}

/** 读取 run */
async function getRun(redis: Redis, id: string): Promise<Run | null> {
  const raw = await redis.get(`run:${id}`)
  if (!raw) return null
  return JSON.parse(raw) as Run
}

/** 取线程全部 run(写入顺序);分页交给 utils/cursor-page 的内核 */
async function collectRuns(redis: Redis, threadId: string): Promise<Run[]> {
  const ids = await redis.lrange(`thread:${threadId}:runs`, 0, -1)
  const items: Run[] = []
  for (const id of ids) {
    const r = await getRun(redis, id)
    if (r) items.push(r)
  }
  return items
}

/** 存储 run step */
async function storeRunStep(redis: Redis, step: RunStep): Promise<void> {
  const listKey = `run:${step.run_id}:steps`
  await redis.rpush(listKey, step.id)
  await redis.set(`run:${step.run_id}:step:${step.id}`, JSON.stringify(step), 'EX', TTL_SECONDS)
  await redis.expire(listKey, TTL_SECONDS)
}

/** 取 run 全部 step(写入顺序);分页交给 utils/cursor-page 的内核 */
async function collectRunSteps(redis: Redis, runId: string): Promise<RunStep[]> {
  const ids = await redis.lrange(`run:${runId}:steps`, 0, -1)
  const items: RunStep[] = []
  for (const id of ids) {
    const raw = await redis.get(`run:${runId}:step:${id}`)
    if (raw) items.push(JSON.parse(raw) as RunStep)
  }
  return items
}

// =============================================================================
// 响应裁剪(剥离内部 userId 字段,不暴露给客户端)
// =============================================================================

type AssistantResponse = Omit<Assistant, 'userId'>
type RunResponse = Omit<Run, 'userId'>

function toAssistantResponse(a: Assistant): AssistantResponse {
  const { userId: _userId, ...rest } = a
  return rest
}

function toRunResponse(r: Run): RunResponse {
  const { userId: _userId, ...rest } = r
  return rest
}

// =============================================================================
// 路由插件
// =============================================================================

const v1Assistants: FastifyPluginAsync = async (server) => {
  const redis = server.redis

  // ===========================================================================
  // 1. Assistants CRUD
  // ===========================================================================

  // POST /assistants — 创建助手
  server.post(
    '/assistants',
    {
      schema: {
        description: '创建 Assistant(OpenAI Assistants API v2 兼容)',
        tags: ['Assistants'],
        body: {
          type: 'object',
          properties: {
            model: { type: 'string' },
            name: { type: 'string', maxLength: 256 },
            description: { type: 'string' },
            instructions: { type: 'string' },
            tools: { type: 'array', items: { type: 'object' } },
            metadata: { type: 'object' },
          },
          required: ['model'],
        },
      },
      preHandler: [requireCapability('assistants:write')],
    },
    async (request, reply) => {
      const parsed = createAssistantSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const apiKey = request.apiKey
      if (!apiKey) return reply.status(401).send(error(401, 'API key authentication required'))
      const { model, name, description, instructions, tools, metadata } = parsed.data
      const now = Math.floor(Date.now() / 1000)
      const assistant: Assistant = {
        id: `asst_${randomUUID()}`,
        object: 'assistant',
        created_at: now,
        name: name ?? null,
        description: description ?? null,
        model,
        instructions: instructions ?? null,
        tools: tools ?? [],
        metadata: metadata ?? null,
        userId: apiKey.userId,
      }
      await storeAssistant(redis, assistant)
      return reply.send(toAssistantResponse(assistant))
    },
  )

  // GET /assistants/:id — 查询助手
  server.get(
    '/assistants/:id',
    { preHandler: [requireCapability('assistants:read')] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const apiKey = request.apiKey
      if (!apiKey) return reply.status(401).send(error(401, 'API key authentication required'))
      const assistant = await getAssistant(redis, id)
      if (!assistant || assistant.userId !== apiKey.userId) {
        return reply.status(404).send(error(404, 'Assistant not found'))
      }
      return reply.send(toAssistantResponse(assistant))
    },
  )

  // POST /assistants/:id — 修改助手
  server.post(
    '/assistants/:id',
    {
      schema: {
        description: '修改 Assistant(部分字段更新)',
        tags: ['Assistants'],
        body: {
          type: 'object',
          properties: {
            model: { type: 'string' },
            name: { type: ['string', 'null'] },
            description: { type: ['string', 'null'] },
            instructions: { type: ['string', 'null'] },
            tools: { type: 'array', items: { type: 'object' } },
            metadata: { type: ['object', 'null'] },
          },
        },
      },
      preHandler: [requireCapability('assistants:write')],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const parsed = updateAssistantSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const apiKey = request.apiKey
      if (!apiKey) return reply.status(401).send(error(401, 'API key authentication required'))
      const existing = await getAssistant(redis, id)
      if (!existing || existing.userId !== apiKey.userId) {
        return reply.status(404).send(error(404, 'Assistant not found'))
      }
      const patch = parsed.data
      const updated: Assistant = {
        ...existing,
        model: patch.model ?? existing.model,
        name: patch.name !== undefined ? patch.name : existing.name,
        description: patch.description !== undefined ? patch.description : existing.description,
        instructions: patch.instructions !== undefined ? patch.instructions : existing.instructions,
        tools: patch.tools ?? existing.tools,
        metadata: patch.metadata !== undefined ? patch.metadata : existing.metadata,
      }
      await storeAssistant(redis, updated)
      return reply.send(toAssistantResponse(updated))
    },
  )

  // DELETE /assistants/:id — 删除助手
  server.delete(
    '/assistants/:id',
    { preHandler: [requireCapability('assistants:write')] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const apiKey = request.apiKey
      if (!apiKey) return reply.status(401).send(error(401, 'API key authentication required'))
      const existing = await getAssistant(redis, id)
      if (!existing || existing.userId !== apiKey.userId) {
        return reply.status(404).send(error(404, 'Assistant not found'))
      }
      const removedKeys = await redis.del(`assistant:${id}`)
      await redis.srem(`assistant:user:${apiKey.userId}`, id)
      return reply.send({
        id,
        object: 'assistant.deleted',
        deleted: removedKeys > 0,
      })
    },
  )

  // GET /assistants — 助手列表(分页:limit/after 旧契约 + page_format=cursor 新契约)
  server.get(
    '/assistants',
    {
      schema: {
        description: '列出助手(limit/after 分页,page_format=cursor 切不透明游标)',
        tags: ['Assistants'],
        querystring: listPageQuerySchema(),
      },
      preHandler: [requireCapability('assistants:read')],
    },
    async (request, reply) => {
      const apiKey = request.apiKey
      if (!apiKey) return reply.status(401).send(error(401, 'API key authentication required'))
      const binding: CursorBinding = {
        kind: CURSOR_KIND.assistants,
        ownerKey: `user:${apiKey.userId}`,
      }
      const page = readPage(request.query as Record<string, unknown>, binding)
      const items = await collectAssistants(redis, apiKey.userId)
      const result = listPage({ items, page, binding, map: toAssistantResponse })
      if (!result.ok) return reply.status(400).send(error(400, result.message))
      return reply.send(result.body)
    },
  )

  // ===========================================================================
  // 2. Threads CRUD
  // ===========================================================================

  // POST /threads — 创建线程(可选携带初始消息)
  server.post(
    '/threads',
    {
      schema: {
        description: '创建 Thread(可选携带初始消息)',
        tags: ['Threads'],
        body: {
          type: 'object',
          properties: {
            messages: {
              type: 'array',
              items: {
                type: 'object',
                properties: { role: { type: 'string' }, content: { type: 'string' } },
              },
            },
            metadata: { type: 'object' },
          },
        },
      },
      preHandler: [requireCapability('threads:write')],
    },
    async (request, reply) => {
      const parsed = createThreadSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const apiKey = request.apiKey
      if (!apiKey) return reply.status(401).send(error(401, 'API key authentication required'))
      const { messages, metadata } = parsed.data
      const now = Math.floor(Date.now() / 1000)
      const thread: Thread = {
        id: `thread_${randomUUID()}`,
        object: 'thread',
        created_at: now,
        metadata: metadata ?? null,
        userId: apiKey.userId,
      }
      await storeThread(redis, thread)
      // 追加初始消息(若有)
      if (messages) {
        for (const m of messages) {
          const msg: ThreadMessage = {
            id: `msg_${randomUUID()}`,
            object: 'thread.message',
            created_at: now,
            thread_id: thread.id,
            role: 'user',
            content: [{ type: 'text', text: { value: m.content, annotations: [] } }],
            assistant_id: null,
            run_id: null,
            metadata: null,
          }
          await storeMessage(redis, thread.id, msg)
        }
      }
      return reply.send(thread)
    },
  )

  // GET /threads/:id — 查询线程
  server.get(
    '/threads/:id',
    { preHandler: [requireCapability('threads:read')] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const apiKey = request.apiKey
      if (!apiKey) return reply.status(401).send(error(401, 'API key authentication required'))
      const thread = await getThread(redis, id)
      if (!thread || thread.userId !== apiKey.userId) {
        return reply.status(404).send(error(404, 'Thread not found'))
      }
      return reply.send(thread)
    },
  )

  // POST /threads/:id — 修改线程(更新 metadata)
  server.post(
    '/threads/:id',
    {
      schema: {
        description: '修改 Thread(更新 metadata)',
        tags: ['Threads'],
        body: {
          type: 'object',
          properties: { metadata: { type: ['object', 'null'] } },
        },
      },
      preHandler: [requireCapability('threads:write')],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const parsed = updateThreadSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const apiKey = request.apiKey
      if (!apiKey) return reply.status(401).send(error(401, 'API key authentication required'))
      const existing = await getThread(redis, id)
      if (!existing || existing.userId !== apiKey.userId) {
        return reply.status(404).send(error(404, 'Thread not found'))
      }
      const updated: Thread = {
        ...existing,
        metadata: parsed.data.metadata !== undefined ? parsed.data.metadata : existing.metadata,
      }
      await storeThread(redis, updated)
      return reply.send(updated)
    },
  )

  // DELETE /threads/:id — 删除线程
  server.delete(
    '/threads/:id',
    { preHandler: [requireCapability('threads:write')] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const apiKey = request.apiKey
      if (!apiKey) return reply.status(401).send(error(401, 'API key authentication required'))
      const existing = await getThread(redis, id)
      if (!existing || existing.userId !== apiKey.userId) {
        return reply.status(404).send(error(404, 'Thread not found'))
      }
      const removedKeys = await redis.del(`thread:${id}`)
      // 清理线程下的消息 + run 列表(尽力清理,不阻塞)
      const msgIds = await redis.lrange(`thread:${id}:msgs`, 0, -1)
      if (msgIds.length > 0) {
        await redis.del(msgIds.map((mid) => `thread:${id}:msg:${mid}`))
        await redis.del(`thread:${id}:msgs`)
      }
      const runIds = await redis.lrange(`thread:${id}:runs`, 0, -1)
      if (runIds.length > 0) {
        await redis.del(runIds.map((rid) => `run:${rid}`))
        await redis.del(`thread:${id}:runs`)
      }
      return reply.send({
        id,
        object: 'thread.deleted',
        deleted: removedKeys > 0,
      })
    },
  )

  // ===========================================================================
  // 3. Messages CRUD
  // ===========================================================================

  // POST /threads/:threadId/messages — 创建消息
  server.post(
    '/threads/:threadId/messages',
    {
      schema: {
        description: '向 Thread 追加消息',
        tags: ['Messages'],
        body: {
          type: 'object',
          properties: {
            role: { type: 'string', enum: ['user'] },
            content: { type: 'string' },
            metadata: { type: 'object' },
          },
          required: ['role', 'content'],
        },
      },
      preHandler: [requireCapability('threads:write')],
    },
    async (request, reply) => {
      const { threadId } = request.params as { threadId: string }
      const parsed = createMessageSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const apiKey = request.apiKey
      if (!apiKey) return reply.status(401).send(error(401, 'API key authentication required'))
      const thread = await getThread(redis, threadId)
      if (!thread || thread.userId !== apiKey.userId) {
        return reply.status(404).send(error(404, 'Thread not found'))
      }
      const { content, metadata } = parsed.data
      const msg: ThreadMessage = {
        id: `msg_${randomUUID()}`,
        object: 'thread.message',
        created_at: Math.floor(Date.now() / 1000),
        thread_id: threadId,
        role: 'user',
        content: [{ type: 'text', text: { value: content, annotations: [] } }],
        assistant_id: null,
        run_id: null,
        metadata: metadata ?? null,
      }
      await storeMessage(redis, threadId, msg)
      return reply.send(msg)
    },
  )

  // O3 收尾:threads/messages/runs 子族(此前只挂 requireApiKeyAuth,无 scope)
  //
  // 注意 addHook 的作用域(Fastify 5 实测,见 lib/route.js:392 在 preReady 里读 this[kHooks]):
  // 同一个封装上下文里**所有**路由都会被它罩住,与注册顺序无关。所以本文件里那些只写了
  // `preHandler: [requireCapability(...)]` 的 assistants / threads CRUD 也必须在这张表里有
  // 自己的条目 —— 否则命中的是"未登记路径默认拒绝"的 403 CAPABILITY_UNREGISTERED,
  // 文件头声明的 OpenAI 兼容面整体不可用(2026-09-20 修:这一族此前恒 403)。
  // 每条规则的 scope 与路由自身 requireCapability 的 scope 一字一样,不放宽任何权限。
  server.addHook(
    'preHandler',
    requireCapabilityRules([
      { methods: ['POST'], pattern: /^\/v1\/threads\/[^/]+\/runs\/[^/]+$/, scope: 'runs:write' },
      { methods: ['GET'], pattern: /^\/v1\/threads\/[^/]+\/runs(\/|$)/, scope: 'runs:read' },
      { methods: ['POST'], pattern: /^\/v1\/threads\/[^/]+\/runs$/, scope: 'runs:write' },
      { methods: ['POST'], pattern: /^\/v1\/threads\/[^/]+\/messages$/, scope: 'threads:write' },
      { pattern: /^\/v1\/threads\/[^/]+\/messages(\/|$)/, scope: 'threads:read' },
      { methods: ['GET'], pattern: /^\/v1\/assistants$/, scope: 'assistants:read' },
      { methods: ['POST'], pattern: /^\/v1\/assistants$/, scope: 'assistants:write' },
      { methods: ['GET'], pattern: /^\/v1\/assistants\/[^/]+$/, scope: 'assistants:read' },
      {
        methods: ['POST', 'DELETE'],
        pattern: /^\/v1\/assistants\/[^/]+$/,
        scope: 'assistants:write',
      },
      { methods: ['POST'], pattern: /^\/v1\/threads$/, scope: 'threads:write' },
      { methods: ['GET'], pattern: /^\/v1\/threads\/[^/]+$/, scope: 'threads:read' },
      { methods: ['POST', 'DELETE'], pattern: /^\/v1\/threads\/[^/]+$/, scope: 'threads:write' },
      // O10b:对外 run 句柄查询。刻意复用 runs:read —— 它是"读一个 run 的状态"这件事
      // 唯一的能力声明,换个新 scope 只会让第三方多要一个权限位却拿不到任何新数据。
      { methods: ['GET'], pattern: /^\/v1\/run-refs\/[^/]+$/, scope: 'runs:read' },
      // O10c:自带业务键反查。同上,复用 runs:read,不新增权限位。必须排在上面那条
      // 通用 runs 规则之外单独登记 —— 通用规则要求 `threads/<一段>/runs`,而本路径的
      // `runs` 就在第二段,匹配不上,漏登记即 403 CAPABILITY_UNREGISTERED。
      {
        methods: ['GET'],
        pattern: /^\/v1\/threads\/runs\/by-external-id\/[^/]+$/,
        scope: 'runs:read',
      },
    ]),
  )

  // GET /threads/:threadId/messages/:id — 查询单条消息
  server.get(
    '/threads/:threadId/messages/:id',
    { preHandler: [requireApiKeyAuth] },
    async (request, reply) => {
      const { threadId, id } = request.params as { threadId: string; id: string }
      const apiKey = request.apiKey
      if (!apiKey) return reply.status(401).send(error(401, 'API key authentication required'))
      const thread = await getThread(redis, threadId)
      if (!thread || thread.userId !== apiKey.userId) {
        return reply.status(404).send(error(404, 'Thread not found'))
      }
      const msg = await getMessage(redis, threadId, id)
      if (!msg) return reply.status(404).send(error(404, 'Message not found'))
      return reply.send(msg)
    },
  )

  // GET /threads/:threadId/messages — 消息列表(分页,游标绑定到本线程)
  server.get(
    '/threads/:threadId/messages',
    {
      schema: {
        description: '列出线程消息(写入顺序;limit/after 分页,page_format=cursor 切不透明游标)',
        tags: ['Messages'],
        querystring: listPageQuerySchema(),
      },
      preHandler: [requireApiKeyAuth],
    },
    async (request, reply) => {
      const { threadId } = request.params as { threadId: string }
      const apiKey = request.apiKey
      if (!apiKey) return reply.status(401).send(error(401, 'API key authentication required'))
      const thread = await getThread(redis, threadId)
      if (!thread || thread.userId !== apiKey.userId) {
        return reply.status(404).send(error(404, 'Thread not found'))
      }
      const binding: CursorBinding = {
        kind: CURSOR_KIND.threadMessages,
        ownerKey: `user:${apiKey.userId}:thread:${threadId}`,
      }
      const page = readPage(request.query as Record<string, unknown>, binding)
      const items = await collectMessages(redis, threadId)
      const result = listPage({ items, page, binding, map: (m) => m })
      if (!result.ok) return reply.status(400).send(error(400, result.message))
      return reply.send(result.body)
    },
  )

  // ===========================================================================
  // 4. Runs CRUD
  // ===========================================================================

  // POST /threads/:threadId/runs — 启动 run(同步执行:queued → in_progress → completed/failed)
  server.post(
    '/threads/:threadId/runs',
    {
      schema: {
        description: '启动 Run(同步执行,内部调用 ai-service /api/llm/complete)',
        tags: ['Runs'],
        body: {
          type: 'object',
          properties: {
            assistant_id: { type: 'string' },
            model: { type: 'string' },
            instructions: { type: 'string' },
            metadata: { type: 'object' },
            external_id: {
              type: 'string',
              description: `可选:调用方自带业务键(1-${EXTERNAL_ID_MAX} 字符 [A-Za-z0-9_.-]),登记后可用 GET /v1/threads/runs/by-external-id/{external_id} 反查本 run`,
            },
          },
          required: ['assistant_id'],
        },
      },
      preHandler: [requireApiKeyAuth],
    },
    async (request, reply) => {
      const { threadId } = request.params as { threadId: string }
      const parsed = createRunSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const apiKey = request.apiKey
      if (!apiKey) return reply.status(401).send(error(401, 'API key authentication required'))

      // 校验线程归属
      const thread = await getThread(redis, threadId)
      if (!thread || thread.userId !== apiKey.userId) {
        return reply.status(404).send(error(404, 'Thread not found'))
      }
      // 校验助手归属
      const assistant = await getAssistant(redis, parsed.data.assistant_id)
      if (!assistant || assistant.userId !== apiKey.userId) {
        return reply.status(404).send(error(404, 'Assistant not found'))
      }

      const { model, instructions, metadata } = parsed.data
      const nowMs = Date.now()
      // 格②(2026-09-26):nowMs 仍是墙钟 epoch(created_at / runRef 在用,语义不得改),
      // 耗时另起单调钟表测量
      const sw = startStopwatch()
      const nowSec = Math.floor(nowMs / 1000)
      const runId = `run_${randomUUID()}`
      const effectiveModel = model ?? assistant.model
      const effectiveInstructions = instructions ?? assistant.instructions

      // 初始状态:queued → in_progress
      const run: Run = {
        id: runId,
        object: 'thread.run',
        created_at: nowSec,
        thread_id: threadId,
        status: 'in_progress',
        assistant_id: assistant.id,
        model: effectiveModel,
        instructions: effectiveInstructions,
        tools: assistant.tools,
        metadata: metadata ?? null,
        started_at: nowSec,
        completed_at: null,
        failed_at: null,
        usage: null,
        userId: apiKey.userId,
      }
      await storeRun(redis, run)
      // 对外句柄:紧随 run 落盘写入,即使下面 ai-service 调用失败,句柄也已能查到这条
      // (状态为 failed 的)run —— 第三方拿到的永远是"能用的地址",不是一串内部 uuid。
      const runRef = newRunRef(nowMs)
      await storeRunRef(redis, runRef, runId)
      // O10c:自带业务键 —— 紧随句柄登记,同样落在 ai-service 调用**之前**,理由与上面
      // 一句(失败也要能反查到这条 run)。未传则一个键都不写,不产生空映射。
      // 同一业务键重复登记为后写覆盖(反查语义是"最近一次",不是历史表)。
      const externalId = parsed.data.external_id
      if (externalId) {
        await storeExternalRunId(redis, apiKey.userId, externalId, runId)
      }

      // O17b-⑤:失败分支也要把句柄交回去。判据只有一条 —— **run 记录是否已落库**:
      // 上面的 storeRun / storeRunRef / storeExternalRunId 全部发生在打 ai-service **之前**,
      // 所以能走到下面三个失败分支(上游 5xx、上游 error 标记、抛异常)时 run 一定存在,
      // 句柄反查得到它(状态为 failed)。反之,先于 storeRun 的 400/401/403/404
      // (参数校验、归属校验、助手不存在)**不带任何句柄** —— 造一个指向不存在对象的
      // 假句柄,比不交句柄更坏。
      const runHandles = (): { run_ref: string; external_id?: string } => ({
        run_ref: runRef,
        ...(externalId ? { external_id: externalId } : {}),
      })

      // 收集线程消息构建 ai-service 请求(仍取写入顺序前 MAX_LIMIT 条,与改造前逐字一致)
      const collected = await collectMessages(redis, threadId)
      const aiMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = []
      if (effectiveInstructions) {
        aiMessages.push({ role: 'system', content: effectiveInstructions })
      }
      for (const m of collected.slice(0, MAX_LIMIT)) {
        const textValue = m.content[0]?.text.value ?? ''
        aiMessages.push({ role: m.role, content: textValue })
      }

      try {
        const resp = await aiServiceFetch(request, '/api/llm/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: aiMessages, model: effectiveModel }),
        })

        if (!resp.ok) {
          const errText = await resp.text().catch(() => '')
          const failedRun: Run = {
            ...run,
            status: 'failed',
            failed_at: Math.floor(Date.now() / 1000),
          }
          await updateRun(redis, failedRun)
          return reply
            .status(502)
            .send({
              ...error(502, `AI service unavailable (${resp.status}): ${errText.slice(0, 200)}`),
              ...runHandles(),
            })
        }

        const data = (await resp.json()) as {
          content?: string
          usage?: { total_tokens?: number; prompt_tokens?: number; completion_tokens?: number }
          error?: boolean
          error_message?: string
        }

        if (data.error) {
          const failedRun: Run = {
            ...run,
            status: 'failed',
            failed_at: Math.floor(Date.now() / 1000),
          }
          await updateRun(redis, failedRun)
          return reply
            .status(502)
            .send({ ...error(502, data.error_message ?? 'AI service error'), ...runHandles() })
        }

        const promptTokens = data.usage?.prompt_tokens ?? 0
        const completionTokens = data.usage?.completion_tokens ?? 0
        const totalTokens = data.usage?.total_tokens ?? promptTokens + completionTokens

        // 创建 assistant 回复消息
        const assistantMsg: ThreadMessage = {
          id: `msg_${randomUUID()}`,
          object: 'thread.message',
          created_at: Math.floor(Date.now() / 1000),
          thread_id: threadId,
          role: 'assistant',
          content: [{ type: 'text', text: { value: data.content ?? '', annotations: [] } }],
          assistant_id: assistant.id,
          run_id: runId,
          metadata: null,
        }
        await storeMessage(redis, threadId, assistantMsg)

        // 创建 message_creation run step
        const step: RunStep = {
          id: `step_${randomUUID()}`,
          object: 'thread.run.step',
          created_at: Math.floor(Date.now() / 1000),
          run_id: runId,
          assistant_id: assistant.id,
          thread_id: threadId,
          type: 'message_creation',
          status: 'completed',
          step_details: {
            type: 'message_creation',
            message_creation: { message_id: assistantMsg.id },
          },
          last_error: null,
        }
        await storeRunStep(redis, step)

        // 完成 run
        const completedRun: Run = {
          ...run,
          status: 'completed',
          completed_at: Math.floor(Date.now() / 1000),
          usage: {
            prompt_tokens: promptTokens,
            completion_tokens: completionTokens,
            total_tokens: totalTokens,
          },
        }
        await updateRun(redis, completedRun)

        // 计费(异步,不阻塞响应)
        const latency = persistableLatency(sw.stop())
        void recordCall({
          apiKeyId: apiKey.id,
          userId: apiKey.userId,
          model: effectiveModel,
          prompt: aiMessages.map((m) => m.content).join('\n'),
          response: data.content ?? '',
          promptTokens,
          completionTokens,
          totalTokens,
          latencyMs: latency.latencyMs,
          status: 'success',
          providerCode: modelToProviderCode(effectiveModel),
          clientIp: request.ip,
          httpStatus: resp.status,
          metadata: {
            endpoint: 'assistants.run',
            threadId,
            runId,
            assistantId: assistant.id,
            latencyTrusted: latency.latencyTrusted,
          },
        }).catch((e) => {
          console.error('[v1/runs] recordCall FAIL', e?.message || e)
        })

        // 只增字段:`run_ref` 追加在既有字段之后,老客户端按 key 取值,键序与键集都不受影响
        return reply.send({ ...toRunResponse(completedRun), run_ref: runRef })
      } catch (e) {
        const failedRun: Run = {
          ...run,
          status: 'failed',
          failed_at: Math.floor(Date.now() / 1000),
        }
        await updateRun(redis, failedRun)
        return reply
          .status(503)
          .send({
            ...error(503, (e as Error).message || 'AI service unavailable'),
            ...runHandles(),
          })
      }
    },
  )

  // GET /threads/:threadId/runs/:id — 查询 run 状态
  server.get(
    '/threads/:threadId/runs/:id',
    { preHandler: [requireApiKeyAuth] },
    async (request, reply) => {
      const { threadId, id } = request.params as { threadId: string; id: string }
      const apiKey = request.apiKey
      if (!apiKey) return reply.status(401).send(error(401, 'API key authentication required'))
      const thread = await getThread(redis, threadId)
      if (!thread || thread.userId !== apiKey.userId) {
        return reply.status(404).send(error(404, 'Thread not found'))
      }
      const run = await getRun(redis, id)
      if (!run || run.thread_id !== threadId) {
        return reply.status(404).send(error(404, 'Run not found'))
      }
      // O17b-⑤:单条详情回显对外句柄(反向键 `run_ref_of:<runId>`)。这样即使第三方
      // 漏接了创建响应,只要还留着 runId 就能重新拿到句柄。**没有反向键就不回显**
      // (本改动之前落库的 run),绝不现造一个查不到的句柄。
      const ref = await readRunRefOf(redis, id)
      return reply.send({ ...toRunResponse(run), ...(ref ? { run_ref: ref } : {}) })
    },
  )

  // POST /threads/:threadId/runs/:id — 修改 run(更新 metadata)
  server.post(
    '/threads/:threadId/runs/:id',
    {
      schema: {
        description: '修改 Run(更新 metadata)',
        tags: ['Runs'],
        body: {
          type: 'object',
          properties: { metadata: { type: ['object', 'null'] } },
        },
      },
      preHandler: [requireApiKeyAuth],
    },
    async (request, reply) => {
      const { threadId, id } = request.params as { threadId: string; id: string }
      const parsed = updateRunSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const apiKey = request.apiKey
      if (!apiKey) return reply.status(401).send(error(401, 'API key authentication required'))
      const thread = await getThread(redis, threadId)
      if (!thread || thread.userId !== apiKey.userId) {
        return reply.status(404).send(error(404, 'Thread not found'))
      }
      const existing = await getRun(redis, id)
      if (!existing || existing.thread_id !== threadId) {
        return reply.status(404).send(error(404, 'Run not found'))
      }
      const updated: Run = {
        ...existing,
        metadata: parsed.data.metadata !== undefined ? parsed.data.metadata : existing.metadata,
      }
      await updateRun(redis, updated)
      return reply.send(toRunResponse(updated))
    },
  )

  // GET /threads/:threadId/runs — run 列表(分页,游标绑定到本线程)
  server.get(
    '/threads/:threadId/runs',
    {
      schema: {
        description: '列出线程 Run(写入顺序;limit/after 分页,page_format=cursor 切不透明游标)',
        tags: ['Runs'],
        querystring: listPageQuerySchema(),
      },
      preHandler: [requireApiKeyAuth],
    },
    async (request, reply) => {
      const { threadId } = request.params as { threadId: string }
      const apiKey = request.apiKey
      if (!apiKey) return reply.status(401).send(error(401, 'API key authentication required'))
      const thread = await getThread(redis, threadId)
      if (!thread || thread.userId !== apiKey.userId) {
        return reply.status(404).send(error(404, 'Thread not found'))
      }
      const binding: CursorBinding = {
        kind: CURSOR_KIND.threadRuns,
        ownerKey: `user:${apiKey.userId}:thread:${threadId}`,
      }
      const page = readPage(request.query as Record<string, unknown>, binding)
      const items = await collectRuns(redis, threadId)
      // 刻意**不**在列表里回显 `run_ref`(O17b-⑤):句柄的反向索引是
      // `run_ref_of:<runId>` 一个键一条值,列表要回显就得对整页(最多 MAX_LIMIT 条)
      // 各打一次 Redis 往返 —— 为了"字段对称"付 N 次 RTT 不值当,而列表本来的用途是
      // "看这一轮跑成什么样",runId 已经够用。需要句柄的场景都有零成本出口:
      // 创建响应(含失败分支)带 run_ref、单条详情带 run_ref、自带业务键反查带 run_ref。
      const result = listPage({ items, page, binding, map: toRunResponse })
      if (!result.ok) return reply.status(400).send(error(400, result.message))
      return reply.send(result.body)
    },
  )

  // ===========================================================================
  // 5. Run Steps
  // ===========================================================================

  // GET /threads/:threadId/runs/:runId/steps — 查询 run 步骤
  server.get(
    '/threads/:threadId/runs/:runId/steps',
    {
      schema: {
        description: '列出 Run 步骤(limit/after 分页,page_format=cursor 切不透明游标)',
        tags: ['Run Steps'],
        querystring: listPageQuerySchema(),
      },
      preHandler: [requireApiKeyAuth],
    },
    async (request, reply) => {
      const { threadId, runId } = request.params as { threadId: string; runId: string }
      const apiKey = request.apiKey
      if (!apiKey) return reply.status(401).send(error(401, 'API key authentication required'))
      const thread = await getThread(redis, threadId)
      if (!thread || thread.userId !== apiKey.userId) {
        return reply.status(404).send(error(404, 'Thread not found'))
      }
      const run = await getRun(redis, runId)
      if (!run || run.thread_id !== threadId) {
        return reply.status(404).send(error(404, 'Run not found'))
      }
      const binding: CursorBinding = {
        kind: CURSOR_KIND.runSteps,
        ownerKey: `user:${apiKey.userId}:thread:${threadId}:run:${runId}`,
      }
      const page = readPage(request.query as Record<string, unknown>, binding)
      const items = await collectRunSteps(redis, runId)
      const result = listPage({ items, page, binding, map: (s) => s })
      if (!result.ok) return reply.status(400).send(error(400, result.message))
      return reply.send(result.body)
    },
  )

  // ===========================================================================
  // 6. Run 句柄(O10b:对外只暴露 irun_<ulid>,内部 runId 不再需要第三方持有)
  // ===========================================================================

  // GET /run-refs/:ref — 用对外句柄查 run 状态(不必知道 threadId;归属仍按 key 判定)
  server.get(
    '/run-refs/:ref',
    {
      schema: {
        description: '用对外句柄 run_ref 查询 Run 状态(等价于按 runId 查询,无需 threadId)',
        tags: ['Runs'],
        params: {
          type: 'object',
          properties: {
            ref: { type: 'string', pattern: `^${RUN_REF_PREFIX}_[0-9A-HJKMNP-TV-Z]{26}$` },
          },
          required: ['ref'],
        },
      },
      preHandler: [requireApiKeyAuth],
    },
    async (request, reply) => {
      const { ref } = request.params as { ref: string }
      const apiKey = request.apiKey
      if (!apiKey) return reply.status(401).send(error(401, 'API key authentication required'))
      const runId = await resolveRunRef(redis, ref)
      if (!runId) return reply.status(404).send(error(404, 'Run reference not found'))
      // 复用既有的 run 读取逻辑(getRun),归属判据也与本文件其余端点同一条:
      // run.userId 必须等于本 key 的 userId。句柄不属于你时同样回 404 —— 回 403 等于
      // 告诉对方"这个句柄确实存在",26 字符的 ULID 空间不该靠错误码来收窄。
      const run = await getRun(redis, runId)
      if (!run || run.userId !== apiKey.userId) {
        return reply.status(404).send(error(404, 'Run reference not found'))
      }
      return reply.send({ ...toRunResponse(run), run_ref: ref })
    },
  )

  // GET /threads/runs/by-external-id/:externalId — 用调用方自带业务键反查 run(O10c)
  //
  // 与 run-refs 的差别只在"键是谁生的":`irun_*` 由 IHUI 发,第三方必须存下响应里的
  // 句柄;`external_id` 由第三方自带,它只要在自己库里记住这个业务主键就能找回 run。
  server.get(
    '/threads/runs/by-external-id/:externalId',
    {
      schema: {
        description: '用调用方自带业务键 external_id 查询 Run 状态(仅能查到本 key 名下登记的键)',
        tags: ['Runs'],
        params: {
          type: 'object',
          properties: {
            externalId: { type: 'string', pattern: EXTERNAL_ID_PATTERN },
          },
          required: ['externalId'],
        },
      },
      preHandler: [requireApiKeyAuth],
    },
    async (request, reply) => {
      const { externalId } = request.params as { externalId: string }
      const apiKey = request.apiKey
      if (!apiKey) return reply.status(401).send(error(401, 'API key authentication required'))
      // 归属边界就在这一行:寻址用的键名带调用方自己的 userId,别人名下同名业务键根本
      // 不在这个命名空间里 —— 不存在"猜到键就能读别人 run"的通路。
      const runId = await resolveExternalRunId(redis, apiKey.userId, externalId)
      if (!runId) return reply.status(404).send(error(404, 'Run reference not found'))
      // 双保险:run 体上的 userId 再校一次(与本文件其余端点同一条判据)。回 404 而非 403,
      // 与 run-refs 同口径 —— 回 403 等于承认"这个业务键存在"。
      const run = await getRun(redis, runId)
      if (!run || run.userId !== apiKey.userId) {
        return reply.status(404).send(error(404, 'Run reference not found'))
      }
      // 只增字段:`external_id` 回显调用方自己带来的键;`userId` 依旧不外泄。
      // O17b-⑤:同为"单条 run 详情",一并回显 irun_ 句柄(与按 runId 查询同一条读逻辑,
      // 两处取值必须一致,否则第三方拿到两个互相矛盾的地址)。
      const ref = await readRunRefOf(redis, runId)
      return reply.send({
        ...toRunResponse(run),
        external_id: externalId,
        ...(ref ? { run_ref: ref } : {}),
      })
    },
  )
}

export default v1Assistants
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
