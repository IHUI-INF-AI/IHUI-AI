// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import type { PlanStep } from '../src/hooks/use-agent-progress'
import { NextStepsCard } from '../src/components/ai/progress-sections/next-steps-card'

// Mock next-intl — vi.hoisted 确保 mockT 在 vi.mock 工厂和测试体中均可使用
const { mockT, IconSpan, chatSetState, chatStoreMock } = vi.hoisted(() => {
  const map: Record<string, string> = {
    nextStepsTitle: '下一步推荐',
    nextStepsDismiss: '关闭',
    nextStepsContinue: '继续执行剩余 {n} 步',
    nextStepsRunTests: '运行测试验证变更',
    nextStepsCommit: '提交代码变更',
    nextStepsSummarize: '总结本次对话进展',
  }
  const mockT = (key: string, params?: Record<string, unknown>) => {
    let v = map[key] ?? key
    if (params) {
      for (const [k, val] of Object.entries(params)) {
        v = v.replace(`{${k}}`, String(val))
      }
    }
    return v
  }

  // lucide 图标 mock 为简单 span(与 agent-task-progress-pane.test.tsx 同款)
  const IconSpan = ({
    className,
    'data-testid': dataTestId,
    ...rest
  }: {
    className?: string
    'data-testid'?: string
    [key: string]: unknown
  }) => (
    <span
      data-testid={dataTestId ?? 'lucide-icon'}
      className={className}
      data-lucide-span="true"
      {...rest}
    />
  )

  // chat store mock:组件只用 useChatStore.setState(静态方法),mock 需可调用 + 带 setState
  const chatSetState = vi.fn()
  const chatStoreMock = Object.assign(
    (selector: (state: unknown) => unknown) =>
      selector({ messages: [], draftInput: null, draftAutoSend: false }),
    { setState: chatSetState, getState: () => ({}) },
  )
  return { mockT, IconSpan, chatSetState, chatStoreMock }
})

vi.mock('next-intl', () => ({
  useTranslations: () => mockT,
}))

vi.mock('@/stores/chat', () => ({
  useChatStore: chatStoreMock,
}))

vi.mock('lucide-react', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    __esModule: true,
    ...actual,
    CirclePlay: IconSpan,
    FlaskConical: IconSpan,
    GitCommitHorizontal: IconSpan,
    ListChecks: IconSpan,
    Sparkles: IconSpan,
    X: IconSpan,
  }
})

function step(id: string, name: string, status: PlanStep['status']): PlanStep {
  return { id, step: name, status }
}

describe('NextStepsCard — 对话终点「下一步推荐」卡片', () => {
  beforeEach(() => {
    chatSetState.mockClear()
  })

  afterEach(() => {
    cleanup()
  })

  it('场景1: steps 为空时默认只显示「总结本次对话进展」一条建议', () => {
    render(<NextStepsCard steps={[]} visible onDismiss={() => {}} />)

    expect(screen.getByTestId('next-steps-card')).toBeTruthy()
    expect(screen.getByText('下一步推荐')).toBeTruthy()
    const suggestions = screen.getAllByTestId(/^next-steps-card-suggestion-/)
    expect(suggestions.length).toBe(1)
    expect(screen.getByTestId('next-steps-card-suggestion-summarize').textContent).toContain(
      '总结本次对话进展',
    )
  })

  it('场景2: 有 pending/in_progress 步骤时显示「继续执行剩余 N 步」并拼入第一步名称', () => {
    render(
      <NextStepsCard
        steps={[
          step('s1', '梳理项目架构', 'completed'),
          step('s2', '实现登录页面', 'in_progress'),
          step('s3', '补充单元测试', 'pending'),
        ]}
        visible
        onDismiss={() => {}}
      />,
    )

    const label = screen.getByTestId('next-steps-card-suggestion-continue').textContent ?? ''
    expect(label).toContain('继续执行剩余 2 步')
    expect(label).toContain('实现登录页面')
    // 不应出现其他场景的建议
    expect(screen.queryByTestId('next-steps-card-suggestion-run-tests')).toBeNull()
    expect(screen.queryByTestId('next-steps-card-suggestion-commit')).toBeNull()
    expect(screen.queryByTestId('next-steps-card-suggestion-summarize')).toBeNull()
  })

  it('场景3: 全部完成且存在文件修改类工具时显示「运行测试验证变更」+「提交代码变更」', () => {
    render(
      <NextStepsCard
        steps={[step('s1', '实现登录页面', 'completed'), step('s2', '补充单元测试', 'completed')]}
        tools={[{ toolName: 'edit_file' }, { toolName: 'search_codebase' }]}
        visible
        onDismiss={() => {}}
      />,
    )

    expect(screen.getByTestId('next-steps-card-suggestion-run-tests').textContent).toContain(
      '运行测试验证变更',
    )
    expect(screen.getByTestId('next-steps-card-suggestion-commit').textContent).toContain(
      '提交代码变更',
    )
    expect(screen.queryByTestId('next-steps-card-suggestion-summarize')).toBeNull()
  })

  it('场景4: 点击建议把文案写入 chat store(draftInput + draftAutoSend)', () => {
    render(<NextStepsCard steps={[]} visible onDismiss={() => {}} />)

    fireEvent.click(screen.getByTestId('next-steps-card-suggestion-summarize'))
    expect(chatSetState).toHaveBeenCalledTimes(1)
    expect(chatSetState).toHaveBeenCalledWith({
      draftInput: '总结本次对话进展',
      draftAutoSend: true,
    })
  })

  it('场景5: 点击 X 触发 onDismiss 且卡片消失;流式重启(visible 翻转)后 dismissed 重置重新出现', () => {
    const onDismiss = vi.fn()
    const { container, rerender } = render(
      <NextStepsCard steps={[]} visible onDismiss={onDismiss} />,
    )

    expect(container.querySelector('[data-testid="next-steps-card"]')).not.toBeNull()
    fireEvent.click(screen.getByTestId('next-steps-card-dismiss'))
    expect(onDismiss).toHaveBeenCalledTimes(1)
    expect(container.querySelector('[data-testid="next-steps-card"]')).toBeNull()

    // 流式重新开始:pane 把 visible 切回 false
    rerender(<NextStepsCard steps={[]} visible={false} onDismiss={onDismiss} />)
    // 流再次结束:visible 重新为 true,dismissed 已被重置 → 卡片重新出现
    rerender(<NextStepsCard steps={[]} visible onDismiss={onDismiss} />)
    expect(container.querySelector('[data-testid="next-steps-card"]')).not.toBeNull()
  })

  it('补充: visible=false(流式中)时不渲染', () => {
    const { container } = render(<NextStepsCard steps={[]} visible={false} onDismiss={() => {}} />)
    expect(container.querySelector('[data-testid="next-steps-card"]')).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
