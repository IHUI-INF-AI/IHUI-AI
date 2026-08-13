import { useMemo } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type {
  TeamMemberStatus,
  TeamRelation,
  TeamTab,
  TeamStats,
  TeamMember,
  TeamScreenProps,
} from '../../types'

export type { TeamMemberStatus, TeamRelation, TeamTab, TeamStats, TeamMember, TeamScreenProps }

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

  const filtered = activeTab === 'all' ? members : members.filter((m) => m.relation === activeTab)

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
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.emptyText}>{t('team.empty')}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => onPressMember?.(item.id)}
            disabled={!onPressMember}
            activeOpacity={0.7}
          >
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
              <Text style={styles.memberMeta}>
                {t('team.joinDate')}: {item.joinDate}
              </Text>
              <Text style={styles.memberMeta}>
                {t('team.level')}: L{item.level}
              </Text>
            </View>
            <View style={styles.memberRight}>
              <Text style={styles.contributionText}>+¥{item.contribution}</Text>
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

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    center: { alignItems: 'center', paddingVertical: 32, justifyContent: 'center' },
    emptyText: { fontSize: 12, color: tk.text.tertiary, marginTop: 8 },
    errorText: { fontSize: 12, color: tk.danger.DEFAULT },
    header: { paddingHorizontal: 16, paddingTop: 48, paddingBottom: 8 },
    backBtn: { marginBottom: 4 },
    backText: { fontSize: 14, color: tk.text.secondary },
    title: { fontSize: 22, fontWeight: '600', color: tk.text.primary },
    subtitle: { marginTop: 4, fontSize: 13, color: tk.text.secondary },
    statsCard: {
      marginHorizontal: 16,
      padding: 14,
      borderRadius: 8,
      backgroundColor: tk.success.light,
    },
    statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
    statItem: { alignItems: 'center', flex: 1 },
    statValue: { fontSize: 18, fontWeight: '700', color: tk.success.DEFAULT },
    statLabel: { marginTop: 4, fontSize: 10, color: tk.success.deepText, textAlign: 'center' },
    contributionBox: {
      marginTop: 12,
      paddingVertical: 10,
      borderRadius: 8,
      backgroundColor: tk.surface.bg,
      alignItems: 'center',
    },
    contributionLabel: { fontSize: 11, color: tk.text.secondary },
    contributionValue: { marginTop: 4, fontSize: 18, fontWeight: '700', color: tk.success.DEFAULT },
    tabs: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, gap: 6 },
    tab: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: tk.surface.card,
    },
    tabActive: { backgroundColor: tk.success.DEFAULT },
    tabText: { fontSize: 12, color: tk.text.secondary },
    tabTextActive: { color: tk.surface.light },
    errorBar: { paddingHorizontal: 16, paddingVertical: 8 },
    listBody: { padding: 16, paddingBottom: 32 },
    separator: { height: 8 },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.bg,
    },
    avatarBox: {
      width: 40,
      height: 40,
      borderRadius: 8,
      backgroundColor: tk.surface.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarImg: { width: '100%', height: '100%', borderRadius: 8 },
    avatarInitial: { fontSize: 16, fontWeight: '600', color: tk.text.secondary },
    memberInfo: { flex: 1, marginLeft: 10, marginRight: 8 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    memberName: { fontSize: 14, fontWeight: '600', color: tk.text.primary, flex: 1 },
    relationBadge: {
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: 8,
      backgroundColor: tk.surface.card,
    },
    relationDirect: { backgroundColor: tk.success.light },
    relationText: { fontSize: 10, color: tk.text.secondary },
    memberMeta: { marginTop: 3, fontSize: 11, color: tk.text.tertiary },
    memberRight: { alignItems: 'flex-end' },
    contributionText: { fontSize: 13, fontWeight: '600', color: tk.success.DEFAULT },
    statusBadge: { marginTop: 4, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8 },
    statusActive: { backgroundColor: tk.success.light },
    statusInactive: { backgroundColor: tk.surface.card },
    statusText: { fontSize: 10, color: tk.text.secondary },
    retryBtn: {
      marginTop: 12,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: tk.success.DEFAULT,
    },
    retryBtnText: { color: tk.surface.light, fontSize: 13 },
  })
}
