// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * "正在压缩上下文"预告态门控单元测试(2026-09-21 立)。
 *
 * 回归背景:原实现每次发送无条件点亮 compacting(与是否真的压缩无关),
 * 且只靠 onResponse 清除 → 响应头之前失败/abort/stop/切会话时灰条全站常驻。
 * 本文件锁住"门控"这一半:占用率未达后端 DEFAULT_TRIGGER_RATIO 一律不预告。
 */

import { describe, it, expect } from 'vitest'
import { DEFAULT_TRIGGER_RATIO } from '@ihui/shared/constants'
import {
  estimateChatMessagesTokens,
  isContextAtCompactionThreshold,
} from '../src/lib/token-estimate'
import type { ChatMessage } from '../src/stores/chat'

const LONG = '上下文压缩阈值门控回归用例。'.repeat(400)

const msg = (role: ChatMessage['role'], content: string, extra?: { error?: string }): ChatMessage =>
  ({ role, content, ...(extra ? extra : {}) }) as ChatMessage

/** 造一组消息,返回其估算 token 数(与阈值判据同源,避免用例里写死 token 常量) */
function corpus(): { messages: ChatMessage[]; tokens: number } {
  const messages = [
    msg('user', LONG),
    msg('assistant', LONG),
    msg('user', LONG),
    msg('assistant', LONG),
  ]
  return { messages, tokens: estimateChatMessagesTokens(messages) }
}

describe('isContextAtCompactionThreshold', () => {
  it('后端触发阈值是 88%(与 @ihui/context-compaction DEFAULT_TRIGGER_RATIO 同源)', () => {
    expect(DEFAULT_TRIGGER_RATIO).toBe(0.88)
  })

  it('空上下文永不预告', () => {
    expect(isContextAtCompactionThreshold([], 128_000)).toBe(false)
  })

  it('contextLimit 非正数时不预告(无法判定占用率,宁可不显示)', () => {
    const { messages } = corpus()
    expect(isContextAtCompactionThreshold(messages, 0)).toBe(false)
    expect(isContextAtCompactionThreshold(messages, -1)).toBe(false)
  })

  it('占用率远低于阈值 → false(修复前:每次发送都会显示)', () => {
    const { messages, tokens } = corpus()
    expect(tokens).toBeGreaterThan(0)
    expect(isContextAtCompactionThreshold(messages, tokens * 2)).toBe(false)
  })

  it('占用率恰好落在阈值 → true', () => {
    const { messages, tokens } = corpus()
    expect(
      isContextAtCompactionThreshold(messages, Math.floor(tokens / DEFAULT_TRIGGER_RATIO)),
    ).toBe(true)
  })

  it('占用率超过阈值 → true', () => {
    const { messages, tokens } = corpus()
    expect(isContextAtCompactionThreshold(messages, tokens)).toBe(true)
  })

  it('error 消息不计入占用(与实际发给后端的 history 过滤口径一致)', () => {
    const { messages, tokens } = corpus()
    const withErrors = [
      ...messages,
      msg('assistant', LONG, { error: 'boom' }),
      msg('assistant', LONG, { error: 'boom' }),
    ]
    expect(estimateChatMessagesTokens(withErrors)).toBe(tokens)
    expect(isContextAtCompactionThreshold(withErrors, tokens * 2)).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
