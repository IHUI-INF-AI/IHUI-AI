// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// D64 ⑤(G-82):反馈问卷卡 —— 三选 + 可跳过 + 免打扰判定 + 落库载荷。
// 判据全在 `@ihui/shared/chat/element-pack`,本用例验渲染位真的用上了它们。
import { describe, it, expect, vi, afterEach } from 'vitest'
import React from 'react'
import { render, cleanup, screen, fireEvent } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

import { FeedbackSurveyCard } from '../feedback-survey-card'
import { SURVEY_ANSWERS, type FeedbackSurveyContext } from '@ihui/shared/chat/element-pack'

const ASKABLE: FeedbackSurveyContext = {
  alreadyAnswered: false,
  alreadyAskedInSession: false,
  turnFailed: false,
}

describe('D64 ⑤ 反馈问卷卡', () => {
  afterEach(() => cleanup())

  it('三选齐备(题面就是台账原文键),未选时提交禁用', () => {
    render(<FeedbackSurveyCard messageId="m1" context={ASKABLE} />)
    expect(screen.getByTestId('feedback-survey-question').textContent).toBe(
      'feedbackSurvey.question',
    )
    const options = screen.getAllByRole('radio')
    expect(options).toHaveLength(SURVEY_ANSWERS.length)
    expect(document.querySelector('[data-feedback-answer="solved"]')?.textContent).toBe(
      'feedbackSurvey.answer.solved',
    )
    expect(document.querySelector('[data-feedback-answer="notSolved"]')).toBeTruthy()
    expect(
      (document.querySelector('[data-feedback-action="submit"]') as HTMLButtonElement).disabled,
    ).toBe(true)
    // 评论可填但非必填(占位键在位)
    expect(document.querySelector('[data-feedback-comment]')).toBeTruthy()
  })

  it('免打扰三反例一律不弹:已答过 / 本会话已问过 / 失败轮次;正例才弹', () => {
    for (const ctx of [
      { ...ASKABLE, alreadyAnswered: true },
      { ...ASKABLE, alreadyAskedInSession: true },
      { ...ASKABLE, turnFailed: true },
      { alreadyAnswered: true, alreadyAskedInSession: true, turnFailed: true },
    ]) {
      const { container } = render(<FeedbackSurveyCard messageId="m1" context={ctx} />)
      expect(container.textContent).toBe('')
      cleanup()
    }
    render(<FeedbackSurveyCard messageId="m1" context={ASKABLE} />)
    expect(screen.getByTestId('feedback-survey-card')).toBeTruthy()
  })

  it('提交:载荷 = messageId + 三选答复 + 评论(trim 后),提交后转「已收到」态', () => {
    const onSubmit = vi.fn()
    render(<FeedbackSurveyCard messageId=" m1 " context={ASKABLE} onSubmit={onSubmit} />)
    fireEvent.click(screen.getByRole('radio', { name: 'feedbackSurvey.answer.partial' }))
    fireEvent.change(document.querySelector('[data-feedback-comment]') as HTMLInputElement, {
      target: { value: '  少了最后一步  ' },
    })
    fireEvent.click(document.querySelector('[data-feedback-action="submit"]') as HTMLButtonElement)
    expect(onSubmit).toHaveBeenCalledTimes(1)
    const submitted = onSubmit.mock.calls[0]
    if (!submitted) throw new Error('setup failed: 期望 onSubmit 被调用')
    expect(submitted[0]).toEqual({
      messageId: 'm1',
      answer: 'partial',
      comment: '少了最后一步',
      skipped: false,
    })
    expect(screen.getByTestId('feedback-survey-card').getAttribute('data-feedback-survey')).toBe(
      'submitted',
    )
    expect(screen.getByTestId('feedback-survey-card').textContent).toBe('feedbackSurvey.submitted')
  })

  it('可跳过:记明确「未答」(answer=null + skipped=true),不假装答过', () => {
    const onSubmit = vi.fn()
    render(<FeedbackSurveyCard messageId="m2" context={ASKABLE} onSubmit={onSubmit} />)
    fireEvent.click(screen.getByRole('radio', { name: 'feedbackSurvey.answer.solved' }))
    fireEvent.click(document.querySelector('[data-feedback-action="dismiss"]') as HTMLButtonElement)
    const dismissed = onSubmit.mock.calls[0]
    if (!dismissed) throw new Error('setup failed: 期望 dismiss 也落一次提交')
    expect(dismissed[0]).toEqual({
      messageId: 'm2',
      answer: null,
      comment: null,
      skipped: true,
    })
  })

  it('messageId 空白 ⇒ 不落脏票,整卡不渲染', () => {
    const { container } = render(<FeedbackSurveyCard messageId="   " context={ASKABLE} />)
    expect(container.textContent).toBe('')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
