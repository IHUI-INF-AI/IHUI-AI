// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 微信智联「导出渲染 / 时间解析 / 指令内核」纯函数回归。
 * 这些函数不碰数据库，却直接决定用户看到的 HTML、Markdown 与指令行为，
 * 因此把边界（转义、时区、全角斜杠、指令开关）固化成测试。
 */

import { describe, expect, it } from 'vitest'
import { dayStartFromKey, extractKeywords, parseTimeWindow } from '../wechat-hub/ask'
import { listCommands, parseCommand, registerWechatCommand } from '../wechat-hub/commands'
import {
  escapeHtml,
  formatInZone,
  renderChatLab,
  renderHtml,
  renderMarkdown,
  type ExportConversationMeta,
  type ExportMessageRow,
} from '../wechat-hub/export-formats'

const conversations: ExportConversationMeta[] = [
  { id: 'c1', title: '客户群 <A&B>', kind: 'group', platformChatId: 'room@chatroom' },
]

const messages: ExportMessageRow[] = [
  {
    id: 'm1',
    conversationId: 'c1',
    conversationTitle: '客户群 <A&B>',
    conversationKind: 'group',
    direction: 'inbound',
    kind: 'text',
    content: '<script>alert(1)</script> 报价多少',
    mediaUrl: null,
    senderId: 'wxid_a',
    senderName: '张三',
    platformMessageId: 'p1',
    sentAt: new Date('2026-11-24T01:00:00Z'),
  },
  {
    id: 'm2',
    conversationId: 'c1',
    conversationTitle: '客户群 <A&B>',
    conversationKind: 'group',
    direction: 'outbound',
    kind: 'image',
    content: '',
    mediaUrl: 'https://cdn.example.com/a.png',
    senderId: null,
    senderName: null,
    platformMessageId: 'p2',
    sentAt: new Date('2026-11-24T02:00:00Z'),
  },
]

describe('export-formats', () => {
  it('escapeHtml 覆盖五个危险字符', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;',
    )
  })

  it('HTML 转义正文、保留气泡方向与搜索属性', () => {
    const html = renderHtml('测试号', conversations, messages, 'Asia/Shanghai')
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).toContain('class="row in"')
    expect(html).toContain('class="row out"')
    expect(html).toContain('data-search=')
    expect(html).toContain('客户群 &lt;A&amp;B&gt;')
    // 出站图片消息没有正文时用 [image] 占位 + 媒体地址
    expect(html).toContain('[image] https://cdn.example.com/a.png')
  })

  it('Markdown 按会话分节并带统计头', () => {
    const markdown = renderMarkdown('测试号', conversations, messages, 'Asia/Shanghai')
    expect(markdown).toContain('# 测试号 微信聊天记录')
    expect(markdown).toContain('## 客户群 <A&B>')
    expect(markdown).toContain('- 消息数：2')
    expect(markdown).toContain('**张三**')
  })

  it('ChatLab 结构含 conversations/messages 与 isSelf/timestamp', () => {
    const payload = renderChatLab('测试号', conversations, messages) as {
      format: string
      conversations: Array<{ messages: Array<Record<string, unknown>> }>
    }
    expect(payload.format).toBe('chatlab')
    const first = payload.conversations[0]?.messages[0]
    expect(first?.isSelf).toBe(false)
    expect(first?.type).toBe('text')
    expect(first?.timestamp).toBe(new Date('2026-11-24T01:00:00Z').getTime())
    const second = payload.conversations[0]?.messages[1]
    expect(second?.isSelf).toBe(true)
    expect(second?.sender).toBe('我')
  })

  it('formatInZone 固定时区，不受服务器 UTC 影响', () => {
    expect(formatInZone(new Date('2026-11-24T01:05:09Z'), 'Asia/Shanghai')).toBe(
      '2026-11-24 09:05:09',
    )
    expect(formatInZone(new Date('2026-11-24T01:05:09Z'), 'UTC')).toBe('2026-11-24 01:05:09')
  })
})

describe('ask 时间与关键词解析', () => {
  // 北京时间 2026-11-26 10:00（周四）
  const now = new Date('2026-11-26T02:00:00Z')

  it('昨天 / 今天按 Asia/Shanghai 切日', () => {
    expect(parseTimeWindow('昨天的报价', 'Asia/Shanghai', now).since?.toISOString()).toBe(
      '2026-11-24T16:00:00.000Z',
    )
    expect(parseTimeWindow('今天的消息', 'Asia/Shanghai', now).until?.toISOString()).toBe(
      '2026-11-26T16:00:00.000Z',
    )
  })

  it('最近 N 天与本周', () => {
    const recent = parseTimeWindow('最近3天聊了什么', 'Asia/Shanghai', now)
    expect(recent.since?.toISOString()).toBe('2026-11-23T16:00:00.000Z')
    expect(recent.until?.toISOString()).toBe('2026-11-26T16:00:00.000Z')
    const week = parseTimeWindow('本周的讨论', 'Asia/Shanghai', now)
    expect(week.since?.toISOString()).toBe('2026-11-22T16:00:00.000Z')
  })

  it('月份与日期', () => {
    const month = parseTimeWindow('12月的合同', 'Asia/Shanghai', now)
    expect(month.since?.toISOString()).toBe('2026-11-30T16:00:00.000Z')
    expect(dayStartFromKey('2026-11-24', 'Asia/Shanghai').toISOString()).toBe(
      '2026-11-23T16:00:00.000Z',
    )
  })

  it('没有时间词返回 null 边界', () => {
    const window = parseTimeWindow('预算怎么定的', 'Asia/Shanghai', now)
    expect(window.since).toBeNull()
    expect(window.until).toBeNull()
  })

  it('关键词剔除时间词与疑问词', () => {
    const keywords = extractKeywords('上周关于预算的讨论说了什么')
    expect(keywords).toContain('预算')
    expect(keywords).not.toContain('上周')
    expect(keywords).not.toContain('什么')
  })
})

describe('commands 指令内核', () => {
  it('半角/全角斜杠都能解析，参数原样保留', () => {
    expect(parseCommand('/summary')).toEqual({ name: 'summary', args: '' })
    expect(parseCommand('／ask 上周预算聊了什么')).toEqual({
      name: 'ask',
      args: '上周预算聊了什么',
    })
    expect(parseCommand('普通消息 /summary')).toBeNull()
    expect(parseCommand('/')).toBeNull()
  })

  it('默认关闭：listCommands 全部 enabled=false', () => {
    const commands = listCommands({})
    expect(commands.length).toBeGreaterThan(3)
    expect(commands.every((command) => command.enabled === false)).toBe(true)
  })

  it('打开总开关并拉黑单条指令', () => {
    const commands = listCommands({ commands: { enabled: true, disabled: ['report'] } })
    expect(commands.find((command) => command.name === 'report')?.enabled).toBe(false)
    expect(commands.find((command) => command.name === 'help')?.enabled).toBe(true)
    expect(commands.find((command) => command.name === 'ask')?.enabled).toBe(true)
  })

  it('注册表可热插拔：新指令立刻出现在列表里', () => {
    registerWechatCommand({
      name: 'demo_ping',
      aliases: ['ping'],
      description: '演示指令',
      scope: 'private',
      run: async () => 'pong',
    })
    expect(
      listCommands({ commands: { enabled: true } }).some((item) => item.name === 'demo_ping'),
    ).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
