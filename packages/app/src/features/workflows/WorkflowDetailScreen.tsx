// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Info,
  Play,
  Square,
  Trash2,
  Workflow,
  Zap,
} from 'lucide-react-native'
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { rnRadius } from '@ihui/design-tokens'
import type { TFunction } from '../../types'
import { getTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'
import { TextField } from '../../components/TextField'
import type { WfTriggerType, WorkflowListRow } from './WorkflowListScreen'
import type { WfInstanceStatus, WorkflowInstanceRow } from './WorkflowInstanceDetailScreen'

export interface WorkflowInfoInput {
  name: string
  description: string
  triggerType: WfTriggerType
}

export interface WorkflowDetailScreenProps {
  t: TFunction
  colorScheme?: 'light' | 'dark'
  onBack: () => void
  loading: boolean
  error: string | null
  workflow?: WorkflowListRow
  instances: WorkflowInstanceRow[]
  instTotal: number
  instPage: number
  instPageSize: number
  onRefresh: () => void
  onPage: (page: number) => void
  onOpenInstance: (id: string) => void
  /** 以下动作回传 null=成功、字符串=错误文案(由薄壳层落 API 并回传后端 error)。 */
  onTrigger: () => Promise<string | null>
  onToggleActive: (next: boolean) => Promise<string | null>
  onDelete: () => Promise<string | null>
  onSaveInfo: (input: WorkflowInfoInput) => Promise<string | null>
  onSaveSteps: (steps: unknown[]) => Promise<string | null>
  onCancelInstance: (id: string) => Promise<string | null>
  onRetryInstance: (id: string) => Promise<string | null>
}

const TRIGGER_KEYS: Record<WfTriggerType, string> = {
  manual: 'workflowsPage.triggerManual',
  schedule: 'workflowsPage.triggerSchedule',
  event: 'workflowsPage.triggerEvent',
  webhook: 'workflowsPage.triggerWebhook',
}

const TRIGGER_OPTIONS: WfTriggerType[] = ['manual', 'schedule', 'event', 'webhook']

const INST_STATUS_KEYS: Record<WfInstanceStatus, string> = {
  pending: 'workflowsPage.statusPending',
  running: 'workflowsPage.statusRunning',
  completed: 'workflowsPage.statusCompleted',
  failed: 'workflowsPage.statusFailed',
  cancelled: 'workflowsPage.statusCancelled',
}

type Tk = ReturnType<typeof getTokens>

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

function formatDateTime(iso?: string): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 步骤行防御性取字段(后端 steps 为 unknown[])。 */
function stepFields(raw: unknown): { name: string; type: string; input: string } {
  const s = (raw ?? {}) as Record<string, unknown>
  const name = typeof s.name === 'string' && s.name ? s.name : '-'
  const type = typeof s.type === 'string' && s.type ? s.type : '-'
  const input =
    typeof s.input === 'string' ? s.input : s.input === undefined ? '-' : JSON.stringify(s.input)
  return { name, type, input }
}

/**
 * 工作流详情共享屏(对齐 web /workflows/[id]):
 * 头部信息(名称/描述/触发/启停徽章)+ 动作(触发/启停/删除确认/编辑基本信息);
 * tab「运行实例」(分页 + 状态徽章 + 起止 + 错误 + 查看详情/取消/重试)与
 * 「步骤定义」(行渲染 name/type/input;编辑态 = JSON textarea + 保存 PATCH)。
 */
export function WorkflowDetailScreen({
  t,
  colorScheme = 'light',
  onBack,
  loading,
  error,
  workflow,
  instances,
  instTotal,
  instPage,
  instPageSize,
  onRefresh,
  onPage,
  onOpenInstance,
  onTrigger,
  onToggleActive,
  onDelete,
  onSaveInfo,
  onSaveSteps,
  onCancelInstance,
  onRetryInstance,
}: WorkflowDetailScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const [tab, setTab] = useState<'instances' | 'definition'>('instances')
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [editInfoMode, setEditInfoMode] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editTrigger, setEditTrigger] = useState<WfTriggerType>('manual')
  const [editStepsMode, setEditStepsMode] = useState(false)
  const [stepsText, setStepsText] = useState('[]')
  const [actionErr, setActionErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const runAction = async (fn: () => Promise<string | null>): Promise<boolean> => {
    if (busy) return false
    setBusy(true)
    setActionErr(null)
    const err = await fn()
    setBusy(false)
    setActionErr(err)
    return err === null
  }

  const header = (
    <View style={styles.header}>
      <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
      <Text style={styles.headerTitle}>{t('workflowsPage.detailTitle')}</Text>
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

  if (loading && !workflow) {
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

  const wf = workflow!
  const steps = Array.isArray(wf.steps) ? wf.steps : []
  const totalPages = Math.max(1, Math.ceil(instTotal / instPageSize))

  const startEditInfo = () => {
    setEditName(wf.name)
    setEditDesc(wf.description ?? '')
    setEditTrigger(wf.triggerType)
    setEditInfoMode(true)
    setActionErr(null)
  }

  const startEditSteps = () => {
    setStepsText(JSON.stringify(steps, null, 2))
    setEditStepsMode(true)
    setActionErr(null)
  }

  const handleSaveSteps = async () => {
    let parsed: unknown
    try {
      parsed = JSON.parse(stepsText)
    } catch {
      setActionErr(t('workflowsPage.stepsJsonInvalid'))
      return
    }
    if (!Array.isArray(parsed)) {
      setActionErr(t('workflowsPage.stepsJsonInvalid'))
      return
    }
    const ok = await runAction(() => onSaveSteps(parsed as unknown[]))
    if (ok) setEditStepsMode(false)
  }

  const handleSaveInfo = async () => {
    if (!editName.trim()) {
      setActionErr(t('workflowsPage.nameRequired'))
      return
    }
    const ok = await runAction(() =>
      onSaveInfo({ name: editName.trim(), description: editDesc.trim(), triggerType: editTrigger }),
    )
    if (ok) setEditInfoMode(false)
  }

  const handleDelete = async () => {
    const ok = await runAction(onDelete)
    if (ok) setDeleteConfirm(false)
  }

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
            <View style={styles.iconBox}>
              <Workflow size={18} color={tk.brandAccent.deep} strokeWidth={2} />
            </View>
            <View style={styles.headTexts}>
              <Text style={styles.wfTitle}>{wf.name}</Text>
              <Text style={styles.wfDesc}>{wf.description || '-'}</Text>
              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <Zap size={12} color={tk.text.tertiary} strokeWidth={2} />
                  <Text style={styles.metaText}>{t(TRIGGER_KEYS[wf.triggerType])}</Text>
                </View>
                <View
                  style={[styles.badge, wf.isActive ? styles.badgeActive : styles.badgeInactive]}
                >
                  <Text
                    style={[
                      styles.badgeText,
                      wf.isActive ? styles.badgeTextActive : styles.badgeTextInactive,
                    ]}
                  >
                    {wf.isActive
                      ? t('workflowsPage.statusActive')
                      : t('workflowsPage.statusInactive')}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {editInfoMode ? (
            <View style={styles.formBlock}>
              <Text style={styles.fieldLabel}>{t('workflowsPage.fieldName')}</Text>
              <TextField
                colorScheme={colorScheme}
                style={styles.input}
                value={editName}
                onChangeText={setEditName}
                placeholder={t('workflowsPage.fieldName')}
                placeholderTextColor={tk.text.tertiary}
              />
              <Text style={styles.fieldLabel}>{t('workflowsPage.fieldDesc')}</Text>
              <TextField
                colorScheme={colorScheme}
                style={[styles.input, styles.inputMultiline]}
                value={editDesc}
                onChangeText={setEditDesc}
                multiline
                placeholder={t('workflowsPage.fieldDesc')}
                placeholderTextColor={tk.text.tertiary}
              />
              <Text style={styles.fieldLabel}>{t('workflowsPage.fieldTrigger')}</Text>
              <View style={styles.chipRow}>
                {TRIGGER_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.chip, editTrigger === opt && styles.chipActive]}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    onPress={() => setEditTrigger(opt)}
                  >
                    <Text style={[styles.chipText, editTrigger === opt && styles.chipActiveText]}>
                      {t(TRIGGER_KEYS[opt])}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.formActions}>
                <TouchableOpacity
                  style={styles.secondaryBtn}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() => setEditInfoMode(false)}
                >
                  <Text style={styles.secondaryBtnText}>{t('workflowsPage.cancelAction')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.primaryBtn, busy && styles.btnDisabled]}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() => void handleSaveInfo()}
                >
                  <Text style={styles.primaryBtnText}>{t('workflowsPage.saveInfo')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.outlineBtn}
                activeOpacity={0.85}
                accessibilityRole="button"
                disabled={busy}
                onPress={startEditInfo}
              >
                <Info size={13} color={tk.text.medium} strokeWidth={2} />
                <Text style={styles.outlineBtnText}>{t('workflowsPage.editInfo')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.outlineBtn}
                activeOpacity={0.85}
                accessibilityRole="button"
                disabled={busy}
                onPress={() => void runAction(() => onToggleActive(!wf.isActive))}
              >
                <Text style={styles.outlineBtnText}>
                  {wf.isActive ? t('workflowsPage.deactivate') : t('workflowsPage.activate')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryBtn, (busy || !wf.isActive) && styles.btnDisabled]}
                activeOpacity={0.85}
                accessibilityRole="button"
                disabled={busy || !wf.isActive}
                onPress={() => void runAction(onTrigger)}
              >
                <Play size={13} color={tk.brand.ctaForeground} strokeWidth={2.4} />
                <Text style={styles.primaryBtnText}>{t('workflowsPage.triggerNow')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.dangerBtn}
                activeOpacity={0.85}
                accessibilityRole="button"
                disabled={busy}
                onPress={() => {
                  setDeleteConfirm(true)
                  setActionErr(null)
                }}
              >
                <Trash2 size={13} color={tk.danger.DEFAULT} strokeWidth={2} />
                <Text style={styles.dangerBtnText}>{t('workflowsPage.deleteWorkflow')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {deleteConfirm ? (
            <View style={styles.confirmBox}>
              <Text style={styles.confirmText}>
                {t('workflowsPage.deleteConfirmText', { name: wf.name })}
              </Text>
              <View style={styles.formActions}>
                <TouchableOpacity
                  style={styles.secondaryBtn}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  onPress={() => setDeleteConfirm(false)}
                >
                  <Text style={styles.secondaryBtnText}>{t('workflowsPage.cancelAction')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.dangerBtn, busy && styles.btnDisabled]}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() => void handleDelete()}
                >
                  <Text style={styles.dangerBtnText}>{t('workflowsPage.deleteWorkflow')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {actionErr ? <Text style={styles.errorText}>{actionErr}</Text> : null}
        </View>

        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tab, tab === 'instances' && styles.tabActive]}
            activeOpacity={0.8}
            accessibilityRole="button"
            onPress={() => {
              setTab('instances')
              setEditStepsMode(false)
            }}
          >
            <Text style={[styles.tabText, tab === 'instances' && styles.tabTextActive]}>
              {t('workflowsPage.tabInstances')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tab === 'definition' && styles.tabActive]}
            activeOpacity={0.8}
            accessibilityRole="button"
            onPress={() => setTab('definition')}
          >
            <Text style={[styles.tabText, tab === 'definition' && styles.tabTextActive]}>
              {t('workflowsPage.tabDefinition')}
            </Text>
          </TouchableOpacity>
        </View>

        {tab === 'instances' ? (
          <View style={styles.card}>
            {instances.length === 0 ? (
              <Text style={styles.emptyText}>{t('workflowsPage.noInstances')}</Text>
            ) : (
              instances.map((i) => (
                <View key={i.id} style={styles.instRow}>
                  <View style={styles.instHead}>
                    <View style={[styles.badge, { backgroundColor: instBadgeBg(tk, i.status) }]}>
                      <Text style={[styles.badgeText, { color: instBadgeFg(tk, i.status) }]}>
                        {t(INST_STATUS_KEYS[i.status])}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.metaText}>
                    {`${t('workflowsPage.startedAt')}: ${formatDateTime(i.startedAt)}`}
                  </Text>
                  <Text style={styles.metaText}>
                    {`${t('workflowsPage.completedAt')}: ${formatDateTime(i.completedAt)}`}
                  </Text>
                  {i.error ? (
                    <Text style={styles.errorText}>
                      {`${t('workflowsPage.errorLabel')}: ${i.error}`}
                    </Text>
                  ) : null}
                  <View style={styles.instActions}>
                    <TouchableOpacity
                      style={styles.linkBtn}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      onPress={() => onOpenInstance(i.id)}
                    >
                      <Text style={styles.linkBtnText}>{t('workflowsPage.viewInstance')}</Text>
                    </TouchableOpacity>
                    {(i.status === 'running' || i.status === 'pending') && (
                      <TouchableOpacity
                        style={styles.linkBtn}
                        activeOpacity={0.8}
                        accessibilityRole="button"
                        disabled={busy}
                        onPress={() => void runAction(() => onCancelInstance(i.id))}
                      >
                        <Square size={12} color={tk.warning.amberText} strokeWidth={2} />
                        <Text style={[styles.linkBtnText, { color: tk.warning.amberText }]}>
                          {t('workflowsPage.cancelAction')}
                        </Text>
                      </TouchableOpacity>
                    )}
                    {(i.status === 'failed' || i.status === 'cancelled') && (
                      <TouchableOpacity
                        style={styles.linkBtn}
                        activeOpacity={0.8}
                        accessibilityRole="button"
                        disabled={busy}
                        onPress={() => void runAction(() => onRetryInstance(i.id))}
                      >
                        <Text style={styles.linkBtnText}>{t('common.retry')}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))
            )}
            {totalPages > 1 ? (
              <View style={styles.pageRow}>
                <TouchableOpacity
                  style={styles.pageBtn}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  disabled={instPage <= 1}
                  onPress={() => onPage(Math.max(1, instPage - 1))}
                >
                  <ChevronLeft
                    size={13}
                    color={instPage <= 1 ? tk.text.tertiary : tk.text.medium}
                    strokeWidth={2.4}
                  />
                  <Text style={[styles.pageBtnText, instPage <= 1 && styles.pageBtnDisabled]}>
                    {t('workflowsPage.prev')}
                  </Text>
                </TouchableOpacity>
                <Text style={styles.pageInfo}>{`${instPage} / ${totalPages}`}</Text>
                <TouchableOpacity
                  style={styles.pageBtn}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  disabled={instPage >= totalPages}
                  onPress={() => onPage(Math.min(totalPages, instPage + 1))}
                >
                  <Text
                    style={[styles.pageBtnText, instPage >= totalPages && styles.pageBtnDisabled]}
                  >
                    {t('workflowsPage.next')}
                  </Text>
                  <ChevronRight
                    size={13}
                    color={instPage >= totalPages ? tk.text.tertiary : tk.text.medium}
                    strokeWidth={2.4}
                  />
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>
                {editStepsMode ? t('workflowsPage.editSteps') : t('workflowsPage.tabDefinition')}
              </Text>
              {editStepsMode ? (
                <View style={styles.formActions}>
                  <TouchableOpacity
                    style={styles.secondaryBtn}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    disabled={busy}
                    onPress={() => setEditStepsMode(false)}
                  >
                    <Text style={styles.secondaryBtnText}>{t('workflowsPage.cancelAction')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.primaryBtn, busy && styles.btnDisabled]}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    disabled={busy}
                    onPress={() => void handleSaveSteps()}
                  >
                    <Text style={styles.primaryBtnText}>{t('workflowsPage.save')}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.outlineBtn}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  onPress={startEditSteps}
                >
                  <Text style={styles.outlineBtnText}>{t('workflowsPage.editSteps')}</Text>
                </TouchableOpacity>
              )}
            </View>
            {editStepsMode ? (
              <TextField
                colorScheme={colorScheme}
                style={[styles.input, styles.stepsInput]}
                value={stepsText}
                onChangeText={setStepsText}
                multiline
                autoCorrect={false}
                placeholderTextColor={tk.text.tertiary}
              />
            ) : steps.length === 0 ? (
              <Text style={styles.emptyText}>{t('workflowsPage.noSteps')}</Text>
            ) : (
              steps.map((raw, idx) => {
                const s = stepFields(raw)
                return (
                  <View key={`${idx}-${s.name}`} style={styles.stepRow}>
                    <Text style={styles.stepIndex}>{`#${idx + 1}`}</Text>
                    <View style={styles.stepBody}>
                      <Text style={styles.stepName}>{s.name}</Text>
                      <Text style={styles.metaText}>{s.type}</Text>
                      <Text style={styles.stepInput} numberOfLines={2}>
                        {s.input}
                      </Text>
                    </View>
                  </View>
                )
              })
            )}
          </View>
        )}
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
    cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    iconBox: {
      width: 36,
      height: 36,
      borderRadius: rnRadius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tk.brandAccent.light,
    },
    headTexts: { flex: 1, gap: 4 },
    wfTitle: { fontSize: 17, fontWeight: '700', color: tk.text.primary },
    wfDesc: { fontSize: 12, color: tk.text.secondary, lineHeight: 17 },
    metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaText: { fontSize: 11, color: tk.text.secondary },
    badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: rnRadius.md },
    badgeText: { fontSize: 11, fontWeight: '600' },
    badgeActive: { backgroundColor: tk.success.light },
    badgeTextActive: { color: tk.success.deepText },
    badgeInactive: { backgroundColor: tk.surface.muted },
    badgeTextInactive: { color: tk.text.secondary },
    actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    primaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
    },
    primaryBtnText: { fontSize: 13, fontWeight: '600', color: tk.brand.ctaForeground },
    outlineBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: rnRadius.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.medium,
      backgroundColor: tk.surface.inputBg,
    },
    outlineBtnText: { fontSize: 13, color: tk.text.medium },
    dangerBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.danger.light,
    },
    dangerBtnText: { fontSize: 13, fontWeight: '600', color: tk.danger.DEFAULT },
    btnDisabled: { opacity: 0.6 },
    confirmBox: {
      gap: 8,
      padding: 10,
      borderRadius: rnRadius.md,
      backgroundColor: tk.danger.light,
    },
    confirmText: { fontSize: 12, color: tk.danger.DEFAULT, lineHeight: 17 },
    errorText: { fontSize: 12, color: tk.danger.DEFAULT, lineHeight: 17 },
    errorBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
    secondaryBtn: {
      alignSelf: 'center',
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: rnRadius.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.medium,
      backgroundColor: tk.surface.inputBg,
    },
    secondaryBtnText: { fontSize: 13, color: tk.text.medium },
    skeletonRow: { height: 44, borderRadius: rnRadius.lg, backgroundColor: tk.border.light },
    formBlock: { gap: 6 },
    formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
    fieldLabel: { fontSize: 12, fontWeight: '600', color: tk.text.medium, marginTop: 4 },
    input: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.medium,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.surface.inputBg,
      paddingHorizontal: 10,
      paddingVertical: 8,
      fontSize: 13,
      color: tk.text.primary,
    },
    inputMultiline: { minHeight: 56, textAlignVertical: 'top' },
    stepsInput: { minHeight: 160, textAlignVertical: 'top', fontFamily: 'monospace', fontSize: 12 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: rnRadius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.medium,
      backgroundColor: tk.surface.inputBg,
    },
    chipActive: { backgroundColor: tk.brand.cta, borderColor: tk.brand.cta },
    chipText: { fontSize: 12, color: tk.text.secondary },
    chipActiveText: { color: tk.brand.ctaForeground, fontWeight: '600' },
    tabRow: { flexDirection: 'row', gap: 8 },
    tab: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: rnRadius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
    },
    tabActive: { backgroundColor: tk.brandAccent.light, borderColor: tk.brandAccent.deep },
    tabText: { fontSize: 13, color: tk.text.secondary },
    tabTextActive: { color: tk.brandAccent.deep, fontWeight: '600' },
    instRow: {
      gap: 4,
      paddingVertical: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: tk.border.light,
    },
    instHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    instActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 2 },
    linkBtnText: { fontSize: 12, color: tk.brandAccent.deep, fontWeight: '600' },
    pageRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      paddingTop: 8,
    },
    pageBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    pageBtnText: { fontSize: 12, color: tk.text.medium },
    pageBtnDisabled: { color: tk.text.tertiary },
    pageInfo: { fontSize: 12, color: tk.text.secondary },
    sectionHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    sectionTitle: { fontSize: 14, fontWeight: '700', color: tk.text.primary },
    emptyText: { fontSize: 12, color: tk.text.secondary },
    stepRow: {
      flexDirection: 'row',
      gap: 8,
      paddingVertical: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: tk.border.light,
    },
    stepIndex: { fontSize: 11, color: tk.text.tertiary, width: 26 },
    stepBody: { flex: 1, gap: 2 },
    stepName: { fontSize: 13, fontWeight: '600', color: tk.text.primary },
    stepInput: { fontSize: 11, color: tk.text.secondary, lineHeight: 15 },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
