import { Fragment, useMemo } from 'react'
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
  onPress?: () => void
  colorScheme?: 'light' | 'dark'
}

const ICON_TINT = 'rgba(16, 185, 129, 0.12)'

function formatCount(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '0'
  if (n >= 10000) return `${(n / 10000).toFixed(1)}w`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
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
  onPress,
  colorScheme = 'light',
}: AgentCardProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  const isEmoji = icon.length <= 2

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
        {creator ? <Text style={styles.footerText}>by {creator}</Text> : null}
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
    tag: { backgroundColor: tk.surface.card, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
    tagText: { fontSize: 11, color: tk.text.secondary },
    footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    footerText: { fontSize: 11, color: tk.text.tertiary },
  })
}
