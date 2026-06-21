import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import type { ThemePreset } from '../themePreset'

const mockStore: Record<string, string> = {}

vi.stubGlobal('localStorage', {
  getItem: (key: string) => mockStore[key] || null,
  setItem: (key: string, value: string) => { mockStore[key] = value },
  removeItem: (key: string) => { delete mockStore[key] },
  clear: () => { Object.keys(mockStore).forEach(k => delete mockStore[k]) }
})

describe('themePresetManager', () => {
  beforeEach(async () => {
    Object.keys(mockStore).forEach(k => delete mockStore[k])
    vi.clearAllMocks()
    vi.resetModules()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getPresets', () => {
    it('should return default presets when no stored presets', async () => {
      const { themePresetManager } = await import('../themePreset')
      const presets = themePresetManager.getPresets()
      expect(presets.length).toBeGreaterThan(0)
      expect(presets.some(p => p.isDefault)).toBe(true)
    })

    it('should load stored presets', async () => {
      mockStore['theme-presets'] = JSON.stringify([{ id: 'stored-1', name: 'Stored', mode: 'dark', createdAt: Date.now(), updatedAt: Date.now() }])
      const { themePresetManager } = await import('../themePreset')
      const presets = themePresetManager.getPresets()
      expect(presets.some(p => p.id === 'stored-1')).toBe(true)
    })

    it('should handle invalid stored data', async () => {
      mockStore['theme-presets'] = 'invalid-json'
      const { themePresetManager } = await import('../themePreset')
      const presets = themePresetManager.getPresets()
      expect(presets.length).toBeGreaterThan(0)
    })

    it('should load active preset from storage', async () => {
      mockStore['theme-presets'] = JSON.stringify([{ id: 'stored-1', name: 'Stored', mode: 'dark', createdAt: Date.now(), updatedAt: Date.now() }])
      mockStore['active-theme-preset'] = 'stored-1'
      const { themePresetManager } = await import('../themePreset')
      expect(themePresetManager.getActivePresetId()).toBe('stored-1')
    })

    it('should ignore invalid active preset id', async () => {
      mockStore['active-theme-preset'] = 'non-existent-id'
      const { themePresetManager } = await import('../themePreset')
      expect(themePresetManager.getActivePresetId()).toBeNull()
    })
  })

  describe('createPreset', () => {
    it('should create a new preset with correct properties', async () => {
      const { themePresetManager } = await import('../themePreset')
      const preset = themePresetManager.createPreset('Test Preset', 'dark')
      expect(preset.name).toBe('Test Preset')
      expect(preset.mode).toBe('dark')
      expect(preset.id).toBeDefined()
      expect(preset.createdAt).toBeDefined()
      expect(preset.isDefault).toBeFalsy()
    })

    it('should add preset to the list', async () => {
      const { themePresetManager } = await import('../themePreset')
      const initialCount = themePresetManager.getPresets().length
      themePresetManager.createPreset('New Preset', 'light')
      const newCount = themePresetManager.getPresets().length
      expect(newCount).toBe(initialCount + 1)
    })

    it('should create preset with custom colors', async () => {
      const { themePresetManager } = await import('../themePreset')
      const customColors = { primary: 'var(--color-primary)', success: 'var(--color-success)' }
      const preset = themePresetManager.createPreset('Colored', 'dark', customColors)
      expect(preset.customColors).toEqual(customColors)
    })

    it('should generate unique ids', async () => {
      const { themePresetManager } = await import('../themePreset')
      const preset1 = themePresetManager.createPreset('Preset 1', 'dark')
      await new Promise(r => setTimeout(r, 2))
      const preset2 = themePresetManager.createPreset('Preset 2', 'light')
      expect(preset1.id).not.toBe(preset2.id)
    })
  })

  describe('getPreset', () => {
    it('should return preset by id', async () => {
      const { themePresetManager } = await import('../themePreset')
      const preset = themePresetManager.createPreset('Find Me', 'dark')
      const found = themePresetManager.getPreset(preset.id)
      expect(found?.name).toBe('Find Me')
    })

    it('should return undefined for non-existent id', async () => {
      const { themePresetManager } = await import('../themePreset')
      const found = themePresetManager.getPreset('non-existent')
      expect(found).toBeUndefined()
    })
  })

  describe('updatePreset', () => {
    it('should update existing preset', async () => {
      const { themePresetManager } = await import('../themePreset')
      const preset = themePresetManager.createPreset('To Update', 'light')
      const updated = themePresetManager.updatePreset(preset.id, { name: 'Updated Name' })
      expect(updated?.name).toBe('Updated Name')
    })

    it('should not update default presets', async () => {
      const { themePresetManager } = await import('../themePreset')
      const presets = themePresetManager.getPresets()
      const defaultPreset = presets.find(p => p.isDefault)
      if (defaultPreset) {
        const result = themePresetManager.updatePreset(defaultPreset.id, { name: 'New Name' })
        expect(result).toBeUndefined()
      }
    })

    it('should return undefined for non-existent id', async () => {
      const { themePresetManager } = await import('../themePreset')
      const result = themePresetManager.updatePreset('non-existent', { name: 'Test' })
      expect(result).toBeUndefined()
    })

    it('should update custom colors', async () => {
      const { themePresetManager } = await import('../themePreset')
      const preset = themePresetManager.createPreset('Color Update', 'dark')
      const updated = themePresetManager.updatePreset(preset.id, { customColors: { primary: 'var(--el-text-color-primary)' } })
      expect(updated?.customColors?.primary).toBe('var(--el-text-color-primary)')
    })
  })

  describe('deletePreset', () => {
    it('should delete custom preset', async () => {
      const { themePresetManager } = await import('../themePreset')
      const preset = themePresetManager.createPreset('To Delete', 'dark')
      const result = themePresetManager.deletePreset(preset.id)
      expect(result).toBe(true)
    })

    it('should not delete default presets', async () => {
      const { themePresetManager } = await import('../themePreset')
      const presets = themePresetManager.getPresets()
      const defaultPreset = presets.find(p => p.isDefault)
      if (defaultPreset) {
        const result = themePresetManager.deletePreset(defaultPreset.id)
        expect(result).toBe(false)
      }
    })

    it('should return false for non-existent id', async () => {
      const { themePresetManager } = await import('../themePreset')
      const result = themePresetManager.deletePreset('non-existent')
      expect(result).toBe(false)
    })

    it('should clear active preset if deleted', async () => {
      const { themePresetManager } = await import('../themePreset')
      const preset = themePresetManager.createPreset('Active Delete', 'dark')
      themePresetManager.setActivePreset(preset.id)
      themePresetManager.deletePreset(preset.id)
      expect(themePresetManager.getActivePresetId()).toBeNull()
    })
  })

  describe('setActivePreset', () => {
    it('should set active preset', async () => {
      const { themePresetManager } = await import('../themePreset')
      const preset = themePresetManager.createPreset('Active Test', 'dark')
      const result = themePresetManager.setActivePreset(preset.id)
      expect(result).toBe(true)
      expect(themePresetManager.getActivePresetId()).toBe(preset.id)
    })

    it('should return false for non-existent id', async () => {
      const { themePresetManager } = await import('../themePreset')
      const result = themePresetManager.setActivePreset('non-existent')
      expect(result).toBe(false)
    })

    it('should set default preset as active', async () => {
      const { themePresetManager } = await import('../themePreset')
      const presets = themePresetManager.getPresets()
      const defaultPreset = presets.find(p => p.isDefault)
      if (defaultPreset) {
        const result = themePresetManager.setActivePreset(defaultPreset.id)
        expect(result).toBe(true)
      }
    })
  })

  describe('getActivePreset', () => {
    it('should return active preset', async () => {
      const { themePresetManager } = await import('../themePreset')
      const preset = themePresetManager.createPreset('Get Active', 'dark')
      themePresetManager.setActivePreset(preset.id)
      const active = themePresetManager.getActivePreset()
      expect(active?.id).toBe(preset.id)
    })

    it('should return undefined when no active preset', async () => {
      const { themePresetManager } = await import('../themePreset')
      themePresetManager.clearActivePreset()
      const active = themePresetManager.getActivePreset()
      expect(active).toBeUndefined()
    })
  })

  describe('clearActivePreset', () => {
    it('should clear active preset', async () => {
      const { themePresetManager } = await import('../themePreset')
      const preset = themePresetManager.createPreset('Clear Active', 'dark')
      themePresetManager.setActivePreset(preset.id)
      themePresetManager.clearActivePreset()
      expect(themePresetManager.getActivePresetId()).toBeNull()
    })
  })

  describe('exportPresets', () => {
    it('should export presets as JSON string', async () => {
      const { themePresetManager } = await import('../themePreset')
      const exported = themePresetManager.exportPresets()
      const parsed = JSON.parse(exported)
      expect(parsed.presets).toBeDefined()
      expect(parsed.activePresetId).toBeDefined()
    })

    it('should not export default presets', async () => {
      const { themePresetManager } = await import('../themePreset')
      const exported = themePresetManager.exportPresets()
      const parsed = JSON.parse(exported)
      expect(parsed.presets.every((p: ThemePreset) => !p.isDefault)).toBe(true)
    })
  })

  describe('importPresets', () => {
    it('should import valid presets', async () => {
      const { themePresetManager } = await import('../themePreset')
      const json = JSON.stringify({
        presets: [{
          id: 'imported-1',
          name: 'Imported Preset',
          mode: 'dark',
          createdAt: Date.now(),
          updatedAt: Date.now()
        }],
        activePresetId: null
      })
      const result = themePresetManager.importPresets(json)
      expect(result.success).toBe(true)
      expect(result.imported).toBeGreaterThan(0)
    })

    it('should fail on invalid format', async () => {
      const { themePresetManager } = await import('../themePreset')
      const result = themePresetManager.importPresets('invalid json')
      expect(result.success).toBe(false)
    })

    it('should fail when presets is not an array', async () => {
      const { themePresetManager } = await import('../themePreset')
      const json = JSON.stringify({ presets: 'not-array', activePresetId: null })
      const result = themePresetManager.importPresets(json)
      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid format')
    })

    it('should skip presets missing required fields', async () => {
      const { themePresetManager } = await import('../themePreset')
      const json = JSON.stringify({
        presets: [{ id: 'incomplete' }],
        activePresetId: null
      })
      const result = themePresetManager.importPresets(json)
      expect(result.imported).toBe(0)
    })

    it('should update existing presets', async () => {
      const { themePresetManager } = await import('../themePreset')
      const preset = themePresetManager.createPreset('Original', 'light')
      const json = JSON.stringify({
        presets: [{
          id: preset.id,
          name: 'Updated via Import',
          mode: 'dark',
          createdAt: preset.createdAt,
          updatedAt: Date.now()
        }],
        activePresetId: null
      })
      const result = themePresetManager.importPresets(json)
      expect(result.imported).toBe(1)
      const updated = themePresetManager.getPreset(preset.id)
      expect(updated?.name).toBe('Updated via Import')
    })

    it('should not update default presets on import', async () => {
      const { themePresetManager } = await import('../themePreset')
      const presets = themePresetManager.getPresets()
      const defaultPreset = presets.find(p => p.isDefault)
      if (defaultPreset) {
        const json = JSON.stringify({
          presets: [{
            id: defaultPreset.id,
            name: 'Try Update Default',
            mode: 'dark',
            createdAt: Date.now(),
            updatedAt: Date.now()
          }],
          activePresetId: null
        })
        const result = themePresetManager.importPresets(json)
        expect(result.imported).toBe(0)
      }
    })

    it('should set activePresetId from import', async () => {
      const { themePresetManager } = await import('../themePreset')
      const json = JSON.stringify({
        presets: [{
          id: 'active-import',
          name: 'Active Import',
          mode: 'dark',
          createdAt: Date.now(),
          updatedAt: Date.now()
        }],
        activePresetId: 'active-import'
      })
      const result = themePresetManager.importPresets(json)
      expect(result.success).toBe(true)
      expect(themePresetManager.getActivePresetId()).toBe('active-import')
    })

    it('should ignore invalid activePresetId from import', async () => {
      const { themePresetManager } = await import('../themePreset')
      const json = JSON.stringify({
        presets: [{
          id: 'import-1',
          name: 'Import',
          mode: 'dark',
          createdAt: Date.now(),
          updatedAt: Date.now()
        }],
        activePresetId: 'non-existent'
      })
      const result = themePresetManager.importPresets(json)
      expect(result.success).toBe(true)
    })
  })

  describe('duplicatePreset', () => {
    it('should create a copy of existing preset', async () => {
      const { themePresetManager } = await import('../themePreset')
      const preset = themePresetManager.createPreset('Original', 'light')
      const duplicate = themePresetManager.duplicatePreset(preset.id)
      expect(duplicate?.name).toContain('副本')
      expect(duplicate?.mode).toBe(preset.mode)
      expect(duplicate?.id).not.toBe(preset.id)
    })

    it('should return undefined for non-existent id', async () => {
      const { themePresetManager } = await import('../themePreset')
      const result = themePresetManager.duplicatePreset('non-existent')
      expect(result).toBeUndefined()
    })

    it('should duplicate preset with custom colors', async () => {
      const { themePresetManager } = await import('../themePreset')
      const preset = themePresetManager.createPreset('Colored', 'dark', { primary: 'var(--el-text-color-primary)' })
      const duplicate = themePresetManager.duplicatePreset(preset.id)
      expect(duplicate?.customColors?.primary).toBe('var(--el-text-color-primary)')
    })

    it('should duplicate default presets', async () => {
      const { themePresetManager } = await import('../themePreset')
      const presets = themePresetManager.getPresets()
      const defaultPreset = presets.find(p => p.isDefault)
      if (defaultPreset) {
        const duplicate = themePresetManager.duplicatePreset(defaultPreset.id)
        expect(duplicate?.name).toContain('副本')
        expect(duplicate?.isDefault).toBeFalsy()
      }
    })
  })

  describe('resetToDefaults', () => {
    it('should reset to default presets', async () => {
      const { themePresetManager } = await import('../themePreset')
      themePresetManager.createPreset('Custom', 'dark')
      themePresetManager.resetToDefaults()
      const presets = themePresetManager.getPresets()
      expect(presets.every(p => p.isDefault)).toBe(true)
    })

    it('should clear active preset', async () => {
      const { themePresetManager } = await import('../themePreset')
      const preset = themePresetManager.createPreset('Active', 'dark')
      themePresetManager.setActivePreset(preset.id)
      themePresetManager.resetToDefaults()
      expect(themePresetManager.getActivePresetId()).toBeNull()
    })
  })

  describe('subscribe', () => {
    it('should notify listeners on preset change', async () => {
      const { themePresetManager } = await import('../themePreset')
      const listener = vi.fn()
      themePresetManager.subscribe(listener)
      themePresetManager.createPreset('Notify Test', 'dark')
      expect(listener).toHaveBeenCalled()
    })

    it('should unsubscribe correctly', async () => {
      const { themePresetManager } = await import('../themePreset')
      const listener = vi.fn()
      const unsubscribe = themePresetManager.subscribe(listener)
      unsubscribe()
      themePresetManager.createPreset('No Notify', 'dark')
      expect(listener).not.toHaveBeenCalled()
    })

    it('should handle listener errors', async () => {
      const { themePresetManager } = await import('../themePreset')
      const errorListener = vi.fn().mockImplementation(() => { throw new Error('Listener error') })
      const normalListener = vi.fn()
      themePresetManager.subscribe(errorListener)
      themePresetManager.subscribe(normalListener)
      expect(() => themePresetManager.createPreset('Error Test', 'dark')).not.toThrow()
      expect(normalListener).toHaveBeenCalled()
    })
  })

  describe('server-side rendering', () => {
    it('should handle undefined window', async () => {
      const originalWindow = global.window
      Object.defineProperty(global, 'window', { value: undefined, writable: true })
      vi.resetModules()
      const { themePresetManager } = await import('../themePreset')
      const presets = themePresetManager.getPresets()
      expect(presets).toBeDefined()
      Object.defineProperty(global, 'window', { value: originalWindow, writable: true })
    })
  })
})
