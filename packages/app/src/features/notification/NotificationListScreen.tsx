import { useMemo } from 'react'
import { View, Text, TouchableOpacity, ScrollView, RefreshControl, StyleSheet } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type {
  NotificationListItem,
  NotificationListScreenProps,
  NotificationType,
} from '../../types'

/**
 * 通知列表共享屏 — props 注入式跨端组件
 *
 * 平台无关:只负责渲染列表 UI + 下拉刷新 + 通知卡片渲染。
 * 平台特定(导航 / API 调用)由 wrapper 通过 props 注入。
 */

export type { NotificationListItem, NotificationListScreenProps, NotificationType }

export function NotificationListScreen({
  t,
  items,
  loading,
  refreshing,
  error,
  onRefresh,
  onPressItem,
  onBack,
  colorScheme = 'light',
}: NotificationListScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const typeLabel = (type: NotificationType) => {
    switch (type) {
      case 'system':
        return t('notificationList.type.system')
      case 'order':
        return t('notificationList.type.order')
      case 'course':
        return t('notificationList.type.course')
      case 'social':
        return t('notificationList.type.social')
      default:
        return t('notificationList.type.system')
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('notificationList.title')}</Text>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {loading && items.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.muted}>{t('common.loading')}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listBody}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {items.length === 0 ? (
            <View style={styles.center}>
              <Text style={styles.muted}>{t('notificationList.empty')}</Text>
            </View>
          ) : (
            items.map((item: NotificationListItem) => {
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
              if (onPressItem) {
                return (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => onPressItem(item)}
                    hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                  >
                    {inner}
                  </TouchableOpacity>
                )
              }
              return <View key={item.id}>{inner}</View>
            })
          )}
        </ScrollView>
      )}
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 12,
    },
    backText: { fontSize: 14, color: tk.text.medium },
    title: { fontSize: 18, fontWeight: '600', color: tk.text.primary },
    errorText: { paddingHorizontal: 16, fontSize: 12, color: tk.danger.DEFAULT },
    center: { alignItems: 'center', paddingVertical: 48 },
    muted: { fontSize: 12, color: tk.text.secondary, marginTop: 8 },
    listBody: { padding: 16 },
    card: {
      padding: 16,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: tk.border.light,
      marginBottom: 8,
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
      fontSize: 14,
      fontWeight: '600',
      color: tk.text.primary,
    },
    cardContent: {
      marginTop: 4,
      fontSize: 13,
      color: tk.text.medium,
    },
  })
}
