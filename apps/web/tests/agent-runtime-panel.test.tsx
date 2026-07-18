// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import type { AgentRuntimeStreamCallbacks } from '@ihui/api-client'

vi.mock('@ihui/api-client', () => ({
  executeAgentRuntimeStream: vi.fn(),
}))

import { AgentRuntimePanel } from '../src/components/ai/agent-runtime-panel'
import { executeAgentRuntimeStream } from '@ihui/api-client'

const mockStream = vi.mocked(executeAgentRuntimeStream)
let capturedCallbacks: AgentRuntimeStreamCallbacks = {}

async function renderAndSend(message: string) {
  render(<AgentRuntimePanel />)
  const textarea = screen.getByPlaceholderText('输入任务...') as HTMLTextAreaElement
  await act(async () => {
    fireEvent.change(textarea, { target: { value: message } })
  })
  const sendButton = screen.getByRole('button', { name: /执行/ })
  await act(async () => {
    fireEvent.click(sendButton)
  })
}

describe('AgentRuntimePanel', () => {
  beforeEach(() => {
    mockStream.mockReset()
    capturedCallbacks = {}
    mockStream.mockImplementation(async (_params, cbs, _options) => {
      capturedCallbacks = cbs
      return Promise.resolve()
    })
  })

  afterEach(() => {
    cleanup()
    document.body.innerHTML = ''
  })

  it('渲染 — 默认状态 idle,显示标题与空状态', () => {
    render(<AgentRuntimePanel />)
    expect(screen.getByText('Agent Runtime')).not.toBeNull()
    expect(screen.getByText('输入任务,开始 Agent 执行')).not.toBeNull()
    expect(screen.queryByTestId('status-running')).toBeNull()
  })

  it('输入框 + 执行按钮 — 初始 disabled,输入文字后 enabled', () => {
    render(<AgentRuntimePanel />)
    const textarea = screen.getByPlaceholderText('输入任务...') as HTMLTextAreaElement
    const sendButton = screen.getByRole('button', { name: /执行/ })
    expect(sendButton.hasAttribute('disabled')).toBe(true)
    act(() => {
      fireEvent.change(textarea, { target: { value: 'hello' } })
    })
    expect(sendButton.hasAttribute('disabled')).toBe(false)
  })

  it('点击执行 → 调用 executeAgentRuntimeStream,参数含 message 与 mode=default', async () => {
    await renderAndSend('hello agent')
    expect(mockStream).toHaveBeenCalledTimes(1)
    const [params, _cbs, options] = mockStream.mock.calls[0]!
    expect(params.message).toBe('hello agent')
    expect(params.mode).toBe('default')
    expect(options?.signal).toBeInstanceOf(AbortSignal)
  })

  it('执行中 → 显示 Loader2 spin + 停止按钮', async () => {
    mockStream.mockImplementation(async (_params, cbs, _options) => {
      capturedCallbacks = cbs
      return new Promise<void>(() => {})
    })
    render(<AgentRuntimePanel />)
    const textarea = screen.getByPlaceholderText('输入任务...') as HTMLTextAreaElement
    await act(async () => {
      fireEvent.change(textarea, { target: { value: 'running' } })
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /执行/ }))
    })
    expect(screen.getByTestId('status-running')).not.toBeNull()
    expect(screen.getByRole('button', { name: /停止/ })).not.toBeNull()
    expect(screen.queryByRole('button', { name: /^执行$/ })).toBeNull()
  })

  it('onSession 回调 → 设置 sessionId 并在 header 显示截断 ID', async () => {
    await renderAndSend('session test')
    await act(async () => {
      capturedCallbacks.onSession?.({ sessionId: 'sess-123-abcdef' })
    })
    const sessionIdEl = screen.getByTestId('session-id')
    expect(sessionIdEl.textContent).toBe('#sess-123')
    expect(sessionIdEl.getAttribute('title')).toBe('sess-123-abcdef')
  })

  it('onPlan 回调 → 显示"执行计划"区域与计划文本', async () => {
    await renderAndSend('plan test')
    await act(async () => {
      capturedCallbacks.onPlan?.({ plan: '步骤 1\n步骤 2' })
    })
    expect(screen.getByText('执行计划')).not.toBeNull()
    const pre = document.querySelector('pre')
    expect(pre?.textContent).toBe('步骤 1\n步骤 2')
  })

  it('onDelta 回调 → 累积输出(多次回调拼接)', async () => {
    await renderAndSend('delta test')
    await act(async () => {
      capturedCallbacks.onDelta?.({ content: 'hello ' })
      capturedCallbacks.onDelta?.({ content: 'world' })
    })
    expect(screen.getByText('hello world')).not.toBeNull()
  })

  it('onDone 回调 → status=completed + CheckCircle2 + summary 写入输出', async () => {
    await renderAndSend('done test')
    await act(async () => {
      capturedCallbacks.onDone?.({
        sessionId: 'sess-123',
        status: 'completed',
        summary: '已完成任务',
      })
    })
    expect(screen.getByTestId('status-completed')).not.toBeNull()
    expect(screen.getByText('已完成任务')).not.toBeNull()
  })

  it('onError 回调 → status=failed + AlertCircle + 错误消息', async () => {
    await renderAndSend('error test')
    await act(async () => {
      capturedCallbacks.onError?.({ message: '网络异常' })
    })
    expect(screen.getByTestId('status-failed')).not.toBeNull()
    expect(screen.getByText('网络异常')).not.toBeNull()
  })

  it('点击停止 → abort signal + status=cancelled,显示执行按钮 + 已取消 banner', async () => {
    mockStream.mockImplementation(async (_params, cbs, options) => {
      capturedCallbacks = cbs
      expect(options?.signal?.aborted).toBe(false)
      return new Promise<void>(() => {})
    })
    render(<AgentRuntimePanel />)
    const textarea = screen.getByPlaceholderText('输入任务...') as HTMLTextAreaElement
    await act(async () => {
      fireEvent.change(textarea, { target: { value: 'to-stop' } })
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /执行/ }))
    })
    const stopButton = screen.getByRole('button', { name: /停止/ })
    await act(async () => {
      fireEvent.click(stopButton)
    })
    // P2 中期增强:停止后应进入 cancelled 状态,显示"任务已取消"banner
    expect(screen.queryByTestId('status-running')).toBeNull()
    expect(screen.getByTestId('status-cancelled')).not.toBeNull()
    expect(screen.getByTestId('cancelled-banner')).not.toBeNull()
    expect(screen.getByText('任务已取消')).not.toBeNull()
    expect(screen.getByRole('button', { name: /^执行$/ })).not.toBeNull()
  })

  it('再次点击清空 → 从 cancelled 回到 idle 初始态', async () => {
    mockStream.mockImplementation(async (_params, cbs, _options) => {
      capturedCallbacks = cbs
      return new Promise<void>(() => {})
    })
    render(<AgentRuntimePanel />)
    const textarea = screen.getByPlaceholderText('输入任务...') as HTMLTextAreaElement
    await act(async () => {
      fireEvent.change(textarea, { target: { value: 'cancel-then-clear' } })
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /执行/ }))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /停止/ }))
    })
    expect(screen.getByTestId('cancelled-banner')).not.toBeNull()

    const clearButton = screen.getByRole('button', { name: /清空/ })
    await act(async () => {
      fireEvent.click(clearButton)
    })
    // 清空后应回到 idle 态,banner 消失
    expect(screen.queryByTestId('cancelled-banner')).toBeNull()
    expect(screen.queryByTestId('status-cancelled')).toBeNull()
    expect(screen.getByText('输入任务,开始 Agent 执行')).not.toBeNull()
  })

  it('点击清空 → 重置所有状态(plan/output 消失)', async () => {
    await renderAndSend('clear test')
    await act(async () => {
      capturedCallbacks.onPlan?.({ plan: '初始计划' })
      capturedCallbacks.onDelta?.({ content: '初始输出' })
      capturedCallbacks.onDone?.({ sessionId: 'sess-clear', status: 'completed' })
    })
    expect(screen.getByText('执行计划')).not.toBeNull()
    expect(screen.getByRole('button', { name: /清空/ }).hasAttribute('disabled')).toBe(false)

    const clearButton = screen.getByRole('button', { name: /清空/ })
    await act(async () => {
      fireEvent.click(clearButton)
    })
    expect(screen.queryByText('执行计划')).toBeNull()
    expect(screen.queryByText('初始输出')).toBeNull()
    expect(screen.getByText('输入任务,开始 Agent 执行')).not.toBeNull()
  })
})
