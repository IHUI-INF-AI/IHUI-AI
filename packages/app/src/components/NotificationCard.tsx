// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { rnRadius } from '@ihui/design-tokens'
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
  /** D195 行尾操作文案(隐藏/恢复);不传即整块操作区不渲染,MessageCenter 等调用方零影响。 */
  actionLabel?: string
  onAction?: () => void
  actionPending?: boolean
  /** D195 行级状态回显(正在隐藏… / 这条动态未隐藏,请重试。) */
  statusText?: string
  statusTone?: 'muted' | 'destructive'
}

/**
 * 消息卡片(2026-08-12 从 MessageCenterScreen / NotificationListScreen 抽取,
 * 两屏原各有 ~60L 完全相同的卡片渲染 + 样式)。
 */
export function NotificationCard({
  item,
  typeLabel,
  onPress,
  styles,
  actionLabel,
  onAction,
  actionPending,
  statusText,
  statusTone,
}: NotificationCardProps) {
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
      {statusText ? (
        <Text style={[styles.status, statusTone === 'destructive' && styles.statusDestructive]}>
          {statusText}
        </Text>
      ) : null}
    </View>
  )
  // 操作区与卡片体是兄弟,不是嵌套 TouchableOpacity:嵌套可点在 RN 上内层吞事件、外层仍响应,
  // "点隐藏却把这条标成已读"就是这么来的。
  const body = onPress ? (
    <TouchableOpacity
      onPress={() => onPress(item)}
      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
      style={styles.rowMain}
    >
      {inner}
    </TouchableOpacity>
  ) : (
    <View style={styles.rowMain}>{inner}</View>
  )
  return (
    <View key={item.id} style={styles.rowWrap}>
      {body}
      {actionLabel ? (
        <TouchableOpacity
          style={[styles.action, actionPending && styles.actionDisabled]}
          onPress={onAction}
          disabled={actionPending === true}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        >
          <Text style={styles.actionText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  )
}

export function createCardStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    card: {
      padding: 16,
      borderRadius: rnRadius.lg,
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
      borderRadius: rnRadius.sm,
      overflow: 'hidden',
    },
    typeSystem: {
      color: tk.success.DEFAULT,
      backgroundColor: tk.success.light,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: rnRadius.xs,
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
    rowWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    rowMain: {
      flex: 1,
      minWidth: 0,
    },
    status: {
      marginTop: 4,
      fontSize: 12,
      color: tk.text.secondary,
    },
    statusDestructive: {
      color: tk.danger.DEFAULT,
    },
    action: {
      alignSelf: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.surface.card,
    },
    actionDisabled: {
      opacity: 0.5,
    },
    actionText: {
      fontSize: 13,
      color: tk.text.secondary,
    },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
