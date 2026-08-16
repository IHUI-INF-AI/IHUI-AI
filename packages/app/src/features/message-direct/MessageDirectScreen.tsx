import { useMemo } from 'react'
import { View, Text, TouchableOpacity, FlatList, RefreshControl, StyleSheet } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { MessageDirectItem, MessageDirectScreenProps } from '@ihui/types'

/** 私信列表/Props 类型 re-export(单一来源 @ihui/types) */
export type { MessageDirectItem, MessageDirectScreenProps }

/**
 * 私信列表共享屏 — props 注入式跨端组件
 *
 * 平台无关:负责渲染 header(返回 + 标题)+ 错误提示 + loading 态
 * + 私信卡片列表(nickname + 未读红色 badge + lastMessage[2 行] + lastMessageTime)
 * + 下拉刷新 + 空态。
 * 平台特定(导航 / API 调用)由 wrapper 通过 props 注入。
 */
export function MessageDirectScreen({
  t,
  items,
  loading,
  refreshing,
  error,
  onRefresh,
  onPressItem,
  onBack,
  colorScheme = 'light',
}: MessageDirectScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('messageDirect.title')}</Text>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {loading && items.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.muted}>{t('common.loading')}</Text>
        </View>
      ) : (
        <FlatList<MessageDirectItem>
          data={items}
          keyExtractor={(item) => item.memberId}
          contentContainerStyle={styles.listBody}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.muted}>{t('messageDirect.empty')}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => onPressItem(item)}
              activeOpacity={0.7}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            >
              <View style={styles.card}>
                <View style={styles.titleRow}>
                  <Text style={styles.cardName} numberOfLines={1}>
                    {item.nickname}
                  </Text>
                  {item.unreadCount > 0 ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>
                        {item.unreadCount > 99 ? '99+' : String(item.unreadCount)}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.cardMessage} numberOfLines={2}>
                  {item.lastMessage}
                </Text>
                <Text style={styles.cardTime}>{item.lastMessageTime}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
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
      paddingHorizontal: 10,
      paddingTop: 48,
      paddingBottom: 12,
      gap: 12,
    },
    backText: { fontSize: 16, color: tk.text.medium },
    title: { fontSize: 20, fontWeight: '600', color: tk.text.primary },
    errorText: { paddingHorizontal: 10, fontSize: 14, color: tk.danger.DEFAULT },
    center: { alignItems: 'center', paddingVertical: 48 },
    muted: { fontSize: 14, color: tk.text.secondary, marginTop: 8 },
    listBody: { padding: 10, paddingBottom: 32 },
    separator: { height: StyleSheet.hairlineWidth, backgroundColor: tk.border.light },
    card: {
      padding: 12,
      borderRadius: 12,
      backgroundColor: tk.surface.light,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    cardName: {
      flex: 1,
      fontSize: 16,
      fontWeight: '600',
      color: tk.text.primary,
      marginRight: 8,
    },
    badge: {
      minWidth: 18,
      paddingHorizontal: 5,
      paddingVertical: 2,
      borderRadius: 9,
      backgroundColor: tk.danger.DEFAULT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeText: { fontSize: 10, fontWeight: '600', color: tk.surface.light },
    cardMessage: {
      marginTop: 8,
      fontSize: 14,
      color: tk.text.secondary,
      lineHeight: 20,
    },
    cardTime: { marginTop: 8, fontSize: 11, color: tk.text.tertiary },
  })
}
