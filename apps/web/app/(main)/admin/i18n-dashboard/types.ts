export interface LangProgress {
  locale: string
  name: string
  total: number
  translated: number
  missing: number
  completion: number
}

export interface RecentUpdate {
  id: string
  locale: string
  key: string
  namespace: string
  updatedAt: string
  author?: string
}

export interface I18nOverview {
  languages: LangProgress[]
  totalMissing: number
  recentUpdates: RecentUpdate[]
}
