// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-694 回归锁:同一答题记录的终态分数只累计一次。
 *
 * recordExamScore 在 business-metrics.ts 中 sum/count 成对累加(avg=sum/count)。
 * 提交判分时路由已按该记录分数计一次;人工阅卷(gradeSubjectiveAnswers)与管理阅卷
 * (gradeExam)若再按重新汇总的总分整笔累加,同一记录会被重复计入 sum,avg 失真。
 *
 * 修复口径:阅卷按「相对上一终态分数的增量」平移 sum,count 不再 +1。
 * 本测试 mock 指标桥接模块,只断言累计事件(recordExamScore 新事件 / adjustExamScore 增量),
 * 不复制生产判分逻辑。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../src/db/index.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    execute: vi.fn(),
  },
}))

// 指标桥接模块整体 mock:recordExamScore = sum+count 成对累加;adjustExamScore = 仅平移 sum。
const metrics = vi.hoisted(() => ({
  recordExamScore: vi.fn(),
  adjustExamScore: vi.fn(),
}))
vi.mock('../src/plugins/business-metrics.js', () => metrics)

import { gradeSubjectiveAnswers } from '../src/db/exam-queries.js'
import { gradeExam } from '../src/db/exam-extended-queries.js'

const PAPER_ID = '11111111-1111-4111-8111-111111111111'
const RECORD_ID = '33333333-3333-4333-9333-333333333333'
const USER_ID = '00000000-0000-4000-8000-000000000fee'
const Q1_ID = '44444444-4444-4444-8444-444444444444'

function chain(result: unknown[] = []) {
  const c: Record<string, unknown> = {
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
  }
  for (const m of [
    'from',
    'where',
    'orderBy',
    'limit',
    'offset',
    'values',
    'set',
    'returning',
    'leftJoin',
    'innerJoin',
    'groupBy',
    'onConflictDoUpdate',
  ]) {
    c[m] = () => c
  }
  return c as never
}

function makeRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: RECORD_ID,
    paperId: PAPER_ID,
    userId: USER_ID,
    answers: null,
    score: '0',
    isPassed: false,
    status: 'graded',
    startedAt: new Date(),
    submittedAt: new Date(),
    duration: 0,
    createdAt: new Date(),
    ...overrides,
  }
}

/** 阅卷产生的指标事件(新事件按值 + 增量按值),不含提交侧既有的首次计数。 */
function gradingEvents(): number[] {
  return [
    ...metrics.recordExamScore.mock.calls.map((args) => Number(args[0])),
    ...metrics.adjustExamScore.mock.calls.map((args) => Number(args[0])),
  ]
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('F-694 阅卷分数按终态只计一次', () => {
  it('gradeSubjectiveAnswers:已有 30,阅卷后 50 ⇒ 只累计 20(改前整笔累计 50)', async () => {
    const { db } = await import('../src/db/index.js')
    db.select.mockReturnValueOnce(
      chain([
        makeRecord({
          score: '30',
          status: 'graded',
          answers: [{ questionId: Q1_ID, answer: 'x', score: 30, isCorrect: true }],
        }),
      ]),
    )
    db.select.mockReturnValueOnce(chain([{ id: Q1_ID, score: '50' }]))
    db.select.mockReturnValueOnce(chain([{ passScore: '60' }]))
    db.update.mockReturnValue(chain())

    const result = await gradeSubjectiveAnswers(RECORD_ID, [{ questionId: Q1_ID, score: 50 }])

    expect(result.score).toBe(50)
    expect(gradingEvents()).toEqual([20])
  })

  it('重复阅卷:30 → 50 → 40 ⇒ 增量 20/-10,提交侧 30 + 净额 = 40 终分(改前 50+40=90)', async () => {
    const { db } = await import('../src/db/index.js')
    // 第一次阅卷:上一终态 30,重新汇总 50
    db.select.mockReturnValueOnce(
      chain([
        makeRecord({
          score: '30',
          status: 'graded',
          answers: [{ questionId: Q1_ID, answer: 'x', score: 30, isCorrect: true }],
        }),
      ]),
    )
    db.select.mockReturnValueOnce(chain([{ id: Q1_ID, score: '50' }]))
    db.select.mockReturnValueOnce(chain([{ passScore: '60' }]))
    // 第二次阅卷:上一终态 50,重新汇总 40
    db.select.mockReturnValueOnce(
      chain([
        makeRecord({
          score: '50',
          status: 'submitted',
          answers: [{ questionId: Q1_ID, answer: 'x', score: 50, isCorrect: true }],
        }),
      ]),
    )
    db.select.mockReturnValueOnce(chain([{ id: Q1_ID, score: '50' }]))
    db.select.mockReturnValueOnce(chain([{ passScore: '60' }]))
    db.update.mockReturnValue(chain())

    await gradeSubjectiveAnswers(RECORD_ID, [{ questionId: Q1_ID, score: 50 }])
    const second = await gradeSubjectiveAnswers(RECORD_ID, [{ questionId: Q1_ID, score: 40 }])

    expect(second.score).toBe(40)
    expect(gradingEvents()).toEqual([20, -10])
    // 提交侧首次计数 30 + 阅卷增量净额 10 = 该记录终态 40,sum 恰等于终分
    expect(30 + sum(gradingEvents())).toBe(40)
  })

  it('gradeExam:已有 30,管理阅卷改成 50 ⇒ 只累计 20', async () => {
    const { db } = await import('../src/db/index.js')
    const prev = makeRecord({ score: '30', status: 'submitted' })
    db.select.mockReturnValueOnce(chain([prev]))
    // checkAndUpdateStatus: submitted→graded
    db.update.mockReturnValueOnce(chain([{ ...prev, status: 'graded' }]))
    // 写入最终分
    db.update.mockReturnValueOnce(
      chain([{ ...prev, status: 'graded', score: '50', isPassed: false }]),
    )

    const updated = await gradeExam(RECORD_ID, 50)

    expect(updated.score).toBe('50')
    expect(gradingEvents()).toEqual([20])
    // 路由层重复打点已移除:管理阅卷不再触发 sum+count 整笔事件
    expect(metrics.recordExamScore).not.toHaveBeenCalled()
  })
})
