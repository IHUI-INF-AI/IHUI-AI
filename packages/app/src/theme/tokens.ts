/**
 * packages/app 共享设计令牌。
 * 跨端共享组件统一引用此文件,根治颜色漂移 + 为暗色模式铺路。
 * mobile-rn 端可 re-export 或同步引用,确保品牌色一致。
 */
export const tokens = {
  brand: {
    DEFAULT: '#10B981',
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
} as const

export type AppTokens = typeof tokens
