// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import { rnRadius } from '@ihui/design-tokens'

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
import { BackChevron } from '../../components/BackChevron'
// G-815963:未知枚举档的唯一兜底出口(值档导入,与 `@ihui/types` 既有先例同形)。
import { coerceKnownOr } from '@ihui/types'

/**
 * 支付订单状态全集(字段对齐 mobile-rn PaymentScreen PaymentStatus)。
 * G-815966:值域由这张 `as const` 元组闭合,联合类型从它推导 —— 展示表以它为键,
 * 新增一档而表未补 = 编译错误(不再靠 `?? 默认` 把漏配悄悄糊过去)。
 */
export const PAYMENT_ORDER_STATUSES = [
  'pending',
  'paid',
  'failed',
  'cancelled',
  'refunded',
] as const

/** 支付订单状态(与 PAYMENT_ORDER_STATUSES 同源,不再手抄第二份成员清单) */
export type PaymentOrderStatus = (typeof PAYMENT_ORDER_STATUSES)[number]

/**
 * G-815963 显式声明的「无副作用档」= 终态且不可发起动作。
 *
 * 为什么是 cancelled 而不是 pending:`pending` 是本屏唯一挂出「立即支付 / 同步 / 取消」
 * 三个动作的档位(见 PAYMENT_ORDER_ACTIONABLE_STATUSES 与 isActionable 判据)。
 * 把读不到的未来档兜到 pending,等于把一笔身份不明的订单放回可操作集合 ——
 * 正是票面点名的上游反例(session-inputs 把未知 status 兜成 'admitted' 使已终态账
 * 重新可 settle),与状态前置 CAS 相互拆台。cancelled 是终态、只读、幂等。
 */
export const PAYMENT_ORDER_READONLY_FALLBACK = 'cancelled' as const satisfies PaymentOrderStatus

/** 可发起支付/同步/取消动作的档位集合(判定只在这一处;isActionable 与用例都读它) */
export const PAYMENT_ORDER_ACTIONABLE_STATUSES = [
  'pending',
] as const satisfies readonly PaymentOrderStatus[]

/**
 * 读侧收窄:值 ∈ 全集 ⇒ 逐字原样返回;值不在全集(未来档/脏值/非字符串)⇒ 兜到
 * 上面显式声明的终态档。**不改写任何已合法的值**(票面硬要求)。
 */
export function resolvePaymentOrderStatus(raw: unknown): PaymentOrderStatus {
  return coerceKnownOr(raw, PAYMENT_ORDER_STATUSES, PAYMENT_ORDER_READONLY_FALLBACK)
}

/** 该档能不能发起动作 —— 只有可动作集合里的档位算"是" */
export function isPaymentOrderActionable(status: PaymentOrderStatus): boolean {
  return (PAYMENT_ORDER_ACTIONABLE_STATUSES as readonly PaymentOrderStatus[]).includes(status)
}

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
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
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
        contentContainerStyle={{ gap: 10, padding: 10, paddingBottom: 32 }}
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
          // G-815963/966:先收窄再查表 —— 完备表以闭合联合为键,查表不再需要 `?? 默认`
          // 兜底(旧写法 `?? 'payment.status.pending'` 会把未知档显示成"待支付"并挂出支付按钮)。
          const status = resolvePaymentOrderStatus(item.status)
          const statusKey = STATUS_KEY[status]
          const statusStyle = statusToStyle(status, tk)
          const isPending = isPaymentOrderActionable(status)
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

/**
 * 状态→徽章底色:G-815966 的完备表形态。
 *
 * 旧写法是 `switch (status) { … default: return muted }` —— default 分支让"新增一档忘了配
 * 颜色"在编译层完全无感(它静默落到 muted),而表以闭合联合为键时漏一档就是 TS 错误。
 */
const STATUS_TONE_KEY: Record<PaymentOrderStatus, 'warning' | 'success' | 'danger' | 'muted'> = {
  pending: 'warning',
  paid: 'success',
  failed: 'danger',
  cancelled: 'muted',
  refunded: 'muted',
}

function statusToStyle(status: PaymentOrderStatus, tk: AppThemeTokens) {
  // 三目链而不是 switch:switch 的 default 分支正是"漏配静默兜底"的藏身处(见上方注释)
  const tone = STATUS_TONE_KEY[status]
  const backgroundColor =
    tone === 'warning'
      ? tk.warning.light
      : tone === 'success'
        ? tk.success.light
        : tone === 'danger'
          ? tk.danger.light
          : tk.surface.muted
  return { backgroundColor }
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    header: { paddingHorizontal: 10, paddingBottom: 8 },
    title: { marginTop: 8, fontSize: 24, fontWeight: '600', color: tk.text.primary },
    subtitle: { marginTop: 8, fontSize: 14, color: tk.text.secondary },
    errorWrap: { paddingHorizontal: 10, paddingVertical: 8 },
    errorText: { fontSize: 14, color: tk.danger.DEFAULT },
    toastWrap: { paddingHorizontal: 10, paddingVertical: 8 },
    toastText: { fontSize: 14, color: tk.success.DEFAULT },
    outlineBtn: {
      marginTop: 8,
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.success.DEFAULT,
      alignItems: 'center',
    },
    outlineBtnText: { fontSize: 14, color: tk.success.DEFAULT },
    card: {
      padding: 12,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
    },
    cardHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    cardTitle: { flex: 1, fontSize: 18, fontWeight: '600', color: tk.text.primary },
    statusTag: {
      marginLeft: 8,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: rnRadius.md,
    },
    statusTagText: { fontSize: 14, color: tk.text.primary },
    cardMetaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 8,
    },
    metaText: { fontSize: 14, color: tk.text.secondary },
    amountRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      marginTop: 8,
    },
    amountValue: { fontSize: 22, fontWeight: '700', color: tk.success.DEFAULT },
    actionWrap: { marginTop: 12, gap: 8 },
    primaryBtn: {
      height: 50,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryBtnText: { color: tk.surface.light, fontSize: 16, fontWeight: '600' },
    secondaryActions: { flexDirection: 'row', gap: 8 },
    flexBtn: { flex: 1 },
    btnDisabled: { opacity: 0.5 },
    emptyWrap: { alignItems: 'center', paddingVertical: 48 },
    muted: { marginTop: 8, fontSize: 14, color: tk.text.secondary },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
