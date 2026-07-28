import { rnLightTokens as tokens } from '@ihui/design-tokens'
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
import { fetchApi } from '@ihui/api-client'
import { usePaginatedList } from '../hooks'
import { formatDateOnly } from '@ihui/shared/utils/date-utils'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { Card } from '@ihui/ui-native'

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

const COUPON_TAB_KEYS: Record<CouponItem['status'], string> = {
  available: 'coupon.tab_available',
  used: 'coupon.tab_used',
  expired: 'coupon.tab_expired',
}

function statusColor(status: CouponItem['status']): string {
  if (status === 'available') return '#10B981'
  if (status === 'used') return '#9CA3AF'
  return '#DC2626'
}

export function CouponScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [statusTab, setStatusTab] = useState<(typeof STATUS_TABS)[number]>('available')

  const fetcher = useCallback(async () => {
    const res = await fetchApi<CouponPage>('/coupons', {
      params: { page: 1, pageSize: PAGE_SIZE, status: statusTab },
    })
    if (!res.success) return { success: false as const, error: t('coupon.loadFailed') }
    const list = res.data?.list ?? []
    return { success: true as const, data: { list, total: res.data?.total ?? list.length } }
  }, [statusTab, t])

  const { items, loading, refreshing, error, refresh } = usePaginatedList<CouponItem>(
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
              {t(COUPON_TAB_KEYS[s])}
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
            <Card className="flex-row overflow-hidden p-0">
              <View style={styles.cardLeft}>
                <Text style={styles.amountText}>¥{item.amount}</Text>
                <Text style={styles.minText}>
                  {t('coupon.minSpend', { amount: item.minSpend })}
                </Text>
              </View>
              <View style={styles.cardRight}>
                <Text style={styles.cardName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.validText}>
                  {t('coupon.validUntil')}: {formatDateOnly(item.validUntil)}
                </Text>
                <View style={[styles.statusBadge, { backgroundColor: statusColor(item.status) }]}>
                  <Text style={styles.statusText}>{t(COUPON_TAB_KEYS[item.status])}</Text>
                </View>
              </View>
            </Card>
          )}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.surface.bg },
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
  errorText: { fontSize: 12, color: tokens.danger.DEFAULT },
  retryText: { fontSize: 12, color: tokens.success.DEFAULT },
  center: { alignItems: 'center', paddingVertical: 32 },
  emptyText: { fontSize: 12, color: tokens.text.tertiary, marginTop: 8 },
  card: {
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tokens.border.light,
    overflow: 'hidden',
    backgroundColor: tokens.surface.bg,
  },
  cardLeft: {
    width: 96,
    padding: 12,
    backgroundColor: tokens.success.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  amountText: { fontSize: 22, fontWeight: '700', color: tokens.success.DEFAULT },
  minText: { marginTop: 4, fontSize: 11, color: tokens.text.secondary, textAlign: 'center' },
  cardRight: { flex: 1, padding: 12 },
  cardName: { fontSize: 14, fontWeight: '600', color: tokens.text.primary },
  validText: { marginTop: 4, fontSize: 11, color: tokens.text.tertiary },
  statusBadge: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusText: { fontSize: 11, color: tokens.surface.light },
})
