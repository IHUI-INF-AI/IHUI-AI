import type { SkillMarketEntry } from '@ihui/shared/skills/market'

export interface SkillStats {
  totalSkills: number
  onlineCount: number
  totalInstallCount: number
  avgRating: number
}

export interface CategoryDistribution {
  category: string
  count: number
}

export interface SkillStatsData {
  stats: SkillStats
  topSkills: SkillMarketEntry[]
  successRate: { available: number; placeholder: number }
  categoryDist: CategoryDistribution[]
}