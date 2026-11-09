// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-172 回归锁:提交答案按 questionId 重复计分。
 *
 * 旧实现直接对 answers.map 累加 score,同一 questionId 提交多次会重复得分,
 * 且未限制答案题目属于本试卷。
 * 本测试直接 import 生产纯函数 gradeExamAnswers(不复制判据),断言:
 *  - 同一 questionId 提交两次(正确)总分 == 只提交一次;
 *  - 不同题目正常累加;
 *  - 未知 questionId 不得分;
 *  - 重复题保留首次答案。
 */
import { describe, it, expect, vi } from 'vitest'
import type { ExamQuestion } from '@ihui/database'

// 纯函数不触 DB,但模块顶层 import 了 db / 指标桥接 —— 隔离掉外部依赖。
vi.mock('../src/db/index.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    execute: vi.fn(),
  },
}))
vi.mock('../src/plugins/business-metrics.js', () => ({
  recordExamScore: vi.fn(),
}))

import { gradeExamAnswers } from '../src/db/exam-queries.js'

function makeQuestion(id: string, answer: unknown, score: string): ExamQuestion {
  return { id, type: 'single_choice', answer, score } as unknown as ExamQuestion
}

const Q1_ID = '11111111-1111-4111-8111-111111111111'
const Q2_ID = '22222222-2222-4222-8222-222222222222'
const UNKNOWN_ID = '33333333-3333-4333-9333-333333333333'

describe('F-172 判分按 questionId 去重', () => {
  it('同一 questionId 提交两次的总分等于只提交一次', () => {
    const questions = [makeQuestion(Q1_ID, 'A', '10')]
    const once = gradeExamAnswers(questions, [{ questionId: Q1_ID, answer: 'A' }])
    const twice = gradeExamAnswers(questions, [
      { questionId: Q1_ID, answer: 'A' },
      { questionId: Q1_ID, answer: 'A' },
    ])

    expect(twice.totalScore).toBe(once.totalScore)
    expect(once.totalScore).toBe(Number(questions[0]!.score))
    expect(twice.gradedAnswers).toHaveLength(once.gradedAnswers.length)
    expect(twice.gradedAnswers).toHaveLength(1)
  })

  it('重复 questionId 保留首次出现的答案', () => {
    const questions = [makeQuestion(Q1_ID, 'A', '10')]
    const result = gradeExamAnswers(questions, [
      { questionId: Q1_ID, answer: 'B' }, // 首次:错误
      { questionId: Q1_ID, answer: 'A' }, // 重复:正确但应被忽略
    ])

    expect(result.gradedAnswers).toHaveLength(1)
    expect(result.gradedAnswers[0]?.answer).toBe('B')
    expect(result.gradedAnswers[0]?.isCorrect).toBe(false)
    expect(result.totalScore).toBe(0)
  })

  it('不同题目正常累加', () => {
    const questions = [makeQuestion(Q1_ID, 'A', '10'), makeQuestion(Q2_ID, 'B', '20')]
    const result = gradeExamAnswers(questions, [
      { questionId: Q1_ID, answer: 'A' },
      { questionId: Q2_ID, answer: 'B' },
    ])

    expect(result.gradedAnswers).toHaveLength(2)
    expect(result.totalScore).toBe(Number(questions[0]!.score) + Number(questions[1]!.score))
  })

  it('未知 questionId 不得分', () => {
    const questions = [makeQuestion(Q1_ID, 'A', '10')]
    const result = gradeExamAnswers(questions, [
      { questionId: Q1_ID, answer: 'A' },
      { questionId: UNKNOWN_ID, answer: 'A' },
    ])

    const unknown = result.gradedAnswers.find((a) => a.questionId === UNKNOWN_ID)
    expect(unknown).toMatchObject({ isCorrect: false, score: 0 })
    expect(result.totalScore).toBe(Number(questions[0]!.score))
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
