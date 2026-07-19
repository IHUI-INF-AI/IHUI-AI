import { useCallback, useEffect, useState } from 'react'
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
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useI18n } from '../i18n'
import { useAuth } from '../context/AuthContext'
import { API_BASE_URL } from '../lib/config'
import type { RootStackParamList } from '../navigation/RootNavigator'

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

function initials(name: string): string {
  if (!name) return '?'
  return name.slice(0, 1).toUpperCase()
}

function formatDate(iso: string): string {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export function TeamScreen() {
  const { t } = useI18n()
  const { token } = useAuth()
  const navigation = useNavigation<NavigationProp>()
  const [stats, setStats] = useState<TeamStats | null>(null)
  const [members, setMembers] = useState<TeamMember[]>([])
  const [activeTab, setActiveTab] = useState<TabKey>('all')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    setError('')
    const [statsRes, membersRes] = await Promise.all([
      fetch(`${API_BASE_URL}/api/team/stats`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }),
      fetch(`${API_BASE_URL}/api/team/members?page=1&pageSize=20`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }),
    ])
    if (!statsRes.ok || !membersRes.ok) {
      setError(t('team.loadFailed'))
      setLoading(false)
      setRefreshing(false)
      return
    }
    const statsData = (await statsRes.json()) as { data?: TeamStats }
    const membersData = (await membersRes.json()) as { data?: { list: TeamMember[] } }
    setStats(statsData.data ?? null)
    setMembers(membersData.data?.list ?? [])
    setLoading(false)
    setRefreshing(false)
  }, [token, t])

  useEffect(() => { void load() }, [load])

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
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

  const filtered = activeTab === 'all'
    ? members
    : members.filter((m) => m.relation === activeTab)

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
              {t(`team.tab_${s}`)}
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
                <Text style={styles.memberName} numberOfLines={1}>{item.nickname}</Text>
                <View style={[styles.relationBadge, item.relation === 'direct' && styles.relationDirect]}>
                  <Text style={styles.relationText}>{t(`team.tab_${item.relation}`)}</Text>
                </View>
              </View>
              <Text style={styles.memberMeta}>
                {t('team.joinDate')}: {formatDate(item.joinDate)}
              </Text>
              <Text style={styles.memberMeta}>
                {t('team.level')}: L{item.level}
              </Text>
            </View>
            <View style={styles.memberRight}>
              <Text style={styles.contributionText}>+¥{item.contribution}</Text>
              <View style={[styles.statusBadge, item.status === 'active' ? styles.statusActive : styles.statusInactive]}>
                <Text style={styles.statusText}>{t(`team.status_${item.status}`)}</Text>
              </View>
            </View>
          </View>
        )}
      />
    </View>
  )
}

const PRIMARY = '#10B981'

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { alignItems: 'center', paddingVertical: 32, justifyContent: 'center' },
  emptyText: { fontSize: 12, color: '#9CA3AF', marginTop: 8 },
  errorText: { fontSize: 12, color: '#DC2626' },
  header: { paddingHorizontal: 16, paddingTop: 48, paddingBottom: 8 },
  backBtn: { marginBottom: 4 },
  backText: { fontSize: 14, color: '#6B7280' },
  title: { fontSize: 22, fontWeight: '600', color: '#111827' },
  subtitle: { marginTop: 4, fontSize: 13, color: '#6B7280' },
  statsCard: { marginHorizontal: 16, padding: 14, borderRadius: 8, backgroundColor: '#ECFDF5' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  statItem: { alignItems: 'center', flex: 1 },
  statValue: { fontSize: 18, fontWeight: '700', color: PRIMARY },
  statLabel: { marginTop: 4, fontSize: 10, color: '#065F46', textAlign: 'center' },
  contributionBox: { marginTop: 12, paddingVertical: 10, borderRadius: 8, backgroundColor: '#FFFFFF', alignItems: 'center' },
  contributionLabel: { fontSize: 11, color: '#6B7280' },
  contributionValue: { marginTop: 4, fontSize: 18, fontWeight: '700', color: PRIMARY },
  tabs: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, gap: 6 },
  tab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#F3F4F6' },
  tabActive: { backgroundColor: PRIMARY },
  tabText: { fontSize: 12, color: '#6B7280' },
  tabTextActive: { color: '#FFFFFF' },
  errorBar: { paddingHorizontal: 16, paddingVertical: 8 },
  card: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF' },
  avatarBox: { width: 40, height: 40, borderRadius: 8, backgroundColor: '#F9FAFB', alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: '100%', height: '100%', borderRadius: 8 },
  avatarInitial: { fontSize: 16, fontWeight: '600', color: '#6B7280' },
  memberInfo: { flex: 1, marginLeft: 10, marginRight: 8 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  memberName: { fontSize: 14, fontWeight: '600', color: '#111827', flex: 1 },
  relationBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8, backgroundColor: '#F3F4F6' },
  relationDirect: { backgroundColor: '#ECFDF5' },
  relationText: { fontSize: 10, color: '#6B7280' },
  memberMeta: { marginTop: 3, fontSize: 11, color: '#9CA3AF' },
  memberRight: { alignItems: 'flex-end' },
  contributionText: { fontSize: 13, fontWeight: '600', color: PRIMARY },
  statusBadge: { marginTop: 4, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8 },
  statusActive: { backgroundColor: '#ECFDF5' },
  statusInactive: { backgroundColor: '#F3F4F6' },
  statusText: { fontSize: 10, color: '#6B7280' },
  retryBtn: { marginTop: 12, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: PRIMARY },
  retryBtnText: { color: '#FFFFFF', fontSize: 13 },
})
