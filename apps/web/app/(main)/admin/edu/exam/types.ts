export interface Paper {
  id: string
  title: string
  description: string | null
  totalScore: string
  passScore: string
  duration: number
  isPublished: boolean
  isRandom: boolean
  questionCount: number
}

export interface PaperForm {
  title: string
  description: string
  totalScore: string
  passScore: string
  duration: string
  isPublished: boolean
  isRandom: boolean
}
