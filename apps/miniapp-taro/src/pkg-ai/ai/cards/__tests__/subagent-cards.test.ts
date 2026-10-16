// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D64④(2026-10-14):subagent 三帧 → 八态卡归并纯函数的性质测试。
// 对齐 RN 9becc88f4 的口径:状态词汇收敛到共享 element-pack backgroundTaskView,
// 端内只做 wire 词汇('done'|'failed')→ 八态的桥接;本测试锁四条性质:
// spawn upsert 幂等 / progress 不改状态 / end 归并终态不回退 / 键名唯一出口。
import { describe, expect, it } from 'vitest'

import {
  applySubagentEnd,
  applySubagentProgress,
  subagentEndToTaskState,
  upsertSubagentSpawn,
  type SubagentTaskView,
} from '../types'
import { backgroundTaskView, isBackgroundTaskState } from '@ihui/shared/chat/element-pack'

const spawn = { id: 'sa-1', role: 'validator', task: '校验第 3 步输出' }
const running: SubagentTaskView[] = [
  { id: 'sa-1', role: 'validator', task: '校验第 3 步输出', status: 'running' },
]

describe('upsertSubagentSpawn(D64④ spawn 帧)', () => {
  it('空列表 → 新建 running 卡', () => {
    expect(upsertSubagentSpawn([], spawn)).toEqual(running)
  })

  it('同 id 重放幂等(不产生第二张卡,不回退已收敛的终态)', () => {
    const ended: SubagentTaskView[] = [
      { id: 'sa-1', role: 'validator', task: '校验第 3 步输出', status: 'completed' },
    ]
    expect(upsertSubagentSpawn(ended, spawn)).toEqual(ended)
  })

  it('空 id 整帧丢弃(宁丢不造)', () => {
    expect(upsertSubagentSpawn([], { ...spawn, id: '' })).toEqual([])
  })
})

describe('applySubagentProgress(D64④ progress 帧)', () => {
  it('更新 currentPhase,不改 running 状态', () => {
    const next = applySubagentProgress(running, { id: 'sa-1', phase: 'tool_call' })
    expect(next).toEqual([{ ...running[0], currentPhase: 'tool_call' }])
  })

  it('卡不存在不凭空造条目(end 缺 spawn 属上游乱序)', () => {
    expect(applySubagentProgress([], { id: 'sa-x', phase: 'thinking' })).toEqual([])
  })
})

describe('applySubagentEnd(D64④ end 帧)', () => {
  it("done → completed(completed 的 tone=success,busy=false,terminal=true)", () => {
    const next = applySubagentEnd(running, { id: 'sa-1', status: 'done' })
    const task = next[0]
    if (!task) throw new Error('expected task')
    expect(task.status).toBe('completed')
    const view = backgroundTaskView(task.status)
    expect(view.tone).toBe('success')
    expect(view.busy).toBe(false)
    expect(view.terminal).toBe(true)
  })

  it("failed 保留 failureReason 且 tone=danger(失败显式,不伪装成取消)", () => {
    const next = applySubagentEnd(running, {
      id: 'sa-1',
      status: 'failed',
      failureReason: 'timeout after 3 retries',
    })
    const task = next[0]
    if (!task) throw new Error('expected task')
    expect(task.status).toBe('failed')
    expect(task.failureReason).toBe('timeout after 3 retries')
    expect(backgroundTaskView(task.status).tone).toBe('danger')
  })

  it('终态不被后到的 progress 回退成 running 期阶段写回', () => {
    const ended = applySubagentEnd(running, { id: 'sa-1', status: 'done' })
    const touched = applySubagentProgress(ended, { id: 'sa-1', phase: 'output_ready' })
    const task = touched[0]
    if (!task) throw new Error('expected task')
    expect(task.status).toBe('completed')
  })

  it('卡存在才归并;卡不存在丢帧不造空壳', () => {
    expect(applySubagentEnd([], { id: 'sa-x', status: 'failed' })).toEqual([])
  })
})

describe('subagentEndToTaskState(wire 桥接)与键名出口', () => {
  it("'done' | 'failed' 两词汇穷尽归并到八态", () => {
    expect(subagentEndToTaskState('done')).toBe('completed')
    expect(subagentEndToTaskState('failed')).toBe('failed')
  })

  it('归并产物全部落在八态词汇内(渲染层 backgroundTaskView 必可派发)', () => {
    for (const wire of ['done', 'failed'] as const) {
      expect(isBackgroundTaskState(subagentEndToTaskState(wire))).toBe(true)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
