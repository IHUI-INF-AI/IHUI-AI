// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

export interface Withdrawal {
  id: string
  amount: number
  account: string
  accountType?: string
  status: string
  userNickname?: string
  userId?: string
  createdAt: string
  processedAt?: string | null
}

export interface ListData {
  items?: Withdrawal[]
  list?: Withdrawal[]
  total?: number
}
