// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { MasterChatPanel } from '../MasterChatPanel'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('MasterChatPanel', () => {
  it('发送后显示总管回复，并把 session_id 带回下一轮', async () => {
    const calls: Array<{ url: string; body: Record<string, unknown> }> = []
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) => {
        calls.push({ url, body: JSON.parse(String(init?.body)) as Record<string, unknown> })
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              code: 0,
              data: { final_response: '已列出 2 个智能体', session_id: 'conv-master-1' },
            }),
        } as Response)
      }),
    )

    render(<MasterChatPanel />)
    const input = screen.getByPlaceholderText(/列一下我名下的智能体/)
    fireEvent.change(input, { target: { value: '列一下我的智能体' } })
    fireEvent.click(screen.getByRole('button', { name: '发送' }))

    await screen.findByText('已列出 2 个智能体')
    expect(calls[0]?.url).toBe('/api/master/chat')
    expect(calls[0]?.body).toMatchObject({ message: '列一下我的智能体', max_iterations: 6 })

    fireEvent.change(input, { target: { value: '看最近一次运行' } })
    fireEvent.click(screen.getByRole('button', { name: '发送' }))
    await waitFor(() => {
      expect(calls[1]?.body).toMatchObject({
        message: '看最近一次运行',
        session_id: 'conv-master-1',
      })
    })
  })

  it('失败时显示错误码，不伪造成功', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({ ok: false, status: 403, json: () => Promise.resolve({}) } as Response),
      ),
    )

    render(<MasterChatPanel />)
    fireEvent.change(screen.getByPlaceholderText(/列一下我名下的智能体/), {
      target: { value: '删除 writer' },
    })
    fireEvent.click(screen.getByRole('button', { name: '发送' }))

    await screen.findByText(/调用失败：HTTP 403/)
  })
})
