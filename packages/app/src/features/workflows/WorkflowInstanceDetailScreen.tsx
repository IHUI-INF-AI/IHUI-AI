// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, ListChecks, ScrollText } from 'lucide-react-native'
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { rnRadius } from '@ihui/design-tokens'
import type { TFunction } from '../../types'
import { getTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'

/** 实例/任务状态(与后端 instance status 同域)。 */
export type WfInstanceStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

/** 日志级别。 */
export type WfLogLevel = 'debug' | 'info' | 'warn' | 'error'

/** 运行实例行(形状对齐 @ihui/api-client WorkflowInstanceRow)。 */
export interface WorkflowInstanceRow {
  id: string
  status: WfInstanceStatus
  workflowId?: string
  workflowName?: string
  startedAt?: string
  completedAt?: string
  input?: unknown
  output?: unknown
  error?: string
}

/** 实例任务行(形状对齐 @ihui/api-client WorkflowTaskRow)。 */
export interface WorkflowTaskRow {
  id: string
  step: number
  name: string
  type: string
  status: WfInstanceStatus
  input?: unknown
  output?: unknown
  error?: string
}

/** 实例日志行(形状对齐 @ihui/api-client WorkflowLogRow)。 */
export interface WorkflowLogRow {
  id: string
  timestamp: string
  level: WfLogLevel
  message: string
}

export interface WorkflowInstanceDetailScreenProps {
  t: TFunction
  colorScheme?: 'light' | 'dark'
  onBack: () => void
  loading: boolean
  error: string | null
  instance?: WorkflowInstanceRow
  tasks: WorkflowTaskRow[]
  logs: WorkflowLogRow[]
  onRefresh: () => void
}

const INST_STATUS_KEYS: Record<WfInstanceStatus, string> = {
  pending: 'workflowsPage.statusPending',
  running: 'workflowsPage.statusRunning',
  completed: 'workflowsPage.statusCompleted',
  failed: 'workflowsPage.statusFailed',
  cancelled: 'workflowsPage.statusCancelled',
}

const LOG_LEVELS: Array<'all' | WfLogLevel> = ['all', 'debug', 'info', 'warn', 'error']

function formatDateTime(iso?: string): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function jsonText(value: unknown): string {
  return JSON.stringify(value ?? null, null, 2)
}

type Tk = ReturnType<typeof getTokens>

// 实例状态徽章配色与 web 端 STATUS_BADGE 同源语义(pending=muted / running=amber /
// completed=emerald / failed=red / cancelled=orange),全部走既有 token。
function instBadgeBg(tk: Tk, status: WfInstanceStatus): string {
  if (status === 'pending') return tk.surface.muted
  if (status === 'running') return tk.warning.amberLight
  if (status === 'completed') return tk.success.light
  if (status === 'failed') return tk.danger.light
  return tk.warning.orangeLight
}

function instBadgeFg(tk: Tk, status: WfInstanceStatus): string {
  if (status === 'pending') return tk.text.secondary
  if (status === 'running') return tk.warning.amberText
  if (status === 'completed') return tk.success.deepText
  if (status === 'failed') return tk.danger.DEFAULT
  return tk.warning.amberText
}

function logLevelColor(tk: Tk, level: WfLogLevel): string {
  if (level === 'debug') return tk.text.tertiary
  if (level === 'info') return tk.brandAccent.deep
  if (level === 'warn') return tk.warning.amberText
  return tk.danger.DEFAULT
}

/**
 * 工作流实例详情共享屏(对齐 web /workflows/instances/[id] 三件套):
 * 头部状态徽章 + 工作流名 + 起止时间 + 错误;任务区可展开行(#step/name/type/status + input/output/error JSON);
 * 日志区级别过滤 chips(all/debug/info/warn/error)+ timestamp/level/message 行。
 */
export function WorkflowInstanceDetailScreen({
  t,
  colorScheme = 'light',
  onBack,
  loading,
  error,
  instance,
  tasks,
  logs,
  onRefresh,
}: WorkflowInstanceDetailScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  const [logLevel, setLogLevel] = useState<'all' | WfLogLevel>('all')
  const [openTasks, setOpenTasks] = useState<Record<string, boolean>>({})

  const header = (
    <View style={styles.header}>
      <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
      <Text style={styles.headerTitle}>{t('workflowsPage.instanceTitle')}</Text>
    </View>
  )

  if (error && !loading) {
    return (
      <View style={styles.container}>
        {header}
        <View style={[styles.card, styles.errorBox]}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.secondaryBtn}
            activeOpacity={0.85}
            accessibilityRole="button"
            onPress={onRefresh}
          >
            <Text style={styles.secondaryBtnText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  if (loading && !instance) {
    return (
      <View style={styles.container}>
        {header}
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.card}>
            <View style={styles.skeletonRow} />
            <View style={styles.skeletonRow} />
          </View>
        </ScrollView>
      </View>
    )
  }

  const inst = instance!
  const filteredLogs = logs.filter((l) => logLevel === 'all' || l.level === logLevel)

  return (
    <View style={styles.container}>
      {header}
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={onRefresh}
            tintColor={tk.text.secondary}
          />
        }
      >
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <View style={[styles.badge, { backgroundColor: instBadgeBg(tk, inst.status) }]}>
              <Text style={[styles.badgeText, { color: instBadgeFg(tk, inst.status) }]}>
                {t(INST_STATUS_KEYS[inst.status])}
              </Text>
            </View>
            {inst.workflowName ? (
              <Text style={styles.wfName} numberOfLines={1}>
                {inst.workflowName}
              </Text>
            ) : null}
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>
              {t('workflowsPage.startedAt')}: {formatDateTime(inst.startedAt)}
            </Text>
            <Text style={styles.metaText}>
              {t('workflowsPage.completedAt')}: {formatDateTime(inst.completedAt)}
            </Text>
          </View>
          {inst.error ? (
            <Text style={styles.errorText}>{`${t('workflowsPage.error')}: ${inst.error}`}</Text>
          ) : null}
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHead}>
            <ListChecks size={15} color={tk.brandAccent.deep} strokeWidth={2} />
            <Text style={styles.sectionTitle}>{t('workflowsPage.tasks')}</Text>
          </View>
          {tasks.length === 0 ? (
            <Text style={styles.emptyText}>{t('workflowsPage.noTasks')}</Text>
          ) : (
            tasks.map((task) => {
              const open = Boolean(openTasks[task.id])
              return (
                <View key={task.id} style={styles.taskBox}>
                  <TouchableOpacity
                    style={styles.taskHead}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    onPress={() => setOpenTasks((prev) => ({ ...prev, [task.id]: !open }))}
                  >
                    {open ? (
                      <ChevronDown size={14} color={tk.text.secondary} strokeWidth={2} />
                    ) : (
                      <ChevronRight size={14} color={tk.text.secondary} strokeWidth={2} />
                    )}
                    <Text style={styles.taskStep}>{`#${task.step}`}</Text>
                    <Text style={styles.taskName} numberOfLines={1}>
                      {task.name}
                    </Text>
                    <View style={styles.typeTag}>
                      <Text style={styles.typeTagText}>{task.type}</Text>
                    </View>
                    <View style={[styles.badge, { backgroundColor: instBadgeBg(tk, task.status) }]}>
                      <Text style={[styles.badgeText, { color: instBadgeFg(tk, task.status) }]}>
                        {t(INST_STATUS_KEYS[task.status])}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  {open ? (
                    <View style={styles.taskBody}>
                      {task.error ? (
                        <View style={styles.taskErrBox}>
                          <Text style={styles.jsonLabel}>{t('workflowsPage.error')}</Text>
                          <Text style={styles.errorText}>{task.error}</Text>
                        </View>
                      ) : null}
                      <Text style={styles.jsonLabel}>{t('workflowsPage.input')}</Text>
                      <View style={styles.jsonBox}>
                        <Text style={styles.jsonText}>{jsonText(task.input)}</Text>
                      </View>
                      <Text style={styles.jsonLabel}>{t('workflowsPage.output')}</Text>
                      <View style={styles.jsonBox}>
                        <Text style={styles.jsonText}>{jsonText(task.output)}</Text>
                      </View>
                    </View>
                  ) : null}
                </View>
              )
            })
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHead}>
            <ScrollText size={15} color={tk.brandAccent.deep} strokeWidth={2} />
            <Text style={styles.sectionTitle}>{t('workflowsPage.logs')}</Text>
          </View>
          <View style={styles.chipRow}>
            {LOG_LEVELS.map((lv) => (
              <TouchableOpacity
                key={lv}
                style={[styles.chip, logLevel === lv && styles.chipActive]}
                activeOpacity={0.8}
                accessibilityRole="button"
                onPress={() => setLogLevel(lv)}
              >
                <Text style={[styles.chipText, logLevel === lv && styles.chipActiveText]}>
                  {lv === 'all' ? t('workflowsPage.allLevels') : lv}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {filteredLogs.length === 0 ? (
            <Text style={styles.emptyText}>{t('workflowsPage.noLogs')}</Text>
          ) : (
            filteredLogs.map((l) => (
              <View key={l.id} style={styles.logRow}>
                <Text style={styles.logTime}>{formatDateTime(l.timestamp)}</Text>
                <Text style={[styles.logLevel, { color: logLevelColor(tk, l.level) }]}>
                  {l.level}
                </Text>
                <Text style={styles.logMsg}>{l.message}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  )
}

function createStyles(tk: ReturnType<typeof getTokens>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 12,
      gap: 12,
    },
    headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: tk.text.primary },
    scroll: { padding: 12, paddingBottom: 32, gap: 12 },
    card: {
      backgroundColor: tk.surface.light,
      borderRadius: rnRadius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.light,
      padding: 12,
      gap: 10,
    },
    cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    wfName: { flex: 1, fontSize: 14, fontWeight: '600', color: tk.text.primary },
    metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
    metaText: { fontSize: 11, color: tk.text.secondary },
    badge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: rnRadius.md,
    },
    badgeText: { fontSize: 11, fontWeight: '600' },
    errorText: { fontSize: 12, color: tk.danger.DEFAULT, lineHeight: 17 },
    errorBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
    secondaryBtn: {
      alignSelf: 'center',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: rnRadius.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.medium,
      backgroundColor: tk.surface.inputBg,
    },
    secondaryBtnText: { fontSize: 13, color: tk.text.medium },
    skeletonRow: { height: 44, borderRadius: rnRadius.lg, backgroundColor: tk.border.light },
    sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    sectionTitle: { fontSize: 14, fontWeight: '700', color: tk.text.primary },
    emptyText: { fontSize: 12, color: tk.text.secondary },
    taskBox: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.light,
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.inputBg,
    },
    taskHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 10,
      paddingVertical: 9,
    },
    taskStep: { fontSize: 11, color: tk.text.tertiary, width: 28 },
    taskName: { flex: 1, fontSize: 13, fontWeight: '600', color: tk.text.primary },
    typeTag: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
    },
    typeTagText: { fontSize: 10, color: tk.text.secondary },
    taskBody: { paddingHorizontal: 10, paddingBottom: 10, gap: 6 },
    taskErrBox: { gap: 2 },
    jsonLabel: { fontSize: 11, fontWeight: '600', color: tk.text.secondary },
    jsonBox: {
      borderRadius: rnRadius.sm,
      backgroundColor: tk.surface.muted,
      padding: 8,
    },
    jsonText: { fontSize: 11, color: tk.text.medium, fontFamily: 'monospace', lineHeight: 16 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: rnRadius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.medium,
      backgroundColor: tk.surface.inputBg,
    },
    chipActive: { backgroundColor: tk.brand.cta, borderColor: tk.brand.cta },
    chipText: { fontSize: 11, color: tk.text.secondary },
    chipActiveText: { color: tk.brand.ctaForeground, fontWeight: '600' },
    logRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    logTime: { fontSize: 10, color: tk.text.tertiary, fontFamily: 'monospace' },
    logLevel: { fontSize: 10, fontWeight: '700', width: 44 },
    logMsg: { flex: 1, fontSize: 11, color: tk.text.primary, lineHeight: 16 },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
