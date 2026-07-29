import { useMemo } from 'react'
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { TFunction } from '../../types'

/** 支付订单状态(字段对齐 mobile-rn PaymentScreen PaymentStatus) */
export type PaymentOrderStatus = 'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded'

/** 支付订单项(平台注入,字段对齐 mobile-rn PaymentScreen PaymentOrder 子集) */
export interface PaymentOrderItem {
  /** 订单号(作为 key) */
  orderNo: string
  /** 订单标题(原 subject) */
  subject: string
  amount: number
  status: PaymentOrderStatus
  /** 已格式化的创建时间文本(平台注入) */
  createdAtText: string
  /** 已格式化的支付时间文本(平台注入,可空) */
  paidAtText?: string | null
  /** 支付方式(可空) */
  paymentMethod?: string | null
}

/** PaymentScreen props(注入式:wrapper 保留 API 调用 + 微信支付) */
export interface PaymentScreenProps {
  t: TFunction
  orders: PaymentOrderItem[]
  loading: boolean
  refreshing: boolean
  error: string
  /** 当前正在操作的订单号(支付/同步/取消) */
  actioningId: string | null
  toast: string
  /** 立即支付回调(平台注入内部创建支付单 + 调起微信) */
  onPay: (order: PaymentOrderItem) => void
  /** 同步支付状态回调 */
  onSync: (orderNo: string) => void
  /** 取消订单回调 */
  onCancel: (orderNo: string) => void
  onRefresh: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

const STATUS_KEY: Record<PaymentOrderStatus, string> = {
  pending: 'payment.status.pending',
  paid: 'payment.status.paid',
  failed: 'payment.status.failed',
  cancelled: 'payment.status.cancelled',
  refunded: 'payment.status.refunded',
}

/**
 * 支付订单共享屏 — props 注入式跨端组件
 *
 * 平台无关:负责渲染 header + 订单列表(标题 + 状态徽章 + 订单号 + 时间 + 金额 + 操作按钮)。
 * 状态徽章颜色由共享层根据 status 计算。平台特定(导航/API/微信支付)由 wrapper 注入。
 */
export function PaymentScreen({
  t,
  orders,
  loading,
  refreshing,
  error,
  actioningId,
  toast,
  onPay,
  onSync,
  onCancel,
  onRefresh,
  onBack,
  colorScheme = 'light',
}: PaymentScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('payment.title')}</Text>
        <Text style={styles.subtitle}>{t('payment.subtitle')}</Text>
      </View>

      {error ? (
        <View style={styles.errorWrap}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.outlineBtn} onPress={onRefresh}>
            <Text style={styles.outlineBtnText}>{t('payment.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {toast ? (
        <View style={styles.toastWrap}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}

      <FlatList
        data={orders}
        keyExtractor={(item) => item.orderNo}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyWrap}>
              <ActivityIndicator color={tk.success.DEFAULT} />
              <Text style={styles.muted}>{t('common.loading')}</Text>
            </View>
          ) : (
            <View style={styles.emptyWrap}>
              <Text style={styles.muted}>{t('payment.empty')}</Text>
            </View>
          )
        }
        renderItem={({ item }) => {
          const statusKey = STATUS_KEY[item.status] ?? 'payment.status.pending'
          const statusStyle = statusToStyle(item.status, tk)
          const isPending = item.status === 'pending'
          const isActioning = actioningId === item.orderNo
          return (
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.subject || t('payment.untitledOrder')}
                </Text>
                <View style={[styles.statusTag, statusStyle]}>
                  <Text style={styles.statusTagText}>{t(statusKey)}</Text>
                </View>
              </View>
              <View style={styles.cardMetaRow}>
                <Text style={styles.metaText}>
                  {t('payment.orderNo')}:{item.orderNo}
                </Text>
                <Text style={styles.metaText}>{item.createdAtText}</Text>
              </View>
              <View style={styles.amountRow}>
                <Text style={styles.metaText}>{t('payment.amount')}</Text>
                <Text style={styles.amountValue}>¥ {item.amount.toFixed(2)}</Text>
              </View>
              {item.paymentMethod ? (
                <Text style={styles.metaText}>
                  {t('payment.method')}:{item.paymentMethod}
                </Text>
              ) : null}
              {item.paidAtText ? (
                <Text style={styles.metaText}>
                  {t('payment.paidAt')}:{item.paidAtText}
                </Text>
              ) : null}
              {isPending ? (
                <View style={styles.actionWrap}>
                  <TouchableOpacity
                    style={[styles.primaryBtn, isActioning && styles.btnDisabled]}
                    onPress={() => onPay(item)}
                    disabled={isActioning}
                  >
                    <Text style={styles.primaryBtnText}>
                      {isActioning ? t('common.loading') : t('payment.payNow')}
                    </Text>
                  </TouchableOpacity>
                  <View style={styles.secondaryActions}>
                    <TouchableOpacity
                      style={[styles.outlineBtn, styles.flexBtn]}
                      onPress={() => onSync(item.orderNo)}
                      disabled={isActioning}
                    >
                      <Text style={styles.outlineBtnText}>{t('payment.syncStatus')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.outlineBtn, styles.flexBtn]}
                      onPress={() => onCancel(item.orderNo)}
                      disabled={isActioning}
                    >
                      <Text style={styles.outlineBtnText}>{t('payment.cancelOrder')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}
            </View>
          )
        }}
      />
    </View>
  )
}

function statusToStyle(status: PaymentOrderStatus, tk: AppThemeTokens) {
  switch (status) {
    case 'pending':
      return { backgroundColor: tk.warning?.light ?? '#fef3c7' }
    case 'paid':
      return { backgroundColor: tk.success.light }
    case 'failed':
      return { backgroundColor: tk.danger.light }
    case 'cancelled':
      return { backgroundColor: tk.surface.muted }
    case 'refunded':
      return { backgroundColor: tk.purple.light }
    default:
      return { backgroundColor: tk.surface.muted }
  }
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    header: { paddingHorizontal: 16, paddingTop: 48, paddingBottom: 8 },
    backText: { fontSize: 16, color: tk.text.medium },
    title: { marginTop: 8, fontSize: 24, fontWeight: '600', color: tk.text.primary },
    subtitle: { marginTop: 4, fontSize: 13, color: tk.text.secondary },
    errorWrap: { paddingHorizontal: 16, paddingVertical: 8 },
    errorText: { fontSize: 13, color: tk.danger.DEFAULT },
    toastWrap: { paddingHorizontal: 16, paddingVertical: 8 },
    toastText: { fontSize: 13, color: tk.success.DEFAULT },
    outlineBtn: {
      marginTop: 8,
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: tk.success.DEFAULT,
      alignItems: 'center',
    },
    outlineBtnText: { fontSize: 13, color: tk.success.DEFAULT },
    separator: { height: 12 },
    card: {
      padding: 16,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    cardHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    cardTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: tk.text.primary },
    statusTag: { marginLeft: 8, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
    statusTagText: { fontSize: 12, color: tk.text.primary },
    cardMetaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 4,
    },
    metaText: { fontSize: 12, color: tk.text.secondary },
    amountRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      marginTop: 8,
    },
    amountValue: { fontSize: 18, fontWeight: '600', color: tk.success.DEFAULT },
    actionWrap: { marginTop: 12, gap: 8 },
    primaryBtn: {
      paddingVertical: 10,
      borderRadius: 8,
      backgroundColor: tk.success.DEFAULT,
      alignItems: 'center',
    },
    primaryBtnText: { color: tk.surface.light, fontSize: 14, fontWeight: '600' },
    secondaryActions: { flexDirection: 'row', gap: 8 },
    flexBtn: { flex: 1 },
    btnDisabled: { opacity: 0.5 },
    emptyWrap: { alignItems: 'center', paddingVertical: 48 },
    muted: { marginTop: 8, fontSize: 13, color: tk.text.secondary },
  })
}
