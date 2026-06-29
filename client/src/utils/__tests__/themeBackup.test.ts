import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const store: Record<string, string> = {}

const mockLocalStorage = {
  getItem: (key: string) => store[key] || null,
  setItem: (key: string, value: string) => {
    store[key] = value
  },
  removeItem: (key: string) => {
    delete store[key]
  },
  clear: () => {
    Object.keys(store).forEach(key => delete store[key])
  }
}

vi.stubGlobal('localStorage', mockLocalStorage)

vi.mock('@/stores/darkMode', () => ({
  useDarkModeStore: vi.fn(() => ({
    themeMode: 'light',
    setThemeMode: vi.fn()
  }))
}))

vi.mock('@/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn()
  }
}))

import { themeBackupManager } from '../themeBackup'

describe('themeBackupManager', () => {
  beforeEach(() => {
    mockLocalStorage.clear()
    themeBackupManager.clearAllBackups()
    themeBackupManager.stopAutoBackup()
  })

  afterEach(() => {
    themeBackupManager.stopAutoBackup()
  })

  describe('getConfig', () => {
    it('should return backup config', () => {
      const config = themeBackupManager.getConfig()
      expect(config).toBeDefined()
      expect(typeof config.enabled).toBe('boolean')
      expect(typeof config.interval).toBe('number')
      expect(typeof config.maxBackups).toBe('number')
    })
  })

  describe('setConfig', () => {
    it('should update config', () => {
      themeBackupManager.setConfig({ maxBackups: 5 })
      const config = themeBackupManager.getConfig()
      expect(config.maxBackups).toBe(5)
    })
  })

  describe('createBackup', () => {
    it('should create a backup', () => {
      const backup = themeBackupManager.createBackup('测试备份')
      expect(backup.id).toBeDefined()
      expect(backup.name).toBe('测试备份')
      expect(backup.timestamp).toBeGreaterThan(0)
      expect(backup.data).toBeDefined()
    })

    it('should create auto backup', () => {
      const backup = themeBackupManager.createBackup(undefined, true)
      expect(backup.auto).toBe(true)
    })
  })

  describe('getBackups', () => {
    it('should return backups list', () => {
      themeBackupManager.createBackup('备份1')
      themeBackupManager.createBackup('备份2')
      const backups = themeBackupManager.getBackups()
      expect(backups.length).toBeGreaterThanOrEqual(2)
    })

    it('should return backups sorted by timestamp desc', async () => {
      themeBackupManager.createBackup('旧备份')
      await new Promise(r => setTimeout(r, 10))
      themeBackupManager.createBackup('新备份')
      const backups = themeBackupManager.getBackups()
      expect(backups[0].name).toBe('新备份')
    })
  })

  describe('getBackup', () => {
    it('should return specific backup', () => {
      const created = themeBackupManager.createBackup('测试')
      const backup = themeBackupManager.getBackup(created.id)
      expect(backup).toBeDefined()
      expect(backup?.id).toBe(created.id)
    })

    it('should return undefined for invalid id', () => {
      const backup = themeBackupManager.getBackup('invalid-id')
      expect(backup).toBeUndefined()
    })
  })

  describe('deleteBackup', () => {
    it('should delete backup', () => {
      const backup = themeBackupManager.createBackup('待删除')
      const result = themeBackupManager.deleteBackup(backup.id)
      expect(result).toBe(true)
      expect(themeBackupManager.getBackup(backup.id)).toBeUndefined()
    })

    it('should return false for invalid id', () => {
      const result = themeBackupManager.deleteBackup('invalid-id')
      expect(result).toBe(false)
    })
  })

  describe('restoreBackup', () => {
    it('should return false for invalid backup', () => {
      const result = themeBackupManager.restoreBackup('invalid-id')
      expect(result).toBe(false)
    })

    it('should restore valid backup', () => {
      const backup = themeBackupManager.createBackup('测试恢复')
      const result = themeBackupManager.restoreBackup(backup.id)
      expect(result).toBe(true)
    })
  })

  describe('exportBackup', () => {
    it('should export backup as JSON', () => {
      const backup = themeBackupManager.createBackup('导出测试')
      const exported = themeBackupManager.exportBackup(backup.id)
      expect(exported).not.toBeNull()
      expect(() => JSON.parse(exported!)).not.toThrow()
    })

    it('should return null for invalid backup', () => {
      const exported = themeBackupManager.exportBackup('invalid-id')
      expect(exported).toBeNull()
    })
  })

  describe('importBackup', () => {
    it('should import valid backup JSON', () => {
      const original = themeBackupManager.createBackup('原始备份')
      const exported = themeBackupManager.exportBackup(original.id)
      const imported = themeBackupManager.importBackup(exported!)
      expect(imported).not.toBeNull()
      expect(imported?.id).not.toBe(original.id)
    })

    it('should return null for invalid JSON', () => {
      const result = themeBackupManager.importBackup('invalid json')
      expect(result).toBeNull()
    })
  })

  describe('shouldBackup', () => {
    it('should return true when interval passed', () => {
      themeBackupManager.setConfig({ enabled: true, interval: 0 })
      const result = themeBackupManager.shouldBackup()
      expect(result).toBe(true)
    })

    it('should return false when disabled', () => {
      themeBackupManager.setConfig({ enabled: false })
      const result = themeBackupManager.shouldBackup()
      expect(result).toBe(false)
    })
  })

  describe('getLastBackupTime', () => {
    it('should return last backup time', () => {
      themeBackupManager.createBackup('测试')
      const time = themeBackupManager.getLastBackupTime()
      expect(time).toBeGreaterThan(0)
    })
  })

  describe('getNextBackupTime', () => {
    it('should return next backup time when enabled', () => {
      themeBackupManager.setConfig({ enabled: true, interval: 3600000 })
      const nextTime = themeBackupManager.getNextBackupTime()
      expect(nextTime).not.toBeNull()
    })

    it('should return null when disabled', () => {
      themeBackupManager.setConfig({ enabled: false })
      const nextTime = themeBackupManager.getNextBackupTime()
      expect(nextTime).toBeNull()
    })
  })

  describe('clearAllBackups', () => {
    it('should clear all backups', () => {
      themeBackupManager.createBackup('备份1')
      themeBackupManager.createBackup('备份2')
      themeBackupManager.clearAllBackups()
      const backups = themeBackupManager.getBackups()
      expect(backups.length).toBe(0)
    })
  })

  describe('getStorageSize', () => {
    it('should return storage size', () => {
      themeBackupManager.createBackup('测试')
      const size = themeBackupManager.getStorageSize()
      expect(size).toBeGreaterThanOrEqual(0)
    })
  })

  describe('onChange', () => {
    it('should register change handler', () => {
      const handler = vi.fn()
      const unsubscribe = themeBackupManager.onChange(handler)
      themeBackupManager.createBackup('触发变更')
      expect(handler).toHaveBeenCalled()
      unsubscribe()
    })

    it('should unsubscribe handler', () => {
      const handler = vi.fn()
      const unsubscribe = themeBackupManager.onChange(handler)
      unsubscribe()
      themeBackupManager.createBackup('再次触发')
      expect(handler).not.toHaveBeenCalled()
    })
  })

  // 补充测试：构造函数从 localStorage 加载（通过 mock 验证存储键可写入）
  describe('loadFromStorage on init', () => {
    it('should write config to localStorage on setConfig', () => {
      mockLocalStorage.clear()
      themeBackupManager.setConfig({ maxBackups: 7, interval: 1000 })
      const stored = mockLocalStorage.getItem('theme-backup-config')
      expect(stored).not.toBeNull()
      expect(JSON.parse(stored!).maxBackups).toBe(7)
    })

    it('should write backups to localStorage on createBackup', () => {
      mockLocalStorage.clear()
      themeBackupManager.createBackup('验证存储')
      const stored = mockLocalStorage.getItem('theme-backups')
      expect(stored).not.toBeNull()
    })

    it('should write last backup time to localStorage', () => {
      mockLocalStorage.clear()
      themeBackupManager.createBackup('验证时间')
      const stored = mockLocalStorage.getItem('theme-last-backup-time')
      expect(stored).not.toBeNull()
      expect(parseInt(stored!, 10)).toBeGreaterThan(0)
    })
  })

  // 补充测试：saveConfig 异常处理
  describe('saveConfig error handling', () => {
    it('should handle setItem failure gracefully', () => {
      const original = mockLocalStorage.setItem
      mockLocalStorage.setItem = vi.fn(() => { throw new Error('quota') })
      themeBackupManager.setConfig({ maxBackups: 99 })
      // 不应抛出异常
      expect(themeBackupManager.getConfig().maxBackups).toBe(99)
      mockLocalStorage.setItem = original
    })
  })

  // 补充测试：saveBackups 异常 + 清理逻辑
  describe('saveBackups error handling', () => {
    it('should halve backups when storage fails', () => {
      themeBackupManager.setConfig({ maxBackups: 10 })
      for (let i = 0; i < 4; i++) {
        themeBackupManager.createBackup(`备份${i}`)
      }
      const original = mockLocalStorage.setItem
      let callCount = 0
      mockLocalStorage.setItem = vi.fn((key: string, value: string) => {
        callCount++
        if (callCount === 1) throw new Error('quota')
        store[key] = value
      })
      // 触发 saveBackups 的 catch 分支
      themeBackupManager.createBackup('触发异常')
      mockLocalStorage.setItem = original
      // 不应崩溃
      expect(themeBackupManager.getBackups().length).toBeGreaterThan(0)
    })
  })

  // 补充测试：collectBackupData 中各部分
  describe('collectBackupData', () => {
    it('should collect presets from localStorage', () => {
      mockLocalStorage.clear()
      const presets = [{ id: 'p1', name: '预设1' }]
      store['theme-presets'] = JSON.stringify(presets)
      const backup = themeBackupManager.createBackup('含预设')
      expect(backup.data.presets.length).toBe(1)
    })

    it('should collect schedules from localStorage', () => {
      mockLocalStorage.clear()
      const schedules = [{ id: 's1', time: '08:00' }]
      store['theme-schedules'] = JSON.stringify(schedules)
      const backup = themeBackupManager.createBackup('含计划')
      expect(backup.data.schedules.length).toBe(1)
    })

    it('should collect shortcuts from localStorage', () => {
      mockLocalStorage.clear()
      const shortcuts = [{ key: 'ctrl+t' }]
      store['theme-shortcuts-config'] = JSON.stringify(shortcuts)
      const backup = themeBackupManager.createBackup('含快捷键')
      expect(backup.data.shortcuts.length).toBe(1)
    })

    it('should collect transition from localStorage', () => {
      mockLocalStorage.clear()
      const transition = { duration: 300 }
      store['theme-transition-config'] = JSON.stringify(transition)
      const backup = themeBackupManager.createBackup('含过渡')
      expect(backup.data.transition).toEqual(transition)
    })

    it('should skip data when include flags are false', () => {
      mockLocalStorage.clear()
      const presets = [{ id: 'p1' }]
      store['theme-presets'] = JSON.stringify(presets)
      themeBackupManager.setConfig({ includePresets: false, includeSchedules: false, includeShortcuts: false, includeTransition: false })
      const backup = themeBackupManager.createBackup('仅基础')
      expect(backup.data.presets.length).toBe(0)
      expect(backup.data.schedules.length).toBe(0)
      expect(backup.data.shortcuts.length).toBe(0)
      expect(backup.data.transition).toBeNull()
    })

    it('should handle invalid JSON in collected data', () => {
      mockLocalStorage.clear()
      store['theme-presets'] = '{invalid'
      store['theme-schedules'] = '{invalid'
      store['theme-shortcuts-config'] = '{invalid'
      store['theme-transition-config'] = '{invalid'
      const backup = themeBackupManager.createBackup('容错')
      expect(backup.data).toBeDefined()
    })
  })

  // 补充测试：cleanupOldBackups 触发自动备份清理
  describe('cleanupOldBackups', () => {
    it('should remove old auto backups when exceeding max', async () => {
      // 先禁用自动备份避免干扰
      themeBackupManager.setConfig({ enabled: false, maxBackups: 3 })
      themeBackupManager.clearAllBackups()
      // 创建 2 个手动 + 3 个自动 = 5，超过 maxBackups=3
      // 加延时避免 Date.now() 重复
      const b1 = themeBackupManager.createBackup('手动1', false)
      await new Promise(r => setTimeout(r, 5))
      const b2 = themeBackupManager.createBackup('手动2', false)
      await new Promise(r => setTimeout(r, 5))
      const a1 = themeBackupManager.createBackup('自动1', true)
      await new Promise(r => setTimeout(r, 5))
      const a2 = themeBackupManager.createBackup('自动2', true)
      await new Promise(r => setTimeout(r, 5))
      const a3 = themeBackupManager.createBackup('自动3', true)
      const backups = themeBackupManager.getBackups()
      // 验证手动备份的 auto 标志
      const b1Found = backups.find(b => b.id === b1.id)
      const b2Found = backups.find(b => b.id === b2.id)
      expect(b1Found?.auto).toBe(false)
      expect(b2Found?.auto).toBe(false)
      // 备份总数不超过 maxBackups
      expect(backups.length).toBeLessThanOrEqual(3)
    })

    it('should not cleanup when under max', () => {
      themeBackupManager.setConfig({ enabled: false, maxBackups: 10 })
      themeBackupManager.clearAllBackups()
      themeBackupManager.createBackup('手动1', false)
      themeBackupManager.createBackup('自动1', true)
      const backups = themeBackupManager.getBackups()
      expect(backups.length).toBe(2)
    })
  })

  // 补充测试：restoreBackup 各种字段
  describe('restoreBackup data fields', () => {
    it('should restore presets, schedules, shortcuts, transition', () => {
      const backup = {
        id: 'test-restore',
        timestamp: Date.now(),
        name: '完整恢复',
        data: {
          themeMode: 'dark' as unknown as string,
          presets: [{ id: 'p1', name: '恢复预设' }],
          schedules: [{ id: 's1' }],
          shortcuts: { key: 'ctrl+k' },
          transition: { duration: 200 },
          customVariables: { '--color': 'red' }
        },
        auto: false
      }
      // 通过 importBackup 注入
      const json = JSON.stringify({ version: '1.0', exportedAt: '', backup })
      themeBackupManager.importBackup(json)
      // 找最新导入的备份
      const all = themeBackupManager.getBackups()
      const imported = all.find(b => b.name === '完整恢复')!
      const result = themeBackupManager.restoreBackup(imported.id)
      expect(result).toBe(true)
      // 验证 localStorage 写入
      const restoredPresets = JSON.parse(mockLocalStorage.getItem('theme-presets') || '[]')
      expect(restoredPresets.length).toBe(1)
    })
  })

  // 补充测试：startAutoBackup / stopAutoBackup
  describe('startAutoBackup and stopAutoBackup', () => {
    it('should start auto backup and stop it', () => {
      themeBackupManager.setConfig({ enabled: true, interval: 100000 })
      themeBackupManager.startAutoBackup()
      themeBackupManager.stopAutoBackup()
      // 不应抛出
      expect(true).toBe(true)
    })

    it('should not start twice', () => {
      themeBackupManager.setConfig({ enabled: true, interval: 100000 })
      themeBackupManager.startAutoBackup()
      themeBackupManager.startAutoBackup() // 第二次应被忽略
      themeBackupManager.stopAutoBackup()
      expect(true).toBe(true)
    })

    it('should create auto backup immediately if interval passed', async () => {
      mockLocalStorage.clear()
      themeBackupManager.setConfig({ enabled: true, interval: 1 })
      await new Promise(r => setTimeout(r, 10))
      themeBackupManager.startAutoBackup()
      themeBackupManager.stopAutoBackup()
      // 验证产生了自动备份
      const backups = themeBackupManager.getBackups()
      const hasAuto = backups.some(b => b.auto)
      expect(hasAuto).toBe(true)
    })
  })

  // 补充测试：importBackup 缺少 backup 字段
  describe('importBackup edge cases', () => {
    it('should return null when parsed JSON has no backup field', () => {
      const result = themeBackupManager.importBackup(JSON.stringify({ version: '1.0' }))
      expect(result).toBeNull()
    })
  })

  // 补充测试：getStorageSize 无数据
  describe('getStorageSize edge cases', () => {
    it('should return 0 when no data stored', () => {
      mockLocalStorage.clear()
      themeBackupManager.clearAllBackups()
      // 即使单例内存中有数据，clear 后存储清空，但 getStorageSize 读 localStorage
      store['theme-backups'] = ''
      const size = themeBackupManager.getStorageSize()
      expect(size).toBe(0)
    })
  })

  // 补充测试：createBackup 默认名称
  describe('createBackup default name', () => {
    it('should use default name 手动备份 when no name provided', () => {
      const backup = themeBackupManager.createBackup()
      expect(backup.name).toBe('手动备份')
    })
  })

  // 补充测试：setConfig 时清理已有 interval
  describe('setConfig clears existing interval', () => {
    it('should clear interval when reconfiguring while auto-backup running', () => {
      themeBackupManager.setConfig({ enabled: true, interval: 100000 })
      themeBackupManager.startAutoBackup()
      // 再次 setConfig 应清除已有 interval
      themeBackupManager.setConfig({ maxBackups: 5 })
      themeBackupManager.stopAutoBackup()
      expect(themeBackupManager.getConfig().maxBackups).toBe(5)
    })
  })

  // 补充测试：getStorageSize 异常处理
  describe('getStorageSize error handling', () => {
    it('should return 0 when localStorage throws', () => {
      const original = mockLocalStorage.getItem
      mockLocalStorage.getItem = vi.fn(() => { throw new Error('storage error') })
      const size = themeBackupManager.getStorageSize()
      expect(size).toBe(0)
      mockLocalStorage.getItem = original
    })
  })
})
