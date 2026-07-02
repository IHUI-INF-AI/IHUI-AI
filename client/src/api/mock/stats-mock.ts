/**
 * 学习统计 mock 数据（后端未就绪前使用）
 *
 * 生成近 N 天的每日学习时长、按类别分布、技能雷达数据。
 */
import type { EduBaseResponse } from '@/api/edu/index'
import type { DailyStat, CategoryStat, SkillRadarStat } from '@/api/edu/stats'

function delay<T>(data: T, ms = 200): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms))
}

function generateDailyStats(days: number): DailyStat[] {
  const stats: DailyStat[] = []
  const today = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().slice(0, 10)
    const minutes = Math.floor(Math.random() * 180) + 15
    stats.push({ date: dateStr, minutes })
  }
  return stats
}

const mockCategoryStats: CategoryStat[] = [
  { category: '前端开发', minutes: 2880, count: 12 },
  { category: '后端开发', minutes: 1920, count: 8 },
  { category: '数据库', minutes: 1440, count: 6 },
  { category: 'DevOps', minutes: 960, count: 4 },
  { category: '算法', minutes: 720, count: 3 },
]

const mockSkillRadar: SkillRadarStat[] = [
  { skill: '前端框架', score: 85 },
  { skill: 'TypeScript', score: 78 },
  { skill: '后端开发', score: 65 },
  { skill: '数据库设计', score: 70 },
  { skill: '系统架构', score: 60 },
  { skill: '工程化', score: 80 },
  { skill: '算法基础', score: 55 },
]

export const learnStatsApiMock = {
  daily: (params: { days: number }) => {
    const days = Math.min(Math.max(params.days, 7), 365)
    const data = generateDailyStats(days)
    return delay({ code: 0, data } as EduBaseResponse<DailyStat[]>)
  },

  byCategory: () =>
    delay({ code: 0, data: mockCategoryStats } as EduBaseResponse<CategoryStat[]>),

  skillRadar: () =>
    delay({ code: 0, data: mockSkillRadar } as EduBaseResponse<SkillRadarStat[]>),
}
