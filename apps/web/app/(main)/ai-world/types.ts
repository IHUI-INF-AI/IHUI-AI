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
