import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/lib/wallet-api', () => ({
  getBalance: vi.fn(),
  getWithdrawRecords: vi.fn(),
}))

import { useWalletStore } from '../wallet'
import { getBalance, getWithdrawRecords } from '@/lib/wallet-api'

describe('useWalletStore', () => {
  beforeEach(() => {
    useWalletStore.setState({
      balance: 0,
      transactions: [],
      withdrawRecords: [],
      loading: false,
      error: null,
    })
    vi.clearAllMocks()
  })

  it('初始状态balance为0,transactions为空', () => {
    const s = useWalletStore.getState()
    expect(s.balance).toBe(0)
    expect(s.transactions).toEqual([])
    expect(s.loading).toBe(false)
  })

  it('setBalance设置余额', () => {
    useWalletStore.getState().setBalance(100.5)
    expect(useWalletStore.getState().balance).toBe(100.5)
  })

  it('addTransaction添加到列表头部并更新余额', () => {
    const tx1 = { id: 't1', amount: 50, balanceAfter: 50, type: 'recharge' as const, status: 'done', payMethod: 'alipay', remark: null, createdAt: '2026-01-01' }
    const tx2 = { id: 't2', amount: -10, balanceAfter: 40, type: 'consume' as const, status: 'done', payMethod: null, remark: 'buy', createdAt: '2026-01-02' }
    useWalletStore.getState().addTransaction(tx1)
    useWalletStore.getState().addTransaction(tx2)
    const s = useWalletStore.getState()
    expect(s.transactions).toHaveLength(2)
    expect(s.transactions[0]?.id).toBe('t2')
    expect(s.transactions[1]?.id).toBe('t1')
    expect(s.balance).toBe(40)
  })

  it('setWithdrawRecords设置提现记录', () => {
    const records = [{ id: 'w1', amount: 20, balanceAfter: 80, type: 'withdraw' as const, status: 'pending', payMethod: 'bank', remark: null, createdAt: '2026-01-03' }]
    useWalletStore.getState().setWithdrawRecords(records)
    expect(useWalletStore.getState().withdrawRecords).toEqual(records)
  })

  it('fetchBalance成功时更新balance和withdrawRecords', async () => {
    vi.mocked(getBalance).mockResolvedValue({ success: true, data: { balance: 200, frozenBalance: 0, totalRecharge: 500, totalWithdraw: 300 } })
    vi.mocked(getWithdrawRecords).mockResolvedValue({
      success: true,
      data: { list: [{ id: 'w1', amount: 50, balanceAfter: 150, type: 'withdraw' as const, status: 'done', payMethod: 'bank', remark: null, createdAt: '2026-01-01' }], total: 1 },
    })

    await useWalletStore.getState().fetchBalance()
    const s = useWalletStore.getState()
    expect(s.balance).toBe(200)
    expect(s.loading).toBe(false)
    expect(s.error).toBeNull()
    expect(s.withdrawRecords).toHaveLength(1)
    expect(getWithdrawRecords).toHaveBeenCalledWith({ pageSize: 50 })
  })

  it('fetchBalance失败时设置error', async () => {
    vi.mocked(getBalance).mockResolvedValue({ success: false, error: '余额查询失败' })

    await useWalletStore.getState().fetchBalance()
    const s = useWalletStore.getState()
    expect(s.balance).toBe(0)
    expect(s.loading).toBe(false)
    expect(s.error).toBe('余额查询失败')
  })
})
