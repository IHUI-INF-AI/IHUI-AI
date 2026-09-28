// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

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
