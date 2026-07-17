export interface NotificationLog {
  id: string
  user_id: string
  type?: string
  title?: string
  content?: string
  channel?: string
  status?: string
  error_message?: string
  created_at: string
}

export interface ListData {
  list: NotificationLog[]
  total: number
}

export interface NotificationLogSearch {
  channel: string
  status: string
  startDate: string
  endDate: string
  userId: string
}
