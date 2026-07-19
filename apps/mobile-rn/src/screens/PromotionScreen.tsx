import { useCallback, useEffect, useState } from 'react'
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Card } from '@ihui/ui-native'
import { useI18n } from '../i18n'
import { useAuth } from '../context/AuthContext'
import { API_BASE_URL } from '../lib/config'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

type CouponStatus = 'available' | 'used' | 'expired'

interface Coupon {
  id: string
  name: string
  amount: number
  minSpend: number
  expireDate: string
  status: CouponStatus
}

function statusColor(status: CouponStatus): string {
  if (status === 'available') return '#10B981'
  if (status === 'used') return '#9CA3AF'
  return '#DC2626'
}

export function PromotionScreen() {
  const { t } = useI18n()
  const { token } = useAuth()
  const navigation = useNavigation<NavigationProp>()
  const [items, setItems] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const resp = await fetch(`${API_BASE_URL}/api/coupons`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!resp.ok) throw new Error('http')
      const data = (await resp.json()) as { data?: Coupon[] }
      setItems(data.data ?? [])
    } catch {
      setError(t('promotion.loadFailed'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [token, t])

  useEffect(() => {
    void load()
  }, [load])

  const onRefresh = () => {
    setRefreshing(true)
    void load()
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('promotion.title')}</Text>
      </View>
      {error ? (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.muted}>{t('common.loading')}</Text>
            </View>
          ) : (
            <View style={styles.emptyWrap}>
              <Text style={styles.muted}>{t('promotion.empty')}</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <View style={styles.row}>
              <View style={styles.amountBox}>
                <Text style={styles.amountText}>¥{item.amount}</Text>
                <Text style={styles.minSpend}>{t('promotion.minSpend')}: ¥{item.minSpend}</Text>
              </View>
              <View style={styles.body}>
                <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.expire}>{t('promotion.expireDate')}: {item.expireDate}</Text>
                <View style={[styles.badge, { backgroundColor: statusColor(item.status) }]}>
                  <Text style={styles.badgeText}>{t(`promotion.status_${item.status}`)}</Text>
                </View>
              </View>
              {item.status === 'available' ? (
                <TouchableOpacity style={styles.useBtn}>
                  <Text style={styles.useText}>{t('promotion.useNow')}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </Card>
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  backText: { fontSize: 14, color: '#374151' },
  title: { fontSize: 18, fontWeight: '600', color: '#111827' },
  errorBar: { paddingHorizontal: 16, paddingVertical: 8 },
  errorText: { fontSize: 12, color: '#DC2626' },
  card: { padding: 12, borderRadius: 8 },
  row: { flexDirection: 'row', alignItems: 'center' },
  amountBox: { width: 80, alignItems: 'center' },
  amountText: { fontSize: 18, fontWeight: '700', color: '#10B981' },
  minSpend: { marginTop: 4, fontSize: 10, color: '#9CA3AF' },
  body: { flex: 1, marginLeft: 12 },
  itemName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  expire: { marginTop: 4, fontSize: 11, color: '#9CA3AF' },
  badge: { alignSelf: 'flex-start', marginTop: 6, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  badgeText: { fontSize: 10, color: '#FFFFFF' },
  useBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#10B981' },
  useText: { fontSize: 12, color: '#FFFFFF' },
  emptyWrap: { alignItems: 'center', paddingVertical: 48 },
  muted: { fontSize: 12, color: '#6B7280' },
})
