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

interface RankItem {
  id: string
  rank: number
  nickname: string
  avatar: string | null
  points: number
  studyHours: number
  isMe: boolean
}

type RangeKey = 'weekly' | 'monthly' | 'allTime'

const RANGES: RangeKey[] = ['weekly', 'monthly', 'allTime']

function rankColor(rank: number): string {
  if (rank === 1) return '#F59E0B'
  if (rank === 2) return '#9CA3AF'
  if (rank === 3) return '#B45309'
  return '#6B7280'
}

function initials(name: string): string {
  if (!name) return '?'
  return name.slice(0, 1).toUpperCase()
}

export function RankingScreen() {
  const { t } = useI18n()
  const { token, user } = useAuth()
  const navigation = useNavigation<NavigationProp>()
  const [range, setRange] = useState<RangeKey>('weekly')
  const [list, setList] = useState<RankItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    setError('')
    const resp = await fetch(`${API_BASE_URL}/api/ranking?range=${range}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!resp.ok) {
      setError(t('ranking.loadFailed'))
      setLoading(false)
      setRefreshing(false)
      return
    }
    const data = (await resp.json()) as { data?: RankItem[] }
    setList(data.data ?? [])
    setLoading(false)
    setRefreshing(false)
  }, [token, range, t])

  useEffect(() => { void load() }, [load])

  const onRangeChange = (next: RangeKey) => {
    if (next === range) return
    setRange(next)
  }

  const top3 = list.slice(0, 3)
  const rest = list.slice(3)

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.emptyText}>{t('common.loading')}</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('ranking.title')}</Text>
        <Text style={styles.subtitle}>{t('ranking.subtitle')}</Text>
      </View>

      <View style={styles.tabs}>
        {RANGES.map((r) => (
          <TouchableOpacity
            key={r}
            onPress={() => onRangeChange(r)}
            style={[styles.tab, range === r && styles.tabActive]}
          >
            <Text style={[styles.tabText, range === r && styles.tabTextActive]}>
              {t(`ranking.range_${r}`)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {error ? (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => load()}>
            <Text style={styles.retryText}>{t('ranking.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {top3.length > 0 ? (
        <View style={styles.podiumRow}>
          {top3.map((item) => (
            <View key={item.id} style={[styles.podiumItem, item.rank === 1 && styles.podiumFirst]}>
              <View style={[styles.podiumAvatar, { borderColor: rankColor(item.rank) }]}>
                {item.avatar ? (
                  <Image source={{ uri: item.avatar }} style={styles.avatarImg} />
                ) : (
                  <Text style={styles.avatarInitial}>{initials(item.nickname)}</Text>
                )}
              </View>
              <Text style={styles.podiumName} numberOfLines={1}>{item.nickname || t('ranking.anonymous')}</Text>
              <Text style={styles.podiumPoints}>{item.points}</Text>
              <View style={[styles.rankBadge, { backgroundColor: rankColor(item.rank) }]}>
                <Text style={styles.rankBadgeText}>#{item.rank}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      <FlatList
        data={rest}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.emptyText}>{t('ranking.empty')}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.card, item.isMe && styles.cardMe]}>
            <Text style={[styles.rankText, { color: rankColor(item.rank) }]}>#{item.rank}</Text>
            <View style={[styles.listAvatar, { borderColor: rankColor(item.rank) }]}>
              {item.avatar ? (
                <Image source={{ uri: item.avatar }} style={styles.avatarImg} />
              ) : (
                <Text style={styles.avatarInitial}>{initials(item.nickname)}</Text>
              )}
            </View>
            <View style={styles.listInfo}>
              <Text style={styles.listName} numberOfLines={1}>
                {item.nickname || t('ranking.anonymous')}
                {item.isMe || item.id === user?.id ? ` (${t('ranking.me')})` : ''}
              </Text>
              <Text style={styles.listMeta}>
                {t('ranking.studyHours', { count: item.studyHours })}
              </Text>
            </View>
            <Text style={styles.listPoints}>{item.points}</Text>
          </View>
        )}
      />
    </View>
  )
}

const PRIMARY = '#10B981'

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { alignItems: 'center', paddingVertical: 32 },
  emptyText: { fontSize: 12, color: '#9CA3AF', marginTop: 8 },
  errorText: { fontSize: 12, color: '#DC2626' },
  header: { paddingHorizontal: 16, paddingTop: 48, paddingBottom: 8 },
  backBtn: { marginBottom: 4 },
  backText: { fontSize: 14, color: '#6B7280' },
  title: { fontSize: 22, fontWeight: '600', color: '#111827' },
  subtitle: { marginTop: 4, fontSize: 13, color: '#6B7280' },
  tabs: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, gap: 6 },
  tab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#F3F4F6' },
  tabActive: { backgroundColor: PRIMARY },
  tabText: { fontSize: 12, color: '#6B7280' },
  tabTextActive: { color: '#FFFFFF' },
  errorBar: { paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  retryText: { fontSize: 12, color: PRIMARY },
  podiumRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  podiumItem: { flex: 1, alignItems: 'center', padding: 12, borderRadius: 8, backgroundColor: '#F9FAFB' },
  podiumFirst: { backgroundColor: '#FEF3C7' },
  podiumAvatar: { width: 56, height: 56, borderRadius: 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  avatarImg: { width: '100%', height: '100%', borderRadius: 8 },
  avatarInitial: { fontSize: 22, fontWeight: '600', color: '#6B7280' },
  podiumName: { marginTop: 6, fontSize: 13, fontWeight: '600', color: '#111827' },
  podiumPoints: { marginTop: 2, fontSize: 12, color: PRIMARY },
  rankBadge: { marginTop: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  rankBadgeText: { fontSize: 11, color: '#FFFFFF' },
  card: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF' },
  cardMe: { borderColor: PRIMARY, backgroundColor: '#ECFDF5' },
  rankText: { width: 36, fontSize: 14, fontWeight: '700' },
  listAvatar: { width: 36, height: 36, borderRadius: 8, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB' },
  listInfo: { flex: 1, marginLeft: 10, marginRight: 8 },
  listName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  listMeta: { marginTop: 2, fontSize: 11, color: '#9CA3AF' },
  listPoints: { fontSize: 15, fontWeight: '700', color: PRIMARY },
})
