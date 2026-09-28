// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

export type HelpCategory = 'account' | 'payment' | 'project' | 'ai' | 'tech'

export interface HelpArticle {
  id: string
  title: string
  slug: string
  category: HelpCategory
  content: string
  isPublished: boolean
  viewCount?: number
  updatedAt?: string
}

export interface HelpForm {
  title: string
  slug: string
  category: HelpCategory
  content: string
  isPublished: boolean
}
