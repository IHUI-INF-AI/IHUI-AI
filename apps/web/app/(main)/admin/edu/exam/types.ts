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
  paperType?: 'normal' | 'mock' | 'random' | null
  cidList?: string[] | null
  questionIdList?: string[] | null
  questionDisordered?: boolean | null
  optionDisordered?: boolean | null
  difficulty?: number | null
}

export interface PaperForm {
  title: string
  description: string
  totalScore: string
  passScore: string
  duration: string
  isPublished: boolean
  isRandom: boolean
  cidList: string[]
  questionIdList: string[]
  questionDisordered: boolean
  optionDisordered: boolean
  difficulty: number
  paperType: 'normal' | 'mock' | 'random'
}
