// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 外观作用域 store(2026-11-15 v3 立):工作区覆盖 / 单条消息覆盖 / 云同步状态。
 *
 * 为什么独立于 appearance-settings:
 *   - 全局配置是"一个用户一份",会被导出/导入、参与 AI 风格指令;
 *   - 作用域覆盖是"按 key 多份",体积随工作区与消息增长,不适合塞进同一份配置对象;
 *   - 两者都会被云同步打包,但各自有独立的持久化键,互不污染。
 *
 * 优先级:全局外观 < 工作区覆盖 < 单条消息覆盖。
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import {
  APPEARANCE_DEFAULTS,
  sanitizeAppearanceConfig,
  type AppearanceConfig,
  type FontFamilyMode,
  type LetterSpacingMode,
  type LineHeightMode,
  type TextAlignMode,
} from './appearance-settings'
import { FONT_STACKS, LETTER_SPACINGS, LINE_HEIGHTS } from '@/lib/appearance-tokens'
import { createPersistConfig } from './persist-helpers'

/** 单条消息的展示覆盖;缺省 = 继承上级作用域 */
export interface MessageStyleOverride {
  fontScale?: number
  fontFamily?: 'inherit' | FontFamilyMode | 'legibility'
  lineHeight?: 'inherit' | LineHeightMode
  letterSpacing?: 'inherit' | LetterSpacingMode
  textAlign?: 'inherit' | TextAlignMode
  codeFontSize?: number
}

export interface WorkspaceAppearanceOverride {
  enabled: boolean
  config: AppearanceConfig
}

export interface AppearanceScopeSnapshot {
  version: 1
  workspaces: Record<string, WorkspaceAppearanceOverride>
  messages: Record<string, MessageStyleOverride>
  cloudSyncEnabled: boolean
  lastSyncedAt: number
}

export type AppearanceSyncState = 'idle' | 'syncing' | 'synced' | 'error'

export const MESSAGE_OVERRIDE_LIMIT = 1000
export const MESSAGE_FONT_SCALE_MIN = 0.7
export const MESSAGE_FONT_SCALE_MAX = 1.6
export const MESSAGE_CODE_FONT_SIZE_MIN = 11
export const MESSAGE_CODE_FONT_SIZE_MAX = 22

interface AppearanceScopeState {
  workspaces: Record<string, WorkspaceAppearanceOverride>
  messages: Record<string, MessageStyleOverride>
  cloudSyncEnabled: boolean
  lastSyncedAt: number
  syncState: AppearanceSyncState
  setWorkspaceConfig: (path: string, config: AppearanceConfig) => void
  setWorkspaceEnabled: (path: string, enabled: boolean) => void
  clearWorkspace: (path: string) => void
  setMessageOverride: (messageId: string, patch: MessageStyleOverride) => void
  clearMessageField: (messageId: string, field: keyof MessageStyleOverride) => void
  clearMessageOverride: (messageId: string) => void
  clearAllMessageOverrides: () => void
  resetScope: () => void
  setCloudSyncEnabled: (enabled: boolean) => void
  setSyncState: (state: AppearanceSyncState) => void
  setLastSyncedAt: (timestamp: number) => void
  exportSnapshot: () => AppearanceScopeSnapshot
  applySnapshot: (snapshot: unknown) => boolean
}

const FONT_FAMILIES: readonly MessageStyleOverride['fontFamily'][] = [
  'inherit',
  'system',
  'sans',
  'serif',
  'mono',
  'legibility',
]
const LINE_HEIGHT_MODES: readonly MessageStyleOverride['lineHeight'][] = [
  'inherit',
  'compact',
  'normal',
  'relaxed',
]
const LETTER_SPACING_MODES: readonly MessageStyleOverride['letterSpacing'][] = [
  'inherit',
  'tight',
  'normal',
  'wide',
]
const TEXT_ALIGN_MODES: readonly MessageStyleOverride['textAlign'][] = [
  'inherit',
  'left',
  'justify',
]

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function sanitizeMessageOverride(raw: unknown): MessageStyleOverride | null {
  if (typeof raw !== 'object' || raw === null) return null
  const input = raw as Record<string, unknown>
  const out: MessageStyleOverride = {}
  if (typeof input.fontScale === 'number' && Number.isFinite(input.fontScale)) {
    out.fontScale =
      Math.round(clamp(input.fontScale, MESSAGE_FONT_SCALE_MIN, MESSAGE_FONT_SCALE_MAX) * 100) / 100
  }
  if (typeof input.codeFontSize === 'number' && Number.isFinite(input.codeFontSize)) {
    out.codeFontSize = Math.round(
      clamp(input.codeFontSize, MESSAGE_CODE_FONT_SIZE_MIN, MESSAGE_CODE_FONT_SIZE_MAX),
    )
  }
  if (FONT_FAMILIES.includes(input.fontFamily as never)) {
    out.fontFamily = input.fontFamily as MessageStyleOverride['fontFamily']
  }
  if (LINE_HEIGHT_MODES.includes(input.lineHeight as never)) {
    out.lineHeight = input.lineHeight as MessageStyleOverride['lineHeight']
  }
  if (LETTER_SPACING_MODES.includes(input.letterSpacing as never)) {
    out.letterSpacing = input.letterSpacing as MessageStyleOverride['letterSpacing']
  }
  if (TEXT_ALIGN_MODES.includes(input.textAlign as never)) {
    out.textAlign = input.textAlign as MessageStyleOverride['textAlign']
  }
  return Object.keys(out).length > 0 ? out : null
}

/**
 * 把单条消息覆盖编译成 CSS 变量。
 * 只产生"消息级增量变量",全局值仍由 AppearanceProvider 提供 —— 回退链在 CSS 里完成。
 */
export function messageStyleVars(override?: MessageStyleOverride): Record<string, string> {
  if (!override) return {}
  const vars: Record<string, string> = {}
  if (override.fontScale) vars['--message-font-multiplier'] = String(override.fontScale)
  if (override.fontFamily && override.fontFamily !== 'inherit') {
    vars['--message-font-family'] =
      override.fontFamily === 'legibility'
        ? FONT_STACKS.legibility
        : override.fontFamily === 'system'
          ? 'inherit'
          : FONT_STACKS[override.fontFamily]
  }
  if (override.lineHeight && override.lineHeight !== 'inherit') {
    vars['--message-line-height'] = LINE_HEIGHTS[override.lineHeight]
  }
  if (override.letterSpacing && override.letterSpacing !== 'inherit') {
    vars['--message-letter-spacing'] = LETTER_SPACINGS[override.letterSpacing]
  }
  if (override.textAlign && override.textAlign !== 'inherit') {
    vars['--message-text-align'] = override.textAlign
  }
  if (override.codeFontSize) vars['--message-code-font-size'] = `${override.codeFontSize}px`
  return vars
}

export const useAppearanceScopeStore = create<AppearanceScopeState>()(
  persist(
    (set, get) => ({
      workspaces: {},
      messages: {},
      cloudSyncEnabled: false,
      lastSyncedAt: 0,
      syncState: 'idle',

      setWorkspaceConfig: (path, config) =>
        set((state) => ({
          workspaces: {
            ...state.workspaces,
            [path]: { enabled: true, config: { ...config } },
          },
        })),

      setWorkspaceEnabled: (path, enabled) =>
        set((state) => {
          const current = state.workspaces[path]
          if (!current) {
            if (!enabled) return state
            return {
              workspaces: {
                ...state.workspaces,
                [path]: { enabled: true, config: { ...APPEARANCE_DEFAULTS } },
              },
            }
          }
          return {
            workspaces: { ...state.workspaces, [path]: { ...current, enabled } },
          }
        }),

      clearWorkspace: (path) =>
        set((state) => {
          if (!(path in state.workspaces)) return state
          const next = { ...state.workspaces }
          delete next[path]
          return { workspaces: next }
        }),

      setMessageOverride: (messageId, patch) =>
        set((state) => {
          const sanitized = sanitizeMessageOverride(patch)
          if (!sanitized) return state
          const existing = state.messages[messageId] ?? {}
          const merged = { ...existing, ...sanitized }
          const messages = { ...state.messages, [messageId]: merged }
          const keys = Object.keys(messages)
          if (keys.length > MESSAGE_OVERRIDE_LIMIT) {
            // 插入序近似 LRU:超限时丢弃最早的一条,避免 localStorage 无界增长
            for (const key of keys.slice(0, keys.length - MESSAGE_OVERRIDE_LIMIT)) {
              delete messages[key]
            }
          }
          return { messages }
        }),

      clearMessageOverride: (messageId) =>
        set((state) => {
          if (!(messageId in state.messages)) return state
          const messages = { ...state.messages }
          delete messages[messageId]
          return { messages }
        }),

      clearMessageField: (messageId, field) =>
        set((state) => {
          const current = state.messages[messageId]
          if (!current || !(field in current)) return state
          const next = { ...current }
          delete next[field]
          const messages = { ...state.messages }
          if (Object.keys(next).length === 0) delete messages[messageId]
          else messages[messageId] = next
          return { messages }
        }),

      clearAllMessageOverrides: () => set({ messages: {} }),
      resetScope: () => set({ workspaces: {}, messages: {} }),

      setCloudSyncEnabled: (cloudSyncEnabled) => set({ cloudSyncEnabled }),
      setSyncState: (syncState) => set({ syncState }),
      setLastSyncedAt: (lastSyncedAt) => set({ lastSyncedAt }),

      exportSnapshot: () => {
        const state = get()
        return {
          version: 1,
          workspaces: state.workspaces,
          messages: state.messages,
          cloudSyncEnabled: state.cloudSyncEnabled,
          lastSyncedAt: state.lastSyncedAt,
        }
      },

      applySnapshot: (snapshot) => {
        if (typeof snapshot !== 'object' || snapshot === null) return false
        const input = snapshot as Record<string, unknown>
        if (input.version !== 1) return false

        const workspaces: Record<string, WorkspaceAppearanceOverride> = {}
        if (typeof input.workspaces === 'object' && input.workspaces !== null) {
          for (const [path, value] of Object.entries(input.workspaces)) {
            if (typeof value !== 'object' || value === null) continue
            const entry = value as Record<string, unknown>
            const sanitized = sanitizeAppearanceConfig(entry.config)
            workspaces[path] = {
              enabled: entry.enabled === true,
              config: { ...APPEARANCE_DEFAULTS, ...sanitized },
            }
          }
        }

        const messages: Record<string, MessageStyleOverride> = {}
        if (typeof input.messages === 'object' && input.messages !== null) {
          let count = 0
          for (const [messageId, value] of Object.entries(input.messages)) {
            if (count >= MESSAGE_OVERRIDE_LIMIT) break
            const sanitized = sanitizeMessageOverride(value)
            if (!sanitized) continue
            messages[messageId] = sanitized
            count += 1
          }
        }

        set({
          workspaces,
          messages,
          cloudSyncEnabled: input.cloudSyncEnabled === true,
          lastSyncedAt:
            typeof input.lastSyncedAt === 'number' && Number.isFinite(input.lastSyncedAt)
              ? input.lastSyncedAt
              : 0,
        })
        return true
      },
    }),
    createPersistConfig<AppearanceScopeState>('ihui-appearance-scope'),
  ),
)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
