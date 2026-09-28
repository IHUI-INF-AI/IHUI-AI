// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

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

export interface TrendDataPoint {
  label: string
  count: number
}

export type TrendRange = 'week' | 'month' | 'quarter'
