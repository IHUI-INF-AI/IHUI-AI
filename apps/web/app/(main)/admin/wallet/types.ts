// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

export type WalletStatus = 0 | 1 | 2

export interface Wallet {
  id: string
  userId: string
  userName: string | null
  balance: number
  frozenBalance: number
  totalRecharge: number
  totalConsume: number
  status: WalletStatus
  updatedAt: string
}

export interface WalletListData {
  list: Wallet[]
  total: number
}
