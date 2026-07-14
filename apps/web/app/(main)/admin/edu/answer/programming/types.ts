export interface Paper {
  id: string
  title: string
  isPublished: boolean
}

export interface Question {
  id: string
  type: string
  title: string
  options: unknown
  score: string
}
