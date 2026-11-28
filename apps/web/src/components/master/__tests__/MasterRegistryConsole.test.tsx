// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * W1 总管控制台契约测试（2026-11-28 立）。
 *
 * 只验控制台与 R1 真实响应形状的接缝，不验后端业务：
 * ① 列表读 `data.items`，搜索参数是 `q` 不是 `search`；
 * ② 版本读 `data.items`；
 * ③ 删除预检 → 创建审批（只返回 approvalId）→ 再取审批详情，右侧面板才拿得到 id；
 * ④ 删除动作带 `precheckToken`，批准带 `typedName`。
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { MasterRegistryConsole } from '../MasterRegistryConsole'

interface Call {
  url: string
  init?: RequestInit
}

function jsonResponse(body: unknown, ok = true) {
  return Promise.resolve({
    ok,
    json: () => Promise.resolve(body),
  } as Response)
}

function installFetch(handler: (call: Call) => Promise<Response>) {
  const calls: Call[] = []
  const mock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const call = { url: String(input), init }
    calls.push(call)
    return handler(call)
  })
  vi.stubGlobal('fetch', mock)
  return calls
}

const definition = {
  id: 'd-1',
  name: 'writer',
  displayName: '写作助手',
  scope: 'personal',
  status: 'active',
  version: 3,
  role: 'general',
  tools: ['search'],
  isBuiltin: false,
  updatedAt: '2026-11-28T00:00:00.000Z',
  stats: { runs7d: 2, successRate: 0.5 },
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('MasterRegistryConsole', () => {
  it('按 R1 响应形状渲染列表，并用 q 传搜索词', async () => {
    const calls = installFetch((call) => {
      if (call.url.includes('/approvals')) return jsonResponse({ code: 0, data: { items: [] } })
      return jsonResponse({ code: 0, data: { items: [definition], total: 1 } })
    })

    render(<MasterRegistryConsole />)
    fireEvent.click(screen.getByRole('button', { name: '智能体注册表' }))

    await screen.findByText('写作助手')
    expect(screen.getByText('50%')).toBeTruthy()

    const input = screen.getByPlaceholderText('搜索名称/描述')
    fireEvent.change(input, { target: { value: 'writer' } })
    await waitFor(() => {
      const last = calls.filter((call) => call.url.includes('/definitions?')).at(-1)
      expect(last?.url).toContain('q=writer')
      expect(last?.url).not.toContain('search=writer')
    })
  })

  it('版本侧栏读 data.items，而不是 data.versions', async () => {
    installFetch((call) => {
      if (call.url.includes('/versions')) {
        return jsonResponse({
          code: 0,
          data: {
            items: [{ version: 2, changeKind: 'update', createdAt: '2026-11-27T00:00:00.000Z' }],
          },
        })
      }
      if (call.url.includes('/approvals')) return jsonResponse({ code: 0, data: { items: [] } })
      return jsonResponse({ code: 0, data: { items: [definition], total: 1 } })
    })

    render(<MasterRegistryConsole />)
    fireEvent.click(screen.getByRole('button', { name: '智能体注册表' }))
    await screen.findByText('写作助手')
    fireEvent.click(screen.getByRole('button', { name: '版本' }))

    await screen.findByText(/v2 · update/)
  })

  it('删除先预检、再建审批、再取详情，批准提交 typedName', async () => {
    const calls = installFetch((call) => {
      if (call.url.endsWith('/d-1/precheck-delete')) {
        return jsonResponse({ code: 0, data: { precheckToken: 'pc_token_1234567890' } })
      }
      if (call.url.endsWith('/definitions/d-1') && call.init?.method === 'DELETE') {
        return jsonResponse({
          code: 0,
          data: { approvalId: 'a-1', status: 'pending', expiresAt: '2026-11-28T01:00:00.000Z' },
        })
      }
      if (call.url.endsWith('/approvals/a-1')) {
        return jsonResponse({
          code: 0,
          data: {
            id: 'a-1',
            status: 'pending',
            definitionName: '写作助手',
            expiresAt: '2026-11-28T01:00:00.000Z',
          },
        })
      }
      if (call.url.endsWith('/approvals/a-1/approve')) {
        return jsonResponse({ code: 0, data: { approval: { id: 'a-1', status: 'consumed' } } })
      }
      if (call.url.includes('/approvals')) return jsonResponse({ code: 0, data: { items: [] } })
      return jsonResponse({ code: 0, data: { items: [definition], total: 1 } })
    })

    render(<MasterRegistryConsole />)
    fireEvent.click(screen.getByRole('button', { name: '智能体注册表' }))
    await screen.findByText('写作助手')
    fireEvent.click(screen.getByRole('button', { name: '删除' }))

    await screen.findByText('待确认删除')
    const deleteCall = calls.find(
      (call) => call.url.endsWith('/definitions/d-1') && call.init?.method === 'DELETE',
    )
    expect(JSON.parse(String(deleteCall?.init?.body))).toMatchObject({
      precheckToken: 'pc_token_1234567890',
    })

    fireEvent.change(screen.getByPlaceholderText('输入定义名'), {
      target: { value: '写作助手' },
    })
    fireEvent.click(screen.getByRole('button', { name: '批准删除' }))

    await waitFor(() => {
      const approve = calls.find((call) => call.url.endsWith('/approvals/a-1/approve'))
      expect(JSON.parse(String(approve?.init?.body))).toMatchObject({ typedName: '写作助手' })
    })
  })
})
