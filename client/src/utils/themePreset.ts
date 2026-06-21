import type { ThemeMode } from '@/stores/darkMode'

export interface ThemePreset {
  id: string
  name: string
  mode: ThemeMode
  customColors?: {
    primary?: string
    success?: string
    warning?: string
    danger?: string
    info?: string
  }
  createdAt: number
  updatedAt: number
  isDefault?: boolean
}

export interface ThemePresetConfig {
  presets: ThemePreset[]
  activePresetId: string | null
}

const STORAGE_KEY = 'theme-presets'
const ACTIVE_PRESET_KEY = 'active-theme-preset'

const DEFAULT_PRESETS: ThemePreset[] = [
  {
    id: 'default-light',
    name: '默认亮色',
    mode: 'light',
    isDefault: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    id: 'default-dark',
    name: '默认暗色',
    mode: 'dark',
    isDefault: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    id: 'default-auto',
    name: '跟随系统',
    mode: 'auto',
    isDefault: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    id: 'default-hc-light',
    name: '高对比度亮色',
    mode: 'high-contrast-light',
    isDefault: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    id: 'default-hc-dark',
    name: '高对比度暗色',
    mode: 'high-contrast-dark',
    isDefault: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
]

class ThemePresetManager {
  private presets: ThemePreset[] = []
  private activePresetId: string | null = null
  private listeners: Set<(presets: ThemePreset[], activeId: string | null) => void> = new Set()

  constructor() {
    this.loadPresets()
  }

  private loadPresets(): void {
    if (typeof window === 'undefined') return

    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        this.presets = [...DEFAULT_PRESETS, ...parsed.filter((p: ThemePreset) => !p.isDefault)]
      } else {
        this.presets = [...DEFAULT_PRESETS]
      }

      const activeId = localStorage.getItem(ACTIVE_PRESET_KEY)
      if (activeId && this.presets.find(p => p.id === activeId)) {
        this.activePresetId = activeId
      }
    } catch {
      this.presets = [...DEFAULT_PRESETS]
    }
  }

  private savePresets(): void {
    if (typeof window === 'undefined') return

    try {
      const customPresets = this.presets.filter(p => !p.isDefault)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(customPresets))
      if (this.activePresetId) {
        localStorage.setItem(ACTIVE_PRESET_KEY, this.activePresetId)
      }
    } catch {
      // Ignore storage quota exceeded
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener([...this.presets], this.activePresetId)
      } catch {
        // Ignore listener errors
      }
    })
  }

  subscribe(listener: (presets: ThemePreset[], activeId: string | null) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getPresets(): ThemePreset[] {
    return [...this.presets]
  }

  getPreset(id: string): ThemePreset | undefined {
    return this.presets.find(p => p.id === id)
  }

  getActivePreset(): ThemePreset | undefined {
    if (!this.activePresetId) return undefined
    return this.presets.find(p => p.id === this.activePresetId)
  }

  getActivePresetId(): string | null {
    return this.activePresetId
  }

  createPreset(name: string, mode: ThemeMode, customColors?: ThemePreset['customColors']): ThemePreset {
    const preset: ThemePreset = {
      id: `preset-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      name,
      mode,
      customColors,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    this.presets.push(preset)
    this.savePresets()
    this.notifyListeners()

    return preset
  }

  updatePreset(id: string, updates: Partial<Omit<ThemePreset, 'id' | 'createdAt' | 'isDefault'>>): ThemePreset | undefined {
    const index = this.presets.findIndex(p => p.id === id)
    if (index === -1) return undefined

    const preset = this.presets[index]
    if (preset.isDefault) return undefined

    this.presets[index] = {
      ...preset,
      ...updates,
      updatedAt: Date.now()
    }

    this.savePresets()
    this.notifyListeners()

    return this.presets[index]
  }

  deletePreset(id: string): boolean {
    const index = this.presets.findIndex(p => p.id === id)
    if (index === -1) return false

    const preset = this.presets[index]
    if (preset.isDefault) return false

    this.presets.splice(index, 1)

    if (this.activePresetId === id) {
      this.activePresetId = null
    }

    this.savePresets()
    this.notifyListeners()

    return true
  }

  setActivePreset(id: string): boolean {
    const preset = this.presets.find(p => p.id === id)
    if (!preset) return false

    this.activePresetId = id
    this.savePresets()
    this.notifyListeners()

    return true
  }

  clearActivePreset(): void {
    this.activePresetId = null
    localStorage.removeItem(ACTIVE_PRESET_KEY)
    this.notifyListeners()
  }

  exportPresets(): string {
    const config: ThemePresetConfig = {
      presets: this.presets.filter(p => !p.isDefault),
      activePresetId: this.activePresetId
    }
    return JSON.stringify(config, null, 2)
  }

  importPresets(json: string): { success: boolean; imported: number; error?: string } {
    try {
      const config = JSON.parse(json) as ThemePresetConfig

      if (!Array.isArray(config.presets)) {
        return { success: false, imported: 0, error: 'Invalid format: presets must be an array' }
      }

      let imported = 0
      for (const preset of config.presets) {
        if (!preset.id || !preset.name || !preset.mode) continue

        const existing = this.presets.find(p => p.id === preset.id)
        if (existing) {
          if (!existing.isDefault) {
            Object.assign(existing, {
              ...preset,
              updatedAt: Date.now()
            })
            imported++
          }
        } else {
          this.presets.push({
            ...preset,
            isDefault: false,
            createdAt: preset.createdAt || Date.now(),
            updatedAt: Date.now()
          })
          imported++
        }
      }

      if (config.activePresetId && this.presets.find(p => p.id === config.activePresetId)) {
        this.activePresetId = config.activePresetId
      }

      this.savePresets()
      this.notifyListeners()

      return { success: true, imported }
    } catch (e) {
      return { success: false, imported: 0, error: String(e) }
    }
  }

  duplicatePreset(id: string): ThemePreset | undefined {
    const preset = this.presets.find(p => p.id === id)
    if (!preset) return undefined

    return this.createPreset(
      `${preset.name} (副本)`,
      preset.mode,
      preset.customColors ? { ...preset.customColors } : undefined
    )
  }

  resetToDefaults(): void {
    this.presets = [...DEFAULT_PRESETS]
    this.activePresetId = null
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(ACTIVE_PRESET_KEY)
    this.notifyListeners()
  }
}

export const themePresetManager = new ThemePresetManager()
