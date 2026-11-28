// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

const pushMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn(), prefetch: vi.fn() }),
}))

import { useChatStore } from '@/stores/chat'

import { StartCommandBar } from '../start-command-bar'

const INPUT_LABEL = '用一句话描述你要做的事'

function typeAndSubmit(text: string) {
  fireEvent.change(screen.getByLabelText(INPUT_LABEL), { target: { value: text } })
  fireEvent.click(screen.getByRole('button', { name: '开始' }))
}

describe('StartCommandBar', () => {
  beforeEach(() => {
    cleanup()
    pushMock.mockClear()
    useChatStore.setState({ draftInput: null, draftAutoSend: false })
  })

  it('说得准 → 直接跳到能力落点，并把原话带上', () => {
    render(<StartCommandBar />)
    typeAndSubmit('把这篇文章发到小红书')

    expect(pushMock).toHaveBeenCalledTimes(1)
    const target = String(pushMock.mock.calls[0]?.[0] ?? '')
    expect(target.startsWith('/publish/new?q=')).toBe(true)
    expect(decodeURIComponent(target)).toContain('把这篇文章发到小红书')
    expect(useChatStore.getState().draftInput).toBeNull()
  })

  it('认不出 → 不吞输入，原话写进对话待发并跳 /chat', () => {
    render(<StartCommandBar />)
    typeAndSubmit('帮我写代码')

    expect(useChatStore.getState().draftInput).toBe('帮我写代码')
    expect(useChatStore.getState().draftAutoSend).toBe(true)
    expect(pushMock).toHaveBeenCalledWith('/chat')
  })

  it('拿不准 → 先列候选，不硬跳；点候选才走', () => {
    render(<StartCommandBar />)
    typeAndSubmit('账号数据')

    expect(pushMock).not.toHaveBeenCalled()
    expect(screen.getByText('这句话可能对应多个能力，选一个：')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '账号清单' }))
    expect(pushMock).toHaveBeenCalledTimes(1)
    expect(String(pushMock.mock.calls[0]?.[0] ?? '').startsWith('/account-pool?q=')).toBe(true)
  })

  it('候选里也能选“交给 AI”，走同一条待发通道', () => {
    render(<StartCommandBar />)
    typeAndSubmit('账号数据')
    fireEvent.click(screen.getByRole('button', { name: '都不是，交给 AI' }))

    expect(useChatStore.getState().draftInput).toBe('账号数据')
    expect(useChatStore.getState().draftAutoSend).toBe(true)
    expect(pushMock).toHaveBeenCalledWith('/chat')
  })

  it('空输入不触发任何动作', () => {
    render(<StartCommandBar />)
    fireEvent.click(screen.getByRole('button', { name: '开始' }))
    expect(pushMock).not.toHaveBeenCalled()
    expect(useChatStore.getState().draftInput).toBeNull()
  })
})
