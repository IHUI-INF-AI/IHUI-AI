// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// 深化O(2026-11-17):BatchHeader 运行中计数测试。
// 钉住:① running 状态 + runningCount>0 显示"·N 个运行中";② 非 running 状态不显示;
//       ③ runningCount=0/缺席不造残标;④ 失败计数照常显示。

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BatchHeader } from '../batch-header'

// overlay-stack 等浏览器层依赖剪成 no-op(与既有组件测试一致)
vi.mock('@/lib/overlay-stack', () => ({
  useOverlayStack: () => ({ push: vi.fn(), pop: vi.fn(), isOpen: () => false }),
}))

afterEach(() => cleanup())

function renderBatch(overrides: {
  status?: 'running' | 'completed' | 'failed' | 'partial'
  runningCount?: number
  failedCount?: number
  agentCount?: number
  completedCount?: number
}) {
  return render(
    <BatchHeader
      batchIndex={1}
      title="子代理批次"
      agentCount={overrides.agentCount ?? 5}
      completedCount={overrides.completedCount ?? 2}
      failedCount={overrides.failedCount}
      runningCount={overrides.runningCount}
      status={overrides.status ?? 'running'}
    />,
  )
}

describe('BatchHeader 深化O:运行中计数', () => {
  it('running + runningCount>0 显示"·N 个运行中"', () => {
    renderBatch({ status: 'running', runningCount: 3 })
    expect(screen.getByText(/·3 个运行中/)).toBeTruthy()
  })

  it('completed 状态即使传了 runningCount 也不显示(仅 running 显示)', () => {
    renderBatch({ status: 'completed', runningCount: 3 })
    expect(screen.queryByText(/·3 个运行中/)).toBeNull()
  })

  it('runningCount=0 不造残标', () => {
    renderBatch({ status: 'running', runningCount: 0 })
    expect(screen.queryByText(/个运行中/)).toBeNull()
  })

  it('runningCount 缺席(默认0)不造残标', () => {
    renderBatch({ status: 'running' })
    expect(screen.queryByText(/个运行中/)).toBeNull()
  })

  it('失败计数照常显示(与运行中并存)', () => {
    renderBatch({ status: 'running', runningCount: 2, failedCount: 1 })
    expect(screen.getByText(/·2 个运行中/)).toBeTruthy()
    expect(screen.getByText(/·1 失败/)).toBeTruthy()
  })

  it('完成/总数照常显示', () => {
    renderBatch({ agentCount: 5, completedCount: 2 })
    expect(screen.getByText(/2\/5/)).toBeTruthy()
  })

  it('深化T:折叠态有进度时显示进度环(替换状态图标)', () => {
    renderBatch({ status: 'running', agentCount: 5, completedCount: 2 })
    // progress = 2/5 = 40%,进度环渲染
    const ring = screen.getByRole('progressbar', { name: /批次进度 40%/ })
    expect(ring).toBeTruthy()
  })

  it('深化T:进度为 0 时仍用状态图标(不渲染进度环)', () => {
    renderBatch({ status: 'running', agentCount: 5, completedCount: 0 })
    // progress = 0/5 = 0%,不渲染进度环
    expect(screen.queryByRole('progressbar', { name: /批次进度/ })).toBeNull()
  })

  it('深化T:completed 状态进度环用 completed 态', () => {
    renderBatch({ status: 'completed', agentCount: 3, completedCount: 3 })
    // progress = 3/3 = 100%,进度环渲染
    const ring = screen.getByRole('progressbar', { name: /批次进度 100%/ })
    expect(ring).toBeTruthy()
    // state="completed" 已在 aria-label 中标注
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
