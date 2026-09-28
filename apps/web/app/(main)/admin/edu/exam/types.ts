// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

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
  status: number
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
  status: boolean
  cidList: string[]
  questionIdList: string[]
  questionDisordered: boolean
  optionDisordered: boolean
  difficulty: number
  paperType: 'normal' | 'mock' | 'random'
}
