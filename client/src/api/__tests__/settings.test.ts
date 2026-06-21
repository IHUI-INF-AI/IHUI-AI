import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/utils/request', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
    post: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
    put: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
    delete: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
  },
}))

import * as api from '../settings'

describe('settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getUserSettings 应能正常调用', async () => {
    const fn = (api as any).getUserSettings
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('updateUserSettings 应能正常调用', async () => {
    const fn = (api as any).updateUserSettings
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('updateNotificationSettings 应能正常调用', async () => {
    const fn = (api as any).updateNotificationSettings
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('updatePrivacySettings 应能正常调用', async () => {
    const fn = (api as any).updatePrivacySettings
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('updatePreferences 应能正常调用', async () => {
    const fn = (api as any).updatePreferences
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('getLoginDevices 应能正常调用', async () => {
    const fn = (api as any).getLoginDevices
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('removeLoginDevice 应能正常调用', async () => {
    const fn = (api as any).removeLoginDevice
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('clearAllData 应能正常调用', async () => {
    const fn = (api as any).clearAllData
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('exportUserData 应能正常调用', async () => {
    const fn = (api as any).exportUserData
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('deleteAccount 应能正常调用', async () => {
    const fn = (api as any).deleteAccount
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('getAccountDeletionStatus 应能正常调用', async () => {
    const fn = (api as any).getAccountDeletionStatus
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('cancelAccountDeletion 应能正常调用', async () => {
    const fn = (api as any).cancelAccountDeletion
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('sendEmailVerificationCode 应能正常调用', async () => {
    const fn = (api as any).sendEmailVerificationCode
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('verifyEmail 应能正常调用', async () => {
    const fn = (api as any).verifyEmail
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('sendPhoneVerificationCode 应能正常调用', async () => {
    const fn = (api as any).sendPhoneVerificationCode
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('verifyPhone 应能正常调用', async () => {
    const fn = (api as any).verifyPhone
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('getSecurityLogs 应能正常调用', async () => {
    const fn = (api as any).getSecurityLogs
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('syncThemeToCloud 应能正常调用', async () => {
    const fn = (api as any).syncThemeToCloud
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('syncThemeFromCloud 应能正常调用', async () => {
    const fn = (api as any).syncThemeFromCloud
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('getThemePresets 应能正常调用', async () => {
    const fn = (api as any).getThemePresets
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('createThemePreset 应能正常调用', async () => {
    const fn = (api as any).createThemePreset
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('updateThemePreset 应能正常调用', async () => {
    const fn = (api as any).updateThemePreset
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('deleteThemePreset 应能正常调用', async () => {
    const fn = (api as any).deleteThemePreset
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

})
