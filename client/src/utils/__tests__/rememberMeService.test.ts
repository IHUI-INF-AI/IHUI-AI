// rememberMeService.ts 单元测试
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock('@/config/auth.config', () => ({
  REMEMBER_ME_CONFIG: {
    REFRESH_TOKEN_KEY: 'test-refresh-token',
    USER_PREFERENCE_KEY: 'test-user-pref',
    CREDENTIALS_KEY: 'test-credentials',
    AUTO_LOGIN_KEY: 'test-auto-login',
    MAX_CREDENTIALS_AGE_MS: 7 * 24 * 60 * 60 * 1000,
    MAX_FAILURE_COUNT: 3,
    LOCK_DURATION_MS: 30 * 60 * 1000,
  },
}))

import { RememberMeService } from '../rememberMeService'

describe('RememberMeService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('isRememberMeEnabled 默认', () => {
    expect(RememberMeService.isRememberMeEnabled()).toBe(false)
  })

  it('setRememberMePreference 启用', () => {
    RememberMeService.setRememberMePreference(true)
    expect(RememberMeService.isRememberMeEnabled()).toBe(true)
  })

  it('setRememberMePreference 禁用', () => {
    RememberMeService.setRememberMePreference(false)
    expect(RememberMeService.isRememberMeEnabled()).toBe(false)
  })

  it('saveRefreshToken / getRefreshToken / hasRefreshToken', () => {
    RememberMeService.setRememberMePreference(true)
    RememberMeService.saveRefreshToken('token1')
    expect(RememberMeService.getRefreshToken()).toBe('token1')
    expect(RememberMeService.hasRefreshToken()).toBe(true)
  })

  it('saveRefreshToken 未启用', () => {
    RememberMeService.saveRefreshToken('token1')
    expect(RememberMeService.getRefreshToken()).toBeNull()
  })

  it('saveRefreshToken 空 token', () => {
    RememberMeService.setRememberMePreference(true)
    RememberMeService.saveRefreshToken('')
    expect(RememberMeService.getRefreshToken()).toBeNull()
  })

  it('updateRefreshToken', () => {
    RememberMeService.setRememberMePreference(true)
    RememberMeService.updateRefreshToken('token2')
    expect(RememberMeService.getRefreshToken()).toBe('token2')
  })

  it('clearRefreshToken', () => {
    RememberMeService.setRememberMePreference(true)
    RememberMeService.saveRefreshToken('token1')
    RememberMeService.clearRefreshToken()
    expect(RememberMeService.getRefreshToken()).toBeNull()
  })

  it('hasRefreshToken false', () => {
    expect(RememberMeService.hasRefreshToken()).toBe(false)
  })

  it('clearAll', () => {
    RememberMeService.setRememberMePreference(true)
    RememberMeService.saveRefreshToken('token1')
    RememberMeService.savePhoneCredentials('13800000000')
    RememberMeService.clearAll()
    expect(RememberMeService.getRefreshToken()).toBeNull()
  })

  it('savePhoneCredentials 完整', () => {
    RememberMeService.savePhoneCredentials('13800000000', '+86', 'rt')
    const cred = RememberMeService.getCredentials()
    expect(cred?.phone).toBe('13800000000')
    expect(cred?.countryCode).toBe('+86')
    expect(cred?.refreshToken).toBe('rt')
    expect(cred?.type).toBe('phone')
  })

  it('savePhoneCredentials 默认 countryCode', () => {
    RememberMeService.savePhoneCredentials('13800000000')
    const cred = RememberMeService.getCredentials()
    expect(cred?.countryCode).toBe('+86')
  })

  it('savePhoneCredentials 空 phone', () => {
    RememberMeService.savePhoneCredentials('')
    expect(RememberMeService.getCredentials()).toBeNull()
  })

  it('saveAccountCredentials', () => {
    RememberMeService.saveAccountCredentials('user1', 'rt1')
    const cred = RememberMeService.getCredentials()
    expect(cred?.username).toBe('user1')
    expect(cred?.type).toBe('account')
  })

  it('saveAccountCredentials 空 username', () => {
    RememberMeService.saveAccountCredentials('')
    expect(RememberMeService.getCredentials()).toBeNull()
  })

  it('getCredentials 无数据', () => {
    expect(RememberMeService.getCredentials()).toBeNull()
  })

  it('getCredentials 过期', () => {
    const old = { phone: '138', timestamp: Date.now() - 8 * 24 * 60 * 60 * 1000 }
    localStorage.setItem('test-credentials', JSON.stringify(old))
    expect(RememberMeService.getCredentials()).toBeNull()
  })

  it('getCredentials 解析失败', () => {
    localStorage.setItem('test-credentials', 'invalid-json')
    expect(RememberMeService.getCredentials()).toBeNull()
  })

  it('clearCredentials', () => {
    RememberMeService.savePhoneCredentials('138')
    RememberMeService.clearCredentials()
    expect(RememberMeService.getCredentials()).toBeNull()
  })

  it('migrateOldCredentials phone', () => {
    localStorage.setItem('remember_me_phone', JSON.stringify({ phone: '138', timestamp: Date.now() }))
    RememberMeService.migrateOldCredentials()
    const cred = RememberMeService.getCredentials()
    expect(cred?.phone).toBe('138')
  })

  it('migrateOldCredentials user', () => {
    localStorage.setItem('remember_me_user', JSON.stringify({ username: 'u1', timestamp: Date.now() }))
    RememberMeService.migrateOldCredentials()
    const cred = RememberMeService.getCredentials()
    expect(cred?.username).toBe('u1')
  })

  it('migrateOldCredentials 解析失败', () => {
    localStorage.setItem('remember_me_phone', 'invalid')
    RememberMeService.migrateOldCredentials()
  })

  it('migrateOldCredentials 空数据', () => {
    localStorage.setItem('remember_me_phone', JSON.stringify({}))
    RememberMeService.migrateOldCredentials()
  })

  it('recordAutoLoginFailure 未锁定', () => {
    RememberMeService.recordAutoLoginFailure('fail1')
    expect(RememberMeService.getAutoLoginFailureCount()).toBe(1)
    expect(RememberMeService.isAutoLoginLocked()).toBe(false)
  })

  it('recordAutoLoginFailure 多次失败锁定', () => {
    RememberMeService.recordAutoLoginFailure('f1')
    RememberMeService.recordAutoLoginFailure('f2')
    RememberMeService.recordAutoLoginFailure('f3')
    expect(RememberMeService.isAutoLoginLocked()).toBe(true)
  })

  it('isAutoLoginLocked 锁定后过期', () => {
    localStorage.setItem('test-auto-login', JSON.stringify({
      failures: 3, isLocked: true, lastFailureTime: Date.now() - 31 * 60 * 1000,
    }))
    expect(RememberMeService.isAutoLoginLocked()).toBe(false)
  })

  it('isAutoLoginLocked 锁定但无 lastFailureTime', () => {
    localStorage.setItem('test-auto-login', JSON.stringify({ failures: 3, isLocked: true }))
    expect(RememberMeService.isAutoLoginLocked()).toBe(true)
  })

  it('isAutoLoginLocked 未锁定', () => {
    expect(RememberMeService.isAutoLoginLocked()).toBe(false)
  })

  it('getLockRemainingTime 锁定中', () => {
    localStorage.setItem('test-auto-login', JSON.stringify({
      failures: 3, isLocked: true, lastFailureTime: Date.now() - 1000,
    }))
    expect(RememberMeService.getLockRemainingTime()).toBeGreaterThan(0)
  })

  it('getLockRemainingTime 未锁定', () => {
    expect(RememberMeService.getLockRemainingTime()).toBe(0)
  })

  it('getLockRemainingTime 锁定过期', () => {
    localStorage.setItem('test-auto-login', JSON.stringify({
      failures: 3, isLocked: true, lastFailureTime: Date.now() - 31 * 60 * 1000,
    }))
    expect(RememberMeService.getLockRemainingTime()).toBe(0)
  })

  it('getAutoLoginFailureCount', () => {
    expect(RememberMeService.getAutoLoginFailureCount()).toBe(0)
    RememberMeService.recordAutoLoginFailure('f1')
    expect(RememberMeService.getAutoLoginFailureCount()).toBe(1)
  })

  it('getAutoLoginRecord 解析失败', () => {
    localStorage.setItem('test-auto-login', 'invalid')
    expect(RememberMeService.getAutoLoginFailureCount()).toBe(0)
  })

  it('resetAutoLoginRecord', () => {
    RememberMeService.recordAutoLoginFailure('f1')
    RememberMeService.resetAutoLoginRecord()
    expect(RememberMeService.getAutoLoginFailureCount()).toBe(0)
  })

  it('canAttemptAutoLogin 未启用', () => {
    expect(RememberMeService.canAttemptAutoLogin()).toBe(false)
  })

  it('canAttemptAutoLogin 启用但无 token', () => {
    RememberMeService.setRememberMePreference(true)
    expect(RememberMeService.canAttemptAutoLogin()).toBe(false)
  })

  it('canAttemptAutoLogin 全部满足', () => {
    RememberMeService.setRememberMePreference(true)
    RememberMeService.saveRefreshToken('token1')
    expect(RememberMeService.canAttemptAutoLogin()).toBe(true)
  })

  it('canAttemptAutoLogin 锁定', () => {
    RememberMeService.setRememberMePreference(true)
    RememberMeService.saveRefreshToken('token1')
    RememberMeService.recordAutoLoginFailure('f1')
    RememberMeService.recordAutoLoginFailure('f2')
    RememberMeService.recordAutoLoginFailure('f3')
    expect(RememberMeService.canAttemptAutoLogin()).toBe(false)
  })

  it('init 正常', () => {
    RememberMeService.savePhoneCredentials('138')
    RememberMeService.init()
  })

  it('init 过期凭据', () => {
    localStorage.setItem('test-credentials', JSON.stringify({
      phone: '138', timestamp: Date.now() - 8 * 24 * 60 * 60 * 1000,
    }))
    RememberMeService.init()
    expect(RememberMeService.getCredentials()).toBeNull()
  })

  it('saveRefreshToken 抛错', () => {
    RememberMeService.setRememberMePreference(true)
    const setItemSpy = vi.spyOn(localStorage.__proto__, 'setItem').mockImplementationOnce(() => {
      throw new Error('QuotaExceededError')
    })
    RememberMeService.saveRefreshToken('token1')
    setItemSpy.mockRestore()
  })
})
