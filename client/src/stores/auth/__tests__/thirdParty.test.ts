import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { StorageManager } from '@/utils/storage'
import { useThirdPartyStore } from '../thirdParty'
import { useTokenStore } from '../token'
import { useUserStore } from '../user'
import { useWalletStore } from '../wallet'
import { useVipStore } from '../vip'

vi.mock('@/utils/storage', () => ({
  StorageManager: {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
  SecureStorageManager: {
    setItem: vi.fn(() => true),
    getItem: vi.fn(() => null),
    removeItem: vi.fn(() => true),
    setEncryptedItem: vi.fn(),
    getEncryptedItem: vi.fn(() => null),
    removeEncryptedItem: vi.fn(),
  },
  STORAGE_KEYS: {
    USER_TOKEN: 'user_token',
    USER_DATA: 'user_data',
  },
}))

vi.mock('@/locales', () => ({
  getI18nGlobal: () => ({ t: (k: string) => k }),
}))

vi.mock('@/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}))

describe('thirdParty store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('初始 isLoading=false', () => {
    const store = useThirdPartyStore()
    expect(store.isLoading).toBe(false)
  })

  it('thirdPartyLogin 成功填充所有 store', async () => {
    const tp = useThirdPartyStore()
    const token = useTokenStore()
    const user = useUserStore()
    const wallet = useWalletStore()
    const vip = useVipStore()

    const loginData = {
      token: 'tk-abc',
      refreshToken: 'rt-xyz',
      loginType: 'google',
      user: {
        uuid: 'u-1',
        username: 'alice',
        nickname: 'Ali',
        email: 'a@x.com',
        phone: '13800000000',
        avatar: 'avatar.png',
        gender: 1,
        isVip: 1,
        status: 1,
        inviteCode: 'INV1',
        authInfo: { userUuid: 'u-1', username: 'alice', email: 'a@x.com', phone: '13800000000' },
        vipLevelVO: { id: 'v1', title: '黄金', levelName: 'Gold', level: 2, userVip: { isValid: 1 } },
        userMargin: { id: 'm1', userUuid: 'u-1', tokenQuantity: '100.5' },
      },
    } as any

    const result = await tp.thirdPartyLogin(loginData)
    expect(result).toBe(true)
    expect(token.token).toBe('tk-abc')
    expect(user.user?.uuid).toBe('u-1')
    expect(user.user?.isVip).toBe(true)
    expect(wallet.fundInfo?.balance).toBe(100.5)
    expect(vip.vipInfo?.isActive).toBe(true)
    expect(tp.isLoading).toBe(false)
  })

  it('thirdPartyLogin 失败抛错并清 isLoading', async () => {
    const tp = useThirdPartyStore()
    const user = useUserStore()
    user.user = null
    expect(tp.isLoading).toBe(false)

    // 让 setToken 抛错
    const token = useTokenStore()
    vi.spyOn(token, 'setToken').mockImplementationOnce(() => { throw new Error('boom') })

    await expect(tp.thirdPartyLogin({ token: 'x', user: {} } as any)).rejects.toThrow('boom')
    expect(tp.isLoading).toBe(false)
  })

  it('user 字段缺失时使用 authInfo 兜底', async () => {
    const tp = useThirdPartyStore()
    const user = useUserStore()
    await tp.thirdPartyLogin({
      token: 'tk',
      loginType: 'wx',
      user: {
        authInfo: { userUuid: 'u-fb', username: 'fallback-name', email: 'fb@x.com' },
        uuid: 'u-direct',
      },
    } as any)
    expect(user.user?.uuid).toBe('u-direct')
    expect(user.user?.email).toBe('fb@x.com')
    expect(user.user?.nickname).toBe('fallback-name')
  })

  it('user 缺字段时使用默认值', async () => {
    const tp = useThirdPartyStore()
    const user = useUserStore()
    await tp.thirdPartyLogin({
      token: 'tk',
      loginType: 'github',
      user: { uuid: 'u-min' },
    } as any)
    expect(user.user?.uuid).toBe('u-min')
    expect(user.user?.status).toBe(1)
    expect(user.user?.gender).toBe(0)
    expect(user.user?.isVip).toBe(false)
  })

  it('identityType 优先 identityType，否则 identityTypy', async () => {
    const tp = useThirdPartyStore()
    const user = useUserStore()
    await tp.thirdPartyLogin({ token: 'tk', loginType: 'fb', user: { uuid: 'u', identityTypy: 7 } } as any)
    expect(user.user?.identityType).toBe(7)
    await tp.thirdPartyLogin({ token: 'tk', loginType: 'fb', user: { uuid: 'u', identityType: 3 } } as any)
    expect(user.user?.identityType).toBe(3)
  })

  it('userMargin.tokenQuantity 字符串转 number', async () => {
    const tp = useThirdPartyStore()
    const wallet = useWalletStore()
    await tp.thirdPartyLogin({ token: 'tk', loginType: 'a', user: { uuid: 'u', userMargin: { tokenQuantity: '50' } } } as any)
    expect(wallet.fundInfo?.balance).toBe(50)
  })

  it('userMargin.tokenQuantity 无效值兜底为 0', async () => {
    const tp = useThirdPartyStore()
    const wallet = useWalletStore()
    await tp.thirdPartyLogin({ token: 'tk', loginType: 'a', user: { uuid: 'u', userMargin: { tokenQuantity: 'abc' } } } as any)
    expect(wallet.fundInfo?.balance).toBe(0)
  })

  it('无 userMargin 不写入 wallet', async () => {
    const tp = useThirdPartyStore()
    const wallet = useWalletStore()
    await tp.thirdPartyLogin({ token: 'tk', loginType: 'a', user: { uuid: 'u' } } as any)
    expect(wallet.fundInfo).toBeNull()
  })

  it('vipLevelVO.userVip.isValid 1 激活，0 失活', async () => {
    const tp = useThirdPartyStore()
    const vip = useVipStore()
    await tp.thirdPartyLogin({ token: 'tk', loginType: 'a', user: { uuid: 'u', vipLevelVO: { id: 'v', title: 'T', level: 1, userVip: { isValid: 1 } } } } as any)
    expect(vip.vipInfo?.isActive).toBe(true)
    await tp.thirdPartyLogin({ token: 'tk', loginType: 'a', user: { uuid: 'u', vipLevelVO: { id: 'v', title: 'T', level: 1, userVip: { isValid: 0 } } } } as any)
    expect(vip.vipInfo?.isActive).toBe(false)
  })

  it('最终写入 StorageManager.setItem USER_DATA', async () => {
    const tp = useThirdPartyStore()
    await tp.thirdPartyLogin({ token: 'tk', loginType: 'a', user: { uuid: 'u-final' } } as any)
    expect(vi.mocked(StorageManager.setItem)).toHaveBeenCalled()
    const calls = vi.mocked(StorageManager.setItem).mock.calls
    const last = calls[calls.length - 1]
    expect(last[0]).toBe('user_data')
  })
})
