import { useCallback, useState } from 'react'
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useI18n } from '../i18n'
import { usePaginatedList } from '../hooks'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { formatShortDateTime } from '../utils/date-utils'

import { Card, Loading } from '@ihui/ui-native'
import { fetchApi } from '@ihui/api-client'
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

interface LiveItem {
  id: string
  title: string
  lecturer: string
  status: 'upcoming' | 'ongoing' | 'ended'
  startAt: string
  viewerCount: number
  cover: string | null
}

interface LivePage {
  list: LiveItem[]
  total: number
}

const PAGE_SIZE = 20
const STATUS_TABS = ['all', 'upcoming', 'ongoing', 'ended'] as const

const LIVE_TAB_KEYS: Record<(typeof STATUS_TABS)[number], string> = {
  all: 'liveList.tab_all',
  upcoming: 'liveList.tab_upcoming',
  ongoing: 'liveList.tab_ongoing',
  ended: 'liveList.tab_ended',
}

function statusColor(status: LiveItem['status']): string {
  if (status === 'ongoing') return '#10B981'
  if (status === 'upcoming') return '#F59E0B'
  return '#9CA3AF'
}

export function LiveListScreen() {
  const { t } = useI18n()
    const navigation = useNavigation<NavigationProp>()
  const [statusTab, setStatusTab] = useState<(typeof STATUS_TABS)[number]>('all')

  const fetcher = useCallback(async () => {
    const params = new URLSearchParams({
      page: '1',
      pageSize: String(PAGE_SIZE),
      status: statusTab,
    })
    const res = await fetchApi<LivePage>(`/live/list?${params.toString()}`)
    if (!res.success) return { success: false as const, error: t('liveList.loadFailed') }
    const list = res.data?.list ?? []
    return { success: true as const, data: { list, total: res.data?.total ?? list.length } }
  }, [statusTab, t])

  const { items, loading, refreshing, error, refresh } = usePaginatedList<LiveItem>(
    fetcher,
    PAGE_SIZE,
  )

  const onTabChange = (next: (typeof STATUS_TABS)[number]) => {
    if (next === statusTab) return
    setStatusTab(next)
    setTimeout(refresh, 0)
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('liveList.title')}</Text>
        <Text style={styles.subtitle}>{t('liveList.subtitle')}</Text>
      </View>

      <View style={styles.tabs}>
        {STATUS_TABS.map((s) => (
          <TouchableOpacity
            key={s}
            onPress={() => onTabChange(s)}
            style={[styles.tab, statusTab === s && styles.tabActive]}
          >
            <Text style={[styles.tabText, statusTab === s && styles.tabTextActive]}>
              {t(LIVE_TAB_KEYS[s])}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {error ? (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={refresh}>
            <Text style={styles.retryText}>{t('liveList.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {loading && items.length === 0 ? (
        <View style={styles.center}>
          <Loading />
          <Text style={styles.emptyText}>{t('common.loading')}</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>{t('liveList.empty')}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Card className="p-3">
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <View style={[styles.statusBadge, { backgroundColor: statusColor(item.status) }]}>
                  <Text style={styles.statusText}>{t(LIVE_TAB_KEYS[item.status])}</Text>
                </View>
              </View>
              <Text style={styles.cardMeta}>
                {t('liveList.lecturer')}: {item.lecturer}
              </Text>
              <View style={styles.cardMetaRow}>
                <Text style={styles.cardMetaText}>
                  {t('liveList.startAt')}: {formatShortDateTime(item.startAt) || '—'}
                </Text>
                <Text style={styles.cardMetaText}>
                  {t('liveList.viewerCount', { count: item.viewerCount })}
                </Text>
              </View>
            </Card>
          )}
        />
      )}
    </View>
  )
}

const PRIMARY = '#10B981'

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
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
  errorBar: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorText: { fontSize: 12, color: '#DC2626' },
  retryText: { fontSize: 12, color: PRIMARY },
  center: { alignItems: 'center', paddingVertical: 32 },
  emptyText: { fontSize: 12, color: '#9CA3AF', marginTop: 8 },
  card: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: '#111827', marginRight: 8 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  statusText: { fontSize: 11, color: '#FFFFFF' },
  cardMeta: { marginTop: 6, fontSize: 12, color: '#6B7280' },
  cardMetaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  cardMetaText: { fontSize: 11, color: '#9CA3AF' },
})
