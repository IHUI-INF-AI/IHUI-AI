import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
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

interface Product {
  id: string
  name: string
  description: string
  pointsCost: number
  stock: number
  cover: string | null
}

interface ProductPage {
  list: Product[]
  total: number
  balance: number
}

const PAGE_SIZE = 20

export function PointsMallScreen() {
  const { t } = useI18n()
  const { token } = useAuth()
  const navigation = useNavigation<NavigationProp>()
  const [balance, setBalance] = useState(0)
  const [redeemingId, setRedeemingId] = useState<string | null>(null)

  const fetcher = useCallback(async () => {
    const resp = await fetch(`${API_BASE_URL}/api/points-mall?page=1&pageSize=${PAGE_SIZE}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!resp.ok) return { success: false as const, error: t('pointsMall.loadFailed') }
    const data = (await resp.json()) as { data?: ProductPage }
    const list = data.data?.list ?? []
    if (typeof data.data?.balance === 'number') setBalance(data.data.balance)
    return { success: true as const, data: { list, total: data.data?.total ?? list.length } }
  }, [token, t])

  const { items, loading, refreshing, error, refresh } = usePaginatedList<Product>(fetcher, PAGE_SIZE)

  const handleRedeem = async (item: Product) => {
    if (balance < item.pointsCost) {
      Alert.alert(t('pointsMall.redeemFailed'), t('pointsMall.insufficient'))
      return
    }
    setRedeemingId(item.id)
    const resp = await fetch(`${API_BASE_URL}/api/points-mall/${item.id}/redeem`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    })
    setRedeemingId(null)
    if (resp.ok) {
      Alert.alert(t('pointsMall.redeemSuccess'), `${item.name}`)
      refresh()
    } else {
      Alert.alert(t('pointsMall.redeemFailed'), t('pointsMall.redeemFailed'))
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('pointsMall.title')}</Text>
        <Text style={styles.subtitle}>{t('pointsMall.subtitle')}</Text>
      </View>

      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>{t('pointsMall.balance')}</Text>
        <Text style={styles.balanceValue}>{balance}</Text>
      </View>

      {error ? (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={refresh}>
            <Text style={styles.retryText}>{t('pointsMall.retry')}</Text>
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
          numColumns={2}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          columnWrapperStyle={{ justifyContent: 'space-between', marginBottom: 10 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>{t('pointsMall.empty')}</Text>
            </View>
          }
          renderItem={({ item }) => {
            const canRedeem = balance >= item.pointsCost && item.stock > 0
            return (
              <View style={styles.card}>
                <View style={styles.coverPlaceholder}>
                  <Text style={styles.coverEmoji}>🎁</Text>
                </View>
                <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
                <Text style={styles.productDesc} numberOfLines={1}>{item.description}</Text>
                <Text style={styles.pointsCost}>{item.pointsCost} {t('pointsMall.pointsUnit')}</Text>
                <Text style={styles.stockText}>
                  {t('pointsMall.stock', { count: item.stock })}
                </Text>
                <TouchableOpacity
                  style={[styles.redeemBtn, !canRedeem && styles.redeemBtnDisabled]}
                  onPress={() => handleRedeem(item)}
                  disabled={!canRedeem || redeemingId === item.id}
                >
                  <Text style={styles.redeemBtnText}>
                    {redeemingId === item.id ? t('common.loading') : t('pointsMall.redeem')}
                  </Text>
                </TouchableOpacity>
              </View>
            )
          }}
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
  balanceCard: { marginHorizontal: 16, marginBottom: 12, padding: 16, borderRadius: 8, backgroundColor: '#ECFDF5', alignItems: 'center' },
  balanceLabel: { fontSize: 12, color: '#065F46' },
  balanceValue: { marginTop: 4, fontSize: 28, fontWeight: '700', color: PRIMARY },
  errorBar: { paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  errorText: { fontSize: 12, color: '#DC2626' },
  retryText: { fontSize: 12, color: PRIMARY },
  center: { alignItems: 'center', paddingVertical: 32 },
  emptyText: { fontSize: 12, color: '#9CA3AF', marginTop: 8 },
  card: { width: '48%', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF' },
  coverPlaceholder: { height: 80, borderRadius: 8, backgroundColor: '#F9FAFB', alignItems: 'center', justifyContent: 'center' },
  coverEmoji: { fontSize: 32 },
  productName: { marginTop: 6, fontSize: 13, fontWeight: '600', color: '#111827', minHeight: 36 },
  productDesc: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  pointsCost: { marginTop: 4, fontSize: 14, fontWeight: '700', color: PRIMARY },
  stockText: { fontSize: 10, color: '#9CA3AF', marginTop: 2 },
  redeemBtn: { marginTop: 8, paddingVertical: 6, borderRadius: 8, backgroundColor: PRIMARY, alignItems: 'center' },
  redeemBtnDisabled: { backgroundColor: '#E5E7EB' },
  redeemBtnText: { fontSize: 12, color: '#FFFFFF' },
})
