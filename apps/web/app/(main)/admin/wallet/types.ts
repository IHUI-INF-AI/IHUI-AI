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
