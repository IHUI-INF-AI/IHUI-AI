// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 台账失败态取证(2026-10-26 立,F-10)。
 *
 * 钉的是"取不到 ≠ 没有记录":接口失败时台账必须显示「加载失败 + 重试」,
 * 且计数不得回落成 0。旧实现在失败时展示「暂无发送记录 / 共 0 条」,
 * 运营会把一次接口故障读成"今天没发过短信"。
 */
// @vitest-environment jsdom
import * as React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('@/lib/api', () => ({ apiOrThrow: vi.fn() }))
vi.mock('@/lib/export-utils', () => ({ exportToExcel: vi.fn() }))

import { apiOrThrow } from '@/lib/api'
import { LogPanel } from '../LogPanel'

function renderPanel() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return render(
    <QueryClientProvider client={qc}>
      <LogPanel />
    </QueryClientProvider>,
  )
}

describe('LogPanel 失败态', () => {
  beforeEach(() => {
    vi.mocked(apiOrThrow).mockReset()
  })

  // vitest 未开 globals ⇒ RTL 的自动 cleanup 不生效,必须显式清,否则上一条用例的 DOM 会串场
  afterEach(() => {
    cleanup()
  })

  it('接口失败 ⇒ 显示加载失败与重试,不得伪装成「暂无发送记录 / 共 0 条」', async () => {
    vi.mocked(apiOrThrow).mockRejectedValue(new Error('500 Internal Server Error'))
    renderPanel()

    await waitFor(() => expect(screen.getByText(/台账加载失败/)).toBeTruthy())
    expect(screen.getByRole('button', { name: '重试' })).toBeTruthy()
    expect(screen.queryByText('暂无发送记录')).toBeNull()
    expect(screen.getByText('共 — 条')).toBeTruthy()
  })

  it('接口成功且为空 ⇒ 仍显示「暂无发送记录」', async () => {
    vi.mocked(apiOrThrow).mockResolvedValue({
      items: [],
      total: 0,
      counts: {},
    } as never)
    renderPanel()

    await waitFor(() => expect(screen.getByText('暂无发送记录')).toBeTruthy())
    expect(screen.queryByText(/台账加载失败/)).toBeNull()
  })
})
