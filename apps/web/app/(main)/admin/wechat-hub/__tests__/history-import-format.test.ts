// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import { normalizeHistoryRow, parseCsv, parseHistoryRows } from '../history-import-format'

describe('历史导入格式', () => {
  it('吃 JSONL 的 camelCase', () => {
    const rows = parseHistoryRows(
      '{"platformChatId":"wxid-a","platformMessageId":"m1","content":"你好","sentAt":"2026-01-01T00:00:00.000Z"}\n{"platformChatId":"wxid-b","content":"在吗"}',
    )
    expect(rows).toHaveLength(2)
    expect(rows[0]?.platformChatId).toBe('wxid-a')
    expect(rows[1]?.content).toBe('在吗')
  })

  it('吃 IHUI 导出的 snake_case，并把空字符串留给服务端报行错误', () => {
    const rows = parseHistoryRows(
      '{"conversation_platform_chat_id":"room@chatroom","platform_message_id":"m9","conversation_title":"客户群","conversation_kind":"group","direction":"outbound","kind":"image","sender_id":"wxid-a","sender_name":"小李","content":"[图片]","media_url":"https://x/y.png","sent_at":"2026-01-01T00:00:00.000Z"}',
    )
    expect(rows[0]).toMatchObject({
      platformChatId: 'room@chatroom',
      platformMessageId: 'm9',
      conversationKind: 'group',
      direction: 'outbound',
      kind: 'image',
      senderId: 'wxid-a',
      senderName: '小李',
      mediaUrl: 'https://x/y.png',
    })
    expect(normalizeHistoryRow({ content: 'no chat' }).platformChatId).toBe('')
  })

  it('吃 {messages:[]}', () => {
    const rows = parseHistoryRows('{"messages":[{"platformChatId":"wxid-a","content":"x"}]}')
    expect(rows).toHaveLength(1)
    expect(rows[0]?.content).toBe('x')
  })

  it('吃带 BOM、逗号、引号和换行的 CSV', () => {
    const csv = `\uFEFFconversation_id,conversation_title,conversation_platform_chat_id,direction,kind,content,sent_at
c1,"客户,一组",room-1@chatroom,inbound,text,"他说""你好""，
第二行",2026-01-01T00:00:00.000Z`
    const records = parseCsv(csv)
    expect(records).toHaveLength(1)
    expect(records[0]?.conversation_title).toBe('客户,一组')
    expect(records[0]?.content).toBe('他说"你好"，\n第二行')
    const rows = parseHistoryRows(csv)
    expect(rows[0]?.platformChatId).toBe('room-1@chatroom')
    expect(rows[0]?.conversationTitle).toBe('客户,一组')
  })

  it('坏 JSONL 报行号', () => {
    expect(() => parseHistoryRows('{"platformChatId":"a"}\nnot-json')).toThrow('第 2 行')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
