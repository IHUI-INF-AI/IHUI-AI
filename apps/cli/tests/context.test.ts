import { describe, expect, it } from 'vitest'
import {
  estimateTokens,
  estimateMessagesTokens,
  compressContext,
} from '../src/context.js'

describe('estimateTokens', () => {
  it('空字符串返回 0', () => {
    expect(estimateTokens('')).toBe(0)
  })

  it('纯 ASCII 文本 1 字符 ≈ 0.25 token(>=1)', () => {
    // 4 chars 约 1 token
    const tokens = estimateTokens('abcd')
    expect(tokens).toBeGreaterThanOrEqual(1)
  })

  it('中文字符使用 gpt-tokenizer 真实估算', () => {
    // "你好世界" = 4 中文字符
    const tokens = estimateTokens('你好世界')
    expect(tokens).toBeGreaterThan(0)
  })
})

describe('estimateMessagesTokens', () => {
  it('空数组返回 0', () => {
    expect(estimateMessagesTokens([])).toBe(0)
  })

  it('多条消息累加', () => {
    const total = estimateMessagesTokens([
      { role: 'system', content: 'hi' },
      { role: 'user', content: 'hello' },
    ])
    expect(total).toBeGreaterThan(0)
  })
})

describe('compressContext', () => {
  it('消息数 <= 尾部 N 时不压缩', () => {
    const messages = [
      { role: 'system' as const, content: 'sys' },
      { role: 'user' as const, content: 'u1' },
      { role: 'assistant' as const, content: 'a1' },
    ]
    const r = compressContext(messages, { keepRecent: 6 })
    expect(r.messages).toHaveLength(3)
    expect(r.compressed).toBe(false)
  })

  it('消息数 > 尾部 N 时压缩中段', () => {
    const longContent = '这是一段比较长的消息内容,用于让token计数达到压缩阈值。' .repeat(50)
    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: longContent },
      { role: 'user', content: longContent + '_u1' },
      { role: 'assistant', content: longContent + '_a1' },
      { role: 'user', content: longContent + '_u2' },
      { role: 'assistant', content: longContent + '_a2' },
      { role: 'user', content: longContent + '_u3' },
      { role: 'assistant', content: longContent + '_a3' },
      { role: 'user', content: longContent + '_u4' },
      { role: 'assistant', content: longContent + '_a4' },
    ]
    // keepRecent=2 + maxTokens=2000 强制压缩
    const r = compressContext(messages, { keepRecent: 2, maxTokens: 2000 })
    expect(r.compressed).toBe(true)
    expect(r.messages.length).toBeLessThan(messages.length)
  })

  it('maxTokens 触发压缩', () => {
    const longText = 'x'.repeat(2000)
    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: longText },
      { role: 'user', content: longText },
      { role: 'assistant', content: longText },
    ]
    // keepRecent=1 让 messages.length(3) > keepRecent+1(2) 满足压缩条件
    const r = compressContext(messages, { maxTokens: 10, keepRecent: 1 })
    expect(r.compressed).toBe(true)
  })

  it('压缩后仍含 system 消息', () => {
    // gpt-tokenizer 对 'A' 字符约 0.13 tokens/char,500 'A' ≈ 65 tokens
    // 8 messages * 65 = 520 tokens,加 overhead ≈ 558 tokens,maxTokens=100 不够 → 压缩触发
    const longContent = 'A'.repeat(500)
    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: 'important system' },
      { role: 'user', content: longContent + '_u1' },
      { role: 'assistant', content: longContent + '_a1' },
      { role: 'user', content: longContent + '_u2' },
      { role: 'assistant', content: longContent + '_a2' },
      { role: 'user', content: longContent + '_u3' },
      { role: 'assistant', content: longContent + '_a3' },
      { role: 'user', content: longContent + '_u4' },
      { role: 'assistant', content: longContent + '_a4' },
    ]
    const r = compressContext(messages, { keepRecent: 1, maxTokens: 100 })
    expect(r.compressed).toBe(true)
    expect(r.messages[0]?.role).toBe('system')
    expect(r.messages[0]?.content).toBe('important system')
  })
})
