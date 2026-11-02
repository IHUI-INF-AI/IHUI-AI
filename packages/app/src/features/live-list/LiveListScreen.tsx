// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { LiveListItem, LiveListScreenProps, LiveListTab, LiveStatus } from '../../types'

import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { usePublishShareIntent } from '@ihui/shared/share'
import { BackChevron } from '../../components/BackChevron'
import {
  EmptyState,
  ErrorState,
  PressableCard,
  ScreenSkeleton,
} from '../../components/ScreenStates'
import { assertRequiredPort } from '../../host/ports'

/** 直播列表/Props 类型 re-export(单一来源 @ihui/types) */
export type { LiveListItem, LiveListScreenProps, LiveListTab, LiveStatus }

const TABS: LiveListTab[] = ['all', 'upcoming', 'ongoing', 'ended']

const TAB_KEYS: Record<LiveListTab, string> = {
  all: 'liveList.all',
  upcoming: 'liveList.upcoming',
  ongoing: 'liveList.ongoing',
  ended: 'liveList.ended',
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
  onEndReached,
  loadingMore = false,
  colorScheme = 'light',
  onNavigate,
}: LiveListScreenProps) {
  assertRequiredPort('onNavigate', onNavigate)

  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  // 列表页分享的是"这一屏":原页两张卡用应用级两枚文案(转发卡 appTitle / 朋友圈卡 timelineTitle),
  // 封面走端默认 /static/share.png ⇒ 与宿主兜底同值,不重复发布
  usePublishShareIntent({
    title: t('share.appTitle'),
    timelineTitle: t('share.timelineTitle'),
  })
  const showError: boolean = error !== '' && items.length === 0

  const statusColor = (status: LiveStatus) => {
    if (status === 'ongoing') return tk.brand.DEFAULT
    if (status === 'upcoming') return tk.warning.amber
    return tk.text.tertiary
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron
          onPress={onBack}
          label={t('common.back')}
          colorScheme={colorScheme}
          style={styles.backBtn}
        />
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

      {showError ? (
        <ErrorState
          message={error}
          onRetry={onRefresh}
          retryLabel={t('liveList.retry')}
          colorScheme={colorScheme}
        />
      ) : null}

      {loading && items.length === 0 ? (
        <ScreenSkeleton variant="list" count={4} colorScheme={colorScheme} />
      ) : (
        <FlatList<LiveListItem>
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listBody}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footer}>
                <ActivityIndicator color={tk.brand.DEFAULT} />
                <Text style={styles.footerText}>{t('common.loading')}</Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            showError ? null : <EmptyState title={t('liveList.empty')} colorScheme={colorScheme} />
          }
          renderItem={({ item }) => (
            <PressableCard onPress={() => onPressItem(item)} colorScheme={colorScheme}>
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <View style={[styles.statusBadge, { backgroundColor: statusColor(item.status) }]}>
                    <Text style={styles.statusText}>
                      {t(TAB_KEYS[item.status as LiveListTab]!)}
                    </Text>
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
            </PressableCard>
          )}
        />
      )}
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    header: { paddingHorizontal: rnSpacing['sm-loose'], paddingBottom: rnSpacing.sm },
    backBtn: { marginBottom: rnSpacing.sm },
    title: { fontSize: 22, fontWeight: '600', color: tk.text.primary },
    subtitle: { marginTop: rnSpacing.sm, fontSize: rnType.body.size, color: tk.text.secondary },
    tabs: {
      flexDirection: 'row',
      paddingHorizontal: rnSpacing['sm-loose'],
      paddingVertical: rnSpacing.sm,
      gap: rnSpacing['xs-loose'],
    },
    tab: {
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing['xs-loose'],
      borderRadius: rnRadius.xl,
      backgroundColor: tk.surface.card,
    },
    tabActive: { backgroundColor: tk.brand.cta },
    tabText: { fontSize: rnType.body.size, color: tk.text.secondary },
    tabTextActive: { color: tk.surface.light },
    listBody: { padding: rnSpacing['sm-loose'], paddingBottom: rnSpacing['3xl'] },
    separator: { height: 12 },
    card: {
      padding: rnSpacing.md,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.bg,
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    cardTitle: {
      flex: 1,
      fontSize: rnType.title.size,
      fontWeight: '600',
      color: tk.text.primary,
      marginRight: rnSpacing.sm,
    },
    statusBadge: {
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: rnSpacing['2xs'],
      borderRadius: rnRadius.md,
    },
    statusText: { fontSize: rnType.caption.size, color: tk.surface.light },
    cardMeta: { marginTop: rnSpacing.sm, fontSize: rnType.body.size, color: tk.text.secondary },
    cardMetaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: rnSpacing.sm },
    cardMetaText: { fontSize: rnType.caption.size, color: tk.text.tertiary },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing.md,
    },
    footerText: { fontSize: rnType.caption.size, color: tk.text.tertiary },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
