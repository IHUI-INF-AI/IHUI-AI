// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import { describe, expect, it } from 'vitest'
import type { ChatSyncMessageSurface, ToolCall } from '@ihui/types'
import {
  applyChatSyncSurfaceMerge,
  planChatSyncSurfaceMerge,
  type ChatSyncSurfaceRow,
} from '../chat-sync-surface'

const TOOL: ToolCall = {
  id: 'call-1',
  toolName: 'read_file',
  args: { path: 'a.ts' },
  status: 'running',
}

function surface(overrides: Partial<ChatSyncMessageSurface> = {}): ChatSyncMessageSurface {
  return {
    id: 'm1',
    role: 'assistant',
    content: '正文',
    ...overrides,
  }
}

describe('chat-sync-surface 执行面投影', () => {
  it('本地行没有工具卡时,服务端执行面是变化而不是零变化', () => {
    const row: ChatSyncSurfaceRow = { id: 'm1', role: 'assistant', content: '正文' }
    const plan = planChatSyncSurfaceMerge([row], [surface({ toolCalls: [TOOL] })])
    expect(plan?.updates).toHaveLength(1)
    expect(plan?.updates[0]?.toolCalls).toEqual([TOOL])
    const next = applyChatSyncSurfaceMerge([row], plan!)
    expect(next[0]?.toolCalls).toEqual([TOOL])
  })

  it('同一数组引用 = 零变化;新数组 = 覆盖', () => {
    const calls = [TOOL]
    const row: ChatSyncSurfaceRow = {
      id: 'm1',
      role: 'assistant',
      content: '正文',
      toolCalls: calls,
    }
    expect(planChatSyncSurfaceMerge([row], [surface({ toolCalls: calls })])).toBeNull()
    const done = { ...TOOL, status: 'success' as const }
    const plan = planChatSyncSurfaceMerge([row], [surface({ toolCalls: [done] })])
    expect(plan?.updates[0]?.toolCalls).toEqual([done])
  })
})
