// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { MasterAssistantPanel } from '../MasterAssistantPanel'

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/api/master/profile') && init?.method === 'PUT') {
        const body = JSON.parse(String(init.body ?? '{}')) as { displayName?: string }
        return {
          ok: true,
          json: async () => ({
            code: 0,
            message: 'ok',
            data: { displayName: body.displayName, maxLength: 24, isCustom: true },
          }),
        }
      }
      if (url.includes('/api/master/profile')) {
        return {
          ok: true,
          json: async () => ({
            code: 0,
            message: 'ok',
            data: { displayName: '总管', maxLength: 24, isCustom: false },
          }),
        }
      }
      return {
        ok: true,
        json: async () => ({ code: 0, message: 'ok', data: { items: [{ id: 'a1' }] } }),
      }
    }),
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('MasterAssistantPanel', () => {
  it('总管就在 AI 面板里:身份胶囊 + 去工作区的三条入口', async () => {
    render(<MasterAssistantPanel />)

    await waitFor(() => expect(screen.getByRole('heading', { name: '总管' })).toBeTruthy())
    expect(screen.getByTestId('master-open-workbench').textContent).toContain('工作台')
    expect(screen.getByTestId('master-open-agents').textContent).toContain('总管创建的智能体')
    expect(screen.getByTestId('master-open-approvals').textContent).toContain('待你确认')
    expect(screen.getByTestId('master-open-approvals').textContent).toContain('1')
  })

  it('改名成功后,面板里的名字跟着变', async () => {
    render(<MasterAssistantPanel />)
    await waitFor(() => expect(screen.getByRole('heading', { name: '总管' })).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: '重命名' }))
    fireEvent.change(screen.getByLabelText('总智能体名字'), { target: { value: '小度' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => expect(screen.getByRole('heading', { name: '小度' })).toBeTruthy())
  })
})
