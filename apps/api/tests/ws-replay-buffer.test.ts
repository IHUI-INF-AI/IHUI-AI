import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockRedis = vi.hoisted(() => ({
  pipeline: vi.fn(),
  lrange: vi.fn(),
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

import { bufferMessage, replayMessages, _resetReplayClient } from '../src/utils/ws-replay-buffer.js'

describe('ws-replay-buffer — WebSocket 消息回放缓冲', () => {
  beforeEach(() => {
    _resetReplayClient()
    vi.clearAllMocks()
  })

  describe('bufferMessage', () => {
    it('空 roomId 不写入', async () => {
      await bufferMessage('', { text: 'hi' })
      expect(mockRedis.pipeline).not.toHaveBeenCalled()
    })

    it('写入消息到 Redis（pipeline rpush + ltrim + expire）', async () => {
      const pipe = {
        rpush: vi.fn(),
        ltrim: vi.fn(),
        expire: vi.fn(),
        exec: vi.fn(async () => [
          [null, 1],
          [null, 'OK'],
          [null, 1],
        ]),
      }
      mockRedis.pipeline.mockReturnValueOnce(pipe)
      await bufferMessage('room1', { text: 'hi' })
      expect(pipe.rpush).toHaveBeenCalledTimes(1)
      expect(pipe.ltrim).toHaveBeenCalledTimes(1)
      expect(pipe.expire).toHaveBeenCalledTimes(1)
      const rpushArgs = pipe.rpush.mock.calls[0]!
      expect(rpushArgs[0]).toBe('ws:replay:room1')
      const envelope = JSON.parse(rpushArgs[1])
      expect(envelope.data).toEqual({ text: 'hi' })
      expect(typeof envelope.ts).toBe('number')
    })

    it('ltrim 保留最近 500 条', async () => {
      const pipe = {
        rpush: vi.fn(),
        ltrim: vi.fn(),
        expire: vi.fn(),
        exec: vi.fn(async () => [
          [null, 1],
          [null, 'OK'],
          [null, 1],
        ]),
      }
      mockRedis.pipeline.mockReturnValueOnce(pipe)
      await bufferMessage('room1', 'msg')
      const ltrimArgs = pipe.ltrim.mock.calls[0]!
      expect(ltrimArgs[0]).toBe('ws:replay:room1')
      expect(ltrimArgs[1]).toBe(-500)
      expect(ltrimArgs[2]).toBe(-1)
    })

    it('expire 设置 30 分钟 TTL', async () => {
      const pipe = {
        rpush: vi.fn(),
        ltrim: vi.fn(),
        expire: vi.fn(),
        exec: vi.fn(async () => [
          [null, 1],
          [null, 'OK'],
          [null, 1],
        ]),
      }
      mockRedis.pipeline.mockReturnValueOnce(pipe)
      await bufferMessage('room1', 'msg')
      const expireArgs = pipe.expire.mock.calls[0]!
      expect(expireArgs[0]).toBe('ws:replay:room1')
      expect(expireArgs[1]).toBe(30 * 60)
    })

    it('Redis 异常时静默降级', async () => {
      mockRedis.pipeline.mockImplementationOnce(() => {
        throw new Error('redis down')
      })
      await expect(bufferMessage('room1', { text: 'hi' })).resolves.toBeUndefined()
    })
  })

  describe('replayMessages', () => {
    it('空 roomId 返回 []', async () => {
      expect(await replayMessages('', 0)).toEqual([])
      expect(mockRedis.lrange).not.toHaveBeenCalled()
    })

    it('返回 since 之后的消息（按时间升序）', async () => {
      const envelopes = [
        JSON.stringify({ ts: 100, data: { id: 1 } }),
        JSON.stringify({ ts: 200, data: { id: 2 } }),
        JSON.stringify({ ts: 300, data: { id: 3 } }),
      ]
      mockRedis.lrange.mockResolvedValueOnce(envelopes)
      const result = await replayMessages('room1', 150)
      expect(result).toEqual([{ id: 2 }, { id: 3 }])
    })

    it('since=0 返回全部缓冲', async () => {
      const envelopes = [
        JSON.stringify({ ts: 100, data: 'a' }),
        JSON.stringify({ ts: 200, data: 'b' }),
      ]
      mockRedis.lrange.mockResolvedValueOnce(envelopes)
      const result = await replayMessages('room1', 0)
      expect(result).toEqual(['a', 'b'])
    })

    it('无消息时返回空数组', async () => {
      mockRedis.lrange.mockResolvedValueOnce([])
      expect(await replayMessages('room1', 0)).toEqual([])
    })

    it('损坏的 JSON 条目跳过', async () => {
      mockRedis.lrange.mockResolvedValueOnce([
        JSON.stringify({ ts: 100, data: 'ok' }),
        'not-json',
        JSON.stringify({ ts: 200, data: 'ok2' }),
      ])
      const result = await replayMessages('room1', 0)
      expect(result).toEqual(['ok', 'ok2'])
    })

    it('lrange key 格式为 ws:replay:{roomId}', async () => {
      mockRedis.lrange.mockResolvedValueOnce([])
      await replayMessages('room-xyz', 0)
      const args = mockRedis.lrange.mock.calls[0]!
      expect(args[0]).toBe('ws:replay:room-xyz')
      expect(args[1]).toBe(0)
      expect(args[2]).toBe(-1)
    })

    it('Redis 异常时返回 []', async () => {
      mockRedis.lrange.mockRejectedValueOnce(new Error('redis down'))
      expect(await replayMessages('room1', 0)).toEqual([])
    })
  })
})
