/**
 * AI 学习规划报告 mock 数据（后端 LLM 未就绪前使用）
 *
 * 设计：
 *  - 预置 3 条历史报告（不同 period）
 *  - generate 时 delay 800ms 模拟 LLM 调用，返回新生成的 markdown 报告 + 结构化建议
 *  - 建议数组结构与前端规则引擎 generateLocalSuggestions 同构
 */
import type { EduBaseResponse, EduPaginatedResponse } from '@/api/edu/index'
import type {
  AiReportGenerateRequest,
  AiReportGenerateResponse,
  AiReportSuggestion,
} from '@/api/edu/ai-report'

let nextId = 4

const mockReports: AiReportGenerateResponse[] = [
  {
    id: 1,
    report_text: [
      '# 学习规划报告（周度）',
      '',
      '## 总览',
      '本周学习时长稳定，但数学科目错题率偏高，建议加强错题复盘。',
      '',
      '## 强项分析',
      '- 英语阅读理解表现优异，平均分 88 分',
      '',
      '## 弱项预警',
      '- 数学函数章节错题率 32%，需重点复习',
      '',
      '## 下周建议',
      '1. 每日安排 30 分钟数学错题复盘',
      '2. 继续保持英语阅读节奏',
      '3. 周末完成一套数学模拟试卷',
    ].join('\n'),
    suggestions: [
      {
        id: 's1',
        category: 'strength',
        priority: 'low',
        title: '英语科目表现优异',
        description: '本周英语平均分 88 分，阅读理解正确率达 92%。',
        actionable: '可尝试进阶词汇与长难句训练',
        subject: '英语',
      },
      {
        id: 's2',
        category: 'weakness',
        priority: 'high',
        title: '数学函数章节需加强',
        description: '错题率 32%，主要集中在二次函数与指数函数。',
        actionable: '建议每日 30 分钟错题复盘 + 周末模拟卷',
        subject: '数学',
      },
    ],
    generated_at: '2026-06-25T10:00:00Z',
    model: 'mock-glm-4',
    tokens_used: 1280,
  },
  {
    id: 2,
    report_text: [
      '# 学习规划报告（月度）',
      '',
      '## 总览',
      '本月完成 3 门课程学习，整体完成率 65%，进度良好。',
      '',
      '## 课程进度',
      '- 高中数学（必修一）：完成率 80%',
      '- 高中物理（力学）：完成率 55%',
      '- 高中化学（有机）：完成率 60%',
    ].join('\n'),
    suggestions: [
      {
        id: 's3',
        category: 'plan',
        priority: 'medium',
        title: '物理力学课程进度滞后',
        description: '完成率 55%，低于平均水平。',
        actionable: '建议下周安排 2 小时专项学习',
        subject: '物理',
      },
    ],
    generated_at: '2026-06-01T09:00:00Z',
    model: 'mock-glm-4',
    tokens_used: 1560,
  },
  {
    id: 3,
    report_text: [
      '# 学习规划报告（季度）',
      '',
      '## 总览',
      '本季度学习总时长 120 小时，考试通过率 85%，学习状态稳定。',
    ].join('\n'),
    suggestions: [],
    generated_at: '2026-04-01T08:00:00Z',
    model: 'mock-gpt-4o',
    tokens_used: 2100,
  },
]

function delay<T>(data: T, ms = 800): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms))
}

/** 根据请求 context 生成动态建议（模拟 LLM 推理） */
function generateDynamicSuggestions(req: AiReportGenerateRequest): AiReportSuggestion[] {
  const suggestions: AiReportSuggestion[] = []
  const weakSubjects = req.context?.weak_subjects ?? []

  // 强项识别
  suggestions.push({
    id: `gen-strength-${Date.now()}`,
    category: 'strength',
    priority: 'low',
    title: '学习状态保持良好',
    description: '近期学习时长稳定，建议继续保持当前学习节奏。',
    actionable: '可尝试挑战更高难度的题目',
  })

  // 弱项预警（基于 context）
  if (weakSubjects.length > 0) {
    suggestions.push({
      id: `gen-weakness-${Date.now()}`,
      category: 'weakness',
      priority: 'high',
      title: `${weakSubjects[0]}科目需重点加强`,
      description: `检测到 ${weakSubjects.join('、')} 为薄弱科目，建议针对性复习。`,
      actionable: `建议每日安排 45 分钟 ${weakSubjects[0]} 专项练习`,
      subject: weakSubjects[0],
    })
  }

  // 学习规划
  suggestions.push({
    id: `gen-plan-${Date.now()}`,
    category: 'plan',
    priority: 'medium',
    title: '建议制定下一阶段学习计划',
    description: '基于当前进度，建议制定 4 周学习计划，每周聚焦 1-2 个核心知识点。',
    actionable: '点击「开始对话」与 AI 助手深度定制个人计划',
  })

  return suggestions
}

export const aiReportApiMock = {
  generate: (data: AiReportGenerateRequest) => {
    const id = nextId++
    const suggestions = generateDynamicSuggestions(data)
    const report: AiReportGenerateResponse = {
      id,
      report_text: [
        `# AI 学习规划报告（${data.period ?? 'all'}）`,
        '',
        '## 总览',
        `本报告基于你的学习数据快照生成，包含 ${suggestions.length} 条结构化建议。`,
        '',
        '## 详细分析',
        ...suggestions.map(
          (s) => `- **${s.title}**：${s.description}${s.actionable ? `（${s.actionable}）` : ''}`,
        ),
        '',
        '## 下一步',
        '点击「开始对话」可与 AI 助手深度对话，获取更个性化的学习建议。',
      ].join('\n'),
      suggestions,
      generated_at: new Date().toISOString(),
      model: 'mock-glm-4',
      tokens_used: 1000 + Math.floor(Math.random() * 1500),
    }
    mockReports.unshift(report)
    return delay({ code: 0, data: report } as EduBaseResponse<AiReportGenerateResponse>)
  },

  list: (params?: { page?: number; size?: number }) => {
    const items = [...mockReports].sort((a, b) => b.generated_at.localeCompare(a.generated_at))
    const page = params?.page ?? 1
    const size = params?.size ?? 20
    const start = (page - 1) * size
    const paged = items.slice(start, start + size)
    const result: EduBaseResponse<EduPaginatedResponse<AiReportGenerateResponse>> = {
      code: 0,
      data: { items: paged, total: items.length, page, size },
    }
    return delay(result, 300)
  },

  get: (id: number) => {
    const report = mockReports.find((r) => r.id === id)
    if (report) {
      return delay({ code: 0, data: report } as EduBaseResponse<AiReportGenerateResponse>)
    }
    return delay({ code: 404, msg: '报告不存在' } as EduBaseResponse<AiReportGenerateResponse>)
  },
}
