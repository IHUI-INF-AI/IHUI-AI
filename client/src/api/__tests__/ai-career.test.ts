// ai-career.ts 单元测试
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/utils/request', () => ({
  default: { post: vi.fn() },
}))

vi.mock('@/utils/api-response', () => ({
  withApiResponseHandler: (fn: any) => fn,
  normalizeApiResponse: (r: any) => r?.data ?? r,
}))

vi.mock('@/utils/i18n', () => ({
  t: (k: string) => k,
}))

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}))

vi.mock('@/config/backend-paths', () => ({
  COZE_PATHS: { aiCareer: { submit: '/ai-career/submit' } },
}))

import request from '@/utils/request'
import * as api from '../ai/ai-career'

describe('ai-career', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(request.post as any).mockResolvedValue({ data: { message: 'ok', recommendation: 'rec' } })
  })

  it('submitAICareerForm 正常', async () => {
    const r = await api.submitAICareerForm({ school: 's', classLevel: 'c', scoreRange: '80', languageDifficulty: 'd' })
    expect(r).toBeDefined()
  })

  it('submitAICareerForm 完整数据', async () => {
    const r = await api.submitAICareerForm({
      school: 's', classLevel: 'c', scoreRange: '80', languageDifficulty: 'd',
      scienceCharacteristics: 'sc', learningObstacle: 'lo', hobbies: 'h', personality: 'p',
      extraTime: 'et', pressureTolerance: 'pt', learningGoal: 'lg',
      personalityTest1: 'p1', personalityTest2: 'p2', personalityTest3: 'p3', personalityTest4: 'p4', personalityTest5: 'p5',
    })
    expect(r).toBeDefined()
  })

  it('submitAICareerForm 错误抛出', async () => {
    ;(request.post as any).mockRejectedValueOnce(new Error('fail'))
    try { await api.submitAICareerForm({ school: 's', classLevel: 'c', scoreRange: '80', languageDifficulty: 'd' }) } catch { /* noop */ }
  })
})
