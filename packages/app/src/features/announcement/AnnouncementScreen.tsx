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
import type { AnnouncementItem, AnnouncementScreenProps } from '../../types'

/** 公告/Props 类型 re-export(单一来源 @ihui/types) */
export type { AnnouncementItem, AnnouncementScreenProps }

/**
 * 公告列表共享屏 — props 注入式跨端组件
 *
 * 平台无关:负责渲染 header(返回 + 标题)+ 错误提示(可选)+ loading 态
 * + 公告卡片列表(pinned 徽章[如有] + title[2行] + content[3行] + publishTime,可点击)
 * + 下拉刷新 + 空态。
 * 平台特定(导航 / API 调用)由 wrapper 通过 props 注入。
 */
export function AnnouncementScreen({
  t,
  items,
  loading,
  refreshing,
  error,
  onRefresh,
  onPressItem,
  onBack,
  colorScheme = 'light',
}: AnnouncementScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('announcement.title')}</Text>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {loading && items.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.muted}>{t('common.loading')}</Text>
        </View>
      ) : (
        <FlatList<AnnouncementItem>
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listBody}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.muted}>{t('announcement.empty')}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => onPressItem(item)}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            >
              <View style={styles.titleRow}>
                {item.pinned ? (
                  <View style={styles.pinnedBadge}>
                    <Text style={styles.pinnedText}>{t('announcement.pinned')}</Text>
                  </View>
                ) : null}
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {item.title}
                </Text>
              </View>
              <Text style={styles.cardContent} numberOfLines={3}>
                {item.content}
              </Text>
              <Text style={styles.publishTime}>
                {t('announcement.publishTime')}: {item.publishTime}
              </Text>
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
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 12,
    },
    backText: { fontSize: 14, color: tk.text.medium },
    title: { flex: 1, fontSize: 18, fontWeight: '600', color: tk.text.primary },
    errorText: { paddingHorizontal: 16, fontSize: 12, color: tk.danger.DEFAULT },
    center: { alignItems: 'center', paddingVertical: 48 },
    muted: { fontSize: 12, color: tk.text.secondary, marginTop: 8 },
    listBody: { padding: 16 },
    separator: { height: 12 },
    card: {
      padding: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    pinnedBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 8,
      backgroundColor: tk.warning.amberLight,
    },
    pinnedText: { fontSize: 10, color: tk.warning.amberText },
    cardTitle: { flex: 1, fontSize: 14, fontWeight: '600', color: tk.text.primary },
    cardContent: { marginTop: 6, fontSize: 12, color: tk.text.medium, lineHeight: 18 },
    publishTime: { marginTop: 8, fontSize: 11, color: tk.text.tertiary },
  })
}
