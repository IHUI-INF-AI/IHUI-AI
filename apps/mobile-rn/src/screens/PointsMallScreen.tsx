import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { useCallback, useState } from 'react'
import { Alert, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { useI18n } from '../i18n'
import { usePaginatedList } from '../hooks'
import type { RootStackParamList } from '../navigation/RootNavigator'

import { Loading } from '@ihui/ui-native'
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
  const navigation = useNavigation<NavigationProp>()
  const [balance, setBalance] = useState(0)
  const [redeemingId, setRedeemingId] = useState<string | null>(null)

  const fetcher = useCallback(async () => {
    const res = await fetchApi<ProductPage>('/points-mall', {
      params: { page: 1, pageSize: PAGE_SIZE },
    })
    if (!res.success) return { success: false as const, error: t('pointsMall.loadFailed') }
    const page = res.data
    const list = page?.list ?? []
    if (typeof page?.balance === 'number') setBalance(page.balance)
    return { success: true as const, data: { list, total: page?.total ?? list.length } }
  }, [t])

  const { items, loading, refreshing, error, refresh } = usePaginatedList<Product>(fetcher, PAGE_SIZE)

  const handleRedeem = async (item: Product) => {
    if (balance < item.pointsCost) {
      Alert.alert(t('pointsMall.redeemFailed'), t('pointsMall.insufficient'))
      return
    }
    setRedeemingId(item.id)
    const res = await fetchApi<{ ok: boolean }>(`/points-mall/${item.id}/redeem`, {
      method: 'POST',
    })
    setRedeemingId(null)
    if (res.success) {
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
          <Loading />
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.surface.bg },
  header: { paddingHorizontal: 16, paddingTop: 48, paddingBottom: 8 },
  backBtn: { marginBottom: 4 },
  backText: { fontSize: 14, color: tokens.text.secondary },
  title: { fontSize: 22, fontWeight: '600', color: tokens.text.primary },
  subtitle: { marginTop: 4, fontSize: 13, color: tokens.text.secondary },
  balanceCard: { marginHorizontal: 16, marginBottom: 12, padding: 16, borderRadius: 8, backgroundColor: tokens.success.light, alignItems: 'center' },
  balanceLabel: { fontSize: 12, color: tokens.success.deepText },
  balanceValue: { marginTop: 4, fontSize: 28, fontWeight: '700', color: tokens.success.DEFAULT },
  errorBar: { paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  errorText: { fontSize: 12, color: tokens.danger.DEFAULT },
  retryText: { fontSize: 12, color: tokens.success.DEFAULT },
  center: { alignItems: 'center', paddingVertical: 32 },
  emptyText: { fontSize: 12, color: tokens.text.tertiary, marginTop: 8 },
  card: { width: '48%', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: tokens.border.light, backgroundColor: tokens.surface.bg },
  coverPlaceholder: { height: 80, borderRadius: 8, backgroundColor: tokens.surface.muted, alignItems: 'center', justifyContent: 'center' },
  coverEmoji: { fontSize: 32 },
  productName: { marginTop: 6, fontSize: 13, fontWeight: '600', color: tokens.text.primary, minHeight: 36 },
  productDesc: { fontSize: 11, color: tokens.text.tertiary, marginTop: 2 },
  pointsCost: { marginTop: 4, fontSize: 14, fontWeight: '700', color: tokens.success.DEFAULT },
  stockText: { fontSize: 10, color: tokens.text.tertiary, marginTop: 2 },
  redeemBtn: { marginTop: 8, paddingVertical: 6, borderRadius: 8, backgroundColor: tokens.success.DEFAULT, alignItems: 'center' },
  redeemBtnDisabled: { backgroundColor: tokens.border.light },
  redeemBtnText: { fontSize: 12, color: tokens.surface.light },
})
