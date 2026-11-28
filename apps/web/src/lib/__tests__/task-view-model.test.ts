// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'

import type { AgentTaskView } from '../agent-task-view'
import {
  buildConversationTaskAttention,
  mergeTaskViewsByConversation,
  normalizeTaskList,
  toTaskView,
} from '../task-view-model'

function task(overrides: Partial<AgentTaskView> & Pick<AgentTaskView, 'taskId'>): AgentTaskView {
  return {
    goal: overrides.taskId,
    status: 'completed',
    iterations: 1,
    ...overrides,
  }
}

describe('task-view-model 统一任务读模型', () => {
  it('规整任务时保留来源，并标记需要用户注意的状态', () => {
    const running = toTaskView(task({ taskId: 'run', status: 'running' }), 'background')
    expect(running.source).toBe('background')
    expect(running.needsAttention).toBe(true)

    const done = toTaskView(task({ taskId: 'done', status: 'completed' }))
    expect(done.source).toBe('workspace')
    expect(done.needsAttention).toBe(false)

    const canceledWithStaleApproval = toTaskView(
      task({
        taskId: 'canceled',
        status: 'canceled',
        steps: [{ iteration: 1, type: 'tool_call', content: '{}', approval: { state: 'pending' } }],
      }),
    )
    expect(canceledWithStaleApproval.needsAttention).toBe(false)
  })

  it('当前任务按 conversationId 合并，优先保留运行中的那条', () => {
    const oldCompleted = toTaskView(
      task({
        taskId: 'old',
        conversationId: 'conv-1',
        status: 'completed',
        updatedAt: '2026-11-27T08:00:00.000Z',
      }),
    )
    const running = toTaskView(
      task({
        taskId: 'new',
        conversationId: 'conv-1',
        status: 'running',
        updatedAt: '2026-11-27T07:00:00.000Z',
      }),
    )
    const unrelated = toTaskView(
      task({ taskId: 'other', conversationId: 'conv-2', status: 'completed' }),
    )

    const merged = mergeTaskViewsByConversation([oldCompleted, running, unrelated])
    expect(merged.map((item) => item.taskId)).toEqual(['new', 'other'])
  })

  it('没有 conversationId 的历史任务不会被错误合并', () => {
    const first = toTaskView(
      task({ taskId: 'a', status: 'completed', updatedAt: '2026-11-27T08:00:00.000Z' }),
    )
    const second = toTaskView(
      task({ taskId: 'b', status: 'completed', updatedAt: '2026-11-26T08:00:00.000Z' }),
    )
    expect(mergeTaskViewsByConversation([first, second]).map((item) => item.taskId)).toEqual([
      'a',
      'b',
    ])
  })

  it('运行中的任务投影到对应会话，等待审批时同时标记 waiting', () => {
    const waiting = toTaskView(
      task({
        taskId: 'waiting',
        conversationId: 'conv-1',
        status: 'running',
        steps: [
          {
            iteration: 1,
            type: 'tool_call',
            content: '{}',
            approval: { state: 'pending' },
          },
        ],
      }),
    )
    const backgroundOnly = toTaskView(task({ taskId: 'background', status: 'running' }))

    const attention = buildConversationTaskAttention([waiting, backgroundOnly])
    expect(attention['conv-1']).toEqual({ running: true, waiting: true })
    expect(attention['background']).toBeUndefined()
  })

  it('normalizeTaskList 可按当前视图合并，历史视图保留每次运行', () => {
    const tasks = [
      task({ taskId: 'a', conversationId: 'conv-1', status: 'completed' }),
      task({ taskId: 'b', conversationId: 'conv-1', status: 'running' }),
    ]
    expect(normalizeTaskList(tasks, { mergeByConversation: true })).toHaveLength(1)
    expect(normalizeTaskList(tasks, { mergeByConversation: false })).toHaveLength(2)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
