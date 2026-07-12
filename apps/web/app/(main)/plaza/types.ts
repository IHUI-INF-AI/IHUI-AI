export interface CircleItem {
  id: string
  name: string
  description?: string
  memberCount: number
  postCount: number
}

export interface CirclesData {
  list: CircleItem[]
  total: number
}

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
}

export type Tab = 'circles' | 'asks'
