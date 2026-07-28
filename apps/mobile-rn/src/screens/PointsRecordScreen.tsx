import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { useCallback, useState } from 'react'
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { useI18n } from '../i18n'
import { usePaginatedList } from '../hooks'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { formatShortDateTime } from '../utils/date-utils'

import { Loading } from '@ihui/ui-native'
import type { PointRecord } from '@ihui/types'
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

interface PointsRecord extends Pick<PointRecord, 'id' | 'amount' | 'createdAt'> {
  type: 'earn' | 'spend'
  source: string
  balanceAfter: number
}

interface RecordPage {
  list: PointsRecord[]
  total: number
  balance: number
}

const PAGE_SIZE = 20
const TYPE_TABS = ['all', 'earn', 'spend'] as const

const POINTS_TAB_KEYS: Record<(typeof TYPE_TABS)[number], string> = {
  all: 'pointsRecord.tab_all',
  earn: 'pointsRecord.tab_earn',
  spend: 'pointsRecord.tab_spend',
}

export function PointsRecordScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [typeTab, setTypeTab] = useState<(typeof TYPE_TABS)[number]>('all')
  const [balance, setBalance] = useState(0)

  const fetcher = useCallback(async () => {
    const res = await fetchApi<RecordPage>('/points/records', {
      params: { page: 1, pageSize: PAGE_SIZE, type: typeTab },
    })
    if (!res.success) return { success: false as const, error: t('pointsRecord.loadFailed') }
    const page = res.data
    const list = page?.list ?? []
    if (typeof page?.balance === 'number') setBalance(page.balance)
    return { success: true as const, data: { list, total: page?.total ?? list.length } }
  }, [typeTab, t])

  const { items, loading, refreshing, error, refresh } = usePaginatedList<PointsRecord>(
    fetcher,
    PAGE_SIZE,
  )

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
              {t(POINTS_TAB_KEYS[s])}
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
              <Text style={styles.emptyText}>{t('pointsRecord.empty')}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.sourceText} numberOfLines={1}>
                  {item.source}
                </Text>
                <Text
                  style={[
                    styles.amountText,
                    item.type === 'earn' ? styles.earnText : styles.spendText,
                  ]}
                >
                  {item.type === 'earn' ? '+' : '-'}
                  {item.amount}
                </Text>
              </View>
              <View style={styles.cardMetaRow}>
                <Text style={styles.cardMetaText}>
                  {formatShortDateTime(item.createdAt) || '—'}
                </Text>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.surface.bg },
  header: { paddingHorizontal: 16, paddingTop: 48, paddingBottom: 8 },
  backBtn: { marginBottom: 4 },
  backText: { fontSize: 14, color: tokens.text.secondary },
  title: { fontSize: 22, fontWeight: '600', color: tokens.text.primary },
  subtitle: { marginTop: 4, fontSize: 13, color: tokens.text.secondary },
  balanceCard: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 8,
    backgroundColor: tokens.success.light,
    alignItems: 'center',
  },
  balanceLabel: { fontSize: 12, color: tokens.success.deepText },
  balanceValue: { marginTop: 4, fontSize: 26, fontWeight: '700', color: tokens.success.DEFAULT },
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
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tokens.border.light,
    backgroundColor: tokens.surface.bg,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sourceText: { flex: 1, fontSize: 14, fontWeight: '600', color: tokens.text.primary, marginRight: 8 },
  amountText: { fontSize: 16, fontWeight: '700' },
  earnText: { color: tokens.success.DEFAULT },
  spendText: { color: tokens.danger.DEFAULT },
  cardMetaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  cardMetaText: { fontSize: 11, color: tokens.text.tertiary },
})
