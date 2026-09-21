// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect } from 'vitest'
import type { ChatMessage } from '@/stores/chat'
import { deriveLocatorAnchors } from './conversation-locator-rail'

const user = (id: string, content: string): ChatMessage =>
  ({ id, role: 'user', content, createdAt: 0 }) as ChatMessage
const assistant = (id: string, content = ''): ChatMessage =>
  ({ id, role: 'assistant', content, createdAt: 0 }) as ChatMessage

describe('deriveLocatorAnchors', () => {
  it('无用户消息 → 空锚点', () => {
    expect(deriveLocatorAnchors([assistant('a1', '我是助手')])).toHaveLength(0)
  })

  it('空内容用户消息不计入', () => {
    expect(deriveLocatorAnchors([user('u1', '   ')])).toHaveLength(0)
  })

  it('单条用户消息 → 1 个锚点', () => {
    const anchors = deriveLocatorAnchors([user('u1', '你好')])
    expect(anchors).toHaveLength(1)
    expect(anchors[0]!.id).toBe('u1')
  })

  it('≥3 条用户消息 → ≥3 个刻度', () => {
    const msgs = [
      user('u1', '第一条'),
      assistant('a1', '答1'),
      user('u2', '第二条'),
      assistant('a2', '答2'),
      user('u3', '第三条'),
    ]
    const anchors = deriveLocatorAnchors(msgs)
    expect(anchors.length).toBeGreaterThanOrEqual(3)
    expect(anchors.map((a) => a.id)).toEqual(['u1', 'u2', 'u3'])
  })

  it('锚点 id 与用户消息一一对应,助手消息被忽略', () => {
    const anchors = deriveLocatorAnchors([user('u1', 'a'), user('u2', 'b')])
    expect(anchors.map((a) => a.id)).toEqual(['u1', 'u2'])
  })

  it('预览超过 40 字截断并追加省略号', () => {
    const long = '一'.repeat(60)
    const anchors = deriveLocatorAnchors([user('u1', long)])
    expect(anchors[0]!.preview).toBe(`${'一'.repeat(40)}…`)
  })

  it('预览 ≤40 字不截断', () => {
    const short = '二'.repeat(20)
    const anchors = deriveLocatorAnchors([user('u1', short)])
    expect(anchors[0]!.preview).toBe(short)
  })

  it('空白被折叠后若为空则不计入', () => {
    expect(deriveLocatorAnchors([user('u1', '\n  \t ')])).toHaveLength(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
