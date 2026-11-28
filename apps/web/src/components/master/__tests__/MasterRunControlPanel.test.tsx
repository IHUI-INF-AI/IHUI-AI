// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { MasterRunControlPanel } from '../MasterRunControlPanel'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('MasterRunControlPanel', () => {
  it('按 runId 暂停，并显示真实 outcome/状态', async () => {
    const calls: Array<{ url: string; body?: string }> = []
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) => {
        calls.push({ url, body: init?.body as string | undefined })
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              code: 0,
              data: { outcome: 'paused', runStatus: 'paused', checkpointId: 'ckpt-1' },
            }),
        } as Response)
      }),
    )

    render(<MasterRunControlPanel />)
    fireEvent.change(screen.getByLabelText('runId'), { target: { value: 'run-1' } })
    fireEvent.click(screen.getByRole('button', { name: '暂停' }))

    const result = await screen.findByTestId('run-control-result')
    expect(result.textContent).toContain('outcome=paused')
    expect(result.textContent).toContain('status=paused')
    expect(calls[0]?.url).toBe('/api/master/runs/run-1/pause')
    expect(calls[0]?.body).toBeUndefined()
  })

  it('注入提示时只提交 message，并带同源凭证', async () => {
    const calls: Array<{ url: string; body?: string; credentials?: RequestCredentials }> = []
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) => {
        calls.push({
          url,
          body: init?.body as string | undefined,
          credentials: init?.credentials,
        })
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              code: 0,
              data: { outcome: 'steered', delivery: 'next_iteration' },
            }),
        } as Response)
      }),
    )

    render(<MasterRunControlPanel />)
    fireEvent.change(screen.getByLabelText('runId'), { target: { value: 'run 2' } })
    fireEvent.change(screen.getByLabelText('中途提示'), {
      target: { value: '补充风险点' },
    })
    fireEvent.click(screen.getByRole('button', { name: '注入提示' }))

    const result = await screen.findByTestId('run-control-result')
    expect(result.textContent).toContain('outcome=steered')
    expect(calls[0]?.url).toBe('/api/master/runs/run%202/talk')
    expect(JSON.parse(calls[0]?.body ?? '{}')).toEqual({ message: '补充风险点' })
    expect(calls[0]?.credentials).toBe('include')
  })

  it('终态暂停失败时显示后端错误码，不伪造成功', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 409,
          json: () =>
            Promise.resolve({
              detail: { code: 'AGENT_RUN_ALREADY_TERMINAL', message: 'run 已终态' },
            }),
        } as Response),
      ),
    )

    render(<MasterRunControlPanel />)
    fireEvent.change(screen.getByLabelText('runId'), { target: { value: 'run-3' } })
    fireEvent.click(screen.getByRole('button', { name: '暂停' }))

    await screen.findByText(/AGENT_RUN_ALREADY_TERMINAL: run 已终态/)
  })
})
