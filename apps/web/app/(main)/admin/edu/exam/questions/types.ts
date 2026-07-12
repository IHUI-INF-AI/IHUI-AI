export type QType =
  'single_choice' | 'multi_choice' | 'judgment' | 'fill_blank' | 'subjective' | 'programming'

export interface Paper {
  id: string
  title: string
  isPublished: boolean
}

export interface Question {
  id: string
  paperId: string
  type: QType
  title: string
  options: unknown
  score: string
  sortOrder: number
  answer?: unknown
  analysis?: string
}

export interface QForm {
  type: QType
  title: string
  score: string
  sortOrder: string
  options: string
  answer: string
  analysis: string
}
