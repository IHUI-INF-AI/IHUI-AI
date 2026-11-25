// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 导出分发回归：六种格式都走 exportAccountMessages 的真实分支，
 * 但把数据库换成可控的 thenable 链，确保「格式 → mimeType → encoding → 内容」不再错配。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const hoisted = vi.hoisted(() => ({
  select: vi.fn(),
}))

vi.mock('../../db/index.js', () => ({
  db: {},
  dbRead: { select: hoisted.select },
}))

vi.mock('../wechat-hub/guards', () => ({
  assertAccountForUser: async () => ({ id: 'acc-1', label: '测试号' }),
}))

import { exportAccountMessages } from '../wechat-hub/export'

interface Row {
  id: string
  conversationId: string
  direction: string
  kind: string
  content: string
  mediaUrl: string | null
  senderId: string | null
  senderName: string | null
  platformMessageId: string | null
  sentAt: Date
}

const conversations = [
  { id: 'conv-1', platformChatId: 'room@chatroom', kind: 'group', title: '项目群' },
]

// export 按 desc(sentAt) 取，再 reverse 成时间正序；这里给降序数据模拟真实查询结果。
const messageRows: Row[] = [
  {
    id: 'm2',
    conversationId: 'conv-1',
    direction: 'outbound',
    kind: 'text',
    content: '收到，下午给你',
    mediaUrl: null,
    senderId: null,
    senderName: null,
    platformMessageId: 'p2',
    sentAt: new Date('2026-11-24T02:00:00Z'),
  },
  {
    id: 'm1',
    conversationId: 'conv-1',
    direction: 'inbound',
    kind: 'text',
    content: '报价单什么时候给？',
    mediaUrl: null,
    senderId: 'wxid_a',
    senderName: '张三',
    platformMessageId: 'p1',
    sentAt: new Date('2026-11-24T01:00:00Z'),
  },
]

/** 同时支持 await 与链式调用的最小查询桩。 */
function chain(result: unknown) {
  const node = {
    from: () => node,
    where: () => node,
    orderBy: () => node,
    limit: () => node,
    then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  }
  return node
}

beforeEach(() => {
  hoisted.select.mockReturnValueOnce(chain(conversations)).mockReturnValueOnce(chain(messageRows))
})

describe('exportAccountMessages 格式分发', () => {
  it('jsonl 保持一行一条 JSON', async () => {
    const result = await exportAccountMessages('u1', 'acc-1', { format: 'jsonl' })
    expect(result.encoding).toBe('utf8')
    expect(result.filename.endsWith('.jsonl')).toBe(true)
    const lines = result.content.split('\n')
    expect(lines).toHaveLength(2)
    expect(JSON.parse(lines[0] ?? '{}')).toMatchObject({ content: '报价单什么时候给？' })
  })

  it('csv 带 BOM 与表头', async () => {
    const result = await exportAccountMessages('u1', 'acc-1', { format: 'csv' })
    expect(result.content.startsWith('\uFEFFconversation_id')).toBe(true)
    expect(result.mimeType).toContain('text/csv')
  })

  it('html 是自包含单文件且含气泡', async () => {
    const result = await exportAccountMessages('u1', 'acc-1', {
      format: 'html',
      timezone: 'Asia/Shanghai',
    })
    expect(result.mimeType).toContain('text/html')
    expect(result.content).toContain('<!doctype html>')
    expect(result.content).toContain('class="row in"')
    expect(result.content).toContain('09:00')
  })

  it('markdown 带会话标题与消息数', async () => {
    const result = await exportAccountMessages('u1', 'acc-1', { format: 'markdown' })
    expect(result.filename.endsWith('.md')).toBe(true)
    expect(result.content).toContain('## 项目群')
    expect(result.content).toContain('- 消息数：2')
  })

  it('chatlab 是合法 JSON 且含 isSelf', async () => {
    const result = await exportAccountMessages('u1', 'acc-1', { format: 'chatlab' })
    const payload = JSON.parse(result.content) as {
      format: string
      conversations: Array<{ messages: Array<{ isSelf: boolean }> }>
    }
    expect(payload.format).toBe('chatlab')
    expect(payload.conversations[0]?.messages[0]?.isSelf).toBe(false)
  })

  it('xlsx 返回 base64，解码后是 ZIP 头', async () => {
    const result = await exportAccountMessages('u1', 'acc-1', { format: 'xlsx' })
    expect(result.encoding).toBe('base64')
    expect(result.filename.endsWith('.xlsx')).toBe(true)
    const bytes = Buffer.from(result.content, 'base64')
    expect(bytes.subarray(0, 2).toString('latin1')).toBe('PK')
    expect(bytes.length).toBeGreaterThan(1_000)
  })

  it('非法时区直接 400，不静默退回 UTC', async () => {
    hoisted.select.mockReturnValueOnce(chain(conversations)).mockReturnValueOnce(chain(messageRows))
    await expect(
      exportAccountMessages('u1', 'acc-1', { format: 'html', timezone: 'Mars/Base' }),
    ).rejects.toMatchObject({ errorCode: 'WECHAT_EXPORT_BAD_TIMEZONE' })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
