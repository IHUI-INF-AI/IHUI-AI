import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import fp from 'fastify-plugin'
import { normalizeHeader } from '../utils/http-normalize.js'

/**
 * 支付幂等性插件。
 *
 * 迁移自旧架构 server/app/utils/payment_idempotency.py。
 *
 * 设计要点：
 * 1. Redis SET NX EX 原子获取锁：首次请求置 processing，重复请求命中缓存结果。
 * 2. 状态机：new → processing → completed；失败释放锁允许平台重试。
 * 3. TTL 默认 24h（支付争议周期长）。
 * 4. Redis 不可用时 fail-closed（返回 processing 让平台重试），避免并发请求被放行。
 *    2026-08-02 P0 修复(B4)：原 fail-open 放行并发请求可导致重复扣款。
 * 5. 集成到 payment-gateway.ts 的微信/支付宝回调端点。
 */
const KEY_PREFIX = 'idempotency:payment:'
const DEFAULT_TTL_SEC = 86400
// P1-9 修复(2026-08-06):processing 锁的短 TTL。
// 原实现 processing 与 completed 共用 24h TTL —— acquire 成功后若 handler
// 异常(未调用 complete/fail),锁停留 processing 至 24h,期间支付平台重试全部
// 被 409 拒绝,回调永远无法恢复。现在 processing 10 分钟自动过期,
// 平台下次重试可重新获取锁处理;completed 缓存仍保持 24h(支付争议周期)。
const PROCESSING_TTL_SEC = 600

export type IdempotencyStatus = 'new' | 'processing' | 'completed'

export interface IdempotencyResult {
  status: IdempotencyStatus
  cachedResult?: unknown
  /** processing 状态下建议的重试等待毫秒 */
  retryAfterMs: number
}

interface IdemRecord {
  status: string
  ts: number
  result?: unknown
}

declare module 'fastify' {
  interface FastifyInstance {
    paymentIdempotency: {
      /** 获取幂等锁。new=首次可处理，processing=他方处理中，completed=返回缓存结果 */
      acquire(paymentId: string, idemKey: string, ttlSec?: number): Promise<IdempotencyResult>
      /** 标记处理成功并缓存结果，后续重复请求直接返回该结果 */
      complete(paymentId: string, idemKey: string, result?: unknown, ttlSec?: number): Promise<void>
      /** 标记处理失败并释放锁，允许支付平台下次回调重试 */
      fail(paymentId: string, idemKey: string, errorMsg?: string): Promise<void>
      /** preHandler：按 Idempotency-Key 头做幂等校验，重复请求直接返回缓存结果 */
      preHandler(
        extract?: (req: FastifyRequest) => { paymentId: string; idemKey: string } | null,
      ): (request: FastifyRequest, reply: FastifyReply) => Promise<void>
    }
  }
}

const paymentIdempotencyPlugin: FastifyPluginAsync = async (server) => {
  const buildKey = (paymentId: string, idemKey: string) => `${KEY_PREFIX}${paymentId}:${idemKey}`

  async function acquire(
    paymentId: string,
    idemKey: string,
    ttlSec = DEFAULT_TTL_SEC,
    maxRetries = 3,
  ): Promise<IdempotencyResult> {
    const key = buildKey(paymentId, idemKey)
    let retries = 0
    while (retries < maxRetries) {
      const now = Math.floor(Date.now() / 1000)
      try {
        // P1-9:processing 锁用短 TTL(PROCESSING_TTL_SEC),handler 异常未 complete/fail 时
        // 锁自动过期,平台重试可重新获取;completed 由 complete() 单独写 24h 缓存。
        const lockTtlSec = Math.min(ttlSec, PROCESSING_TTL_SEC)
        // SET NX: 仅当 key 不存在时写入 processing，原子获取锁
        const wasSet = await server.redis.set(
          key,
          JSON.stringify({ status: 'processing', ts: now } satisfies IdemRecord),
          'EX',
          lockTtlSec,
          'NX',
        )
        if (wasSet === 'OK') {
          return { status: 'new', retryAfterMs: 0 }
        }
        // key 已存在，读取当前状态
        const raw = await server.redis.get(key)
        if (!raw) {
          // B5: SET 与 GET 之间 key 过期，重试(有上限)而非无限递归
          retries++
          continue
        }
        // P2-4 修复(2026-08-06):JSON.parse 加局部 try-catch —— 数据损坏(非 JSON)
        // 时按未知状态恢复(与 B6 同路径),不再让解析异常逃逸到外层 catch 被当成
        // "Redis 故障" 而 fail-closed 永久 409。
        let parsed: IdemRecord
        try {
          parsed = JSON.parse(raw) as IdemRecord
        } catch {
          server.log.warn(
            { paymentId, idemKey, raw },
            'payment idempotency corrupted record, recovering',
          )
          const recoveredCorrupt = await server.redis.set(
            key,
            JSON.stringify({ status: 'processing', ts: now } satisfies IdemRecord),
            'EX',
            Math.min(ttlSec, PROCESSING_TTL_SEC),
            'NX',
          )
          if (recoveredCorrupt === 'OK') return { status: 'new', retryAfterMs: 0 }
          return { status: 'processing', retryAfterMs: 1000 }
        }
        if (parsed.status === 'processing') {
          return { status: 'processing', retryAfterMs: 5000 }
        }
        if (parsed.status === 'completed') {
          return { status: 'completed', cachedResult: parsed.result, retryAfterMs: 0 }
        }
        // B6: 未知 / failed 状态恢复用 SET NX(原子)，两个并发请求只有一个能获取锁
        const recovered = await server.redis.set(
          key,
          JSON.stringify({ status: 'processing', ts: now } satisfies IdemRecord),
          'EX',
          lockTtlSec,
          'NX',
        )
        if (recovered === 'OK') {
          return { status: 'new', retryAfterMs: 0 }
        }
        // 另一个并发请求已获取锁，返回 processing
        return { status: 'processing', retryAfterMs: 1000 }
      } catch (e) {
        // B4: Redis 故障时 fail-closed，让支付平台重试，而非放行并发请求
        server.log.error({ err: e }, 'payment idempotency redis failed, fail-closed')
        return { status: 'processing', retryAfterMs: 5000 }
      }
    }
    // B5: 重试上限耗尽，返回 processing 让支付平台稍后重试
    return { status: 'processing', retryAfterMs: 1000 }
  }

  async function complete(
    paymentId: string,
    idemKey: string,
    result?: unknown,
    ttlSec = DEFAULT_TTL_SEC,
  ): Promise<void> {
    const key = buildKey(paymentId, idemKey)
    try {
      await server.redis.set(
        key,
        JSON.stringify({
          status: 'completed',
          ts: Math.floor(Date.now() / 1000),
          result,
        } satisfies IdemRecord),
        'EX',
        ttlSec,
      )
    } catch (e) {
      server.log.warn({ err: e }, 'payment idempotency complete failed')
    }
  }

  async function fail(paymentId: string, idemKey: string, errorMsg?: string): Promise<void> {
    // 释放 processing 锁，允许支付平台下次回调重试
    const key = buildKey(paymentId, idemKey)
    try {
      await server.redis.del(key)
    } catch {
      /* ignore */
    }
    server.log.warn(
      { paymentId, idemKey, errorMsg },
      'payment processing failed, lock released for retry',
    )
  }

  /** 默认提取：Idempotency-Key 头 + query.outTradeNo/out_trade_no（归一化 + 长度限制） */
  function defaultExtract(req: FastifyRequest): { paymentId: string; idemKey: string } | null {
    const idemKey = normalizeHeader(req.headers['idempotency-key'])
    if (!idemKey || idemKey.length > 256) return null
    const q = req.query as Record<string, unknown>
    const rawTradeNo = (q.outTradeNo as string) ?? (q.out_trade_no as string) ?? ''
    const outTradeNo = typeof rawTradeNo === 'string' ? rawTradeNo.trim().slice(0, 128) : ''
    if (!outTradeNo) return null
    return { paymentId: outTradeNo, idemKey }
  }

  function preHandler(
    extract?: (req: FastifyRequest) => { paymentId: string; idemKey: string } | null,
  ) {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      const id = extract ? extract(request) : defaultExtract(request)
      if (!id) return // 无幂等键，放行
      const result = await acquire(id.paymentId, id.idemKey)
      if (result.status === 'completed') {
        reply.code(200).send({ code: 0, message: 'ok', data: result.cachedResult })
      } else if (result.status === 'processing') {
        reply.code(409).send({ code: 409, message: '请求处理中，请稍后重试' })
      }
      // new：放行，handler 完成后需显式调用 complete()
    }
  }

  server.decorate('paymentIdempotency', { acquire, complete, fail, preHandler })
}

export const paymentIdempotency = fp(paymentIdempotencyPlugin, {
  name: 'payment-idempotency',
  fastify: '5.x',
})
