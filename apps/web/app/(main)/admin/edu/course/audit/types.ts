export interface Audit {
  id: string
  type: number
  operate: string
  sourceId: string
  targetId: string
  status: number
  creator?: string
  createdAt: string
  updator?: string
  remark?: string
}

export type Snapshot = Record<string, unknown>

export interface CourseAuditSearch {
  operate: string
  sourceId: string
  creator: string
}

export interface CompareData {
  before: Snapshot
  after: Snapshot
}
