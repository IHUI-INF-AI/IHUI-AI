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
import { Loading } from '@ihui/ui-native'
import { fetchApi } from '@ihui/api-client'
import { useI18n } from '../i18n'
import { useAuth } from '../context/AuthContext'
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

const RANKING_RANGE_KEYS: Record<RangeKey, string> = {
  weekly: 'ranking.range_weekly',
  monthly: 'ranking.range_monthly',
  allTime: 'ranking.range_allTime',
}

function rankColor(rank: number): string {
  if (rank === 1) return tokens.warning.amber
  if (rank === 2) return tokens.text.tertiary
  if (rank === 3) return tokens.warning.amberText // TODO: custom color #B45309
  return tokens.text.secondary
}

function initials(name: string): string {
  if (!name) return '?'
  return name.slice(0, 1).toUpperCase()
}

export function RankingScreen() {
  const { t } = useI18n()
  const { user } = useAuth()
  const navigation = useNavigation<NavigationProp>()
  const [range, setRange] = useState<RangeKey>('weekly')
  const [list, setList] = useState<RankItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true)
      else setLoading(true)
      setError('')
      const resp = await fetchApi<RankItem[]>('/ranking', { params: { range } })
      if (!resp.success) {
        setError(t('ranking.loadFailed'))
        setLoading(false)
        setRefreshing(false)
        return
      }
      setList(resp.data ?? [])
      setLoading(false)
      setRefreshing(false)
    },
    [range, t],
  )

  useEffect(() => {
    void load()
  }, [load])

  const onRangeChange = (next: RangeKey) => {
    if (next === range) return
    setRange(next)
  }

  const top3 = list.slice(0, 3)
  const rest = list.slice(3)

  if (loading) {
    return (
      <View style={styles.center}>
        <Loading />
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
              {t(RANKING_RANGE_KEYS[r])}
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
              <Text style={styles.podiumName} numberOfLines={1}>
                {item.nickname || t('ranking.anonymous')}
              </Text>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.surface.bg },
  center: { alignItems: 'center', paddingVertical: 32 },
  emptyText: { fontSize: 12, color: tokens.text.tertiary, marginTop: 8 },
  errorText: { fontSize: 12, color: tokens.danger.DEFAULT },
  header: { paddingHorizontal: 16, paddingTop: 48, paddingBottom: 8 },
  backBtn: { marginBottom: 4 },
  backText: { fontSize: 14, color: tokens.text.secondary },
  title: { fontSize: 22, fontWeight: '600', color: tokens.text.primary },
  subtitle: { marginTop: 4, fontSize: 13, color: tokens.text.secondary },
  tabs: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, gap: 6 },
  tab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: tokens.surface.card },
  tabActive: { backgroundColor: tokens.success.DEFAULT },
  tabText: { fontSize: 12, color: tokens.text.secondary },
  tabTextActive: { color: tokens.surface.light },
  errorBar: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  retryText: { fontSize: 12, color: tokens.success.DEFAULT },
  podiumRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  podiumItem: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: tokens.surface.muted,
  },
  podiumFirst: { backgroundColor: tokens.warning.amberLight },
  podiumAvatar: {
    width: 56,
    height: 56,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.surface.bg,
  },
  avatarImg: { width: '100%', height: '100%', borderRadius: 8 },
  avatarInitial: { fontSize: 22, fontWeight: '600', color: tokens.text.secondary },
  podiumName: { marginTop: 6, fontSize: 13, fontWeight: '600', color: tokens.text.primary },
  podiumPoints: { marginTop: 2, fontSize: 12, color: tokens.success.DEFAULT },
  rankBadge: { marginTop: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  rankBadgeText: { fontSize: 11, color: tokens.surface.light },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tokens.border.light,
    backgroundColor: tokens.surface.bg,
  },
  cardMe: { borderColor: tokens.success.DEFAULT, backgroundColor: tokens.success.light },
  rankText: { width: 36, fontSize: 14, fontWeight: '700' },
  listAvatar: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.surface.muted,
  },
  listInfo: { flex: 1, marginLeft: 10, marginRight: 8 },
  listName: { fontSize: 14, fontWeight: '600', color: tokens.text.primary },
  listMeta: { marginTop: 2, fontSize: 11, color: tokens.text.tertiary },
  listPoints: { fontSize: 15, fontWeight: '700', color: tokens.success.DEFAULT },
})
