// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type TextStyle,
} from 'react-native'
import { TrendingUp } from 'lucide-react-native'
import { formatPrice } from '@ihui/shared/utils'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import type { TFunction } from '../../types'
import { getTokens, type AppThemeMode, type AppThemeTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'

const NS = 'commissionOrdersPage'

/** 与 web 页同取值集(apps/web/app/(main)/distribution/orders/page.tsx:68 STATUS_OPTIONS) */
const FILTER_STATUSES = ['pending', 'paid', 'cancelled', 'refunded'] as const

type OrderStatus = (typeof FILTER_STATUSES)[number]

/** 与 web STATUS_KEY 同表(apps/web/app/(main)/distribution/orders/page.tsx:54-59),值=本页 ns 下的 i18n 键 */
const STATUS_LABEL_KEY: Record<OrderStatus, string> = {
  pending: 'orderStatusPending',
  paid: 'orderStatusPaid',
  cancelled: 'orderStatusCancelled',
  refunded: 'orderStatusRefunded',
}

/** 与 web STATUS_CLS 同档(amber/emerald/muted/red → 令牌同名档) */
const STATUS_TONE: Record<OrderStatus, BadgeTone> = {
  pending: 'pending',
  paid: 'paid',
  cancelled: 'cancelled',
  refunded: 'refunded',
}

type BadgeTone = 'pending' | 'paid' | 'cancelled' | 'refunded' | 'neutral'

export interface CommissionOrderRowView {
  id: string
  orderNo: string
  /** web colOrderType 列直出 orders.payment_method(无字典),空值落 '-' */
  typeText: string
  /** 金额(分);展示经 formatPrice 全仓唯一出口 */
  amountCents: number
  status: string
  /** 薄壳按 web 同 ns(orderStatus*) 取的状态文案,平台无关注入 */
  statusText: string
  /** 薄壳按 web 同参 Intl 格式化(locale + MM/DD HH:mm)后的文本 */
  timeText: string
}

export interface CommissionOrdersScreenProps {
  t: TFunction
  colorScheme: AppThemeMode
  onBack: () => void
  /** 非空即未登录门(与 web useAuthGate + AuthGatePrompt 同口径) */
  loginRequiredText: string
  loading: boolean
  error: string | null
  rows: CommissionOrderRowView[]
  total: number
  filterValue: string
  onFilterChange: (value: string) => void
  loadingMore: boolean
  hasMore: boolean
  onEndReached: () => void
  onRefresh: () => void
}

/** 后端金额以「分」存储,换算为元 —— 委托全仓唯一出口(与 features/distribution/DistributionScreen 同口径)。 */
function yuan(cents: number): string {
  return Number.isFinite(cents) ? formatPrice(cents) : '0.00'
}

/**
 * 佣金订单共享屏 —— 承载 web /distribution/orders(GET /api/finance/commission/orders)。
 *
 * 与 web 的口径差(如实登记):web 是「表格 + 上一页/下一页按钮」,RN 落为「卡片行 + 下拉刷新 +
 * 触底续页」,同一端点同参数(page/limit/status),游标由薄壳持有;web 五列表格在 RN 落为
 * 「标签—值」行,列文案五语值逐字取 web distribution 命名空间。状态筛选两端口同一取值集。
 * 平台无关:取数 / 时间格式化 / 登录态判定由薄壳注入,本文件只管渲染与 loading/error/empty 三态。
 */
export function CommissionOrdersScreen({
  t,
  colorScheme,
  onBack,
  loginRequiredText,
  loading,
  error,
  rows,
  total,
  filterValue,
  onFilterChange,
  loadingMore,
  hasMore,
  onEndReached,
  onRefresh,
}: CommissionOrdersScreenProps) {
  const tk = getTokens(colorScheme)
  const { styles, badgeTone } = useMemo(() => createStyles(tk), [tk])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <View style={styles.titleBox}>
          <View style={styles.titleRow}>
            <TrendingUp size={20} color={tk.brand.DEFAULT} />
            <Text style={styles.title}>{t(`${NS}.title`)}</Text>
          </View>
          {total > 0 ? <Text style={styles.muted}>{t(`${NS}.totalOf`, { total })}</Text> : null}
        </View>
      </View>

      {!loginRequiredText ? (
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.chip, filterValue === 'all' && styles.chipActive]}
            onPress={() => onFilterChange('all')}
          >
            <Text style={[styles.chipText, filterValue === 'all' && styles.chipTextActive]}>
              {t(`${NS}.statusAll`)}
            </Text>
          </TouchableOpacity>
          {FILTER_STATUSES.map((value) => (
            <TouchableOpacity
              key={value}
              style={[styles.chip, filterValue === value && styles.chipActive]}
              onPress={() => onFilterChange(value)}
            >
              <Text style={[styles.chipText, filterValue === value && styles.chipTextActive]}>
                {t(`${NS}.${STATUS_LABEL_KEY[value]}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {loginRequiredText ? (
        <Text style={styles.loginHint}>{loginRequiredText}</Text>
      ) : loading ? (
        <View style={styles.centerBlock}>
          <ActivityIndicator size="small" color={tk.brand.DEFAULT} />
          <Text style={styles.muted}>{t(`${NS}.loading`)}</Text>
        </View>
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : rows.length === 0 ? (
        <View style={styles.centerBlock}>
          <TrendingUp size={30} color={tk.text.tertiary} />
          <Text style={styles.muted}>{t(`${NS}.empty`)}</Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const tone = STATUS_TONE[item.status as OrderStatus] ?? 'neutral'
            return (
              <View style={styles.row}>
                <View style={styles.rowHead}>
                  <Text style={styles.orderNo} numberOfLines={1}>
                    {item.orderNo}
                  </Text>
                  <Text style={[styles.badge, badgeTone[tone]]}>{item.statusText}</Text>
                </View>
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>{t(`${NS}.colOrderType`)}</Text>
                  <Text style={styles.fieldValue}>{item.typeText}</Text>
                </View>
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>{t(`${NS}.colAmount`)}</Text>
                  <Text style={styles.amountValue}>{`¥${yuan(item.amountCents)}`}</Text>
                </View>
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>{t(`${NS}.colTime`)}</Text>
                  <Text style={styles.fieldValue}>{item.timeText}</Text>
                </View>
              </View>
            )
          }}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} />}
          onEndReached={hasMore ? onEndReached : undefined}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            loadingMore ? (
              <Text style={styles.footerMuted}>{t(`${NS}.loading`)}</Text>
            ) : !hasMore && total > 0 ? (
              <Text style={styles.footerMuted}>{t(`${NS}.totalOf`, { total })}</Text>
            ) : null
          }
        />
      )}
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: tk.surface.bg,
      paddingHorizontal: rnSpacing.md,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.md,
      marginTop: rnSpacing.md,
    },
    titleBox: { flex: 1 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
    title: { fontSize: 22, fontWeight: '600', color: tk.text.primary },
    muted: { marginTop: 2, fontSize: rnType.label.size, color: tk.text.secondary },
    filterRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: rnSpacing.sm,
      marginTop: rnSpacing.md,
    },
    chip: {
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.xs,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    chipActive: { borderColor: tk.brand.DEFAULT, backgroundColor: tk.surface.card },
    chipText: { fontSize: rnType.label.size, color: tk.text.secondary },
    chipTextActive: { color: tk.brand.DEFAULT, fontWeight: '600' },
    loginHint: { marginTop: rnSpacing.xl, fontSize: rnType.body.size, color: tk.text.secondary },
    centerBlock: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing['2xl'],
    },
    error: { marginTop: rnSpacing.xl, fontSize: rnType.body.size, color: tk.danger.DEFAULT },
    list: { flex: 1, marginTop: rnSpacing.md },
    listContent: { paddingBottom: rnSpacing['2xl'] },
    row: {
      gap: rnSpacing.xs,
      marginBottom: rnSpacing.md,
      padding: rnSpacing.md,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    rowHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: rnSpacing.sm,
    },
    orderNo: { flex: 1, fontSize: rnType.body.size, fontWeight: '600', color: tk.text.primary },
    badge: {
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: 2,
      borderRadius: rnRadius.md,
      fontSize: rnType.caption.size,
      fontWeight: '500',
    },
    fieldRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: rnSpacing.sm,
    },
    fieldLabel: { fontSize: rnType.caption.size, color: tk.text.secondary },
    fieldValue: {
      flex: 1,
      textAlign: 'right',
      fontSize: rnType.caption.size,
      color: tk.text.primary,
    },
    amountValue: {
      flex: 1,
      textAlign: 'right',
      fontSize: rnType.body.size,
      fontWeight: '600',
      color: tk.text.primary,
    },
    footerMuted: {
      textAlign: 'center',
      paddingVertical: rnSpacing.md,
      fontSize: rnType.caption.size,
      color: tk.text.secondary,
    },
  })

  const badgeTone: Record<BadgeTone, TextStyle> = {
    pending: { backgroundColor: tk.warning.amberLight, color: tk.warning.amberText },
    paid: { backgroundColor: tk.success.lightest, color: tk.success.deepText },
    cancelled: { backgroundColor: tk.surface.muted, color: tk.text.secondary },
    refunded: { backgroundColor: tk.danger.light, color: tk.danger.DEFAULT },
    neutral: { backgroundColor: tk.surface.muted, color: tk.text.secondary },
  }

  return { styles, badgeTone }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
