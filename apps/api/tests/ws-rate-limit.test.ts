import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockRedis = vi.hoisted(() => ({
  pipeline: vi.fn(),
  on: vi.fn(),
  quit: vi.fn().mockResolvedValue('OK'),
}))

vi.mock('ioredis', () => ({
  default: vi.fn(() => mockRedis),
}))

vi.mock('../src/config/index.js', () => ({
  config: { REDIS_URL: 'redis://localhost' },
}))

vi.mock('../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

import { checkWsRateLimit, _resetRateLimitClient } from '../src/utils/ws-rate-limit.js'

/** 构造 mock pipeline，zcard 返回指定 count */
function mockPipeline(zcardCount: number | null = 5) {
  return {
    zremrangebyscore: vi.fn(),
    zadd: vi.fn(),
    zcard: vi.fn(),
    pexpire: vi.fn(),
    exec: vi.fn(async () => [
      [null, 0],
      [null, 1],
      [null, zcardCount],
      [null, 'OK'],
    ]),
  }
}

describe('ws-rate-limit — WebSocket 消息限流', () => {
  beforeEach(() => {
    _resetRateLimitClient()
    vi.clearAllMocks()
  })

  describe('checkWsRateLimit', () => {
    it('空 userId 返回 true（放行）', async () => {
      expect(await checkWsRateLimit('', 'room1')).toBe(true)
      expect(mockRedis.pipeline).not.toHaveBeenCalled()
    })

    it('空 roomId 返回 true（放行）', async () => {
      expect(await checkWsRateLimit('user1', '')).toBe(true)
      expect(mockRedis.pipeline).not.toHaveBeenCalled()
    })

    it('窗口内（count=10）返回 true', async () => {
      mockRedis.pipeline.mockReturnValueOnce(mockPipeline(10))
      expect(await checkWsRateLimit('u1', 'r1')).toBe(true)
    })

    it('达上限（count=30）返回 true', async () => {
      mockRedis.pipeline.mockReturnValueOnce(mockPipeline(30))
      expect(await checkWsRateLimit('u1', 'r1')).toBe(true)
    })

    it('突发上限内（count=50）返回 true', async () => {
      mockRedis.pipeline.mockReturnValueOnce(mockPipeline(50))
      expect(await checkWsRateLimit('u1', 'r1')).toBe(true)
    })

    it('超突发上限（count=51）返回 false（限流）', async () => {
      mockRedis.pipeline.mockReturnValueOnce(mockPipeline(51))
      expect(await checkWsRateLimit('u1', 'r1')).toBe(false)
    })

    it('pipeline exec 返回 null 时返回 true', async () => {
      mockRedis.pipeline.mockReturnValueOnce({
        zremrangebyscore: vi.fn(),
        zadd: vi.fn(),
        zcard: vi.fn(),
        pexpire: vi.fn(),
        exec: vi.fn(async () => null),
      })
      expect(await checkWsRateLimit('u1', 'r1')).toBe(true)
    })

    it('zcard 结果为 NaN 时返回 true', async () => {
      mockRedis.pipeline.mockReturnValueOnce({
        zremrangebyscore: vi.fn(),
        zadd: vi.fn(),
        zcard: vi.fn(),
        pexpire: vi.fn(),
        exec: vi.fn(async () => [
          [null, 0],
          [null, 1],
          [null, 'not-a-number'],
          [null, 'OK'],
        ]),
      })
      expect(await checkWsRateLimit('u1', 'r1')).toBe(true)
    })

    it('Redis 异常时返回 true（降级放行）', async () => {
      mockRedis.pipeline.mockImplementationOnce(() => {
        throw new Error('redis down')
      })
      expect(await checkWsRateLimit('u1', 'r1')).toBe(true)
    })

    it('key 格式为 ws:rate:{userId}:{roomId}', async () => {
      const pipe = mockPipeline(5)
      mockRedis.pipeline.mockReturnValueOnce(pipe)
      await checkWsRateLimit('user-abc', 'room-xyz')
      const zaddArgs = pipe.zadd.mock.calls[0]!
      expect(zaddArgs[0]).toBe('ws:rate:user-abc:room-xyz')
    })
  })
})
