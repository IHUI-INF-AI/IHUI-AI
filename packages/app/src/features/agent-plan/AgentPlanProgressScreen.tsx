// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { CircleX, FileText, History, ListChecks, Search } from 'lucide-react-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import type { TFunction } from '../../types'
import { getTokens, type AppThemeMode, type AppThemeTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'

const NS = 'agentPlanProgressPage'

export interface AgentPlanTaskRowView {
  id: string
  order: number
  title: string
  status: string
  /** 薄壳按 web 同表注入的状态文案(pending/done/blocked) */
  statusText: string
}

export interface AgentPlanVersionRowView {
  version: number
  channel: string
  reason: string
  createdAt: string
}

export interface AgentPlanProgressDetailView {
  planId: string
  goal: string
  statusText: string
  version: number
  createdAt: string
  updatedAt: string | null
  /** detail.result 的 JSON 文本(web 以 JSON.stringify(result, null, 2) 直出) */
  resultText: string | null
}

export interface AgentPlanProgressScreenProps {
  t: TFunction
  colorScheme: AppThemeMode
  onBack: () => void
  planIdInput: string
  onPlanIdChange: (value: string) => void
  onOpen: () => void
  loading: boolean
  error: string | null
  detail: AgentPlanProgressDetailView | null
  tasks: AgentPlanTaskRowView[]
  done: number
  total: number
  blocked: number
  versions: AgentPlanVersionRowView[]
  currentVersion: number
  selectedVersion: number
  onSelectVersion: (version: number) => void
  diff: string
  diffLoading: boolean
  diffError: string | null
  onCloseDetail: () => void
}

/**
 * Agent Plan 任务进度共享屏 —— 承载 web /agent-plan/progress。
 *
 * 数据面(与 web 同源,apps/web/app/(main)/agent-plan/progress/page.tsx:5-12):
 * GET /api/agent-plan/{id} 详情、/versions 版本历史、/versions/diff 差异、/tasks 任务勾选态;
 * 端点封装见 packages/api-client/src/endpoints/agent-plan.ts(详情)与 agent-plan-progress.ts(其余三只读端点),
 * 后端实现 apps/ai-service/app/routers/agent_plan.py:259/290/308/353。
 *
 * 与 web 的口径差(如实登记):web 的「最近查看」是浏览器 localStorage 伪列表(:38,:65-73,:408-449),
 * RN 无同义存储,本屏只保留「输入 plan_id 打开」主路径,未承载该列表;web 的版本差异按钮/进度条同构保留。
 * 平台无关:取数 / 时间格式化 / 差异懒加载由薄壳注入。
 */
export function AgentPlanProgressScreen({
  t,
  colorScheme,
  onBack,
  planIdInput,
  onPlanIdChange,
  onOpen,
  loading,
  error,
  detail,
  tasks,
  done,
  total,
  blocked,
  versions,
  currentVersion,
  selectedVersion,
  onSelectVersion,
  diff,
  diffLoading,
  diffError,
  onCloseDetail,
}: AgentPlanProgressScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = createStyles(tk)
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron
          onPress={detail ? onCloseDetail : onBack}
          label={t('common.back')}
          colorScheme={colorScheme}
        />
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.titleRow}>
          <FileText size={20} color={tk.brand.DEFAULT} />
          <Text style={styles.title}>{t(`${NS}.title`)}</Text>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <CircleX size={16} color={tk.danger.DEFAULT} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {!detail ? (
          <View style={styles.card}>
            <Text style={styles.label}>{t(`${NS}.planIdLabel`)}</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={planIdInput}
                onChangeText={onPlanIdChange}
                placeholder={t(`${NS}.planIdLabel`)}
                placeholderTextColor={tk.text.tertiary}
                autoCapitalize="none"
                editable={!loading}
              />
              <TouchableOpacity
                style={[styles.primaryBtn, (!planIdInput.trim() || loading) && styles.btnDisabled]}
                onPress={onOpen}
                disabled={!planIdInput.trim() || loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={tk.brand.ctaForeground} />
                ) : (
                  <Search size={16} color={tk.brand.ctaForeground} />
                )}
                <Text style={styles.primaryBtnText}>{t(`${NS}.open`)}</Text>
              </TouchableOpacity>
            </View>
            {!loading ? <Text style={styles.muted}>{t(`${NS}.empty`)}</Text> : null}
          </View>
        ) : null}

        {detail ? (
          <>
            <View style={styles.card}>
              <View style={styles.metaRow}>
                <Text style={styles.goal} numberOfLines={2}>
                  {detail.goal}
                </Text>
                <Text style={styles.badge}>{detail.statusText}</Text>
              </View>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>{t(`${NS}.planIdLabel`)}</Text>
                <Text style={styles.fieldValue} numberOfLines={1}>
                  {detail.planId}
                </Text>
              </View>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>{t(`${NS}.createdAt`)}</Text>
                <Text style={styles.fieldValue}>{detail.createdAt || '—'}</Text>
              </View>
              {detail.updatedAt ? (
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>{t(`${NS}.updatedAt`)}</Text>
                  <Text style={styles.fieldValue}>{detail.updatedAt}</Text>
                </View>
              ) : null}
              {detail.resultText ? (
                <View style={styles.resultBox}>
                  <Text style={styles.fieldLabel}>{t(`${NS}.resultTitle`)}</Text>
                  <Text style={styles.pre}>{detail.resultText}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.card}>
              <View style={styles.sectionHead}>
                <ListChecks size={16} color={tk.text.secondary} />
                <Text style={styles.sectionTitle}>{t(`${NS}.taskProgressTitle`)}</Text>
              </View>
              {loading ? (
                <View style={styles.centerBlock}>
                  <ActivityIndicator size="small" color={tk.brand.DEFAULT} />
                  <Text style={styles.muted}>{t(`${NS}.loading`)}</Text>
                </View>
              ) : (
                <>
                  <View style={styles.progressRow}>
                    <Text style={styles.progressCount}>{`${done}/${total}`}</Text>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${pct}%` as const }]} />
                    </View>
                    <Text style={styles.muted}>{`${pct}%`}</Text>
                  </View>
                  {total > 0 && blocked > 0 ? (
                    <Text style={styles.muted}>
                      {`${t(`${NS}.blockedLabel`)} ${blocked}`}
                    </Text>
                  ) : null}
                  {tasks.length === 0 ? (
                    <Text style={styles.muted}>{t(`${NS}.empty`)}</Text>
                  ) : (
                    tasks.map((task) => (
                      <View key={task.id} style={styles.taskRow}>
                        <Text
                          style={[styles.taskTitle, task.status === 'done' && styles.taskDone]}
                          numberOfLines={2}
                        >
                          {`${task.order}. ${task.title}`}
                        </Text>
                        <Text style={[styles.badge, task.status === 'blocked' && styles.badgeDanger]}>
                          {task.statusText}
                        </Text>
                      </View>
                    ))
                  )}
                </>
              )}
            </View>

            <View style={styles.card}>
              <View style={styles.sectionHead}>
                <History size={16} color={tk.text.secondary} />
                <Text style={styles.sectionTitle}>{t(`${NS}.versionsTitle`)}</Text>
              </View>
              {versions.length === 0 ? (
                <Text style={styles.muted}>{t(`${NS}.versionsEmpty`)}</Text>
              ) : (
                <>
                  <View style={styles.chipRow}>
                    {versions.map((v) => (
                      <TouchableOpacity
                        key={`v-${v.version}`}
                        style={[styles.chip, v.version === selectedVersion && styles.chipActive]}
                        onPress={() => onSelectVersion(v.version)}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            v.version === selectedVersion && styles.chipTextActive,
                          ]}
                        >
                          {`v${v.version}`}
                          {v.version === currentVersion ? ` · ${t(`${NS}.statusDone`)}` : ''}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {diffLoading ? (
                    <View style={styles.centerBlock}>
                      <ActivityIndicator size="small" color={tk.brand.DEFAULT} />
                      <Text style={styles.muted}>{t(`${NS}.loading`)}</Text>
                    </View>
                  ) : diffError ? (
                    <Text style={styles.errorText}>{diffError}</Text>
                  ) : diff ? (
                    <Text style={styles.pre}>{diff}</Text>
                  ) : (
                    <Text style={styles.muted}>{t(`${NS}.empty`)}</Text>
                  )}
                </>
              )}
              {versions.length > 0 ? (
                <View style={styles.versionList}>
                  {versions.map((v) => (
                    <Text key={`meta-${v.version}`} style={styles.versionMeta}>
                      {`v${v.version} · ${v.channel} · ${v.reason || '—'} · ${v.createdAt}`}
                    </Text>
                  ))}
                </View>
              ) : null}
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg, paddingHorizontal: rnSpacing.md },
    header: { flexDirection: 'row', alignItems: 'center', marginTop: rnSpacing.md },
    scroll: { flex: 1 },
    scrollContent: { gap: rnSpacing.md, paddingBottom: rnSpacing['2xl'] },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
      marginTop: rnSpacing.sm,
    },
    title: { fontSize: 22, fontWeight: '600', color: tk.text.primary },
    card: {
      gap: rnSpacing.sm,
      padding: rnSpacing.md,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    label: { fontSize: rnType.caption.size, fontWeight: '500', color: tk.text.secondary },
    inputRow: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
    input: {
      flex: 1,
      height: 40,
      paddingHorizontal: rnSpacing.md,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.inputBg,
      fontSize: rnType.body.size,
      color: tk.text.primary,
    },
    primaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: rnSpacing.lg,
      paddingVertical: rnSpacing.sm,
      borderRadius: rnRadius.md,
      backgroundColor: tk.brand.cta,
    },
    primaryBtnText: { fontSize: rnType.label.size, fontWeight: '600', color: tk.brand.ctaForeground },
    btnDisabled: { opacity: 0.4 },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: rnSpacing.sm,
    },
    goal: { flex: 1, fontSize: rnType.body.size, fontWeight: '600', color: tk.text.primary },
    badge: {
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: 2,
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
      fontSize: rnType.caption.size,
      color: tk.text.secondary,
      overflow: 'hidden',
    },
    badgeDanger: { color: tk.danger.DEFAULT },
    fieldRow: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
    fieldLabel: { fontSize: rnType.caption.size, color: tk.text.secondary },
    fieldValue: { flex: 1, textAlign: 'right', fontSize: rnType.caption.size, color: tk.text.primary },
    resultBox: {
      gap: rnSpacing.xs,
      padding: rnSpacing.md,
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
    },
    pre: { fontSize: rnType.caption.size, lineHeight: 18, color: tk.text.primary },
    sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    sectionTitle: { fontSize: rnType.body.size, fontWeight: '600', color: tk.text.primary },
    progressRow: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
    progressCount: { fontSize: rnType.label.size, fontWeight: '600', color: tk.text.primary },
    progressTrack: {
      flex: 1,
      height: 8,
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
      overflow: 'hidden',
    },
    progressFill: { height: 8, borderRadius: rnRadius.md, backgroundColor: tk.brand.cta },
    taskRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    taskTitle: { flex: 1, fontSize: rnType.label.size, color: tk.text.primary },
    taskDone: { color: tk.text.tertiary, textDecorationLine: 'line-through' },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: rnSpacing.sm },
    chip: {
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.xs,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    chipActive: { borderColor: tk.brand.DEFAULT, backgroundColor: tk.surface.muted },
    chipText: { fontSize: rnType.caption.size, color: tk.text.secondary },
    chipTextActive: { color: tk.text.primary, fontWeight: '600' },
    versionList: { gap: 2, paddingTop: rnSpacing.sm },
    versionMeta: { fontSize: rnType.caption.size, color: tk.text.tertiary },
    centerBlock: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing.lg,
    },
    errorBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
      padding: rnSpacing.md,
      borderRadius: rnRadius.lg,
      backgroundColor: tk.error.bg,
    },
    errorText: { flex: 1, fontSize: rnType.label.size, color: tk.error.text },
    muted: { fontSize: rnType.label.size, color: tk.text.secondary },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
