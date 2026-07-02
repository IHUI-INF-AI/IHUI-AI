/**
 * AI 学习规划报告引擎 composable（PR-D D1）
 *
 * 双导出架构：
 *  1. 纯函数 generateLocalSuggestions(input)：5 条规则，不依赖 Vue 运行时，便于单测
 *  2. composable useAiReportEngine()：聚合 useStudentProfile 数据 + 调 aiReportApi + 调 useGlobalChat
 *
 * 三种 AI 报告实现方式：
 *  - local：localSuggestions computed（实时计算，无 API 调用）
 *  - chat：openChatConsult() 调 useGlobalChat.open 传 prompt 序列化学习快照
 *  - api：generateViaApi() 调 aiReportApi.generate，返回 markdown 报告
 *
 * 5 条规则（generateLocalSuggestions）：
 *  1. strength：考试平均分 ≥ 85 → 强项识别
 *  2. weakness：考试平均分 < 60 或错题数 > 10 → 弱项预警
 *  3. plan：课程完成率 < 50% → 学习规划建议
 *  4. risk：最近 7 天无学习记录 → 学习中断风险
 *  5. tip：笔记数 < 5 → 学习建议
 */
import { ref, computed } from 'vue'
import { useStudentProfile } from './useStudentProfile'
import type { CourseWithProgress, LearnStat } from './useStudentProfile'
import { useGlobalChat } from './useGlobalChat'
import { aiReportApi } from '@/api/edu/ai-report'
import type {
  AiReportGenerateResponse,
  AiReportSuggestion,
} from '@/api/edu/ai-report'
import type {
  EduMember,
  EduExamRecord,
  EduWrongBookItem,
} from '@/api/edu'
import type { LearningNote } from '@/api/edu/notes'
import type { OfflineRecord } from '@/api/edu/offline-records'
import type { DailyStat } from '@/api/edu/stats'

// ============================================================================
// 纯函数：generateLocalSuggestions（不依赖 Vue 运行时，便于单测）
// ============================================================================

/** 规则引擎输入数据快照 */
export interface AiReportInput {
  profile: EduMember | null
  learnStat: LearnStat | null
  courses: CourseWithProgress[]
  examRecords: EduExamRecord[]
  wrongBook: EduWrongBookItem[]
  notes: LearningNote[]
  offlineRecords: OfflineRecord[]
  dailyStats: DailyStat[]
  totalLearnHours: number
  averageExamScore: number
  completionRate: number
  examPassRate: number
  weakSubjects: string[]
}

/** 规则引擎阈值常量（便于单测调整） */
export const AI_RULE_THRESHOLDS = {
  STRENGTH_SCORE: 85,
  WEAKNESS_SCORE: 60,
  WEAKNESS_WRONG_COUNT: 10,
  PLAN_COMPLETION_RATE: 50,
  RISK_INACTIVE_DAYS: 7,
  TIP_NOTES_COUNT: 5,
} as const

/**
 * 计算最近 N 天是否有学习记录
 * @returns 最近活跃天数（0 表示近 N 天无记录）
 */
function countRecentActiveDays(dailyStats: DailyStat[], days: number): number {
  if (dailyStats.length === 0) return 0
  const sorted = [...dailyStats].sort((a, b) => b.date.localeCompare(a.date))
  let activeDays = 0
  for (let i = 0; i < Math.min(days, sorted.length); i++) {
    if (sorted[i].minutes > 0) activeDays++
  }
  return activeDays
}

/**
 * 前端规则引擎：基于学习数据快照生成结构化建议
 *
 * @param input 学习数据快照
 * @returns 建议数组（title/description/actionable 为 i18n key，subject 为具体科目名）
 */
export function generateLocalSuggestions(input: AiReportInput): AiReportSuggestion[] {
  const suggestions: AiReportSuggestion[] = []
  const {
    examRecords,
    wrongBook,
    courses,
    notes,
    dailyStats,
    averageExamScore,
    completionRate,
    weakSubjects,
  } = input

  // 规则 1：强项识别（考试平均分 ≥ 85）
  if (examRecords.length > 0 && averageExamScore >= AI_RULE_THRESHOLDS.STRENGTH_SCORE) {
    suggestions.push({
      id: 'local-strength',
      category: 'strength',
      priority: 'low',
      title: 'edu.profile.aiRuleStrengthTitle',
      description: 'edu.profile.aiRuleStrengthDesc',
      actionable: 'edu.profile.aiRuleStrengthAction',
    })
  }

  // 规则 2：弱项预警（考试平均分 < 60 或错题数 > 10）
  if (examRecords.length > 0 && averageExamScore < AI_RULE_THRESHOLDS.WEAKNESS_SCORE) {
    suggestions.push({
      id: 'local-weakness-score',
      category: 'weakness',
      priority: 'high',
      title: 'edu.profile.aiRuleWeaknessTitle',
      description: 'edu.profile.aiRuleWeaknessDesc',
      actionable: 'edu.profile.aiRuleWeaknessAction',
      subject: weakSubjects[0],
    })
  } else if (wrongBook.length > AI_RULE_THRESHOLDS.WEAKNESS_WRONG_COUNT) {
    suggestions.push({
      id: 'local-weakness-wrong',
      category: 'weakness',
      priority: 'high',
      title: 'edu.profile.aiRuleWeaknessWrongTitle',
      description: 'edu.profile.aiRuleWeaknessWrongDesc',
      actionable: 'edu.profile.aiRuleWeaknessWrongAction',
      subject: weakSubjects[0],
    })
  }

  // 规则 3：学习规划（课程完成率 < 50%）
  if (courses.length > 0 && completionRate < AI_RULE_THRESHOLDS.PLAN_COMPLETION_RATE) {
    suggestions.push({
      id: 'local-plan',
      category: 'plan',
      priority: 'medium',
      title: 'edu.profile.aiRulePlanTitle',
      description: 'edu.profile.aiRulePlanDesc',
      actionable: 'edu.profile.aiRulePlanAction',
    })
  }

  // 规则 4：风险提示（最近 7 天无学习记录）
  const recentActiveDays = countRecentActiveDays(dailyStats, AI_RULE_THRESHOLDS.RISK_INACTIVE_DAYS)
  if (dailyStats.length > 0 && recentActiveDays === 0) {
    suggestions.push({
      id: 'local-risk',
      category: 'risk',
      priority: 'high',
      title: 'edu.profile.aiRuleRiskTitle',
      description: 'edu.profile.aiRuleRiskDesc',
      actionable: 'edu.profile.aiRuleRiskAction',
    })
  }

  // 规则 5：学习建议（笔记数 < 5）
  if (notes.length < AI_RULE_THRESHOLDS.TIP_NOTES_COUNT) {
    suggestions.push({
      id: 'local-tip-notes',
      category: 'tip',
      priority: 'low',
      title: 'edu.profile.aiRuleTipTitle',
      description: 'edu.profile.aiRuleTipDesc',
      actionable: 'edu.profile.aiRuleTipAction',
    })
  }

  return suggestions
}

// ============================================================================
// composable：useAiReportEngine（聚合 useStudentProfile + aiReportApi + useGlobalChat）
// ============================================================================

/** 序列化学习快照为 AIChat prompt 文本 */
function serializePrompt(input: AiReportInput): string {
  const parts: string[] = []
  parts.push(`学员姓名：${input.profile?.real_name ?? '-'}`)
  parts.push(`学习时长（小时）：${input.totalLearnHours}`)
  parts.push(`考试平均分：${input.averageExamScore}`)
  parts.push(`课程完成率：${input.completionRate}%`)
  parts.push(`考试通过率：${input.examPassRate}%`)
  if (input.weakSubjects.length > 0) {
    parts.push(`薄弱科目：${input.weakSubjects.join('、')}`)
  }
  parts.push(`笔记数：${input.notes.length}`)
  parts.push(`错题数：${input.wrongBook.length}`)
  parts.push(`课程数：${input.courses.length}`)
  parts.push(`连续学习天数：${input.learnStat?.continuousDays ?? 0}`)
  parts.push('')
  parts.push('请基于以上学习数据，为我制定一份个性化的学习规划报告，包含：')
  parts.push('1. 学习状态总览')
  parts.push('2. 强项与弱项分析')
  parts.push('3. 未来 4 周学习计划（每周聚焦 1-2 个核心知识点）')
  parts.push('4. 针对薄弱科目的具体提升建议')
  return parts.join('\n')
}

export function useAiReportEngine() {
  const {
    profile,
    learnStat,
    courses,
    examRecords,
    wrongBook,
    notes,
    offlineRecords,
    dailyStats,
    loadAll,
    totalLearnHours,
    averageExamScore,
    completionRate,
    examPassRate,
    weakSubjects,
  } = useStudentProfile()

  // local 模式：实时计算的建议（无 API 调用）
  const localSuggestions = computed<AiReportSuggestion[]>(() => {
    return generateLocalSuggestions({
      profile: profile.value,
      learnStat: learnStat.value,
      courses: courses.value,
      examRecords: examRecords.value,
      wrongBook: wrongBook.value,
      notes: notes.value,
      offlineRecords: offlineRecords.value,
      dailyStats: dailyStats.value,
      totalLearnHours: totalLearnHours.value,
      averageExamScore: averageExamScore.value,
      completionRate: completionRate.value,
      examPassRate: examPassRate.value,
      weakSubjects: weakSubjects.value,
    })
  })

  // chat 模式：AIChat 深度咨询
  const chatLoading = ref(false)
  const globalChat = useGlobalChat()

  async function openChatConsult(): Promise<void> {
    if (chatLoading.value) return
    chatLoading.value = true
    try {
      const prompt = serializePrompt({
        profile: profile.value,
        learnStat: learnStat.value,
        courses: courses.value,
        examRecords: examRecords.value,
        wrongBook: wrongBook.value,
        notes: notes.value,
        offlineRecords: offlineRecords.value,
        dailyStats: dailyStats.value,
        totalLearnHours: totalLearnHours.value,
        averageExamScore: averageExamScore.value,
        completionRate: completionRate.value,
        examPassRate: examPassRate.value,
        weakSubjects: weakSubjects.value,
      })
      await globalChat.open({ initialText: prompt, mode: 'deep' })
    } finally {
      chatLoading.value = false
    }
  }

  // api 模式：后端 LLM 报告生成
  const apiLoading = ref(false)
  const apiReport = ref<AiReportGenerateResponse | null>(null)
  const apiError = ref<string>('')

  async function generateViaApi(period: 'week' | 'month' | 'quarter' | 'all' = 'month'): Promise<void> {
    if (apiLoading.value) return
    apiLoading.value = true
    apiError.value = ''
    try {
      const userId = String(profile.value?.id ?? profile.value?.user_id ?? 'anonymous')
      const res = await aiReportApi.generate({
        user_id: userId,
        period,
        context: {
          profile_summary: {
            name: profile.value?.real_name ?? '-',
            level: profile.value?.level ?? 0,
            member_no: profile.value?.member_no ?? profile.value?.student_no ?? '-',
          },
          learning_stats: {
            total_learn_hours: totalLearnHours.value,
            average_exam_score: averageExamScore.value,
            completion_rate: completionRate.value,
            exam_pass_rate: examPassRate.value,
            notes_count: notes.value.length,
            wrong_book_count: wrongBook.value.length,
            courses_count: courses.value.length,
          },
          weak_subjects: weakSubjects.value,
        },
      })
      apiReport.value = (res as { data?: AiReportGenerateResponse })?.data ?? null
    } catch (e) {
      apiError.value = (e as Error)?.message ?? 'generate failed'
      console.error('[useAiReportEngine] generateViaApi failed', e)
    } finally {
      apiLoading.value = false
    }
  }

  return {
    // local 模式
    localSuggestions,
    // chat 模式
    chatLoading,
    openChatConsult,
    // api 模式
    apiLoading,
    apiReport,
    apiError,
    generateViaApi,
    // 数据加载
    loadAll,
  }
}
