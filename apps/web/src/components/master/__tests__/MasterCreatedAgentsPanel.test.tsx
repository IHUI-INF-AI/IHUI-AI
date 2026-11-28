// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { MasterCreatedAgentsPanel } from '../MasterCreatedAgentsPanel'
import { useAiPanelStore } from '@/stores/ai-panel'

beforeEach(() => {
  useAiPanelStore.setState({ masterSessionId: 'sess-1' })
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      json: async () => ({
        code: 0,
        message: 'ok',
        data: {
          items: [
            {
              id: 'run-1',
              definitionName: '研究助手',
              goal: '查清这次改动的背景',
              status: 'running',
              mode: 'single',
              createdAt: '2026-11-28T02:00:00.000Z',
              startedAt: null,
              endedAt: null,
              artifactCount: 0,
              errorMessage: null,
            },
            {
              id: 'run-2',
              definitionName: '代码审查',
              goal: '过一遍 diff',
              status: 'succeeded',
              mode: 'single',
              createdAt: '2026-11-28T01:00:00.000Z',
              startedAt: null,
              endedAt: null,
              artifactCount: 2,
              errorMessage: null,
            },
          ],
        },
      }),
    })),
  )
})

afterEach(() => {
  cleanup()
  useAiPanelStore.setState({ masterSessionId: null })
  vi.unstubAllGlobals()
})

describe('MasterCreatedAgentsPanel', () => {
  it('按本次总管会话列运行账本:进行中带旋转动画,完成归到已完成', async () => {
    render(<MasterCreatedAgentsPanel />)

    await waitFor(() => expect(screen.getByText('研究助手')).toBeTruthy())
    expect(screen.getByText('代码审查')).toBeTruthy()
    expect(screen.getAllByText('进行中').length).toBeGreaterThan(1)
    expect(screen.getAllByText('已完成').length).toBeGreaterThan(0)
    expect(screen.getByLabelText('进行中')).toBeTruthy()
  })

  it('还没和总管聊过时,不请求运行列表', async () => {
    useAiPanelStore.setState({ masterSessionId: null })
    render(<MasterCreatedAgentsPanel />)

    await waitFor(() => expect(screen.getByText('还没跟总管聊过')).toBeTruthy())
    expect(fetch).not.toHaveBeenCalled()
  })
})
