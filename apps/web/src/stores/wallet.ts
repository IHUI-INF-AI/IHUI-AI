import { create } from 'zustand'

import { getBalance, getWithdrawRecords, type WalletRecord } from '@/lib/wallet-api'

interface WalletState {
  balance: number
  transactions: WalletRecord[]
  withdrawRecords: WalletRecord[]
  loading: boolean
  error: string | null
  setBalance: (balance: number) => void
  addTransaction: (tx: WalletRecord) => void
  setWithdrawRecords: (records: WalletRecord[]) => void
  fetchBalance: () => Promise<void>
}

export const useWalletStore = create<WalletState>((set) => ({
  balance: 0,
  transactions: [],
  withdrawRecords: [],
  loading: false,
  error: null,

  setBalance: (balance) => set({ balance }),

  addTransaction: (tx) =>
    set((s) => ({ transactions: [tx, ...s.transactions], balance: tx.balanceAfter })),

  setWithdrawRecords: (withdrawRecords) => set({ withdrawRecords }),

  fetchBalance: async () => {
    set({ loading: true, error: null })
    const res = await getBalance()
    if (!res.success) {
      set({ loading: false, error: res.error })
      return
    }
    set({ balance: res.data.balance, loading: false })
    // 顺便拉取提现记录
    const withdrawRes = await getWithdrawRecords({ pageSize: 50 })
    if (withdrawRes.success) {
      set({ withdrawRecords: withdrawRes.data.list })
    }
  },
}))
