// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 成绩单共享段(exam-result-sections)的形制锁。
 *
 * 钉的是本次跨端补齐的四件事,任何一处被删成"只有错题/只有数字"就会红:
 *  ① 四格统计口径:正确 / 答错 / 未答 / 用时(wrongCount 缺省时用 totalCount 反算);
 *  ② 全量解析:对题与错题都要渲染题干 + 你的答案 + 解析,而不是只列错题;
 *  ③ 三操作:回调由宿主注入,点谁调谁;全空则不渲染;
 *  ④ 答案口径:数组以 "、" 连接(web 真源 normalizeAnswer 的同义实现)。
 */
import { createElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'

import {
  ExamResultActions,
  ExamResultReviewList,
  ExamResultStats,
  deriveExamResultStats,
  normalizeExamAnswer,
} from '../src/features/exam-result/exam-result-sections'
import type { ExamResultItem, ExamResultReviewItem, TFunction } from '../src/types'

vi.mock('react-native', () => {
  const flatten = (style: unknown): Record<string, unknown> => {
    if (style === null || style === undefined) return {}
    if (Array.isArray(style))
      return style.reduce<Record<string, unknown>>((acc, s) => Object.assign(acc, flatten(s)), {})
    if (typeof style === 'object') return style as Record<string, unknown>
    return {}
  }
  const rnEl = (tag: string) => (p: Record<string, unknown>) => {
    const { style, children, onPress, ...rest } = p
    const dom: Record<string, unknown> = { 'data-style': JSON.stringify(flatten(style)) }
    for (const [k, v] of Object.entries(rest)) {
      if (k.startsWith('accessibility') || k.startsWith('on')) continue
      dom[k] = v
    }
    if (typeof onPress === 'function') dom.onClick = onPress
    return createElement(tag, dom, children as never)
  }
  return {
    View: rnEl('div'),
    Text: rnEl('span'),
    Pressable: rnEl('button'),
    StyleSheet: { flatten, create: (s: unknown) => s },
  }
})

/** 词表桩:`key` 原样带出,插值走 `key#n`,断言能同时看见"用了哪个键"与"传了什么数" */
const t: TFunction = (key, options) =>
  options && options.n !== undefined ? `${key}#${options.n}` : key

const item: ExamResultItem = {
  id: 'rec-1',
  score: 88,
  totalScore: 100,
  passed: true,
  correctCount: 3,
  unansweredCount: 1,
  totalCount: 6,
  duration: 45,
}

const reviews: ExamResultReviewItem[] = [
  {
    id: 'q1',
    title: '题一(答对)',
    yourAnswer: ['A', 'B'],
    correctAnswer: ['A', 'B'],
    isCorrect: true,
    score: 10,
    analysis: '题一解析',
  },
  {
    id: 'q2',
    title: '题二(答错)',
    yourAnswer: 'C',
    correctAnswer: 'D',
    isCorrect: false,
    score: 0,
    analysis: '题二解析',
  },
]

describe('成绩单共享段', () => {
  it('① 四格统计:正确/答错/未答/用时,答错数按 totalCount 反算', () => {
    const { container } = render(createElement(ExamResultStats, { item, t }))
    const text = container.textContent ?? ''
    expect(text).toContain('examResult.statCorrect')
    expect(text).toContain('examResult.countUnit#3')
    expect(text).toContain('examResult.statWrong')
    expect(text).toContain('examResult.countUnit#2')
    expect(text).toContain('examResult.statUnanswered')
    expect(text).toContain('examResult.countUnit#1')
    expect(text).toContain('examResult.duration')
    expect(text).toContain('examResult.durationUnit#45')
    expect(deriveExamResultStats(item)).toEqual({
      correct: 3,
      wrong: 2,
      unanswered: 1,
      duration: 45,
    })
  })

  it('② 全量解析:对题与错题都在,题干+你的答案+解析齐全', () => {
    const { container } = render(createElement(ExamResultReviewList, { reviews, t }))
    const text = container.textContent ?? ''
    expect(text).toContain('examResult.reviewTitle')
    // 对题也在(不是只列错题)
    expect(text).toContain('1. 题一(答对)')
    expect(text).toContain('2. 题二(答错)')
    expect(text).toContain('examResult.reviewCorrect')
    expect(text).toContain('examResult.reviewWrong')
    // 数组答案按 "、" 连接
    expect(text).toContain('A、B')
    // 解析对两题都渲染
    expect(text).toContain('题一解析')
    expect(text).toContain('题二解析')
    expect(text).toContain('examResult.reviewScore#10')
    expect(text).toContain('examResult.reviewScore#0')
  })

  it('②-阴性对照:showScore=false 时得分必须消失(传参被吞即红)', () => {
    const { container } = render(
      createElement(ExamResultReviewList, { reviews, t, showScore: false }),
    )
    expect(container.textContent ?? '').not.toContain('examResult.reviewScore')
  })

  it('③ 底部三操作:点谁调谁;回调全空则不渲染', () => {
    const onRetryExam = vi.fn()
    const onViewList = vi.fn()
    const onShare = vi.fn()
    const { container } = render(
      createElement(ExamResultActions, { t, onRetryExam, onViewList, onShare }),
    )
    fireEvent.click(container.querySelectorAll('button')[0]!)
    fireEvent.click(container.querySelectorAll('button')[1]!)
    fireEvent.click(container.querySelectorAll('button')[2]!)
    expect(onRetryExam).toHaveBeenCalledTimes(1)
    expect(onViewList).toHaveBeenCalledTimes(1)
    expect(onShare).toHaveBeenCalledTimes(1)

    const empty = render(createElement(ExamResultActions, { t }))
    expect(empty.container.textContent).toBe('')
  })

  it('④ 答案口径:数组用 "、" 连接,空答案回落空串', () => {
    expect(normalizeExamAnswer(['A', 'B'])).toBe('A、B')
    expect(normalizeExamAnswer('  ')).toBe('')
    expect(normalizeExamAnswer(null)).toBe('')
    expect(normalizeExamAnswer(undefined)).toBe('')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
