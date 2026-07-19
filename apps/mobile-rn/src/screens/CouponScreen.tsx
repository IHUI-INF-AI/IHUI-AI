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

interface CouponItem {
  id: string
  name: string
  amount: number
  minSpend: number
  validUntil: string
  status: 'available' | 'used' | 'expired'
}

interface CouponPage {
  list: CouponItem[]
  total: number
}

const PAGE_SIZE = 20
const STATUS_TABS = ['available', 'used', 'expired'] as const

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

function statusColor(status: CouponItem['status']): string {
  if (status === 'available') return '#10B981'
  if (status === 'used') return '#9CA3AF'
  return '#DC2626'
}

export function CouponScreen() {
  const { t } = useI18n()
  const { token } = useAuth()
  const navigation = useNavigation<NavigationProp>()
  const [statusTab, setStatusTab] = useState<(typeof STATUS_TABS)[number]>('available')

  const fetcher = useCallback(async () => {
    const params = new URLSearchParams({
      page: '1',
      pageSize: String(PAGE_SIZE),
      status: statusTab,
    })
    const resp = await fetch(`${API_BASE_URL}/api/coupons?${params.toString()}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!resp.ok) return { success: false as const, error: t('coupon.loadFailed') }
    const data = (await resp.json()) as { data?: CouponPage }
    const list = data.data?.list ?? []
    return { success: true as const, data: { list, total: data.data?.total ?? list.length } }
  }, [token, statusTab, t])

  const { items, loading, refreshing, error, refresh } = usePaginatedList<CouponItem>(fetcher, PAGE_SIZE)

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
        <Text style={styles.title}>{t('coupon.title')}</Text>
        <Text style={styles.subtitle}>{t('coupon.subtitle')}</Text>
      </View>

      <View style={styles.tabs}>
        {STATUS_TABS.map((s) => (
          <TouchableOpacity
            key={s}
            onPress={() => onTabChange(s)}
            style={[styles.tab, statusTab === s && styles.tabActive]}
          >
            <Text style={[styles.tabText, statusTab === s && styles.tabTextActive]}>
              {t(`coupon.tab_${s}`)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {error ? (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={refresh}>
            <Text style={styles.retryText}>{t('coupon.retry')}</Text>
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
              <Text style={styles.emptyText}>{t('coupon.empty')}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardLeft}>
                <Text style={styles.amountText}>¥{item.amount}</Text>
                <Text style={styles.minText}>
                  {t('coupon.minSpend', { amount: item.minSpend })}
                </Text>
              </View>
              <View style={styles.cardRight}>
                <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.validText}>
                  {t('coupon.validUntil')}: {formatDate(item.validUntil)}
                </Text>
                <View style={[styles.statusBadge, { backgroundColor: statusColor(item.status) }]}>
                  <Text style={styles.statusText}>{t(`coupon.tab_${item.status}`)}</Text>
                </View>
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
  card: { flexDirection: 'row', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden', backgroundColor: '#FFFFFF' },
  cardLeft: { width: 96, padding: 12, backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center' },
  amountText: { fontSize: 22, fontWeight: '700', color: PRIMARY },
  minText: { marginTop: 4, fontSize: 11, color: '#6B7280', textAlign: 'center' },
  cardRight: { flex: 1, padding: 12 },
  cardName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  validText: { marginTop: 4, fontSize: 11, color: '#9CA3AF' },
  statusBadge: { alignSelf: 'flex-start', marginTop: 6, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  statusText: { fontSize: 11, color: '#FFFFFF' },
})
