// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import React from 'react'
import { render, cleanup, screen, fireEvent } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

import { PlanReviewPanel } from '../plan-review-panel'

const PLAN = { steps: [{ id: 's1', description: '改接口' }] }

/** 计划评审「修改」反馈闭环:意见随打回交给调用方,留空也给兜底出口。 */
describe('PlanReviewPanel 修改反馈闭环', () => {
  afterEach(() => cleanup())

  it('review 阶段渲染反馈框', () => {
    render(<PlanReviewPanel plan={PLAN} />)
    expect(screen.getByTestId('plan-revision-feedback')).toBeTruthy()
  })

  it('填写意见后点「修改」⇒ onRevise 收到原文,onModify 同时触发', () => {
    const onRevise = vi.fn()
    const onModify = vi.fn()
    render(<PlanReviewPanel plan={PLAN} onRevise={onRevise} onModify={onModify} />)
    fireEvent.change(screen.getByTestId('plan-revision-feedback'), {
      target: { value: '第 2 步先补测试' },
    })
    fireEvent.click(screen.getByTestId('plan-action-draft'))
    expect(onRevise).toHaveBeenCalledWith('第 2 步先补测试')
    expect(onModify).toHaveBeenCalledTimes(1)
  })

  it('留空点「修改」⇒ onRevise 收到空串(由调用方决定兜底文案)', () => {
    const onRevise = vi.fn()
    render(<PlanReviewPanel plan={PLAN} onRevise={onRevise} />)
    fireEvent.click(screen.getByTestId('plan-action-draft'))
    expect(onRevise).toHaveBeenCalledWith('')
  })

  it('退回 draft 后反馈框消失', () => {
    render(<PlanReviewPanel plan={PLAN} />)
    fireEvent.click(screen.getByTestId('plan-action-draft'))
    expect(screen.queryByTestId('plan-revision-feedback')).toBeNull()
  })
})
