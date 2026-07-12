export type HelpCategory = 'account' | 'payment' | 'project' | 'ai' | 'tech'

export interface HelpArticle {
  id: string
  title: string
  slug: string
  category: HelpCategory
  content: string
  isPublished: boolean
  viewCount?: number
  updatedAt?: string
}

export interface HelpForm {
  title: string
  slug: string
  category: HelpCategory
  content: string
  isPublished: boolean
}
