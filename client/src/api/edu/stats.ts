/**
 * 学习统计 API（模块 F）
 *
 * 提供日常学习情况可视化所需数据：每日学习时长、按类别分布、技能雷达。
 */
import request from '@/utils/request'
import type { EduBaseResponse } from './index'
import { learnStatsApiMock } from '@/api/mock/stats-mock'

export interface DailyStat {
  date: string
  minutes: number
}

export interface CategoryStat {
  category: string
  minutes: number
  count: number
}

export interface SkillRadarStat {
  skill: string
  score: number
}

const USE_MOCK = import.meta.env.VITE_USE_EDU_MOCK !== 'false'

export const learnStatsApi = {
  daily: (params: { days: number }) =>
    USE_MOCK
      ? learnStatsApiMock.daily(params)
      : request.get<EduBaseResponse<DailyStat[]>>('/api/v1/edu/learn/stats/daily', { params }),

  byCategory: () =>
    USE_MOCK
      ? learnStatsApiMock.byCategory()
      : request.get<EduBaseResponse<CategoryStat[]>>('/api/v1/edu/learn/stats/category'),

  skillRadar: () =>
    USE_MOCK
      ? learnStatsApiMock.skillRadar()
      : request.get<EduBaseResponse<SkillRadarStat[]>>('/api/v1/edu/learn/stats/skill-radar'),
}
