import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import type { ThemeMode } from '@/stores/darkMode'
import type { ThemePreset } from '../themePreset'

const mockStore: Record<string, string> = {}

vi.stubGlobal('localStorage', {
  getItem: (key: string) => mockStore[key] || null,
  setItem: (key: string, value: string) => { mockStore[key] = value },
  removeItem: (key: string) => { delete mockStore[key] },
  clear: () => { Object.keys(mockStore).forEach(k => delete mockStore[k]) }
})

describe('themeVersionControl', () => {
  beforeEach(async () => {
    Object.keys(mockStore).forEach(k => delete mockStore[k])
    vi.clearAllMocks()
    vi.resetModules()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('createVersion', () => {
    it('should create a new version', async () => {
      const { themeVersionControl } = await import('../themeVersionControl')
      themeVersionControl.clearAllVersions()
      const version = themeVersionControl.createVersion('dark' as ThemeMode, [], null)
      expect(version.id).toBeDefined()
      expect(version.version).toBe(1)
      expect(version.themeMode).toBe('dark')
    })

    it('should increment version number', async () => {
      const { themeVersionControl } = await import('../themeVersionControl')
      themeVersionControl.clearAllVersions()
      themeVersionControl.createVersion('light' as ThemeMode, [], null)
      const version2 = themeVersionControl.createVersion('dark' as ThemeMode, [], null)
      expect(version2.version).toBe(2)
    })

    it('should include label and description', async () => {
      const { themeVersionControl } = await import('../themeVersionControl')
      themeVersionControl.clearAllVersions()
      const version = themeVersionControl.createVersion('dark' as ThemeMode, [], null, { label: 'Test Version', description: 'Test description' })
      expect(version.label).toBe('Test Version')
      expect(version.description).toBe('Test description')
    })

    it('should mark auto-save versions', async () => {
      const { themeVersionControl } = await import('../themeVersionControl')
      themeVersionControl.clearAllVersions()
      const version = themeVersionControl.createVersion('dark' as ThemeMode, [], null, { isAutoSave: true })
      expect(version.isAutoSave).toBe(true)
    })

    it('should copy presets', async () => {
      const { themeVersionControl } = await import('../themeVersionControl')
      themeVersionControl.clearAllVersions()
      const preset: ThemePreset = { id: 'p1', name: 'Preset 1', mode: 'dark', createdAt: Date.now(), updatedAt: Date.now() }
      const version = themeVersionControl.createVersion('dark' as ThemeMode, [preset], null)
      expect(version.presets.length).toBe(1)
    })

    it('should limit versions to MAX_VERSIONS', async () => {
      const { themeVersionControl } = await import('../themeVersionControl')
      themeVersionControl.clearAllVersions()
      for (let i = 0; i < 25; i++) {
        themeVersionControl.createVersion('dark' as ThemeMode, [], null)
      }
      expect(themeVersionControl.getVersionCount()).toBeLessThanOrEqual(20)
    })

    it('should prefer keeping manual versions over auto-save', async () => {
      const { themeVersionControl } = await import('../themeVersionControl')
      themeVersionControl.clearAllVersions()
      for (let i = 0; i < 15; i++) {
        themeVersionControl.createVersion('dark' as ThemeMode, [], null, { isAutoSave: true })
      }
      for (let i = 0; i < 10; i++) {
        themeVersionControl.createVersion('light' as ThemeMode, [], null, { isAutoSave: false })
      }
      const versions = themeVersionControl.getAllVersions()
      const manualCount = versions.filter(v => !v.isAutoSave).length
      expect(manualCount).toBeGreaterThan(0)
    })
  })

  describe('getVersion', () => {
    it('should return version by ID', async () => {
      const { themeVersionControl } = await import('../themeVersionControl')
      themeVersionControl.clearAllVersions()
      const created = themeVersionControl.createVersion('dark' as ThemeMode, [], null)
      const found = themeVersionControl.getVersion(created.id)
      expect(found).toBeDefined()
      expect(found?.themeMode).toBe('dark')
    })

    it('should return undefined for non-existent version', async () => {
      const { themeVersionControl } = await import('../themeVersionControl')
      themeVersionControl.clearAllVersions()
      const found = themeVersionControl.getVersion('non-existent')
      expect(found).toBeUndefined()
    })
  })

  describe('getVersionByNumber', () => {
    it('should return version by number', async () => {
      const { themeVersionControl } = await import('../themeVersionControl')
      themeVersionControl.clearAllVersions()
      themeVersionControl.createVersion('light' as ThemeMode, [], null)
      const version = themeVersionControl.getVersionByNumber(1)
      expect(version).toBeDefined()
      expect(version?.version).toBe(1)
    })

    it('should return undefined for non-existent number', async () => {
      const { themeVersionControl } = await import('../themeVersionControl')
      themeVersionControl.clearAllVersions()
      const version = themeVersionControl.getVersionByNumber(999)
      expect(version).toBeUndefined()
    })
  })

  describe('getLatestVersion', () => {
    it('should return the most recent version', async () => {
      const { themeVersionControl } = await import('../themeVersionControl')
      themeVersionControl.clearAllVersions()
      themeVersionControl.createVersion('light' as ThemeMode, [], null)
      themeVersionControl.createVersion('dark' as ThemeMode, [], null)
      const latest = themeVersionControl.getLatestVersion()
      expect(latest?.themeMode).toBe('dark')
    })

    it('should return undefined when no versions', async () => {
      const { themeVersionControl } = await import('../themeVersionControl')
      themeVersionControl.clearAllVersions()
      const latest = themeVersionControl.getLatestVersion()
      expect(latest).toBeUndefined()
    })
  })

  describe('getAllVersions', () => {
    it('should return all versions', async () => {
      const { themeVersionControl } = await import('../themeVersionControl')
      themeVersionControl.clearAllVersions()
      themeVersionControl.createVersion('light' as ThemeMode, [], null)
      themeVersionControl.createVersion('dark' as ThemeMode, [], null)
      const all = themeVersionControl.getAllVersions()
      expect(all.length).toBe(2)
    })

    it('should return a copy', async () => {
      const { themeVersionControl } = await import('../themeVersionControl')
      themeVersionControl.clearAllVersions()
      themeVersionControl.createVersion('light' as ThemeMode, [], null)
      const all1 = themeVersionControl.getAllVersions()
      const all2 = themeVersionControl.getAllVersions()
      expect(all1).not.toBe(all2)
    })
  })

  describe('getVersionHistory', () => {
    it('should return versions sorted by date', async () => {
      const { themeVersionControl } = await import('../themeVersionControl')
      themeVersionControl.clearAllVersions()
      themeVersionControl.createVersion('light' as ThemeMode, [], null)
      themeVersionControl.createVersion('dark' as ThemeMode, [], null)
      themeVersionControl.createVersion('auto' as ThemeMode, [], null)
      const history = themeVersionControl.getVersionHistory(10)
      expect(history.length).toBe(3)
    })

    it('should limit results', async () => {
      const { themeVersionControl } = await import('../themeVersionControl')
      themeVersionControl.clearAllVersions()
      for (let i = 0; i < 5; i++) {
        themeVersionControl.createVersion('dark' as ThemeMode, [], null)
      }
      const history = themeVersionControl.getVersionHistory(3)
      expect(history.length).toBe(3)
    })
  })

  describe('compareVersions', () => {
    it('should return diff object', async () => {
      const { themeVersionControl } = await import('../themeVersionControl')
      themeVersionControl.clearAllVersions()
      const v1 = themeVersionControl.createVersion('light' as ThemeMode, [], null)
      const v2 = themeVersionControl.createVersion('dark' as ThemeMode, [], null)
      const diff = themeVersionControl.compareVersions(v1.id, v2.id)
      expect(diff).toBeDefined()
      expect(diff?.previousMode).toBeDefined()
      expect(diff?.currentMode).toBeDefined()
    })

    it('should return diff with added/removed/modified arrays', async () => {
      const { themeVersionControl } = await import('../themeVersionControl')
      themeVersionControl.clearAllVersions()
      const preset1: ThemePreset = { id: 'p1', name: 'Preset 1', mode: 'dark', createdAt: Date.now(), updatedAt: Date.now() }
      const v1 = themeVersionControl.createVersion('dark' as ThemeMode, [], null)
      const v2 = themeVersionControl.createVersion('dark' as ThemeMode, [preset1], null)
      const diff = themeVersionControl.compareVersions(v1.id, v2.id)
      expect(diff).toBeDefined()
      expect(Array.isArray(diff?.added)).toBe(true)
      expect(Array.isArray(diff?.removed)).toBe(true)
      expect(Array.isArray(diff?.modified)).toBe(true)
    })

    it('should return null for non-existent version', async () => {
      const { themeVersionControl } = await import('../themeVersionControl')
      themeVersionControl.clearAllVersions()
      const v1 = themeVersionControl.createVersion('dark' as ThemeMode, [], null)
      const diff = themeVersionControl.compareVersions(v1.id, 'non-existent')
      expect(diff).toBeNull()
    })
  })

  describe('deleteVersion', () => {
    it('should delete version', async () => {
      const { themeVersionControl } = await import('../themeVersionControl')
      themeVersionControl.clearAllVersions()
      const version = themeVersionControl.createVersion('dark' as ThemeMode, [], null)
      const result = themeVersionControl.deleteVersion(version.id)
      expect(result).toBe(true)
      expect(themeVersionControl.getVersion(version.id)).toBeUndefined()
    })

    it('should return false for non-existent version', async () => {
      const { themeVersionControl } = await import('../themeVersionControl')
      themeVersionControl.clearAllVersions()
      const result = themeVersionControl.deleteVersion('non-existent')
      expect(result).toBe(false)
    })
  })

  describe('clearAutoSavedVersions', () => {
    it('should clear only auto-saved versions', async () => {
      const { themeVersionControl } = await import('../themeVersionControl')
      themeVersionControl.clearAllVersions()
      themeVersionControl.createVersion('dark' as ThemeMode, [], null, { isAutoSave: false })
      themeVersionControl.createVersion('light' as ThemeMode, [], null, { isAutoSave: true })
      themeVersionControl.clearAutoSavedVersions()
      const history = themeVersionControl.getVersionHistory()
      expect(history.every(v => !v.isAutoSave)).toBe(true)
    })
  })

  describe('clearAllVersions', () => {
    it('should clear all versions', async () => {
      const { themeVersionControl } = await import('../themeVersionControl')
      themeVersionControl.clearAllVersions()
      themeVersionControl.createVersion('dark' as ThemeMode, [], null)
      themeVersionControl.createVersion('light' as ThemeMode, [], null)
      themeVersionControl.clearAllVersions()
      expect(themeVersionControl.getVersionCount()).toBe(0)
    })
  })

  describe('setAutoSave', () => {
    it('should toggle auto-save', async () => {
      const { themeVersionControl } = await import('../themeVersionControl')
      themeVersionControl.clearAllVersions()
      themeVersionControl.setAutoSave(false)
      expect(themeVersionControl.isAutoSaveEnabled()).toBe(false)
      themeVersionControl.setAutoSave(true)
      expect(themeVersionControl.isAutoSaveEnabled()).toBe(true)
    })
  })

  describe('autoSave', () => {
    it('should create auto-save version', async () => {
      const { themeVersionControl } = await import('../themeVersionControl')
      themeVersionControl.clearAllVersions()
      themeVersionControl.setAutoSave(true)
      const version = themeVersionControl.autoSave('dark' as ThemeMode, [], null)
      expect(version).toBeDefined()
      expect(version?.isAutoSave).toBe(true)
    })

    it('should return null when auto-save disabled', async () => {
      const { themeVersionControl } = await import('../themeVersionControl')
      themeVersionControl.clearAllVersions()
      themeVersionControl.setAutoSave(false)
      const version = themeVersionControl.autoSave('dark' as ThemeMode, [], null)
      expect(version).toBeNull()
    })

    it('should return null when last version is recent', async () => {
      const { themeVersionControl } = await import('../themeVersionControl')
      themeVersionControl.clearAllVersions()
      themeVersionControl.setAutoSave(true)
      themeVersionControl.createVersion('dark' as ThemeMode, [], null)
      const version = themeVersionControl.autoSave('light' as ThemeMode, [], null)
      expect(version).toBeNull()
    })
  })

  describe('rollbackToVersion', () => {
    it('should return version for rollback', async () => {
      const { themeVersionControl } = await import('../themeVersionControl')
      themeVersionControl.clearAllVersions()
      const version = themeVersionControl.createVersion('dark' as ThemeMode, [], null)
      const rollback = themeVersionControl.rollbackToVersion(version.id)
      expect(rollback).toBeDefined()
      expect(rollback?.id).toBe(version.id)
    })

    it('should return null for non-existent version', async () => {
      const { themeVersionControl } = await import('../themeVersionControl')
      themeVersionControl.clearAllVersions()
      const rollback = themeVersionControl.rollbackToVersion('non-existent')
      expect(rollback).toBeNull()
    })
  })

  describe('exportVersion', () => {
    it('should export version as JSON', async () => {
      const { themeVersionControl } = await import('../themeVersionControl')
      themeVersionControl.clearAllVersions()
      const version = themeVersionControl.createVersion('dark' as ThemeMode, [], null)
      const exported = themeVersionControl.exportVersion(version.id)
      expect(exported).toBeDefined()
      const parsed = JSON.parse(exported!)
      expect(parsed.themeMode).toBe('dark')
    })

    it('should return null for non-existent version', async () => {
      const { themeVersionControl } = await import('../themeVersionControl')
      themeVersionControl.clearAllVersions()
      const exported = themeVersionControl.exportVersion('non-existent')
      expect(exported).toBeNull()
    })
  })

  describe('importVersion', () => {
    it('should import valid version', async () => {
      const { themeVersionControl } = await import('../themeVersionControl')
      themeVersionControl.clearAllVersions()
      const json = JSON.stringify({ themeMode: 'dark', presets: [], activePresetId: null, createdAt: Date.now(), isAutoSave: false })
      const result = themeVersionControl.importVersion(json)
      expect(result.success).toBe(true)
      expect(result.version?.themeMode).toBe('dark')
    })

    it('should fail on invalid JSON', async () => {
      const { themeVersionControl } = await import('../themeVersionControl')
      themeVersionControl.clearAllVersions()
      const result = themeVersionControl.importVersion('invalid')
      expect(result.success).toBe(false)
    })

    it('should fail on missing themeMode', async () => {
      const { themeVersionControl } = await import('../themeVersionControl')
      themeVersionControl.clearAllVersions()
      const json = JSON.stringify({ presets: [] })
      const result = themeVersionControl.importVersion(json)
      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid version format')
    })

    it('should fail on missing presets', async () => {
      const { themeVersionControl } = await import('../themeVersionControl')
      themeVersionControl.clearAllVersions()
      const json = JSON.stringify({ themeMode: 'dark' })
      const result = themeVersionControl.importVersion(json)
      expect(result.success).toBe(false)
    })

    it('should fail on invalid theme mode', async () => {
      const { themeVersionControl } = await import('../themeVersionControl')
      themeVersionControl.clearAllVersions()
      const json = JSON.stringify({ themeMode: 'invalid-mode', presets: [] })
      const result = themeVersionControl.importVersion(json)
      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid theme mode')
    })

    it('should import all valid theme modes', async () => {
      const { themeVersionControl } = await import('../themeVersionControl')
      themeVersionControl.clearAllVersions()
      const modes: ThemeMode[] = ['light', 'dark', 'auto', 'high-contrast-light', 'high-contrast-dark']
      for (const mode of modes) {
        const json = JSON.stringify({ themeMode: mode, presets: [] })
        const result = themeVersionControl.importVersion(json)
        expect(result.success).toBe(true)
      }
    })
  })

  describe('getVersionCount', () => {
    it('should return correct count', async () => {
      const { themeVersionControl } = await import('../themeVersionControl')
      themeVersionControl.clearAllVersions()
      themeVersionControl.createVersion('dark' as ThemeMode, [], null)
      themeVersionControl.createVersion('light' as ThemeMode, [], null)
      expect(themeVersionControl.getVersionCount()).toBe(2)
    })
  })

  describe('getStorageSize', () => {
    it('should return storage size', async () => {
      const { themeVersionControl } = await import('../themeVersionControl')
      themeVersionControl.clearAllVersions()
      themeVersionControl.createVersion('dark' as ThemeMode, [], null)
      const size = themeVersionControl.getStorageSize()
      expect(size).toBeGreaterThan(0)
    })

    it('should return 0 when no data', async () => {
      const { themeVersionControl } = await import('../themeVersionControl')
      themeVersionControl.clearAllVersions()
      mockStore['theme-versions'] = ''
      const size = themeVersionControl.getStorageSize()
      expect(size).toBe(0)
    })
  })

  describe('subscribe', () => {
    it('should notify listeners on version creation', async () => {
      const { themeVersionControl } = await import('../themeVersionControl')
      themeVersionControl.clearAllVersions()
      const listener = vi.fn()
      themeVersionControl.subscribe(listener)
      themeVersionControl.createVersion('dark' as ThemeMode, [], null)
      expect(listener).toHaveBeenCalled()
    })

    it('should unsubscribe correctly', async () => {
      const { themeVersionControl } = await import('../themeVersionControl')
      themeVersionControl.clearAllVersions()
      const listener = vi.fn()
      const unsubscribe = themeVersionControl.subscribe(listener)
      unsubscribe()
      themeVersionControl.createVersion('dark' as ThemeMode, [], null)
      expect(listener).not.toHaveBeenCalled()
    })

    it('should handle listener errors', async () => {
      const { themeVersionControl } = await import('../themeVersionControl')
      themeVersionControl.clearAllVersions()
      const errorListener = vi.fn().mockImplementation(() => { throw new Error('Listener error') })
      const normalListener = vi.fn()
      themeVersionControl.subscribe(errorListener)
      themeVersionControl.subscribe(normalListener)
      expect(() => themeVersionControl.createVersion('dark' as ThemeMode, [], null)).not.toThrow()
      expect(normalListener).toHaveBeenCalled()
    })
  })

  describe('loadVersions from storage', () => {
    it('should load versions from localStorage', async () => {
      mockStore['theme-versions'] = JSON.stringify({
        versions: [{ id: 'v1', version: 1, themeMode: 'dark', presets: [], activePresetId: null, createdAt: Date.now(), isAutoSave: false }],
        currentVersionNumber: 1,
        autoSaveEnabled: true
      })
      vi.resetModules()
      const { themeVersionControl } = await import('../themeVersionControl')
      expect(themeVersionControl.getVersionCount()).toBe(1)
    })

    it('should handle invalid stored data', async () => {
      mockStore['theme-versions'] = 'invalid-json'
      vi.resetModules()
      const { themeVersionControl } = await import('../themeVersionControl')
      expect(themeVersionControl.getVersionCount()).toBe(0)
    })

    it('should load autoSaveEnabled setting', async () => {
      mockStore['theme-versions'] = JSON.stringify({
        versions: [],
        currentVersionNumber: 0,
        autoSaveEnabled: false
      })
      vi.resetModules()
      const { themeVersionControl } = await import('../themeVersionControl')
      expect(themeVersionControl.isAutoSaveEnabled()).toBe(false)
    })
  })

  describe('saveVersions error handling', () => {
    it('should handle localStorage quota exceeded', async () => {
      const { themeVersionControl } = await import('../themeVersionControl')
      themeVersionControl.clearAllVersions()
      const originalSetItem = mockStore.setItem
      mockStore.setItem = () => { throw new Error('QuotaExceededError') }
      expect(() => themeVersionControl.createVersion('dark' as ThemeMode, [], null)).not.toThrow()
      mockStore.setItem = originalSetItem
    })
  })

  describe('server-side rendering', () => {
    it('should handle undefined window', async () => {
      const originalWindow = global.window
      Object.defineProperty(global, 'window', { value: undefined, writable: true })
      vi.resetModules()
      const { themeVersionControl } = await import('../themeVersionControl')
      expect(themeVersionControl.getVersionCount()).toBe(0)
      Object.defineProperty(global, 'window', { value: originalWindow, writable: true })
    })
  })
})
