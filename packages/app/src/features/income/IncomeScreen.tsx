import { useMemo, useState } from 'react'
import { View, Text, TouchableOpacity, FlatList, ScrollView, StyleSheet } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { IncomeCommissionItem, IncomeData, IncomeScreenProps } from '@ihui/types'

/** 收益记录/Props 类型 re-export(单一来源 @ihui/types) */
export type { IncomeCommissionItem, IncomeData, IncomeScreenProps }

/** 后端金额以「分」存储,换算为元(两位小数) */
function fmtYuan(cents: number): string {
  return Number.isFinite(cents) ? (cents / 100).toFixed(2) : '0.00'
}

/**
 * 收益 Tab(对齐 Uniapp pages/income/components/accumulation/index.vue tabList:
 * 全部 / 待结算 / 已结算 / 取消结算)。
 * 后端 /distribution/list 仅返回 status 0=invalid 1=active,无「待结算/取消结算」区分
 * (见 commission_flows.status 注释),故按 settled + cancelled 组合过滤,数据缺状态时对应 Tab 为空。
 */
type IncomeTab = 'all' | 'pending' | 'settled' | 'cancelled'
const TABS: IncomeTab[] = ['all', 'pending', 'settled', 'cancelled']

/**
 * 收益记录共享屏 — props 注入式跨端组件
 *
 * 平台无关:负责渲染 header(返回 + 标题)+ loading/error 态
 * + 正常态 ScrollView(summaryCard[purple.light 背景,3 列 stats:今日/累计/可提现 + 提现按钮]
 * + sectionTitle + 状态 Tab 栏 + FlatList[scrollEnabled=false,佣金卡片 title + status + time + amount
 * + 关联订单 + 复制订单号按钮])。
 * 平台特定(导航 / API 调用 / 提现 / 剪贴板)由 wrapper 通过 props 注入。
 */
export function IncomeScreen({
  t,
  data,
  loading,
  error,
  onWithdraw,
  onBack,
  colorScheme = 'light',
  // 复制订单号(可选注入:平台注入 Clipboard 行为,对齐 Uniapp copyOrderId → setClipboardData)
  onCopyOrder,
}: IncomeScreenProps & {
  /** 复制订单号回调(平台注入剪贴板实现 + 成功提示) */
  onCopyOrder?: (orderId: string) => void
}) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  const [activeTab, setActiveTab] = useState<IncomeTab>('all')

  // 按 Tab 过滤(对齐 Uniapp filteredList 语义)
  const filteredList = useMemo(() => {
    switch (activeTab) {
      case 'all':
        return data.list
      case 'settled':
        return data.list.filter((i) => i.settled && !i.cancelled)
      case 'pending':
        return data.list.filter((i) => !i.settled && !i.cancelled)
      case 'cancelled':
        return data.list.filter((i) => !!i.cancelled)
      default:
        return data.list
    }
  }, [data.list, activeTab])

  // 状态文案/配色:取消结算优先于已结算/待结算
  const statusOf = (item: IncomeCommissionItem): { text: string; colorStyle: object } => {
    if (item.cancelled) return { text: t('income.cancelled'), colorStyle: styles.statusCancelled }
    return item.settled
      ? { text: t('income.settled'), colorStyle: styles.statusSettled }
      : { text: t('income.pending'), colorStyle: styles.statusPending }
  }

  const handleCopy = (item: IncomeCommissionItem): void => {
    if (item.orderId) onCopyOrder?.(item.orderId)
  }

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
              <Text style={styles.summaryValue}>¥{fmtYuan(data.todayCommission)}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>{t('income.total')}</Text>
              <Text style={styles.summaryValue}>¥{fmtYuan(data.totalEarnings)}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>{t('income.withdrawable')}</Text>
              <Text style={styles.summaryValue}>¥{fmtYuan(data.balance)}</Text>
            </View>
          </View>
          {/* 汇总第二行:待结算/已提现(数据源 GET /distribution/overview 的 pending/withdrawnCommission) */}
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>{t('income.pending')}</Text>
              <Text style={styles.summaryValue}>¥{fmtYuan(data.pendingCommission)}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>{t('income.withdrawn')}</Text>
              <Text style={styles.summaryValue}>¥{fmtYuan(data.withdrawnCommission)}</Text>
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

        {/* 状态 Tab 栏(对齐 Uniapp tabList:全部/待结算/已结算/取消结算) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabs}
        >
          {TABS.map((tab) => {
            const active = tab === activeTab
            return (
              <TouchableOpacity
                key={tab}
                onPress={() => setActiveTab(tab)}
                style={[styles.tab, active && styles.tabActive]}
                hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>
                  {t(`income.tab.${tab}`)}
                </Text>
              </TouchableOpacity>
            )
          })}
        </ScrollView>

        <FlatList<IncomeCommissionItem>
          data={filteredList}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.muted}>{t('income.empty')}</Text>
            </View>
          }
          renderItem={({ item }) => {
            const st = statusOf(item)
            return (
              <View style={styles.card}>
                <View style={styles.titleRow}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={[styles.cardStatus, st.colorStyle]}>{st.text}</Text>
                </View>
                <Text style={styles.cardBuyer} numberOfLines={1}>
                  {t('income.buyer', { name: item.title })}
                </Text>
                <View style={styles.metaRow}>
                  <Text style={styles.cardTime}>{item.time}</Text>
                  <Text style={styles.cardAmount}>+¥{item.amount}</Text>
                </View>
                {/* 关联订单 + 复制订单号按钮(对齐 Uniapp copyOrderId → setClipboardData) */}
                <View style={styles.copyRow}>
                  <Text style={styles.cardOrder} numberOfLines={1}>
                    {t('income.relatedOrder', { orderNo: item.orderId ?? '—' })}
                  </Text>
                  {item.orderId ? (
                    <TouchableOpacity
                      style={styles.copyBtn}
                      onPress={() => handleCopy(item)}
                      activeOpacity={0.7}
                      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                      accessibilityRole="button"
                      accessibilityLabel={t('income.copy')}
                    >
                      <Text style={styles.copyBtnText}>{t('income.copy')}</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            )
          }}
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
      paddingHorizontal: 10,
      paddingTop: 48,
      paddingBottom: 12,
      gap: 12,
    },
    backText: { fontSize: 16, color: tk.text.medium },
    title: { fontSize: 20, fontWeight: '600', color: tk.text.primary },
    center: { alignItems: 'center', paddingVertical: 48 },
    muted: { fontSize: 14, color: tk.text.secondary, marginTop: 8 },
    errorText: { fontSize: 14, color: tk.danger.DEFAULT, textAlign: 'center' },
    body: { padding: 10, paddingBottom: 32 },
    summaryCard: {
      padding: 12,
      borderRadius: 12,
      backgroundColor: tk.surface.light,
    },
    summaryRow: {
      flexDirection: 'row',
      marginBottom: 12,
    },
    summaryItem: { flex: 1, alignItems: 'center' },
    summaryLabel: { fontSize: 11, color: tk.text.secondary },
    summaryValue: {
      marginTop: 8,
      fontSize: 20,
      fontWeight: '700',
      color: tk.text.primary,
    },
    withdrawBtn: {
      height: 50,
      borderRadius: 12,
      backgroundColor: tk.brand.DEFAULT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    withdrawBtnText: { fontSize: 16, fontWeight: '600', color: tk.surface.light },
    sectionTitle: {
      marginTop: 12,
      marginBottom: 8,
      fontSize: 18,
      fontWeight: '600',
      color: tk.text.primary,
    },
    // 状态 Tab 栏(对齐 Uniapp tab-list)
    tabs: { paddingVertical: 8, gap: 8 },
    tab: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 12,
      backgroundColor: tk.surface.card,
    },
    tabActive: { backgroundColor: tk.brand.DEFAULT },
    tabText: { fontSize: 14, color: tk.text.secondary },
    tabTextActive: { color: tk.surface.light, fontWeight: '600' },
    separator: { height: StyleSheet.hairlineWidth, backgroundColor: tk.border.light },
    card: {
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    cardTitle: {
      flex: 1,
      fontSize: 16,
      fontWeight: '600',
      color: tk.text.primary,
      marginRight: 8,
    },
    cardStatus: { fontSize: 11, fontWeight: '600' },
    statusSettled: { color: tk.success.DEFAULT },
    statusPending: { color: tk.warning.DEFAULT },
    // 取消结算(对齐 Uniapp 取消结算状态)
    statusCancelled: { color: tk.text.tertiary },
    // 下单人
    cardBuyer: { fontSize: 12, color: tk.text.secondary, marginTop: 6 },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 8,
    },
    cardTime: { fontSize: 11, color: tk.text.tertiary },
    cardAmount: { fontSize: 16, fontWeight: '700', color: tk.success.DEFAULT },
    // 关联订单 + 复制按钮
    copyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 8,
      gap: 8,
    },
    cardOrder: { flex: 1, fontSize: 11, color: tk.text.tertiary },
    copyBtn: {
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: tk.brand.DEFAULT,
      backgroundColor: tk.surface.light,
    },
    copyBtnText: { fontSize: 12, fontWeight: '500', color: tk.brand.DEFAULT },
  })
}
