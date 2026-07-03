/**
 * useReportGenerator composable 单元测试
 *
 * 验证：
 * - metadata 计算属性正确派生自 useStudentProfile
 * - sections 包含 10 个 section 配置
 * - sections visible 逻辑：空数据时 visible=false
 * - generateReport() 异步方法调用后返回 { metadata, sections }
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref, nextTick } from 'vue'

// Mock useStudentProfile 模块（在 import useReportGenerator 之前）
const mockProfile = ref<any>(null)
const mockCourses = ref<any[]>([])
const mockExamRecords = ref<any[]>([])
const mockCertificates = ref<any[]>([])
const mockUploadedCerts = ref<any[]>([])
const mockNotes = ref<any[]>([])
const mockOfflineRecords = ref<any[]>([])
const mockDailyStats = ref<any[]>([])
const mockCategoryStats = ref<any[]>([])
const mockSkillRadar = ref<any[]>([])
const mockWeakSubjects = ref<string[]>([])
const mockTotalLearnHours = ref(0)
const mockAverageExamScore = ref(0)
const mockCompletionRate = ref(0)
const mockExamPassRate = ref(0)
const mockLoadAll = vi.fn().mockResolvedValue(undefined)

vi.mock('@/composables/useStudentProfile', () => ({
  useStudentProfile: () => ({
    profile: mockProfile,
    learnStat: ref(null),
    courses: mockCourses,
    examRecords: mockExamRecords,
    certificates: mockCertificates,
    uploadedCerts: mockUploadedCerts,
    notes: mockNotes,
    offlineRecords: mockOfflineRecords,
    dailyStats: mockDailyStats,
    categoryStats: mockCategoryStats,
    skillRadar: mockSkillRadar,
    weakSubjects: mockWeakSubjects,
    loadAll: mockLoadAll,
    totalLearnHours: mockTotalLearnHours,
    averageExamScore: mockAverageExamScore,
    completionRate: mockCompletionRate,
    examPassRate: mockExamPassRate,
  }),
  resetStudentProfile: vi.fn(),
}))

import { useReportGenerator } from '../useReportGenerator'

describe('useReportGenerator', () => {
  beforeEach(() => {
    // 重置所有 mock 数据
    mockProfile.value = null
    mockCourses.value = []
    mockExamRecords.value = []
    mockCertificates.value = []
    mockUploadedCerts.value = []
    mockNotes.value = []
    mockOfflineRecords.value = []
    mockDailyStats.value = []
    mockCategoryStats.value = []
    mockSkillRadar.value = []
    mockWeakSubjects.value = []
    mockTotalLearnHours.value = 0
    mockAverageExamScore.value = 0
    mockCompletionRate.value = 0
    mockExamPassRate.value = 0
    mockLoadAll.mockClear()
  })

  describe('metadata 计算属性', () => {
    it('profile 为 null 时使用默认值', () => {
      const { metadata } = useReportGenerator()
      expect(metadata.value.studentName).toBe('-')
      expect(metadata.value.memberNo).toBe('-')
      expect(metadata.value.level).toBe(0)
    })

    it('profile 有值时正确派生学员信息', async () => {
      mockProfile.value = {
        real_name: '张三',
        member_no: 'M001',
        level: 5,
      }
      mockTotalLearnHours.value = 120
      mockAverageExamScore.value = 85
      mockCompletionRate.value = 75
      mockExamPassRate.value = 90

      const { metadata } = useReportGenerator()
      await nextTick()

      expect(metadata.value.studentName).toBe('张三')
      expect(metadata.value.memberNo).toBe('M001')
      expect(metadata.value.level).toBe(5)
      expect(metadata.value.totalLearnHours).toBe(120)
      expect(metadata.value.averageExamScore).toBe(85)
      expect(metadata.value.completionRate).toBe(75)
      expect(metadata.value.examPassRate).toBe(90)
    })

    it('generatedAt 是 ISO 字符串', () => {
      const { metadata } = useReportGenerator()
      expect(typeof metadata.value.generatedAt).toBe('string')
      expect(() => new Date(metadata.value.generatedAt)).not.toThrow()
    })

    it('member_no 缺失时回退到 student_no', async () => {
      mockProfile.value = {
        real_name: '李四',
        student_no: 'S002',
        level: 3,
      }
      const { metadata } = useReportGenerator()
      await nextTick()
      expect(metadata.value.memberNo).toBe('S002')
    })
  })

  describe('sections 计算属性', () => {
    it('返回 11 个 section 配置', () => {
      const { sections } = useReportGenerator()
      expect(sections.value).toHaveLength(11)
    })

    it('包含 aiReport section（PR-D D5）', () => {
      const { sections } = useReportGenerator()
      const aiSection = sections.value.find((s) => s.key === 'aiReport')
      expect(aiSection).toBeDefined()
      expect(aiSection?.visible).toBe(true)
    })

    it('section keys 唯一', () => {
      const { sections } = useReportGenerator()
      const keys = sections.value.map((s) => s.key)
      const uniqueKeys = new Set(keys)
      expect(uniqueKeys.size).toBe(keys.length)
    })

    it('所有数据为空时，除 studentInfo 和 aiReport 外 visible=false', () => {
      const { sections } = useReportGenerator()
      const visibleSections = sections.value.filter((s) => s.visible)
      // studentInfo + aiReport（PR-D D5）总是 visible=true
      expect(visibleSections.map((s) => s.key)).toEqual(['studentInfo', 'aiReport'])
    })

    it('dailyStats 有数据时 learningTrend visible=true', async () => {
      mockDailyStats.value = [{ date: '2026-07-01', minutes: 30 }]
      const { sections } = useReportGenerator()
      await nextTick()
      const trend = sections.value.find((s) => s.key === 'learningTrend')
      expect(trend?.visible).toBe(true)
    })

    it('categoryStats 有数据时 categoryDistribution visible=true', async () => {
      mockCategoryStats.value = [{ category: 'math', minutes: 100, count: 5 }]
      const { sections } = useReportGenerator()
      await nextTick()
      const dist = sections.value.find((s) => s.key === 'categoryDistribution')
      expect(dist?.visible).toBe(true)
    })

    it('skillRadar 有数据时 skillRadar visible=true', async () => {
      mockSkillRadar.value = [{ skill: '编程', score: 80 }]
      const { sections } = useReportGenerator()
      await nextTick()
      const radar = sections.value.find((s) => s.key === 'skillRadar')
      expect(radar?.visible).toBe(true)
    })

    it('courses 有数据时 courseProgress visible=true', async () => {
      mockCourses.value = [{ course: { id: 1, title: '测试课程' }, completion: 50, progress: [] }]
      const { sections } = useReportGenerator()
      await nextTick()
      const progress = sections.value.find((s) => s.key === 'courseProgress')
      expect(progress?.visible).toBe(true)
    })

    it('examRecords 有数据时 examRecords visible=true', async () => {
      mockExamRecords.value = [{ id: 1, paper_id: 1, status: 'completed' }]
      const { sections } = useReportGenerator()
      await nextTick()
      const exams = sections.value.find((s) => s.key === 'examRecords')
      expect(exams?.visible).toBe(true)
    })

    it('certificates 或 uploadedCerts 有数据时 certificates visible=true', async () => {
      mockCertificates.value = [{ id: 1, certificate_no: 'C001', title: '证书', issue_date: '2026-01-01' }]
      const { sections } = useReportGenerator()
      await nextTick()
      const certs = sections.value.find((s) => s.key === 'certificates')
      expect(certs?.visible).toBe(true)
    })

    it('weakSubjects 有数据时 weakSubjects visible=true', async () => {
      mockWeakSubjects.value = ['数学', '英语']
      const { sections } = useReportGenerator()
      await nextTick()
      const weak = sections.value.find((s) => s.key === 'weakSubjects')
      expect(weak?.visible).toBe(true)
    })

    it('notes 有数据时 notes visible=true', async () => {
      mockNotes.value = [{ id: 1, title: '笔记', content: '内容' }]
      const { sections } = useReportGenerator()
      await nextTick()
      const notes = sections.value.find((s) => s.key === 'notes')
      expect(notes?.visible).toBe(true)
    })

    it('offlineRecords 有数据时 offlineRecords visible=true', async () => {
      mockOfflineRecords.value = [{ id: 1, title: '线下记录', duration_minutes: 60, record_date: '2026-01-01' }]
      const { sections } = useReportGenerator()
      await nextTick()
      const offline = sections.value.find((s) => s.key === 'offlineRecords')
      expect(offline?.visible).toBe(true)
    })

    it('每个 section 都有 title 字段', () => {
      const { sections } = useReportGenerator()
      for (const s of sections.value) {
        expect(typeof s.title).toBe('string')
        expect(s.title.length).toBeGreaterThan(0)
      }
    })
  })

  describe('generateReport 异步方法', () => {
    it('调用 loadAll 后返回 { metadata, sections }', async () => {
      const { generateReport } = useReportGenerator()
      const result = await generateReport()
      expect(mockLoadAll).toHaveBeenCalled()
      expect(result).toHaveProperty('metadata')
      expect(result).toHaveProperty('sections')
      expect(Array.isArray(result.sections)).toBe(true)
      expect(result.sections).toHaveLength(11)
    })

    it('返回的 metadata 包含所有必需字段', async () => {
      const { generateReport } = useReportGenerator()
      const result = await generateReport()
      expect(result.metadata).toHaveProperty('generatedAt')
      expect(result.metadata).toHaveProperty('studentName')
      expect(result.metadata).toHaveProperty('memberNo')
      expect(result.metadata).toHaveProperty('level')
      expect(result.metadata).toHaveProperty('totalLearnHours')
      expect(result.metadata).toHaveProperty('averageExamScore')
      expect(result.metadata).toHaveProperty('completionRate')
      expect(result.metadata).toHaveProperty('examPassRate')
    })
  })
})
