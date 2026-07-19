/**
 * Message Router 单元测试
 * 覆盖:
 * - makeRequestId 生成稳定格式
 * - sendMessage 超时控制 + chrome.runtime.lastError 处理
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// chrome.runtime mock
const chromeSendMessage = vi.fn()

beforeEach(() => {
  chromeSendMessage.mockReset()
  ;(globalThis as unknown as { chrome: unknown }).chrome = {
    runtime: {
      sendMessage: chromeSendMessage,
      lastError: undefined as { message?: string } | undefined,
    },
  }
})

describe('message-router', () => {
  describe('makeRequestId', () => {
    it('生成 req- 开头的字符串', async () => {
      const { makeRequestId } = await import('../lib/message-router')
      const id = makeRequestId()
      expect(id).toMatch(/^req-\d+-[a-z0-9]+$/)
    })

    it('每次生成不同 id', async () => {
      const { makeRequestId } = await import('../lib/message-router')
      const a = makeRequestId()
      const b = makeRequestId()
      expect(a).not.toBe(b)
    })
  })

  describe('sendMessage', () => {
    it('成功响应 resolve data', async () => {
      chromeSendMessage.mockImplementation((_msg: unknown, cb: (r: unknown) => void) => {
        cb({ ok: true, data: { foo: 'bar' }, requestId: 'r1' })
      })
      const { sendMessage } = await import('../lib/message-router')
      const res = await sendMessage<{ foo: string }>({
        type: 'token.get',
        payload: undefined,
        requestId: 'r1',
      })
      expect(res).toEqual({ foo: 'bar' })
    })

    it('失败响应 reject error', async () => {
      chromeSendMessage.mockImplementation((_msg: unknown, cb: (r: unknown) => void) => {
        cb({ ok: false, error: 'bad', requestId: 'r1' })
      })
      const { sendMessage } = await import('../lib/message-router')
      await expect(
        sendMessage({ type: 'token.get', payload: undefined, requestId: 'r1' }),
      ).rejects.toThrow('bad')
    })

    it('chrome.runtime.lastError 抛错', async () => {
      chromeSendMessage.mockImplementation((_msg: unknown, cb: (r: unknown) => void) => {
        ;(globalThis as unknown as { chrome: { runtime: { lastError: { message: string } } } }).chrome.runtime.lastError = { message: 'channel closed' }
        cb(undefined)
      })
      const { sendMessage } = await import('../lib/message-router')
      await expect(
        sendMessage({ type: 'token.get', payload: undefined, requestId: 'r1' }),
      ).rejects.toThrow('channel closed')
    })

    it('超时 reject', async () => {
      chromeSendMessage.mockImplementation(() => {
        // 永远不调用 cb
      })
      const { sendMessage } = await import('../lib/message-router')
      await expect(
        sendMessage(
          { type: 'token.get', payload: undefined, requestId: 'r1' },
          50, // 50ms timeout
        ),
      ).rejects.toThrow(/timed out/)
    })
  })
})
