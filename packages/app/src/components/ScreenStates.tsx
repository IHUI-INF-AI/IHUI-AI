// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { rnRadius } from '@ihui/design-tokens'
import { Circle } from 'lucide-react-native'

import { useEffect, useMemo, useRef } from 'react'
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native'
import { getTokens, type AppThemeTokens } from '../theme/tokens'

/**
 * 屏幕状态四件套 —— 「细化美化」的共享底座。
 *
 * 为什么集中在这一个文件:共享层 210 个 Screen 此前**没有**骨架屏(实测 1/210)、
 * 空态几乎全缺(1/210)、错误态只有一行红字且无重试、卡片无按压反馈。这四格是
 * 全端观感最粗糙的共性缺口,且都属于「屏幕级状态」语义内聚,故合成一个出口,
 * 便于两端镜像时一份文件对照一份文件。
 *
 * 平台无关:只吃 props + colorScheme,不碰导航 / 请求 / 平台 API。
 * 平台特定(触感)由调用方通过 haptics prop 注入,RN 端可给,小程序端给 null。
 */

type Scheme = 'light' | 'dark'

/* ────────────────────────── 1. 骨架屏 ────────────────────────── */

export interface ScreenSkeletonProps {
  colorScheme?: Scheme
  /** list=列表行 / card=大卡片 / grid=九宫格 */
  variant?: 'list' | 'card' | 'grid'
  /** 骨架块数量 */
  count?: number
  testID?: string
}

/** 单块骨架的 shimmer(不引三方库,纯 Animated 循环,卸载即停) */
function Shimmer({ colorScheme, style }: { colorScheme: Scheme; style?: object }) {
  const tk = getTokens(colorScheme)
  const v = useRef(new Animated.Value(0)).current
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(v, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [v])
  const opacity = v.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0.85] })
  return (
    <Animated.View
      style={[{ backgroundColor: tk.text.tertiary, borderRadius: rnRadius.sm }, style, { opacity }]}
    />
  )
}

export function ScreenSkeleton({
  colorScheme = 'light',
  variant = 'list',
  count = 4,
  testID,
}: ScreenSkeletonProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  const blocks = Array.from({ length: Math.max(1, count) }, (_, i) => i)

  if (variant === 'grid') {
    return (
      <View style={styles.skeletonWrap} testID={testID}>
        <View style={styles.gridRow}>
          {blocks.map((i) => (
            <View key={i} style={styles.gridCell}>
              <Shimmer colorScheme={colorScheme} style={styles.gridThumb} />
              <Shimmer colorScheme={colorScheme} style={styles.gridLine} />
            </View>
          ))}
        </View>
      </View>
    )
  }

  return (
    <View style={styles.skeletonWrap} testID={testID}>
      {blocks.map((i) => (
        <View key={i} style={variant === 'card' ? styles.skeletonCard : styles.skeletonRow}>
          <Shimmer colorScheme={colorScheme} style={styles.skeletonAvatar} />
          <View style={styles.skeletonLines}>
            <Shimmer colorScheme={colorScheme} style={styles.skeletonLineLg} />
            <Shimmer colorScheme={colorScheme} style={styles.skeletonLineSm} />
          </View>
        </View>
      ))}
    </View>
  )
}

/* ────────────────────────── 2. 空状态 ────────────────────────── */

export interface EmptyStateProps {
  /**
   * 顶部真图标(ReactNode,建议 lucide-react-native 组件)。
   * 只接受图标节点,不再接受字符串 —— 关闭「字符当图标」通道(AGENTS §4:图标一律图标库)。
   * 不传则用默认中性图标(圆圈)。
   */
  icon?: React.ReactNode
  title: string
  desc?: string
  actionLabel?: string
  onAction?: () => void
  colorScheme?: Scheme
  testID?: string
}

export function EmptyState({
  icon,
  title,
  desc,
  actionLabel,
  onAction,
  colorScheme = 'light',
  testID,
}: EmptyStateProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  return (
    <View style={styles.stateWrap} testID={testID}>
      <View style={styles.stateGlyphCircle}>
        {icon ?? <Circle size={26} color={tk.text.tertiary} />}
      </View>
      <Text style={styles.stateTitle}>{title}</Text>
      {desc ? <Text style={styles.stateDesc}>{desc}</Text> : null}
      {actionLabel && onAction ? (
        <Pressable style={styles.stateBtn} onPress={onAction} accessibilityRole="button">
          <Text style={styles.stateBtnText}>{actionLabel}</Text>
        </Pressable>
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
  testID?: string
}

export function ErrorState({
  message,
  onRetry,
  retryLabel = '重试',
  colorScheme = 'light',
  testID,
}: ErrorStateProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  return (
    <View style={styles.stateWrap} testID={testID}>
      <View style={styles.stateGlyphCircle}>
        <Text style={styles.stateGlyph}>!</Text>
      </View>
      <Text style={styles.stateTitle}>{message}</Text>
      {onRetry ? (
        <Pressable style={styles.stateBtn} onPress={onRetry} accessibilityRole="button">
          <Text style={styles.stateBtnText}>{retryLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

/* ────────────────── 4. 按压卡片(含触感注入口) ────────────────── */

export interface PressableCardProps {
  children: React.ReactNode
  onPress?: () => void
  /** 触感反馈由调用方注入(RN 端给 expo-haptics,小程序端给 null),本件不直接依赖平台 API */
  haptics?: (() => void) | null
  colorScheme?: Scheme
  style?: object
  testID?: string
}

export function PressableCard({
  children,
  onPress,
  haptics = null,
  colorScheme = 'light',
  style,
  testID,
}: PressableCardProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  const scale = useRef(new Animated.Value(1)).current

  const pressIn = () => {
    Animated.spring(scale, { toValue: 0.975, useNativeDriver: true, speed: 50 }).start()
    if (haptics) haptics()
  }
  const pressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50 }).start()
  }

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPressIn={pressIn}
        onPressOut={pressOut}
        onPress={onPress}
        testID={testID}
        accessibilityRole="button"
        style={[styles.pressCard, style]}
      >
        {children}
      </Pressable>
    </Animated.View>
  )
}

/* ────────────────────────── 样式(单份,两端镜像基准) ────────────────────────── */

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    // 骨架
    skeletonWrap: { padding: rnSpacing.lg, gap: rnSpacing.md },
    skeletonRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.md,
      padding: 14,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
    },
    skeletonCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: rnSpacing.md,
      padding: rnSpacing.lg,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
    },
    skeletonAvatar: { width: 44, height: 44, borderRadius: rnRadius.md },
    skeletonLines: { flex: 1, gap: rnSpacing.sm },
    skeletonLineLg: { height: 12, width: '80%' },
    skeletonLineSm: { height: 10, width: '50%' },
    gridRow: { flexDirection: 'row', flexWrap: 'wrap', gap: rnSpacing.md },
    gridCell: { width: '47%', gap: rnSpacing.sm },
    gridThumb: { height: 92, width: '100%', borderRadius: rnRadius.md },
    gridLine: { height: 10, width: '70%' },
    // 空态 / 错误态
    stateWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: rnSpacing['3xl'],
      gap: 10,
    },
    stateGlyphCircle: {
      width: 64,
      height: 64,
      borderRadius: rnRadius['2xl'], // 与小程序 .ihui-state-glyph-circle 同取 2xl 档(128rpx 盒 + var(--radius-2xl));写 50% 会让两端一个圆角方、一个正圆
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tk.surface.light,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    stateGlyph: { fontSize: 26, color: tk.text.tertiary },
    stateTitle: {
      fontSize: rnType.strong.size,
      fontWeight: '600',
      color: tk.text.medium,
      textAlign: 'center',
    },
    stateDesc: { fontSize: 13, color: tk.text.tertiary, textAlign: 'center', lineHeight: 19 },
    stateBtn: {
      marginTop: 6,
      paddingHorizontal: 18,
      paddingVertical: 9,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.DEFAULT,
    },
    stateBtnText: { fontSize: rnType.body.size, fontWeight: '600', color: tk.surface.light },
    // 按压卡片
    pressCard: {
      padding: 14,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
    },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
