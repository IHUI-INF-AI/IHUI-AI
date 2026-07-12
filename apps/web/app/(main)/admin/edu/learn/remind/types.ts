export interface Remind {
  id: string
  userId: string
  userName: string | null
  title: string
  content: string | null
  remindAt: string
  type: string
  isRead: boolean
}

export interface RForm {
  title: string
  userId: string
  content: string
  remindAt: string
  type: string
  isRead: boolean
}
