/**
 * rewarded-video-ad 并发安全回归测试(2026-08-02 立)。
 *
 * 验证上轮 P0 修复:
 * - Bug: 同一 transactionId 并发回调导致积分重复发放(Lost Update + 重复发放)
 * - 修复: Redis SET NX 跨实例事务去重(第一次 OK,后续 null → 幂等返回 duplicated)
 *         + awardAdPoints 事务(FOR UPDATE + INSERT)防余额 Lost Update
 *
 * 测试模式: vi.hoisted + vi.mock + Fastify inject + Promise.all(对齐 ai-generation-idor.test.ts)。
 * 测试文件豁免 any(mock 类型断言必需,AGENTS.md §3)。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'

const { mockAwardAdPoints } = vi.hoisted(() => ({
  mockAwardAdPoints: vi.fn(),
}))

// mock awardAdPoints(避免触发真实 DB 事务)
vi.mock('../src/db/point-queries.js', () => ({
  awardAdPoints: mockAwardAdPoints,
}))

import { rewardedVideoAdRoutes } from '../src/routes/rewarded-video-ad.js'

/**
 * 内存 Redis:精确模拟 SET key value EX ttl NX 语义。
 * NX 模式下 key 已存在返回 null(去重核心),首次写入返回 'OK'。
 */
class MockRedis {
  private store = new Map<string, string>()
  async set(
    key: string,
    value: string,
    _ex?: string,
    _ttl?: number,
    nx?: string,
  ): Promise<'OK' | null> {
    if (nx === 'NX') {
      if (this.store.has(key)) return null
      this.store.set(key, value)
      return 'OK'
    }
    this.store.set(key, value)
    return 'OK'
  }
  reset(): void {
    this.store.clear()
  }
}

describe('rewarded-video-ad 并发安全', () => {
  const server = Fastify({ logger: false })
  const mockRedis = new MockRedis()

  beforeAll(async () => {
    // 确保无签名校验(跳过 REWARDED_AD_SECRET 分支)
    delete process.env.REWARDED_AD_SECRET
    // 挂载 redis + pushNotification(路由依赖)
    ;(server as any).redis = mockRedis
    ;(server as any).pushNotification = async () => {}
    await server.register(rewardedVideoAdRoutes, { prefix: '/api/rewarded-video-ad' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(() => {
    mockRedis.reset()
    mockAwardAdPoints.mockReset()
  })

  it('场景 1:同一 transactionId 并发 3 次,只发放 1 次积分(Redis NX 去重)', async () => {
    mockAwardAdPoints.mockResolvedValue({ beforeBalance: 0, afterBalance: 10 })

    const body = {
      userId: 'user-1',
      transactionId: 'tx-duplicate',
      rewardAmount: 10,
    }

    // Promise.all 触发竞态:3 个并发回调
    const results = await Promise.all([
      server.inject({ method: 'POST', url: '/api/rewarded-video-ad/notify', body }),
      server.inject({ method: 'POST', url: '/api/rewarded-video-ad/notify', body }),
      server.inject({ method: 'POST', url: '/api/rewarded-video-ad/notify', body }),
    ])

    const bodies = results.map((r) => r.json())
    const awarded = bodies.filter((b) => b.code === 0 && b.data?.awarded === true)
    const duplicated = bodies.filter((b) => b.code === 0 && b.data?.duplicated === true)

    // 修复后:只有 1 个发放成功,2 个幂等返回 duplicated
    expect(awarded).toHaveLength(1)
    expect(duplicated).toHaveLength(2)
    // awardAdPoints 只被调用 1 次(去重在 service 入口生效,DB 层未重复写入)
    expect(mockAwardAdPoints).toHaveBeenCalledTimes(1)
  })

  it('场景 2:不同 transactionId 并发 3 次,各发放 1 次(无去重冲突)', async () => {
    mockAwardAdPoints
      .mockResolvedValueOnce({ beforeBalance: 0, afterBalance: 10 })
      .mockResolvedValueOnce({ beforeBalance: 10, afterBalance: 20 })
      .mockResolvedValueOnce({ beforeBalance: 20, afterBalance: 30 })

    const results = await Promise.all([
      server.inject({
        method: 'POST',
        url: '/api/rewarded-video-ad/notify',
        body: { userId: 'user-1', transactionId: 'tx-a', rewardAmount: 10 },
      }),
      server.inject({
        method: 'POST',
        url: '/api/rewarded-video-ad/notify',
        body: { userId: 'user-1', transactionId: 'tx-b', rewardAmount: 10 },
      }),
      server.inject({
        method: 'POST',
        url: '/api/rewarded-video-ad/notify',
        body: { userId: 'user-1', transactionId: 'tx-c', rewardAmount: 10 },
      }),
    ])

    const bodies = results.map((r) => r.json())
    // 3 个不同 transactionId,各自独立发放成功
    expect(bodies.every((b) => b.code === 0 && b.data?.awarded === true)).toBe(true)
    expect(mockAwardAdPoints).toHaveBeenCalledTimes(3)
  })

  it('场景 3:无 transactionId 时不走去重,每次都发放(回调必带 tx 的契约由广告平台保证)', async () => {
    mockAwardAdPoints.mockResolvedValue({ beforeBalance: 0, afterBalance: 10 })

    const results = await Promise.all([
      server.inject({
        method: 'POST',
        url: '/api/rewarded-video-ad/notify',
        body: { userId: 'user-1', rewardAmount: 10 },
      }),
      server.inject({
        method: 'POST',
        url: '/api/rewarded-video-ad/notify',
        body: { userId: 'user-1', rewardAmount: 10 },
      }),
    ])

    const bodies = results.map((r) => r.json())
    // 无 transactionId → 不去重 → 都发放(这是已知行为,tx 由广告平台保证)
    expect(bodies.every((b) => b.code === 0 && b.data?.awarded === true)).toBe(true)
    expect(mockAwardAdPoints).toHaveBeenCalledTimes(2)
  })
})
