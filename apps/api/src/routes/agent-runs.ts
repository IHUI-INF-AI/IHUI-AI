/**
 * O10 对外 run 语义面(新建路由,**由主会话单点接线**,见交付报告的接线行)。
 *
 * 三条路由承载四件事里的三件:
 *   POST `/`               ① 幂等 run 创建(`Idempotency-Key` 必填,重放返回同一个 run)
 *   GET  `/list`           ④ 游标分页规范(复用 utils/cursor-page,信封走本仓 {code,message,data})
 *   GET  `/resolve/:handle` ② 外部 run 句柄解析(对外只有句柄,内部 runId / session_id 不出去)
 * ③ 通用幂等层在 `services/run-idempotency.ts`(与 run 解耦,别的复用可直接 import)。
 *
 * 鉴权面(AGENTS §5「鉴权面公开化必须显式列举」):
 *   本面**没有任何公开路径** —— 三条全部要求登录,故无需公开白名单,也无需静态段排除表。
 *   刻意**不**注册 `GET /:id` 这种顶层参数路由:它会连同将来新增的静态子路由一起被
 *   当成"游客详情"放行(`/agents/health` 那类 fail-open 事故就是这么来的)。句柄解析因此
 *   挂在显式静态段 `/resolve/:handle` 下。要公开任何一条,必须显式加进
 *   `AGENT_RUN_PUBLIC_ROUTES` 并同步一张静态段排除表,不得放宽成兜底正则。
 *
 * 零迁移:run 记录落在既有 Redis(通过注入的 KV 端口),TTL 自然回收;
 * 要长期留存/审计再提表(DDL 已写进交付报告,由主会话决定是否派给 database 属主)。
 */
import { randomUUID } from 'node:crypto'
import type { FastifyPluginAsync, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { AppError } from '../errors/AppError.js'
import { authenticate } from '../plugins/auth.js'
import { error, success, type ApiSuccess } from '../utils/response.js'
import {
  MIN_CLIENT_KEY_LEN,
  readIdempotencyKey,
  requestFingerprint,
  runIdempotently,
  type IdempotencyKv,
} from '../services/run-idempotency.js'
import {
  RUN_HANDLE_REJECT_STATUS,
  issueRunHandle,
  parseRunHandle,
} from '../services/run-handle.js'
import {
  PAGE_LIMITS,
  buildCursorPage,
  cursorBinding,
  readPageQuery,
  type PageLimits,
} from '../services/cursor-pagination.js'

/** 本面的公开路径清单 —— **空的**,三条路由全部要求登录。新增公开面必须显式登记到这里。 */
export const AGENT_RUN_PUBLIC_ROUTES: readonly string[] = []

export const IDEMPOTENCY_KEY_REQUIRED_CODE = 'IDEMPOTENCY_KEY_REQUIRED'
export const IDEMPOTENCY_IN_PROGRESS_CODE = 'IDEMPOTENCY_IN_PROGRESS'
export const IDEMPOTENCY_KEY_REUSED_CODE = 'IDEMPOTENCY_KEY_REUSED'
export const IDEMPOTENCY_STORE_UNAVAILABLE_CODE = 'IDEMPOTENCY_STORE_UNAVAILABLE'
export const INVALID_RUN_HANDLE_CODE = 'INVALID_RUN_HANDLE'
export const RUN_NOT_FOUND_CODE = 'RUN_NOT_FOUND'
export const INVALID_CURSOR_CODE = 'INVALID_CURSOR'

/** 幂等槽位的命名空间:与开放面响应缓存(`plugins/open-idempotency.ts`)的键空间互不相交。 */
export const RUN_CREATE_NAMESPACE = 'agent-run.create'
/** run 记录与索引的存活时间;句柄有效期不短于它,否则句柄会指向已被回收的记录。 */
export const RUN_RECORD_TTL_MS = 24 * 3600 * 1000
/** 幂等窗口比记录 TTL 短一档:重放窗口内记录必然还在,反之则让位给 TTL 自然回收。 */
export const RUN_IDEMPOTENCY_TTL_MS = 24 * 3600 * 1000
/** 每个 owner 保留的 run id 索引上限(游标列表没有 total,深翻不划算,超出即截断最旧)。 */
export const MAX_INDEXED_RUNS = 1_000

export type AgentRunStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'

export interface AgentRunRecord {
  /** 内部 runId:uuidv4,熵足够,永不作为对外标识外泄。 */
  id: string
  ownerUserId: number
  agentId: string
  input: string
  status: AgentRunStatus
  createdAtMs: number
  updatedAtMs: number
  /**
   * 内部 IHUI session_id 的槽位。**只**存活于服务端记录,任何对外结构都不携带它 ——
   * O10② 的口径正是"对外不依赖内部 session_id"。当前实现不接入引擎,恒为 null。
   */
  internalSessionId: string | null
}

export interface PublicAgentRunView {
  run_ref: string
  agent_id: string
  status: AgentRunStatus
  /** epoch 秒(与 `/v1` 既有对外时间戳口径一致) */
  created_at: number
  updated_at: number
  input: string
}

export interface PublicAgentRunPage {
  items: PublicAgentRunView[]
  has_more: boolean
  next_cursor: string | null
}

/** 记录 → 对外视图。内部 runId 与 session_id 都不出去,对外标识只有签名句柄。 */
export function toPublicRunView(
  record: AgentRunRecord,
  ownerKey: string,
  secret: string,
): PublicAgentRunView {
  return {
    run_ref: issueRunHandle({ runId: record.id, ownerKey, secret }),
    agent_id: record.agentId,
    status: record.status,
    created_at: Math.floor(record.createdAtMs / 1000),
    updated_at: Math.floor(record.updatedAtMs / 1000),
    input: record.input,
  }
}

/** run 记录存储端口(Redis 形状;测试注入假实现即可零网络)。 */
export interface AgentRunStore {
  put(record: AgentRunRecord): Promise<void>
  get(runId: string): Promise<AgentRunRecord | null>
  /** 写入顺序(createdAtMs 升序,同刻按 id)—— 游标的锚点语义要求这个顺序稳定。 */
  listByOwner(ownerUserId: number): Promise<AgentRunRecord[]>
}

function recordKey(runId: string): string {
  return `agent_run:${runId}`
}
function indexKey(ownerUserId: number): string {
  return `agent_run_index:user:${ownerUserId}`
}

function parseRecord(raw: string): AgentRunRecord | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  const shape = z.object({
    id: z.string().min(1),
    ownerUserId: z.number().int(),
    agentId: z.string().min(1),
    input: z.string(),
    status: z.enum(['queued', 'running', 'succeeded', 'failed', 'cancelled']),
    createdAtMs: z.number().int(),
    updatedAtMs: z.number().int(),
    internalSessionId: z.string().nullable(),
  })
  const result = shape.safeParse(parsed)
  return result.success ? result.data : null
}

/** 把 run 记录存进既有 KV(默认由 ioredis 适配),TTL 到期自然回收,零迁移。 */
export function createKvAgentRunStore(
  kv: IdempotencyKv,
  ttlMs: number = RUN_RECORD_TTL_MS,
): AgentRunStore {
  const readIdList = async (ownerUserId: number): Promise<string[]> => {
    const raw = await kv.get(indexKey(ownerUserId))
    if (raw === null) return []
    try {
      const parsed: unknown = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === 'string')
      }
    } catch {
      return []
    }
    return []
  }
  const get = async (runId: string): Promise<AgentRunRecord | null> => {
    const raw = await kv.get(recordKey(runId))
    if (raw === null) return null
    return parseRecord(raw)
  }
  return {
    async put(record) {
      await kv.setWithTtl(recordKey(record.id), JSON.stringify(record), ttlMs)
      const ids = await readIdList(record.ownerUserId)
      if (!ids.includes(record.id)) ids.push(record.id)
      const trimmed = ids.length > MAX_INDEXED_RUNS ? ids.slice(ids.length - MAX_INDEXED_RUNS) : ids
      await kv.setWithTtl(indexKey(record.ownerUserId), JSON.stringify(trimmed), ttlMs)
    },
    get,
    async listByOwner(ownerUserId) {
      const ids = await readIdList(ownerUserId)
      const records: AgentRunRecord[] = []
      for (const id of ids) {
        const record = await get(id)
        if (record !== null && record.ownerUserId === ownerUserId) records.push(record)
      }
      return records.sort((a, b) => a.createdAtMs - b.createdAtMs || (a.id < b.id ? -1 : 1))
    },
  }
}

export interface AgentRunRoutesDeps {
  /** 幂等槽位 + run 记录共用的 KV 端口(生产: `createKvFromRedis(server.redis)`)。 */
  kv: IdempotencyKv
  /** 句柄与游标的签名密钥。缺失即拒启动:没有它,句柄可以被人自造。 */
  handleSecret: string
  store?: AgentRunStore
  pageLimits?: PageLimits
  newRunId?: () => string
  newSessionId?: () => string
  nowMs?: () => number
}

const createSchema = z.object({
  agent_id: z.string().min(1).max(64),
  input: z.string().min(1).max(8_000),
})

const listQuerySchema = z.object({
  limit: z.union([z.string(), z.number()]).optional(),
  after: z.string().max(512).optional(),
})

const resolveParamsSchema = z.object({ handle: z.string().min(1).max(512) })

function requireOwner(request: FastifyRequest): number {
  // `request.userId` 的声明形状在跨包演进中可能是 number 或 string,这里两种都归一,
  // 关键是:拿不到可信身份时必须给 401,而不是继续走下去变成 NaN 键或 500 ——
  // 那正是 AGENTS §5 记过的"fail-open 崩在鉴权层后面"。
  const raw = request.userId
  const userId = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : Number.NaN
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new AppError('请先登录', 401, 'UNAUTHORIZED')
  }
  return userId
}

export function createAgentRunRoutes(deps: AgentRunRoutesDeps): FastifyPluginAsync {
  if (!deps.handleSecret) {
    throw new Error('agent-runs 需要 handleSecret(句柄/游标签名密钥),否则句柄可被自造')
  }
  const store = deps.store ?? createKvAgentRunStore(deps.kv)
  const limits = deps.pageLimits ?? { ...PAGE_LIMITS }
  const nowMs = deps.nowMs ?? ((): number => Date.now())

  const routes: FastifyPluginAsync = async (app) => {
    app.addHook('preHandler', async (request) => {
      await authenticate(request)
    })

    app.post('/', async (request, reply) => {
      const body = createSchema.safeParse(request.body)
      if (!body.success) {
        return reply
          .code(400)
          .send({ ...error(400, body.error.issues[0]?.message ?? 'invalid body'), errorCode: 'VALIDATION_FAILED' })
      }
      const ownerUserId = requireOwner(request)
      const ownerKey = `user:${ownerUserId}`
      const clientKey = readIdempotencyKey(request.headers)
      if (clientKey === null) {
        // 明确策略:这个面上幂等键是**必填**。重放代价是真实算力与计费,
        // 而可选语义(带才生效)属开放面那套(`plugins/open-idempotency.ts`),两者刻意不同。
        return reply.code(400).send({
          ...error(400, `创建 run 必须携带 Idempotency-Key(至少 ${MIN_CLIENT_KEY_LEN} 字符)`),
          errorCode: IDEMPOTENCY_KEY_REQUIRED_CODE,
        })
      }

      const result = await runIdempotently<AgentRunRecord>({
        kv: deps.kv,
        namespace: RUN_CREATE_NAMESPACE,
        ownerKey,
        clientKey,
        fingerprint: requestFingerprint({ agent_id: body.data.agent_id, input: body.data.input }),
        ttlMs: RUN_IDEMPOTENCY_TTL_MS,
        degrade: 'closed',
        now: nowMs,
        create: async () => {
          const ts = nowMs()
          const record: AgentRunRecord = {
            id: deps.newRunId?.() ?? `run_${randomUUID()}`,
            ownerUserId,
            agentId: body.data.agent_id,
            input: body.data.input,
            status: 'queued',
            createdAtMs: ts,
            updatedAtMs: ts,
            internalSessionId: deps.newSessionId?.() ?? null,
          }
          await store.put(record)
          return record
        },
      })

      if (!result.ok) {
        if (result.reason === 'store-unavailable') {
          return reply.code(503).send({
            ...error(503, '幂等存储不可用,请稍后重试'),
            errorCode: IDEMPOTENCY_STORE_UNAVAILABLE_CODE,
          })
        }
        const reused = result.reason === 'key-reused'
        return reply.code(409).send({
          ...error(
            409,
            reused
              ? '相同 Idempotency-Key 已用于另一个请求体'
              : '相同 Idempotency-Key 的请求正在处理中,请稍后重试',
          ),
          errorCode: reused ? IDEMPOTENCY_KEY_REUSED_CODE : IDEMPOTENCY_IN_PROGRESS_CODE,
        })
      }

      return reply
        .code(result.replayed ? 200 : 201)
        .send(success(toPublicRunView(result.value, ownerKey, deps.handleSecret)))
    })

    app.get('/list', async (request, reply) => {
      const ownerUserId = requireOwner(request)
      const ownerKey = `user:${ownerUserId}`
      const query = listQuerySchema.safeParse(request.query ?? {})
      if (!query.success) {
        return reply
          .code(400)
          .send({ ...error(400, 'invalid query'), errorCode: INVALID_CURSOR_CODE })
      }
      const binding = cursorBinding(ownerKey)
      const parsed = readPageQuery({
        query: query.data as Record<string, unknown>,
        binding,
        secret: deps.handleSecret,
        limits,
      })
      if (!parsed.ok) {
        return reply.code(400).send({ ...error(400, parsed.message), errorCode: INVALID_CURSOR_CODE })
      }
      const items = await store.listByOwner(ownerUserId)
      const page = buildCursorPage<AgentRunRecord>({
        items,
        request: parsed.request,
        idOf: (record) => record.id,
        binding,
        secret: deps.handleSecret,
      })
      if (page.anchorMissing) {
        // 锚点找不到:内核会从头取,那等于把翻页翻成重复数据 —— 新面直接判 400。
        return reply
          .code(400)
          .send({ ...error(400, 'Invalid or expired cursor'), errorCode: INVALID_CURSOR_CODE })
      }
      const data = page.envelope.data
      const body: ApiSuccess<PublicAgentRunPage> = success<PublicAgentRunPage>({
        items: data.items.map((record) => toPublicRunView(record, ownerKey, deps.handleSecret)),
        has_more: data.has_more,
        next_cursor: data.next_cursor,
      })
      return reply.send(body)
    })

    app.get('/resolve/:handle', async (request, reply) => {
      const ownerUserId = requireOwner(request)
      const ownerKey = `user:${ownerUserId}`
      const params = resolveParamsSchema.safeParse(request.params)
      if (!params.success) {
        return reply
          .code(400)
          .send({ ...error(400, 'invalid run handle'), errorCode: INVALID_RUN_HANDLE_CODE })
      }
      const parsed = parseRunHandle(params.data.handle, { ownerKey, secret: deps.handleSecret })
      if (!parsed.ok) {
        const code = RUN_HANDLE_REJECT_STATUS[parsed.reason]
        // 404 = 别人的合法句柄(不承认存在,免得它变成存在性探针);400 = 格式/签名/过期。
        const notFound = code === 404
        return reply.code(code).send({
          ...error(code, notFound ? 'run 不存在' : 'run 句柄非法或已过期'),
          errorCode: notFound ? RUN_NOT_FOUND_CODE : INVALID_RUN_HANDLE_CODE,
        })
      }
      const record = await store.get(parsed.runId)
      // 记录可能已被 TTL 回收,或身份与句柄归属被换过(理论上签不过,仍兜一层)。
      if (record === null || record.ownerUserId !== ownerUserId) {
        return reply.code(404).send({ ...error(404, 'run 不存在'), errorCode: RUN_NOT_FOUND_CODE })
      }
      return reply.send(success(toPublicRunView(record, ownerKey, deps.handleSecret)))
    })
  }
  return routes
}
