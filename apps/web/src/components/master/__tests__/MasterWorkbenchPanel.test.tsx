// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { START_SERVICES } from '@/config/start-services'
import { MasterWorkbenchPanel } from '../MasterWorkbenchPanel'

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      text: async () =>
        JSON.stringify({
          code: 0,
          message: 'ok',
          data: { tasks: { draft: 3, scheduled: 5, running: 1, failed: 2 } },
        }),
    })),
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('MasterWorkbenchPanel', () => {
  it('工作台进入总管后,今日队列和八张卡都在右侧面板里', async () => {
    render(<MasterWorkbenchPanel />)

    await waitFor(() => expect(screen.getByText('3')).toBeTruthy())
    expect(screen.getByText('今日队列')).toBeTruthy()
    expect(screen.getByText('待确认草稿')).toBeTruthy()
    expect(screen.getByText('失败待处理')).toBeTruthy()

    expect(START_SERVICES).toHaveLength(8)
    for (const service of START_SERVICES) {
      expect(screen.getByRole('heading', { name: service.title })).toBeTruthy()
    }
  })
})
