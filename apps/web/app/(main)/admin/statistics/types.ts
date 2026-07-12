export interface OverviewStatistics {
  memberTotal: number
  lessonTotal: number
  examTotal: number
  signupTotal: number
  examRecordTotal: number
  postTotal: number
  announcementTotal: number
  articleTotal: number
}

export interface LearnStatistics {
  lessonTotal: number
  lessonPublished: number
  signupTotal: number
  viewSum: number
}

export interface ExamStatistics {
  examTotal: number
  examPublished: number
  recordTotal: number
  passTotal: number
  passRate: number
}

export interface ContentStatistics {
  memberTotal: number
  postTotal: number
  announcementTotal: number
  articleTotal: number
}

export interface Snapshot {
  id: string
  type: string
  data: Record<string, unknown>
  createdAt: string
}

export type SnapshotType = 'overview' | 'learn' | 'exam' | 'content'

export interface SnapshotListData {
  list: Snapshot[]
  total: number
}
