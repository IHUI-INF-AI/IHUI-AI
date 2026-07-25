import { Fragment, useMemo } from 'react'
import type { ReactNode } from 'react'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'

export interface AgentCardProps {
  /** 图标 URL 或 emoji(长度 ≤ 2 视为 emoji) */
  icon: string
  name: string
  description: string
  /** 使用次数 */
  usageCount: number
  /** 创建者昵称 */
  creator?: string
  tags?: string[]
  /** 评分(如 4.5,显示 ★4.5) */
  rating?: number
  /** 是否免费(显示"免费"标签 vs "¥xx") */
  isFree?: boolean
  /** 价格(单位:分,若 isFree=false 显示) */
  price?: number
  /** 底部 slot(用于聊天按钮等) */
  footer?: ReactNode
  onPress?: () => void
  colorScheme?: 'light' | 'dark'
}

const ICON_TINT = 'rgba(16, 185, 129, 0.12)'
const PRICE_COLOR = '#EF4444'
const FREE_TINT = 'rgba(34, 197, 94, 0.12)'
const FREE_COLOR = '#22C55E'

function formatCount(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '0'
  if (n >= 10000) return `${(n / 10000).toFixed(1)}w`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

function formatPrice(cents: number): string {
  if (!Number.isFinite(cents) || cents < 0) return '¥0.00'
  return `¥${(cents / 100).toFixed(2)}`
}

function formatRating(r: number): string {
  if (!Number.isFinite(r) || r < 0) return '★0'
  return `★${r.toFixed(1)}`
}

/**
 * AgentCard — AI 智能体卡(跨端共享)。
 *
 * 纯展示组件:图标(emoji 或 URL)+ 名称 + 描述 + 标签 + 使用次数 + 创建者。
 * 数据由调用方传入,样式遵循 packages/app 现有模式(StyleSheet + getTokens)。
 */
export function AgentCard({
  icon,
  name,
  description,
  usageCount,
  creator,
  tags,
  rating,
  isFree,
  price,
  footer,
  onPress,
  colorScheme = 'light',
}: AgentCardProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  const isEmoji = icon.length <= 2
  const showRating = typeof rating === 'number' && Number.isFinite(rating) && rating > 0
  const showPrice =
    typeof isFree === 'boolean' ||
    (typeof price === 'number' && Number.isFinite(price) && price >= 0)

  const priceNode = (() => {
    if (!showPrice) return null
    if (isFree === true) {
      return (
        <View style={styles.freeTag}>
          <Text style={styles.freeTagText}>免费</Text>
        </View>
      )
    }
    if (typeof price === 'number' && Number.isFinite(price) && price >= 0) {
      return <Text style={styles.price}>{formatPrice(price)}</Text>
    }
    return null
  })()

  const inner = (
    <Fragment>
      <View style={styles.headRow}>
        <View style={styles.iconBox}>
          {isEmoji ? (
            <Text style={styles.iconEmoji}>{icon}</Text>
          ) : (
            <Image source={{ uri: icon }} style={styles.iconImg} />
          )}
        </View>
        <View style={styles.meta}>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.description} numberOfLines={2}>
            {description}
          </Text>
        </View>
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
        <Text style={styles.footerText}>{formatCount(usageCount)} 次使用</Text>
        {showRating ? (
          <Text style={styles.ratingText}>{formatRating(rating as number)}</Text>
        ) : null}
        {creator ? <Text style={styles.footerText}>by {creator}</Text> : null}
        <View style={styles.footerSpacer} />
        {priceNode}
      </View>

      {footer ? <View style={styles.footer}>{footer}</View> : null}
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
    card: { backgroundColor: tk.surface.muted, borderRadius: 8, padding: 16, gap: 10 },
    pressed: { opacity: 0.85 },
    headRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    iconBox: {
      width: 48,
      height: 48,
      borderRadius: 8,
      backgroundColor: ICON_TINT,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    iconEmoji: { fontSize: 24 },
    iconImg: { width: 48, height: 48, borderRadius: 8 },
    meta: { flex: 1, gap: 2 },
    name: { fontSize: 16, fontWeight: '600', color: tk.text.primary },
    description: { fontSize: 12, color: tk.text.secondary },
    tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    tag: {
      backgroundColor: tk.surface.card,
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    tagText: { fontSize: 11, color: tk.text.secondary },
    footerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
    footerText: { fontSize: 11, color: tk.text.tertiary },
    ratingText: { fontSize: 11, color: '#F59E0B', fontWeight: '600' },
    footerSpacer: { flex: 1, minWidth: 8 },
    price: { fontSize: 14, fontWeight: '700', color: PRICE_COLOR },
    freeTag: {
      backgroundColor: FREE_TINT,
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    freeTagText: { fontSize: 11, fontWeight: '700', color: FREE_COLOR },
    footer: { marginTop: 4 },
  })
}
