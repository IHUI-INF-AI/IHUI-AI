import { Fragment, useMemo } from 'react'
import type { ReactNode } from 'react'
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
  /** 课程描述(2 行截断) */
  description?: string
  /** 难度等级 */
  level?: 'beginner' | 'intermediate' | 'advanced'
  /** 是否免费(若 true 显示"免费"标签,优先于 price) */
  isFree?: boolean
  /** 评分 */
  rating?: number
  /** 标签 */
  tags?: string[]
  /** 底部 slot(用于报名按钮等) */
  footer?: ReactNode
  onPress?: () => void
  colorScheme?: 'light' | 'dark'
}

const PRICE_COLOR = '#EF4444'
const FREE_TINT = 'rgba(34, 197, 94, 0.12)'
const FREE_COLOR = '#22C55E'
const LEVEL_TINT = 'rgba(59, 130, 246, 0.12)'
const LEVEL_COLOR = '#3B82F6'

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

function formatRating(r: number): string {
  if (!Number.isFinite(r) || r < 0) return '★0'
  return `★${r.toFixed(1)}`
}

function levelLabel(level: 'beginner' | 'intermediate' | 'advanced'): string {
  if (level === 'beginner') return '入门'
  if (level === 'intermediate') return '进阶'
  return '高级'
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
  description,
  level,
  isFree,
  rating,
  tags,
  footer,
  onPress,
  colorScheme = 'light',
}: CourseCardProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  const showRating = typeof rating === 'number' && Number.isFinite(rating) && rating > 0
  const freeActive = isFree === true

  const priceNode = freeActive ? (
    <View style={styles.freeTag}>
      <Text style={styles.freeTagText}>免费</Text>
    </View>
  ) : (
    <Text style={styles.price}>{formatPrice(price)}</Text>
  )

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
        {description ? (
          <Text style={styles.description} numberOfLines={2}>
            {description}
          </Text>
        ) : null}
        <View style={styles.metaRow}>
          <Text style={styles.lecturer}>讲师 · {lecturer}</Text>
          {level ? (
            <View style={styles.levelBadge}>
              <Text style={styles.levelText}>{levelLabel(level)}</Text>
            </View>
          ) : null}
          {showRating ? (
            <Text style={styles.ratingText}>{formatRating(rating as number)}</Text>
          ) : null}
        </View>
        {tags && tags.length > 0 ? (
          <View style={styles.tagsRow}>
            {tags.slice(0, 3).map((tag, i) => (
              <View key={`${i}-${tag}`} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        ) : null}
        <View style={styles.footerRow}>
          {priceNode}
          <Text style={styles.enroll}>{formatCount(enrollCount)} 报名</Text>
        </View>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </View>
    </Fragment>
  )

  if (onPress) {
    return (
      <Pressable
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
        onPress={onPress}
      >
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
    description: { fontSize: 12, color: tk.text.secondary },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    lecturer: { fontSize: 12, color: tk.text.secondary },
    levelBadge: {
      backgroundColor: LEVEL_TINT,
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    levelText: { fontSize: 11, fontWeight: '600', color: LEVEL_COLOR },
    ratingText: { fontSize: 11, color: '#F59E0B', fontWeight: '600' },
    tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    tag: {
      backgroundColor: tk.surface.card,
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    tagText: { fontSize: 11, color: tk.text.secondary },
    footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    price: { fontSize: 16, fontWeight: '700', color: PRICE_COLOR },
    freeTag: {
      backgroundColor: FREE_TINT,
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    freeTagText: { fontSize: 12, fontWeight: '700', color: FREE_COLOR },
    enroll: { fontSize: 11, color: tk.text.tertiary },
    footer: { marginTop: 4 },
  })
}
