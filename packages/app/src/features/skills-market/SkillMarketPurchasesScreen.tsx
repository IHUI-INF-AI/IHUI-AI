// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo, useState } from 'react'
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { ReceiptText, RotateCcw } from 'lucide-react-native'
import { rnRadius, rnRadiusFor, rnSpacing, rnType } from '@ihui/design-tokens'
import type {
  SkillMarketPurchasesScreenProps,
  SkillMyPurchaseView,
  SkillRefundRequestStatus,
} from '@ihui/types'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'
import { TextField } from '../../components/TextField'
import { EmptyState, ErrorState, ScreenSkeleton } from '../../components/ScreenStates'

export type { SkillMarketPurchasesScreenProps, SkillMyPurchaseView }

function formatMoney(cents: number, currency: string): string {
  const symbol = currency === 'CNY' || currency === 'RMB' ? '¥' : `${currency} `
  return `${symbol}${(Number.isFinite(cents) ? cents / 100 : 0).toFixed(2)}`
}

function formatDate(value: string | null): string {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function requestLabel(
  t: SkillMarketPurchasesScreenProps['t'],
  status: SkillRefundRequestStatus,
): string {
  if (status === 'pending') return t('skillsMarket.refundPending')
  if (status === 'approved') return t('skillsMarket.refundApproved')
  if (status === 'rejected') return t('skillsMarket.refundRejected')
  return t('skillsMarket.refundCancelled')
}

function badgeColors(tk: AppThemeTokens, status: SkillRefundRequestStatus) {
  if (status === 'pending') {
    return { bg: tk.warning.amberLight, fg: tk.warning.onAmber }
  }
  if (status === 'approved') {
    return { bg: tk.success.lighter, fg: tk.success.onGreen }
  }
  if (status === 'rejected') {
    return { bg: tk.danger.light, fg: tk.danger.deepText }
  }
  return { bg: tk.surface.muted, fg: tk.text.secondary }
}

/**
 * SkillMarketPurchasesScreen 买家“我的购买 / 申请退款”共享屏。
 *
 * 与 web `/skills-market/purchases` 同一条数据契约：
 * `GET /api/skills/market/purchases` 返回当前买家的购买与最近一次退款申请。
 * 共享屏只负责展示和收集退款原因；取数、提交、刷新、提示由宿主注入。
 * 退款原因下限与后端一致，均为 5 个字符；按钮在不足 5 字时保持禁用。
 */
export function SkillMarketPurchasesScreen({
  t,
  items,
  loading,
  error,
  notice,
  noticeTone = '',
  submittingId,
  onBack,
  onRetry,
  onRequestRefund,
  colorScheme = 'light',
}: SkillMarketPurchasesScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  const [openId, setOpenId] = useState<string | null>(null)
  const [reason, setReason] = useState('')

  const header = (
    <View style={styles.headerBar}>
      <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
      <Text style={styles.headerTitle} numberOfLines={1}>
        {t('skillsMarket.myPurchasesTitle')}
      </Text>
      <View style={styles.headerSpacer} />
    </View>
  )

  if (loading && items.length === 0) {
    return (
      <View style={styles.container}>
        {header}
        <ScreenSkeleton variant="card" count={3} colorScheme={colorScheme} />
      </View>
    )
  }

  if (error && items.length === 0) {
    return (
      <View style={styles.container}>
        {header}
        <ErrorState
          message={error}
          onRetry={onRetry}
          retryLabel={t('common.retry')}
          colorScheme={colorScheme}
        />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {header}
      {notice ? (
        <View
          style={[
            styles.notice,
            noticeTone === 'success'
              ? styles.noticeSuccess
              : noticeTone === 'error'
                ? styles.noticeError
                : null,
          ]}
        >
          <Text
            style={[
              styles.noticeText,
              noticeTone === 'success'
                ? styles.noticeTextSuccess
                : noticeTone === 'error'
                  ? styles.noticeTextError
                  : null,
            ]}
          >
            {notice}
          </Text>
        </View>
      ) : null}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.summaryRow}>
            <ReceiptText size={16} color={tk.brandAccent.deep} strokeWidth={2} />
            <Text style={styles.summaryText}>
              {t('skillsMarket.purchaseCount', { count: items.length })}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title={t('skillsMarket.myPurchasesEmpty')}
            desc={t('skillsMarket.myPurchasesEmptyHint')}
            colorScheme={colorScheme}
          />
        }
        renderItem={({ item }) => {
          const request = item.refundRequest
          const requestColors = request ? badgeColors(tk, request.status) : null
          const submitting = submittingId === item.id
          const canSubmit = reason.trim().length >= 5 && !submittingId
          return (
            <View style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={styles.skillName} numberOfLines={1}>
                  {item.skillName}
                </Text>
                <View
                  style={[
                    styles.badge,
                    {
                      backgroundColor:
                        item.status === 'refunded' ? tk.surface.muted : tk.success.lighter,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.badgeText,
                      {
                        color: item.status === 'refunded' ? tk.text.secondary : tk.success.onGreen,
                      },
                    ]}
                  >
                    {item.status === 'refunded'
                      ? t('skillsMarket.purchaseStatusRefunded')
                      : t('skillsMarket.purchaseStatusPaid')}
                  </Text>
                </View>
              </View>

              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>{t('skillsMarket.price')}</Text>
                <Text style={styles.metaStrong}>{formatMoney(item.priceCents, item.currency)}</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>{t('skillsMarket.purchasedAt')}</Text>
                <Text style={styles.metaValue}>{formatDate(item.createdAt)}</Text>
              </View>
              {item.status === 'refunded' ? (
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>{t('skillsMarket.refundAmount')}</Text>
                  <Text style={styles.metaStrong}>
                    {formatMoney(item.refundAmountCents, item.currency)}
                  </Text>
                  <Text style={styles.metaValue}>{formatDate(item.refundedAt)}</Text>
                </View>
              ) : null}

              {request && requestColors ? (
                <View style={styles.requestBlock}>
                  <View style={styles.requestHead}>
                    <Text style={styles.requestLabel}>{t('skillsMarket.refundRequest')}</Text>
                    <View style={[styles.badge, { backgroundColor: requestColors.bg }]}>
                      <Text style={[styles.badgeText, { color: requestColors.fg }]}>
                        {requestLabel(t, request.status)}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.requestReason} numberOfLines={3}>
                    {request.reason}
                  </Text>
                  {request.reviewNote ? (
                    <Text style={styles.reviewNote}>
                      {t('skillsMarket.reviewNote')}: {request.reviewNote}
                    </Text>
                  ) : null}
                </View>
              ) : null}

              {item.canRequestRefund ? (
                openId === item.id ? (
                  <View style={styles.form}>
                    <TextField
                      colorScheme={colorScheme}
                      style={styles.reasonInput}
                      value={reason}
                      onChangeText={setReason}
                      placeholder={t('skillsMarket.refundReasonPlaceholder')}
                      placeholderTextColor={tk.text.secondary}
                      multiline
                      maxLength={500}
                      textAlignVertical="top"
                    />
                    <View style={styles.formFoot}>
                      <Text style={styles.reasonHint}>{t('skillsMarket.refundReasonHint')}</Text>
                      <Text style={styles.reasonCount}>{reason.trim().length}/500</Text>
                    </View>
                    <View style={styles.formActions}>
                      <TouchableOpacity
                        style={styles.secondaryBtn}
                        onPress={() => {
                          setOpenId(null)
                          setReason('')
                        }}
                        disabled={submitting}
                        accessibilityRole="button"
                      >
                        <Text style={styles.secondaryBtnText}>{t('skillsMarket.cancel')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.primaryBtn, !canSubmit ? styles.btnDisabled : null]}
                        onPress={() => {
                          onRequestRefund(item.id, reason.trim())
                          setOpenId(null)
                          setReason('')
                        }}
                        disabled={!canSubmit}
                        accessibilityRole="button"
                      >
                        <Text style={styles.primaryBtnText}>
                          {submitting
                            ? t('skillsMarket.submitting')
                            : t('skillsMarket.submitRefund')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.requestBtn}
                    onPress={() => {
                      setOpenId(item.id)
                      setReason('')
                    }}
                    accessibilityRole="button"
                  >
                    <RotateCcw size={14} color={tk.brandAccent.deep} strokeWidth={2} />
                    <Text style={styles.requestBtnText}>
                      {request?.status === 'rejected'
                        ? t('skillsMarket.requestAgain')
                        : t('skillsMarket.requestRefund')}
                    </Text>
                  </TouchableOpacity>
                )
              ) : null}
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
    headerBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: rnSpacing.lg,
      paddingTop: rnSpacing.md,
      paddingBottom: rnSpacing.sm,
    },
    headerTitle: {
      flexShrink: 1,
      fontSize: rnType.title.size,
      fontWeight: '500',
      color: tk.text.primary,
    },
    headerSpacer: { width: 32 },
    notice: {
      marginHorizontal: rnSpacing.lg,
      marginBottom: rnSpacing.sm,
      padding: rnSpacing.sm,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    noticeSuccess: { backgroundColor: tk.success.lighter, borderColor: tk.success.light },
    noticeError: { backgroundColor: tk.danger.light, borderColor: tk.danger.bright },
    noticeText: { fontSize: rnType.label.size, color: tk.text.primary },
    noticeTextSuccess: { color: tk.success.deepText },
    noticeTextError: { color: tk.danger.deepText },
    listContent: { paddingHorizontal: rnSpacing.lg, paddingBottom: rnSpacing['3xl'] },
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.xs,
      paddingVertical: rnSpacing.sm,
    },
    summaryText: { fontSize: rnType.caption.size, color: tk.text.secondary },
    card: {
      marginBottom: rnSpacing.sm,
      padding: rnSpacing.md,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: 'transparent',
      backgroundColor: tk.surface.card,
    },
    cardHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: rnSpacing.sm,
    },
    skillName: {
      flexShrink: 1,
      fontSize: rnType.title.size,
      fontWeight: '600',
      color: tk.text.primary,
    },
    badge: {
      flexShrink: 0,
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: 1,
      borderRadius: rnRadiusFor.chip,
    },
    badgeText: { fontSize: rnType.caption.size, fontWeight: '600' },
    metaRow: {
      marginTop: rnSpacing.xs,
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.xs,
    },
    metaLabel: { fontSize: rnType.caption.size, color: tk.text.medium },
    metaStrong: { fontSize: rnType.label.size, fontWeight: '600', color: tk.text.primary },
    metaValue: { fontSize: rnType.label.size, color: tk.text.secondary },
    requestBlock: {
      marginTop: rnSpacing.sm,
      paddingTop: rnSpacing.sm,
      borderTopWidth: 1,
      borderTopColor: tk.border.light,
      gap: rnSpacing.xs,
    },
    requestHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: rnSpacing.sm,
    },
    requestLabel: { fontSize: rnType.caption.size, fontWeight: '600', color: tk.text.secondary },
    requestReason: {
      fontSize: rnType.label.size,
      lineHeight: rnType.bodySm.lineHeight,
      color: tk.text.primary,
    },
    reviewNote: { fontSize: rnType.caption.size, color: tk.text.secondary },
    requestBtn: {
      marginTop: rnSpacing.sm,
      minHeight: 40,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.xs,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tk.brandAccent.deep,
      backgroundColor: tk.brandAccent.light,
    },
    requestBtnText: { fontSize: rnType.label.size, fontWeight: '600', color: tk.brandAccent.deep },
    form: { marginTop: rnSpacing.sm, gap: rnSpacing.xs },
    reasonInput: {
      minHeight: 84,
      paddingTop: rnSpacing.sm,
      fontSize: rnType.label.size,
      color: tk.text.primary,
      backgroundColor: tk.surface.muted,
    },
    formFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    reasonHint: { flexShrink: 1, fontSize: rnType.caption.size, color: tk.text.medium },
    reasonCount: { fontSize: rnType.caption.size, color: tk.text.medium },
    formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: rnSpacing.sm },
    secondaryBtn: {
      minHeight: 40,
      paddingHorizontal: rnSpacing.md,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tk.border.medium,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryBtnText: { fontSize: rnType.label.size, color: tk.text.primary },
    primaryBtn: {
      minHeight: 40,
      paddingHorizontal: rnSpacing.md,
      borderRadius: rnRadius.md,
      backgroundColor: tk.brand.cta,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryBtnText: {
      fontSize: rnType.label.size,
      fontWeight: '600',
      color: tk.brand.ctaForeground,
    },
    btnDisabled: { opacity: 0.4 },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
