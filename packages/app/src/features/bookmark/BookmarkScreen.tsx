import { useMemo } from 'react'
import { View, Text, TouchableOpacity, ScrollView, RefreshControl, StyleSheet } from 'react-native'
import type { BookmarkItem, BookmarkScreenProps, BookmarkTargetType } from '../../types'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'

/**
 * 收藏列表共享屏 — props 注入式跨端组件
 *
 * 平台无关:只负责渲染列表 UI + 下拉刷新 + 删除按钮交互。
 * 平台特定(导航/API 调用)由 wrapper 通过 props 注入。
 */
export function BookmarkScreen({
  t,
  items,
  loading,
  refreshing,
  error,
  onRefresh,
  onPressItem,
  onRemove,
  onBack,
  colorScheme = 'light',
}: BookmarkScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const typeLabel = (targetType: BookmarkTargetType) => {
    switch (targetType) {
      case 'course':
        return t('bookmark.type.course')
      case 'article':
        return t('bookmark.type.article')
      case 'post':
        return t('bookmark.type.post')
      case 'note':
        return t('bookmark.type.note')
      default:
        return t('bookmark.type.other')
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('bookmark.title')}</Text>
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
              <Text style={styles.muted}>{t('bookmark.empty')}</Text>
            </View>
          ) : (
            items.map((item: BookmarkItem) => (
              <View key={item.id} style={styles.card}>
                <TouchableOpacity
                  style={styles.cardBody}
                  onPress={() => onPressItem(item)}
                  hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                >
                  <View style={styles.titleRow}>
                    <Text style={styles.cardType}>{typeLabel(item.targetType)}</Text>
                    <Text style={styles.cardTime}>{item.createdAt}</Text>
                  </View>
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.removeBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  onPress={() => onRemove(item)}
                >
                  <Text style={styles.removeText}>{t('bookmark.remove')}</Text>
                </TouchableOpacity>
              </View>
            ))
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
      paddingHorizontal: 10,
      paddingVertical: 12,
      gap: 12,
    },
    backText: { fontSize: 16, color: tk.text.medium },
    title: { fontSize: 20, fontWeight: '600', color: tk.text.primary },
    errorText: { paddingHorizontal: 10, fontSize: 14, color: tk.danger.DEFAULT },
    center: { alignItems: 'center', paddingVertical: 48 },
    muted: { fontSize: 14, color: tk.text.secondary, marginTop: 8 },
    listBody: { padding: 10 },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: tk.border.light,
      marginBottom: 8,
    },
    cardBody: { flex: 1 },
    titleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    cardType: {
      fontSize: 11,
      fontWeight: '600',
      color: tk.success.DEFAULT,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      backgroundColor: tk.surface.muted,
      overflow: 'hidden',
    },
    cardTime: { fontSize: 11, color: tk.text.tertiary },
    cardTitle: { fontSize: 16, fontWeight: '600', color: tk.text.primary },
    removeBtn: {
      marginLeft: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 12,
      backgroundColor: tk.danger.light,
    },
    removeText: { fontSize: 14, color: tk.danger.DEFAULT },
  })
}
