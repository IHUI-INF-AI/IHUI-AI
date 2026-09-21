// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect } from 'vitest'
import type { ChatMessage } from '@/stores/chat'
import { shouldShowStreamingSkeleton } from './streaming-skeleton'

const userMsg = (content: string): ChatMessage =>
  ({ id: `u-${content}`, role: 'user', content, createdAt: 0 }) as ChatMessage

const assistantMsg = (over: Partial<ChatMessage> = {}): ChatMessage =>
  ({
    id: `a-${Math.random()}`,
    role: 'assistant',
    content: '',
    createdAt: 0,
    ...over,
  }) as ChatMessage

describe('shouldShowStreamingSkeleton', () => {
  it('未流式时不显示(即使最后一条是 user)', () => {
    expect(shouldShowStreamingSkeleton([userMsg('你好')], false)).toBe(false)
  })

  it('消息为空时不显示', () => {
    expect(shouldShowStreamingSkeleton([], true)).toBe(false)
  })

  it('流式中且最后一条是 user → 显示(等 AI 首帧)', () => {
    expect(shouldShowStreamingSkeleton([userMsg('你好')], true)).toBe(true)
  })

  it('流式中助手消息为空壳(无正文/推理/工具) → 显示', () => {
    expect(shouldShowStreamingSkeleton([userMsg('嗨'), assistantMsg()], true)).toBe(true)
  })

  it('助手消息已有正文 → 首帧已到,不显示', () => {
    expect(
      shouldShowStreamingSkeleton([userMsg('嗨'), assistantMsg({ content: '在的' })], true),
    ).toBe(false)
  })

  it('助手消息已有 reasoning(等价 thinking 事件) → 不显示', () => {
    expect(
      shouldShowStreamingSkeleton([userMsg('嗨'), assistantMsg({ reasoning: '让我想想' })], true),
    ).toBe(false)
  })

  it('助手消息已有 toolCalls(工具事件) → 不显示', () => {
    expect(
      shouldShowStreamingSkeleton(
        [userMsg('嗨'), assistantMsg({ toolCalls: [{ id: 't1', toolName: 'ls' }] as any })],
        true,
      ),
    ).toBe(false)
  })

  it('多轮会话:当前轮助手空壳仍需骨架(历史轮已完成不影响)', () => {
    expect(
      shouldShowStreamingSkeleton(
        [userMsg('第一轮'), assistantMsg({ content: '答1' }), userMsg('第二轮'), assistantMsg()],
        true,
      ),
    ).toBe(true)
  })

  it('多轮会话:当前轮助手已有正文 → 不显示', () => {
    expect(
      shouldShowStreamingSkeleton(
        [
          userMsg('第一轮'),
          assistantMsg({ content: '答1' }),
          userMsg('第二轮'),
          assistantMsg({ content: '答2' }),
        ],
        true,
      ),
    ).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
