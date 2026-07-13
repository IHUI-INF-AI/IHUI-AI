import { describe, it, expect, vi } from 'vitest'
import type { Redis } from 'ioredis'
import { RefundDlq, MAX_RETRY } from '../src/utils/refund-dlq.js'

/** 构造 mock ioredis 客户端，模拟 incr/expire/hset/zadd/zrange 等方法 */
function createMockRedis(): Redis {
  const meta = new Map<string, string>()
  const info = new Map<string, Record<string, string>>()
  const zset = new Map<string, Array<{ score: number; member: string }>>()
  const getMeta = (k: string) => meta.get(k) ?? null
  const setMeta = (k: string, v: string) => meta.set(k, v)
  return {
    incr: vi.fn(async (k: string) => {
      const n = Number(getMeta(k) ?? '0') + 1
      setMeta(k, String(n))
      return n
    }),
    expire: vi.fn().mockResolvedValue(1),
    hset: vi.fn(async (k: string, v: Record<string, string>) => {
      const cur = info.get(k) ?? {}
      // 过滤 undefined 值, 模拟 ioredis hset 行为 (不传字段就不更新)
      const filtered: Record<string, string> = {}
      for (const [fk, fv] of Object.entries(v)) {
        if (fv !== undefined) filtered[fk] = fv
      }
      info.set(k, { ...cur, ...filtered })
      return Object.keys(filtered).length
    }),
    hgetall: vi.fn(async (k: string) => info.get(k) ?? {}),
    zadd: vi.fn(async (k: string, score: number, member: string) => {
      const cur = zset.get(k) ?? []
      const filtered = cur.filter((x) => x.member !== member)
      filtered.push({ score, member })
      zset.set(k, filtered)
      return 1
    }),
    zrem: vi.fn(async (k: string, m: string) => {
      const cur = zset.get(k) ?? []
      const filtered = cur.filter((x) => x.member !== m)
      zset.set(k, filtered)
      return 1
    }),
    zrange: vi.fn(async (k: string, start: number, stop: number) => {
      const cur = zset.get(k) ?? []
      const sorted = [...cur].sort((a, b) => a.score - b.score)
      const sliced = sorted.slice(start, stop + 1)
      const out: string[] = []
      for (const x of sliced) {
        out.push(x.member, String(x.score))
      }
      return out
    }),
    zcard: vi.fn(async (k: string) => (zset.get(k) ?? []).length),
    del: vi.fn(async (k: string) => {
      const isInfo = k.endsWith(':info')
      if (isInfo) info.delete(k)
      else meta.delete(k)
      return 1
    }),
    get: vi.fn(async (k: string) => getMeta(k)),
  } as unknown as Redis
}

describe('RefundDlq recordRefundFailure', () => {
  it('首次失败时 incr=1, 设置 24h 过期', async () => {
    const redis = createMockRedis()
    const dlq = new RefundDlq(redis)
    const n = await dlq.recordRefundFailure('order-1', 'network')
    expect(n).toBe(1)
    expect(redis.incr).toHaveBeenCalledWith('ihui:refund:dlq:meta:order-1')
    expect(redis.expire).toHaveBeenCalled()
    expect(redis.zadd).not.toHaveBeenCalled()
  })

  it('第 3 次失败时进入 DLQ (zadd + expire)', async () => {
    const redis = createMockRedis()
    const dlq = new RefundDlq(redis)
    await dlq.recordRefundFailure('order-1', 'e1')
    await dlq.recordRefundFailure('order-1', 'e2')
    const n = await dlq.recordRefundFailure('order-1', 'e3')
    expect(n).toBe(MAX_RETRY)
    expect(redis.zadd).toHaveBeenCalledWith('ihui:refund:dlq', expect.any(Number), 'order-1')
  })

  it('Redis 抛错时返回 -1', async () => {
    const redis = {
      incr: vi.fn().mockRejectedValue(new Error('boom')),
    } as unknown as Redis
    const dlq = new RefundDlq(redis)
    expect(await dlq.recordRefundFailure('order-1', 'e')).toBe(-1)
  })
})

describe('RefundDlq enqueueRefundFailure', () => {
  it('直接入 DLQ 跳过计数 (zadd + hset + expire)', async () => {
    const redis = createMockRedis()
    const dlq = new RefundDlq(redis)
    await dlq.enqueueRefundFailure('order-1', 'fatal', { userId: 1 })
    expect(redis.zadd).toHaveBeenCalled()
    expect(redis.hset).toHaveBeenCalled()
    expect(redis.expire).toHaveBeenCalled()
  })
})

describe('RefundDlq clearRefundFailure', () => {
  it('清理 meta + info + zset', async () => {
    const redis = createMockRedis()
    const dlq = new RefundDlq(redis)
    await dlq.recordRefundFailure('order-1', 'e')
    await dlq.recordRefundFailure('order-1', 'e')
    await dlq.recordRefundFailure('order-1', 'e') // 入 DLQ
    await dlq.clearRefundFailure('order-1')
    expect(redis.del).toHaveBeenCalled()
    expect(redis.zrem).toHaveBeenCalledWith('ihui:refund:dlq', 'order-1')
  })
})

describe('RefundDlq getRetryCount', () => {
  it('无记录时返回 0', async () => {
    const redis = createMockRedis()
    const dlq = new RefundDlq(redis)
    expect(await dlq.getRetryCount('unknown')).toBe(0)
  })

  it('有记录时返回正确数字', async () => {
    const redis = createMockRedis()
    const dlq = new RefundDlq(redis)
    await dlq.recordRefundFailure('order-1', 'e')
    await dlq.recordRefundFailure('order-1', 'e')
    expect(await dlq.getRetryCount('order-1')).toBe(2)
  })
})

describe('RefundDlq listDlq', () => {
  it('解析 zrange 结果为 DlqEntry 列表 (单次入队带 context)', async () => {
    const redis = createMockRedis()
    const dlq = new RefundDlq(redis)
    // 单次入队, 携带 context (避免 recordRefundFailure 默认 context={} 覆盖)
    await dlq.enqueueRefundFailure('order-1', 'err', { userId: 1, orderId: 100 })
    const items = await dlq.listDlq(10)
    expect(items).toHaveLength(1)
    expect(items[0]?.orderNo).toBe('order-1')
    expect(items[0]?.retryCount).toBe(MAX_RETRY)
    expect(items[0]?.error).toBe('err')
    expect(items[0]?.context).toEqual({ userId: 1, orderId: 100 })
  })

  it('recordRefundFailure 三次失败后入 DLQ, context 留空 (默认覆盖语义)', async () => {
    const redis = createMockRedis()
    const dlq = new RefundDlq(redis)
    await dlq.recordRefundFailure('order-1', 'e1', { userId: 1 })
    await dlq.recordRefundFailure('order-1', 'e2') // 默认 context={} 覆盖
    await dlq.recordRefundFailure('order-1', 'e3')
    const items = await dlq.listDlq(10)
    expect(items).toHaveLength(1)
    expect(items[0]?.retryCount).toBe(3)
    // 第 2/3 次的 context={} 覆盖了第 1 次, 最终解析为空对象
    expect(items[0]?.context).toEqual({})
  })
})

describe('RefundDlq dlqSize', () => {
  it('返回 zcard 值', async () => {
    const redis = createMockRedis()
    const dlq = new RefundDlq(redis)
    expect(await dlq.dlqSize()).toBe(0)
    await dlq.enqueueRefundFailure('order-1', 'e')
    expect(await dlq.dlqSize()).toBe(1)
  })
})

describe('RefundDlq performAction', () => {
  it('REPLAY → zrem + del + success', async () => {
    const redis = createMockRedis()
    const dlq = new RefundDlq(redis)
    await dlq.enqueueRefundFailure('order-1', 'e')
    const r = await dlq.performAction('order-1', 'REPLAY')
    expect(r.action).toBe('REPLAY')
    expect(r.success).toBe(true)
    expect(r.message).toContain('已重新入队')
  })

  it('DROP → success', async () => {
    const redis = createMockRedis()
    const dlq = new RefundDlq(redis)
    await dlq.enqueueRefundFailure('order-1', 'e')
    const r = await dlq.performAction('order-1', 'DROP')
    expect(r.action).toBe('DROP')
    expect(r.success).toBe(true)
    expect(r.message).toContain('已丢弃')
  })

  it('QUARANTINE → hset 标记 quarantined=1', async () => {
    const redis = createMockRedis()
    const dlq = new RefundDlq(redis)
    await dlq.enqueueRefundFailure('order-1', 'e')
    const r = await dlq.performAction('order-1', 'QUARANTINE', '人工核查')
    expect(r.action).toBe('QUARANTINE')
    expect(r.success).toBe(true)
    expect(r.message).toContain('已隔离')
    expect(redis.hset).toHaveBeenCalledWith(
      'ihui:refund:dlq:meta:order-1:info',
      expect.objectContaining({ quarantined: '1', quarantine_reason: '人工核查' }),
    )
  })
})
