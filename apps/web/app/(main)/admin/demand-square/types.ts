// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

export interface Examine {
  id: string
  agentId: string
  userId: string | null
  status: string
  reason: string | null
  createdAt: string
  updatedAt: string
}

export interface ExamineData {
  list: Examine[]
  total: number
  page: number
  pageSize: number
}

export interface ExamineStats {
  total: number
  pending: number
  approved: number
  rejected: number
}
