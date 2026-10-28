// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/lib/api', () => ({
  fetchApi: vi.fn(),
}))

import { useSubagentDispatchStore } from '../subagent-dispatch'
import { fetchApi } from '@/lib/api'
import type { SubagentDispatch, DispatchInput } from '@ihui/shared/subagents'

const mockedFetchApi = vi.mocked(fetchApi)

const fakeDispatch = (id: string): SubagentDispatch =>
  ({
    id,
    status: 'pending',
    createdAt: '2026-08-21T00:00:00Z',
  }) as unknown as SubagentDispatch

const input = (objective: string): DispatchInput => ({ objective }) as unknown as DispatchInput

describe('useSubagentDispatchStore.createDispatch', () => {
  beforeEach(() => {
    useSubagentDispatchStore.getState().reset()
    vi.clearAllMocks()
    // 默认 benign 返回:createDispatch 成功后 fire-and-forget 的 refreshTopology
    // 也会调 fetchApi,mock 耗尽后返回 undefined 会产生未处理 rejection。
    mockedFetchApi.mockResolvedValue({ success: false } as Awaited<ReturnType<typeof fetchApi>>)
  })

  it('成功路径:写入 dispatches 头部 + isCreating 复位', async () => {
    mockedFetchApi.mockResolvedValueOnce({
      success: true,
      data: { dispatch: fakeDispatch('d1') },
    } as Awaited<ReturnType<typeof fetchApi>>)

    const r = await useSubagentDispatchStore.getState().createDispatch(input('test'))

    expect(r.ok).toBe(true)
    const s = useSubagentDispatchStore.getState()
    expect(s.dispatches[0]?.id).toBe('d1')
    expect(s.isCreating).toBe(false)
  })

  it('回归(2026-08-21 卡死修复):API 返回 success=false 时 isCreating 必须复位', async () => {
    // 原缺陷:fetchApi 正常返回但 success=false 时提前 return,
    // isCreating 永久为 true → 后续派单全部被"派单提交中"拒绝。
    mockedFetchApi.mockResolvedValueOnce({
      success: false,
      error: '服务端校验失败',
    } as Awaited<ReturnType<typeof fetchApi>>)

    const r1 = await useSubagentDispatchStore.getState().createDispatch(input('fail-case'))

    expect(r1.ok).toBe(false)
    expect(useSubagentDispatchStore.getState().isCreating).toBe(false)

    // 关键断言:失败后可立即再次派单,不被旧锁拒绝
    mockedFetchApi.mockResolvedValueOnce({
      success: true,
      data: { dispatch: fakeDispatch('d2') },
    } as Awaited<ReturnType<typeof fetchApi>>)
    const r2 = await useSubagentDispatchStore.getState().createDispatch(input('retry-after-fail'))
    expect(r2.ok).toBe(true)
  })

  it('异常路径:fetchApi 抛错时 isCreating 复位', async () => {
    mockedFetchApi.mockRejectedValueOnce(new Error('network down'))

    const r = await useSubagentDispatchStore.getState().createDispatch(input('throw-case'))

    expect(r.ok).toBe(false)
    expect(r.error).toBe('network down')
    expect(useSubagentDispatchStore.getState().isCreating).toBe(false)
  })

  it('并发防抖:isCreating=true 时直接拒绝', async () => {
    useSubagentDispatchStore.setState({ isCreating: true })
    const r = await useSubagentDispatchStore.getState().createDispatch(input('concurrent'))
    expect(r.ok).toBe(false)
    expect(r.error).toContain('派单提交中')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
