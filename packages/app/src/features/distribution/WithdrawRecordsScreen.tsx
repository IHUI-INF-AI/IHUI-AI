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
import { ArrowDownToLine } from 'lucide-react-native'
import { formatPrice } from '@ihui/shared/utils'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import type { TFunction } from '../../types'
import { getTokens, type AppThemeMode, type AppThemeTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'

const NS = 'withdrawRecordsPage'

type StatusTone = 'pending' | 'processing' | 'completed' | 'failed' | 'neutral'

export interface WithdrawRecordRowView {
  id: string
  /** 原始金额(分) */
  originalCents: number
  /** 实际到账(分) */
  actualCents: number
  /** 手续费(分) */
  feeCents: number
  /** 薄壳注入的支付方式文案(微信/支付宝/银行卡) */
  methodText: string
  /** 0=待审核 1=处理中 2=已完成 3=失败 */
  status: number
  /** 薄壳注入的状态文案 */
  statusText: string
  /** 薄壳按同参 Intl 格式化后的创建时间 */
  timeText: string
  /** 薄壳按同参 Intl 格式化后的处理时间(空落 '-') */
  processedText: string
}

export interface WithdrawRecordsScreenProps {
  t: TFunction
  colorScheme: AppThemeMode
  onBack: () => void
  /** 非空即未登录门(与 web useAuthGate + AuthGatePrompt 同口径) */
  loginRequiredText: string
  loading: boolean
  error: string | null
  rows: WithdrawRecordRowView[]
  total: number
  loadingMore: boolean
  hasMore: boolean
  onEndReached: () => void
  onRefresh: () => void
  /** "提现"入口按钮文案;为空则不渲染底部按钮(onPress 由薄壳决定是否接线) */
  withdrawActionText?: string
  onWithdrawPress?: () => void
}

/** 与 web STATUS_CLS 同档(amber/amber/emerald/red → 令牌同名档) */
function statusTone(status: number): StatusTone {
  if (status === 0 || status === 1) return 'pending'
  if (status === 2) return 'completed'
  if (status === 3) return 'failed'
  return 'neutral'
}

/** 金额(分)→元,委托全仓唯一出口 */
function yuan(cents: number): string {
  return Number.isFinite(cents) ? `¥${formatPrice(cents)}` : '¥0.00'
}

/**
 * 提现记录共享屏 —— 承载 web /distribution/withdraw/records
 * (GET /api/finance/withdrawal/list)。
 *
 * 与 web 的口径差(如实登记):web 是「七列表格 + 上一页/下一页按钮」,RN 落为「卡片行 +
 * 下拉刷新 + 触底续页」,同一端点同参数(page/limit);七列表格在 RN 落为「标签—值」行,
 * 列文案五语值逐字取 web distribution 命名空间。状态/方式文案由薄壳注入(web 侧
 * distribution.withdrawStatus* 键缺失,薄壳取 admin.shop.withdrawals / wallet 同义键逐字值)。
 * 平台无关:取数/金额格式化/时间格式化/状态与方式文案全部由薄壳注入,本文件只管渲染与三态。
 */
export function WithdrawRecordsScreen({
  t,
  colorScheme,
  onBack,
  loginRequiredText,
  loading,
  error,
  rows,
  total,
  loadingMore,
  hasMore,
  onEndReached,
  onRefresh,
  withdrawActionText,
  onWithdrawPress,
}: WithdrawRecordsScreenProps) {
  const tk = getTokens(colorScheme)
  const { styles, badgeTone } = useMemo(() => createStyles(tk), [tk])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <View style={styles.titleBox}>
          <View style={styles.titleRow}>
            <ArrowDownToLine size={20} color={tk.brand.DEFAULT} />
            <Text style={styles.title}>{t(`${NS}.title`)}</Text>
          </View>
          {total > 0 ? <Text style={styles.muted}>{t(`${NS}.totalOf`, { total })}</Text> : null}
        </View>
      </View>

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
          <ArrowDownToLine size={30} color={tk.text.tertiary} />
          <Text style={styles.muted}>{t(`${NS}.empty`)}</Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const tone = statusTone(item.status)
            return (
              <View style={styles.row}>
                <View style={styles.rowHead}>
                  <Text style={styles.originalValue}>{yuan(item.originalCents)}</Text>
                  <Text style={[styles.badge, badgeTone[tone]]}>{item.statusText}</Text>
                </View>
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>{t(`${NS}.colActualAmount`)}</Text>
                  <Text style={styles.actualValue}>{yuan(item.actualCents)}</Text>
                </View>
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>{t(`${NS}.colFee`)}</Text>
                  <Text style={styles.fieldValue}>{yuan(item.feeCents)}</Text>
                </View>
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>{t(`${NS}.colMethod`)}</Text>
                  <Text style={styles.fieldValue}>{item.methodText}</Text>
                </View>
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>{t(`${NS}.colTime`)}</Text>
                  <Text style={styles.fieldValue}>{item.timeText}</Text>
                </View>
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>{t(`${NS}.colProcessedAt`)}</Text>
                  <Text style={styles.fieldValue}>{item.processedText}</Text>
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
            <View>
              {loadingMore ? (
                <Text style={styles.footerMuted}>{t(`${NS}.loading`)}</Text>
              ) : null}
              {withdrawActionText && onWithdrawPress ? (
                <TouchableOpacity style={styles.actionBtn} onPress={onWithdrawPress}>
                  <Text style={styles.actionText}>{withdrawActionText}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          }
        />
      )}
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg, paddingHorizontal: rnSpacing.md },
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
    originalValue: { flex: 1, fontSize: rnType.body.size, fontWeight: '600', color: tk.text.primary },
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
    fieldValue: { flex: 1, textAlign: 'right', fontSize: rnType.caption.size, color: tk.text.primary },
    actualValue: {
      flex: 1,
      textAlign: 'right',
      fontSize: rnType.caption.size,
      fontWeight: '600',
      color: tk.success.DEFAULT,
    },
    footerMuted: {
      textAlign: 'center',
      paddingVertical: rnSpacing.md,
      fontSize: rnType.caption.size,
      color: tk.text.secondary,
    },
    actionBtn: {
      alignItems: 'center',
      paddingVertical: rnSpacing.md,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    actionText: { fontSize: rnType.body.size, fontWeight: '600', color: tk.text.primary },
  })

  const badgeTone: Record<StatusTone, TextStyle> = {
    pending: { backgroundColor: tk.warning.amberLight, color: tk.warning.amberText },
    processing: { backgroundColor: tk.warning.amberLight, color: tk.warning.amberText },
    completed: { backgroundColor: tk.success.lightest, color: tk.success.deepText },
    failed: { backgroundColor: tk.danger.light, color: tk.danger.DEFAULT },
    neutral: { backgroundColor: tk.surface.muted, color: tk.text.secondary },
  }

  return { styles, badgeTone }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
