export interface Level {
  id: string
  name: string
  level: number
  minScore: number
  maxScore: number
  discount: number
  sort: number
}

export interface LForm {
  name: string
  level: string
  minScore: string
  maxScore: string
  discount: string
}
