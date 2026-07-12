export interface Video {
  id: string
  courseId?: string
  binding?: string
  videoPath?: string
  title?: string
  subtitle?: string
  content?: string
  remark?: string
  lecturer?: string
  duration?: string
  adjunctUrl?: string
  isPay?: number
  amount?: string
  label?: string
  agentIds?: string
  hot?: number
  collect?: number
  status?: number
  auditStatus?: number
  sort?: number
  creator?: string
  nickname?: string
}

export interface CForm {
  courseId: string
  videoPath: string
  title: string
  subtitle: string
  lecturer: string
  duration: string
  adjunctUrl: string
  amount: string
  label: string
  agentIds: string
  hot: string
  collect: string
  sort: string
  creator: string
  binding: string
  content: string
  remark: string
  isPay: string
  status: string
  auditStatus: string
}

export interface RecordedSearch {
  title: string
  label: string
  creator: string
}
