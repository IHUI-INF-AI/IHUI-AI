import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockRedis = vi.hoisted(() => ({
  set: vi.fn(),
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

import { isDuplicate, _resetDedupClient } from '../src/utils/ws-dedup.js'

describe('ws-dedup — WebSocket 消息去重', () => {
  beforeEach(() => {
    _resetDedupClient()
    vi.clearAllMocks()
  })

  describe('isDuplicate', () => {
    it('空 msgId 返回 false（放行）', async () => {
      expect(await isDuplicate('')).toBe(false)
      expect(mockRedis.set).not.toHaveBeenCalled()
    })

    it('首次见到返回 false（非重复）', async () => {
      mockRedis.set.mockResolvedValueOnce('OK')
      expect(await isDuplicate('msg-1')).toBe(false)
      const args = mockRedis.set.mock.calls[0]!
      expect(args[1]).toBe('1')
      expect(args[2]).toBe('EX')
      expect(args[3]).toBe(300)
      expect(args[4]).toBe('NX')
    })

    it('再次见到返回 true（重复）', async () => {
      mockRedis.set.mockResolvedValueOnce(null)
      expect(await isDuplicate('msg-1')).toBe(true)
    })

    it('不同 msgId 生成不同 key', async () => {
      mockRedis.set.mockResolvedValue('OK')
      await isDuplicate('msg-a')
      await isDuplicate('msg-b')
      const key1 = mockRedis.set.mock.calls[0]![0]
      const key2 = mockRedis.set.mock.calls[1]![0]
      expect(key1).not.toBe(key2)
      expect(key1).toMatch(/^ws:dedup:[0-9a-f]{64}$/)
      expect(key2).toMatch(/^ws:dedup:[0-9a-f]{64}$/)
    })

    it('相同 msgId 生成相同 key（哈希一致性）', async () => {
      mockRedis.set.mockResolvedValue('OK')
      await isDuplicate('same-msg')
      await isDuplicate('same-msg')
      expect(mockRedis.set.mock.calls[0]![0]).toBe(mockRedis.set.mock.calls[1]![0])
    })

    it('Redis 异常时返回 false（降级放行）', async () => {
      mockRedis.set.mockRejectedValueOnce(new Error('redis down'))
      expect(await isDuplicate('msg-1')).toBe(false)
    })
  })
})
