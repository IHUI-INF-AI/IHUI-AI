import type { FeedbackItem, FeedbackStatus, Priority } from '@/lib/feedback'

export interface AdminFeedbackItem extends FeedbackItem {
  context?: string
  filePath?: string
  feedback?: string
  feedbackPath?: string
  creator?: string
  isDel?: number
}

export interface ListData {
  list: AdminFeedbackItem[]
  total: number
}

export interface SearchState {
  title: string
  creator: string
  createdAt: string
}

export interface EditForm {
  status: FeedbackStatus
  priority: Priority
  adminReply: string
}

export interface CreateForm {
  title: string
  context: string
  filePath: string
  isDel: string
  feedback: string
  feedbackPath: string
}
