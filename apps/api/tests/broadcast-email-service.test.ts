// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, vi, beforeEach } from 'vitest'

const sendEmailMock = vi.hoisted(() => vi.fn())

vi.mock('../src/services/email-service.js', () => ({
  sendEmail: sendEmailMock,
}))

import { broadcastDispatchEmail, BROADCAST_CONCURRENCY } from '../src/services/broadcast-email-service.js'
import { renderChangelogEmail } from '../src/services/email-templates.js'
import type { EmailRecipient } from '../src/services/broadcast-email-service.js'

function makeRecipients(n: number): EmailRecipient[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `u-${i + 1}`,
    email: `user${i + 1}@aizhs.top`,
    nickname: `用户${i + 1}`,
  }))
}

function makeMail() {
  return renderChangelogEmail({
    version: '1.2.0',
    date: '2026-09-21',
    items: [{ tag: 'NEW', title: '新增导出', desc: '支持 CSV 导出' }],
  })
}

describe('broadcast-email-service', () => {
  beforeEach(() => {
    sendEmailMock.mockReset()
    sendEmailMock.mockResolvedValue({ messageId: 'ok' })
  })

  it('并发批次常量合理(SMTP 友好)', () => {
    expect(BROADCAST_CONCURRENCY).toBeGreaterThanOrEqual(5)
    expect(BROADCAST_CONCURRENCY).toBeLessThanOrEqual(50)
  })

  it('全部成功:25 个收件人分批发送,统计 sent=25 failed=0', async () => {
    const stats = await broadcastDispatchEmail(makeMail(), makeRecipients(25))
    expect(stats).toEqual({ total: 25, sent: 25, failed: 0 })
    expect(sendEmailMock).toHaveBeenCalledTimes(25)
    // 每次调用都带场景与 userId
    const firstCall = sendEmailMock.mock.calls[0][0] as { to: string; userId: string; scene: string }
    expect(firstCall.scene).toBe('notification')
    expect(firstCall.userId).toBe('u-1')
    expect(firstCall.to).toBe('user1@aizhs.top')
  })

  it('单封失败不影响其他:sent/failed 分别统计', async () => {
    sendEmailMock.mockImplementation(async (input: { to: string }) => {
      if (input.to === 'user3@aizhs.top') throw new Error('SMTP timeout')
      return { messageId: 'ok' }
    })
    const stats = await broadcastDispatchEmail(makeMail(), makeRecipients(5))
    expect(stats).toEqual({ total: 5, sent: 4, failed: 1 })
    expect(sendEmailMock).toHaveBeenCalledTimes(5)
  })

  it('email 为空的收件人被过滤,不计入 total', async () => {
    const recipients: EmailRecipient[] = [
      { id: 'u-1', email: 'a@aizhs.top', nickname: null },
      { id: 'u-2', email: null, nickname: null },
      { id: 'u-3', email: '', nickname: null },
    ]
    const stats = await broadcastDispatchEmail(makeMail(), recipients)
    expect(stats).toEqual({ total: 1, sent: 1, failed: 0 })
    expect(sendEmailMock).toHaveBeenCalledTimes(1)
  })

  it('空收件人列表:零发送零失败,不抛错', async () => {
    const stats = await broadcastDispatchEmail(makeMail(), [])
    expect(stats).toEqual({ total: 0, sent: 0, failed: 0 })
    expect(sendEmailMock).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
