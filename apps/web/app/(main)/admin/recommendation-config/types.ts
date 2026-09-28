// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

export interface RecommendSlot {
  id: string
  position: string
  name: string
  contentType: 'agent' | 'article' | 'course' | 'activity' | 'live'
  sort: number
  isEnabled: boolean
}

export interface RecommendForm {
  position: string
  name: string
  contentType: RecommendSlot['contentType']
  sort: number
}
