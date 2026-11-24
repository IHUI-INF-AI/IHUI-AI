// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// D01(G-228)对话内 Agent 选择器 —— 选择器渲染 / 选中态 / 切回默认 / 交代条。
// 词包走 key(mock next-intl),真实五语文案由 check-i18n-keys.mjs 与下方词包用例守。

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) =>
    params ? `${key}|${JSON.stringify(params)}` : key,
}))

vi.mock('@/lib/personas-api', () => ({
  fetchPersonaCatalog: vi.fn(),
}))

import { fetchPersonaCatalog } from '@/lib/personas-api'
import { useChatStore } from '@/stores/chat'
import { AgentPicker } from '../agent-picker'
import { AgentNoticeBar } from '../agent-notice-bar'

const CATALOG = [
  {
    name: 'coder',
    description: '实现代码改动',
    tools: ['read_file', 'file_edit', 'run_command'],
  },
  {
    name: 'reviewer',
    description: '审查改动',
    tools: ['read_file', 'review_pr'],
  },
]

function renderWithQuery(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

/** 打开下拉并等到第一项出现(Radix 菜单走 pointerdown 开、portal 渲染) */
async function openMenu() {
  const trigger = screen.getByTestId('agent-picker-trigger')
  await waitFor(() => expect((trigger as HTMLButtonElement).disabled).toBe(false))
  fireEvent.pointerDown(trigger)
  return screen.findByTestId('agent-picker-item-coder')
}

beforeEach(() => {
  localStorage.clear()
  useChatStore.setState({ selectedAgentId: null })
  vi.mocked(fetchPersonaCatalog).mockResolvedValue(CATALOG)
})

afterEach(() => {
  cleanup()
})

describe('D01 AgentPicker — 胶囊渲染与目录', () => {
  it('默认态:胶囊显示「默认助手」,data-selected-agent 为空,挨着模型选择器的同规格控件', async () => {
    renderWithQuery(<AgentPicker />)
    const trigger = screen.getByTestId('agent-picker-trigger') as HTMLButtonElement
    expect(trigger.getAttribute('data-selected-agent')).toBe('')
    await waitFor(() => expect(trigger.disabled).toBe(false))
    expect(trigger.textContent).toContain('agentPicker.default')
    expect(trigger.className).toContain('rounded-sm')
  })

  it('下拉列出后端目录的全部 persona,并带各自工具白名单摘要', async () => {
    renderWithQuery(<AgentPicker />)
    await openMenu()
    expect(screen.getByTestId('agent-picker-item-reviewer')).toBeTruthy()
    const tools = screen.getByTestId('agent-picker-tools-coder')
    expect(tools.textContent).toContain('read_file')
    expect(tools.textContent).toContain('run_command')
  })
})

describe('D01 AgentPicker — 选中与切回默认', () => {
  it('点选 coder ⇒ store 记为 coder、localStorage 落键、胶囊显示当前专家', async () => {
    renderWithQuery(<AgentPicker />)
    const item = await openMenu()
    fireEvent.click(item)

    await waitFor(() => expect(useChatStore.getState().selectedAgentId).toBe('coder'))
    expect(localStorage.getItem('ihui_selected_agent_id')).toBe('coder')
    expect(screen.getByTestId('agent-picker-trigger').getAttribute('data-selected-agent')).toBe(
      'coder',
    )
  })

  it('点选「默认助手」⇒ 切回 null 且清掉 localStorage 键', async () => {
    useChatStore.setState({ selectedAgentId: 'coder' })
    localStorage.setItem('ihui_selected_agent_id', 'coder')
    renderWithQuery(<AgentPicker />)
    await openMenu()

    fireEvent.click(screen.getByTestId('agent-picker-item-default'))

    await waitFor(() => expect(useChatStore.getState().selectedAgentId).toBeNull())
    expect(localStorage.getItem('ihui_selected_agent_id')).toBeNull()
  })
})

describe('D01 AgentNoticeBar — 顶部交代条', () => {
  it('未选专家时不渲染(零占位)', () => {
    const { container } = renderWithQuery(<AgentNoticeBar />)
    expect(container.querySelector('[data-testid="agent-notice-bar"]')).toBeNull()
  })

  it('选中专家后出现「已切换 XX 专家」交代条,并带工具白名单摘要', async () => {
    useChatStore.setState({ selectedAgentId: 'coder' })
    renderWithQuery(<AgentNoticeBar />)

    const bar = await screen.findByTestId('agent-notice-bar')
    expect(bar.textContent).toContain('agentNoticeBar.title')
    expect(bar.textContent).toContain('coder')
    await waitFor(() =>
      expect(screen.getByTestId('agent-notice-bar-tools').textContent).toContain('file_edit'),
    )
  })

  it('交代条「切回默认」按钮把选中态清空', async () => {
    useChatStore.setState({ selectedAgentId: 'coder' })
    renderWithQuery(<AgentNoticeBar />)

    fireEvent.click(await screen.findByTestId('agent-notice-bar-reset'))
    await waitFor(() => expect(useChatStore.getState().selectedAgentId).toBeNull())
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
