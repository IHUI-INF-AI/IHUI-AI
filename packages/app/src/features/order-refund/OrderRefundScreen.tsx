import { useMemo } from 'react'
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { TFunction } from '../../types'

/** 退款订单项(平台注入,字段对齐 mobile-rn OrderRefundScreen Order 子集) */
export interface OrderRefundItem {
  id: string
  orderNo: string
  /** 商品/目标标题(原 targetTitle) */
  targetTitle: string
  /** 支付金额(原 payAmount) */
  payAmount: number
  /** 已格式化的创建时间文本(平台注入,避免共享层依赖日期工具) */
  createdAtText: string
}

/** OrderRefundScreen props(注入式:wrapper 保留 API 调用 + 选中态管理) */
export interface OrderRefundScreenProps {
  t: TFunction
  orders: OrderRefundItem[]
  loading: boolean
  refreshing: boolean
  error: string
  /** 当前展开的订单 id(平台注入) */
  selectedId: string | null
  /** 退款原因输入(平台注入) */
  reason: string
  submitting: boolean
  submitError: string
  submitSuccess: string
  /** 选中订单回调(展开退款表单) */
  onSelectOrder: (id: string) => void
  onReasonChange: (text: string) => void
  /** 提交退款回调(平台注入内部 API 调用) */
  onSubmit: (order: OrderRefundItem) => void
  /** 取消退款表单回调 */
  onCancel: () => void
  onRefresh: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/**
 * 退款申请共享屏 — props 注入式跨端组件
 *
 * 平台无关:负责渲染 header + 订单列表(标题 + 金额 + 订单号 + 时间)
 * + 选中展开退款原因输入框 + 提交/取消按钮。平台特定(API/导航)由 wrapper 注入。
 */
export function OrderRefundScreen({
  t,
  orders,
  loading,
  refreshing,
  error,
  selectedId,
  reason,
  submitting,
  submitError,
  submitSuccess,
  onSelectOrder,
  onReasonChange,
  onSubmit,
  onCancel,
  onRefresh,
  onBack,
  colorScheme = 'light',
}: OrderRefundScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('orderRefund.title')}</Text>
        <Text style={styles.subtitle}>{t('orderRefund.subtitle')}</Text>
      </View>

      {error ? (
        <View style={styles.errorWrap}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.outlineBtn} onPress={onRefresh}>
            <Text style={styles.outlineBtnText}>{t('orderRefund.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {submitSuccess ? (
        <View style={styles.successWrap}>
          <Text style={styles.successText}>{submitSuccess}</Text>
        </View>
      ) : null}

      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 10, paddingBottom: 32 }}
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
              <Text style={styles.muted}>{t('orderRefund.empty')}</Text>
            </View>
          )
        }
        renderItem={({ item }) => {
          const isSelected = selectedId === item.id
          return (
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.targetTitle}
                </Text>
                <Text style={styles.cardAmount}>¥ {item.payAmount.toFixed(2)}</Text>
              </View>
              <View style={styles.cardMetaRow}>
                <Text style={styles.metaText}>
                  {t('orderRefund.orderNo')}:{item.orderNo}
                </Text>
                <Text style={styles.metaText}>{item.createdAtText}</Text>
              </View>

              {isSelected ? (
                <View style={styles.refundForm}>
                  <Text style={styles.formLabel}>{t('orderRefund.reasonLabel')}</Text>
                  <TextInput
                    style={styles.formInput}
                    value={reason}
                    onChangeText={onReasonChange}
                    placeholder={t('orderRefund.reasonPlaceholder')}
                    placeholderTextColor={tk.text.tertiary}
                    multiline
                  />
                  {submitError ? <Text style={styles.errorText}>{submitError}</Text> : null}
                  <View style={styles.formActions}>
                    <TouchableOpacity
                      style={[
                        styles.formBtn,
                        styles.formPrimaryBtn,
                        submitting && styles.formBtnDisabled,
                      ]}
                      onPress={() => onSubmit(item)}
                      disabled={submitting}
                    >
                      <Text style={styles.formPrimaryBtnText}>
                        {submitting ? t('common.loading') : t('orderRefund.submit')}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.formBtn, styles.formOutlineBtn]}
                      onPress={onCancel}
                      disabled={submitting}
                    >
                      <Text style={styles.outlineBtnText}>{t('common.cancel')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.applyRow}>
                  <TouchableOpacity
                    style={[styles.formBtn, styles.formOutlineBtn, styles.applyBtn]}
                    onPress={() => onSelectOrder(item.id)}
                  >
                    <Text style={styles.outlineBtnText}>{t('orderRefund.applyRefund')}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )
        }}
      />
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    header: { paddingHorizontal: 10, paddingTop: 48, paddingBottom: 8 },
    backText: { fontSize: 18, color: tk.text.medium },
    title: { marginTop: 8, fontSize: 24, fontWeight: '600', color: tk.text.primary },
    subtitle: { marginTop: 8, fontSize: 14, color: tk.text.secondary },
    errorWrap: { paddingHorizontal: 10, paddingVertical: 8 },
    errorText: { fontSize: 14, color: tk.danger.DEFAULT },
    successWrap: { paddingHorizontal: 10, paddingVertical: 8 },
    successText: { fontSize: 14, color: tk.success.DEFAULT },
    outlineBtn: {
      marginTop: 8,
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: tk.success.DEFAULT,
      alignSelf: 'flex-start',
    },
    outlineBtnText: { fontSize: 14, color: tk.success.DEFAULT },
    separator: { height: StyleSheet.hairlineWidth, backgroundColor: tk.border.light },
    card: {
      padding: 12,
      borderRadius: 12,
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
    cardAmount: { marginLeft: 8, fontSize: 18, fontWeight: '600', color: tk.success.DEFAULT },
    cardMetaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 8,
    },
    metaText: { fontSize: 14, color: tk.text.secondary },
    refundForm: {
      marginTop: 12,
      padding: 12,
      borderRadius: 12,
      backgroundColor: tk.surface.muted,
    },
    formLabel: { fontSize: 14, fontWeight: '500', color: tk.text.primary },
    formInput: {
      marginTop: 8,
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: '#eaeaea',
      minHeight: 80,
      fontSize: 16,
      color: tk.text.primary,
      backgroundColor: '#f5f5f5',
    },
    formActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
    formBtn: { flex: 1, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    formPrimaryBtn: { backgroundColor: tk.brand.DEFAULT, height: 50 },
    formPrimaryBtnText: { color: tk.surface.light, fontSize: 16, fontWeight: '600' },
    formOutlineBtn: {
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.bg,
    },
    formBtnDisabled: { opacity: 0.5 },
    applyRow: { marginTop: 12 },
    applyBtn: { alignSelf: 'flex-start' },
    emptyWrap: { alignItems: 'center', paddingVertical: 48 },
    muted: { marginTop: 8, fontSize: 14, color: tk.text.secondary },
  })
}
