export type QType = 'single' | 'multiple' | 'judge' | 'fill' | 'subjective'

export interface Option {
  key: string
  text: string
}

export interface Question {
  id: string
  type: QType
  title: string
  options?: Option[]
  score: number
}

export interface PaperDetail {
  id: string
  title: string
  duration: number
  totalScore: number
  passScore: number
  questions: Question[]
}

export interface SubmitResult {
  score: number
  passed: boolean
  results: { questionId: string; correct: boolean; score: number }[]
}
