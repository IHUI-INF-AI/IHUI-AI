// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 内联提问卡(2026-11-08 立)的判据测试:
// - 单选提交只发一次(双击第二发被吞)
// - 多选 / 自由输入的结构化 payload
// - expiresAt 到点 → 超时只读 + 禁用提交
// - 键盘:Enter 选选项、自由输入框 Enter 提交
// 文案一律走 key(与 business-form-card.test 同一套 mock),不绑定具体措辞。

import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { PendingQuestion } from '@/stores/chat'
import type { QuestionAnswerPayload } from '@/hooks/use-chat/question-response'

import { InlineQuestionCard } from '../inline-question-card'

vi.mock('next-intl', () => ({
  useTranslations: (ns: string) => (key: string, values?: Record<string, unknown>) =>
    values ? `${ns}.${key}(${JSON.stringify(values)})` : `${ns}.${key}`,
}))

afterEach(() => cleanup())

function makeQuestion(overrides: Partial<PendingQuestion> = {}): PendingQuestion {
  return {
    questionId: 'q_test',
    prompt: 'Pick one to continue',
    options: [
      { id: 'a', label: 'Option A', description: 'first option' },
      { id: 'b', label: 'Option B' },
    ],
    allowCustom: false,
    allowMultiple: false,
    ...overrides,
  }
}

function optionInput(container: HTMLElement, id: string): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>(`input[value="${id}"]`)
  if (!input) throw new Error(`missing option input: ${id}`)
  return input
}

function submitButton(container: HTMLElement): HTMLButtonElement {
  const button = container.querySelector<HTMLButtonElement>('[data-question-submit]')
  if (!button) throw new Error('missing submit button')
  return button
}

describe('InlineQuestionCard / 单选与防重', () => {
  it('单选提交只发一次:双击第二发被吞,提交后进入已回答只读态', async () => {
    let release: (() => void) | undefined
    const onSubmit = vi.fn(
      (_response: QuestionAnswerPayload) =>
        new Promise<void>((resolve) => {
          release = resolve
        }),
    )
    const { container } = render(
      <InlineQuestionCard question={makeQuestion()} onSubmit={onSubmit} />,
    )

    fireEvent.click(optionInput(container, 'a'))
    const submit = submitButton(container)
    fireEvent.click(submit)
    fireEvent.click(submit)

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit.mock.calls[0]![0]).toEqual({
      questionId: 'q_test',
      action: 'answer',
      selectedOptionIds: ['a'],
    })
    expect(submit.disabled).toBe(true)

    await act(async () => {
      release?.()
    })
    await waitFor(() => {
      expect(container.querySelector('[data-question-phase="answered"]')).not.toBeNull()
    })
    // 终态只读:选项与提交都禁用,但仍展示选中的那一项
    expect(optionInput(container, 'a').disabled).toBe(true)
    expect(optionInput(container, 'a').checked).toBe(true)
    expect(submitButton(container).disabled).toBe(true)
  })

  it('单选是互斥的:再点另一项只保留最后一项', () => {
    const onSubmit = vi.fn(async (_response: QuestionAnswerPayload) => {})
    const { container } = render(
      <InlineQuestionCard question={makeQuestion()} onSubmit={onSubmit} />,
    )
    fireEvent.click(optionInput(container, 'a'))
    fireEvent.click(optionInput(container, 'b'))
    fireEvent.click(submitButton(container))
    const payload = onSubmit.mock.calls[0]![0] as QuestionAnswerPayload
    expect(payload.selectedOptionIds).toEqual(['b'])
  })
})

describe('InlineQuestionCard / 多选与自由输入', () => {
  it('多选按勾选顺序收集全部 optionId,并带上自由输入', () => {
    const onSubmit = vi.fn(async (_response: QuestionAnswerPayload) => {})
    const { container } = render(
      <InlineQuestionCard
        question={makeQuestion({ allowMultiple: true, allowCustom: true })}
        onSubmit={onSubmit}
      />,
    )
    fireEvent.click(optionInput(container, 'b'))
    fireEvent.click(optionInput(container, 'a'))
    const custom = container.querySelector<HTMLInputElement>('[data-question-custom-input]')
    if (!custom) throw new Error('missing custom input')
    fireEvent.change(custom, { target: { value: '  extra note  ' } })
    fireEvent.click(submitButton(container))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit.mock.calls[0]![0]).toEqual({
      questionId: 'q_test',
      action: 'answer',
      selectedOptionIds: ['b', 'a'],
      customText: 'extra note',
    })
  })

  it('无选项时仅自由输入也能提交', () => {
    const onSubmit = vi.fn(async (_response: QuestionAnswerPayload) => {})
    const { container } = render(
      <InlineQuestionCard
        question={makeQuestion({ options: [], allowCustom: true })}
        onSubmit={onSubmit}
      />,
    )
    const submit = submitButton(container)
    expect(submit.disabled).toBe(true)
    const custom = container.querySelector<HTMLInputElement>('[data-question-custom-input]')
    if (!custom) throw new Error('missing custom input')
    fireEvent.change(custom, { target: { value: 'custom only' } })
    expect(submit.disabled).toBe(false)
    fireEvent.click(submit)
    expect(onSubmit.mock.calls[0]![0]).toEqual({
      questionId: 'q_test',
      action: 'answer',
      selectedOptionIds: [],
      customText: 'custom only',
    })
  })
})

describe('InlineQuestionCard / 超时', () => {
  it('expiresAt 已过 → 超时只读态,禁用提交与选择', async () => {
    const onSubmit = vi.fn(async (_response: QuestionAnswerPayload) => {})
    const { container } = render(
      <InlineQuestionCard
        question={makeQuestion({ expiresAt: Date.now() - 1000 })}
        onSubmit={onSubmit}
      />,
    )
    await waitFor(() => {
      expect(container.querySelector('[data-question-phase="timeout"]')).not.toBeNull()
    })
    expect(submitButton(container).disabled).toBe(true)
    expect(optionInput(container, 'a').disabled).toBe(true)
    fireEvent.click(submitButton(container))
    expect(onSubmit).not.toHaveBeenCalled()
  })
})

describe('InlineQuestionCard / 键盘可达', () => {
  it('Enter 可选中选项,自由输入框 Enter 直接提交', async () => {
    const onSubmit = vi.fn(async (_response: QuestionAnswerPayload) => {})
    const { container } = render(
      <InlineQuestionCard question={makeQuestion({ allowCustom: true })} onSubmit={onSubmit} />,
    )
    const input = optionInput(container, 'a')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(input.checked).toBe(true)

    const custom = container.querySelector<HTMLInputElement>('[data-question-custom-input]')
    if (!custom) throw new Error('missing custom input')
    fireEvent.change(custom, { target: { value: 'typed' } })
    fireEvent.keyDown(custom, { key: 'Enter' })

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    expect(onSubmit.mock.calls[0]![0]).toEqual({
      questionId: 'q_test',
      action: 'answer',
      selectedOptionIds: ['a'],
      customText: 'typed',
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
