import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { themeSyncConflictService, type ConflictResolution } from '../themeSyncConflict'

describe('themeSyncConflictService', () => {
  const localDeviceId = 'device-local-123'
  const cloudDeviceId = 'device-cloud-456'

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('detectConflict', () => {
    it('同一设备不应检测到冲突', () => {
      const now = Date.now()
      const hasConflict = themeSyncConflictService.detectConflict(
        now,
        now + 30000,
        localDeviceId,
        localDeviceId
      )
      expect(hasConflict).toBe(false)
    })

    it('不同设备且时间接近应检测到冲突', () => {
      const now = Date.now()
      const hasConflict = themeSyncConflictService.detectConflict(
        now,
        now + 30000,
        localDeviceId,
        cloudDeviceId
      )
      expect(hasConflict).toBe(true)
    })

    it('不同设备但时间差距大不应检测到冲突', () => {
      const now = Date.now()
      const hasConflict = themeSyncConflictService.detectConflict(
        now,
        now + 120000,
        localDeviceId,
        cloudDeviceId
      )
      expect(hasConflict).toBe(false)
    })
  })

  describe('resolveConflict', () => {
    const localData = {
      themeMode: 'dark' as const,
      updatedAt: Date.now(),
      deviceId: localDeviceId
    }
    const cloudData = {
      themeMode: 'light' as const,
      updatedAt: Date.now() - 1000,
      deviceId: cloudDeviceId
    }

    it('选择本地版本应返回本地数据', () => {
      const result = themeSyncConflictService.resolveConflict(
        localData,
        cloudData,
        'local'
      )
      expect(result.themeMode).toBe('dark')
    })

    it('选择云端版本应返回云端数据', () => {
      const result = themeSyncConflictService.resolveConflict(
        localData,
        cloudData,
        'cloud'
      )
      expect(result.themeMode).toBe('light')
    })

    it('选择合并应返回最新数据', () => {
      const result = themeSyncConflictService.resolveConflict(
        localData,
        cloudData,
        'merge'
      )
      expect(result.themeMode).toBe('dark')
    })

    it('合并时云端更新应返回云端数据', () => {
      const newerCloudData = {
        ...cloudData,
        updatedAt: Date.now() + 1000
      }
      const result = themeSyncConflictService.resolveConflict(
        localData,
        newerCloudData,
        'merge'
      )
      expect(result.themeMode).toBe('light')
    })
  })

  describe('getAutoResolution', () => {
    it('本地更新时应返回 local', () => {
      const localData = {
        themeMode: 'dark' as const,
        updatedAt: Date.now(),
        deviceId: localDeviceId
      }
      const cloudData = {
        themeMode: 'light' as const,
        updatedAt: Date.now() - 1000,
        deviceId: cloudDeviceId
      }

      const resolution = themeSyncConflictService.getAutoResolution(localData, cloudData)
      expect(resolution).toBe('local')
    })

    it('云端更新时应返回 cloud', () => {
      const localData = {
        themeMode: 'dark' as const,
        updatedAt: Date.now() - 1000,
        deviceId: localDeviceId
      }
      const cloudData = {
        themeMode: 'light' as const,
        updatedAt: Date.now(),
        deviceId: cloudDeviceId
      }

      const resolution = themeSyncConflictService.getAutoResolution(localData, cloudData)
      expect(resolution).toBe('cloud')
    })
  })

  describe('shouldPromptUser', () => {
    it('同一设备不应提示用户', () => {
      const now = Date.now()
      const shouldPrompt = themeSyncConflictService.shouldPromptUser(
        { themeMode: 'dark', updatedAt: now, deviceId: localDeviceId },
        { themeMode: 'light', updatedAt: now, deviceId: localDeviceId }
      )
      expect(shouldPrompt).toBe(false)
    })

    it('不同设备且时间接近应提示用户', () => {
      const now = Date.now()
      const shouldPrompt = themeSyncConflictService.shouldPromptUser(
        { themeMode: 'dark', updatedAt: now, deviceId: localDeviceId },
        { themeMode: 'light', updatedAt: now, deviceId: cloudDeviceId }
      )
      expect(shouldPrompt).toBe(true)
    })
  })
})
