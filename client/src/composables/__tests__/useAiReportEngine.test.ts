/**
 * useAiReportEngine composable 单元测试（PR-D D6）
 *
 * 验证：
 *  - 纯函数 generateLocalSuggestions：5 条规则各自触发/不触发场景
 *  - composable useAiReportEngine：localSuggestions computed + openChatConsult + generateViaApi
 */
import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest'
import { ref, type Ref } from 'vue'

// 使用 vi.hoisted 提供容器（不直接用 ref，避免 TDZ）
// 在 vi.mock 工厂内部创建 ref 实例
const mockStore = vi.hoisted(() => {
  return {
    profile: null as Ref<any> | null,
    learnStat: null as Ref<any> | null,
    courses: null as Ref<any[]> | null,
    examRecords: null as Ref<any[]> | null,
    wrongBook: null as Ref<any[]> | null,
    notes: null as Ref<any[]> | null,
    offlineRecords: null as Ref<any[]> | null,
    dailyStats: null as Ref<any[]> | null,
    weakSubjects: null as Ref<string[]> | null,
    totalLearnHours: null as Ref<number> | null,
    averageExamScore: null as Ref<number> | null,
    completionRate: null as Ref<number> | null,
    examPassRate: null as Ref<number> | null,
    loadAll: null as ReturnType<typeof vi.fn> | null,
    open: null as ReturnType<typeof vi.fn> | null,
    apiGenerate: null as ReturnType<typeof vi.fn> | null,
  }
})

vi.mock('@/composables/useStudentProfile', () => {
  // 在工厂内部初始化 ref，避免提升 TDZ
  mockStore.profile = ref<any>(null)
  mockStore.learnStat = ref<any>(null)
  mockStore.courses = ref<any[]>([])
  mockStore.examRecords = ref<any[]>([])
  mockStore.wrongBook = ref<any[]>([])
  mockStore.notes = ref<any[]>([])
  mockStore.offlineRecords = ref<any[]>([])
  mockStore.dailyStats = ref<any[]>([])
  mockStore.weakSubjects = ref<string[]>([])
  mockStore.totalLearnHours = ref(0)
  mockStore.averageExamScore = ref(0)
  mockStore.completionRate = ref(0)
  mockStore.examPassRate = ref(0)
  mockStore.loadAll = vi.fn().mockResolvedValue(undefined)
  return {
    useStudentProfile: () => ({
      profile: mockStore.profile,
      learnStat: mockStore.learnStat,
      courses: mockStore.courses,
      examRecords: mockStore.examRecords,
      wrongBook: mockStore.wrongBook,
      notes: mockStore.notes,
      offlineRecords: mockStore.offlineRecords,
      dailyStats: mockStore.dailyStats,
      weakSubjects: mockStore.weakSubjects,
      loadAll: mockStore.loadAll,
      totalLearnHours: mockStore.totalLearnHours,
      averageExamScore: mockStore.averageExamScore,
      completionRate: mockStore.completionRate,
      examPassRate: mockStore.examPassRate,
    }),
    resetStudentProfile: vi.fn(),
  }
})

vi.mock('@/composables/useGlobalChat', () => {
  mockStore.open = vi.fn().mockResolvedValue(undefined)
  return {
    useGlobalChat: () => ({
      open: mockStore.open,
      close: vi.fn(),
      isOpen: ref(false),
      setFloatingChatRef: vi.fn(),
      install: vi.fn(),
      dispose: vi.fn(),
    }),
  }
})

vi.mock('@/api/edu/ai-report', () => {
  mockStore.apiGenerate = vi.fn()
  return {
    aiReportApi: {
      generate: mockStore.apiGenerate,
      list: vi.fn(),
      get: vi.fn(),
    },
  }
})

import {
  generateLocalSuggestions,
  AI_RULE_THRESHOLDS,
  useAiReportEngine,
} from '../useAiReportEngine'
import type { AiReportInput } from '../useAiReportEngine'

function makeInput(overrides: Partial<AiReportInput> = {}): AiReportInput {
  return {
    profile: null,
    learnStat: null,
    courses: [],
    examRecords: [],
    wrongBook: [],
    notes: [],
    offlineRecords: [],
    dailyStats: [],
    totalLearnHours: 0,
    averageExamScore: 0,
    completionRate: 0,
    examPassRate: 0,
    weakSubjects: [],
    ...overrides,
  }
}

// 解引用 mock 引用，方便测试中使用
const mp = () => mockStore
const mockProfile = () => mp().profile!
const mockLearnStat = () => mp().learnStat!
const mockCourses = () => mp().courses!
const mockExamRecords = () => mp().examRecords!
const mockWrongBook = () => mp().wrongBook!
const mockNotes = () => mp().notes!
const mockOfflineRecords = () => mp().offlineRecords!
const mockDailyStats = () => mp().dailyStats!
const mockWeakSubjects = () => mp().weakSubjects!
const mockAverageExamScore = () => mp().averageExamScore!
const mockLoadAll = () => mp().loadAll!
const mockOpen = () => mp().open!
const mockApiGenerate = () => mp().apiGenerate!

describe('useAiReportEngine - generateLocalSuggestions 纯函数', () => {
  // 预热 transform：全量跑时首次 import 会被 transform 卡住，提前在 beforeAll 触发
  beforeAll(async () => {
    await import('../useAiReportEngine')
  }, 60000)

  beforeEach(() => {
    mockProfile().value = null
    mockLearnStat().value = null
    mockCourses().value = []
    mockExamRecords().value = []
    mockWrongBook().value = []
    mockNotes().value = []
    mockOfflineRecords().value = []
    mockDailyStats().value = []
    mockWeakSubjects().value = []
    mockAverageExamScore().value = 0
    mockLoadAll().mockClear()
    mockOpen().mockClear()
    mockApiGenerate().mockClear()
  })

  describe('规则 1：强项识别（strength）', () => {
    it('考试平均分 ≥ 85 时触发强项建议', () => {
      const input = makeInput({
        examRecords: [{ id: 1, score: 90 }],
        averageExamScore: 90,
      })
      const result = generateLocalSuggestions(input)
      const strength = result.find((s) => s.category === 'strength')
      expect(strength).toBeDefined()
      expect(strength?.id).toBe('local-strength')
    })

    it('考试平均分 < 85 时不触发强项建议', () => {
      const input = makeInput({
        examRecords: [{ id: 1, score: 70 }],
        averageExamScore: 70,
      })
      const result = generateLocalSuggestions(input)
      expect(result.find((s) => s.category === 'strength')).toBeUndefined()
    })

    it('无考试记录时不触发强项建议', () => {
      const input = makeInput({ examRecords: [], averageExamScore: 0 })
      const result = generateLocalSuggestions(input)
      expect(result.find((s) => s.category === 'strength')).toBeUndefined()
    })
  })

  describe('规则 2：弱项预警（weakness）', () => {
    it('考试平均分 < 60 时触发弱项建议（基于分数）', () => {
      const input = makeInput({
        examRecords: [{ id: 1, score: 50 }],
        averageExamScore: 50,
        weakSubjects: ['数学'],
      })
      const result = generateLocalSuggestions(input)
      const weakness = result.find((s) => s.id === 'local-weakness-score')
      expect(weakness).toBeDefined()
      expect(weakness?.subject).toBe('数学')
    })

    it('错题数 > 10 时触发弱项建议（基于错题）', () => {
      const input = makeInput({
        examRecords: [{ id: 1, score: 80 }],
        averageExamScore: 80,
        wrongBook: Array.from({ length: 15 }, (_, i) => ({ id: i })),
        weakSubjects: ['英语'],
      })
      const result = generateLocalSuggestions(input)
      const weakness = result.find((s) => s.id === 'local-weakness-wrong')
      expect(weakness).toBeDefined()
      expect(weakness?.subject).toBe('英语')
    })

    it('考试平均分 ≥ 60 且错题数 ≤ 10 时不触发弱项建议', () => {
      const input = makeInput({
        examRecords: [{ id: 1, score: 75 }],
        averageExamScore: 75,
        wrongBook: [{ id: 1 }],
      })
      const result = generateLocalSuggestions(input)
      expect(result.find((s) => s.category === 'weakness')).toBeUndefined()
    })
  })

  describe('规则 3：学习规划（plan）', () => {
    it('课程完成率 < 50% 时触发规划建议', () => {
      const input = makeInput({
        courses: [{ course: { id: 1 }, completion: 30, progress: [] }],
        completionRate: 30,
      })
      const result = generateLocalSuggestions(input)
      const plan = result.find((s) => s.category === 'plan')
      expect(plan).toBeDefined()
      expect(plan?.id).toBe('local-plan')
    })

    it('课程完成率 ≥ 50% 时不触发规划建议', () => {
      const input = makeInput({
        courses: [{ course: { id: 1 }, completion: 80, progress: [] }],
        completionRate: 80,
      })
      const result = generateLocalSuggestions(input)
      expect(result.find((s) => s.category === 'plan')).toBeUndefined()
    })

    it('无课程时不触发规划建议', () => {
      const input = makeInput({ courses: [], completionRate: 0 })
      const result = generateLocalSuggestions(input)
      expect(result.find((s) => s.category === 'plan')).toBeUndefined()
    })
  })

  describe('规则 4：风险提示（risk）', () => {
    it('最近 7 天无学习记录时触发风险提示', () => {
      const input = makeInput({
        dailyStats: Array.from({ length: 7 }, (_, i) => ({
          date: `2026-06-${String(20 + i).padStart(2, '0')}`,
          minutes: 0,
        })),
      })
      const result = generateLocalSuggestions(input)
      const risk = result.find((s) => s.category === 'risk')
      expect(risk).toBeDefined()
      expect(risk?.id).toBe('local-risk')
    })

    it('最近 7 天有学习记录时不触发风险提示', () => {
      const input = makeInput({
        dailyStats: [
          { date: '2026-06-25', minutes: 30 },
          { date: '2026-06-24', minutes: 0 },
        ],
      })
      const result = generateLocalSuggestions(input)
      expect(result.find((s) => s.category === 'risk')).toBeUndefined()
    })

    it('无 dailyStats 时不触发风险提示', () => {
      const input = makeInput({ dailyStats: [] })
      const result = generateLocalSuggestions(input)
      expect(result.find((s) => s.category === 'risk')).toBeUndefined()
    })
  })

  describe('规则 5：学习建议（tip）', () => {
    it('笔记数 < 5 时触发建议', () => {
      const input = makeInput({ notes: [{ id: 1 }] })
      const result = generateLocalSuggestions(input)
      const tip = result.find((s) => s.category === 'tip')
      expect(tip).toBeDefined()
      expect(tip?.id).toBe('local-tip-notes')
    })

    it('笔记数 ≥ 5 时不触发建议', () => {
      const input = makeInput({
        notes: Array.from({ length: 6 }, (_, i) => ({ id: i })),
      })
      const result = generateLocalSuggestions(input)
      expect(result.find((s) => s.category === 'tip')).toBeUndefined()
    })
  })

  describe('综合场景', () => {
    it('所有数据为空时仅返回 tip 建议（鼓励记笔记）', () => {
      const result = generateLocalSuggestions(makeInput())
      // 规则 5 (tip) 没有守卫 notes.length > 0，0 < 5 触发
      // 其他规则都有守卫（examRecords.length > 0 / courses.length > 0 / dailyStats.length > 0）
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('local-tip-notes')
      expect(result[0].category).toBe('tip')
    })

    it('所有规则都触发时返回 4 条建议', () => {
      const input = makeInput({
        examRecords: [{ id: 1, score: 50 }],
        averageExamScore: 50,
        wrongBook: Array.from({ length: 15 }, (_, i) => ({ id: i })),
        courses: [{ course: { id: 1 }, completion: 20, progress: [] }],
        completionRate: 20,
        notes: [],
        dailyStats: Array.from({ length: 7 }, (_, i) => ({
          date: `2026-06-${String(20 + i).padStart(2, '0')}`,
          minutes: 0,
        })),
        weakSubjects: ['数学'],
      })
      const result = generateLocalSuggestions(input)
      // strength 需要 score ≥ 85，这里 score=50 不触发
      // weakness-score 触发（score < 60）
      // plan 触发（completion < 50）
      // risk 触发
      // tip 触发（notes=0 < 5）
      expect(result).toHaveLength(4)
      const categories = result.map((s) => s.category)
      expect(categories).toContain('weakness')
      expect(categories).toContain('plan')
      expect(categories).toContain('risk')
      expect(categories).toContain('tip')
    })

    it('AI_RULE_THRESHOLDS 常量可调', () => {
      expect(AI_RULE_THRESHOLDS.STRENGTH_SCORE).toBe(85)
      expect(AI_RULE_THRESHOLDS.WEAKNESS_SCORE).toBe(60)
      expect(AI_RULE_THRESHOLDS.WEAKNESS_WRONG_COUNT).toBe(10)
      expect(AI_RULE_THRESHOLDS.PLAN_COMPLETION_RATE).toBe(50)
      expect(AI_RULE_THRESHOLDS.RISK_INACTIVE_DAYS).toBe(7)
      expect(AI_RULE_THRESHOLDS.TIP_NOTES_COUNT).toBe(5)
    })
  })
})

describe('useAiReportEngine - composable', () => {
  beforeEach(() => {
    mockProfile().value = { id: 1, real_name: '张三', member_no: 'M001', level: 5 }
    mockExamRecords().value = [{ id: 1, score: 90 }]
    mockAverageExamScore().value = 90
    mockNotes().value = [{ id: 1 }, { id: 2 }, { id: 3 }]
    mockLoadAll().mockClear()
    mockOpen().mockClear()
    mockApiGenerate().mockClear()
  })

  it('localSuggestions 是 computed，实时反映数据变化', () => {
    const { localSuggestions } = useAiReportEngine()
    // 初始：score=90 ≥ 85 → strength 触发；notes=3 < 5 → tip 触发
    expect(localSuggestions.value.length).toBeGreaterThan(0)
    const categories = localSuggestions.value.map((s) => s.category)
    expect(categories).toContain('strength')
    expect(categories).toContain('tip')
  })

  it('openChatConsult 调用 useGlobalChat.open', async () => {
    const { openChatConsult } = useAiReportEngine()
    await openChatConsult()
    expect(mockOpen()).toHaveBeenCalledTimes(1)
    const callArg = mockOpen().mock.calls[0][0]
    expect(callArg).toHaveProperty('initialText')
    expect(callArg).toHaveProperty('mode', 'deep')
    // initialText 应包含学员姓名
    expect(callArg.initialText).toContain('张三')
  })

  it('generateViaApi 调用 aiReportApi.generate 并填充 apiReport', async () => {
    const mockResponse = {
      data: {
        id: 100,
        report_text: '# 测试报告',
        suggestions: [],
        generated_at: '2026-07-03T10:00:00Z',
        model: 'mock-glm-4',
        tokens_used: 500,
      },
    }
    mockApiGenerate().mockResolvedValueOnce(mockResponse)
    const { generateViaApi, apiReport } = useAiReportEngine()
    await generateViaApi('week')
    expect(mockApiGenerate()).toHaveBeenCalledTimes(1)
    const callArg = mockApiGenerate().mock.calls[0][0]
    expect(callArg).toHaveProperty('user_id', '1')
    expect(callArg).toHaveProperty('period', 'week')
    expect(callArg).toHaveProperty('context')
    expect(apiReport.value).not.toBeNull()
    expect(apiReport.value?.id).toBe(100)
    expect(apiReport.value?.report_text).toBe('# 测试报告')
  })

  it('generateViaApi 失败时填充 apiError', async () => {
    mockApiGenerate().mockRejectedValueOnce(new Error('network error'))
    const { generateViaApi, apiError } = useAiReportEngine()
    await generateViaApi('month')
    expect(apiError.value).toBe('network error')
  })
})
