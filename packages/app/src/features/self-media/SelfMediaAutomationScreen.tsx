// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import {
  CheckCircle2,
  Clock,
  History,
  Loader2,
  Play,
  Power,
  Settings2,
  XCircle,
} from 'lucide-react-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import type { TFunction } from '../../types'
import { getTokens, type AppThemeMode, type AppThemeTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'
import { EmptyState, ErrorState } from '../../components/ScreenStates'

/** 任务执行状态(与上游 self_media_scheduler.py:59 的 Literal 同值) */
export type AutomationRunStatus = 'success' | 'failed' | 'running'

/** 任务卡片展示模型(时间/时长文案由薄壳格式化后注入) */
export interface AutomationTaskRowView {
  id: string
  name: string
  description: string
  running: boolean
  enabled: boolean
  /** 执行时间,如 "09:00" */
  executionTimeText: string
  dryRun: boolean
  /** 仅 wechat_daily 有标题模板行(web page.tsx:450-457 同判据) */
  showTitleTemplate: boolean
  /** 空串 = 未配置 */
  titleTemplate: string
  /** 空串 = 从未执行过 */
  lastRunText: string
  lastRunStatus: AutomationRunStatus | null
}

/** 执行历史行展示模型 */
export interface AutomationHistoryRowView {
  key: string
  taskName: string
  status: AutomationRunStatus
  /** 触发时间,如 "10-27 09:00" */
  timeText: string
  /** 耗时,如 "1.2s" */
  durationText: string
  /** 失败原因;空串不渲染 */
  error: string
  /** 成功时的 extra 摘要(键:值,最多 5 条由薄壳裁剪) */
  extraLines: string[]
}

export interface SelfMediaAutomationScreenProps {
  t: TFunction
  colorScheme: AppThemeMode
  onBack: () => void
  /** 非空即登录门(与 web useAuthGate 同口径) */
  loginRequiredText: string
  loading: boolean
  refreshing: boolean
  error: string | null
  tasks: AutomationTaskRowView[]
  history: AutomationHistoryRowView[]
  /** 调度器说明(note1..note4,薄壳已本地化) */
  schedulerNotes: string[]
  /** 正在编辑配置的任务 id */
  editingId: string | null
  editHour: string
  editMinute: string
  editDryRun: boolean
  editTitleTemplate: string
  onEditHourChange: (text: string) => void
  onEditMinuteChange: (text: string) => void
  onEditDryRunChange: (value: boolean) => void
  onEditTitleTemplateChange: (text: string) => void
  savingConfig: boolean
  togglingId: string | null
  triggeringId: string | null
  onStartEdit: (task: AutomationTaskRowView) => void
  onCancelEdit: () => void
  onSaveConfig: (task: AutomationTaskRowView) => void
  onToggle: (task: AutomationTaskRowView) => void
  onTrigger: (task: AutomationTaskRowView) => void
  onRetry: () => void
  onRefresh: () => void
}

/**
 * 自动化任务共享屏 —— 承载 web /self-media/automation。
 *
 * 覆盖:任务卡片(名称/描述/运行中徽章/启停开关/执行时间/运行模式/标题模板/状态/最近一次)、
 * 内联配置表单(小时/分钟/dry-run/标题模板)、立即触发 / 配置 / 启停三键、调度器说明、执行历史三态。
 *
 * 与 web 的口径差(如实登记,不造假按钮):
 * - 「自动化示例」6 张模板卡片的动作是打开 AI 面板并注入 `/auto-task` 斜杠命令或引导 prompt
 *   (apps/web/app/(main)/self-media/automation/page.tsx:177-203),RN 端没有 AI 面板注入通道
 *   (apps/mobile-rn 内无 openAiPanel/ai-panel store),故本屏不渲染该区块 —— 不做一个点了没反应的按钮。
 * - web 每 10s 轮询(:214-227),RN 改为进入时加载 + 下拉刷新(避免后台轮询耗电),语义等价。
 * - 调度器说明只渲染 note1..note4;note5 含 `<code>` 富文本锚点,RN 无 rich renderer,不渲染。
 * - 字段读取按上游真身 snake_case(config.dry_run / config.title_template / last_run),见端点文件头注。
 */
export function SelfMediaAutomationScreen({
  t,
  colorScheme,
  onBack,
  loginRequiredText,
  loading,
  refreshing,
  error,
  tasks,
  history,
  schedulerNotes,
  editingId,
  editHour,
  editMinute,
  editDryRun,
  editTitleTemplate,
  onEditHourChange,
  onEditMinuteChange,
  onEditDryRunChange,
  onEditTitleTemplateChange,
  savingConfig,
  togglingId,
  triggeringId,
  onStartEdit,
  onCancelEdit,
  onSaveConfig,
  onToggle,
  onTrigger,
  onRetry,
  onRefresh,
}: SelfMediaAutomationScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const statusIcon = (status: AutomationRunStatus, size = 13) => {
    if (status === 'success') return <CheckCircle2 size={size} color={tk.success.DEFAULT} />
    if (status === 'failed') return <XCircle size={size} color={tk.danger.DEFAULT} />
    return <Loader2 size={size} color={tk.text.tertiary} />
  }

  const renderTask = (task: AutomationTaskRowView) => {
    const editing = editingId === task.id
    const toggling = togglingId === task.id
    const triggering = triggeringId === task.id
    return (
      <View key={task.id} style={styles.card}>
        <View style={styles.cardHead}>
          <Clock size={15} color={tk.text.secondary} />
          <View style={styles.cardHeadText}>
            <Text style={styles.taskName} numberOfLines={1}>
              {task.name}
            </Text>
            <Text style={styles.taskDesc} numberOfLines={2}>
              {task.description}
            </Text>
          </View>
          <View style={styles.cardHeadRight}>
            {task.running ? (
              <View style={styles.runningBadge}>
                <Loader2 size={11} color={tk.brand.DEFAULT} />
                <Text style={styles.runningText}>{t('selfMedia.automationPage.running')}</Text>
              </View>
            ) : null}
            <Switch
              value={task.enabled}
              onValueChange={() => onToggle(task)}
              disabled={toggling}
              accessibilityLabel={t('selfMedia.automationPage.toggleAriaLabel')}
            />
          </View>
        </View>

        {editing ? (
          <View style={styles.editBox}>
            <View style={styles.editGrid}>
              <View style={styles.editCol}>
                <Text style={styles.fieldLabel}>
                  {t('selfMedia.automationPage.hourLabel')}
                </Text>
                <TextInput
                  style={styles.input}
                  value={editHour}
                  onChangeText={onEditHourChange}
                  keyboardType="number-pad"
                  maxLength={2}
                  editable={!savingConfig}
                />
              </View>
              <View style={styles.editCol}>
                <Text style={styles.fieldLabel}>
                  {t('selfMedia.automationPage.minuteLabel')}
                </Text>
                <TextInput
                  style={styles.input}
                  value={editMinute}
                  onChangeText={onEditMinuteChange}
                  keyboardType="number-pad"
                  maxLength={2}
                  editable={!savingConfig}
                />
              </View>
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchRowLabel}>
                {t('selfMedia.automationPage.dryRunLabel')}
              </Text>
              <Switch value={editDryRun} onValueChange={onEditDryRunChange} disabled={savingConfig} />
            </View>
            {task.showTitleTemplate ? (
              <View>
                <Text style={styles.fieldLabel}>
                  {t('selfMedia.automationPage.titleTemplateLabel')}
                </Text>
                <TextInput
                  style={styles.input}
                  value={editTitleTemplate}
                  onChangeText={onEditTitleTemplateChange}
                  placeholder={t('selfMedia.automationPage.titleTemplatePlaceholder')}
                  placeholderTextColor={tk.text.tertiary}
                  editable={!savingConfig}
                />
              </View>
            ) : null}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.ghostBtn}
                onPress={onCancelEdit}
                disabled={savingConfig}
                accessibilityRole="button"
              >
                <Text style={styles.ghostBtnText}>
                  {t('selfMedia.automationPage.cancel')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryBtn, savingConfig ? styles.btnDisabled : null]}
                onPress={() => onSaveConfig(task)}
                disabled={savingConfig}
                accessibilityRole="button"
              >
                <Text style={styles.primaryBtnText}>{t('selfMedia.automationPage.save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            <View style={styles.metaList}>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>
                  {t('selfMedia.automationPage.executionTime')}
                </Text>
                <Text style={styles.metaValueMono}>{task.executionTimeText}</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>{t('selfMedia.automationPage.runMode')}</Text>
                <Text style={task.dryRun ? styles.metaWarn : styles.metaOk}>
                  {task.dryRun
                    ? t('selfMedia.automationPage.modeDryRun')
                    : t('selfMedia.automationPage.modeProduction')}
                </Text>
              </View>
              {task.showTitleTemplate ? (
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>
                    {t('selfMedia.automationPage.titleTemplate')}
                  </Text>
                  <Text style={styles.metaValueMono} numberOfLines={1}>
                    {task.titleTemplate || t('selfMedia.automationPage.notConfigured')}
                  </Text>
                </View>
              ) : null}
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>{t('selfMedia.automationPage.status')}</Text>
                <Text style={task.enabled ? styles.metaOk : styles.metaMuted}>
                  {task.enabled
                    ? t('selfMedia.automationPage.enabled')
                    : t('selfMedia.automationPage.disabled')}
                </Text>
              </View>
              {task.lastRunText && task.lastRunStatus ? (
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>{t('selfMedia.automationPage.lastRun')}</Text>
                  <View style={styles.lastRunValue}>
                    {statusIcon(task.lastRunStatus)}
                    <Text style={styles.metaValue}>{task.lastRunText}</Text>
                  </View>
                </View>
              ) : null}
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.outlineBtn, task.running || triggering ? styles.btnDisabled : null]}
                onPress={() => onTrigger(task)}
                disabled={task.running || triggering}
                accessibilityRole="button"
              >
                {triggering ? (
                  <ActivityIndicator size="small" color={tk.text.secondary} />
                ) : (
                  <Play size={12} color={tk.text.secondary} />
                )}
                <Text style={styles.outlineBtnText}>
                  {t('selfMedia.automationPage.triggerNow')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.ghostBtn}
                onPress={() => onStartEdit(task)}
                accessibilityRole="button"
              >
                <Settings2 size={12} color={tk.text.secondary} />
                <Text style={styles.ghostBtnText}>
                  {t('selfMedia.automationPage.configure')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.ghostBtn, toggling ? styles.btnDisabled : null]}
                onPress={() => onToggle(task)}
                disabled={toggling}
                accessibilityRole="button"
              >
                <Power size={12} color={tk.text.secondary} />
                <Text style={styles.ghostBtnText}>
                  {task.enabled
                    ? t('selfMedia.automationPage.disable')
                    : t('selfMedia.automationPage.enable')}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.headerTitle}>{t('selfMedia.automation')}</Text>
      </View>

      {loginRequiredText ? (
        <Text style={styles.loginHint}>{loginRequiredText}</Text>
      ) : loading ? (
        <View style={styles.stateBlock}>
          <ActivityIndicator size="small" color={tk.brand.DEFAULT} />
          <Text style={styles.muted}>{t('common.loading')}</Text>
        </View>
      ) : error ? (
        <ErrorState
          message={error}
          onRetry={onRetry}
          retryLabel={t('common.retry')}
          colorScheme={colorScheme}
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {tasks.length === 0 ? (
            <EmptyState
              title={t('selfMedia.automationPage.historyEmpty')}
              colorScheme={colorScheme}
            />
          ) : (
            <View style={styles.taskList}>{tasks.map(renderTask)}</View>
          )}

          {schedulerNotes.length > 0 ? (
            <View style={styles.noteCard}>
              <View style={styles.noteHead}>
                <Clock size={14} color={tk.warning.DEFAULT} />
                <Text style={styles.noteTitle}>
                  {t('selfMedia.automationPage.schedulerNoteTitle')}
                </Text>
              </View>
              {schedulerNotes.map((note) => (
                <Text key={note} style={styles.noteItem}>
                  • {note}
                </Text>
              ))}
            </View>
          ) : null}

          <View style={styles.historyCard}>
            <View style={styles.noteHead}>
              <History size={14} color={tk.text.secondary} />
              <Text style={styles.noteTitle}>
                {t('selfMedia.automationPage.historyTitle')}
              </Text>
            </View>
            {history.length === 0 ? (
              <Text style={styles.historyEmpty}>
                {t('selfMedia.automationPage.historyEmpty')}
              </Text>
            ) : (
              history.map((row) => (
                <View key={row.key} style={styles.historyRow}>
                  <View style={styles.historyRowHead}>
                    <View style={styles.historyNameBox}>
                      {statusIcon(row.status)}
                      <Text style={styles.historyName} numberOfLines={1}>
                        {row.taskName}
                      </Text>
                    </View>
                    <Text style={styles.historyMeta}>
                      {row.timeText} · {row.durationText}
                    </Text>
                  </View>
                  {row.error ? <Text style={styles.historyError}>{row.error}</Text> : null}
                  {row.extraLines.length > 0 ? (
                    <View style={styles.extraRow}>
                      {row.extraLines.map((line) => (
                        <Text key={line} style={styles.extraChip}>
                          {line}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg, paddingHorizontal: rnSpacing.lg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.md,
      paddingTop: rnSpacing.md,
      paddingBottom: rnSpacing.sm,
    },
    headerTitle: { fontSize: rnType.title.size, fontWeight: '600', color: tk.text.primary },
    loginHint: { marginTop: rnSpacing.xl, fontSize: rnType.body.size, color: tk.text.secondary },
    stateBlock: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing['2xl'],
    },
    muted: { fontSize: rnType.label.size, color: tk.text.secondary },
    scrollContent: { paddingBottom: rnSpacing['2xl'], gap: rnSpacing.md },
    taskList: { gap: rnSpacing.md },
    card: {
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
      padding: rnSpacing.lg,
      gap: rnSpacing.md,
    },
    cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: rnSpacing.sm },
    cardHeadText: { flex: 1, gap: 2 },
    cardHeadRight: { alignItems: 'flex-end', gap: rnSpacing.xs },
    taskName: { fontSize: rnType.body.size, fontWeight: '600', color: tk.text.primary },
    taskDesc: { fontSize: rnType.caption.size, color: tk.text.secondary },
    runningBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.surface.muted,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    runningText: { fontSize: rnType.caption.size, color: tk.brand.DEFAULT },
    metaList: { gap: rnSpacing.xs },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: rnSpacing.sm,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.surface.muted,
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: 6,
    },
    metaLabel: { fontSize: rnType.caption.size, color: tk.text.secondary },
    metaValue: { fontSize: rnType.caption.size, color: tk.text.primary },
    metaValueMono: {
      flexShrink: 1,
      fontSize: rnType.caption.size,
      color: tk.text.primary,
      fontVariant: ['tabular-nums'],
    },
    metaOk: { fontSize: rnType.caption.size, color: tk.success.DEFAULT },
    metaWarn: { fontSize: rnType.caption.size, color: tk.warning.DEFAULT },
    metaMuted: { fontSize: rnType.caption.size, color: tk.text.tertiary },
    lastRunValue: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: rnSpacing.sm },
    outlineBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.medium,
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: 5,
    },
    outlineBtnText: { fontSize: rnType.caption.size, color: tk.text.secondary },
    ghostBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderRadius: rnRadius.sm,
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: 5,
    },
    ghostBtnText: { fontSize: rnType.caption.size, color: tk.text.secondary },
    primaryBtn: {
      alignItems: 'center',
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
      paddingHorizontal: rnSpacing.lg,
      paddingVertical: 7,
    },
    primaryBtnText: { fontSize: rnType.caption.size, color: tk.brand.ctaForeground },
    btnDisabled: { opacity: 0.5 },
    editBox: {
      gap: rnSpacing.sm,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tk.border.light,
      padding: rnSpacing.md,
    },
    editGrid: { flexDirection: 'row', gap: rnSpacing.sm },
    editCol: { flex: 1, gap: 4 },
    fieldLabel: { fontSize: rnType.caption.size, color: tk.text.secondary },
    input: {
      height: 34,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.light,
      paddingHorizontal: rnSpacing.sm,
      fontSize: rnType.caption.size,
      color: tk.text.primary,
    },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: rnSpacing.sm,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.surface.muted,
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: 4,
    },
    switchRowLabel: { flex: 1, fontSize: rnType.caption.size, color: tk.text.secondary },
    noteCard: {
      gap: rnSpacing.xs,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
      padding: rnSpacing.md,
    },
    noteHead: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.xs },
    noteTitle: { fontSize: rnType.label.size, fontWeight: '600', color: tk.text.primary },
    noteItem: { fontSize: rnType.caption.size, lineHeight: 18, color: tk.text.secondary },
    historyCard: {
      gap: rnSpacing.xs,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
      padding: rnSpacing.md,
    },
    historyEmpty: { paddingVertical: rnSpacing.md, fontSize: rnType.caption.size, color: tk.text.secondary },
    historyRow: { gap: 4, paddingVertical: rnSpacing.xs },
    historyRowHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: rnSpacing.sm,
    },
    historyNameBox: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
    historyName: { flex: 1, fontSize: rnType.caption.size, color: tk.text.primary },
    historyMeta: { fontSize: rnType.caption.size, color: tk.text.tertiary },
    historyError: {
      borderRadius: rnRadius.sm,
      backgroundColor: tk.surface.muted,
      padding: 6,
      fontSize: 10,
      color: tk.danger.DEFAULT,
    },
    extraRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
    extraChip: {
      borderRadius: rnRadius.sm,
      backgroundColor: tk.surface.muted,
      paddingHorizontal: 6,
      paddingVertical: 1,
      fontSize: 10,
      color: tk.text.secondary,
    },
  } satisfies Record<string, ViewStyle | TextStyle>)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
