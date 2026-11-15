// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 自定义外观预设 store(2026-11-15 v4 立)。
 *
 * 边界:
 *   - 内置预设是常量(见 lib/appearance-presets),不落盘;
 *   - 本 store 只存用户自己保存的预设,并按条目独立校验(坏条目丢弃,不整包失败);
 *   - 应用预设不经过本 store —— 由 UI 把 overrides 交给 appearance-settings.update(),
 *     避免出现"预设是第二套生效配置"的分叉。
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { sanitizeAppearanceConfig, type AppearanceConfig } from './appearance-settings'
import { createPersistConfig } from './persist-helpers'

export const APPEARANCE_PRESETS_STORAGE_KEY = 'ihui-appearance-presets'
export const CUSTOM_PRESET_LIMIT = 24
export const PRESET_NAME_MAX = 40
const PRESET_ID_MAX = 64

export interface CustomAppearancePreset {
  id: string
  name: string
  overrides: Partial<AppearanceConfig>
  createdAt: number
}

interface AppearancePresetsState {
  presets: CustomAppearancePreset[]
  /** 保存成功返回 id;名称/覆盖值无效或已达上限返回 null */
  addPreset: (name: string, overrides: Partial<AppearanceConfig>) => string | null
  removePreset: (id: string) => void
  clearPresets: () => void
  /** 导出深拷贝(云同步/导出文件用) */
  exportPresets: () => CustomAppearancePreset[]
  /** 整包替换(云同步/导入用);非数组直接拒绝,空数组表示"清空" */
  applyPresets: (raw: unknown) => boolean
}

function sanitizeName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const name = raw.trim().replace(/\s+/g, ' ').slice(0, PRESET_NAME_MAX)
  return name.length > 0 ? name : null
}

function sanitizeOverrides(raw: unknown): Partial<AppearanceConfig> | null {
  const overrides = sanitizeAppearanceConfig(raw)
  return Object.keys(overrides).length > 0 ? overrides : null
}

function sanitizePreset(raw: unknown): CustomAppearancePreset | null {
  if (typeof raw !== 'object' || raw === null) return null
  const input = raw as Record<string, unknown>
  const id = typeof input.id === 'string' ? input.id.trim().slice(0, PRESET_ID_MAX) : ''
  const name = sanitizeName(input.name)
  const overrides = sanitizeOverrides(input.overrides)
  if (!id || !name || !overrides) return null
  return {
    id,
    name,
    overrides,
    createdAt:
      typeof input.createdAt === 'number' && Number.isFinite(input.createdAt) && input.createdAt > 0
        ? input.createdAt
        : Date.now(),
  }
}

/** 逐条校验 + 去重 id + 上限截断;任何一层坏数据都不会让整包失败 */
export function sanitizePresetList(raw: unknown): CustomAppearancePreset[] {
  if (!Array.isArray(raw)) return []
  const out: CustomAppearancePreset[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    const preset = sanitizePreset(item)
    if (!preset || seen.has(preset.id)) continue
    seen.add(preset.id)
    out.push(preset)
    if (out.length >= CUSTOM_PRESET_LIMIT) break
  }
  return out
}

function newPresetId(): string {
  const cryptoApi = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
  if (typeof cryptoApi?.randomUUID === 'function') return cryptoApi.randomUUID()
  return `preset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export const useAppearancePresetsStore = create<AppearancePresetsState>()(
  persist(
    (set, get) => ({
      presets: [],

      addPreset: (name, overrides) => {
        const cleanName = sanitizeName(name)
        const cleanOverrides = sanitizeOverrides(overrides)
        if (!cleanName || !cleanOverrides) return null
        const current = get().presets
        if (current.length >= CUSTOM_PRESET_LIMIT) return null
        const preset: CustomAppearancePreset = {
          id: newPresetId(),
          name: cleanName,
          overrides: cleanOverrides,
          createdAt: Date.now(),
        }
        set({ presets: [...current, preset] })
        return preset.id
      },

      removePreset: (id) =>
        set((state) => ({ presets: state.presets.filter((preset) => preset.id !== id) })),

      clearPresets: () => set({ presets: [] }),

      exportPresets: () =>
        get().presets.map((preset) => ({
          ...preset,
          overrides: { ...preset.overrides },
        })),

      applyPresets: (raw) => {
        if (!Array.isArray(raw)) return false
        set({ presets: sanitizePresetList(raw) })
        return true
      },
    }),
    createPersistConfig<AppearancePresetsState>(
      APPEARANCE_PRESETS_STORAGE_KEY,
      (state) => ({ presets: state.presets }),
      undefined,
      undefined,
      (persistedState, currentState) => ({
        ...currentState,
        presets: sanitizePresetList((persistedState as { presets?: unknown } | null)?.presets),
      }),
    ),
  ),
)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
