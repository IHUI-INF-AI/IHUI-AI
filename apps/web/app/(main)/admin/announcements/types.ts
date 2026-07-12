export type AnnType = 'info' | 'warning' | 'maintenance' | 'update'

export interface Announcement {
  id: string
  title: string
  content: string
  type: AnnType
  isPinned: boolean
  isPublished: boolean
  publishedAt?: string
  updatedAt?: string
}

export interface AnnouncementForm {
  title: string
  content: string
  type: AnnType
  isPinned: boolean
  isPublished: boolean
}
