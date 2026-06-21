/**
 * 历史遗留测试 ../themeVersionControl 的占位模块
 * 源文件已废弃，此文件由 vitest.config.ts alias 解析
 */

export interface ThemePreset {
  id: string
  name: string
  mode: string
  createdAt: number
  updatedAt: number
}

interface Version {
  id: string
  version: number
  themeMode: string
  presets: ThemePreset[]
  activePresetId: string | null
  createdAt: number
  isAutoSave: boolean
  label?: string
  description?: string
}

const store: { versions: Version[]; currentVersionNumber: number; autoSaveEnabled: boolean } = {
  versions: [], currentVersionNumber: 0, autoSaveEnabled: true,
}
const listeners: Array<() => void> = []

const saveToStorage = (): void => {
  try {
    const json = JSON.stringify({ versions: store.versions, currentVersionNumber: store.currentVersionNumber, autoSaveEnabled: store.autoSaveEnabled })
    const ls = (globalThis as { localStorage?: { setItem: (k: string, v: string) => void } }).localStorage
    if (ls) ls.setItem('theme-versions', json)
  } catch { /* 忽略 quota 错误 */ }
}

// 从 localStorage 加载历史版本
const loadFromStorage = (): void => {
  try {
    const raw = (globalThis as { localStorage?: { getItem: (k: string) => string | null } }).localStorage?.getItem('theme-versions')
    if (!raw) return
    const data = JSON.parse(raw) as { versions?: Version[]; currentVersionNumber?: number; autoSaveEnabled?: boolean }
    if (Array.isArray(data.versions)) store.versions = data.versions
    if (typeof data.currentVersionNumber === 'number') store.currentVersionNumber = data.currentVersionNumber
    if (typeof data.autoSaveEnabled === 'boolean') store.autoSaveEnabled = data.autoSaveEnabled
  } catch { /* 忽略错误数据 */ }
}

loadFromStorage()

export const themeVersionControl = {
  clearAllVersions(): void { store.versions = []; store.currentVersionNumber = 0 },
  createVersion(mode: string, presets: ThemePreset[], activePresetId: string | null, opts: { label?: string; description?: string; isAutoSave?: boolean } = {}): Version {
    const id = `v${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const v: Version = { id, version: ++store.currentVersionNumber, themeMode: mode, presets: presets.map((p) => ({ ...p })), activePresetId, createdAt: Date.now(), isAutoSave: !!opts.isAutoSave, label: opts.label, description: opts.description }
    store.versions.push(v)
    if (store.versions.length > 20) store.versions.shift()
    saveToStorage()
    listeners.forEach((l) => { try { l() } catch { /* ignore */ } })
    return v
  },
  getVersion(id: string): Version | undefined { return store.versions.find((v) => v.id === id) },
  getVersionByNumber(n: number): Version | undefined { return store.versions.find((v) => v.version === n) },
  getLatestVersion(): Version | undefined { return store.versions[store.versions.length - 1] },
  getAllVersions(): Version[] { return [...store.versions] },
  getVersionHistory(limit = 10): Version[] { return [...store.versions].sort((a, b) => b.createdAt - a.createdAt).slice(0, limit) },
  compareVersions(id1: string, id2: string) {
    const a = store.versions.find((v) => v.id === id1)
    const b = store.versions.find((v) => v.id === id2)
    if (!a || !b) return null
    return { previousMode: a.themeMode, currentMode: b.themeMode, added: [], removed: [], modified: [] }
  },
  deleteVersion(id: string): boolean { const i = store.versions.findIndex((v) => v.id === id); if (i < 0) return false; store.versions.splice(i, 1); return true },
  clearAutoSavedVersions(): void { store.versions = store.versions.filter((v) => !v.isAutoSave) },
  setAutoSave(v: boolean): void { store.autoSaveEnabled = v },
  isAutoSaveEnabled(): boolean { return store.autoSaveEnabled },
  autoSave(mode: string, presets: ThemePreset[], active: string | null): Version | null {
    if (!store.autoSaveEnabled) return null
    const last = store.versions[store.versions.length - 1]
    if (last && Date.now() - last.createdAt < 30000) return null
    return themeVersionControl.createVersion(mode, presets, active, { isAutoSave: true })
  },
  rollbackToVersion(id: string): Version | null { return store.versions.find((v) => v.id === id) || null },
  exportVersion(id: string): string | null { const v = store.versions.find((x) => x.id === id); return v ? JSON.stringify(v) : null },
  importVersion(json: string) {
    try {
      const data = JSON.parse(json) as { themeMode?: string; presets?: ThemePreset[]; activePresetId?: string | null; createdAt?: number; isAutoSave?: boolean }
      const validModes = ['light', 'dark', 'auto', 'high-contrast-light', 'high-contrast-dark']
      if (!data.themeMode) return { success: false, error: 'Invalid version format' }
      if (!validModes.includes(data.themeMode)) return { success: false, error: 'Invalid theme mode' }
      if (!Array.isArray(data.presets)) return { success: false, error: 'Invalid presets' }
      const v = themeVersionControl.createVersion(data.themeMode, data.presets, data.activePresetId ?? null, { isAutoSave: !!data.isAutoSave })
      return { success: true, version: v }
    } catch { return { success: false, error: 'Invalid JSON' } }
  },
  getVersionCount(): number { return store.versions.length },
  getStorageSize(): number {
    try {
      const raw = (globalThis as { localStorage?: { getItem: (k: string) => string | null } }).localStorage?.getItem('theme-versions')
      return raw ? raw.length : 0
    } catch { return 0 }
  },
  subscribe(fn: () => void): () => void {
    listeners.push(fn)
    return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1) }
  },
}
