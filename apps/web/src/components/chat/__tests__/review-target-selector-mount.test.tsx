// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
//
// D06 审查对象选择器 —— **整组件挂载 + 发送行为**用例(2026-10-27 装车)。
//
// 与 `review-target-wiring.test.tsx` 分工:那份钉"代码面装车 + 选择→正文映射(纯函数)";
// 这份钉"真把 <MessageInput> 挂起来之后":review 模式下选择条真的在 DOM 里、
// 非 review 模式不渲染、选中目标后空正文也能发、发出去的正文就是判定层给的那一句。
//
// 为什么要真挂整组件:回滚注记判的是"生产面零引用(仅测试引用)"—— 只测选择器自身永远绿。
// 这里渲染的是生产组件本体(只 mock 传输/路由/词包),选择器若被摘掉,本文件全红。

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { TooltipProvider } from '@/components/feedback'
import { MessageInput } from '@/components/chat/message-input'
import { useModeStore } from '@/stores/mode'

// 词包用 key 桩:本文件断言结构/行为,真实文案由 selector 测试的"直读五语词包"那条守。
vi.mock('next-intl', () => ({
  useTranslations: (ns: string) => (key: string) => `${ns}.${key}`,
  useLocale: () => 'zh-CN',
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}))
// 传输层:整组件挂载会拉起 api-client(令牌注入 / 会话拉取),这里只留可编程替身。
vi.mock('@ihui/api-client', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    getMessages: vi.fn(async () => ({ success: true, data: [] })),
    streamChat: vi.fn(),
    steerChatStream: vi.fn(),
  }
})

function renderInput(onSend = vi.fn(() => true)) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <MessageInput
          onSend={onSend}
          onStop={() => {}}
          isStreaming={false}
          placeholder="placeholder"
          sendLabel="send"
          stopLabel="stop"
          model="gpt-test"
          onModelChange={() => {}}
          modelLabel="model"
        />
      </TooltipProvider>
    </QueryClientProvider>,
  )
  return { onSend, ...utils }
}

beforeEach(() => {
  window.localStorage.clear()
  useModeStore.setState({ currentMode: 'review' })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('D06 装车行为:选择条在输入卡里真渲染', () => {
  it('review 模式 ⇒ 选择条在 DOM,五档按钮齐(含票面三类目标)', () => {
    renderInput()
    expect(screen.queryByTestId('review-target-selector')).not.toBeNull()
    for (const kind of ['uncommitted', 'branch', 'commit', 'file', 'snippet'] as const) {
      expect(screen.queryByTestId(`review-target-kind-${kind}`), kind).not.toBeNull()
    }
  })

  it('非 review 模式 ⇒ 选择条不渲染(与既有输入区形态一致)', () => {
    useModeStore.setState({ currentMode: 'build' })
    renderInput()
    expect(screen.queryByTestId('review-target-selector')).toBeNull()
  })

  it('选中"未提交改动"且正文为空 ⇒ 发送按钮可用,发出去的就是 slash 目标命令', async () => {
    const { onSend } = renderInput()
    const send = screen.getByTestId('send-button') as HTMLButtonElement
    expect(send.disabled).toBe(true)

    fireEvent.click(screen.getByTestId('review-target-kind-uncommitted'))
    await waitFor(() =>
      expect((screen.getByTestId('send-button') as HTMLButtonElement).disabled).toBe(false),
    )

    fireEvent.click(screen.getByTestId('send-button'))
    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(1))
    // 目标命令交给 send-message 既有拦截链只读收集 diff —— 正文即这一句
    expect(onSend).toHaveBeenCalledWith('/review uncommitted')
  })

  it('指定分支:填 ref 后发送 ⇒ /review branch <ref>;填了非法 ref 则发不出去(正文为空+目标未 ready)', async () => {
    const { onSend } = renderInput()
    fireEvent.click(screen.getByTestId('review-target-kind-branch'))
    const input = screen.getByTestId('review-target-branch-input')
    fireEvent.change(input, { target: { value: '--upload-pack=x' } })
    expect((screen.getByTestId('send-button') as HTMLButtonElement).disabled).toBe(true)

    fireEvent.change(input, { target: { value: 'feature/review-ui' } })
    await waitFor(() =>
      expect((screen.getByTestId('send-button') as HTMLButtonElement).disabled).toBe(false),
    )
    fireEvent.click(screen.getByTestId('send-button'))
    await waitFor(() => expect(onSend).toHaveBeenCalledWith('/review branch feature/review-ui'))
  })

  it('粘贴片段档 ⇒ 内联审查块进正文(带 path:line 锚点指令)', async () => {
    const { onSend } = renderInput()
    fireEvent.click(screen.getByTestId('review-target-kind-snippet'))
    fireEvent.change(screen.getByTestId('review-target-snippet-input'), {
      target: { value: 'const a = 1' },
    })
    await waitFor(() =>
      expect((screen.getByTestId('send-button') as HTMLButtonElement).disabled).toBe(false),
    )
    fireEvent.click(screen.getByTestId('send-button'))
    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(1))
    const payload = (onSend as unknown as { mock: { calls: string[][] } }).mock.calls[0]![0]!
    expect(payload).toContain(
      'Review the pasted snippet below. Report findings with path:line anchors.',
    )
    expect(payload).toContain('const a = 1')
  })

  it('发完清选择条(目标只作用于本轮,不粘到下一轮)', async () => {
    renderInput()
    fireEvent.click(screen.getByTestId('review-target-kind-uncommitted'))
    await waitFor(() => expect(screen.queryByTestId('review-target-clear')).not.toBeNull())
    fireEvent.click(screen.getByTestId('send-button'))
    await waitFor(() => expect(screen.queryByTestId('review-target-clear')).toBeNull())
  })
})
