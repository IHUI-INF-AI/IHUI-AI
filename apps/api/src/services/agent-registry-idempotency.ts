// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 总管智能体注册表 · POST 幂等（R1 / §4.1）。
 *
 * 与开放面的 `plugins/open-idempotency.ts` 分开：那一层以 capability scope 为键，
 * 本组端点没有 capability 上下文；共用 Redis 前缀反而会串响应，所以独立命名空间。
 *
 * 契约：同 key 同 body 10 分钟内只执行一次；同 key 不同 body 返回 IDEMPOTENCY_CONFLICT；
 * 进行中返回 IDEMPOTENCY_IN_PROGRESS；Redis 不可用时 fail-open（放行 + 告警），
 * 不让 Redis 抖动把全部写端点打成 503。
 */

import { createHash } from 'node:crypto'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { AppError } from '../errors/AppError.js'

const KEY_PREFIX = 'agent-registry:idem'
const TTL_MS = 10 * 60 * 1000
const MIN_KEY_LEN = 8
const MAX_KEY_LEN = 128
const REDIS_DEADLINE_MS = 1000

interface CompletedRecord {
  status: 'completed'
  hash: string
  statusCode: number
  body: string
}

interface ProcessingRecord {
  status: 'processing'
  hash: string
}

type StoredRecord = CompletedRecord | ProcessingRecord

export interface IdempotentResponse {
  statusCode: number
  body: unknown
}

function fail(code: string, statusCode: number, message: string): never {
  throw new AppError(message, statusCode, code)
}

/** 稳定序列化：同一 body 的键序不同不能误判成“不同请求”。 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`
}

function bodyHash(request: FastifyRequest): string {
  return createHash('sha256')
    .update(stableStringify(request.body ?? null))
    .digest('hex')
}

function keyOf(userId: string, scope: string, clientKey: string): string {
  return `${KEY_PREFIX}:${userId}:${scope}:${clientKey}`
}

function clientKeyOf(request: FastifyRequest): string | null {
  const raw = request.headers['idempotency-key']
  if (typeof raw !== 'string') return null
  const key = raw.trim()
  if (key.length < MIN_KEY_LEN || key.length > MAX_KEY_LEN) {
    fail('IDEMPOTENCY_KEY_INVALID', 400, `Idempotency-Key 长度必须在 ${MIN_KEY_LEN}-${MAX_KEY_LEN}`)
  }
  if (!/^[A-Za-z0-9._:-]+$/.test(key)) {
    fail('IDEMPOTENCY_KEY_INVALID', 400, 'Idempotency-Key 含非法字符')
  }
  return key
}

async function withinDeadline<T>(
  task: Promise<T>,
): Promise<{ ok: true; value: T } | { ok: false; error: unknown }> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const value = await Promise.race([
      task,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error('idempotency redis deadline exceeded')),
          REDIS_DEADLINE_MS,
        )
      }),
    ])
    return { ok: true, value }
  } catch (error) {
    return { ok: false, error }
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}

function parseRecord(raw: string): StoredRecord | null {
  try {
    const parsed = JSON.parse(raw) as Partial<StoredRecord>
    if (parsed.status === 'processing' && typeof parsed.hash === 'string') {
      return { status: 'processing', hash: parsed.hash }
    }
    if (
      parsed.status === 'completed' &&
      typeof parsed.hash === 'string' &&
      typeof parsed.statusCode === 'number' &&
      typeof parsed.body === 'string'
    ) {
      return {
        status: 'completed',
        hash: parsed.hash,
        statusCode: parsed.statusCode,
        body: parsed.body,
      }
    }
    return null
  } catch {
    return null
  }
}

async function release(server: FastifyInstance, key: string): Promise<void> {
  const result = await withinDeadline(server.redis.del(key))
  if (!result.ok) {
    server.log.warn({ err: result.error, key }, 'agent registry idempotency release failed')
  }
}

async function executeAndSend(
  server: FastifyInstance,
  reply: FastifyReply,
  key: string | null,
  hash: string,
  execute: () => Promise<IdempotentResponse>,
): Promise<void> {
  try {
    const result = await execute()
    if (key !== null) {
      const record: CompletedRecord = {
        status: 'completed',
        hash,
        statusCode: result.statusCode,
        body: JSON.stringify(result.body),
      }
      const stored = await withinDeadline(
        server.redis.set(key, JSON.stringify(record), 'PX', TTL_MS),
      )
      if (!stored.ok) {
        server.log.warn({ err: stored.error, key }, 'agent registry idempotency store failed')
      }
    }
    await reply.status(result.statusCode).send(result.body)
  } catch (error) {
    if (key !== null) await release(server, key)
    throw error
  }
}

/**
 * 带幂等的 JSON 写端点包装器。handler 返回 `{statusCode, body}`，本函数统一发送。
 * 没有 `Idempotency-Key` 时完全退化为普通 handler，不产生 Redis 往返。
 */
export async function runIdempotent(
  server: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
  scope: string,
  execute: () => Promise<IdempotentResponse>,
): Promise<void> {
  const clientKey = clientKeyOf(request)
  const userId = request.userId
  if (!clientKey || !userId) {
    await executeAndSend(server, reply, null, '', execute)
    return
  }

  const key = keyOf(userId, scope, clientKey)
  const hash = bodyHash(request)
  let claimed: 'claimed' | 'taken'
  try {
    const result = await withinDeadline(
      server.redis.set(key, JSON.stringify({ status: 'processing', hash }), 'PX', TTL_MS, 'NX'),
    )
    if (!result.ok) {
      server.log.warn(
        { err: result.error, key },
        'agent registry idempotency unavailable, failing open',
      )
      await executeAndSend(server, reply, null, hash, execute)
      return
    }
    claimed = result.value === 'OK' ? 'claimed' : 'taken'
  } catch (error) {
    server.log.warn({ err: error, key }, 'agent registry idempotency unavailable, failing open')
    await executeAndSend(server, reply, null, hash, execute)
    return
  }

  if (claimed === 'claimed') {
    await executeAndSend(server, reply, key, hash, execute)
    return
  }

  const inspected = await withinDeadline(server.redis.get(key))
  if (!inspected.ok || inspected.value === null) {
    // 键刚好蒸发：重抢一次；仍抢不到按进行中处理，避免双跑。
    const retry = await withinDeadline(
      server.redis.set(key, JSON.stringify({ status: 'processing', hash }), 'PX', TTL_MS, 'NX'),
    )
    if (retry.ok && retry.value === 'OK') {
      await executeAndSend(server, reply, key, hash, execute)
      return
    }
    fail('IDEMPOTENCY_IN_PROGRESS', 409, '同一 Idempotency-Key 的请求正在执行')
  }

  const record = parseRecord(inspected.value)
  if (record === null) {
    fail('IDEMPOTENCY_IN_PROGRESS', 409, '同一 Idempotency-Key 的请求正在执行')
  }
  if (record.hash !== hash) {
    fail('IDEMPOTENCY_CONFLICT', 409, '同一 Idempotency-Key 携带了不同请求体')
  }
  if (record.status === 'processing') {
    fail('IDEMPOTENCY_IN_PROGRESS', 409, '同一 Idempotency-Key 的请求正在执行')
  }

  await reply.status(record.statusCode).type('application/json; charset=utf-8').send(record.body)
}
