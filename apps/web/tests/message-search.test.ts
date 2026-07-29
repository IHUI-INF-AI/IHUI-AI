/**
 * message-search 纯函数单元测试(2026-07-29 立,Phase 23)
 *
 * 覆盖:
 * - searchMessages:空查询 / 单匹配 / 多匹配 / 大小写不敏感 / 部分匹配 / 无匹配 / 空列表
 * - highlightMatch:<mark> 包裹 / 大小写不敏感 / 无匹配 / 多匹配 / HTML 转义 / 空查询
 * - escapeRegExp:特殊字符转义 / 普通文本不变 / 空字符串
 * - 集成:搜索 → 高亮管道 / 多关键词场景
 */

import { describe, it, expect } from 'vitest'
import {
  searchMessages,
  highlightMatch,
  escapeRegExp,
  type SearchableMessage,
} from '../src/lib/message-search'

// ─── 测试数据 ───
const sampleMessages: SearchableMessage[] = [
  { id: 'm1', content: 'Hello World' },
  { id: 'm2', content: 'Authentication required' },
  { id: 'm3', content: 'hello again, HELLO is case insensitive' },
  { id: 'm4', content: 'No match here' },
  { id: 'm5', content: 'user authentication flow' },
]

// ─── searchMessages ───
describe('searchMessages', () => {
  it('空查询 → 返回空数组', () => {
    expect(searchMessages(sampleMessages, '')).toEqual([])
  })

  it('仅空白查询 → 返回空数组', () => {
    expect(searchMessages(sampleMessages, '   ')).toEqual([])
  })

  it('匹配 1 条消息 → 返回 [id]', () => {
    expect(searchMessages(sampleMessages, 'No match')).toEqual(['m4'])
  })

  it('匹配多条 → 返回所有匹配 ID(按顺序)', () => {
    expect(searchMessages(sampleMessages, 'hello')).toEqual(['m1', 'm3'])
  })

  it('大小写不敏感', () => {
    expect(searchMessages(sampleMessages, 'HELLO')).toEqual(['m1', 'm3'])
    expect(searchMessages(sampleMessages, 'Hello')).toEqual(['m1', 'm3'])
  })

  it('部分匹配(如 "auth" 匹配 "authentication")', () => {
    expect(searchMessages(sampleMessages, 'auth')).toEqual(['m2', 'm5'])
  })

  it('无匹配 → 返回空数组', () => {
    expect(searchMessages(sampleMessages, 'xyz123')).toEqual([])
  })

  it('空消息列表 → 返回空数组', () => {
    expect(searchMessages([], 'hello')).toEqual([])
  })
})

// ─── highlightMatch ───
describe('highlightMatch', () => {
  it('匹配文本用 <mark> 包裹', () => {
    const result = highlightMatch('Hello World', 'Hello')
    expect(result).toContain('<mark')
    expect(result).toContain('Hello')
    expect(result).toContain('</mark>')
  })

  it('大小写不敏感高亮', () => {
    const result = highlightMatch('HELLO world', 'hello')
    expect(result).toContain('<mark')
    expect(result).toContain('HELLO')
  })

  it('无匹配 → 返回原文(已 HTML 转义)', () => {
    const result = highlightMatch('Hello World', 'xyz')
    expect(result).toBe('Hello World')
    expect(result).not.toContain('<mark')
  })

  it('多个匹配全部高亮', () => {
    const result = highlightMatch('hello hello hello', 'hello')
    const markCount = (result.match(/<mark/g) ?? []).length
    expect(markCount).toBe(3)
  })

  it('空查询 → 返回原文(已 HTML 转义)', () => {
    const result = highlightMatch('Hello World', '')
    expect(result).toBe('Hello World')
    expect(result).not.toContain('<mark')
  })

  it('HTML 特殊字符被转义(防 XSS)', () => {
    const result = highlightMatch('<script>alert(1)</script>', 'script')
    // 原始 <script> 标签不得出现(已转义为 &lt; ... &gt;)
    expect(result).not.toContain('<script>')
    expect(result).toContain('&lt;')
    expect(result).toContain('&gt;')
    // "script" 部分被 <mark> 高亮(在转义后的文本中匹配)
    expect(result).toContain('<mark')
    expect(result).toContain('script')
  })

  it('mark 标签包含 rounded-sm 类(非 rounded-full)', () => {
    const result = highlightMatch('Hello', 'Hello')
    expect(result).toContain('rounded-sm')
    expect(result).not.toContain('rounded-full')
  })
})

// ─── escapeRegExp ───
describe('escapeRegExp', () => {
  it('转义特殊字符(如 "." → "\\.")', () => {
    expect(escapeRegExp('a.b')).toBe('a\\.b')
    expect(escapeRegExp('a*b')).toBe('a\\*b')
    expect(escapeRegExp('a+b')).toBe('a\\+b')
    expect(escapeRegExp('a?b')).toBe('a\\?b')
    expect(escapeRegExp('a^b')).toBe('a\\^b')
    expect(escapeRegExp('a$b')).toBe('a\\$b')
    expect(escapeRegExp('a(b)c')).toBe('a\\(b\\)c')
    expect(escapeRegExp('a[b]c')).toBe('a\\[b\\]c')
    expect(escapeRegExp('a{b}c')).toBe('a\\{b\\}c')
    expect(escapeRegExp('a|b')).toBe('a\\|b')
    expect(escapeRegExp('a\\b')).toBe('a\\\\b')
    expect(escapeRegExp('a/b')).toBe('a\\/b')
  })

  it('普通文本不变', () => {
    expect(escapeRegExp('hello')).toBe('hello')
    expect(escapeRegExp('Hello123')).toBe('Hello123')
    expect(escapeRegExp('你好世界')).toBe('你好世界')
  })

  it('空字符串 → 返回空字符串', () => {
    expect(escapeRegExp('')).toBe('')
  })
})

// ─── 集成:搜索 → 高亮管道 ───
describe('integration: search + highlight pipeline', () => {
  it('搜索 "hello" → 匹配消息高亮 + 正确返回 ID 列表', () => {
    const ids = searchMessages(sampleMessages, 'hello')
    expect(ids).toEqual(['m1', 'm3'])
    // 对第一条匹配消息的内容做高亮
    const m1 = sampleMessages.find((m) => m.id === 'm1')!
    const highlighted = highlightMatch(m1.content, 'hello')
    expect(highlighted).toContain('<mark')
    expect(highlighted).toContain('Hello')
  })

  it('搜索 "auth" → 部分匹配多条 + 每条均可高亮', () => {
    const ids = searchMessages(sampleMessages, 'auth')
    expect(ids).toEqual(['m2', 'm5'])
    for (const id of ids) {
      const msg = sampleMessages.find((m) => m.id === id)!
      const highlighted = highlightMatch(msg.content, 'auth')
      expect(highlighted).toContain('<mark')
    }
  })

  it('搜索含正则特殊字符的查询(如 "user.auth") → 不报错 + 正确匹配', () => {
    const messages: SearchableMessage[] = [
      { id: 'a', content: 'user.auth flow' },
      { id: 'b', content: 'userXauthYflow' },
    ]
    // "user.auth" 中的 "." 应被转义为字面量,不匹配 "userXauth"
    const ids = searchMessages(messages, 'user.auth')
    expect(ids).toEqual(['a'])
    const highlighted = highlightMatch(messages[0]!.content, 'user.auth')
    expect(highlighted).toContain('<mark')
  })
})
