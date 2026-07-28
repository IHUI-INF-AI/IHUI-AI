import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { useCallback, useEffect, useState } from 'react'
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { fetchApi } from '@ihui/api-client'
import { Loading } from '@ihui/ui-native'
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

interface DistributionInfo {
  level: string
  commissionRate: number
  totalEarnings: number
  withdrawn: number
  pending: number
  withdrawMin: number
  products: DistributeProduct[]
}

interface DistributeProduct {
  id: string
  title: string
  commission: number
  salePrice: number
  sales: number
}

export function DistributionScreen() {
  const { t } = useI18n()
    const navigation = useNavigation<NavigationProp>()
  const [info, setInfo] = useState<DistributionInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [withdrawing, setWithdrawing] = useState(false)

  const load = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true)
      else setLoading(true)
      setError('')
      const res = await fetchApi<DistributionInfo>('/distribution/overview')
      if (!res.success) {
        setError(t('distribution.loadFailed'))
        setLoading(false)
        setRefreshing(false)
        return
      }
      setInfo(res.data ?? null)
      setLoading(false)
      setRefreshing(false)
    },
    [t],
  )

  useEffect(() => {
    void load()
  }, [load])

  const handleWithdraw = async () => {
    if (!info) return
    if (info.pending < info.withdrawMin) {
      Alert.alert(
        t('distribution.withdrawFailed'),
        t('distribution.withdrawMin', { amount: info.withdrawMin }),
      )
      return
    }
    setWithdrawing(true)
    const res = await fetchApi('/distribution/withdraw', { method: 'POST', body: JSON.stringify({ amount: info.pending }) })
    setWithdrawing(false)
    if (res.success) {
      Alert.alert(t('distribution.withdrawSuccess'))
      void load(true)
    } else {
      Alert.alert(t('distribution.withdrawFailed'))
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <Loading />
        <Text style={styles.emptyText}>{t('common.loading')}</Text>
      </View>
    )
  }

  if (error && !info) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => load()}>
          <Text style={styles.retryBtnText}>{t('distribution.retry')}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('distribution.title')}</Text>
        <Text style={styles.subtitle}>{t('distribution.subtitle')}</Text>
      </View>

      {info ? (
        <>
          <View style={styles.levelCard}>
            <View style={styles.levelRow}>
              <View>
                <Text style={styles.levelLabel}>{t('distribution.level')}</Text>
                <Text style={styles.levelValue}>{info.level}</Text>
              </View>
              <View style={styles.commissionBox}>
                <Text style={styles.commissionLabel}>{t('distribution.commissionRate')}</Text>
                <Text style={styles.commissionValue}>
                  {(info.commissionRate * 100).toFixed(1)}%
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.earningsCard}>
            <View style={styles.earningsRow}>
              <View style={styles.earningsItem}>
                <Text style={styles.earningsValue}>{info.totalEarnings}</Text>
                <Text style={styles.earningsLabel}>{t('distribution.totalEarnings')}</Text>
              </View>
              <View style={styles.earningsItem}>
                <Text style={styles.earningsValue}>{info.withdrawn}</Text>
                <Text style={styles.earningsLabel}>{t('distribution.withdrawn')}</Text>
              </View>
              <View style={styles.earningsItem}>
                <Text style={[styles.earningsValue, styles.pendingValue]}>{info.pending}</Text>
                <Text style={styles.earningsLabel}>{t('distribution.pending')}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[
                styles.withdrawBtn,
                info.pending < info.withdrawMin && styles.withdrawBtnDisabled,
              ]}
              onPress={handleWithdraw}
              disabled={info.pending < info.withdrawMin || withdrawing}
            >
              <Text style={styles.withdrawBtnText}>
                {withdrawing ? t('common.loading') : t('distribution.withdrawBtn')}
              </Text>
            </TouchableOpacity>
            <Text style={styles.withdrawHint}>
              {t('distribution.withdrawMin', { amount: info.withdrawMin })}
            </Text>
          </View>

          <Text style={styles.sectionTitle}>{t('distribution.products')}</Text>
          <View style={styles.productsList}>
            {info.products.length === 0 ? (
              <View style={styles.center}>
                <Text style={styles.emptyText}>{t('distribution.empty')}</Text>
              </View>
            ) : (
              info.products.map((item) => (
                <View key={item.id} style={styles.productCard}>
                  <Text style={styles.productTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <View style={styles.productMeta}>
                    <Text style={styles.productPrice}>¥{item.salePrice}</Text>
                    <Text style={styles.productCommission}>
                      {t('distribution.commission')}: ¥{item.commission}
                    </Text>
                    <Text style={styles.productSales}>
                      {t('distribution.sales', { count: item.sales })}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </>
      ) : (
        <View style={styles.center}>
          <Text style={styles.emptyText}>{t('distribution.empty')}</Text>
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.surface.bg },
  center: { alignItems: 'center', paddingVertical: 32 },
  emptyText: { fontSize: 12, color: tokens.text.tertiary, marginTop: 8 },
  errorText: { fontSize: 12, color: tokens.danger.DEFAULT, textAlign: 'center', marginTop: 4 },
  header: { paddingHorizontal: 16, paddingTop: 48, paddingBottom: 8 },
  backBtn: { marginBottom: 4 },
  backText: { fontSize: 14, color: tokens.text.secondary },
  title: { fontSize: 22, fontWeight: '600', color: tokens.text.primary },
  subtitle: { marginTop: 4, fontSize: 13, color: tokens.text.secondary },
  levelCard: { marginHorizontal: 16, padding: 16, borderRadius: 8, backgroundColor: tokens.success.light },
  levelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  levelLabel: { fontSize: 11, color: tokens.success.deepText },
  levelValue: { marginTop: 4, fontSize: 18, fontWeight: '700', color: tokens.success.DEFAULT },
  commissionBox: { alignItems: 'flex-end' },
  commissionLabel: { fontSize: 11, color: tokens.success.deepText },
  commissionValue: { marginTop: 4, fontSize: 18, fontWeight: '700', color: tokens.success.DEFAULT },
  earningsCard: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tokens.border.light,
  },
  earningsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  earningsItem: { alignItems: 'center', flex: 1 },
  earningsValue: { fontSize: 20, fontWeight: '700', color: tokens.text.primary },
  pendingValue: { color: tokens.success.DEFAULT },
  earningsLabel: { marginTop: 4, fontSize: 11, color: tokens.text.tertiary },
  withdrawBtn: {
    marginTop: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: tokens.success.DEFAULT,
    alignItems: 'center',
  },
  withdrawBtnDisabled: { backgroundColor: tokens.border.light },
  withdrawBtnText: { fontSize: 13, fontWeight: '600', color: tokens.surface.light },
  withdrawHint: { marginTop: 8, fontSize: 11, color: tokens.text.tertiary, textAlign: 'center' },
  sectionTitle: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    fontSize: 15,
    fontWeight: '600',
    color: tokens.text.primary,
  },
  productsList: { marginHorizontal: 16, marginBottom: 24 },
  productCard: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tokens.border.light,
    marginBottom: 8,
    backgroundColor: tokens.surface.bg,
  },
  productTitle: { fontSize: 14, fontWeight: '600', color: tokens.text.primary },
  productMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    gap: 8,
    flexWrap: 'wrap',
  },
  productPrice: { fontSize: 13, fontWeight: '600', color: tokens.success.DEFAULT },
  productCommission: { fontSize: 11, color: tokens.text.secondary },
  productSales: { fontSize: 11, color: tokens.text.tertiary },
  retryBtn: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: tokens.success.DEFAULT,
  },
  retryBtnText: { color: tokens.surface.light, fontSize: 13 },
})
