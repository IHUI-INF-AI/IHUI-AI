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
 * 4. Redis 不可用时 fail-open（放行），避免支付回调因基础设施故障被丢弃。
 * 5. 集成到 payment-gateway.ts 的微信/支付宝回调端点。
 */
const KEY_PREFIX = 'idempotency:payment:'
const DEFAULT_TTL_SEC = 86400

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
  ): Promise<IdempotencyResult> {
    const key = buildKey(paymentId, idemKey)
    const now = Math.floor(Date.now() / 1000)
    try {
      // SET NX: 仅当 key 不存在时写入 processing，原子获取锁
      const wasSet = await server.redis.set(
        key,
        JSON.stringify({ status: 'processing', ts: now } satisfies IdemRecord),
        'EX',
        ttlSec,
        'NX',
      )
      if (wasSet === 'OK') {
        return { status: 'new', retryAfterMs: 0 }
      }
      // key 已存在，读取当前状态
      const raw = await server.redis.get(key)
      if (!raw) {
        // SET 与 GET 之间过期，递归重试获取
        return acquire(paymentId, idemKey, ttlSec)
      }
      const parsed = JSON.parse(raw) as IdemRecord
      if (parsed.status === 'processing') {
        return { status: 'processing', retryAfterMs: 5000 }
      }
      if (parsed.status === 'completed') {
        return { status: 'completed', cachedResult: parsed.result, retryAfterMs: 0 }
      }
      // 未知 / failed 状态：覆盖为 processing，允许重新处理
      await server.redis.set(
        key,
        JSON.stringify({ status: 'processing', ts: now } satisfies IdemRecord),
        'EX',
        ttlSec,
      )
      return { status: 'new', retryAfterMs: 0 }
    } catch (e) {
      server.log.warn({ err: e }, 'payment idempotency redis failed, fail-open')
      return { status: 'new', retryAfterMs: 0 }
    }
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
