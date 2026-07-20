export type SensitiveWordStatus = 'draft' | 'pending' | 'published' | 'rejected'

export type SensitiveWordLevel = 'low' | 'medium' | 'high'

export interface SensitiveWord {
  id: string
  word: string
  category: string | null
  level: SensitiveWordLevel
  status: SensitiveWordStatus
}

export interface SensitiveWordListData {
  list: SensitiveWord[]
  total: number
}
