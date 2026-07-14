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
