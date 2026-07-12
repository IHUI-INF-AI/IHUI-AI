export interface Paper {
  id: string
  title: string
  isPublished: boolean
}

export interface Question {
  id: string
  paperId: string
  type: string
  title: string
  options: unknown
  score: string
  sortOrder: number
  answer?: unknown
  analysis?: string
}

export interface QForm {
  title: string
  score: string
  sortOrder: string
  options: string
  answer: string
  analysis: string
}
