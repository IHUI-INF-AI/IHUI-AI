export type AnomalyRecommendation = 'block' | 'monitor' | 'allow'

export interface AnomalyDimension {
  name: string
  score: number
  weight: number
}

export interface AnomalyEvent {
  timestamp: number
  ip: string
  userId: string | null
  url: string
  score: number
  recommendation: AnomalyRecommendation
  dimensions: AnomalyDimension[]
}

export interface AnomalyListData {
  total: number
  list: AnomalyEvent[]
}

export interface AnomalyQuery {
  limit?: number
  offset?: number
  minScore?: number
  ip?: string
}
