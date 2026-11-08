// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-168 回归锁:考试答题记录 BOLA。
 *
 * 旧实现 startAnswering/submitExam 只按 recordId 取记录并改状态,getExamRecordStatus
 * 也没有查看者概念 —— 任何登录用户都能操作/读取他人答题记录。
 * 本测试用假库直接调用生产函数,断言:
 *  - 他人记录 startAnswering/submitExam 抛 404,且没有发生 update;
 *  - getExamRecordStatus(id, 他人id) 抛 404;
 *  - getExamRecordStatus(id)(不传 viewer)仍可读(管理员/系统能力保留)。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const ME = '11111111-1111-4111-8111-111111111111'
const OTHER = '22222222-2222-4222-8222-222222222222'
const RECORD_ID = '33333333-3333-4333-9333-333333333333'
const PAPER_ID = '44444444-4444-4444-8444-444444444444'

const fake = vi.hoisted(() => {
  const state = {
    selectResults: [] as unknown[][],
    updateResult: [] as unknown[],
    selectCalls: 0,
    updateCalls: 0,
  }

  interface Chain {
    then: (
      resolve: (value: unknown[]) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => Promise<unknown>
    from: () => Chain
    where: () => Chain
    limit: () => Chain
    orderBy: () => Chain
    offset: () => Chain
    values: () => Chain
    set: () => Chain
    returning: () => Chain
    leftJoin: () => Chain
    innerJoin: () => Chain
    groupBy: () => Chain
    onConflictDoUpdate: () => Chain
  }

  function createChain(result: unknown[]): Chain {
    const chain: Chain = {
      then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
      from: () => chain,
      where: () => chain,
      limit: () => chain,
      orderBy: () => chain,
      offset: () => chain,
      values: () => chain,
      set: () => chain,
      returning: () => chain,
      leftJoin: () => chain,
      innerJoin: () => chain,
      groupBy: () => chain,
      onConflictDoUpdate: () => chain,
    }
    return chain
  }

  const db = {
    select: vi.fn(() => {
      state.selectCalls++
      return createChain(state.selectResults.shift() ?? [])
    }),
    update: vi.fn(() => {
      state.updateCalls++
      return createChain(state.updateResult)
    }),
    insert: vi.fn(() => createChain([])),
    delete: vi.fn(() => createChain([])),
    execute: vi.fn().mockResolvedValue([]),
  }

  return { state, db }
})

vi.mock('../src/db/index.js', () => ({ db: fake.db }))

import { startAnswering, submitExam, getExamRecordStatus } from '../src/db/exam-extended-queries.js'

function makeRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: RECORD_ID,
    paperId: PAPER_ID,
    userId: ME,
    answers: null,
    score: '0',
    isPassed: false,
    status: 'enrolled',
    startedAt: new Date(),
    submittedAt: null,
    duration: 0,
    createdAt: new Date(),
    ...overrides,
  }
}

describe('F-168 答题记录归属守卫', () => {
  beforeEach(() => {
    fake.state.selectResults = []
    fake.state.updateResult = []
    fake.state.selectCalls = 0
    fake.state.updateCalls = 0
    fake.db.select.mockClear()
    fake.db.update.mockClear()
  })

  it('startAnswering: 他人记录抛 404 且不执行 update', async () => {
    fake.state.selectResults = [[makeRecord({ userId: OTHER, status: 'enrolled' })]]

    await expect(startAnswering(RECORD_ID, ME)).rejects.toMatchObject({
      statusCode: 404,
      message: '答题记录不存在',
    })
    expect(fake.state.updateCalls).toBe(0)
  })

  it('submitExam: 他人记录抛 404 且不执行 update(归属先于状态机)', async () => {
    // status=answering 本可正常提交,归属校验必须先生效
    fake.state.selectResults = [[makeRecord({ userId: OTHER, status: 'answering' })]]

    await expect(submitExam(RECORD_ID, ME)).rejects.toMatchObject({
      statusCode: 404,
      message: '答题记录不存在',
    })
    expect(fake.state.updateCalls).toBe(0)
    // 未进入时间窗口查询,select 只发生一次(取记录)
    expect(fake.state.selectCalls).toBe(1)
  })

  it('getExamRecordStatus: 传他人 viewerId 抛 404', async () => {
    fake.state.selectResults = [[makeRecord({ userId: OTHER })]]

    await expect(getExamRecordStatus(RECORD_ID, ME)).rejects.toMatchObject({
      statusCode: 404,
      message: '答题记录不存在',
    })
  })

  it('getExamRecordStatus: 不传 viewer 保持系统读取能力', async () => {
    const record = makeRecord({ userId: OTHER, status: 'answering' })
    fake.state.selectResults = [[record]]

    await expect(getExamRecordStatus(RECORD_ID)).resolves.toMatchObject({
      id: RECORD_ID,
      userId: OTHER,
      status: 'answering',
    })
  })

  it('本人记录 startAnswering 仍可正常流转(假库有效性的反向对照)', async () => {
    fake.state.selectResults = [[makeRecord({ userId: ME, status: 'enrolled' })]]
    fake.state.updateResult = [makeRecord({ userId: ME, status: 'answering' })]

    await expect(startAnswering(RECORD_ID, ME)).resolves.toMatchObject({
      id: RECORD_ID,
      status: 'answering',
    })
    expect(fake.state.updateCalls).toBe(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
