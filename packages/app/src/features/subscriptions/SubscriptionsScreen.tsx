import { useMemo } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  StyleSheet,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { SubscriptionsItem, SubscriptionsScreenProps } from '../../types'

/** 订阅列表共享屏 — props 注入式跨端组件 */
export type { SubscriptionsItem, SubscriptionsScreenProps }

export function SubscriptionsScreen({
  t,
  items,
  loading,
  refreshing,
  loadingMore,
  error,
  onRefresh,
  onLoadMore,
  onCancel,
  onBack,
  colorScheme = 'light',
}: SubscriptionsScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.back}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('subscriptions.title')}</Text>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <FlatList<SubscriptionsItem>
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listBody}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        onEndReached={onLoadMore}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.muted}>
              {loading ? t('common.loading') : t('subscriptions.empty')}
            </Text>
          </View>
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footer}>
              <Text style={styles.muted}>{t('common.loading')}</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.thumb}>
              <Text style={styles.thumbText}>{item.targetType}</Text>
            </View>
            <View style={styles.body}>
              <Text style={styles.targetId} numberOfLines={1}>
                {item.targetId}
              </Text>
              <Text style={styles.createdAt}>{item.createdAt}</Text>
            </View>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => onCancel(item)}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            >
              <Text style={styles.cancelBtnText}>{t('subscriptions.cancel')}</Text>
            </TouchableOpacity>
          </View>
        )}
      />
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
      paddingTop: 12,
      paddingBottom: 4,
      gap: 12,
    },
    back: { fontSize: 14, color: tk.text.medium },
    title: { fontSize: 18, fontWeight: '600', color: tk.text.primary },
    errorText: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      fontSize: 12,
      color: tk.danger.DEFAULT,
    },
    listBody: { padding: 16, paddingBottom: 32 },
    separator: { height: 12 },
    center: { alignItems: 'center', paddingVertical: 48 },
    muted: { fontSize: 12, color: tk.text.secondary },
    footer: { alignItems: 'center', paddingVertical: 16 },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.bg,
    },
    thumb: {
      width: 40,
      height: 40,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tk.surface.muted,
    },
    thumbText: {
      fontSize: 12,
      fontWeight: '600',
      color: tk.brand.DEFAULT,
    },
    body: { marginLeft: 12, flex: 1 },
    targetId: {
      fontSize: 14,
      fontWeight: '600',
      color: tk.text.primary,
    },
    createdAt: {
      marginTop: 2,
      fontSize: 12,
      color: tk.text.secondary,
    },
    cancelBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.bg,
    },
    cancelBtnText: {
      fontSize: 12,
      color: tk.text.medium,
      fontWeight: '600',
    },
  })
}
