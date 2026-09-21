// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * planSteps 回放(2026-09-21 立,零 schema 迁移)端到端往返断言。
 *
 * 数据流覆盖:
 *   plan_updated SSE 快照(ai-service _build_plan_snapshot)
 *     → /api/ai/callback body.planSteps
 *     → ai-callback-worker 浅合并进 chat_messages.metadata(jsonb)
 *     → getMessages 返回 metadata
 *     → hydrateHistoryMessage 映射回 message.planSteps
 * 断言:字段逐条等价 + 向后兼容(老消息无 key 不报错、不造空态)。
 */
import { describe, it, expect } from 'vitest'
import type { PlanStep } from '@ihui/types'
import {
  hydrateHistoryMessage,
  hydrateHistoryMessages,
  type HistoryMessageRecord,
} from '@/hooks/use-chat/history-message'

/** 与 apps/ai-service/tests/test_plan_steps_persistence.py 的 _HISTORY 快照同源 */
const SSE_PLAN: PlanStep[] = [
  {
    id: 'tc-1',
    step: 'run_command: ls -la',
    status: 'completed',
    toolCallIds: ['tc-1'],
    startedAt: '2026-09-21T10:00:00+00:00',
    endedAt: '2026-09-21T10:00:01+00:00',
    durationMs: 1000,
  },
  { id: 'tc-2', step: 'read_file: a.txt', status: 'in_progress' },
  {
    id: 'tc-3',
    step: 'run_command: rm -rf /tmp/x',
    status: 'failed',
    toolCallIds: ['tc-3'],
    error: true,
  },
]

function row(metadata: Record<string, unknown> | null): HistoryMessageRecord {
  return {
    id: 'msg-1',
    role: 'assistant',
    content: '已完成 3 步',
    reasoning: undefined,
    createdAt: '2026-09-21T10:00:02.000Z',
    metadata,
  }
}

describe('hydrateHistoryMessage planSteps 回放', () => {
  it('metadata.planSteps → message.planSteps 字段等价(落库后逐字段不变形)', () => {
    const msg = hydrateHistoryMessage(
      row({ model: 'stepfun/step-3.7-flash', toolCalls: [{ id: 'tc-1' }], planSteps: SSE_PLAN }),
    )
    expect(msg.planSteps).toEqual(SSE_PLAN)
    // 同一条 metadata 的其他字段不被读回逻辑挤掉
    expect(msg.toolCalls).toEqual([{ id: 'tc-1' }])
    expect(msg.model).toBe('stepfun/step-3.7-flash')
    expect(msg.createdAt).toBe(new Date('2026-09-21T10:00:02.000Z').getTime())
  })

  it('老消息无 planSteps key → undefined(不造空数组,UI 安静缺席)', () => {
    const msg = hydrateHistoryMessage(row({ toolCalls: [{ id: 'tc-1' }] }))
    expect(msg.planSteps).toBeUndefined()
    expect('planSteps' in msg).toBe(true)
    expect(msg.toolCalls).toEqual([{ id: 'tc-1' }])
  })

  it('metadata 为 null / 缺失 → 不报错', () => {
    expect(hydrateHistoryMessage(row(null)).planSteps).toBeUndefined()
    expect(
      hydrateHistoryMessages([
        { id: 'm', role: 'user', content: 'hi', createdAt: '2026-09-21T10:00:00.000Z' },
      ])[0]?.planSteps,
    ).toBeUndefined()
  })

  it('脏 metadata(非数组 / 缺关键字段的条目)逐条守卫,不整体采信', () => {
    expect(hydrateHistoryMessage(row({ planSteps: 'nope' })).planSteps).toBeUndefined()
    expect(hydrateHistoryMessage(row({ planSteps: [] })).planSteps).toBeUndefined()
    expect(hydrateHistoryMessage(row({ planSteps: [{ foo: 1 }] })).planSteps).toBeUndefined()
    const mixed = hydrateHistoryMessage(
      row({ planSteps: [{ id: 'x', step: 's', status: 'completed' }, null, 42] }),
    ).planSteps
    expect(mixed).toEqual([{ id: 'x', step: 's', status: 'completed' }])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
