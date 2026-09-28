// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

export { type PageData } from '@ihui/api-client'

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
