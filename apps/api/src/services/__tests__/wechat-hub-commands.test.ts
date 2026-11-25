// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 指令管道回归：默认必须不响应，群里必须显式开启，命中后必须走统一 send 并返回投递状态。
 * 这几条是「指令不会变成第二个乱发消息的入口」的底线。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const hoisted = vi.hoisted(() => ({ select: vi.fn() }))

vi.mock('../../db/index.js', () => ({ db: {}, dbRead: { select: hoisted.select } }))

import { runCommand } from '../wechat-hub/commands'
import type { WechatSendInput, WechatSendResult } from '@ihui/types'
import type { WechatInboundEvent } from '../wechat-hub/types'

function chain(result: unknown) {
  const node = {
    from: () => node,
    where: () => node,
    limit: () => node,
    then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  }
  return node
}

function event(overrides: Partial<WechatInboundEvent> = {}): WechatInboundEvent {
  return {
    platformChatId: 'chat-1',
    conversationKind: 'private',
    senderId: 'wxid_a',
    senderName: '张三',
    content: '/help',
    kind: 'text',
    ...overrides,
  } as WechatInboundEvent
}

const send = vi.fn(async (_input: WechatSendInput): Promise<WechatSendResult> => ({
  ok: true,
  status: 'delivered',
  platformMessageId: 'pmsg-1',
  reason: null,
  attempts: 1,
  rejectedBy: null,
}))

beforeEach(() => {
  hoisted.select.mockReset()
  hoisted.select.mockReturnValue(chain([{ id: 'conv-1' }]))
  vi.mocked(send).mockClear()
})

describe('runCommand', () => {
  it('默认关闭：即使发的是 /help 也不响应', async () => {
    const result = await runCommand('u1', 'acc-off', event(), {}, send)
    expect(result).toBeNull()
    expect(vi.mocked(send)).not.toHaveBeenCalled()
  })

  it('群聊未开启 groupEnabled 时不响应', async () => {
    const result = await runCommand(
      'u1',
      'acc-group',
      event({ conversationKind: 'group', platformChatId: 'room-1' }),
      { commands: { enabled: true } },
      send,
    )
    expect(result).toBeNull()
    expect(vi.mocked(send)).not.toHaveBeenCalled()
  })

  it('私聊开启后 /help 走统一 send 并带投递状态', async () => {
    const result = await runCommand(
      'u1',
      'acc-on',
      event({ platformChatId: 'chat-help' }),
      { commands: { enabled: true } },
      send,
    )
    expect(result?.command).toBe('help')
    expect(result?.deliveryStatus).toBe('delivered')
    expect(result?.replyText).toContain('可用指令')
    expect(vi.mocked(send)).toHaveBeenCalledTimes(1)
    const sent = vi.mocked(send).mock.calls[0]?.[0] as { target: string; text: string }
    expect(sent.target).toBe('chat-help')
    expect(sent.text).toContain('/ask')
  })

  it('被拉黑的指令不响应', async () => {
    const result = await runCommand(
      'u1',
      'acc-block',
      event({ platformChatId: 'chat-block' }),
      { commands: { enabled: true, disabled: ['help'] } },
      send,
    )
    expect(result).toBeNull()
  })

  it('同一会话 2 秒内重复指令被冷却拦下', async () => {
    const first = await runCommand(
      'u1',
      'acc-cd',
      event({ platformChatId: 'chat-cd' }),
      { commands: { enabled: true } },
      send,
    )
    expect(first?.command).toBe('help')
    const second = await runCommand(
      'u1',
      'acc-cd',
      event({ platformChatId: 'chat-cd' }),
      { commands: { enabled: true } },
      send,
    )
    expect(second).toBeNull()
    expect(vi.mocked(send)).toHaveBeenCalledTimes(1)
  })

  it('非指令消息返回 null，交给自动回复', async () => {
    const result = await runCommand(
      'u1',
      'acc-on',
      event({ content: '你好，在吗', platformChatId: 'chat-plain' }),
      { commands: { enabled: true } },
      send,
    )
    expect(result).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
