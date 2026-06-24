import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { StorageManager } from '@/utils/storage'
import { isLoginExpired, isExpiryTimePassed } from '@/utils/login-duration'
import { usePermissionsStore } from '../permissions'
import { useUserStore } from '../user'
import { useTokenStore } from '../token'
import { useWalletStore } from '../wallet'
import { useVipStore } from '../vip'

vi.mock('@/utils/storage', () => ({
  StorageManager: {
    getItem: vi.fn((key: string) => {
      if (key === 'login_expiry_time') return Date.now() + 7 * 24 * 60 * 60 * 1000
      if (key === 'login_duration') return 7 * 24 * 60 * 60 * 1000
      return null
    }),
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
    LOGIN_EXPIRY_TIME: 'login_expiry_time',
    LOGIN_DURATION: 'login_duration',
  },
}))

vi.mock('@/utils/login-duration', () => ({
  isLoginExpired: vi.fn(() => false),
  isExpiryTimePassed: vi.fn(() => false),
  calculateExpiryTime: () => Date.now() + 7 * 24 * 60 * 60 * 1000,
  DEFAULT_LOGIN_DURATION: 7 * 24 * 60 * 60 * 1000,
  LOGIN_DURATION_OPTIONS: {},
}))

describe('permissions store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(StorageManager.getItem).mockImplementation((key: string) => {
      if (key === 'login_expiry_time') return Date.now() + 7 * 24 * 60 * 60 * 1000
      if (key === 'login_duration') return 7 * 24 * 60 * 60 * 1000
      return null
    })
  })

  it('isLoggedIn 初始为 false（无 token 无 user）', () => {
    const store = usePermissionsStore()
    expect(store.isLoggedIn).toBe(false)
  })

  it('有 token 和 user 但 token 过期则 isLoggedIn=false', () => {
    const user = useUserStore()
    const token = useTokenStore()
    vi.mocked(isExpiryTimePassed).mockReturnValueOnce(true)
    user.user = { uuid: 'u1', status: 1, isVip: false } as any
    token.token = 'tk'
    vi.mocked(StorageManager.getItem).mockImplementation((key: string) => {
      if (key === 'login_expiry_time') return Date.now() - 1000
      if (key === 'login_duration') return 7 * 24 * 60 * 60 * 1000
      return null
    })
    const perms = usePermissionsStore()
    expect(perms.isLoggedIn).toBe(false)
  })

  it('有 token + user + 未过期则 isLoggedIn=true', () => {
    const user = useUserStore()
    const token = useTokenStore()
    user.user = { uuid: 'u1', status: 1, isVip: false } as any
    token.token = 'tk'
    vi.mocked(StorageManager.getItem).mockImplementation((key: string) => {
      if (key === 'login_expiry_time') return Date.now() + 100000
      if (key === 'login_duration') return 7 * 24 * 60 * 60 * 1000
      return null
    })
    const perms = usePermissionsStore()
    expect(perms.isLoggedIn).toBe(true)
  })

  it('hasPermission 无用户返回 false', () => {
    const perms = usePermissionsStore()
    expect(perms.checkPermission('chat')).toBe(false)
  })

  it('hasPermission 用户被禁用返回 false', () => {
    const user = useUserStore()
    user.user = { uuid: 'u1', status: 0, isVip: false } as any
    const perms = usePermissionsStore()
    expect(perms.checkPermission('chat')).toBe(false)
  })

  it('hasPermission vip 检查：非 vip 拒绝', () => {
    const user = useUserStore()
    user.user = { uuid: 'u1', status: 1, isVip: false } as any
    const perms = usePermissionsStore()
    expect(perms.checkPermission('vip')).toBe(false)
  })

  it('hasPermission vip 检查：vip 通过', () => {
    const user = useUserStore()
    user.user = { uuid: 'u1', status: 1, isVip: true } as any
    const perms = usePermissionsStore()
    expect(perms.checkPermission('vip')).toBe(true)
  })

  it('hasPermission 普通权限通过', () => {
    const user = useUserStore()
    user.user = { uuid: 'u1', status: 1, isVip: false } as any
    const perms = usePermissionsStore()
    expect(perms.checkPermission('chat')).toBe(true)
  })

  it('hasRole admin 需用户角色包含 admin', () => {
    const user = useUserStore()
    user.user = { uuid: 'u1', status: 1, isVip: false, roles: ['admin'] } as any
    const perms = usePermissionsStore()
    expect(perms.hasRole('admin')).toBe(true)
  })

  it('hasRole admin 无角色返回 false', () => {
    const user = useUserStore()
    user.user = { uuid: 'u1', status: 1, isVip: false } as any
    const perms = usePermissionsStore()
    expect(perms.hasRole('admin')).toBe(false)
  })

  it('hasRole admin 特殊 uuid/username', () => {
    const user = useUserStore()
    user.user = { uuid: 'admin', status: 1, isVip: false } as any
    const perms = usePermissionsStore()
    expect(perms.hasRole('admin')).toBe(true)
  })

  it('hasRole vip 需 vip + vip 激活', () => {
    const user = useUserStore()
    const vip = useVipStore()
    user.user = { uuid: 'u1', status: 1, isVip: true } as any
    vip.setVipInfo({ isActive: true } as any)
    const perms = usePermissionsStore()
    expect(perms.hasRole('vip')).toBe(true)
    vip.setVipInfo({ isActive: false } as any)
    expect(perms.hasRole('vip')).toBe(false)
  })

  it('hasRole user 需 status=1', () => {
    const user = useUserStore()
    user.user = { uuid: 'u1', status: 1, isVip: false } as any
    const perms = usePermissionsStore()
    expect(perms.hasRole('user')).toBe(true)
    user.user = { uuid: 'u1', status: 0, isVip: false } as any
    expect(perms.hasRole('user')).toBe(false)
  })

  it('hasRole 未知角色返回 false', () => {
    const user = useUserStore()
    user.user = { uuid: 'u1', status: 1, isVip: false } as any
    const perms = usePermissionsStore()
    expect(perms.hasRole('unknown_role')).toBe(false)
  })

  it('canUseFeature 未登录返回 false', () => {
    const perms = usePermissionsStore()
    expect(perms.canUseFeature('chat')).toBe(false)
  })

  it('canUseFeature chat 需 status=1', () => {
    const user = useUserStore()
    const token = useTokenStore()
    user.user = { uuid: 'u1', status: 1, isVip: false } as any
    token.token = 'tk'
    const perms = usePermissionsStore()
    expect(perms.canUseFeature('chat')).toBe(true)
    user.user = { uuid: 'u1', status: 0, isVip: false } as any
    expect(perms.canUseFeature('chat')).toBe(false)
  })

  it('canUseFeature agent_create 需 vip 或余额 > 0', () => {
    const user = useUserStore()
    const token = useTokenStore()
    const wallet = useWalletStore()
    user.user = { uuid: 'u1', status: 1, isVip: false } as any
    token.token = 'tk'
    const perms = usePermissionsStore()
    expect(perms.canUseFeature('agent_create')).toBe(false)
    wallet.fundInfo = { balance: 10 } as any
    expect(perms.canUseFeature('agent_create')).toBe(true)
    wallet.fundInfo = null
    user.user = { uuid: 'u1', status: 1, isVip: true } as any
    expect(perms.canUseFeature('agent_create')).toBe(true)
  })

  it('canUseFeature premium_features 需 vip + 激活', () => {
    const user = useUserStore()
    const token = useTokenStore()
    const vip = useVipStore()
    user.user = { uuid: 'u1', status: 1, isVip: true } as any
    token.token = 'tk'
    vip.setVipInfo({ isActive: true } as any)
    const perms = usePermissionsStore()
    expect(perms.canUseFeature('premium_features')).toBe(true)
    vip.setVipInfo({ isActive: false } as any)
    expect(perms.canUseFeature('premium_features')).toBe(false)
  })

  it('canUseFeature developer_tools 普通用户不行', () => {
    const user = useUserStore()
    const token = useTokenStore()
    user.user = { uuid: 'u1', status: 1, isVip: false } as any
    token.token = 'tk'
    const perms = usePermissionsStore()
    expect(perms.canUseFeature('developer_tools')).toBe(false)
    user.user = { uuid: 'u1', status: 1, isVip: true } as any
    expect(perms.canUseFeature('developer_tools')).toBe(true)
  })

  it('canUseFeature advanced_analytics 需 vip 激活', () => {
    const user = useUserStore()
    const token = useTokenStore()
    const vip = useVipStore()
    user.user = { uuid: 'u1', status: 1, isVip: true } as any
    token.token = 'tk'
    vip.setVipInfo({ isActive: true } as any)
    const perms = usePermissionsStore()
    expect(perms.canUseFeature('advanced_analytics')).toBe(true)
  })

  it('canUseFeature 未知特性默认 true', () => {
    const user = useUserStore()
    const token = useTokenStore()
    user.user = { uuid: 'u1', status: 1, isVip: false } as any
    token.token = 'tk'
    const perms = usePermissionsStore()
    expect(perms.canUseFeature('custom_feature')).toBe(true)
  })

  it('checkPermission / checkFeatureAccess 是 has/can 的代理', () => {
    const user = useUserStore()
    user.user = { uuid: 'u1', status: 1, isVip: false } as any
    const perms = usePermissionsStore()
    expect(perms.checkPermission('chat')).toBe(perms.hasPermission('chat'))
    expect(perms.checkFeatureAccess('custom_feature')).toBe(perms.canUseFeature('custom_feature'))
  })
})
