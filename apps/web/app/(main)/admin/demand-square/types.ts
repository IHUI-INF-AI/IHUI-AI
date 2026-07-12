export interface Examine {
  id: string
  agentId: string
  userId: string | null
  status: string
  reason: string | null
  createdAt: string
  updatedAt: string
}

export interface ExamineData {
  list: Examine[]
  total: number
  page: number
  pageSize: number
}

export interface ExamineStats {
  total: number
  pending: number
  approved: number
  rejected: number
}
