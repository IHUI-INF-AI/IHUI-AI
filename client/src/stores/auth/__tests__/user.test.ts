import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useUserStore } from '../user'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('@/api/user/user', () => ({
  getUserInfo: vi.fn().mockResolvedValue({
    code: 200,
    data: {
      uuid: 'test-uuid',
      username: 'testuser',
      email: 'test@example.com',
      phone: '13812345678',
      nickname: '测试用户',
      avatar: '/avatar.png',
      status: 1,
      isVip: false,
    },
  }),
}))

vi.mock('@/utils/request', () => ({
  getStoredData: vi.fn(() => ({})),
}))

vi.mock('@/utils/storage', () => ({
  StorageManager: {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
  STORAGE_KEYS: {
    USER_DATA: 'user_data',
  },
}))

vi.mock('@/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}))

vi.mock('@/locales', () => ({
  getI18nGlobal: vi.fn(() => ({
    t: vi.fn((key: string) => key),
  })),
}))

vi.mock('../utils', () => ({
  extractNickname: vi.fn((data: any) => data?.nickname || ''),
  extractEmail: vi.fn((data: any) => data?.email || ''),
  extractPhone: vi.fn((data: any) => data?.phone || ''),
  extractUuid: vi.fn((data: any) => data?.uuid || ''),
  extractIsVip: vi.fn((value: any) => !!value),
  extractNeedPwd: vi.fn(() => 0),
  saveUserDataToStorage: vi.fn(),
}))

vi.mock('../token', () => ({
  useTokenStore: vi.fn(() => ({
    token: 'test-token',
  })),
}))

describe('useUserStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
  })

  it('应该初始化默认状态', () => {
    const store = useUserStore()
    expect(store.user).toBeNull()
    expect(store.authInfo).toBeNull()
    expect(store.isLoading).toBe(false)
    expect(store.isDemoMode).toBeDefined()
    expect(store.isFetchingUserInfo).toBe(false)
  })

  it('应该返回计算属性', () => {
    const store = useUserStore()
    expect(store.isVip).toBe(false)
    expect(store.userUuid).toBe('')
    expect(store.nickname).toBe('')
    expect(store.avatar).toBe('')
    expect(store.userStatus).toBe(0)
    expect(store.inviteCode).toBe('')
  })

  it('setUser应该更新用户数据', () => {
    const store = useUserStore()
    store.user = { uuid: 'test', nickname: 'test' } as any
    store.setUser({ nickname: 'new nickname' })
    expect(store.user?.nickname).toBe('new nickname')
  })

  it('updateUserInfo应该更新用户信息', () => {
    const store = useUserStore()
    store.user = { uuid: 'test', nickname: 'test' } as any
    store.updateUserInfo({ nickname: 'updated nickname' })
    expect(store.user?.nickname).toBe('updated nickname')
  })

  it('setAuthInfo应该设置认证信息', () => {
    const store = useUserStore()
    store.setAuthInfo({ uuid: 'auth-uuid' } as any)
    expect(store.authInfo?.uuid).toBe('auth-uuid')
  })

  it('clearUser应该清除用户数据', () => {
    const store = useUserStore()
    store.user = { uuid: 'test' } as any
    store.authInfo = { uuid: 'test' } as any
    store.clearUser()
    expect(store.user).toBeNull()
    expect(store.authInfo).toBeNull()
  })

  it('restoreUserFromStorage应该返回false当没有存储数据时', () => {
    const store = useUserStore()
    const result = store.restoreUserFromStorage()
    expect(result).toBe(false)
  })

  it('fetchUserInfo应该获取用户信息', async () => {
    const store = useUserStore()
    await store.fetchUserInfo()
    expect(store.user).not.toBeNull()
    expect(store.user?.uuid).toBe('test-uuid')
  })
})
