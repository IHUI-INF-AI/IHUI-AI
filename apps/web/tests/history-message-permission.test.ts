// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 历史水合的权限档恢复(G-165)。
// 上一版徽章只存在于内存:刷新即丢,小程序/RN 完全看不到(D111 的根因之一)。
// 这里锁住"从服务端盖章的 metadata 恢复"这条新链路,含两类静默错:
// 把未知拼写丢掉、以及缺失时编造 'default'。
import { describe, expect, it } from 'vitest'

import { hydrateHistoryMessage, type HistoryMessageRecord } from '@/hooks/use-chat/history-message'

const row = (metadata: Record<string, unknown> | null): HistoryMessageRecord =>
  ({
    id: 'm-1',
    conversationId: 'c-1',
    role: 'assistant',
    content: '回答',
    tokens: 12,
    metadata,
    createdAt: '2026-09-22T10:00:00.000Z',
  }) as HistoryMessageRecord

describe('hydrateHistoryMessage 的档位恢复', () => {
  it('wire(kebab)盖章值恢复成徽章可用的档位', () => {
    expect(hydrateHistoryMessage(row({ permissionMode: 'accept-edits' })).permissionMode).toBe(
      'accept-edits',
    )
    expect(hydrateHistoryMessage(row({ permissionMode: 'plan' })).permissionMode).toBe('plan')
  })

  it('库里若是 camel 或历史别名也归一回 wire(不猜、不静默丢)', () => {
    expect(hydrateHistoryMessage(row({ permissionMode: 'acceptEdits' })).permissionMode).toBe(
      'accept-edits',
    )
    expect(hydrateHistoryMessage(row({ permissionMode: 'bypassPermissions' })).permissionMode).toBe(
      'bypass-permissions',
    )
  })

  it('没有盖章的老消息 → 字段留空,绝不编 default', () => {
    expect(hydrateHistoryMessage(row(null)).permissionMode).toBeUndefined()
    expect(hydrateHistoryMessage(row({})).permissionMode).toBeUndefined()
    expect(hydrateHistoryMessage(row({ permissionMode: 'yolo' })).permissionMode).toBeUndefined()
  })

  it('其余既有恢复逻辑不受影响(planSteps 缺失仍是 undefined 而非空数组)', () => {
    const m = hydrateHistoryMessage(row({ permissionMode: 'plan' }))
    expect(m.planSteps).toBeUndefined()
    expect(m.role).toBe('assistant')
    expect(m.content).toBe('回答')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
