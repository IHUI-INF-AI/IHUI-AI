import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { getBalance, getWithdrawRecords, type WalletRecord } from '@/lib/wallet-api'
import { createPersistConfig } from './persist-helpers'

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

export const useWalletStore = create<WalletState>()(
  persist(
    (set) => ({
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
        const withdrawRes = await getWithdrawRecords({ pageSize: 50 })
        if (withdrawRes.success) {
          set({ withdrawRecords: withdrawRes.data.list })
        }
      },
    }),
    createPersistConfig<WalletState>('ihui-wallet', (s) => ({
      balance: s.balance,
      transactions: s.transactions,
      withdrawRecords: s.withdrawRecords,
    })),
  ),
)
