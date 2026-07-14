export interface Paper {
  id: string
  title: string
  duration: number
  isPublished: boolean
  totalScore: string
}

export interface Question {
  id: string
  type: string
  title: string
  options: unknown
  score: string
  sortOrder: number
}
