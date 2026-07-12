export interface SignupRow {
  id: string
  lessonId: string
  userId: string
  status: number
  createdAt: string
  lessonTitle?: string
  nickname?: string
  phone?: string
}

export interface SignupsData {
  list: SignupRow[]
  total: number
  page: number
  pageSize: number
}

export const STATUS_OPTIONS: { value: string; key: string }[] = [
  { value: '0', key: 'statusPending' },
  { value: '1', key: 'statusApproved' },
  { value: '2', key: 'statusRejected' },
  { value: '3', key: 'statusCompleted' },
]
