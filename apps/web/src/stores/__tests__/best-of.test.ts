// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeEach } from 'vitest'
import { useBestOfStore } from '../best-of'
import type { BestOfNResultData } from '@/api/best-of-api'

function makeResult(runId: string): BestOfNResultData {
  return {
    winner: {
      candidate_id: 1,
      content: `内容 ${runId}`,
      model: 'm1',
      ok: true,
      error: '',
      score: 90,
      latency_ms: 100,
    },
    candidates: [
      {
        candidate_id: 1,
        content: `内容 ${runId}`,
        model: 'm1',
        ok: true,
        error: '',
        score: 90,
        latency_ms: 100,
      },
    ],
    nRequested: 1,
    evaluatorModel: 'eval',
    evaluatorFallback: false,
    rationale: '',
    totalCostUsd: 0.01,
    runId,
  }
}

/**
 * P3 #36 多模型并排对比 store 测试(2026-09-16 立)
 *
 * 覆盖:setResult 同时写单卡视图字段与 runId 映射 / 映射上限 5 条裁剪 /
 * setSelected / clear。
 */
describe('best-of store(P3 #36 runId 映射)', () => {
  beforeEach(() => {
    useBestOfStore.setState({ task: '', result: null, selectedId: null, results: {}, tasks: {} })
  })

  it('setResult 同时写单卡字段(task/result)与 runId 映射(results/tasks)', () => {
    useBestOfStore.getState().setResult('任务 A', makeResult('run-1'))
    const s = useBestOfStore.getState()
    expect(s.result?.runId).toBe('run-1')
    expect(s.task).toBe('任务 A')
    expect(s.results['run-1']?.winner.content).toBe('内容 run-1')
    expect(s.tasks['run-1']).toBe('任务 A')
  })

  it('多次 setResult:映射累积保留历史 runId,单卡字段指向最新', () => {
    const st = useBestOfStore.getState()
    st.setResult('任务 1', makeResult('run-1'))
    st.setResult('任务 2', makeResult('run-2'))
    const s = useBestOfStore.getState()
    expect(Object.keys(s.results).sort()).toEqual(['run-1', 'run-2'])
    expect(s.result?.runId).toBe('run-2')
    expect(s.task).toBe('任务 2')
  })

  it('映射上限 5 条:超出时最旧的被裁掉', () => {
    const st = useBestOfStore.getState()
    for (let i = 1; i <= 7; i++) {
      st.setResult(`任务 ${i}`, makeResult(`run-${i}`))
    }
    const s = useBestOfStore.getState()
    expect(Object.keys(s.results)).toHaveLength(5)
    expect(s.results['run-1']).toBeUndefined()
    expect(s.results['run-2']).toBeUndefined()
    expect(s.results['run-7']).toBeDefined()
  })

  it('setSelected 更新改选 id', () => {
    useBestOfStore.getState().setResult('任务', makeResult('run-1'))
    useBestOfStore.getState().setSelected(2)
    expect(useBestOfStore.getState().selectedId).toBe(2)
  })

  it('clear 清空全部(含映射)', () => {
    const st = useBestOfStore.getState()
    st.setResult('任务', makeResult('run-1'))
    st.clear()
    const s = useBestOfStore.getState()
    expect(s.result).toBeNull()
    expect(s.task).toBe('')
    expect(s.results).toEqual({})
    expect(s.tasks).toEqual({})
  })
})
