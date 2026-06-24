import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  saveUserDataToStorage,
  getLoginResponseValue,
  extractNickname,
  extractEmail,
  extractPhone,
  extractUuid,
  extractIsVip,
  extractNeedPwd,
  buildUserFromLoginResponse,
  clearAuthStorage,
} from '../utils'

vi.mock('@/utils/request', () => ({
  getStoredData: vi.fn(() => ({})),
}))

vi.mock('@/utils/storage', () => ({
  StorageManager: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
  SecureStorageManager: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
  STORAGE_KEYS: {
    USER_TOKEN: 'user_token',
    TOKEN: 'token',
    REFRESH_TOKEN: 'refresh_token',
    USER_DATA: 'user_data',
    LOGIN_EXPIRY_TIME: 'login_expiry_time',
  },
}))

describe('auth utils', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('saveUserDataToStorage', () => {
    it('应该保存用户数据', () => {
      saveUserDataToStorage({ id: '1', nickname: 'test' } as any)
    })
  })

  describe('getLoginResponseValue', () => {
    it('应该返回存在的值', () => {
      const data = { token: 'abc', userId: '123' }
      expect(getLoginResponseValue(data, 'token')).toBe('abc')
    })

    it('应该在数据为空时返回undefined', () => {
      expect(getLoginResponseValue(undefined, 'token')).toBeUndefined()
    })

    it('应该在值不存在时返回undefined', () => {
      const data = { token: 'abc' }
      expect(getLoginResponseValue(data, 'userId' as any)).toBeUndefined()
    })

    it('应该支持多个key', () => {
      const data = { userId: '123' }
      expect(getLoginResponseValue(data, 'token' as any, 'userId' as any)).toBe('123')
    })
  })

  describe('extractNickname', () => {
    it('应该提取nickname', () => {
      expect(extractNickname({ nickname: 'test' })).toBe('test')
    })

    it('应该提取nick_name', () => {
      expect(extractNickname({ nick_name: 'test' })).toBe('test')
    })

    it('应该提取nickName', () => {
      expect(extractNickname({ nickName: 'test' })).toBe('test')
    })

    it('应该提取username', () => {
      expect(extractNickname({ username: 'test' })).toBe('test')
    })

    it('应该在找不到时返回空字符串', () => {
      expect(extractNickname({})).toBe('')
    })
  })

  describe('extractEmail', () => {
    it('应该提取email', () => {
      expect(extractEmail({ email: 'test@example.com' })).toBe('test@example.com')
    })

    it('应该从authInfo提取email', () => {
      expect(extractEmail({ authInfo: { email: 'auth@example.com' } })).toBe('auth@example.com')
    })

    it('应该在找不到时返回空字符串', () => {
      expect(extractEmail({})).toBe('')
    })
  })

  describe('extractPhone', () => {
    it('应该提取phone', () => {
      expect(extractPhone({ phone: '1234567890' })).toBe('1234567890')
    })

    it('应该从authInfo提取phone', () => {
      expect(extractPhone({ authInfo: { phone: '9876543210' } })).toBe('9876543210')
    })

    it('应该在找不到时返回空字符串', () => {
      expect(extractPhone({})).toBe('')
    })
  })

  describe('extractUuid', () => {
    it('应该提取uuid', () => {
      expect(extractUuid({ uuid: 'uuid-123' })).toBe('uuid-123')
    })

    it('应该提取id', () => {
      expect(extractUuid({ id: 'id-123' })).toBe('id-123')
    })

    it('应该提取userId', () => {
      expect(extractUuid({ userId: 'user-123' })).toBe('user-123')
    })

    it('应该提取user_id', () => {
      expect(extractUuid({ user_id: 'user-id-123' })).toBe('user-id-123')
    })

    it('应该在找不到时返回空字符串', () => {
      expect(extractUuid({})).toBe('')
    })
  })

  describe('extractIsVip', () => {
    it('应该处理boolean值', () => {
      expect(extractIsVip(true)).toBe(true)
      expect(extractIsVip(false)).toBe(false)
    })

    it('应该处理number值', () => {
      expect(extractIsVip(1)).toBe(true)
      expect(extractIsVip(0)).toBe(false)
      expect(extractIsVip(2)).toBe(true)
    })

    it('应该处理undefined', () => {
      expect(extractIsVip(undefined)).toBe(false)
    })
  })

  describe('extractNeedPwd', () => {
    it('应该返回number值', () => {
      expect(extractNeedPwd(1)).toBe(1)
    })

    it('应该转换非number值', () => {
      expect(extractNeedPwd('2')).toBe(2)
    })

    it('应该在null/undefined时返回0', () => {
      expect(extractNeedPwd(null)).toBe(0)
      expect(extractNeedPwd(undefined)).toBe(0)
    })
  })

  describe('buildUserFromLoginResponse', () => {
    it('应该构建用户对象', () => {
      const tokenData = {
        id: 'user-1',
        uuid: 'uuid-1',
        username: 'testuser',
        email: 'test@example.com',
        phone: '1234567890',
        nickname: 'Test User',
        avatar: 'avatar.jpg',
        isVip: true,
      }

      const result = buildUserFromLoginResponse(tokenData as any)

      expect(result.user.id).toBe('user-1')
      expect(result.user.uuid).toBe('uuid-1')
      expect(result.user.username).toBe('testuser')
      expect(result.user.email).toBe('test@example.com')
      expect(result.user.isVip).toBe(true)
    })

    it('应该处理空数据', () => {
      const result = buildUserFromLoginResponse({} as any)

      expect(result.user).toBeDefined()
      expect(result.fundInfo).toBeNull()
      expect(result.vipInfo).toBeNull()
    })

    it('应该处理vipLevelVO', () => {
      const tokenData = {
        vipLevelVO: {
          id: 'vip-1',
          title: 'Gold',
          level: 3,
        },
      }

      const result = buildUserFromLoginResponse(tokenData as any)

      expect(result.vipInfo).not.toBeNull()
      expect(result.vipInfo?.vipLevelName).toBe('Gold')
    })

    it('应该处理userMargin', () => {
      const tokenData = {
        userMargin: {
          id: 'margin-1',
          userUuid: 'user-1',
          tokenQuantity: 100,
        },
      }

      const result = buildUserFromLoginResponse(tokenData as any)

      expect(result.fundInfo).not.toBeNull()
      expect(result.fundInfo?.balance).toBe(100)
    })
  })

  describe('clearAuthStorage', () => {
    it('应该清除认证存储', () => {
      clearAuthStorage()
    })
  })
})
