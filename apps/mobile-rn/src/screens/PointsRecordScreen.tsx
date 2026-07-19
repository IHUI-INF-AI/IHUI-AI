import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
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
import { usePaginatedList } from '../hooks/use-paginated-list'
import { API_BASE_URL } from '../lib/config'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

interface PointsRecord {
  id: string
  amount: number
  type: 'earn' | 'spend'
  source: string
  balanceAfter: number
  createdAt: string
}

interface RecordPage {
  list: PointsRecord[]
  total: number
  balance: number
}

const PAGE_SIZE = 20
const TYPE_TABS = ['all', 'earn', 'spend'] as const

function formatDateTime(iso: string): string {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export function PointsRecordScreen() {
  const { t } = useI18n()
  const { token } = useAuth()
  const navigation = useNavigation<NavigationProp>()
  const [typeTab, setTypeTab] = useState<(typeof TYPE_TABS)[number]>('all')
  const [balance, setBalance] = useState(0)

  const fetcher = useCallback(async () => {
    const params = new URLSearchParams({
      page: '1',
      pageSize: String(PAGE_SIZE),
      type: typeTab,
    })
    const resp = await fetch(`${API_BASE_URL}/api/points/records?${params.toString()}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!resp.ok) return { success: false as const, error: t('pointsRecord.loadFailed') }
    const data = (await resp.json()) as { data?: RecordPage }
    const list = data.data?.list ?? []
    if (typeof data.data?.balance === 'number') setBalance(data.data.balance)
    return { success: true as const, data: { list, total: data.data?.total ?? list.length } }
  }, [token, typeTab, t])

  const { items, loading, refreshing, error, refresh } = usePaginatedList<PointsRecord>(fetcher, PAGE_SIZE)

  const onTabChange = (next: (typeof TYPE_TABS)[number]) => {
    if (next === typeTab) return
    setTypeTab(next)
    setTimeout(refresh, 0)
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('pointsRecord.title')}</Text>
        <Text style={styles.subtitle}>{t('pointsRecord.subtitle')}</Text>
      </View>

      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>{t('pointsRecord.balance')}</Text>
        <Text style={styles.balanceValue}>{balance}</Text>
      </View>

      <View style={styles.tabs}>
        {TYPE_TABS.map((s) => (
          <TouchableOpacity
            key={s}
            onPress={() => onTabChange(s)}
            style={[styles.tab, typeTab === s && styles.tabActive]}
          >
            <Text style={[styles.tabText, typeTab === s && styles.tabTextActive]}>
              {t(`pointsRecord.tab_${s}`)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {error ? (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={refresh}>
            <Text style={styles.retryText}>{t('pointsRecord.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {loading && items.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator />
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
              <Text style={styles.emptyText}>{t('pointsRecord.empty')}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.sourceText} numberOfLines={1}>{item.source}</Text>
                <Text style={[styles.amountText, item.type === 'earn' ? styles.earnText : styles.spendText]}>
                  {item.type === 'earn' ? '+' : '-'}{item.amount}
                </Text>
              </View>
              <View style={styles.cardMetaRow}>
                <Text style={styles.cardMetaText}>{formatDateTime(item.createdAt)}</Text>
                <Text style={styles.cardMetaText}>
                  {t('pointsRecord.balanceAfter')}: {item.balanceAfter}
                </Text>
              </View>
            </View>
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
  balanceCard: { marginHorizontal: 16, marginBottom: 8, padding: 16, borderRadius: 8, backgroundColor: '#ECFDF5', alignItems: 'center' },
  balanceLabel: { fontSize: 12, color: '#065F46' },
  balanceValue: { marginTop: 4, fontSize: 26, fontWeight: '700', color: PRIMARY },
  tabs: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, gap: 6 },
  tab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#F3F4F6' },
  tabActive: { backgroundColor: PRIMARY },
  tabText: { fontSize: 12, color: '#6B7280' },
  tabTextActive: { color: '#FFFFFF' },
  errorBar: { paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  errorText: { fontSize: 12, color: '#DC2626' },
  retryText: { fontSize: 12, color: PRIMARY },
  center: { alignItems: 'center', paddingVertical: 32 },
  emptyText: { fontSize: 12, color: '#9CA3AF', marginTop: 8 },
  card: { padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sourceText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#111827', marginRight: 8 },
  amountText: { fontSize: 16, fontWeight: '700' },
  earnText: { color: PRIMARY },
  spendText: { color: '#DC2626' },
  cardMetaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  cardMetaText: { fontSize: 11, color: '#9CA3AF' },
})
