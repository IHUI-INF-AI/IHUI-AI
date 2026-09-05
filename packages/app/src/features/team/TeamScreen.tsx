// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type {
  TeamMemberStatus,
  TeamRelation,
  TeamSortTab,
  TeamTab,
  TeamStats,
  TeamMember,
  TeamScreenProps,
} from '../../types'

export type { TeamMemberStatus, TeamRelation, TeamSortTab, TeamTab, TeamStats, TeamMember, TeamScreenProps }

const TAB_KEYS: TeamTab[] = ['all', 'direct', 'indirect']

const TAB_LABELS: Record<TeamTab, string> = {
  all: 'team.tab_all',
  direct: 'team.tab_direct',
  indirect: 'team.tab_indirect',
}

const STATUS_LABELS: Record<TeamMemberStatus, string> = {
  active: 'team.status_active',
  inactive: 'team.status_inactive',
}

function initials(name: string): string {
  if (!name) return '?'
  return name.slice(0, 1).toUpperCase()
}

/**
 * 团队共享屏 — props 注入式跨端组件
 *
 * 平台无关:渲染 header + 统计卡片 + tabs + 成员 FlatList(下拉刷新)。
 * 平台特定(导航 / API 调用 / 日期格式化)由 wrapper 通过 props 注入。
 */
export function TeamScreen({
  t,
  stats,
  members,
  activeTab,
  loading,
  refreshing,
  error,
  onSelectTab,
  onRefresh,
  onBack,
  onPressMember,
  keyword,
  onKeywordChange,
  sortTab,
  onSelectSortTab,
  selectedDate,
  onSelectDate,
  onLoadMore,
  loadingMore,
  hasMore,
  colorScheme = 'light',
}: TeamScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={tk.brand.DEFAULT} />
        <Text style={styles.emptyText}>{t('common.loading')}</Text>
      </View>
    )
  }

  if (error && !stats) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={onRefresh}>
          <Text style={styles.retryBtnText}>{t('team.retry')}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  // 搜索过滤(对齐 Uniapp InputArea「搜索我的团友」handleSearch:昵称关键字过滤)
  const kw = keyword?.trim().toLowerCase() ?? ''
  const filtered = (
    activeTab === 'all' ? members : members.filter((m) => m.relation === activeTab)
  ).filter((m) => !kw || m.nickname.toLowerCase().includes(kw))

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onBack}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('team.title')}</Text>
        <Text style={styles.subtitle}>{t('team.subtitle')}</Text>
      </View>

      {stats ? (
        <View style={styles.statsCard}>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.totalMembers}</Text>
              <Text style={styles.statLabel}>{t('team.totalMembers')}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.activeMembers}</Text>
              <Text style={styles.statLabel}>{t('team.activeMembers')}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.directCount}</Text>
              <Text style={styles.statLabel}>{t('team.directCount')}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.indirectCount}</Text>
              <Text style={styles.statLabel}>{t('team.indirectCount')}</Text>
            </View>
          </View>
          <View style={styles.contributionBox}>
            <Text style={styles.contributionLabel}>{t('team.totalContribution')}</Text>
            <Text style={styles.contributionValue}>¥{stats.totalContribution}</Text>
          </View>
        </View>
      ) : null}

      <View style={styles.tabs}>
        {TAB_KEYS.map((tabKey) => (
          <TouchableOpacity
            key={tabKey}
            onPress={() => onSelectTab(tabKey)}
            style={[styles.tab, activeTab === tabKey && styles.tabActive]}
          >
            <Text style={[styles.tabText, activeTab === tabKey && styles.tabTextActive]}>
              {t(TAB_LABELS[tabKey])}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 搜索框(对齐 Uniapp distribution_personnel_list InputArea「搜索我的团友」;未注入回调则不渲染) */}
      {onKeywordChange ? (
        <View style={styles.searchRow}>
          <TextInput
            value={keyword ?? ''}
            onChangeText={onKeywordChange}
            placeholder={t('team.searchPlaceholder')}
            placeholderTextColor={tk.text.tertiary}
            style={styles.searchInput}
            returnKeyType="search"
          />
        </View>
      ) : null}

      {/* 排序行(对齐 Uniapp function_buttons_container:成交订单数 / 邀请时间+日期筛选;未注入回调则不渲染) */}
      {onSelectSortTab ? (
        <View style={styles.sortRow}>
          <TouchableOpacity
            style={[styles.sortBtn, sortTab === 'orderNum' && styles.sortBtnActive]}
            onPress={() => onSelectSortTab('orderNum')}
            accessibilityLabel={t('team.sortByOrders')}
          >
            <Text
              style={[styles.sortBtnText, sortTab === 'orderNum' && styles.sortBtnTextActive]}
              numberOfLines={1}
            >
              {t('team.sortByOrders')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sortBtn, sortTab === 'inviteTime' && styles.sortBtnActive]}
            onPress={() => onSelectSortTab('inviteTime')}
            accessibilityLabel={t('team.sortByInviteTime')}
          >
            <Text
              style={[styles.sortBtnText, sortTab === 'inviteTime' && styles.sortBtnTextActive]}
              numberOfLines={1}
            >
              {sortTab === 'inviteTime' && selectedDate ? selectedDate : t('team.sortByInviteTime')}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* 邀请时间日期输入(对齐 Uniapp picker mode=date;RN 无 datetimepicker 依赖,用 YYYY-MM-DD 文本输入等效实现) */}
      {onSelectSortTab && onSelectDate && sortTab === 'inviteTime' ? (
        <View style={styles.dateRow}>
          <TextInput
            value={selectedDate ?? ''}
            onChangeText={onSelectDate}
            placeholder={t('team.datePlaceholder')}
            placeholderTextColor={tk.text.tertiary}
            style={styles.dateInput}
            returnKeyType="done"
          />
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <FlatList<TeamMember>
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listBody}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        onEndReached={onLoadMore && hasMore !== false ? () => onLoadMore() : undefined}
        onEndReachedThreshold={0.2}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.emptyText}>{t('team.empty')}</Text>
          </View>
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footerLoading}>
              <ActivityIndicator size="small" color={tk.brand.DEFAULT} />
              <Text style={styles.footerText}>{t('common.loading')}</Text>
            </View>
          ) : null
        }
        renderItem={({ item, index }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => onPressMember?.(item.id)}
            disabled={!onPressMember}
            activeOpacity={0.7}
          >
            {/* 排名奖牌(对齐 Uniapp medal No{n}@3x 徽标) */}
            <View style={styles.rankBadge}>
              <Text style={styles.rankText}>{`No${index + 1}`}</Text>
            </View>
            <View style={styles.avatarBox}>
              {item.avatar ? (
                <Image source={{ uri: item.avatar }} style={styles.avatarImg} />
              ) : (
                <Text style={styles.avatarInitial}>{initials(item.nickname)}</Text>
              )}
            </View>
            <View style={styles.memberInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.memberName} numberOfLines={1}>
                  {item.nickname}
                </Text>
                <View
                  style={[
                    styles.relationBadge,
                    item.relation === 'direct' && styles.relationDirect,
                  ]}
                >
                  <Text style={styles.relationText}>{t(TAB_LABELS[item.relation])}</Text>
                </View>
              </View>
              {/* 业绩行(对齐 Uniapp person-info:成交额/获取佣金/成交订单数/邀请时间) */}
              <View style={styles.txRow}>
                <Text style={styles.txLabel} numberOfLines={1}>
                  {t('teamDetail.transactionVolume')}：
                  <Text style={styles.txHighlight}>{fenToYuan(item.transactionVolume)}</Text>
                </Text>
                <Text style={styles.txLabel} numberOfLines={1}>
                  {t('teamDetail.commission')}：
                  <Text style={styles.txHighlight}>{fenToYuan(item.commission)}</Text>
                </Text>
              </View>
              <Text style={styles.txLabel}>
                {t('teamDetail.orderNum')}：
                <Text style={styles.txHighlight}>{item.orderNum ?? 0}</Text>
              </Text>
              <Text style={styles.txLabel}>
                {t('team.sortByInviteTime')}：
                <Text style={styles.txDate}>{item.joinDate}</Text>
              </Text>
            </View>
            <View style={styles.memberRight}>
              <View
                style={[
                  styles.statusBadge,
                  item.status === 'active' ? styles.statusActive : styles.statusInactive,
                ]}
              >
                <Text style={styles.statusText}>{t(STATUS_LABELS[item.status])}</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  )
}

/** 分→元格式化(对齐 Uniapp formatToYuan:(value/100).toFixed(2)) */
function fenToYuan(value: number | undefined): string {
  if (!value) return '0.00'
  return (value / 100).toFixed(2)
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    center: { alignItems: 'center', paddingVertical: 32, justifyContent: 'center' },
    emptyText: { fontSize: 14, color: tk.text.tertiary, marginTop: 8 },
    errorText: { fontSize: 14, color: tk.danger.DEFAULT },
    header: { paddingHorizontal: 10, paddingTop: 48, paddingBottom: 8 },
    backBtn: { marginBottom: 8 },
    backText: { fontSize: 16, color: tk.text.secondary },
    title: { fontSize: 24, fontWeight: '700', color: tk.text.primary },
    subtitle: { marginTop: 8, fontSize: 14, color: tk.text.secondary },
    statsCard: {
      marginHorizontal: 10,
      padding: 14,
      borderRadius: 12,
      backgroundColor: tk.success.light,
    },
    statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
    statItem: { alignItems: 'center', flex: 1 },
    statValue: { fontSize: 20, fontWeight: '700', color: tk.success.DEFAULT },
    statLabel: { marginTop: 8, fontSize: 10, color: tk.success.deepText, textAlign: 'center' },
    contributionBox: {
      marginTop: 12,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: tk.surface.bg,
      alignItems: 'center',
    },
    contributionLabel: { fontSize: 11, color: tk.text.secondary },
    contributionValue: { marginTop: 8, fontSize: 20, fontWeight: '700', color: tk.success.DEFAULT },
    tabs: { flexDirection: 'row', paddingHorizontal: 10, paddingVertical: 8, gap: 6 },
    // ── 排序行(对齐 Uniapp function_buttons_container:高 70rpx、圆角 15rpx、激活黑描边) ──
    sortRow: { flexDirection: 'row', paddingHorizontal: 10, paddingTop: 10, gap: 10 },
    sortBtn: {
      flex: 1,
      height: 35, // 对齐 Uniapp function_button height: 70rpx
      borderRadius: 8, // 对齐 border-radius: 15rpx
      borderWidth: 1,
      borderColor: '#d1d1d1',
      backgroundColor: '#ffffff',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 10, // 对齐 padding: 10rpx
    },
    sortBtnActive: { borderColor: '#000000' }, // 对齐 &.active border: 1px solid #000
    sortBtnText: {
      fontSize: 15, // 对齐 .button_text font-size: 30rpx
      fontWeight: '700',
      color: '#d1d1d1',
    },
    sortBtnTextActive: { color: '#000000' }, // 对齐 &.active .button_text color: #000
    // ── 邀请时间日期输入(等效 Uniapp picker mode=date) ──
    dateRow: { paddingHorizontal: 10, paddingTop: 8 },
    dateInput: {
      height: 35,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
      paddingHorizontal: 12,
      fontSize: 14,
      color: tk.text.primary,
    },
    searchRow: { paddingHorizontal: 10, paddingBottom: 8 },
    searchInput: {
      height: 40,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
      paddingHorizontal: 12,
      fontSize: 14,
      color: tk.text.primary,
    },
    tab: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
      backgroundColor: tk.surface.card,
    },
    tabActive: { backgroundColor: tk.brand.DEFAULT },
    tabText: { fontSize: 14, color: tk.text.secondary },
    tabTextActive: { color: tk.surface.light },
    errorBar: { paddingHorizontal: 10, paddingVertical: 8 },
    listBody: { padding: 14, paddingBottom: 32 },
    separator: { height: 8 },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.bg,
    },
    avatarBox: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: tk.surface.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarImg: { width: '100%', height: '100%', borderRadius: 22 },
    avatarInitial: { fontSize: 18, fontWeight: '600', color: tk.text.secondary },
    memberInfo: { flex: 1, marginLeft: 10, marginRight: 8 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    memberName: { fontSize: 16, fontWeight: '600', color: tk.text.primary, flex: 1 },
    relationBadge: {
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: 12,
      backgroundColor: tk.surface.card,
    },
    relationDirect: { backgroundColor: tk.success.light },
    relationText: { fontSize: 10, color: tk.text.secondary },
    memberMeta: { marginTop: 8, fontSize: 11, color: tk.text.tertiary },
    // ── person-card 业绩行(对齐 Uniapp person-info:28rpx 字号、gap 8rpx、高亮 #ff9800) ──
    txRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
    txLabel: { fontSize: 14, color: '#3D3D3D', marginTop: 2 }, // 对齐 font-size: 28rpx
    txHighlight: { color: '#ff9800', fontWeight: '700', fontSize: 15 }, // 对齐 .highlight 42rpx≈21 取 15 保行高均衡
    txDate: { color: '#222222', fontWeight: '700', fontSize: 14 }, // 对齐 .bold
    // ── 排名奖牌(对齐 Uniapp medal No{n} 徽标:头像左上角) ──
    rankBadge: {
      position: 'absolute',
      left: 0,
      top: 0,
      minWidth: 30, // 对齐 medal-img width: 70rpx
      height: 16,
      borderRadius: 8,
      backgroundColor: '#ff9800',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
      zIndex: 2,
    },
    rankText: { fontSize: 10, fontWeight: '700', color: '#ffffff' },
    // ── 触底加载指示器(对齐 Uniapp loading-more) ──
    footerLoading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
    footerText: { marginLeft: 6, fontSize: 12, color: tk.text.tertiary },
    memberRight: { alignItems: 'flex-end' },
    contributionText: { fontSize: 14, fontWeight: '600', color: tk.success.DEFAULT },
    statusBadge: { marginTop: 8, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8 },
    statusActive: { backgroundColor: tk.success.light },
    statusInactive: { backgroundColor: tk.surface.card },
    statusText: { fontSize: 10, color: tk.text.secondary },
    retryBtn: {
      marginTop: 12,
      paddingHorizontal: 10,
      height: 44,
      justifyContent: 'center',
      borderRadius: 12,
      backgroundColor: tk.brand.DEFAULT,
    },
    retryBtnText: { color: tk.surface.light, fontSize: 14 },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
