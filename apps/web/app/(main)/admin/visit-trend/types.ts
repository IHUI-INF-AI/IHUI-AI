export interface VisitTrendPoint {
  date: string
  pv: number
  uv: number
  newUv: number
  avgDuration: number
  bounceRate: number
}

export interface VisitSource {
  source: string
  pv: number
  uv: number
}

export interface VisitPage {
  path: string
  pv: number
  uv: number
  avgDuration: number
}

export type TrendGranularity = 'day' | 'week' | 'month'

export interface VisitTrendResponse {
  granularity: TrendGranularity
  range: { start: string; end: string }
  totalPv: number
  totalUv: number
  avgDuration: number
  bounceRate: number
  trend: VisitTrendPoint[]
  bySource: VisitSource[]
  topPages: VisitPage[]
}
