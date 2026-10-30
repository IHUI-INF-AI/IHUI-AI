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
import { ArrowDownToLine, Wallet } from 'lucide-react-native'
import { formatPrice } from '@ihui/shared/utils'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import type { TFunction } from '../../types'
import { getTokens, type AppThemeMode, type AppThemeTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'

const NS = 'walletWithdrawRecordsPage'

type StatusTone = 'pending' | 'processing' | 'completed' | 'failed' | 'neutral'

export interface WalletWithdrawRecordRowView {
  id: string
  /** 原始申请金额（分） */
  originalCents: number
  /** 实际到账（分） */
  actualCents: number
  /** 手续费（分） */
  feeCents: number
  /** 薄壳注入的提现方式文案（微信/支付宝/银行卡） */
  methodText: string
  /** 0=待审核 1=处理中 2=已完成 3=失败 */
  status: number
  /** 薄壳注入的状态文案 */
  statusText: string
  /** 薄壳按同参 Intl 格式化后的创建时间 */
  timeText: string
}

export interface WalletWithdrawRecordsScreenProps {
  t: TFunction
  colorScheme: AppThemeMode
  onBack: () => void
  /** 非空即未登录门（与 web useAuthGate + AuthGatePrompt 同口径） */
  loginRequiredText: string
  loading: boolean
  error: string | null
  rows: WalletWithdrawRecordRowView[]
  total: number
  loadingMore: boolean
  hasMore: boolean
  onEndReached: () => void
  onRefresh: () => void
  /** 当前可提现金额（分） */
  availableCents: number
  /** 待审核+处理中金额（分） */
  processingCents: number
  /** 已完成到账金额（分） */
  completedCents: number
  /** 统计卡加载中 */
  statsLoading: boolean
  /** 底部「返回钱包」按钮文案；为空则不渲染（避免死按钮） */
  backToWalletText?: string
  /** 底部「返回钱包」跳转回调；为空则不渲染该按钮 */
  onBackToWallet?: () => void
}

/** 与 web STATUS_CLS 同档（amber/amber/emerald/red → 令牌同名档） */
function statusTone(status: number): StatusTone {
  if (status === 0 || status === 1) return 'pending'
  if (status === 2) return 'completed'
  if (status === 3) return 'failed'
  return 'neutral'
}

/** 金额（分）→元，委托全仓唯一出口 */
function yuan(cents: number): string {
  return Number.isFinite(cents) ? `¥${formatPrice(cents)}` : '¥0.00'
}

/**
 * 钱包提现记录共享屏 —— 承载 web /wallet/withdraw/records
 * (GET /api/finance/withdrawal/list + /summary + /available)。
 *
 * 与 web 的口径差（如实登记，详见 manifest ledger）：
 *  - web 是「三张统计卡 + 五列表格 + 上一页/下一页按钮」，RN 落为「三张统计卡 +
 *    卡片行 + 下拉刷新 + 触底续页」，同端点同参数（page/limit=20）。
 *  - web 统计卡读 summary 的 {total, processing, completed}，后端真实信封是
 *    {totalWithdrawn, pendingAmount}（apps/api/src/db/commission-queries.ts:643-656），
 *    且「可提现金额」在后端另有独立端点 /api/finance/withdrawal/available；
 *    故本屏三卡分别接 available / pendingAmount / totalWithdrawn。
 *  - web 行首列取 it.amount、金额列取 it.actualAmount（该字段后端不存在），
 *    RN 改为「提现金额=原始申请 originalAmount、实际到账=amount、手续费=fee」，
 *    三值均来自 withdrawal_flows 真实列。
 *  - 状态/提现方式文案由薄壳注入（web wallet 命名空间缺 status* 四键）。
 *
 * 平台无关：取数/金额格式化/时间格式化/状态与方式文案全部由薄壳注入，
 * 本文件只管渲染与三态。
 */
export function WalletWithdrawRecordsScreen({
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
  availableCents,
  processingCents,
  completedCents,
  statsLoading,
  backToWalletText,
  onBackToWallet,
}: WalletWithdrawRecordsScreenProps) {
  const tk = getTokens(colorScheme)
  const { styles, badgeTone } = useMemo(() => createStyles(tk), [tk])

  const stats = [
    { label: t(`${NS}.availableAmount`), value: availableCents },
    { label: t(`${NS}.processingAmount`), value: processingCents },
    { label: t(`${NS}.completedAmount`), value: completedCents },
  ]

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
      ) : (
        <>
          <View style={styles.statsRow}>
            {stats.map((s) => (
              <View key={s.label} style={styles.statCard}>
                <Text style={styles.statLabel}>{s.label}</Text>
                {statsLoading ? (
                  <ActivityIndicator size="small" color={tk.brand.DEFAULT} />
                ) : (
                  <Text style={styles.statValue}>{yuan(s.value)}</Text>
                )}
              </View>
            ))}
          </View>

          {loading ? (
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
                      <View style={styles.headCell}>
                        <Text style={styles.fieldLabel}>{t(`${NS}.withdrawAmount`)}</Text>
                        <Text style={styles.originalValue}>{yuan(item.originalCents)}</Text>
                      </View>
                      <View style={styles.headCell}>
                        <Text style={styles.fieldLabel}>{t(`${NS}.flowType`)}</Text>
                        <Text style={[styles.badge, badgeTone[tone]]}>{item.statusText}</Text>
                      </View>
                    </View>
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>{t(`${NS}.flowAmount`)}</Text>
                      <View style={styles.valueCell}>
                        <Text style={styles.actualValue}>{yuan(item.actualCents)}</Text>
                        <Text style={styles.feeValue}>{`-${yuan(item.feeCents)}`}</Text>
                      </View>
                    </View>
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>{t(`${NS}.withdrawMethod`)}</Text>
                      <Text style={styles.fieldValue}>{item.methodText}</Text>
                    </View>
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>{t(`${NS}.flowTime`)}</Text>
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
                <View>
                  {loadingMore ? (
                    <Text style={styles.footerMuted}>{t(`${NS}.loading`)}</Text>
                  ) : null}
                  {backToWalletText && onBackToWallet ? (
                    <TouchableOpacity style={styles.actionBtn} onPress={onBackToWallet}>
                      <Wallet size={16} color={tk.text.primary} />
                      <Text style={styles.actionText}>{backToWalletText}</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              }
            />
          )}
        </>
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
    statsRow: { flexDirection: 'row', gap: rnSpacing.sm, marginTop: rnSpacing.md },
    statCard: {
      flex: 1,
      gap: rnSpacing.xs,
      padding: rnSpacing.sm,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    statLabel: { fontSize: rnType.caption.size, color: tk.text.secondary },
    statValue: { fontSize: rnType.title.size, fontWeight: '700', color: tk.text.primary },
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
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: rnSpacing.sm,
    },
    headCell: { flex: 1, gap: 2 },
    originalValue: {
      fontSize: rnType.body.size,
      fontWeight: '600',
      color: tk.text.primary,
    },
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
    valueCell: { flex: 1, alignItems: 'flex-end' },
    actualValue: { fontSize: rnType.caption.size, fontWeight: '600', color: tk.text.primary },
    feeValue: { fontSize: rnType.caption.size, color: tk.text.secondary },
    footerMuted: {
      textAlign: 'center',
      paddingVertical: rnSpacing.md,
      fontSize: rnType.caption.size,
      color: tk.text.secondary,
    },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.sm,
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
