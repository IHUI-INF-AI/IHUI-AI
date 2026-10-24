// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { CSSProperties } from 'react'
import { View, Text } from '@tarojs/components'
import './ScreenStates.taro.css'

/**
 * ScreenStates 小程序(Taro)镜像件 —— 对齐 RN 端 packages/app/src/components/ScreenStates.tsx。
 *
 * 换算口径(与仓内既有镜像页一致,见 pkg-content/activity/index.tsx 头注):
 *   RN raw dp × 2 = rpx(750 设计稿基准)。
 * 取档一律走 packages/design-tokens 的**同一份档位表**,不在本文件里重写数值:
 *   rnSpacing{lg:16,md:12,sm:8} → 32/24/16 rpx;rnRadius{lg:8,md:6,sm:4} → 16/12/8 rpx。
 * 颜色一律引用 app.css 语义变量(暗色经 ThemeRoot .dark 自动适配),与 RN tk.* 一一映射。
 *
 * 平台差异如实登记:**触感(haptics)在小程序端无对应能力**,故不提供该 prop;
 * 其余三件(骨架/空态/错误态)与 RN 端同结构、同档位、同文案键。
 */

const toRpx = (px: number): string => `${px * 2}rpx`

type Scheme = 'light' | 'dark'

/* ────────────── 档位常量:Rpackage/design-tokens 的档位表在此落地为 rpx ────────────── */
const SP = { lg: 16, md: 12, sm: 8 } as const // rnSpacing
const RD = { lg: 8, md: 6, sm: 4 } as const // rnRadius

const blockBase = (): CSSProperties => ({
  backgroundColor: 'var(--color-muted)',
  borderRadius: toRpx(RD.sm),
})

/* ────────────────────────── 1. 骨架屏 ────────────────────────── */

export interface ScreenSkeletonProps {
  variant?: 'list' | 'card' | 'grid'
  count?: number
  colorScheme?: Scheme
}

export function ScreenSkeleton({
  variant = 'list',
  count = 4,
  colorScheme = 'light',
}: ScreenSkeletonProps) {
  const blocks = Array.from({ length: Math.max(1, count) }, (_, i) => i)
  const key = `sk-${variant}-${colorScheme}`

  if (variant === 'grid') {
    return (
      <View className="ihui-sk-wrap" style={{ padding: toRpx(SP.lg), gap: toRpx(SP.md) }}>
        <View
          style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: toRpx(SP.md) }}
        >
          {blocks.map((i) => (
            <View
              key={`${key}-${i}`}
              style={{ width: '47%', display: 'flex', flexDirection: 'column', gap: toRpx(SP.sm) }}
            >
              <View
                className="ihui-sk-shimmer"
                style={{
                  ...blockBase(),
                  height: toRpx(92),
                  width: '100%',
                  borderRadius: toRpx(RD.md),
                }}
              />
              <View
                className="ihui-sk-shimmer"
                style={{ ...blockBase(), height: toRpx(10), width: '70%' }}
              />
            </View>
          ))}
        </View>
      </View>
    )
  }

  return (
    <View className="ihui-sk-wrap" style={{ padding: toRpx(SP.lg), gap: toRpx(SP.md) }}>
      {blocks.map((i) => (
        <View
          key={`${key}-${i}`}
          className={variant === 'card' ? 'ihui-sk-card' : 'ihui-sk-row'}
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: variant === 'card' ? 'flex-start' : 'center',
            gap: toRpx(SP.md),
            padding: variant === 'card' ? toRpx(SP.lg) : toRpx(SP.md + 2),
            borderRadius: toRpx(RD.lg),
            border: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-card)',
          }}
        >
          <View
            className="ihui-sk-shimmer"
            style={{
              width: toRpx(44),
              height: toRpx(44),
              borderRadius: toRpx(RD.md),
              ...blockBase(),
            }}
          />
          <View style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: toRpx(SP.sm) }}>
            <View
              className="ihui-sk-shimmer"
              style={{ ...blockBase(), height: toRpx(12), width: '80%' }}
            />
            <View
              className="ihui-sk-shimmer"
              style={{ ...blockBase(), height: toRpx(10), width: '50%' }}
            />
          </View>
        </View>
      ))}
    </View>
  )
}

/* ────────────────────────── 2. 空状态 ────────────────────────── */

export interface EmptyStateProps {
  glyph?: string
  title: string
  desc?: string
  actionLabel?: string
  onAction?: () => void
  colorScheme?: Scheme
}

export function EmptyState({
  glyph = '◍',
  title,
  desc,
  actionLabel,
  onAction,
  colorScheme = 'light',
}: EmptyStateProps) {
  return (
    <View className={`ihui-state ${colorScheme === 'dark' ? 'ihui-state-dark' : ''}`}>
      <View className="ihui-state-glyph-circle">
        <Text className="ihui-state-glyph">{glyph}</Text>
      </View>
      <Text className="ihui-state-title">{title}</Text>
      {desc ? <Text className="ihui-state-desc">{desc}</Text> : null}
      {actionLabel && onAction ? (
        <View className="ihui-state-btn" onClick={onAction}>
          <Text className="ihui-state-btn-text">{actionLabel}</Text>
        </View>
      ) : null}
    </View>
  )
}

/* ────────────────────── 3. 错误态 + 重试 ────────────────────── */

export interface ErrorStateProps {
  message: string
  onRetry?: () => void
  retryLabel?: string
  colorScheme?: Scheme
}

export function ErrorState({
  message,
  onRetry,
  retryLabel = '重试',
  colorScheme = 'light',
}: ErrorStateProps) {
  return (
    <View className={`ihui-state ${colorScheme === 'dark' ? 'ihui-state-dark' : ''}`}>
      <View className="ihui-state-glyph-circle">
        <Text className="ihui-state-glyph">!</Text>
      </View>
      <Text className="ihui-state-title">{message}</Text>
      {onRetry ? (
        <View className="ihui-state-btn" onClick={onRetry}>
          <Text className="ihui-state-btn-text">{retryLabel}</Text>
        </View>
      ) : null}
    </View>
  )
}

/* ────────────────── 4. 按压卡片(小程序端无触感能力,故无 haptics prop) ────────────────── */

export interface PressableCardProps {
  children?: unknown
  onClick?: () => void
  colorScheme?: Scheme
  style?: CSSProperties
  className?: string
}

export function PressableCard({
  children,
  onClick,
  colorScheme = 'light',
  style,
  className,
}: PressableCardProps) {
  return (
    <View
      className={`ihui-press-card ${colorScheme === 'dark' ? 'ihui-press-card-dark' : ''} ${className ?? ''}`}
      onClick={onClick}
      style={style}
    >
      {children as never}
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
