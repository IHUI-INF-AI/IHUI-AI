import { useMemo } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ScrollView,
  StyleSheet,
  RefreshControl,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type {
  TokenRecordType,
  TokenValueBalance,
  TokenValuePackage,
  TokenValueRecord,
  TokenValueScreenProps,
} from '../../types'

/** TokenValue 共享屏 — props 注入式跨端组件(纯 UI,不依赖平台 API) */
export type {
  TokenRecordType,
  TokenValueBalance,
  TokenValuePackage,
  TokenValueRecord,
  TokenValueScreenProps,
}

/** 充值套餐(产品配置,静态前端数据,非业务数据) */
const PACKAGES: TokenValuePackage[] = [
  { id: '1', tokens: 100000, price: 9.9, bonus: 0 },
  { id: '2', tokens: 500000, price: 39.9, bonus: 50000 },
  { id: '3', tokens: 1000000, price: 68, bonus: 150000, popular: true },
  { id: '4', tokens: 5000000, price: 298, bonus: 1000000 },
]

const TABS: TokenRecordType[] = ['all', 'cost', 'recharge']

function formatToken(n: number): string {
  if (Math.abs(n) >= 100000000) return `${(n / 100000000).toFixed(2)}亿`
  if (Math.abs(n) >= 10000) return `${(n / 10000).toFixed(1)}万`
  return `${n}`
}

export function TokenValueScreen({
  t,
  balance,
  records,
  loading,
  refreshing,
  error,
  activeTab,
  onSelectTab,
  onRefresh,
  onRecharge,
  onBack,
  colorScheme = 'light',
}: TokenValueScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const balanceValue = balance?.balance ?? 0
  const frozen = balance?.frozen ?? 0
  const totalCost = balance?.totalUsed ?? 0

  const list = records.filter((r) => (activeTab === 'all' ? true : r.type === activeTab))

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('tokenValue.title')}</Text>
      </View>

      <FlatList
        data={list}
        keyExtractor={(i) => i.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <View>
            <View style={styles.balanceCard}>
              <Text style={styles.balanceLabel}>{t('tokenValue.balanceLabel')}</Text>
              <Text style={styles.balanceValue}>{formatToken(balanceValue)}</Text>
              <View style={styles.balanceMeta}>
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>{t('tokenValue.frozen')}</Text>
                  <Text style={styles.metaValue}>{formatToken(frozen)}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>{t('tokenValue.totalCost')}</Text>
                  <Text style={styles.metaValue}>{formatToken(totalCost)}</Text>
                </View>
              </View>
            </View>

            <Text style={styles.sectionTitle}>{t('tokenValue.packagesTitle')}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.pkgScroll}
            >
              {PACKAGES.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.pkgCard, p.popular && styles.pkgCardPopular]}
                  onPress={() => onRecharge(p)}
                  activeOpacity={0.85}
                >
                  {p.popular ? (
                    <View style={styles.popularBadge}>
                      <Text style={styles.popularText}>{t('tokenValue.popular')}</Text>
                    </View>
                  ) : null}
                  <Text style={styles.pkgTokens}>{formatToken(p.tokens)}</Text>
                  <Text style={styles.pkgUnit}>{t('tokenValue.tokenUnit')}</Text>
                  {p.bonus > 0 ? (
                    <Text style={styles.pkgBonus}>
                      {t('tokenValue.bonus')} {formatToken(p.bonus)}
                    </Text>
                  ) : null}
                  <View style={styles.pkgPriceBox}>
                    <Text style={styles.pkgPrice}>¥{p.price}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.sectionTitle}>{t('tokenValue.recordsTitle')}</Text>
            <View style={styles.tabRow}>
              {TABS.map((tab) => {
                const active = tab === activeTab
                return (
                  <TouchableOpacity
                    key={tab}
                    style={[styles.tabItem, active && styles.tabItemActive]}
                    onPress={() => onSelectTab(tab)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.tabText, active && styles.tabTextActive]}>
                      {t(`tokenValue.tab.${tab}`)}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
            {error ? (
              <View style={{ paddingHorizontal: 4, paddingBottom: 4 }}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}
          </View>
        }
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {loading ? t('common.loading') : t('tokenValue.empty')}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.recordItem}>
            <View
              style={[
                styles.recordIcon,
                item.type === 'recharge' ? styles.recordIconGreen : styles.recordIconGray,
              ]}
            >
              <Text style={styles.recordIconText}>
                {item.type === 'recharge'
                  ? t('tokenValue.tab.recharge')
                  : t('tokenValue.tab.cost')}
              </Text>
            </View>
            <View style={styles.recordMain}>
              <Text style={styles.recordTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.recordTime}>{item.time}</Text>
            </View>
            <Text style={[styles.recordAmount, item.amount > 0 ? styles.amountGreen : styles.amountRed]}>
              {item.amount > 0 ? '+' : ''}
              {formatToken(item.amount)}
            </Text>
          </View>
        )}
      />
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 12,
    },
    backText: { fontSize: 14, color: tk.text.medium },
    headerTitle: { fontSize: 18, fontWeight: '600', color: tk.text.primary },
    balanceCard: { padding: 16, borderRadius: 12, backgroundColor: tk.purple.DEFAULT },
    balanceLabel: { fontSize: 12, color: tk.purple.light },
    balanceValue: {
      marginTop: 6,
      fontSize: 32,
      fontWeight: '700',
      color: tk.surface.light,
    },
    balanceMeta: { flexDirection: 'row', marginTop: 12, gap: 24 },
    metaItem: {},
    metaLabel: { fontSize: 11, color: tk.purple.light },
    metaValue: {
      marginTop: 2,
      fontSize: 14,
      fontWeight: '600',
      color: tk.surface.light,
    },
    sectionTitle: {
      marginTop: 20,
      marginBottom: 10,
      fontSize: 14,
      fontWeight: '600',
      color: tk.text.primary,
    },
    pkgScroll: { gap: 10, paddingVertical: 4 },
    pkgCard: {
      width: 130,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.bg,
      alignItems: 'center',
    },
    pkgCardPopular: { borderColor: tk.purple.DEFAULT, backgroundColor: tk.purple.light },
    popularBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 6,
      backgroundColor: tk.purple.DEFAULT,
    },
    popularText: { fontSize: 10, fontWeight: '600', color: tk.surface.light },
    pkgTokens: {
      marginTop: 8,
      fontSize: 18,
      fontWeight: '700',
      color: tk.text.primary,
    },
    pkgUnit: { marginTop: 2, fontSize: 11, color: tk.text.secondary },
    pkgBonus: { marginTop: 4, fontSize: 11, color: tk.warning.deep, fontWeight: '600' },
    pkgPriceBox: {
      marginTop: 8,
      paddingHorizontal: 12,
      height: 28,
      borderRadius: 8,
      backgroundColor: tk.purple.DEFAULT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pkgPrice: { fontSize: 13, fontWeight: '600', color: tk.surface.light },
    tabRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
    tabItem: {
      paddingHorizontal: 14,
      height: 30,
      borderRadius: 8,
      backgroundColor: tk.surface.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tabItemActive: { backgroundColor: tk.purple.DEFAULT },
    tabText: { fontSize: 12, color: tk.text.secondary },
    tabTextActive: { color: tk.surface.light, fontWeight: '600' },
    errorText: { color: tk.warning.deep, fontSize: 12 },
    empty: { alignItems: 'center', paddingVertical: 32 },
    emptyText: { fontSize: 13, color: tk.text.tertiary },
    recordItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    recordIcon: {
      width: 32,
      height: 32,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },
    recordIconGreen: { backgroundColor: tk.success.light },
    recordIconGray: { backgroundColor: tk.surface.muted },
    recordIconText: { fontSize: 12, fontWeight: '600', color: tk.text.secondary },
    recordMain: { flex: 1 },
    recordTitle: { fontSize: 13, fontWeight: '600', color: tk.text.primary },
    recordTime: { marginTop: 2, fontSize: 11, color: tk.text.tertiary },
    recordAmount: { fontSize: 14, fontWeight: '700' },
    amountGreen: { color: tk.success.DEFAULT },
    amountRed: { color: tk.warning.deep },
  })
}
