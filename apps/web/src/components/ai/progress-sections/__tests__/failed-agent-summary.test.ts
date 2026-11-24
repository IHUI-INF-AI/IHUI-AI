// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 深化Q(2026-11-17):批次失败子代理折叠态归因行测试。
// 钉住:① 只取 failed/dead;② handle + 已知归因标签 + 截断原因;③ 无已知桶用原始原因;
//       ④ 超长原因截断;⑤ 无失败返回空数组。

import { describe, expect, it } from 'vitest'
import type { Subagent } from '@/hooks/use-agent-progress'
import { extractFailedAgentSummaries, FAILED_SUMMARY_MAX } from '../failed-agent-summary'

function makeSa(overrides: Partial<Subagent> & { id: string }): Subagent {
  return {
    threadId: overrides.id,
    nickname: overrides.id,
    handle: `@${overrides.id}`,
    color: 'cyan',
    status: 'done',
    spawnedAt: '2026-11-17T00:00:00Z',
    ...overrides,
  } as Subagent
}

describe('extractFailedAgentSummaries 深化Q:失败子代理折叠态归因', () => {
  it('只取 failed/dead 状态,成功/运行中的不进列表', () => {
    const list = [
      makeSa({ id: 'done', status: 'done', failureReason: 'should not appear' }),
      makeSa({ id: 'run', status: 'running' }),
      makeSa({ id: 'fail1', status: 'failed', failureReason: 'HTTP 429' }),
      makeSa({ id: 'dead1', status: 'dead', failureReason: 'connection lost' }),
    ]
    const summaries = extractFailedAgentSummaries(list)
    expect(summaries).toHaveLength(2)
    expect(summaries.map((s) => s.id)).toEqual(['fail1', 'dead1'])
  })

  it('已知失败桶用归因标签(rate_limited→"限流")', () => {
    const list = [
      makeSa({ id: 'a', status: 'failed', failureKind: 'rate_limited', failureReason: 'HTTP 429' }),
    ]
    const [summary] = extractFailedAgentSummaries(list)
    expect(summary?.kindLabel).toBe('限流')
    expect(summary?.handle).toBe('@a')
    expect(summary?.reason).toBe('HTTP 429')
  })

  it('无已知桶(kindLabel=null)时仍带原始原因', () => {
    const list = [
      makeSa({ id: 'b', status: 'failed', failureKind: 'unknown_kind', failureReason: 'weird error' }),
    ]
    const [summary] = extractFailedAgentSummaries(list)
    expect(summary?.kindLabel).toBeNull()
    expect(summary?.reason).toBe('weird error')
  })

  it('超长原因截断到 60 字符 + 省略号', () => {
    const longReason = 'x'.repeat(100)
    const list = [makeSa({ id: 'c', status: 'failed', failureReason: longReason })]
    const [summary] = extractFailedAgentSummaries(list)
    expect(summary?.reason).not.toBeNull()
    expect((summary?.reason as string).length).toBe(61) // 60 + '…'
    expect((summary?.reason as string).endsWith('…')).toBe(true)
  })

  it('无 failureReason 时 reason=null,不造残标', () => {
    const list = [makeSa({ id: 'd', status: 'failed' })]
    const [summary] = extractFailedAgentSummaries(list)
    expect(summary?.kindLabel).toBeNull()
    expect(summary?.reason).toBeNull()
  })

  it('无失败子代理 ⇒ 空数组', () => {
    const list = [
      makeSa({ id: 'ok1', status: 'done' }),
      makeSa({ id: 'ok2', status: 'running' }),
    ]
    expect(extractFailedAgentSummaries(list)).toEqual([])
  })

  it('空输入 ⇒ 空数组', () => {
    expect(extractFailedAgentSummaries([])).toEqual([])
  })

  it('FAILED_SUMMARY_MAX 常量导出为正数(渲染层依赖)', () => {
    expect(FAILED_SUMMARY_MAX).toBeGreaterThan(0)
    expect(typeof FAILED_SUMMARY_MAX).toBe('number')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
