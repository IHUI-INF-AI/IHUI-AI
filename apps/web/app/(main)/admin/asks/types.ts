export interface AskUser {
  nickname?: string | null
  avatar?: string | null
}

export interface AskCategory {
  id?: string
  name?: string | null
}

export interface AskItem {
  id: string
  title: string
  content: string
  userId?: string | null
  user?: AskUser | null
  userName?: string | null
  category?: AskCategory | null
  categoryName?: string | null
  tags?: string[] | null
  viewCount: number
  answerCount: number
  likeCount: number
  isResolved: boolean
  status: number
  createdAt: string
  updatedAt?: string
}

export interface AskForm {
  title: string
  content: string
  tags: string
  status: number
  isResolved: boolean
}

export interface AsksListData {
  list: AskItem[]
  total: number
  page: number
  pageSize: number
}
