// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * worlds store 单测(2026-09-17 立,#38 并行世界线)。
 * mock runBestOfN 验证:fork 建线/成功落 content/单线失败隔离/adopt/reset。
 * 不连网络——runBestOfN 整体 mock。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const runBestOfNMock = vi.fn()
vi.mock('@/api/best-of-api', () => ({
  runBestOfN: (...args: unknown[]) => runBestOfNMock(...args),
}))

import { useWorldsStore } from '../worlds'

function state() {
  return useWorldsStore.getState()
}

beforeEach(() => {
  runBestOfNMock.mockReset()
  useWorldsStore.getState().reset()
})

afterEach(() => {
  useWorldsStore.getState().reset()
})

describe('worlds store(#38 并行世界线)', () => {
  it('startWorld:按模型数建线,全部 running;成功后落 content', async () => {
    runBestOfNMock.mockImplementation((_task: string, _n: number, model: string) =>
      Promise.resolve({ winner: { content: `answer-from-${model}`, score: 9 }, candidates: [] }),
    )
    state().startWorld('证明 1+1=2', ['model-a', 'model-b'])
    const runningBranches = state().branches
    expect(runningBranches.length).toBe(2)
    expect(runningBranches.every((b) => b.status === 'running')).toBe(true)
    // 等微任务清空(Promise.all 内 settle)
    await new Promise((r) => setTimeout(r, 0))
    const done = state().branches
    expect(done.find((b) => b.model === 'model-a')?.content).toBe('answer-from-model-a')
    expect(done.every((b) => b.status === 'success')).toBe(true)
    expect(state().running).toBe(false)
    // 每线一次调用,n=1(单线单候选,不是 bestof 语义)
    expect(runBestOfNMock).toHaveBeenCalledTimes(2)
    expect(runBestOfNMock).toHaveBeenCalledWith('证明 1+1=2', 1, 'model-a')
  })

  it('单线失败隔离:该线 error,其余线正常 success', async () => {
    runBestOfNMock.mockImplementation((_task: string, _n: number, model: string) =>
      model === 'bad-model'
        ? Promise.reject(new Error('上游 502'))
        : Promise.resolve({ winner: { content: 'ok', score: 8 }, candidates: [] }),
    )
    state().startWorld('task', ['bad-model', 'good-model'])
    await new Promise((r) => setTimeout(r, 0))
    const branches = state().branches
    const bad = branches.find((b) => b.model === 'bad-model')
    const good = branches.find((b) => b.model === 'good-model')
    expect(bad?.status).toBe('error')
    expect(bad?.error).toContain('502')
    expect(good?.status).toBe('success')
    expect(good?.content).toBe('ok')
  })

  it('去重与守门:重复模型去重;空任务/无模型不发射', () => {
    state().startWorld('task', ['m1', 'm1', ' m1 '])
    expect(state().branches.length).toBe(1)
    state().reset()
    runBestOfNMock.mockClear()
    state().startWorld('   ', ['m1'])
    expect(state().branches.length).toBe(0)
    state().startWorld('task', [])
    expect(state().branches.length).toBe(0)
    expect(runBestOfNMock).not.toHaveBeenCalled()
  })

  it('adopt 标记选中线;reset 清空全部', async () => {
    runBestOfNMock.mockResolvedValue({ winner: { content: 'x', score: 7 }, candidates: [] })
    state().startWorld('task', ['m1', 'm2'])
    await new Promise((r) => setTimeout(r, 0))
    const target = state().branches[1]!
    state().adopt(target.id)
    expect(state().adoptedId).toBe(target.id)
    state().reset()
    expect(state().task).toBe('')
    expect(state().branches.length).toBe(0)
    expect(state().adoptedId).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
