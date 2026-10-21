// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
import { BarChart3, Gauge, Zap } from 'lucide-react-native'
import { fetchApi } from '@ihui/api-client'
import { rnRadius } from '@ihui/design-tokens'
import { tokens } from '../theme/active-tokens'
import { NavBar } from '../components/NavBar'
import { NavChrome } from '../components/NavChrome'
import { useI18n } from '../i18n'
import { WEB_BASE_URL } from '../lib/config'
import type { RootStackParamList } from '../navigation/RootNavigator'
type NavigationProp = NativeStackNavigationProp<RootStackParamList>
/**
 * 对齐 web `/settings/usage`（apps/web/app/(main)/settings/usage/page.tsx）。
 *
 * 端点真实实现在 **apps/ai-service**（app/routers/usage.py，prefix `/api/v1/ai/usage`）：
 *  - GET /api/v1/ai/usage/quota → { user_id, used_tokens, quota_limit, remaining, usage_percent }
 *  - GET /api/v1/ai/usage/stats?days=30 → { total_tokens, total_input_tokens, total_output_tokens,
 *      total_cost, total_calls, daily_breakdown, model_breakdown, provider_breakdown }
 *
 * 为什么基址取 WEB_BASE_URL 而不是 API_BASE_URL：`/api/v1/ai/usage/*` 只注册在 ai-service，
 * apps/api（api.aizhs.top / 8802）没有该路由；web 站点由 next.config.ts 的 rewrite
 * `/api/v1/ai/usage/:path*` 转到 8803。RN 复用它即与 web 页走同一条真实链路，不新增客户端配置。
 * ai-service 认 Bearer token，fetchApi 会带上当前登录态。
 */
interface QuotaInfo {
  user_id: string
  used_tokens: number
  quota_limit: number
  remaining: number
  usage_percent: number
}
interface BreakdownRow {
  input_tokens: number
  output_tokens: number
  total_tokens: number
  cost: number
  calls?: number
}
interface UsageStats {
  user_id: string
  days: number
  total_tokens: number
  total_input_tokens: number
  total_output_tokens: number
  total_cost: number
  total_calls: number
  daily_breakdown: Record<string, BreakdownRow>
  model_breakdown: Record<string, BreakdownRow>
  provider_breakdown: Record<string, BreakdownRow>
}
function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}
function pct(value: number, max: number): `${number}%` {
  const v = max > 0 ? Math.round((value / max) * 100) : 0
  return `${Math.max(2, Math.min(100, v))}%`
}
export default function UsageScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [stats, setStats] = useState<UsageStats | null>(null)
  const [quota, setQuota] = useState<QuotaInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const styles = makeStyles()
  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [statsRes, quotaRes] = await Promise.all([
        fetchApi<UsageStats>(`${WEB_BASE_URL}/api/v1/ai/usage/stats`, { params: { days: 30 } }),
        fetchApi<QuotaInfo>(`${WEB_BASE_URL}/api/v1/ai/usage/quota`),
      ])
      if (!statsRes.success) {
        setError(statsRes.error || t('usage.loadFailed'))
        return
      }
      if (!quotaRes.success) {
        setError(quotaRes.error || t('usage.loadFailed'))
        return
      }
      setStats(statsRes.data)
      setQuota(quotaRes.data)
    } catch {
      setError(t('usage.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [t])
  useEffect(() => {
    void load()
  }, [load])
  const dailyEntries = stats ? Object.entries(stats.daily_breakdown).slice(-14) : []
  const modelEntries = stats
    ? Object.entries(stats.model_breakdown)
        .sort((a, b) => b[1].total_tokens - a[1].total_tokens)
        .slice(0, 10)
    : []
  const maxDaily = Math.max(...dailyEntries.map(([, v]) => v.total_tokens), 1)
  const maxModel = Math.max(...modelEntries.map(([, v]) => v.total_tokens), 1)
  const hasData = !!stats && (stats.total_calls > 0 || (quota?.used_tokens ?? 0) > 0)
  return (
    <View style={styles.container}>
      <NavChrome>
        <NavBar title={t('usage.title')} onBack={() => navigation.goBack()} />
      </NavChrome>
      <ScrollView contentContainerStyle={styles.body}>
        {loading ? (
          <View style={styles.card}>
            <ActivityIndicator style={styles.loading} color={tokens.text.tertiary} />
          </View>
        ) : error ? (
          <View style={styles.card}>
            <Text style={styles.error}>{error}</Text>
            <TouchableOpacity
              style={styles.outlineButton}
              onPress={() => {
                void load()
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.outlineText}>{t('usage.retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <View style={styles.cardTitleRow}>
                <Gauge size={16} color={tokens.text.secondary} />
                <Text style={styles.cardTitle}>{t('usage.quotaTitle')}</Text>
              </View>
              <Text style={styles.meta}>{t('usage.periodMonth')}</Text>
              <View style={styles.quotaRow}>
                <View style={styles.quotaCell}>
                  <Text style={styles.metric}>{formatTokens(quota?.used_tokens ?? 0)}</Text>
                  <Text style={styles.meta}>{t('usage.used')}</Text>
                </View>
                <View style={styles.quotaCell}>
                  <Text style={styles.metric}>{formatTokens(quota?.quota_limit ?? 0)}</Text>
                  <Text style={styles.meta}>{t('usage.limit')}</Text>
                </View>
                <View style={styles.quotaCell}>
                  <Text style={styles.metric}>{formatTokens(quota?.remaining ?? 0)}</Text>
                  <Text style={styles.meta}>{t('usage.remaining')}</Text>
                </View>
              </View>
              <View style={styles.track}>
                <View
                  style={[
                    styles.trackFill,
                    {
                      width: pct(quota?.usage_percent ?? 0, 100),
                      backgroundColor:
                        (quota?.usage_percent ?? 0) > 80
                          ? tokens.danger.DEFAULT
                          : tokens.brand.DEFAULT,
                    },
                  ]}
                />
              </View>
              <Text style={styles.meta}>
                {t('usage.usagePercent')}: {(quota?.usage_percent ?? 0).toFixed(1)}%
              </Text>
            </View>
            {!hasData ? (
              <View style={styles.card}>
                <Text style={styles.muted}>{t('usage.noData')}</Text>
              </View>
            ) : (
              <>
                <View style={styles.card}>
                  <View style={styles.cardTitleRow}>
                    <Zap size={16} color={tokens.text.secondary} />
                    <Text style={styles.cardTitle}>{t('usage.statsTitle')}</Text>
                  </View>
                  <View style={styles.statsGrid}>
                    <View style={styles.statCell}>
                      <Text style={styles.metric}>{formatTokens(stats?.total_tokens ?? 0)}</Text>
                      <Text style={styles.meta}>{t('usage.totalTokens')}</Text>
                    </View>
                    <View style={styles.statCell}>
                      <Text style={styles.metric}>${(stats?.total_cost ?? 0).toFixed(4)}</Text>
                      <Text style={styles.meta}>{t('usage.totalCost')}</Text>
                    </View>
                    <View style={styles.statCell}>
                      <Text style={styles.metric}>{stats?.total_calls ?? 0}</Text>
                      <Text style={styles.meta}>{t('usage.totalCalls')}</Text>
                    </View>
                  </View>
                  <Text style={styles.meta}>
                    {t('usage.inputTokens')}: {formatTokens(stats?.total_input_tokens ?? 0)} /{' '}
                    {t('usage.outputTokens')}: {formatTokens(stats?.total_output_tokens ?? 0)}
                  </Text>
                </View>
                <View style={styles.card}>
                  <View style={styles.cardTitleRow}>
                    <BarChart3 size={16} color={tokens.text.secondary} />
                    <Text style={styles.cardTitle}>{t('usage.dailyTitle')}</Text>
                  </View>
                  {dailyEntries.length === 0 ? (
                    <Text style={styles.muted}>{t('usage.noData')}</Text>
                  ) : (
                    dailyEntries.map(([day, row]) => (
                      <View key={day} style={styles.barRow}>
                        <Text style={styles.barLabel}>{day.slice(5)}</Text>
                        <View style={styles.barTrack}>
                          <View
                            style={[styles.barFill, { width: pct(row.total_tokens, maxDaily) }]}
                          />
                        </View>
                        <Text style={styles.barValue}>
                          {formatTokens(row.total_tokens)} · ${row.cost.toFixed(4)}
                        </Text>
                      </View>
                    ))
                  )}
                </View>
                <View style={styles.card}>
                  <View style={styles.cardTitleRow}>
                    <BarChart3 size={16} color={tokens.text.secondary} />
                    <Text style={styles.cardTitle}>{t('usage.modelTitle')}</Text>
                  </View>
                  {modelEntries.length === 0 ? (
                    <Text style={styles.muted}>{t('usage.noData')}</Text>
                  ) : (
                    modelEntries.map(([model, row]) => (
                      <View key={model} style={styles.modelRow}>
                        <View style={styles.modelHead}>
                          <Text style={styles.modelName} numberOfLines={1}>
                            {model}
                          </Text>
                          <Text style={styles.meta}>
                            {formatTokens(row.total_tokens)} · ${row.cost.toFixed(4)}
                          </Text>
                        </View>
                        <View style={styles.barTrack}>
                          <View
                            style={[styles.barFill, { width: pct(row.total_tokens, maxModel) }]}
                          />
                        </View>
                      </View>
                    ))
                  )}
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  )
}
function makeStyles() {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tokens.surface.bg },
    body: { padding: 12, gap: 12, paddingBottom: 32 },
    card: {
      padding: 16,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tokens.border.light,
      backgroundColor: tokens.surface.card,
      gap: 8,
    },
    cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    cardTitle: { fontSize: 16, fontWeight: '600', color: tokens.text.primary },
    meta: { fontSize: 12, color: tokens.text.tertiary },
    muted: { fontSize: 13, color: tokens.text.secondary, lineHeight: 19 },
    error: { fontSize: 13, color: tokens.danger.DEFAULT },
    loading: { paddingVertical: 24 },
    quotaRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
    quotaCell: { flex: 1, gap: 2 },
    metric: { fontSize: 20, fontWeight: '700', color: tokens.text.primary },
    track: {
      height: 6,
      borderRadius: rnRadius.xs,
      backgroundColor: tokens.surface.muted,
      overflow: 'hidden',
      marginTop: 4,
    },
    trackFill: { height: '100%', borderRadius: rnRadius.xs },
    statsGrid: { flexDirection: 'row', gap: 8, marginTop: 4 },
    statCell: { flex: 1, gap: 2 },
    barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    barLabel: { width: 38, fontSize: 11, color: tokens.text.tertiary },
    barTrack: {
      flex: 1,
      height: 6,
      borderRadius: rnRadius.xs,
      backgroundColor: tokens.surface.muted,
      overflow: 'hidden',
    },
    barFill: {
      height: '100%',
      borderRadius: rnRadius.xs,
      backgroundColor: tokens.brand.DEFAULT,
      color: tokens.brand.foreground,
    },
    barValue: { width: 116, textAlign: 'right', fontSize: 11, color: tokens.text.secondary },
    modelRow: { gap: 3 },
    modelHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    modelName: { flex: 1, fontSize: 12, color: tokens.text.primary },
    outlineButton: {
      height: 36,
      paddingHorizontal: 16,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tokens.border.medium,
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'flex-start',
    },
    outlineText: { fontSize: 14, color: tokens.text.primary },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
