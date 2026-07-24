import { Fragment, useMemo } from 'react'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'

export interface CourseCardProps {
  /** 封面 URL */
  cover: string
  title: string
  /** 讲师 */
  lecturer: string
  /** 价格(单位:分) */
  price: number
  /** 报名人数 */
  enrollCount: number
  onPress?: () => void
  colorScheme?: 'light' | 'dark'
}

const PRICE_COLOR = '#EF4444'

function formatPrice(cents: number): string {
  if (!Number.isFinite(cents) || cents < 0) return '¥0.00'
  return `¥${(cents / 100).toFixed(2)}`
}

function formatCount(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '0'
  if (n >= 10000) return `${(n / 10000).toFixed(1)}w`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

/**
 * CourseCard — 课程卡(跨端共享)。
 *
 * 纯展示组件:封面 + 标题 + 讲师 + 价格 + 报名人数。
 * 封面 Image 全宽贴顶,卡片 overflow:hidden 让图片遵循圆角。
 * 数据由调用方传入,样式遵循 packages/app 现有模式(StyleSheet + getTokens)。
 */
export function CourseCard({
  cover,
  title,
  lecturer,
  price,
  enrollCount,
  onPress,
  colorScheme = 'light',
}: CourseCardProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const inner = (
    <Fragment>
      <Image
        source={{ uri: cover }}
        style={styles.cover}
        resizeMode="cover"
        accessibilityLabel={title}
      />
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        <Text style={styles.lecturer}>讲师 · {lecturer}</Text>
        <View style={styles.footerRow}>
          <Text style={styles.price}>{formatPrice(price)}</Text>
          <Text style={styles.enroll}>{formatCount(enrollCount)} 报名</Text>
        </View>
      </View>
    </Fragment>
  )

  if (onPress) {
    return (
      <Pressable style={({ pressed }) => [styles.card, pressed && styles.pressed]} onPress={onPress}>
        {inner}
      </Pressable>
    )
  }
  return <View style={styles.card}>{inner}</View>
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    card: { backgroundColor: tk.surface.muted, borderRadius: 8, overflow: 'hidden' },
    pressed: { opacity: 0.85 },
    cover: { width: '100%', height: 128, backgroundColor: tk.surface.card },
    body: { padding: 12, gap: 8 },
    title: { fontSize: 16, fontWeight: '600', color: tk.text.primary },
    lecturer: { fontSize: 12, color: tk.text.secondary },
    footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    price: { fontSize: 16, fontWeight: '700', color: PRICE_COLOR },
    enroll: { fontSize: 11, color: tk.text.tertiary },
  })
}
