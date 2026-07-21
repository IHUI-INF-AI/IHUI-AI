export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
}

export type ItemKind = 'news' | 'paper' | 'project' | 'tool' | 'app'

export interface AiCategory {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  sort: number
}

export interface AiWorldItem {
  id: string
  kind: ItemKind
  categoryId: string | null
  title: string
  summary: string | null
  url: string | null
  coverImage: string | null
  source: string
  sourceUrl: string | null
  publishedAt: string | null
  fetchedAt: string | null
  metadata: Record<string, unknown> | null
  viewCount: number
  likeCount: number
  trendingScore: number | null
  trendingMetrics: Record<string, unknown> | null
  trendingUpdatedAt: string | null
}

export interface PaginatedItems {
  items: AiWorldItem[]
  total: number
  limit: number
  offset: number
}

export interface AiWorldData {
  categories: AiCategory[]
  tools: AiWorldItem[]
  apps: AiWorldItem[]
  news: AiWorldItem[]
}

export interface AiWorldHotApp {
  id: string
  name: string
  href: string
}

export type LeaderboardId =
  | 'lmsys'
  | 'opencompass'
  | 'hf-open-llm'
  | 'superclue'
  | 'artificial-analysis'

export interface AiWorldRanking {
  id: string
  leaderboard: LeaderboardId
  category: string
  rank: number
  modelName: string
  provider: string | null
  score: string | null
  scores: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
  publishedAt: string | null
  fetchedAt: string | null
}

export interface PaginatedRankings {
  items: AiWorldRanking[]
  total: number
  limit: number
  offset: number
}

export interface LeaderboardInfo {
  leaderboard: LeaderboardId
  categories: string[]
}
