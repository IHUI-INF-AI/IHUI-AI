// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

// 深化N(2026-11-17):子代理展示排序测试。
// 钉住:① 待审批置顶;② 运行中 > 失败 > 完成;③ 同级保持原顺序(稳定不跳);
//       ④ 纯函数不改原数组;⑤ 空数组/未知状态兜底。

import { describe, expect, it } from 'vitest'
import type { Subagent } from '@/hooks/use-agent-progress'
import { sortSubagentsForDisplay } from '../subagent-display-sort'

/** 构造最小 Subagent(测试专用,只填排序相关字段) */
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

describe('sortSubagentsForDisplay 深化N:子代理展示排序', () => {
  it('待审批置顶(优先于一切状态)', () => {
    const list = [
      makeSa({ id: 'done1', status: 'done' }),
      makeSa({ id: 'appr', status: 'running', pendingApproval: true }),
      makeSa({ id: 'run1', status: 'running' }),
    ]
    const sorted = sortSubagentsForDisplay(list)
    expect(sorted[0]?.id).toBe('appr')
  })

  it('整体优先级:待审批 > 运行中 > 失败 > 完成', () => {
    const list = [
      makeSa({ id: 'done', status: 'done' }),
      makeSa({ id: 'failed', status: 'failed' }),
      makeSa({ id: 'running', status: 'running' }),
      makeSa({ id: 'appr', status: 'spawned', pendingApproval: true }),
    ]
    const sorted = sortSubagentsForDisplay(list)
    expect(sorted.map((s) => s.id)).toEqual(['appr', 'running', 'failed', 'done'])
  })

  it('同优先级保持原顺序(稳定排序,不跳)', () => {
    const list = [
      makeSa({ id: 'a', status: 'running' }),
      makeSa({ id: 'b', status: 'running' }),
      makeSa({ id: 'c', status: 'running' }),
    ]
    const sorted = sortSubagentsForDisplay(list)
    expect(sorted.map((s) => s.id)).toEqual(['a', 'b', 'c'])
  })

  it('纯函数:不改原数组,返回新数组', () => {
    const list = [
      makeSa({ id: 'done', status: 'done' }),
      makeSa({ id: 'running', status: 'running' }),
    ]
    const originalOrder = [...list]
    const sorted = sortSubagentsForDisplay(list)
    // 原数组顺序不变
    expect(list.map((s) => s.id)).toEqual(originalOrder.map((s) => s.id))
    // 返回的是新数组(不同引用)
    expect(sorted).not.toBe(list)
  })

  it('空数组 ⇒ 空数组', () => {
    expect(sortSubagentsForDisplay([])).toEqual([])
  })

  it('spawned 与 running 同档(都在运行档,按原顺序)', () => {
    const list = [
      makeSa({ id: 'spawned1', status: 'spawned' }),
      makeSa({ id: 'running1', status: 'running' }),
    ]
    const sorted = sortSubagentsForDisplay(list)
    // 两者同优先级,保持原顺序
    expect(sorted.map((s) => s.id)).toEqual(['spawned1', 'running1'])
  })

  it('failed 与 dead 同档(都在失败档)', () => {
    const list = [
      makeSa({ id: 'dead1', status: 'dead' }),
      makeSa({ id: 'failed1', status: 'failed' }),
      makeSa({ id: 'run1', status: 'running' }),
    ]
    const sorted = sortSubagentsForDisplay(list)
    expect(sorted.map((s) => s.id)).toEqual(['run1', 'dead1', 'failed1'])
  })
})