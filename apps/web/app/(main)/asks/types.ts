export interface AskItem {
  id: string
  title: string
  tags?: string[]
  answerCount: number
  viewCount: number
  isResolved: boolean
  createdAt: string
}

export interface AsksData {
  list: AskItem[]
  total: number
  page: number
  pageSize: number
}

export type Filter = 'all' | 'unresolved' | 'resolved'
