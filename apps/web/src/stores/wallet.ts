// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { getBalance, getWithdrawRecords, type WalletRecord } from '@ihui/api-client'
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

/**
 * fetchBalance 竞态防护(Y-73):并发两次调用(进页 + 支付回调 invalidateQueries 重拉)时,
 * 慢的第一次响应可能后于快的第二次落地,裸 `set({balance})` 会把新余额覆盖成旧值。
 * 用单调请求序号守卫:仅当"本轮请求仍是最新"时才落账,过期响应一律丢弃。
 * 模块级计数器跨所有调用实例共享(本 store 是单例,模块级与 store 实例级等价)。
 */
let walletFetchSeq = 0

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
        // 取号:本轮请求拿到单调递增的序号,后续每次 set 前比对是否仍最新
        const seq = ++walletFetchSeq
        const isStale = () => seq !== walletFetchSeq
        set({ loading: true, error: null })
        const res = await getBalance()
        if (isStale()) return // 已有更新的请求接手,丢弃本轮过期响应
        if (!res.success) {
          set({ loading: false, error: res.error })
          return
        }
        set({ balance: res.data.balance, loading: false })
        const withdrawRes = await getWithdrawRecords({ pageSize: 50 })
        if (isStale()) return // 两次 await 之间可能又有新请求,过期流水同样丢弃
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
