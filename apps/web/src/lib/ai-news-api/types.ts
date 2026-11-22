// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

export interface AiNewsArticle {
  id: string
  title: string
  summary: string
  coverImage: string
  authorName: string
  categoryName: string
  viewCount: number
  publishedAt: string
  isPinned: boolean
  source: 'api' | 'mock'
}

export interface AiLiveChannel {
  id: string
  title: string
  intro: string
  coverImage: string
  lecturerName: string
  categoryName: string
  isLive: boolean
  viewCount: number
  source: 'api' | 'mock'
}

export interface AiFundingItem {
  id: string
  title: string
  amount: string
  source: string
  date: string
  summary: string
  link?: string
}

export interface ComparisonRow {
  label: string
  values: Record<string, string>
}

export interface ComparisonModel {
  id: string
  name: string
  vendor: string
  highlight: string
}

export interface ComparisonTable {
  models: ComparisonModel[]
  rows: ComparisonRow[]
}

export interface AiFeedTimelineItem {
  id: string
  sourceCode: string
  title: string
  summary: string | null
  url: string | null
  coverUrl: string | null
  author: string | null
  currentRank: number | null
  currentHot: number | null
  publishTime: string | null
  lastSeenAt: string
  llmCategory: string | null
  trendTag: string | null
  trendGrowthPct: number | null
  titleEn: string | null
  titleJa: string | null
  titleKo: string | null
}

export interface TrendNotification {
  id: string
  title: string
  titleEn: string | null
  sourceCode: string
  trendGrowthPct: number
  currentHot: number
  lastSeenAt: string
  url: string | null
}

export interface TrendChartPoint {
  snapshotDate: string
  rank: number | null
  hotValue: number | null
}

/** 趋势图表 API 返回(对接 /api/ai-feed/trends) */
export interface TrendChartData {
  itemId: string
  title: string
  windowDays: number
  points: TrendChartPoint[]
  signals: Array<{
    windowDays: number
    trendTag: string
    growthPct: number | null
    rankDelta: number | null
  }>
}

export type LeaderboardCategory =
  'overall' | 'llm' | 'image' | 'video' | 'multimodal' | 'audio' | 'embedding' | 'agent'

/** 能力雷达图 5 维评分(0-100) */
export interface ModelCapabilities {
  coding: number
  math: number
  reasoning: number
  creative: number
  chinese: number
}

/** 排行榜条目(对应后端 model_leaderboard 表) */
export interface LeaderboardEntry {
  id: string
  modelId: string
  modelName: string
  vendor: string
  category: LeaderboardCategory
  subcategory: string | null
  arenaScore: number | null
  arenaRank: number | null
  rankDelta: number | null
  rankSpreadLow: number | null
  rankSpreadHigh: number | null
  scoreCi: number | null
  winRate: number | null
  voteCount: number | null
  contextWindow: string | null
  maxOutput: string | null
  inputPrice: string | null
  outputPrice: string | null
  releaseDate: string | null
  highlight: string | null
  capabilities: ModelCapabilities | null
  license: string
  isOverall: boolean
  sortOrder: number
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
