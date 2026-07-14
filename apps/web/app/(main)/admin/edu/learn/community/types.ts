export interface Topic {
  id: string
  userId: string
  userName: string | null
  lessonId: string | null
  lessonTitle: string | null
  title: string
  content: string | null
  replyCount: number
  viewCount: number
  isPinned: boolean
  createdAt: string
  status: string
}

export interface TForm {
  title: string
  content: string
  lessonId: string
  status: string
  isPinned: boolean
}
