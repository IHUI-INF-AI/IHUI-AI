// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 发布数据分析 —— 对齐 web `/publish/analytics`。
 *
 * 端点按 apps/api/src/routes/publish-analytics.ts 现读(聚合 ai-service /publish/stats + /tasks):
 *  - GET /api/publish/analytics/overview?period=7d|30d|90d
 *        ⇒ { totalPublished, successRate, avgDurationMs, activeAccounts, trend,
 *            platformDistribution, failureReasons }
 *  - GET /api/publish/analytics/accounts?period=7d|30d|90d
 *        ⇒ [{ accountId, platform, displayName, successRate, lastPublishedAt, riskStatus }]
 *
 * 这些是真实聚合端点,不是占位:overview 在 ai-service 不可达时回全 0,
 * 本屏按"有数据才画图"处理,全 0 且无账号时显示空态而不是一张全 0 的假报表。
 */
import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { BarChart3 } from 'lucide-react-native'
import { fetchApi } from '@ihui/api-client'
import { rnRadius, rnRadiusFor, rnSpacing, rnType } from '@ihui/design-tokens'
import { tokens } from '../theme/active-tokens'
import { NavBar } from '../components/NavBar'
import { NavChrome } from '../components/NavChrome'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>
type Period = '7d' | '30d' | '90d'

interface Overview {
  totalPublished: number
  successRate: number
  avgDurationMs: number
  activeAccounts: number
  trend: Array<{ date: string; count: number }>
  platformDistribution: Array<{ platform: string; count: number; color: string }>
  failureReasons: Array<{ reason: string; count: number }>
}

interface AccountHealth {
  accountId: number
  platform: string
  displayName: string
  successRate: number
  lastPublishedAt: string | null
  riskStatus: 'safe' | 'low' | 'medium' | 'high'
}

const RISK_KEY: Record<AccountHealth['riskStatus'], string> = {
  safe: 'publishAnalytics.riskSafe',
  low: 'publishAnalytics.riskLow',
  medium: 'publishAnalytics.riskMedium',
  high: 'publishAnalytics.riskHigh',
}

export default function PublishAnalyticsScreen() {
  const { t, locale } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [period, setPeriod] = useState<Period>('30d')
  const [overview, setOverview] = useState<Overview | null>(null)
  const [accounts, setAccounts] = useState<AccountHealth[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async (p: Period) => {
    setLoading(true)
    setFailed(false)
    try {
      const [ov, ac] = await Promise.all([
        fetchApi<Overview>(`/api/publish/analytics/overview?period=${p}`),
        fetchApi<AccountHealth[]>(`/api/publish/analytics/accounts?period=${p}`),
      ])
      if (!ov.success) throw new Error(ov.error)
      setOverview(ov.data ?? null)
      setAccounts(ac.success ? (ac.data ?? []) : [])
    } catch {
      setOverview(null)
      setAccounts([])
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(period)
  }, [load, period])

  const fmtDate = (iso: string | null): string => {
    if (!iso) return '—'
    // trend 的 date 是 YYYY-MM-DD(无时区);按本地零点解析,避免 UTC 解析在负时区退一天
    const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T00:00:00` : iso)
    if (Number.isNaN(d.getTime())) return iso
    return new Intl.DateTimeFormat(locale, { month: '2-digit', day: '2-digit' }).format(d)
  }
  const fmtDuration = (ms: number): string =>
    t('publishAnalytics.seconds', { value: (ms / 1000).toFixed(1) })

  const styles = makeStyles()
  const maxPlatform = Math.max(1, ...(overview?.platformDistribution ?? []).map((p) => p.count))
  const trend = (overview?.trend ?? []).slice(-14)
  const maxTrend = Math.max(1, ...trend.map((p) => p.count))
  const hasData =
    overview !== null &&
    (overview.totalPublished > 0 ||
      overview.platformDistribution.length > 0 ||
      overview.trend.length > 0)

  return (
    <View style={styles.container}>
      <NavChrome>
        <NavBar title={t('publishAnalytics.title')} onBack={() => navigation.goBack()} />
      </NavChrome>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.subtitle}>{t('publishAnalytics.subtitle')}</Text>

        <View style={styles.chipRow}>
          {(['7d', '30d', '90d'] as const).map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.chip, period === p && styles.chipOn]}
              onPress={() => setPeriod(p)}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, period === p && styles.chipOnText]}>
                {p === '7d'
                  ? t('publishAnalytics.period7d')
                  : p === '30d'
                    ? t('publishAnalytics.period30d')
                    : t('publishAnalytics.period90d')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator style={styles.stateBox} color={tokens.text.tertiary} />
        ) : failed ? (
          <View style={styles.stateBox}>
            <Text style={styles.errorText}>{t('publishAnalytics.loadFailed')}</Text>
            <TouchableOpacity onPress={() => void load(period)} activeOpacity={0.7}>
              <Text style={styles.retry}>{t('common.retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : !hasData ? (
          <View style={styles.stateBox}>
            <BarChart3 size={28} color={tokens.text.tertiary} />
            <Text style={styles.muted}>{t('publishAnalytics.empty')}</Text>
            <Text style={styles.hint}>{t('publishAnalytics.emptyHint')}</Text>
          </View>
        ) : (
          <>
            <View style={styles.statGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{overview?.totalPublished ?? 0}</Text>
                <Text style={styles.statLabel}>{t('publishAnalytics.totalPublished')}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{(overview?.successRate ?? 0).toFixed(1)}%</Text>
                <Text style={styles.statLabel}>{t('publishAnalytics.successRate')}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{fmtDuration(overview?.avgDurationMs ?? 0)}</Text>
                <Text style={styles.statLabel}>{t('publishAnalytics.avgDuration')}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{overview?.activeAccounts ?? 0}</Text>
                <Text style={styles.statLabel}>{t('publishAnalytics.activeAccounts')}</Text>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('publishAnalytics.trend')}</Text>
              {trend.length === 0 ? (
                <Text style={styles.hint}>{t('publishAnalytics.noTrend')}</Text>
              ) : (
                trend.map((item) => (
                  <View key={item.date} style={styles.barRow}>
                    <Text style={styles.barLabel}>{fmtDate(item.date)}</Text>
                    <View style={styles.track}>
                      <View
                        style={[
                          styles.fill,
                          { width: `${Math.round((item.count / maxTrend) * 100)}%` },
                        ]}
                      />
                    </View>
                    <Text style={styles.barValue}>{item.count}</Text>
                  </View>
                ))
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('publishAnalytics.platformDistribution')}</Text>
              {(overview?.platformDistribution ?? []).length === 0 ? (
                <Text style={styles.hint}>{t('publishAnalytics.noPlatforms')}</Text>
              ) : (
                (overview?.platformDistribution ?? []).map((item) => (
                  <View key={item.platform} style={styles.barRow}>
                    <Text style={styles.barLabel} numberOfLines={1}>
                      {item.platform}
                    </Text>
                    <View style={styles.track}>
                      <View
                        style={[
                          styles.fill,
                          { width: `${Math.round((item.count / maxPlatform) * 100)}%` },
                        ]}
                      />
                    </View>
                    <Text style={styles.barValue}>{item.count}</Text>
                  </View>
                ))
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('publishAnalytics.failureReasons')}</Text>
              {(overview?.failureReasons ?? []).length === 0 ? (
                <Text style={styles.hint}>{t('publishAnalytics.noFailures')}</Text>
              ) : (
                (overview?.failureReasons ?? []).map((item) => (
                  <View key={item.reason} style={styles.reasonRow}>
                    <Text style={styles.reasonText} numberOfLines={2}>
                      {item.reason}
                    </Text>
                    <Text style={styles.barValue}>{item.count}</Text>
                  </View>
                ))
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('publishAnalytics.accountHealth')}</Text>
              {accounts.length === 0 ? (
                <Text style={styles.hint}>{t('publishAnalytics.noAccounts')}</Text>
              ) : (
                accounts.map((item) => (
                  <View key={item.accountId} style={styles.accountRow}>
                    <View style={styles.accountMain}>
                      <Text style={styles.accountName} numberOfLines={1}>
                        {item.displayName} · {item.platform}
                      </Text>
                      <Text style={styles.meta}>
                        {t('publishAnalytics.lastPublished')}: {fmtDate(item.lastPublishedAt)}
                      </Text>
                    </View>
                    <View style={styles.accountRight}>
                      <Text style={styles.rate}>{(item.successRate * 100).toFixed(0)}%</Text>
                      <Text
                        style={[
                          styles.risk,
                          item.riskStatus === 'safe' ? styles.riskSafe : styles.riskWarn,
                        ]}
                      >
                        {t(RISK_KEY[item.riskStatus])}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  )
}

function makeStyles() {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tokens.surface.bg },
    body: { padding: rnSpacing.md, gap: 10, paddingBottom: rnSpacing['3xl'] },
    subtitle: { fontSize: rnType.label.size, color: tokens.text.tertiary },
    chipRow: { flexDirection: 'row', gap: rnSpacing.sm },
    chip: {
      paddingHorizontal: rnSpacing.md,
      height: 30,
      justifyContent: 'center',
      borderRadius: rnRadiusFor.chip,
      borderWidth: 1,
      borderColor: tokens.border.light,
      backgroundColor: tokens.surface.card,
    },
    chipOn: { backgroundColor: tokens.brand.cta, borderColor: tokens.brand.cta },
    chipText: { fontSize: rnType.label.size, color: tokens.text.secondary },
    chipOnText: { color: tokens.brand.ctaForeground, fontWeight: '600' },
    stateBox: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing['5xl'],
    },
    muted: { fontSize: 13, color: tokens.text.secondary },
    hint: { fontSize: rnType.caption.size, color: tokens.text.tertiary, lineHeight: 16 },
    errorText: { fontSize: 13, color: tokens.danger.DEFAULT },
    retry: { fontSize: 13, fontWeight: '600', color: tokens.text.primary },
    statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: rnSpacing.sm },
    statCard: {
      width: '48%',
      padding: rnSpacing.md,
      borderRadius: rnRadius.lg,
      backgroundColor: tokens.surface.card,
      borderWidth: 1,
      borderColor: tokens.border.light,
      gap: rnSpacing.xs,
    },
    statValue: { fontSize: rnType.heading.size, fontWeight: '700', color: tokens.text.primary },
    statLabel: { fontSize: rnType.caption.size, color: tokens.text.tertiary },
    card: {
      padding: rnSpacing.md,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tokens.border.light,
      backgroundColor: tokens.surface.card,
      gap: rnSpacing.sm,
    },
    cardTitle: { fontSize: rnType.body.size, fontWeight: '600', color: tokens.text.primary },
    barRow: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
    barLabel: { width: 64, fontSize: rnType.caption.size, color: tokens.text.secondary },
    track: {
      flex: 1,
      height: 6,
      borderRadius: rnRadius.xs,
      backgroundColor: tokens.surface.muted,
      overflow: 'hidden',
    },
    fill: {
      height: 6,
      borderRadius: rnRadius.xs,
      backgroundColor: tokens.brand.DEFAULT,
      color: tokens.brand.foreground,
    },
    barValue: {
      width: 32,
      textAlign: 'right',
      fontSize: rnType.caption.size,
      color: tokens.text.secondary,
    },
    reasonRow: { flexDirection: 'row', alignItems: 'flex-start', gap: rnSpacing.sm },
    reasonText: {
      flex: 1,
      fontSize: rnType.label.size,
      color: tokens.text.secondary,
      lineHeight: 17,
    },
    accountRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing.xs,
    },
    accountMain: { flex: 1, gap: 2 },
    accountName: { fontSize: 13, fontWeight: '600', color: tokens.text.primary },
    meta: { fontSize: rnType.caption.size, color: tokens.text.tertiary },
    accountRight: { alignItems: 'flex-end', gap: 2 },
    rate: { fontSize: 13, fontWeight: '600', color: tokens.text.primary },
    risk: { fontSize: 10 },
    riskSafe: { color: tokens.success.deep },
    riskWarn: { color: tokens.danger.DEFAULT },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
