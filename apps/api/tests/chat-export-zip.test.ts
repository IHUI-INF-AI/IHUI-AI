// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect } from 'vitest'
import {
  buildZipStore,
  crc32,
  dosDateTime,
  sanitizeZipEntryName,
} from '../src/lib/chat/zip-store.js'
import {
  buildConversationExportManifest,
  buildConversationExportManifestJson,
  buildConversationMarkdown,
  buildConversationMessagesJson,
  isExportableMessage,
  normalizeExportToolCalls,
  sanitizeExportTitle,
  type ConversationExportMessage,
} from '@ihui/shared/chat/conversation-export'

/**
 * 会话日志 ZIP 导出单测(2026-11-14)。
 * 覆盖:CRC 已知值 / UTF-8 条目名 / 空会话 / 大消息 / 路径穿越 / manifest 对账 / 字节确定性。
 */

interface ParsedZipEntry {
  name: string
  flags: number
  crc: number
  size: number
  data: Buffer
  localOffset: number
}

/** 测试专用 ZIP 读取器:按 EOCD → 中央目录 → 本地头解析,不引入解压依赖。 */
function readZip(buffer: Buffer): {
  entries: ParsedZipEntry[]
  centralDirectoryOffset: number
  count: number
} {
  const eocdOffset = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
  if (eocdOffset < 0) throw new Error('EOCD not found')
  const count = buffer.readUInt16LE(eocdOffset + 10)
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16)
  const entries: ParsedZipEntry[] = []
  let cursor = centralDirectoryOffset
  for (let index = 0; index < count; index++) {
    expect(buffer.readUInt32LE(cursor)).toBe(0x02014b50)
    const flags = buffer.readUInt16LE(cursor + 8)
    const crc = buffer.readUInt32LE(cursor + 16)
    const size = buffer.readUInt32LE(cursor + 24)
    const nameLength = buffer.readUInt16LE(cursor + 28)
    const extraLength = buffer.readUInt16LE(cursor + 30)
    const commentLength = buffer.readUInt16LE(cursor + 32)
    const localOffset = buffer.readUInt32LE(cursor + 42)
    const name = buffer.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8')

    expect(buffer.readUInt32LE(localOffset)).toBe(0x04034b50)
    const localNameLength = buffer.readUInt16LE(localOffset + 26)
    const localExtraLength = buffer.readUInt16LE(localOffset + 28)
    const dataStart = localOffset + 30 + localNameLength + localExtraLength
    entries.push({
      name,
      flags,
      crc,
      size,
      data: buffer.subarray(dataStart, dataStart + size),
      localOffset,
    })
    cursor += 46 + nameLength + extraLength + commentLength
  }
  return { entries, centralDirectoryOffset, count }
}

const FIXED_MTIME = new Date(Date.UTC(2026, 10, 14, 8, 30, 0))

function message(partial: Partial<ConversationExportMessage> = {}): ConversationExportMessage {
  return {
    id: partial.id ?? 'm1',
    role: partial.role ?? 'user',
    content: partial.content ?? '你好',
    createdAt: partial.createdAt ?? '2026-11-14T08:00:00.000Z',
    model: partial.model ?? null,
    ...(partial.reasoning !== undefined ? { reasoning: partial.reasoning } : {}),
    ...(partial.toolCalls !== undefined ? { toolCalls: partial.toolCalls } : {}),
  }
}

describe('crc32', () => {
  it('匹配标准向量 "123456789" → 0xCBF43926', () => {
    expect(crc32(Buffer.from('123456789'))).toBe(0xcbf43926)
  })

  it('空数据为 0', () => {
    expect(crc32(Buffer.alloc(0))).toBe(0)
  })
})

describe('dosDateTime', () => {
  it('按 UTC 生成并夹取 1980 下限', () => {
    expect(dosDateTime(new Date(Date.UTC(1970, 0, 1)))).toEqual({ dosDate: 0x0021, dosTime: 0 })
  })

  it('2026-11-14 08:30:00Z 的 DOS 字段', () => {
    const { dosDate, dosTime } = dosDateTime(FIXED_MTIME)
    expect(dosDate).toBe(((2026 - 1980) << 9) | (11 << 5) | 14)
    expect(dosTime).toBe((8 << 11) | (30 << 5) | 0)
  })
})

describe('sanitizeZipEntryName', () => {
  it('反斜杠归一、盘符剥离、控制字符剔除', () => {
    expect(sanitizeZipEntryName('C:\\导出\\会话.md')).toBe('导出/会话.md')
    expect(sanitizeZipEntryName('a\u0000b.md')).toBe('ab.md')
    expect(sanitizeZipEntryName('/leading/./x.md')).toBe('leading/x.md')
  })

  it('拒绝空名与目录穿越', () => {
    expect(() => sanitizeZipEntryName('')).toThrow('empty')
    expect(() => sanitizeZipEntryName('../secret.txt')).toThrow('escapes archive root')
    expect(() => sanitizeZipEntryName('a/../../b.txt')).toThrow('escapes archive root')
  })
})

describe('buildZipStore', () => {
  it('生成可解析的三件套,UTF-8 标志位与 CRC 正确', () => {
    const zip = buildZipStore(
      [
        { name: 'conversation.md', data: '# 标题\n\n正文' },
        { name: 'messages.json', data: '{"messages":[]}' },
        { name: 'manifest.json', data: '{"schemaVersion":1}' },
      ],
      { mtime: FIXED_MTIME },
    )
    const parsed = readZip(zip)
    expect(parsed.count).toBe(3)
    expect(parsed.entries.map((entry) => entry.name)).toEqual([
      'conversation.md',
      'messages.json',
      'manifest.json',
    ])
    for (const entry of parsed.entries) {
      expect(entry.flags & 0x0800).toBe(0x0800)
      expect(crc32(entry.data)).toBe(entry.crc)
    }
    expect(parsed.entries[0].data.toString('utf8')).toBe('# 标题\n\n正文')
    // 第一条本地头在偏移 0,后续条目偏移单调递增
    expect(parsed.entries[0].localOffset).toBe(0)
    expect(parsed.entries[1].localOffset).toBeGreaterThan(parsed.entries[0].localOffset)
  })

  it('中文 / emoji 条目名往返一致', () => {
    const zip = buildZipStore([{ name: '会话-🙂.md', data: 'x' }], { mtime: FIXED_MTIME })
    expect(readZip(zip).entries[0].name).toBe('会话-🙂.md')
  })

  it('同一内容 + 同一 mtime 生成完全相同的字节(可复现)', () => {
    const entries = [{ name: 'a.md', data: 'hello' }]
    const first = buildZipStore(entries, { mtime: FIXED_MTIME })
    const second = buildZipStore(entries, { mtime: FIXED_MTIME })
    expect(first.equals(second)).toBe(true)
  })

  it('支持 1MB 以上大消息', () => {
    const big = '长'.repeat(700_000)
    const zip = buildZipStore([{ name: 'big.md', data: big }], { mtime: FIXED_MTIME })
    const entry = readZip(zip).entries[0]
    expect(entry.size).toBe(Buffer.byteLength(big, 'utf8'))
    expect(crc32(entry.data)).toBe(entry.crc)
    expect(entry.data.equals(Buffer.from(big, 'utf8'))).toBe(true)
  })

  it('空会话仍产出三件套', () => {
    const zip = buildZipStore(
      [
        { name: 'conversation.md', data: '' },
        { name: 'messages.json', data: '{}' },
        { name: 'manifest.json', data: '{}' },
      ],
      { mtime: FIXED_MTIME },
    )
    const parsed = readZip(zip)
    expect(parsed.count).toBe(3)
    expect(parsed.entries[0].size).toBe(0)
    expect(parsed.entries[0].crc).toBe(0)
  })
})

describe('会话导出共享序列化', () => {
  it('只导出 user/assistant 且有正文的消息', () => {
    expect(isExportableMessage({ role: 'system', content: 'x' })).toBe(false)
    expect(isExportableMessage({ role: 'user', content: '   ' })).toBe(false)
    expect(isExportableMessage({ role: 'assistant', content: '答案' })).toBe(true)
  })

  it('Markdown 使用调用方角色文案并跳过空消息', () => {
    const markdown = buildConversationMarkdown(
      '测试会话',
      [
        message({ id: 'u1', role: 'user', content: '问题' }),
        message({ id: 's1', role: 'system', content: '系统提示' }),
        message({ id: 'a1', role: 'assistant', content: '答案' }),
      ],
      { user: '用户', assistant: '助手' },
    )
    expect(markdown).toContain('# 测试会话')
    expect(markdown).toContain('## 用户')
    expect(markdown).toContain('## 助手')
    expect(markdown).not.toContain('系统提示')
  })

  it('blank 标题回落 ai-chat 并剔除控制字符', () => {
    expect(sanitizeExportTitle('   ')).toBe('ai-chat')
    expect(sanitizeExportTitle('a\u0000b')).toBe('ab')
  })

  it('messages.json 字段白名单与计数一致', () => {
    const json = JSON.parse(
      buildConversationMessagesJson(
        '会话',
        [message({ id: 'u1' }), message({ id: 'a1', role: 'assistant', content: '答' })],
        '2026-11-14T08:00:00.000Z',
      ),
    ) as { messageCount: number; messages: Array<Record<string, unknown>> }
    expect(json.messageCount).toBe(2)
    expect(json.messages[0]).toEqual({
      id: 'u1',
      role: 'user',
      content: '你好',
      createdAt: '2026-11-14T08:00:00.000Z',
      model: null,
    })
  })

  it('Markdown 追加工具调用小节并保留结果尾部', () => {
    const longResult = `${'头'.repeat(400)}…${'尾'.repeat(100)}`
    const markdown = buildConversationMarkdown(
      '会话',
      [
        message({
          id: 'a1',
          role: 'assistant',
          content: '答案',
          toolCalls: [
            {
              name: 'run_command',
              status: 'success',
              args: { command: 'npm test' },
              result: longResult,
            },
          ],
        }),
      ],
      { user: '用户', assistant: '助手' },
    )
    expect(markdown).toContain('### 工具调用')
    expect(markdown).toContain('`run_command` (success)')
    expect(markdown).toContain('npm test')
    expect(markdown).toContain('尾尾尾')
    expect(markdown).toContain('[省略 1 字符]')
  })

  it('messages.json 携带 reasoning / toolCalls,且只有工具轮的 assistant 不被丢弃', () => {
    expect(
      isExportableMessage({ role: 'assistant', content: '', toolCalls: [{ name: 'read_file' }] }),
    ).toBe(true)
    expect(isExportableMessage({ role: 'assistant', content: '', reasoning: '思考' })).toBe(true)
    expect(isExportableMessage({ role: 'assistant', content: '', toolCalls: [] })).toBe(false)

    const json = JSON.parse(
      buildConversationMessagesJson(
        '会话',
        [
          message({
            id: 'a1',
            role: 'assistant',
            content: '',
            reasoning: '先看文件',
            toolCalls: [{ name: 'read_file', status: 'success', result: 'ok' }],
          }),
        ],
        '2026-11-14T08:00:00.000Z',
      ),
    ) as { schemaVersion: number; messageCount: number; messages: Array<Record<string, unknown>> }
    expect(json.schemaVersion).toBe(2)
    expect(json.messageCount).toBe(1)
    expect(json.messages[0]).toMatchObject({
      role: 'assistant',
      reasoning: '先看文件',
      toolCalls: [{ name: 'read_file', status: 'success', result: 'ok' }],
    })
  })

  it('normalizeExportToolCalls 接受落库 loose 形态并跳过畸形项', () => {
    expect(
      normalizeExportToolCalls([
        null,
        { id: 'x' },
        { toolName: 'read_file', status: 'success', args: { path: 'a' }, result: 'ok' },
        { name: 'web_search', isError: true, durationMs: 12 },
        { toolName: '', status: 'success' },
      ]),
    ).toEqual([
      { name: 'read_file', status: 'success', args: { path: 'a' }, result: 'ok' },
      { name: 'web_search', isError: true, durationMs: 12 },
    ])
    expect(normalizeExportToolCalls({ not: 'array' })).toEqual([])
  })

  it('manifest 统计与首末消息时间', () => {
    const manifest = buildConversationExportManifest({
      conversationId: 'c1',
      title: '会话',
      exportedAt: '2026-11-14T09:00:00.000Z',
      model: 'deepseek-chat',
      createdAt: '2026-11-14T07:00:00.000Z',
      updatedAt: '2026-11-14T08:30:00.000Z',
      messages: [
        message({ id: 'u1', role: 'user', createdAt: '2026-11-14T08:00:00.000Z' }),
        message({
          id: 'a1',
          role: 'assistant',
          content: '答',
          createdAt: '2026-11-14T08:10:00.000Z',
        }),
        message({ id: 's1', role: 'system', content: '系统' }),
      ],
    })
    expect(manifest.schemaVersion).toBe(2)
    expect(manifest.messageCount).toBe(2)
    expect(manifest.userMessageCount).toBe(1)
    expect(manifest.assistantMessageCount).toBe(1)
    expect(manifest.firstMessageAt).toBe('2026-11-14T08:00:00.000Z')
    expect(manifest.lastMessageAt).toBe('2026-11-14T08:10:00.000Z')
    expect(manifest.model).toBe('deepseek-chat')
    expect(manifest.files).toEqual(['conversation.md', 'messages.json', 'manifest.json'])
    expect(
      JSON.parse(
        buildConversationExportManifestJson({
          conversationId: 'c1',
          title: '会话',
          exportedAt: '2026-11-14T09:00:00.000Z',
          messages: [],
        }),
      ).messageCount,
    ).toBe(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
