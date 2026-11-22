// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import type { AgentRuntimeStreamCallbacks } from '@ihui/api-client'

vi.mock('@ihui/api-client', () => ({
  executeAgentRuntimeStream: vi.fn(),
}))

// Mock Tooltip:Radix Tooltip 默认仅在 hover 时渲染 content,
// 测试中把 content 透传为 data-tooltip-content 以便断言完整 sessionId
vi.mock('@/components/feedback', () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Tooltip: ({ content, children }: { content: React.ReactNode; children: React.ReactNode }) => (
    <span data-tooltip-content={String(content)}>{children}</span>
  ),
}))

// Mock next-intl:AgentRuntimePanel 内调 useTranslations('agentRuntimePanel'),
// 测试不依赖真实 messages 文件,直接提供与测试断言一致的字面值
// (title='Agent Runtime' 来自 en.json,其他用例期望中文 — 是测试自定义字面值,
// 既不来自 zh-CN.json 也不来自 en.json;messages 文件逗号风格不同,故用 mock 兜底)
vi.mock('next-intl', async () => {
  const mod = (await import('@ihui/i18n/messages/shared/zh-CN.json')) as unknown as {
    default: Record<string, unknown>
  }
  const stepPack =
    (mod.default ?? (mod as unknown as Record<string, unknown>)).stepDecision ??
    (mod as unknown as Record<string, unknown>).stepDecision
  const lookupStep = (key: string): string | null => {
    let cur: unknown = stepPack
    for (const seg of key.split('.')) {
      if (cur && typeof cur === 'object' && seg in (cur as Record<string, unknown>)) {
        cur = (cur as Record<string, unknown>)[seg]
      } else {
        return null
      }
    }
    return typeof cur === 'string' ? cur : null
  }
  return {
    useTranslations: () => (key: string, params?: Record<string, string>) => {
      const map: Record<string, string> = {
        title: 'Agent Runtime',
        clear: '清空',
        plan: '执行计划',
        permissionDecision: '权限决策:{decision}',
        permissionMeta: '工具:{tool} · 等级:{level} · 模式:{mode}',
        unknownTool: '未知',
        defaultLevel: '读取',
        output: '输出',
        error: '错误',
        cancelledTitle: '任务已取消',
        cancelledBody: '已停止当前执行。如需继续,请修改输入后再次执行。',
        emptyState: '输入任务,开始 Agent 执行',
        placeholder: '输入任务...',
        stop: '停止',
        execute: '执行',
      }
      // D55②:stepDecision.* 用**真实词包**,这样"界面不再出现 auto_skip_approval"
      // 才是可证的事实,而不是测试自己造的字面值。
      let v =
        key.startsWith('decision.') || key.startsWith('state.') || key.startsWith('perm.')
          ? (lookupStep(key) ?? key)
          : (map[key] ?? key)
      if (params) {
        for (const [k, val] of Object.entries(params)) {
          v = v.replace(`{${k}}`, val)
        }
      }
      return v
    },
  }
})

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

  it('onPermission(15 值步骤决策)→ 显示本地化词而不是英文码', async () => {
    await renderAndSend('permission test')
    await act(async () => {
      capturedCallbacks.onPermission?.({
        mode: 'auto',
        toolName: 'execute_shell_command',
        dangerLevel: 'dangerous',
        decision: 'auto_skip_approval',
      })
    })
    const box = screen.getByText(/权限决策:/)
    expect(box.textContent).toContain('自动批准(免审批)')
    expect(box.textContent).not.toContain('auto_skip_approval')
  })

  it('onPermission(allow/ask/deny 矩阵)→ deny 取词为"已拒绝"', async () => {
    await renderAndSend('permission matrix deny')
    await act(async () => {
      capturedCallbacks.onPermission?.({ mode: 'default', decision: 'deny' })
    })
    expect(screen.getByText(/权限决策:/).textContent).toContain('已拒绝')
  })

  it('onPermission 认不出的取值 → 原样显示,绝不猜成"已放行"', async () => {
    await renderAndSend('permission matrix unknown')
    await act(async () => {
      capturedCallbacks.onPermission?.({ mode: 'default', decision: 'maybe_allow' })
    })
    const raw = screen.getByText(/权限决策:/)
    expect(raw.textContent).toContain('maybe_allow')
    expect(raw.textContent).not.toContain('已放行')
  })

  it('onSession 回调 → 设置 sessionId 并在 header 显示截断 ID', async () => {
    await renderAndSend('session test')
    await act(async () => {
      capturedCallbacks.onSession?.({ sessionId: 'sess-123-abcdef' })
    })
    const sessionIdEl = screen.getByTestId('session-id')
    expect(sessionIdEl.textContent).toBe('#sess-123')
    // 组件已迁移到 Radix Tooltip(项目规则:禁止原生 title),断言 mock 透传的完整内容
    expect(
      sessionIdEl.closest('[data-tooltip-content]')?.getAttribute('data-tooltip-content'),
    ).toBe('sess-123-abcdef')
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
