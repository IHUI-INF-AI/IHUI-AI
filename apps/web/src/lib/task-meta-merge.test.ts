// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect } from 'vitest'
import { foldTaskMetaCandidates, mergeTaskMetaPair, type TaskMetaCandidate } from './task-meta-merge'

function candidate(overrides: Partial<TaskMetaCandidate> & { taskId: string }): TaskMetaCandidate {
  return {
    createdAt: 1_000,
    updatedAt: 1_000,
    title: 'base title',
    ...overrides,
  }
}

describe('mergeTaskMetaPair 单调合并', () => {
  it('快照 updatedAt 早于乐观值:整体取乐观侧,时间不回退', () => {
    const snapshot = candidate({ taskId: 't1', updatedAt: 100, title: '旧标题' })
    const optimistic = candidate({ taskId: 't1', updatedAt: 200, title: '新标题' })
    const merged = mergeTaskMetaPair(snapshot, optimistic)
    expect(merged.updatedAt).toBe(200)
    expect(merged.title).toBe('新标题')
  })

  it('快照 updatedAt 更新:取快照侧,同样单调', () => {
    const snapshot = candidate({ taskId: 't1', updatedAt: 300, title: '快照标题' })
    const optimistic = candidate({ taskId: 't1', updatedAt: 200, title: '乐观标题' })
    const merged = mergeTaskMetaPair(snapshot, optimistic)
    expect(merged.updatedAt).toBe(300)
    expect(merged.title).toBe('快照标题')
  })

  it('updatedAt 相等用 title 长度打破平局', () => {
    const snapshot = candidate({ taskId: 't1', updatedAt: 100, title: '短' })
    const optimistic = candidate({ taskId: 't1', updatedAt: 100, title: '信息量更大的标题' })
    expect(mergeTaskMetaPair(snapshot, optimistic).title).toBe('信息量更大的标题')
    // 反向传入结果一致(判据与位置无关)
    expect(mergeTaskMetaPair(optimistic, snapshot).title).toBe('信息量更大的标题')
  })

  it('无 titleOverridden 的快照不覆盖手动重命名(时间虽新也不还原)', () => {
    const snapshot = candidate({
      taskId: 't1',
      updatedAt: 200,
      title: 'New session',
    })
    const optimistic = candidate({
      taskId: 't1',
      updatedAt: 100,
      title: '我的重命名',
      titleOverridden: true,
    })
    const merged = mergeTaskMetaPair(snapshot, optimistic)
    expect(merged.title).toBe('我的重命名')
    expect(merged.titleOverridden).toBe(true)
    // 时间仍单调取新值
    expect(merged.updatedAt).toBe(200)
  })

  it('"New session" 占位不覆盖真实标题;空标题同理', () => {
    const snapshot = candidate({ taskId: 't1', updatedAt: 200, title: 'New session' })
    const optimistic = candidate({ taskId: 't1', updatedAt: 100, title: '真实标题' })
    expect(mergeTaskMetaPair(snapshot, optimistic).title).toBe('真实标题')

    const empty = candidate({ taskId: 't2', updatedAt: 200, title: '  ' })
    const real = candidate({ taskId: 't2', updatedAt: 100, title: '真实标题' })
    expect(mergeTaskMetaPair(empty, real).title).toBe('真实标题')
  })

  it('自动生成的真实标题照常覆盖(非占位不受保护)', () => {
    const snapshot = candidate({ taskId: 't1', updatedAt: 200, title: '自动生成标题' })
    const optimistic = candidate({ taskId: 't1', updatedAt: 100, title: '旧标题' })
    expect(mergeTaskMetaPair(snapshot, optimistic).title).toBe('自动生成标题')
  })

  it('显式 unreadAt:undefined = 已读清除;未携带不误伤已有未读态', () => {
    const withUnread = candidate({ taskId: 't1', updatedAt: 100, unreadAt: 123 })

    // 乐观侧显式携带 undefined → 清除
    const cleared = mergeTaskMetaPair(withUnread, {
      ...candidate({ taskId: 't1', updatedAt: 200 }),
      unreadAt: undefined,
    } as TaskMetaCandidate)
    expect(cleared.unreadAt).toBeUndefined()

    // 乐观侧未携带该键 → 保留快照侧未读态
    const untouched = mergeTaskMetaPair(withUnread, candidate({ taskId: 't1', updatedAt: 200 }))
    expect(untouched.unreadAt).toBe(123)
  })

  it('status 回退:乐观层未带 status 不吞持久层 running/completed', () => {
    const completed = candidate({ taskId: 't1', updatedAt: 100, status: 'completed' })
    const optimisticNoStatus = candidate({ taskId: 't1', updatedAt: 200 })
    expect(mergeTaskMetaPair(completed, optimisticNoStatus).status).toBe('completed')

    const running = candidate({ taskId: 't2', updatedAt: 100, status: 'running' })
    expect(mergeTaskMetaPair(running, optimisticNoStatus).status).toBe('running')
  })

  it('乐观层自带 status=running 时不被较旧快照 completed 覆盖', () => {
    const snapshot = candidate({ taskId: 't1', updatedAt: 100, status: 'completed' })
    const optimistic = candidate({ taskId: 't1', updatedAt: 200, status: 'running' })
    expect(mergeTaskMetaPair(snapshot, optimistic).status).toBe('running')
  })

  it('changeSummary/model/provider 按胜出侧优先、缺者回退', () => {
    const snapshot = candidate({
      taskId: 't1',
      updatedAt: 300,
      changeSummary: '快照摘要',
      model: 'glm-5',
    })
    const optimistic = candidate({ taskId: 't1', updatedAt: 200, provider: 'custom-a' })
    const merged = mergeTaskMetaPair(snapshot, optimistic)
    expect(merged.changeSummary).toBe('快照摘要')
    expect(merged.model).toBe('glm-5')
    expect(merged.provider).toBe('custom-a')
  })
})

describe('foldTaskMetaCandidates 多候选折叠', () => {
  it('按时间新者胜折叠,空候选跳过,全空返回 undefined', () => {
    const oldest = candidate({ taskId: 't1', updatedAt: 100, title: '最旧' })
    const middle = candidate({ taskId: 't1', updatedAt: 200, title: '中间' })
    const newest = candidate({ taskId: 't1', updatedAt: 300, title: '最新' })
    expect(foldTaskMetaCandidates(oldest, middle, newest)?.title).toBe('最新')
    expect(foldTaskMetaCandidates(newest, oldest, middle)?.title).toBe('最新')
    expect(foldTaskMetaCandidates(null, undefined, oldest)?.title).toBe('最旧')
    expect(foldTaskMetaCandidates()).toBeUndefined()
  })

  it('折叠保留标题保护与未读态:快照占位标题不冲掉已有重命名', () => {
    const renamed = candidate({
      taskId: 't1',
      updatedAt: 200,
      title: '我的重命名',
      titleOverridden: true,
      unreadAt: 7,
    })
    const placeholderSnapshot = candidate({
      taskId: 't1',
      updatedAt: 300,
      title: 'New session',
    })
    const merged = foldTaskMetaCandidates(renamed, placeholderSnapshot)
    expect(merged?.title).toBe('我的重命名')
    expect(merged?.titleOverridden).toBe(true)
    expect(merged?.unreadAt).toBe(7)
    expect(merged?.updatedAt).toBe(300)
  })

  it('单候选原样返回', () => {
    const only = candidate({ taskId: 't1', updatedAt: 42, title: '唯一' })
    expect(foldTaskMetaCandidates(only)).toEqual(only)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
