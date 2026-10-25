// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useMemo } from 'react'
import { AlertTriangle, Clock, Server } from 'lucide-react-native'
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import type { TFunction } from '../../types'
import { getTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'
import { createStatusStyles, STATUS_PALETTE } from './status-styles'

export type StatusServiceStatus = 'operational' | 'degraded' | 'outage'
export type StatusSeverity = 'minor' | 'major' | 'critical'

export interface StatusModelRow {
  modelId: string
  displayName: string | null
  providerCode: string
  status: StatusServiceStatus
  p95LatencyMs: number
  errorRate: number
  lastIncidentAt: string | null
}

export interface StatusIncident {
  id: string
  providerCode: string
  modelId: string | null
  startedAt: string
  resolvedAt: string | null
  severity: StatusSeverity
  description: string
}

export interface StatusOverview {
  platform: string
  version: string
  uptime: number
  timestamp: string
  services: Record<string, StatusServiceStatus>
}

export interface StatusScreenData {
  overview: StatusOverview
  models: StatusModelRow[]
  incidents: StatusIncident[] | null
  incidentsDegraded: boolean
}

export interface StatusScreenProps {
  t: TFunction
  colorScheme?: 'light' | 'dark'
  onBack: () => void
  loading?: boolean
  error?: string | null
  data?: StatusScreenData
  onRefresh?: () => void
}

/** 服务名 → i18n 键(api/database/redis 由 web 端 SERVICE_LABELS 沿用;其余回退到原始键)。 */
const SERVICE_LABELS: Record<string, 'statusPage.serviceApi' | 'statusPage.serviceDatabase' | 'statusPage.serviceRedis'> = {
  api: 'statusPage.serviceApi',
  database: 'statusPage.serviceDatabase',
  redis: 'statusPage.serviceRedis',
}

/** 异常优先:中断 > 降级 > 正常。同档内按名称稳定排序,避免每次刷新抖动。 */
const STATUS_RANK: Record<StatusServiceStatus, number> = {
  outage: 0,
  degraded: 1,
  operational: 2,
}

/** 总状态 = 全部服务态 + 全部模型态里的最差一档(与 web 端 overallStatus 同源口径)。 */
function overallStatus(
  services: Record<string, StatusServiceStatus>,
  models: StatusModelRow[],
): StatusServiceStatus {
  const all = [...Object.values(services), ...models.map((m) => m.status)]
  if (all.some((s) => s === 'outage')) return 'outage'
  if (all.some((s) => s === 'degraded')) return 'degraded'
  return 'operational'
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const parts: string[] = []
  if (d > 0) parts.push(`${d}d`)
  if (h > 0 || d > 0) parts.push(`${h}h`)
  parts.push(`${m}m`)
  return parts.join(' ')
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function serviceLabelKey(status: StatusServiceStatus): 'statusPage.serviceOperational' | 'statusPage.serviceDegraded' | 'statusPage.serviceOutage' {
  return status === 'operational'
    ? 'statusPage.serviceOperational'
    : status === 'degraded'
      ? 'statusPage.serviceDegraded'
      : 'statusPage.serviceOutage'
}

function severityLabelKey(severity: StatusSeverity): 'statusPage.incidentSeverityMinor' | 'statusPage.incidentSeverityMajor' | 'statusPage.incidentSeverityCritical' {
  return severity === 'minor'
    ? 'statusPage.incidentSeverityMinor'
    : severity === 'major'
      ? 'statusPage.incidentSeverityMajor'
      : 'statusPage.incidentSeverityCritical'
}

function StatusBadge({
  status,
  label,
  styles,
}: {
  status: StatusServiceStatus | StatusSeverity
  label: string
  styles: ReturnType<typeof createStatusStyles>
}) {
  const palette = STATUS_PALETTE[status]
  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }]}>
      <Text style={[styles.badgeText, { color: palette.fg }]}>{label}</Text>
    </View>
  )
}

const MODEL_RENDER_LIMIT = 50

export function StatusScreen({
  t,
  onBack,
  colorScheme = 'light',
  loading = false,
  error = null,
  data,
  onRefresh,
}: StatusScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStatusStyles(tk), [tk])

  const header = (
    <View style={styles.header}>
      <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
      <Text style={styles.headerTitle}>{t('statusPage.title')}</Text>
    </View>
  )

  if (error && !loading) {
    return (
      <View style={styles.container}>
        {header}
        <View style={[styles.card, styles.errorBox]}>
          <AlertTriangle size={28} color={STATUS_PALETTE.outage.fg} strokeWidth={2} />
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.errorSub}>{t('statusPage.willAutoRetry')}</Text>
          {onRefresh ? (
            <TouchableOpacity
              style={styles.refreshBtn}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={t('statusPage.refresh')}
              onPress={onRefresh}
            >
              <Text style={styles.refreshText}>{t('statusPage.refresh')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    )
  }

  if (loading && !data) {
    return (
      <View style={styles.container}>
        {header}
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.skeletonTitle} />
          <View style={styles.card}>
            <View style={styles.skeletonRow} />
          </View>
          <View style={styles.card}>
            <View style={styles.skeletonRow} />
            <View style={styles.skeletonRow} />
          </View>
        </ScrollView>
      </View>
    )
  }

  const overview = data!.overview
  const overall = overallStatus(overview.services, data!.models)
  const overallLabel =
    overall === 'operational'
      ? t('statusPage.overallOperational')
      : overall === 'degraded'
        ? t('statusPage.overallDegraded')
        : t('statusPage.overallOutage')

  const modelsSorted = [...data!.models]
    .sort(
      (a, b) =>
        STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
        (a.displayName ?? a.modelId).localeCompare(b.displayName ?? b.modelId),
    )
    .slice(0, MODEL_RENDER_LIMIT)

  const incidents = data!.incidents
  const incidentsDegraded = data!.incidentsDegraded

  return (
    <View style={styles.container}>
      {header}
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={loading}
              onRefresh={onRefresh}
              tintColor={tk.text.secondary}
            />
          ) : undefined
        }
      >
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>{t('statusPage.title')}</Text>
          <Text style={styles.heroSubtitle}>
            {overview.platform} · v{overview.version} · {t('statusPage.autoRefreshHint')}
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <StatusBadge status={overall} label={overallLabel} styles={styles} />
          </View>
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Clock size={13} color={tk.text.tertiary} strokeWidth={2} />
              <Text style={styles.metaLabel}>{t('statusPage.uptimeLabel')}</Text>
              <Text style={styles.metaValue}>{formatUptime(overview.uptime)}</Text>
            </View>
            <View style={styles.metaItem}>
              <Server size={13} color={tk.text.tertiary} strokeWidth={2} />
              <Text style={styles.metaLabel}>{t('statusPage.updatedAtLabel')}</Text>
              <Text style={styles.metaValue}>{formatDateTime(overview.timestamp)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('statusPage.services')}</Text>
          {Object.entries(overview.services).map(([key, status]) => (
            <View key={key} style={styles.row}>
              <Text style={styles.rowTitle}>
                {SERVICE_LABELS[key] ? t(SERVICE_LABELS[key]) : key}
              </Text>
              <StatusBadge status={status} label={t(serviceLabelKey(status))} styles={styles} />
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {t('statusPage.models')} · {data!.models.length}
          </Text>
          {modelsSorted.map((m) => (
            <View key={m.modelId} style={styles.row}>
              <View style={styles.rowMain}>
                <Text style={styles.rowTitle}>{m.displayName ?? m.modelId}</Text>
                <Text style={styles.rowSub}>{m.providerCode}</Text>
              </View>
              <View style={styles.rowMeta}>
                <Text style={styles.rowSub}>
                  {t('statusPage.modelLatency')} {m.p95LatencyMs}ms
                </Text>
                <Text style={styles.rowSub}>
                  {t('statusPage.modelErrorRate')} {(m.errorRate * 100).toFixed(2)}%
                </Text>
              </View>
              <StatusBadge status={m.status} label={t(serviceLabelKey(m.status))} styles={styles} />
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('statusPage.incidents')}</Text>
          {incidentsDegraded ? (
            <View style={styles.noticeBox}>
              <AlertTriangle size={16} color={STATUS_PALETTE.degraded.fg} strokeWidth={2} />
              <Text style={styles.noticeText}>{t('statusPage.incidentsUnavailable')}</Text>
            </View>
          ) : incidents && incidents.length > 0 ? (
            incidents.map((inc) => (
              <View key={inc.id} style={styles.incidentRow}>
                <View style={styles.cardHead}>
                  <Text style={styles.rowTitle}>{inc.description}</Text>
                  <StatusBadge
                    status={inc.severity}
                    label={t(severityLabelKey(inc.severity))}
                    styles={styles}
                  />
                </View>
                <Text style={styles.incidentTime}>
                  {formatDateTime(inc.startedAt)}
                  {inc.resolvedAt ? ` → ${formatDateTime(inc.resolvedAt)}` : ''}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.rowSub}>{t('statusPage.noIncidents')}</Text>
          )}
        </View>
      </ScrollView>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
