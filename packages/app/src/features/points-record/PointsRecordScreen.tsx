import { useMemo } from 'react'
import { View, Text, TouchableOpacity, FlatList, RefreshControl, StyleSheet } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { PointsRecordItem, PointsRecordScreenProps, PointsRecordType } from '@ihui/types'

/** 积分记录/Props 类型 re-export(单一来源 @ihui/types) */
export type { PointsRecordItem, PointsRecordScreenProps, PointsRecordType }

const TABS: PointsRecordType[] = ['all', 'earn', 'spend']

/**
 * 积分记录共享屏 — props 注入式跨端组件
 *
 * 平台无关:负责渲染 header(返回 + 标题)+ balance 卡片(success.light 背景)
 * + 3 个 tab(all/earn/spend,active 用 success.DEFAULT 背景)+ 积分记录卡片列表
 * (source + amount[earn 绿/spend 红] + createdAt + balanceAfter)+ 下拉刷新 + 空态。
 * 平台特定(导航 / API 调用 / tab 切换)由 wrapper 通过 props 注入。
 */
export function PointsRecordScreen({
  t,
  items,
  balance,
  activeTab,
  onSelectTab,
  loading,
  refreshing,
  error,
  onRefresh,
  onBack,
  colorScheme = 'light',
}: PointsRecordScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const tabLabel = (tab: PointsRecordType) => {
    switch (tab) {
      case 'all':
        return t('pointsRecord.tabAll')
      case 'earn':
        return t('pointsRecord.tabEarn')
      case 'spend':
        return t('pointsRecord.tabSpend')
      default:
        return t('pointsRecord.tabAll')
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('pointsRecord.title')}</Text>
      </View>

      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>{t('pointsRecord.balance')}</Text>
        <Text style={styles.balanceValue}>{balance}</Text>
      </View>

      <View style={styles.tabs}>
        {TABS.map((tab) => {
          const active = tab === activeTab
          return (
            <TouchableOpacity
              key={tab}
              onPress={() => onSelectTab(tab)}
              style={[styles.tab, active && styles.tabActive]}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{tabLabel(tab)}</Text>
            </TouchableOpacity>
          )
        })}
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {loading && items.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.muted}>{t('common.loading')}</Text>
        </View>
      ) : (
        <FlatList<PointsRecordItem>
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listBody}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.muted}>{t('pointsRecord.empty')}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.titleRow}>
                <Text style={styles.cardSource} numberOfLines={1}>
                  {item.source}
                </Text>
                <Text
                  style={[
                    styles.cardAmount,
                    item.type === 'earn' ? styles.amountEarn : styles.amountSpend,
                  ]}
                >
                  {item.type === 'earn' ? '+' : ''}
                  {item.amount}
                </Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.cardMeta}>
                  {t('pointsRecord.balanceAfter')}: {item.balanceAfter}
                </Text>
                <Text style={styles.cardTime}>{item.createdAt}</Text>
              </View>
            </View>
          )}
        />
      )}
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
      paddingTop: 48,
      paddingBottom: 12,
      gap: 12,
    },
    backText: { fontSize: 14, color: tk.text.medium },
    title: { fontSize: 18, fontWeight: '600', color: tk.text.primary },
    balanceCard: {
      marginHorizontal: 16,
      padding: 16,
      borderRadius: 8,
      backgroundColor: tk.success.light,
      alignItems: 'center',
    },
    balanceLabel: { fontSize: 12, color: tk.success.deepText },
    balanceValue: {
      marginTop: 4,
      fontSize: 28,
      fontWeight: '700',
      color: tk.success.deepText,
    },
    tabs: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 8,
    },
    tab: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: tk.surface.card,
    },
    tabActive: { backgroundColor: tk.success.DEFAULT },
    tabText: { fontSize: 12, color: tk.text.secondary },
    tabTextActive: { color: tk.surface.light, fontWeight: '600' },
    errorText: { paddingHorizontal: 16, fontSize: 12, color: tk.danger.DEFAULT },
    center: { alignItems: 'center', paddingVertical: 48 },
    muted: { fontSize: 12, color: tk.text.secondary, marginTop: 8 },
    listBody: { padding: 16, paddingBottom: 32 },
    separator: { height: 8 },
    card: {
      padding: 16,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.bg,
    },
    titleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    cardSource: {
      flex: 1,
      fontSize: 14,
      fontWeight: '600',
      color: tk.text.primary,
      marginRight: 8,
    },
    cardAmount: { fontSize: 14, fontWeight: '600' },
    amountEarn: { color: tk.success.DEFAULT },
    amountSpend: { color: tk.danger.DEFAULT },
    metaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 6,
    },
    cardMeta: { fontSize: 11, color: tk.text.secondary },
    cardTime: { fontSize: 11, color: tk.text.tertiary },
  })
}
