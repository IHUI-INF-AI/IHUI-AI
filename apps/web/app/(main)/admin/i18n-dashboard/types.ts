// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

export interface LangProgress {
  locale: string
  name: string
  total: number
  translated: number
  missing: number
  completion: number
}

export interface RecentUpdate {
  id: string
  locale: string
  key: string
  namespace: string
  updatedAt: string
  author?: string
}

export interface I18nOverview {
  languages: LangProgress[]
  totalMissing: number
  recentUpdates: RecentUpdate[]
}
