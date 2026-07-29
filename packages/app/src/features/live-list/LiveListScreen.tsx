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
import type { LiveListItem, LiveListScreenProps, LiveListTab, LiveStatus } from '../../types'

/** 直播列表/Props 类型 re-export(单一来源 @ihui/types) */
export type { LiveListItem, LiveListScreenProps, LiveListTab, LiveStatus }

const TABS: LiveListTab[] = ['all', 'upcoming', 'ongoing', 'ended']

const TAB_KEYS: Record<LiveListTab, string> = {
  all: 'liveList.tab_all',
  upcoming: 'liveList.tab_upcoming',
  ongoing: 'liveList.tab_ongoing',
  ended: 'liveList.tab_ended',
}

/**
 * 直播列表共享屏 — props 注入式跨端组件
 *
 * 平台无关:负责渲染 header + tab 切换栏 + 直播卡片列表 + 下拉刷新。
 * 平台特定(导航 / API 调用 / tab 切换拉取 / 日期格式化)由 wrapper 通过 props 注入。
 */
export function LiveListScreen({
  t,
  items,
  activeTab,
  onSelectTab,
  loading,
  refreshing,
  error,
  onRefresh,
  onPressItem,
  onBack,
  colorScheme = 'light',
}: LiveListScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const statusColor = (status: LiveStatus) => {
    if (status === 'ongoing') return tk.brand.DEFAULT
    if (status === 'upcoming') return tk.warning.amber
    return tk.text.tertiary
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('liveList.title')}</Text>
        <Text style={styles.subtitle}>{t('liveList.subtitle')}</Text>
      </View>

      <View style={styles.tabs}>
        {TABS.map((s) => {
          const active = s === activeTab
          return (
            <TouchableOpacity
              key={s}
              onPress={() => onSelectTab(s)}
              style={[styles.tab, active && styles.tabActive]}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {t(TAB_KEYS[s]!)}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>

      {error ? (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={onRefresh}>
            <Text style={styles.retryText}>{t('liveList.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {loading && items.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>{t('common.loading')}</Text>
        </View>
      ) : (
        <FlatList<LiveListItem>
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listBody}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>{t('liveList.empty')}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => onPressItem(item)} activeOpacity={0.7}>
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <View style={[styles.statusBadge, { backgroundColor: statusColor(item.status) }]}>
                    <Text style={styles.statusText}>{t(TAB_KEYS[item.status as LiveListTab]!)}</Text>
                  </View>
                </View>
                <Text style={styles.cardMeta}>
                  {t('liveList.lecturer')}: {item.lecturer}
                </Text>
                <View style={styles.cardMetaRow}>
                  <Text style={styles.cardMetaText}>
                    {t('liveList.startAt')}: {item.startAt || '—'}
                  </Text>
                  <Text style={styles.cardMetaText}>
                    {t('liveList.viewerCount', { count: item.viewerCount })}
                  </Text>
                </View>
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
    header: { paddingHorizontal: 16, paddingTop: 48, paddingBottom: 8 },
    backBtn: { marginBottom: 4 },
    backText: { fontSize: 14, color: tk.text.secondary },
    title: { fontSize: 22, fontWeight: '600', color: tk.text.primary },
    subtitle: { marginTop: 4, fontSize: 13, color: tk.text.secondary },
    tabs: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, gap: 6 },
    tab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: tk.surface.card },
    tabActive: { backgroundColor: tk.success.DEFAULT },
    tabText: { fontSize: 12, color: tk.text.secondary },
    tabTextActive: { color: tk.surface.light },
    errorBar: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    errorText: { fontSize: 12, color: tk.danger.DEFAULT },
    retryText: { fontSize: 12, color: tk.success.DEFAULT },
    center: { alignItems: 'center', paddingVertical: 32 },
    emptyText: { fontSize: 12, color: tk.text.tertiary, marginTop: 8 },
    listBody: { padding: 16, paddingBottom: 32 },
    separator: { height: 10 },
    card: {
      padding: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.bg,
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    cardTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: tk.text.primary, marginRight: 8 },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
    statusText: { fontSize: 11, color: tk.surface.light },
    cardMeta: { marginTop: 6, fontSize: 12, color: tk.text.secondary },
    cardMetaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
    cardMetaText: { fontSize: 11, color: tk.text.tertiary },
  })
}
