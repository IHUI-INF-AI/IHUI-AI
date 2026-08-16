import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import type { AppThemeTokens } from '../theme/tokens'

/** 消息/通知卡片统一形状(MessageCenterItem 与 NotificationListItem 的公共字段)。 */
export interface CardItemLike {
  id: string
  title: string
  content: string
  createdAt: string
  read: boolean
  type: string
}

interface NotificationCardProps {
  item: CardItemLike
  /** 类型 → 展示文案(调用方注入 i18n) */
  typeLabel: (type: string) => string
  onPress?: (item: CardItemLike) => void
  styles: ReturnType<typeof createCardStyles>
}

/**
 * 消息卡片(2026-08-12 从 MessageCenterScreen / NotificationListScreen 抽取,
 * 两屏原各有 ~60L 完全相同的卡片渲染 + 样式)。
 */
export function NotificationCard({ item, typeLabel, onPress, styles }: NotificationCardProps) {
  const inner = (
    <View style={[styles.card, !item.read && styles.unread]}>
      <View style={styles.cardHead}>
        <Text style={[styles.type, item.type === 'system' && styles.typeSystem]}>
          {typeLabel(item.type)}
        </Text>
        {!item.read ? <View style={styles.dot} /> : null}
        <Text style={styles.meta}>{item.createdAt}</Text>
      </View>
      <Text style={styles.cardTitle} numberOfLines={1}>
        {item.title}
      </Text>
      <Text style={styles.cardContent} numberOfLines={2}>
        {item.content}
      </Text>
    </View>
  )
  if (onPress) {
    return (
      <TouchableOpacity
        key={item.id}
        onPress={() => onPress(item)}
        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
      >
        {inner}
      </TouchableOpacity>
    )
  }
  return <View key={item.id}>{inner}</View>
}

export function createCardStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    card: {
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
      marginBottom: 12,
    },
    unread: {
      borderColor: tk.success.DEFAULT,
      backgroundColor: tk.success.light,
    },
    cardHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    type: {
      fontSize: 10,
      color: tk.text.secondary,
      backgroundColor: tk.surface.card,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      overflow: 'hidden',
    },
    typeSystem: {
      color: tk.success.DEFAULT,
      backgroundColor: tk.success.light,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: tk.danger.DEFAULT,
    },
    meta: {
      marginLeft: 'auto',
      fontSize: 11,
      color: tk.text.tertiary,
    },
    cardTitle: {
      marginTop: 6,
      fontSize: 16,
      fontWeight: '700',
      color: tk.text.primary,
    },
    cardContent: {
      marginTop: 4,
      fontSize: 13,
      color: tk.text.medium,
    },
  })
}
