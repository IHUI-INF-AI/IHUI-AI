// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-40 A 格:跨会话 ack 事实的**写侧端点**(POST /api/command-acks)。
 *
 * 把 `command_ack_facts`(迁移 20261026100000)的写面开出来。此前该表只有迁移与 schema,
 * 没有任何端点往里写事实 —— E 格(`assertCommandAckFactAlive`)的判据虽有,无事实可判。
 *
 * 鉴权面(AGENTS §5「鉴权面公开化必须显式列举」):本面**没有任何公开路径**,无需公开白名单。
 * 身份只从承载层(authenticate 注入的 `request.userId`)显式入参取,不取请求体里任何
 * 客户端可整写的归属字段 —— `owner_key` 由服务端从令牌主体拼出,不进主键(表设计如此),
 * 读侧必须按它过滤。
 *
 * 幂等语义(A 格):`recordCommandAckFact` 走复合主键 `onConflictDoNothing` ——
 * 同坐标同指纹重发 = replayed(先过 E 存活,损坏即硬错);同坐标换请求体 = 409 key-reused。
 *
 * **跨存储语义(KV 与 PG 不能共享事务,票面点名)**:本端点写两个存储 ——
 *   ① 先落 **PG 事实**(真相源,跨会话/跨进程重启仍可回放),提交成功即不可逆;
 *   ② 后写 **KV 镜像**(进程重放缓存,键走 `slotKeyOf` 同源坐标,值与内核 CompletedSlot
 *      同形,`parseSlot` 可直接读回)。
 * 两者**不在同一事务里**(也不可能在:KV 无事务)。KV 侧失败**不回滚** PG 事实:
 * PG 是事实的真相源,KV 只是加速层,丢了由 PG 事实兜底;响应如实带 `kv_mirrored:false`
 * 供调用方打点,不静默。用例钉死:KV 抛错 ⇒ 响应仍 201、PG 行仍在。
 */
import type { FastifyPluginAsync, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { AppError } from '../errors/AppError.js'
import { authenticate } from '../plugins/auth.js'
import { error, success } from '../utils/response.js'
import { requestFingerprint, slotKeyOf, type IdempotencyKv } from '../services/run-idempotency.js'
import {
  COMMAND_ACK_FACT_NOT_ALIVE_CODE,
  COMMAND_ACK_IN_PROGRESS_CODE,
  COMMAND_ACK_KEY_REUSED_CODE,
  CommandAckFactNotAliveError,
  assertCommandAckFactAlive,
  createPgCommandAckFactStore,
  recordCommandAckFact,
  type CommandAckFactStore,
} from '../services/command-ack-facts.js'
import { db } from '../db/index.js'
import type { CommandAckFact } from '@ihui/database'

/** KV 镜像槽位的命名空间:与 `agent-run.create`、开放面响应缓存互不相交(键空间分段隔离)。 */
export const COMMAND_ACK_KV_NAMESPACE = 'command-ack'
/** KV 镜像的存活时间:进程重放缓存,短于事实表保留期(表由 expires_at 单独管)。 */
export const COMMAND_ACK_KV_TTL_MS = 24 * 3600 * 1000
/** 客户端可选保留期上限(秒):事实表行不设 TTL 默认值,给个上限防误传天文数字。 */
export const COMMAND_ACK_TTL_MAX_SECONDS = 90 * 24 * 3600

const ackSchema = z.object({
  /** 父会话作用域(上游 `v4_command_fact` 主键的 `child:<parent>:<cmd>` 前段)。 */
  parent_session_id: z.string().min(1).max(256),
  /** 源命令 id(后段)。与父会话一起构成事实主键,同 id 不同会话互不覆盖。 */
  source_command_id: z.string().min(1).max(256),
  /**
   * 回放载荷。**缺省 = `processing`**(已抢槽、载荷未定);带了(含 null 以外的任意 jsonb)
   * = `completed`。显式传 `null` 违反载侧 CHECK(completed 必须 payload 非空),在入参层就拒。
   */
  payload: z.unknown().optional(),
  /** 该事实引用的全部实体(规范化作用域串)—— E 格存活校验与局部性断言的共同来源。 */
  entity_refs: z.array(z.string().min(1).max(256)).max(64).default([]),
  /** 可选保留期(秒);缺省 NULL = 不自动过期(与迁移口径一致)。 */
  ttl_seconds: z.number().int().min(60).max(COMMAND_ACK_TTL_MAX_SECONDS).optional(),
})

/** 事实 → 对外视图。owner_key 不出去(归属由鉴权层保证,客户端不需要也不该看到拼接规则)。 */
export function toPublicCommandAckView(
  fact: CommandAckFact,
  extra: { replayed: boolean; kvMirrored: boolean },
): {
  parent_session_id: string
  source_command_id: string
  status: string
  fingerprint: string
  entity_refs: string[]
  expires_at: string | null
  replayed: boolean
  kv_mirrored: boolean
} {
  return {
    parent_session_id: fact.parentSessionId,
    source_command_id: fact.sourceCommandId,
    status: fact.status,
    fingerprint: fact.fingerprint,
    entity_refs: fact.entityRefs,
    expires_at: fact.expiresAt === null ? null : fact.expiresAt.toISOString(),
    replayed: extra.replayed,
    kv_mirrored: extra.kvMirrored,
  }
}

export interface CommandAckRoutesDeps {
  /**
   * 事实存储端口。缺省 = 生产 Postgres 实现;测试注入内存实现即可零网络、零真库。
   * 刻意不做"缺省懒构造"以外的旁路:生产注册行因此只传 kv 一项。
   */
  store?: CommandAckFactStore
  /** KV 端口(生产:`createKvFromRedis(server.redis)`)。缺省 = 不做镜像腿(纯 PG 面)。 */
  kv?: IdempotencyKv
  /** KV 镜像 TTL。 */
  kvTtlMs?: number
  /** 注入时钟。 */
  nowMs?: () => number
}

function requireOwner(request: FastifyRequest): number {
  // 与 routes/agent-runs.ts 的同名判据同款:拿不到可信身份必须 401,绝不带着 NaN 键往下走。
  const raw = request.userId
  const userId = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : Number.NaN
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new AppError('请先登录', 401, 'UNAUTHORIZED')
  }
  return userId
}

/** KV 镜像腿。键 = slotKeyOf 同源坐标(父段编进键,与 G-734① 同一单射纪律);失败如实回 false。 */
export function commandAckKvSlotKey(
  ownerKey: string,
  parentSessionId: string,
  sourceCommandId: string,
): string {
  return slotKeyOf({
    namespace: COMMAND_ACK_KV_NAMESPACE,
    ownerKey,
    parentKey: `session:${parentSessionId}`,
    clientKey: sourceCommandId,
  })
}

async function mirrorFactToKv(
  kv: IdempotencyKv,
  input: {
    ownerKey: string
    parentSessionId: string
    sourceCommandId: string
    fingerprint: string
    status: 'processing' | 'completed'
    payload: unknown
    ts: number
    ttlMs: number
  },
): Promise<boolean> {
  const key = commandAckKvSlotKey(input.ownerKey, input.parentSessionId, input.sourceCommandId)
  // 值形态与内核 CompletedSlot/ProcessingSlot 同形,parseSlot 可直接读回做进程重放。
  const value =
    input.status === 'completed'
      ? { status: input.status, fingerprint: input.fingerprint, ts: input.ts, value: input.payload }
      : { status: input.status, fingerprint: input.fingerprint, ts: input.ts }
  try {
    await kv.setWithTtl(key, JSON.stringify(value), input.ttlMs)
    return true
  } catch {
    // 跨存储语义:KV 侧失败不回滚 PG 事实,如实报告"没镜像住",不静默也不炸请求。
    return false
  }
}

export function createCommandAckRoutes(deps: CommandAckRoutesDeps): FastifyPluginAsync {
  const store = deps.store ?? createPgCommandAckFactStore(db)
  const kvTtlMs = deps.kvTtlMs ?? COMMAND_ACK_KV_TTL_MS
  const nowMs = deps.nowMs ?? ((): number => Date.now())

  const routes: FastifyPluginAsync = async (app) => {
    app.addHook('preHandler', async (request) => {
      await authenticate(request)
    })

    app.post('/', async (request, reply) => {
      const body = ackSchema.safeParse(request.body)
      if (!body.success) {
        return reply.code(400).send({
          ...error(400, body.error.issues[0]?.message ?? 'invalid body'),
          errorCode: 'VALIDATION_FAILED',
        })
      }
      // payload 显式 null 会违反载侧 CHECK(completed ⇒ payload 非空),入参层就拒,不落库碰运气。
      if (body.data.payload === null) {
        return reply.code(400).send({
          ...error(400, 'payload 不可为 null(completed 事实必须有载荷)'),
          errorCode: 'VALIDATION_FAILED',
        })
      }
      const ownerUserId = requireOwner(request)
      const ownerKey = `user:${ownerUserId}`
      const status = body.data.payload === undefined ? 'processing' : 'completed'
      const fingerprint = requestFingerprint({
        status,
        // 指纹只算服务端判定的坐标与内容;owner 不进指纹(同 owner 换坐标该挡的是坐标撞车)。
        payload: status === 'completed' ? body.data.payload : null,
        entity_refs: body.data.entity_refs,
      })
      const now = new Date(nowMs())
      const expiresAt =
        body.data.ttl_seconds === undefined
          ? null
          : new Date(now.getTime() + body.data.ttl_seconds * 1000)

      let fact: CommandAckFact
      let replayed: boolean
      try {
        const outcome = await recordCommandAckFact(
          store,
          {
            parentSessionId: body.data.parent_session_id,
            sourceCommandId: body.data.source_command_id,
            ownerKey,
            fingerprint,
            status,
            payload: status === 'completed' ? body.data.payload : null,
            entityRefs: body.data.entity_refs,
            expiresAt,
          },
          now,
        )
        if (outcome.outcome === 'key-reused') {
          return reply.code(409).send({
            ...error(409, '同一 (parent_session_id, source_command_id) 已用于另一个请求体'),
            errorCode: COMMAND_ACK_KEY_REUSED_CODE,
          })
        }
        if (outcome.outcome === 'in-progress') {
          return reply.code(409).send({
            ...error(409, '同坐标的命令事实仍在处理中,请稍后重试'),
            errorCode: COMMAND_ACK_IN_PROGRESS_CODE,
          })
        }
        fact = outcome.fact
        replayed = outcome.outcome === 'replayed'
      } catch (err) {
        // E 格硬错的单一翻译点:NotAlive 不是 4xx —— 它不是客户端的错,也不是可重试态
        // (重试即重建,正是"损坏即硬错"禁止的动作);500 + 可分辨码让客户端告警。
        if (err instanceof CommandAckFactNotAliveError) {
          throw new AppError(err.message, 500, COMMAND_ACK_FACT_NOT_ALIVE_CODE)
        }
        throw err
      }

      // 跨存储顺序:PG 事实已落(上面 recordCommandAckFact 已提交),KV 镜像在后 ——
      // 镜像失败不回滚事实,如实报告。首写与重放都镜像(重放补镜像 = KV 丢失后的自愈)。
      let kvMirrored = false
      if (deps.kv !== undefined) {
        kvMirrored = await mirrorFactToKv(deps.kv, {
          ownerKey,
          parentSessionId: fact.parentSessionId,
          sourceCommandId: fact.sourceCommandId,
          fingerprint: fact.fingerprint,
          status: fact.status === 'completed' ? 'completed' : 'processing',
          payload: fact.payload,
          ts: now.getTime(),
          ttlMs: kvTtlMs,
        })
      }

      return reply
        .code(replayed ? 200 : 201)
        .send(success(toPublicCommandAckView(fact, { replayed, kvMirrored })))
    })

    app.get('/alive/:parentSessionId/:sourceCommandId', async (request, reply) => {
      // E 格的查询面:跨会话引用方在运行时问"这条命令还活着吗"。查不到/未终态/损坏/过期
      // 一律 500 + COMMAND_ACK_FACT_NOT_ALIVE —— 失效方向是多抛一次定向硬错,不是"查不到当存在"。
      const ownerUserId = requireOwner(request)
      const params = z
        .object({
          parentSessionId: z.string().min(1).max(256),
          sourceCommandId: z.string().min(1).max(256),
        })
        .safeParse(request.params)
      if (!params.success) {
        return reply
          .code(400)
          .send({ ...error(400, 'invalid params'), errorCode: 'VALIDATION_FAILED' })
      }
      try {
        const fact = assertCommandAckFactAlive(
          await store.getFact(params.data.parentSessionId, params.data.sourceCommandId),
          {
            parentSessionId: params.data.parentSessionId,
            sourceCommandId: params.data.sourceCommandId,
          },
          new Date(nowMs()),
        )
        if (fact.ownerKey !== `user:${ownerUserId}`) {
          // 别人的事实按"不存在"回(不承认存在,免得它变成跨租户存在性探针)。
          throw new CommandAckFactNotAliveError(
            'missing',
            {
              parentSessionId: params.data.parentSessionId,
              sourceCommandId: params.data.sourceCommandId,
            },
            '归属不符',
          )
        }
        return reply.send(
          success({
            parent_session_id: fact.parentSessionId,
            source_command_id: fact.sourceCommandId,
            status: fact.status,
            alive: true,
          }),
        )
      } catch (err) {
        if (err instanceof CommandAckFactNotAliveError) {
          throw new AppError(err.message, 500, COMMAND_ACK_FACT_NOT_ALIVE_CODE)
        }
        throw err
      }
    })
  }
  return routes
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
