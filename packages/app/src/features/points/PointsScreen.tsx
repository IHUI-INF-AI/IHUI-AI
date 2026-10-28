// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { Award, Gift, ListChecks, ShoppingBag, Stamp } from 'lucide-react-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'

import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { TFunction } from '../../types'
import { BackChevron } from '../../components/BackChevron'
import { ErrorState, ScreenSkeleton } from '../../components/ScreenStates'

/**
 * PointsScreen — 跨端共享「积分中心屏」(门 39 六屏共享化第二批)。
 *
 * 为什么进共享层:守门 39(`scripts/check-rn-app-migration.mjs`)的屏级共享维要求
 * RN 侧有 `@ihui/rn-app` import 的同时 `packages/app` 里有同名共享屏 —— 本文件是
 * `apps/mobile-rn/src/screens/PointsScreen.tsx` 的 UI 下沉(照
 * `features/usage/UsageScreen.tsx` / `features/payment/PaymentScreen.tsx` 的 props 注入式,
 * wrapper 只留 API 调用、导航、i18n 与主题注入)。**不准**靠"补一条 import"或塞白名单消红。
 *
 * 平台无关边界:
 *  - 导航:只收 `onBack` / `onOpenMall` / `onOpenTasks` / `onOpenRules`,不 import 任何 router;
 *  - 数据:总览四元(`account` / `level` / `today`)与流水(`txs`)由平台按 apps/api
 *    `gamification.ts` 契约取回后注入,时间先由平台格式化成 `createdAtText`;
 *  - 收入/支出方向(`income`)由平台按后端 `type !== 'spend'` 判定后注入 —— 该判据与
 *    后端契约同处,共享层不理解 `type` 取值;
 *  - 签到结果的 `appAlert` 弹层属平台能力,共享层只发 `onSignIn`。
 */

/** GET /api/points ⇒ points 载荷 */
export interface PointsAccountInfo {
  points: number
  totalEarned: number
  totalSpent: number
  level: number
  experience: number
}

/** 经验等级档位(GET /api/levels/current 的 current / next) */
export interface PointsLevelTier {
  level: number
  name: string
  minExperience: number
}

/** GET /api/levels/current 载荷 */
export interface PointsLevelInfo {
  current: PointsLevelTier | null
  next: PointsLevelTier | null
  experience: number
  progress: number
}

/** GET /api/sign-in/today 载荷中本屏渲染用到的字段(week 属签到历史屏射程) */
export interface PointsSignInToday {
  signedIn: boolean
  consecutiveDays: number
  todayReward: number
}

/** 流水行(平台注入;时间与收支方向已算好) */
export interface PointsTransactionItem {
  id: string
  /** description 优先、回落 source 的行标题(平台取词) */
  title: string
  /** 平台格式化好的流水时间文本 */
  createdAtText: string
  amount: number
  /** true = 收入(正数绿),false = 支出(负数红) */
  income: boolean
  balanceAfter: number
}

export interface PointsScreenProps {
  t: TFunction
  account: PointsAccountInfo | null
  level: PointsLevelInfo | null
  today: PointsSignInToday | null
  loading: boolean
  /** 总览加载失败(渲染错误态 + 重试钮) */
  failed: boolean
  /** 签到请求进行中 */
  signing: boolean
  txs: PointsTransactionItem[]
  txTotal: number
  txLoading: boolean
  txFailed: boolean
  onRetryOverview: () => void
  onRetryTxs: () => void
  onLoadMoreTxs: () => void
  onSignIn: () => void
  onOpenMall: () => void
  onOpenTasks: () => void
  onOpenRules: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 距下一级还差多少经验(无下一级 ⇒ 0);两端共用同一算法。 */
export function pointsExpToNext(level: PointsLevelInfo | null): number {
  const next = level?.next
  if (!next) return 0
  return Math.max(0, next.minExperience - (level?.experience ?? 0))
}

export function PointsScreen({
  t,
  account,
  level,
  today,
  loading,
  failed,
  signing,
  txs,
  txTotal,
  txLoading,
  txFailed,
  onRetryOverview,
  onRetryTxs,
  onLoadMoreTxs,
  onSignIn,
  onOpenMall,
  onOpenTasks,
  onOpenRules,
  onBack,
  colorScheme = 'light',
}: PointsScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const remaining = pointsExpToNext(level)
  const stats = [
    { key: 'current', label: t('points.current'), value: account?.points },
    { key: 'earned', label: t('points.totalEarned'), value: account?.totalEarned },
    { key: 'spent', label: t('points.totalSpent'), value: account?.totalSpent },
    { key: 'level', label: t('points.level'), value: account ? `Lv.${account.level}` : undefined },
  ]

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.title}>{t('points.title')}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.subtitle}>{t('points.subtitle')}</Text>

        {loading ? (
          <ScreenSkeleton variant="card" count={4} colorScheme={colorScheme} />
        ) : failed ? (
          <ErrorState
            message={t('points.loadFailed')}
            onRetry={onRetryOverview}
            retryLabel={t('common.retry')}
            colorScheme={colorScheme}
          />
        ) : (
          <>
            <View style={styles.statGrid}>
              {stats.map((s) => (
                <View key={s.key} style={styles.statCard}>
                  <Text style={styles.statLabel}>{s.label}</Text>
                  <Text style={styles.statValue}>{s.value ?? '—'}</Text>
                </View>
              ))}
            </View>

            <View style={styles.card}>
              <View style={styles.cardHead}>
                <Award size={16} color={tk.text.secondary} />
                <Text style={styles.cardTitle}>{level?.current?.name ?? t('points.level')}</Text>
                <Text style={styles.cardMuted}>
                  {level?.next
                    ? t('points.nextLevel', { name: level.next.name, points: remaining })
                    : t('points.maxLevel')}
                </Text>
              </View>
              <Text style={styles.cardMuted}>
                {t('points.experience')}: {level?.experience ?? account?.experience ?? 0}
              </Text>
            </View>

            <View style={styles.card}>
              <View style={styles.cardHead}>
                <Stamp size={16} color={tk.text.secondary} />
                <Text style={styles.cardTitle}>{t('points.signIn.title')}</Text>
                <Text style={styles.cardMuted}>
                  {today?.signedIn ? t('points.signIn.signedIn') : t('points.signIn.notSignedIn')}
                </Text>
              </View>
              <Text style={styles.cardMuted}>
                {t('points.signIn.consecutive', { days: today?.consecutiveDays ?? 0 })} ·{' '}
                {t('points.signIn.todayReward')}: {today?.todayReward ?? 0}
              </Text>
              <TouchableOpacity
                style={[styles.button, (signing || today?.signedIn) && styles.buttonDisabled]}
                onPress={onSignIn}
                disabled={signing || !!today?.signedIn}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={t('points.signIn.signInBtn')}
              >
                <Text style={styles.buttonText}>
                  {today?.signedIn
                    ? t('points.signIn.signedIn')
                    : signing
                      ? t('points.signIn.signing')
                      : t('points.signIn.signInBtn')}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.entryRow}>
              <TouchableOpacity
                style={styles.entryBtn}
                onPress={onOpenMall}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={t('points.mallLink')}
              >
                <ShoppingBag size={16} color={tk.text.primary} />
                <Text style={styles.entryText}>{t('points.mallLink')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.entryBtn}
                onPress={onOpenTasks}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={t('points.taskCenterLink')}
              >
                <ListChecks size={16} color={tk.text.primary} />
                <Text style={styles.entryText}>{t('points.taskCenterLink')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.entryBtn}
                onPress={onOpenRules}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={t('points.ruleLink')}
              >
                <Gift size={16} color={tk.text.primary} />
                <Text style={styles.entryText}>{t('points.ruleLink')}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('points.txTitle')}</Text>
              {txLoading ? (
                <ActivityIndicator style={styles.txState} color={tk.text.tertiary} />
              ) : txFailed ? (
                <View style={styles.txState}>
                  <Text style={styles.errorText}>{t('points.loadFailed')}</Text>
                  <TouchableOpacity
                    style={styles.textButton}
                    onPress={onRetryTxs}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={t('common.retry')}
                  >
                    <Text style={styles.retry}>{t('common.retry')}</Text>
                  </TouchableOpacity>
                </View>
              ) : txs.length === 0 ? (
                <Text style={styles.cardMuted}>{t('points.empty')}</Text>
              ) : (
                txs.map((tx) => (
                  <View key={tx.id} style={styles.txRow}>
                    <View style={styles.txMain}>
                      <Text style={styles.txSource} numberOfLines={1}>
                        {tx.title}
                      </Text>
                      <Text style={styles.cardMuted}>{tx.createdAtText}</Text>
                    </View>
                    <View style={styles.txRight}>
                      <Text style={[styles.txAmount, tx.income ? styles.txIn : styles.txOut]}>
                        {tx.income ? '+' : '-'}
                        {tx.amount}
                      </Text>
                      <Text style={styles.cardMuted}>
                        {t('points.balance')}: {tx.balanceAfter}
                      </Text>
                    </View>
                  </View>
                ))
              )}
              {!txLoading && txs.length < txTotal ? (
                <TouchableOpacity
                  style={styles.moreBtn}
                  onPress={onLoadMoreTxs}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={t('points.loadMore')}
                >
                  <Text style={styles.moreText}>
                    {t('points.loadMore')} ({txs.length}/{txTotal})
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    header: { paddingHorizontal: 10, paddingBottom: rnSpacing.sm },
    title: {
      marginTop: rnSpacing.sm,
      fontSize: rnType.display.size,
      fontWeight: '600',
      color: tk.text.primary,
    },
    body: { padding: rnSpacing.md, gap: 10, paddingBottom: rnSpacing['3xl'] },
    subtitle: { fontSize: rnType.label.size, color: tk.text.tertiary },
    errorText: { fontSize: 13, color: tk.danger.DEFAULT },
    retry: { fontSize: 13, fontWeight: '600', color: tk.text.primary },
    textButton: { paddingVertical: rnSpacing.xs, paddingHorizontal: rnSpacing.sm },
    statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: rnSpacing.sm },
    statCard: {
      minWidth: 96,
      width: '48%',
      flexGrow: 1,
      padding: rnSpacing.md,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
      gap: 2,
    },
    statLabel: { fontSize: rnType.caption.size, color: tk.text.tertiary },
    statValue: { fontSize: rnType.heading.size, fontWeight: '700', color: tk.text.primary },
    card: {
      padding: rnSpacing.lg,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
      gap: rnSpacing.sm,
    },
    cardHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    cardTitle: { flex: 1, fontSize: rnType.strong.size, fontWeight: '600', color: tk.text.primary },
    cardMuted: { fontSize: rnType.label.size, color: tk.text.secondary, lineHeight: 18 },
    button: {
      height: 44,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonDisabled: { opacity: 0.5 },
    buttonText: { fontSize: rnType.strong.size, fontWeight: '600', color: tk.brand.ctaForeground },
    entryRow: { flexDirection: 'row', gap: rnSpacing.sm },
    entryBtn: {
      flex: 1,
      height: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.xs,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.medium,
      backgroundColor: tk.surface.card,
    },
    entryText: { fontSize: rnType.label.size, color: tk.text.primary },
    txState: { paddingVertical: rnSpacing.lg, gap: 6 },
    txRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
    },
    txMain: { flex: 1, gap: 2 },
    txSource: { fontSize: 13, color: tk.text.primary },
    txRight: { alignItems: 'flex-end', gap: 2 },
    txAmount: { fontSize: rnType.body.size, fontWeight: '700' },
    txIn: { color: tk.success.DEFAULT },
    txOut: { color: tk.danger.DEFAULT },
    moreBtn: {
      height: 40,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.medium,
      alignItems: 'center',
      justifyContent: 'center',
    },
    moreText: { fontSize: 13, color: tk.text.primary },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
