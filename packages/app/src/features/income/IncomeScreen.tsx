// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo, useState } from 'react'
import { View, Text, TouchableOpacity, FlatList, ScrollView, StyleSheet } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { IncomeCommissionItem, IncomeData, IncomeScreenProps } from '@ihui/types'

import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { BackChevron } from '../../components/BackChevron'
import { EmptyState, ErrorState, ScreenSkeleton } from '../../components/ScreenStates'

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
          <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
          <Text style={styles.title}>{t('income.title')}</Text>
        </View>
        <ScreenSkeleton variant="list" count={4} colorScheme={colorScheme} />
      </View>
    )
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
          <Text style={styles.title}>{t('income.title')}</Text>
        </View>
        <ErrorState message={error} colorScheme={colorScheme} />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
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
          contentContainerStyle={{ gap: rnSpacing.md }}
          ListEmptyComponent={<EmptyState title={t('income.empty')} colorScheme={colorScheme} />}
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
      paddingBottom: rnSpacing.md,
      gap: rnSpacing.md,
    },
    title: { fontSize: rnType.heading.size, fontWeight: '600', color: tk.text.primary },
    body: { padding: 10, paddingBottom: rnSpacing['3xl'] },
    summaryCard: {
      padding: rnSpacing.md,
      borderRadius: rnRadius.lg,
      backgroundColor: tk.surface.light,
    },
    summaryRow: {
      flexDirection: 'row',
      marginBottom: rnSpacing.md,
    },
    summaryItem: { flex: 1, alignItems: 'center' },
    summaryLabel: { fontSize: rnType.caption.size, color: tk.text.secondary },
    summaryValue: {
      marginTop: rnSpacing.sm,
      fontSize: rnType.heading.size,
      fontWeight: '700',
      color: tk.text.primary,
    },
    withdrawBtn: {
      height: 50,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
      alignItems: 'center',
      justifyContent: 'center',
    },
    withdrawBtnText: { fontSize: rnType.title.size, fontWeight: '600', color: tk.surface.light },
    sectionTitle: {
      marginTop: rnSpacing.md,
      marginBottom: rnSpacing.sm,
      fontSize: rnType.subtitle.size,
      fontWeight: '600',
      color: tk.text.primary,
    },
    // 状态 Tab 栏(对齐 Uniapp tab-list)
    tabs: { paddingVertical: rnSpacing.sm, gap: rnSpacing.sm },
    tab: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: rnRadius.xl,
      backgroundColor: tk.surface.card,
    },
    tabActive: { backgroundColor: tk.brand.cta },
    tabText: { fontSize: rnType.body.size, color: tk.text.secondary },
    tabTextActive: { color: tk.surface.light, fontWeight: '600' },
    card: {
      padding: rnSpacing.md,
      borderRadius: rnRadius.lg,
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
      fontSize: rnType.title.size,
      fontWeight: '600',
      color: tk.text.primary,
      marginRight: rnSpacing.sm,
    },
    cardStatus: { fontSize: rnType.caption.size, fontWeight: '600' },
    statusSettled: { color: tk.success.DEFAULT },
    statusPending: { color: tk.warning.DEFAULT },
    // 取消结算(对齐 Uniapp 取消结算状态)
    statusCancelled: { color: tk.text.tertiary },
    // 下单人
    cardBuyer: { fontSize: rnType.label.size, color: tk.text.secondary, marginTop: 6 },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: rnSpacing.sm,
    },
    cardTime: { fontSize: rnType.caption.size, color: tk.text.tertiary },
    cardAmount: { fontSize: rnType.title.size, fontWeight: '700', color: tk.success.DEFAULT },
    // 关联订单 + 复制按钮
    copyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: rnSpacing.sm,
      gap: rnSpacing.sm,
    },
    cardOrder: { flex: 1, fontSize: rnType.caption.size, color: tk.text.tertiary },
    copyBtn: {
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.xs,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.brandAccent.deep,
      backgroundColor: tk.surface.light,
    },
    copyBtnText: { fontSize: rnType.label.size, fontWeight: '500', color: tk.brand.DEFAULT },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
