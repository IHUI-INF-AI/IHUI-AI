import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { useCallback, useEffect, useState } from 'react'
import {
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { useI18n } from '../i18n'
import { formatDateOnly } from '@ihui/shared/utils/date-utils'
import type { RootStackParamList } from '../navigation/RootNavigator'

import { Loading } from '@ihui/ui-native'
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

interface TeamStats {
  totalMembers: number
  activeMembers: number
  directCount: number
  indirectCount: number
  totalContribution: number
}

interface TeamMember {
  id: string
  nickname: string
  avatar: string | null
  level: number
  joinDate: string
  contribution: number
  status: 'active' | 'inactive'
  relation: 'direct' | 'indirect'
}

type TabKey = 'all' | 'direct' | 'indirect'

const TABS: TabKey[] = ['all', 'direct', 'indirect']

const TEAM_TAB_KEYS: Record<TabKey, string> = {
  all: 'team.tab_all',
  direct: 'team.tab_direct',
  indirect: 'team.tab_indirect',
}

const TEAM_STATUS_KEYS: Record<TeamMember['status'], string> = {
  active: 'team.status_active',
  inactive: 'team.status_inactive',
}

function initials(name: string): string {
  if (!name) return '?'
  return name.slice(0, 1).toUpperCase()
}

export function TeamScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [stats, setStats] = useState<TeamStats | null>(null)
  const [members, setMembers] = useState<TeamMember[]>([])
  const [activeTab, setActiveTab] = useState<TabKey>('all')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true)
      else setLoading(true)
      setError('')
      const [statsRes, membersRes] = await Promise.all([
        fetchApi<TeamStats>('/team/stats'),
        fetchApi<{ list: TeamMember[] }>('/team/members', {
          params: { page: 1, pageSize: 20 },
        }),
      ])
      if (!statsRes.success || !membersRes.success) {
        setError(t('team.loadFailed'))
        setLoading(false)
        setRefreshing(false)
        return
      }
      setStats(statsRes.data ?? null)
      setMembers(membersRes.data?.list ?? [])
      setLoading(false)
      setRefreshing(false)
    },
    [t],
  )

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <View style={styles.center}>
        <Loading />
        <Text style={styles.emptyText}>{t('common.loading')}</Text>
      </View>
    )
  }

  if (error && !stats) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => load()}>
          <Text style={styles.retryBtnText}>{t('team.retry')}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const filtered = activeTab === 'all' ? members : members.filter((m) => m.relation === activeTab)

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
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
        {TABS.map((s) => (
          <TouchableOpacity
            key={s}
            onPress={() => setActiveTab(s)}
            style={[styles.tab, activeTab === s && styles.tabActive]}
          >
            <Text style={[styles.tabText, activeTab === s && styles.tabTextActive]}>
              {t(TEAM_TAB_KEYS[s])}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {error ? (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.emptyText}>{t('team.empty')}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
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
                  <Text style={styles.relationText}>{t(TEAM_TAB_KEYS[item.relation])}</Text>
                </View>
              </View>
              <Text style={styles.memberMeta}>
                {t('team.joinDate')}: {formatDateOnly(item.joinDate)}
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
                <Text style={styles.statusText}>{t(TEAM_STATUS_KEYS[item.status])}</Text>
              </View>
            </View>
          </View>
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.surface.bg },
  center: { alignItems: 'center', paddingVertical: 32, justifyContent: 'center' },
  emptyText: { fontSize: 12, color: tokens.text.tertiary, marginTop: 8 },
  errorText: { fontSize: 12, color: tokens.danger.DEFAULT },
  header: { paddingHorizontal: 16, paddingTop: 48, paddingBottom: 8 },
  backBtn: { marginBottom: 4 },
  backText: { fontSize: 14, color: tokens.text.secondary },
  title: { fontSize: 22, fontWeight: '600', color: tokens.text.primary },
  subtitle: { marginTop: 4, fontSize: 13, color: tokens.text.secondary },
  statsCard: { marginHorizontal: 16, padding: 14, borderRadius: 8, backgroundColor: tokens.success.light },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  statItem: { alignItems: 'center', flex: 1 },
  statValue: { fontSize: 18, fontWeight: '700', color: tokens.success.DEFAULT },
  statLabel: { marginTop: 4, fontSize: 10, color: tokens.success.deepText, textAlign: 'center' },
  contributionBox: {
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: tokens.surface.bg,
    alignItems: 'center',
  },
  contributionLabel: { fontSize: 11, color: tokens.text.secondary },
  contributionValue: { marginTop: 4, fontSize: 18, fontWeight: '700', color: tokens.success.DEFAULT },
  tabs: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, gap: 6 },
  tab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: tokens.surface.card },
  tabActive: { backgroundColor: tokens.success.DEFAULT },
  tabText: { fontSize: 12, color: tokens.text.secondary },
  tabTextActive: { color: tokens.surface.light },
  errorBar: { paddingHorizontal: 16, paddingVertical: 8 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tokens.border.light,
    backgroundColor: tokens.surface.bg,
  },
  avatarBox: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: tokens.surface.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: { width: '100%', height: '100%', borderRadius: 8 },
  avatarInitial: { fontSize: 16, fontWeight: '600', color: tokens.text.secondary },
  memberInfo: { flex: 1, marginLeft: 10, marginRight: 8 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  memberName: { fontSize: 14, fontWeight: '600', color: tokens.text.primary, flex: 1 },
  relationBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    backgroundColor: tokens.surface.card,
  },
  relationDirect: { backgroundColor: tokens.success.light },
  relationText: { fontSize: 10, color: tokens.text.secondary },
  memberMeta: { marginTop: 3, fontSize: 11, color: tokens.text.tertiary },
  memberRight: { alignItems: 'flex-end' },
  contributionText: { fontSize: 13, fontWeight: '600', color: tokens.success.DEFAULT },
  statusBadge: { marginTop: 4, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8 },
  statusActive: { backgroundColor: tokens.success.light },
  statusInactive: { backgroundColor: tokens.surface.card },
  statusText: { fontSize: 10, color: tokens.text.secondary },
  retryBtn: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: tokens.success.DEFAULT,
  },
  retryBtnText: { color: tokens.surface.light, fontSize: 13 },
})
