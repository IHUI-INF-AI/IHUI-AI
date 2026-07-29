import { useMemo } from 'react'
import { View, Text, TouchableOpacity, FlatList, ScrollView, StyleSheet } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { IncomeCommissionItem, IncomeData, IncomeScreenProps } from '@ihui/types'

/** 收益记录/Props 类型 re-export(单一来源 @ihui/types) */
export type { IncomeCommissionItem, IncomeData, IncomeScreenProps }

/**
 * 收益记录共享屏 — props 注入式跨端组件
 *
 * 平台无关:负责渲染 header(返回 + 标题)+ loading/error 态
 * + 正常态 ScrollView(summaryCard[purple.light 背景,3 列 stats:今日/累计/可提现 + 提现按钮]
 * + sectionTitle + FlatList[scrollEnabled=false,佣金卡片 title + status + time + amount])。
 * 平台特定(导航 / API 调用 / 提现)由 wrapper 通过 props 注入。
 */
export function IncomeScreen({
  t,
  data,
  loading,
  error,
  onWithdraw,
  onBack,
  colorScheme = 'light',
}: IncomeScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.backText}>{t('common.back')}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{t('income.title')}</Text>
        </View>
        <View style={styles.center}>
          <Text style={styles.muted}>{t('common.loading')}</Text>
        </View>
      </View>
    )
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.backText}>{t('common.back')}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{t('income.title')}</Text>
        </View>
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('income.title')}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>{t('income.today')}</Text>
              <Text style={styles.summaryValue}>¥{data.todayCommission}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>{t('income.total')}</Text>
              <Text style={styles.summaryValue}>¥{data.totalEarnings}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>{t('income.withdrawable')}</Text>
              <Text style={styles.summaryValue}>¥{data.balance}</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={onWithdraw}
            style={styles.withdrawBtn}
            activeOpacity={0.7}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          >
            <Text style={styles.withdrawBtnText}>{t('income.withdraw')}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>{t('income.sectionTitle')}</Text>

        <FlatList<IncomeCommissionItem>
          data={data.list}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.muted}>{t('income.empty')}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.titleRow}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text
                  style={[
                    styles.cardStatus,
                    item.settled ? styles.statusSettled : styles.statusPending,
                  ]}
                >
                  {item.settled ? t('income.settled') : t('income.pending')}
                </Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.cardTime}>{item.time}</Text>
                <Text style={styles.cardAmount}>+¥{item.amount}</Text>
              </View>
            </View>
          )}
        />
      </ScrollView>
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
    center: { alignItems: 'center', paddingVertical: 48 },
    muted: { fontSize: 12, color: tk.text.secondary, marginTop: 8 },
    errorText: { fontSize: 13, color: tk.danger.DEFAULT, textAlign: 'center' },
    body: { padding: 16, paddingBottom: 32 },
    summaryCard: {
      padding: 16,
      borderRadius: 8,
      backgroundColor: tk.purple.light,
    },
    summaryRow: {
      flexDirection: 'row',
      marginBottom: 12,
    },
    summaryItem: { flex: 1, alignItems: 'center' },
    summaryLabel: { fontSize: 11, color: tk.text.secondary },
    summaryValue: {
      marginTop: 4,
      fontSize: 16,
      fontWeight: '700',
      color: tk.purple.DEFAULT,
    },
    withdrawBtn: {
      paddingVertical: 10,
      borderRadius: 8,
      backgroundColor: tk.purple.DEFAULT,
      alignItems: 'center',
    },
    withdrawBtnText: { fontSize: 14, fontWeight: '600', color: tk.surface.light },
    sectionTitle: {
      marginTop: 16,
      marginBottom: 8,
      fontSize: 14,
      fontWeight: '600',
      color: tk.text.primary,
    },
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
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    cardTitle: {
      flex: 1,
      fontSize: 14,
      fontWeight: '600',
      color: tk.text.primary,
      marginRight: 8,
    },
    cardStatus: { fontSize: 11, fontWeight: '600' },
    statusSettled: { color: tk.success.DEFAULT },
    statusPending: { color: tk.warning.DEFAULT },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 6,
    },
    cardTime: { fontSize: 11, color: tk.text.tertiary },
    cardAmount: { fontSize: 14, fontWeight: '700', color: tk.success.DEFAULT },
  })
}
