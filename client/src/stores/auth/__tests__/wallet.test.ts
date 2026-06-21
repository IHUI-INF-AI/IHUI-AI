import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useWalletStore } from '../wallet'

const mockStorage: Record<string, unknown> = {}

vi.mock('@/utils/storage', () => ({
  StorageManager: {
    getItem: vi.fn((key: string) => mockStorage[key] ?? null),
    setItem: vi.fn((key: string, val: any) => { mockStorage[key] = val }),
    removeItem: vi.fn((key: string) => { delete mockStorage[key] }),
  },
  SecureStorageManager: {
    setItem: vi.fn(() => true),
    getItem: vi.fn(() => null),
    removeItem: vi.fn(() => true),
    setEncryptedItem: vi.fn(),
    getEncryptedItem: vi.fn(() => null),
    removeEncryptedItem: vi.fn(),
  },
  STORAGE_KEYS: { USER_DATA: 'user_data' },
}))

const mockGetStoredData = vi.fn(() => mockStorage.user_data as Record<string, unknown> | null)
vi.mock('@/utils/request', () => ({
  getStoredData: () => mockGetStoredData(),
}))

describe('wallet store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    for (const k of Object.keys(mockStorage)) delete mockStorage[k]
    mockGetStoredData.mockClear()
    vi.clearAllMocks()
  })

  it('初始 fundInfo 为 null，余额为 0', () => {
    const store = useWalletStore()
    expect(store.fundInfo).toBeNull()
    expect(store.balance).toBe(0)
    expect(store.frozenAmount).toBe(0)
    expect(store.totalRecharge).toBe(0)
    expect(store.totalConsumption).toBe(0)
  })

  it('setFundInfo 写入状态并同步到存储', () => {
    mockStorage.user_data = { foo: 1 }
    mockGetStoredData.mockReturnValue(mockStorage.user_data)
    const store = useWalletStore()
    const info = { balance: 100, frozenAmount: 0, totalRecharge: 0, totalConsumption: 0 } as any
    store.setFundInfo(info)
    expect(store.fundInfo).toEqual(info)
    expect((mockStorage.user_data as any).fundInfo).toEqual(info)
  })

  it('setFundInfo 无 storedData 时不抛错', () => {
    mockGetStoredData.mockReturnValue(null)
    const store = useWalletStore()
    expect(() => store.setFundInfo({ balance: 1 } as any)).not.toThrow()
  })

  it('updateBalance 修改余额并同步存储', () => {
    mockStorage.user_data = {}
    mockGetStoredData.mockReturnValue(mockStorage.user_data)
    const store = useWalletStore()
    store.setFundInfo({ balance: 100 } as any)
    store.updateBalance(200)
    expect(store.balance).toBe(200)
  })

  it('updateBalance 无 fundInfo 时不生效', () => {
    const store = useWalletStore()
    store.updateBalance(99)
    expect(store.balance).toBe(0)
  })

  it('consumeBalance 成功扣减', () => {
    mockStorage.user_data = {}
    mockGetStoredData.mockReturnValue(mockStorage.user_data)
    const store = useWalletStore()
    store.setFundInfo({ balance: 100, totalConsumption: 0, totalRecharge: 0 } as any)
    expect(store.consumeBalance(30)).toBe(true)
    expect(store.balance).toBe(70)
    expect(store.totalConsumption).toBe(30)
  })

  it('consumeBalance 余额不足返回 false', () => {
    mockStorage.user_data = {}
    mockGetStoredData.mockReturnValue(mockStorage.user_data)
    const store = useWalletStore()
    store.setFundInfo({ balance: 10, totalConsumption: 0, totalRecharge: 0 } as any)
    expect(store.consumeBalance(50)).toBe(false)
    expect(store.balance).toBe(10)
  })

  it('rechargeBalance 增加余额', () => {
    mockStorage.user_data = {}
    mockGetStoredData.mockReturnValue(mockStorage.user_data)
    const store = useWalletStore()
    store.setFundInfo({ balance: 100, totalConsumption: 0, totalRecharge: 0 } as any)
    store.rechargeBalance(50)
    expect(store.balance).toBe(150)
    expect(store.totalRecharge).toBe(50)
  })

  it('rechargeBalance 无 fundInfo 时不生效', () => {
    const store = useWalletStore()
    expect(() => store.rechargeBalance(10)).not.toThrow()
  })

  it('restoreFundInfo 从存储恢复', () => {
    mockStorage.user_data = { fundInfo: { balance: 888 } }
    mockGetStoredData.mockReturnValue(mockStorage.user_data)
    const store = useWalletStore()
    store.restoreFundInfo()
    expect(store.balance).toBe(888)
  })

  it('restoreFundInfo 无存储数据不报错', () => {
    mockGetStoredData.mockReturnValue(null)
    const store = useWalletStore()
    expect(() => store.restoreFundInfo()).not.toThrow()
    expect(store.fundInfo).toBeNull()
  })

  it('clearFundInfo 清空', () => {
    mockStorage.user_data = {}
    mockGetStoredData.mockReturnValue(mockStorage.user_data)
    const store = useWalletStore()
    store.setFundInfo({ balance: 1 } as any)
    store.clearFundInfo()
    expect(store.fundInfo).toBeNull()
  })
})
