export interface MarkRecord {
  id: string
  paperId: string
  paperTitle?: string
  userId: string
  userName?: string
  score: string
  status: string
  submittedAt: string | null
}

export interface PageData<T> {
  list: T[]
  total: number
}

export interface Question {
  id: string
  type: string
  title: string
  score: string
}

export interface RecordDetail {
  record: {
    id: string
    paperId: string
    answers: Array<{ questionId: string; answer: unknown }>
  }
  questions: Question[]
}
