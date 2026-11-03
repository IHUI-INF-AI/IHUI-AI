// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 云运行屏（Cloud Runs）—— 对齐 web `apps/web/src/components/cloud-runs/CloudRunsView.tsx`。
 *
 * 纯展示：运行记录列表（task / 状态 / agent_type / started_at）+ 单条详情（run_id /
 * session_alias / 起止时间 / task / output），分页 page·pageSize=20，刷新与"返回列表"
 * 都由薄壳注入 —— 取数（GET /api/cloud-runs[/{run_id}]）、导航、Alert 一律不在本层。
 *
 * web 侧 /cloud-run 与 /cloud-agent 复用同一实现（CloudRunsView:4 自述），本屏同为一屏两路由。
 */
import { useMemo } from 'react'
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { Cloud, RefreshCw } from 'lucide-react-native'
import type { TFunction } from '../../types'
import { getTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'
import { ListPager } from '../student/ListPager'
import { STUDENT_PALETTE } from '../student/student-styles'
import { createCloudRunsStyles } from './cloud-runs-styles'

export interface CloudRunItem {
  run_id: string
  task: string
  status: 'running' | 'done' | 'error'
  agent_type?: string
  output_summary?: string
  output?: string
  error?: string
  session_alias?: string
  started_at?: string
  ended_at?: string
}

export interface CloudRunsScreenProps {
  t: TFunction
  colorScheme?: 'light' | 'dark'
  onBack: () => void
  loading?: boolean
  error?: string | null
  runs?: CloudRunItem[]
  total?: number
  page?: number
  pageSize?: number
  onPageChange?: (page: number) => void
  onRefresh?: () => void
  onOpenRun?: (run: CloudRunItem) => void
  /** 详情态：非空即渲染单条详情（与 web 的 selected 同形） */
  detail?: CloudRunItem | null
  onCloseDetail?: () => void
}

/** 状态三档：running=品牌主色、done=emerald、error=rose（与 STUDENT_PALETTE 同源档）。 */
function statusOf(status: CloudRun['status'], tk: ReturnType<typeof getTokens>) {
  if (status === 'error') return { color: STUDENT_PALETTE.rejected.fg, key: 'cloudRuns.error' }
  if (status === 'done') return { color: STUDENT_PALETTE.completed.fg, key: 'cloudRuns.done' }
  return { color: tk.brand.DEFAULT, key: 'cloudRuns.running' }
}

export function CloudRunsScreen({
  t,
  onBack,
  colorScheme = 'light',
  loading = false,
  error = null,
  runs = [],
  total = 0,
  page = 1,
  pageSize = 20,
  onPageChange,
  onRefresh,
  onOpenRun,
  detail = null,
  onCloseDetail,
}: CloudRunsScreenProps) {
  const tk = useMemo(() => getTokens(colorScheme), [colorScheme])
  const styles = useMemo(() => createCloudRunsStyles(tk), [tk])
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  if (detail) {
    const st = statusOf(detail.status, tk)
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <BackChevron
            onPress={onCloseDetail ?? onBack}
            label={t('cloudRuns.back')}
            colorScheme={colorScheme}
          />
          <Text style={styles.headerTitle}>{t('cloudRuns.detailTitle')}</Text>
        </View>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scroll}>
          <View style={styles.card}>
            <View style={styles.cardRow}>
              <Text style={styles.cardTitle}>{t('cloudRuns.runId')}</Text>
              <View style={styles.statusRow}>
                <View style={[styles.statusDot, { backgroundColor: st.color }]} />
                <Text style={[styles.statusText, { color: st.color }]}>{t(st.key)}</Text>
              </View>
            </View>
            <Text style={styles.mono}>{detail.run_id}</Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('cloudRuns.agentType')}</Text>
              <Text style={styles.detailValue}>{detail.agent_type || 'loop_v2'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('cloudRuns.sessionAlias')}</Text>
              <Text style={styles.detailValue}>{detail.session_alias || '-'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('cloudRuns.startTime')}</Text>
              <Text style={styles.detailValue}>{detail.started_at || '-'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('cloudRuns.endTime')}</Text>
              <Text style={styles.detailValue}>{detail.ended_at || '-'}</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('cloudRuns.task')}</Text>
            <Text style={styles.outputText}>{detail.task || t('cloudRuns.noTask')}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('cloudRuns.output')}</Text>
            {detail.status === 'running' ? (
              <Text style={styles.outputText}>{t('cloudRuns.runningHint')}</Text>
            ) : detail.error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{detail.error}</Text>
              </View>
            ) : detail.output ? (
              <View style={styles.outputBlock}>
                <Text style={styles.outputText}>{detail.output}</Text>
              </View>
            ) : (
              <Text style={styles.emptyText}>{t('cloudRuns.noOutput')}</Text>
            )}
          </View>
        </ScrollView>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{t('cloudRuns.title')}</Text>
          <Text style={styles.subtitle}>{t('cloudRuns.subtitle')}</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.statusRow}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={t('cloudRuns.refresh')}
            onPress={onRefresh}
          >
            <RefreshCw size={14} color={tk.brand.DEFAULT} strokeWidth={2} />
            <Text style={styles.headerActionText}>{t('cloudRuns.refresh')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {loading && runs.length === 0 ? (
        <View style={styles.emptyBox}>
          <ActivityIndicator color={tk.brand.DEFAULT} />
          <Text style={styles.emptyText}>{t('cloudRuns.loading')}</Text>
        </View>
      ) : runs.length === 0 ? (
        <View style={styles.emptyBox}>
          <Cloud size={28} color={tk.text.tertiary} strokeWidth={1.6} />
          <Text style={styles.emptyText}>{t('cloudRuns.empty')}</Text>
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scroll}>
          {runs.map((run) => {
            const st = statusOf(run.status, tk)
            return (
              <TouchableOpacity
                key={run.run_id}
                style={styles.card}
                activeOpacity={0.85}
                accessibilityRole="button"
                onPress={() => onOpenRun?.(run)}
              >
                <View style={styles.cardRow}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {run.task || t('cloudRuns.noTask')}
                  </Text>
                  <View style={styles.statusRow}>
                    <View style={[styles.statusDot, { backgroundColor: st.color }]} />
                    <Text style={[styles.statusText, { color: st.color }]}>{t(st.key)}</Text>
                  </View>
                </View>
                <View style={styles.cardRow}>
                  <Text style={styles.cardMeta}>{run.agent_type || 'loop_v2'}</Text>
                  <Text style={styles.cardMeta}>{run.started_at || '-'}</Text>
                </View>
                {run.output_summary ? (
                  <Text style={styles.outputText} numberOfLines={2}>
                    {run.output_summary}
                  </Text>
                ) : null}
              </TouchableOpacity>
            )
          })}
          <ListPager
            t={t}
            page={page}
            totalPages={totalPages}
            onPageChange={onPageChange ?? (() => {})}
            styles={styles}
          />
        </ScrollView>
      )}
    </View>
  )
}

export type CloudRun = CloudRunItem
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
