/**
 * @ihui/design-tokens mock for vitest/jsdom environment
 *
 * 绕过 esbuild 对 source 文件中 `export type RnTokens = typeof rnTokens` 的
 * TypeScript typeof 类型操作符解析失败问题。
 */

// ── RN tokens 数据（直接从源码复制，避免运行时引入 design-tokens）──

export const rnTokens = {
  brand: {
    DEFAULT: '#000000',
    dark: '#34D399',
  },
  surface: {
    light: '#FFFFFF',
    muted: '#F9FAFB',
    card: '#F3F4F6',
    dark: '#1F2937',
  },
  text: {
    primary: '#111827',
    secondary: '#6B7280',
    tertiary: '#9CA3AF',
    medium: '#374151',
  },
  border: {
    light: '#E5E7EB',
    medium: '#D1D5DB',
  },
  error: {
    bg: '#FEE2E2',
    text: '#B91C1C',
  },
  overlay: {
    modal: 'rgba(0,0,0,0.4)',
  },
  indigo: {
    light: '#eef2ff',
    DEFAULT: '#6366f1',
    deep: '#4f46e5',
  },
  purple: {
    light: '#f5f3ff',
    DEFAULT: '#7B61FF',
  },
  warning: {
    light: '#fffbeb',
    amberLight: '#fef3c7',
    orangeLight: '#fff7ed',
    amber: '#f59e0b',
    DEFAULT: '#d97706',
    amberText: '#92400e',
    deep: '#FF6B00',
  },
  success: {
    lightest: '#f0fdf4',
    lighter: '#d1fae5',
    light: '#ecfdf5',
    DEFAULT: '#10B981',
    deep: '#16a34a',
    deepText: '#065F46',
  },
  danger: {
    light: '#fef2f2',
    DEFAULT: '#dc2626',
    bright: '#ef4444',
  },
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
    black: '#000',
  },
} as const

export const rnLightTokens = {
  brand: { DEFAULT: '#000000', dark: '#34D399' },
  surface: { bg: '#FFFFFF', light: '#FFFFFF', muted: '#F9FAFB', card: '#F3F4F6', dark: '#1F2937' },
  text: { primary: '#111827', secondary: '#6B7280', tertiary: '#9CA3AF', medium: '#374151' },
  border: { light: '#E5E7EB', medium: '#D1D5DB' },
  error: { bg: '#FEE2E2', text: '#B91C1C' },
  overlay: { modal: 'rgba(0,0,0,0.4)' },
  indigo: { light: '#eef2ff', DEFAULT: '#6366f1', deep: '#4f46e5' },
  purple: { light: '#f5f3ff', DEFAULT: '#7B61FF' },
  warning: {
    light: '#fffbeb',
    amberLight: '#fef3c7',
    orangeLight: '#fff7ed',
    amber: '#f59e0b',
    DEFAULT: '#d97706',
    amberText: '#92400e',
    deep: '#FF6B00',
  },
  success: {
    lightest: '#f0fdf4',
    lighter: '#d1fae5',
    light: '#ecfdf5',
    DEFAULT: '#10B981',
    deep: '#16a34a',
    deepText: '#065F46',
  },
  danger: { light: '#fef2f2', DEFAULT: '#dc2626', bright: '#ef4444' },
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
    black: '#000',
  },
}

export const rnDarkTokens = {
  brand: { DEFAULT: '#FFFFFF', dark: '#34D399' },
  surface: { bg: '#1F2937', light: '#FFFFFF', muted: '#111827', card: '#374151', dark: '#0F172A' },
  text: { primary: '#F9FAFB', secondary: '#9CA3AF', tertiary: '#6B7280', medium: '#D1D5DB' },
  border: { light: '#374151', medium: '#4B5563' },
  error: { bg: '#7F1D1D', text: '#FCA5A5' },
  overlay: { modal: 'rgba(0,0,0,0.6)' },
  indigo: { light: '#312e81', DEFAULT: '#6366f1', deep: '#818cf8' },
  purple: { light: '#4c1d95', DEFAULT: '#7B61FF' },
  warning: {
    light: '#451a03',
    amberLight: '#78350f',
    orangeLight: '#431407',
    amber: '#fbbf24',
    DEFAULT: '#f59e0b',
    amberText: '#fbbf24',
    deep: '#FF6B00',
  },
  success: {
    lightest: '#052e16',
    lighter: '#064e3b',
    light: '#052e16',
    DEFAULT: '#10B981',
    deep: '#16a34a',
    deepText: '#86efac',
  },
  danger: { light: '#450a0a', DEFAULT: '#ef4444', bright: '#f87171' },
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
    black: '#000',
  },
}

export function getRnTokens(theme: 'light' | 'dark') {
  return theme === 'dark' ? rnDarkTokens : rnLightTokens
}

// ── 类型定义（用显式接口替代 typeof 语法，避免 esbuild 解析失败）──

export type RnTokens = {
  brand: { DEFAULT: string; dark: string }
  surface: { light: string; muted: string; card: string; dark: string }
  text: { primary: string; secondary: string; tertiary: string; medium: string }
  border: { light: string; medium: string }
  error: { bg: string; text: string }
  overlay: { modal: string }
  indigo: { light: string; DEFAULT: string; deep: string }
  purple: { light: string; DEFAULT: string }
  warning: RnWarningTokens
  success: RnSuccessTokens
  danger: RnDangerTokens
  gray: { [k: string]: string }
}
export type RnThemeMode = 'light' | 'dark'
export type RnThemeTokens = {
  brand: { DEFAULT: string; dark: string }
  surface: { bg: string; light: string; muted: string; card: string; dark: string }
  text: { primary: string; secondary: string; tertiary: string; medium: string }
  border: { light: string; medium: string }
  error: { bg: string; text: string }
  overlay: { modal: string }
  indigo: { light: string; DEFAULT: string; deep: string }
  purple: { light: string; DEFAULT: string }
  warning: RnWarningTokens
  success: RnSuccessTokens
  danger: RnDangerTokens
  gray: { [k: string]: string }
}

export type RnSuccessTokens = {
  lightest: string
  lighter: string
  light: string
  DEFAULT: string
  deep: string
  deepText: string
}

export type RnWarningTokens = {
  light: string
  amberLight: string
  orangeLight: string
  amber: string
  DEFAULT: string
  amberText: string
  deep: string
}

export type RnDangerTokens = {
  light: string
  DEFAULT: string
  bright: string
}

// ── token-registry 导出（mock 最小实现，测试不需要完整注册表）──

export const TOKEN_REGISTRY: Record<string, { name: string; type: string; defaultValue: string }> =
  {}
export const TOKEN_NAMES: string[] = []
export const TOKEN_COUNT = 0

export function validateTokenConsistency(): {
  consistent: boolean
  missingInCss: string[]
  valueMismatches: never[]
} {
  return { consistent: true, missingInCss: [], valueMismatches: [] }
}

export function listMissingTokens(_cssContent: string): string[] {
  return []
}

export function extractCssVars(_content: string): Map<string, string> {
  return new Map()
}

// ── component-props 导出 ──

export interface VipBadgeBaseProps {
  size?: 'sm' | 'md'
  label?: string
}

export type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'

export interface BadgeBaseProps {
  variant?: BadgeVariant
}

export type ButtonBaseVariant = 'default' | 'destructive' | 'outline' | 'ghost'

export type ButtonBaseSize = 'sm' | 'lg'

export interface ButtonBaseProps {
  variant?: ButtonBaseVariant
  size?: ButtonBaseSize
}

// ── cn 工具函数 ──

export function cn(...classes: Array<string | boolean | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}
