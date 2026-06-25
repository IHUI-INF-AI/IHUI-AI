import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/utils/request', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: { code: 0, data: {} } }),
    post: vi.fn().mockResolvedValue({ data: { code: 0, data: {} } }),
    put: vi.fn().mockResolvedValue({ data: { code: 0, data: {} } }),
    delete: vi.fn().mockResolvedValue({ data: { code: 0, data: {} } }),
  },
}))

import * as api from '../learn/exam'

describe('exam', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('examApi.listPapers 应能正常调用', async () => {
    const result = await api.examApi.listPapers()
    expect(result).toBeDefined()
  })

  it('examApi.paperDetail 应能正常调用', async () => {
    const result = await api.examApi.paperDetail(1)
    expect(result).toBeDefined()
  })

  it('examApi.startExam 应能正常调用', async () => {
    const result = await api.examApi.startExam(1)
    expect(result).toBeDefined()
  })

  it('examApi.submitExam 应能正常调用', async () => {
    const result = await api.examApi.submitExam(1, { '1': 'A' }, 10)
    expect(result).toBeDefined()
  })

  it('examApi.categories 应能正常调用', async () => {
    const result = await api.examApi.categories()
    expect(result).toBeDefined()
  })

  it('examApi.questions 应能正常调用', async () => {
    const result = await api.examApi.questions(1)
    expect(result).toBeDefined()
  })

  it('examApi.records 应能正常调用', async () => {
    const result = await api.examApi.records()
    expect(result).toBeDefined()
  })

  it('examApi.recordDetail 应能正常调用', async () => {
    const result = await api.examApi.recordDetail(1)
    expect(result).toBeDefined()
  })

  it('examApi.wrongList 应能正常调用', async () => {
    const result = await api.examApi.wrongList()
    expect(result).toBeDefined()
  })

  it('examApi.markWrongMastered 应能正常调用', async () => {
    const result = await api.examApi.markWrongMastered(1)
    expect(result).toBeDefined()
  })

  it('examApi.removeWrong 应能正常调用', async () => {
    const result = await api.examApi.removeWrong(1)
    expect(result).toBeDefined()
  })
})
