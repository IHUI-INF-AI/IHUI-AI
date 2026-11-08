// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * F-693 回归锁:考试状态机只有一张真值表。
 *
 * 权威侧 apps/api/src/db/exam-extended-queries.ts:489-496
 *   answering → submitted → graded → completed
 * 消费面 apps/api/src/routes/exam-marking.ts:53-56 只允许 status='submitted' 评分。
 * 因此 submitted = 已提交待判/待阅,graded = 判分完成。
 *
 * 错侧 exam-queries.ts:585 / :652 与 routes/exam.ts:1981 写反了方向:
 *   有主观题 ⇒ graded(应为 submitted,等待人工阅卷)
 *   无主观题 ⇒ submitted(应为 graded,客观题已自动判完)
 *   人工阅卷完成又回写 submitted(应为 graded)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const state = vi.hoisted(() => ({
  selectQueue: [] as unknown[][],
  updateSets: [] as Array<Record<string, unknown>>,
  updateCalls: 0,
}))

vi.mock('../src/db/index.js', () => {
  const selectChain = (rows: unknown[]) => {
    const b: Record<string, unknown> = {}
    for (const m of ['from', 'where', 'orderBy', 'limit', 'offset', 'groupBy', 'leftJoin', 'innerJoin']) {
      b[m] = () => b
    }
    b.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
      Promise.resolve(rows).then(res, rej)
    return b
  }

  const updateChain = () => {
    const b: Record<string, unknown> = {
      set: (v: Record<string, unknown>) => {
        state.updateSets.push(v)
        return b
      },
      where: () => b,
      returning: () => b,
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        Promise.resolve([]).then(res, rej),
    }
    return b
  }

  return {
    db: {
      select: () => {
        const rows = state.selectQueue.shift() ?? []
        return selectChain(rows)
      },
      insert: () => selectChain([]),
      update: () => {
        state.updateCalls++
        return updateChain()
      },
      delete: () => selectChain([]),
      execute: vi.fn().mockResolvedValue([]),
    },
  }
})

const metrics = vi.hoisted(() => ({ recordExamScore: vi.fn(), adjustExamScore: vi.fn() }))
vi.mock('../src/plugins/business-metrics.js', () => metrics)

import { submitExamRecord, gradeSubjectiveAnswers } from '../src/db/exam-queries.js'

const RECORD_ID = '33333333-3333-4333-9333-333333333333'
const USER_ID = '00000000-0000-4000-8000-0000000000aa'
const PAPER_ID = '11111111-1111-4111-8111-111111111111'
const SUBJECTIVE_ID = '44444444-4444-4444-8444-444444444441'
const OBJECTIVE_ID = '44444444-4444-4444-8444-444444444442'

const paper = { id: PAPER_ID, passScore: '60' }
const subjectiveQ = { id: SUBJECTIVE_ID, type: 'subjective', answer: null, score: '20' }
const objectiveQ = { id: OBJECTIVE_ID, type: 'single_choice', answer: 'A', score: '10' }

function makeRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: RECORD_ID,
    paperId: PAPER_ID,
    userId: USER_ID,
    answers: null,
    score: '0',
    isPassed: false,
    status: 'answering',
    startedAt: new Date(Date.now() - 60_000),
    submittedAt: null,
    duration: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

beforeEach(() => {
  state.selectQueue.length = 0
  state.updateSets.length = 0
  state.updateCalls = 0
  vi.clearAllMocks()
})

describe('F-693 提交判分:有主观题待阅(submitted),否则判完(graded)', () => {
  it('含主观题 ⇒ status=submitted(旧实现写 graded,导致永远进不了阅卷队列)', async () => {
    state.selectQueue = [
      [makeRecord()],
      [subjectiveQ, objectiveQ],
      [paper],
    ]
    const result = await submitExamRecord(RECORD_ID, USER_ID, [
      { questionId: SUBJECTIVE_ID, answer: '论述内容' },
      { questionId: OBJECTIVE_ID, answer: 'A' },
    ])

    expect(result.score).toBe(10)
    expect(state.updateSets.at(-1)?.status).toBe('submitted')
  })

  it('纯客观题 ⇒ status=graded(旧实现写 submitted,被判成待阅卷)', async () => {
    state.selectQueue = [[makeRecord()], [objectiveQ], [paper]]
    await submitExamRecord(RECORD_ID, USER_ID, [{ questionId: OBJECTIVE_ID, answer: 'A' }])

    const updated = state.updateSets.at(-1)
    expect(updated?.status).toBe('graded')
    expect(updated?.score).toBe('10')
  })
})

describe('F-693 阅卷完成:状态落到 graded,不复写 submitted', () => {
  it('人工阅卷一次 ⇒ 落库 graded 且返回值 graded', async () => {
    const record = makeRecord({
      status: 'submitted',
      score: '10',
      answers: [{ questionId: SUBJECTIVE_ID, answer: '论述内容', isCorrect: false, score: 0 }],
    })
    state.selectQueue = [[record], [subjectiveQ], [paper]]

    const result = await gradeSubjectiveAnswers(RECORD_ID, [{ questionId: SUBJECTIVE_ID, score: 15 }])

    expect(result.status).toBe('graded')
    expect(state.updateSets.at(-1)?.status).toBe('graded')
  })

  it('阅卷重放两次 ⇒ 两次都写 graded,任何一次都不会回落 submitted', async () => {
    const base = {
      status: 'submitted',
      score: '10',
      answers: [{ questionId: SUBJECTIVE_ID, answer: '论述内容', isCorrect: false, score: 0 }],
    }
    state.selectQueue = [
      [makeRecord(base)],
      [subjectiveQ],
      [paper],
      [makeRecord({ ...base, score: '15' })],
      [subjectiveQ],
      [paper],
    ]

    await gradeSubjectiveAnswers(RECORD_ID, [{ questionId: SUBJECTIVE_ID, score: 15 }])
    await gradeSubjectiveAnswers(RECORD_ID, [{ questionId: SUBJECTIVE_ID, score: 15 }])

    expect(state.updateSets.map((s) => s.status)).toEqual(['graded', 'graded'])
  })
})
