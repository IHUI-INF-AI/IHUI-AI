// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo, useState } from 'react'
import { Clock, ListChecks, Plus, Workflow, Zap } from 'lucide-react-native'
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { rnRadius } from '@ihui/design-tokens'
import type { TFunction } from '../../types'
import { getTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'

/** 触发类型(与后端 /workflows triggerType 同域)。 */
export type WfTriggerType = 'manual' | 'schedule' | 'event' | 'webhook'

/** 工作流列表行(形状对齐 @ihui/api-client WorkflowRow;共享层不依赖 api-client,独立声明)。 */
export interface WorkflowListRow {
  id: string
  name: string
  description?: string
  triggerType: WfTriggerType
  steps?: unknown[]
  isActive: boolean
  createdAt: string
}

/** 内联创建表单提交载荷(steps 已由屏内完成 JSON 校验)。 */
export interface WorkflowCreateInput {
  name: string
  description: string
  triggerType: WfTriggerType
  steps: unknown[]
}

export interface WorkflowListScreenProps {
  t: TFunction
  colorScheme?: 'light' | 'dark'
  onBack: () => void
  /** 点卡片进入详情(平台侧导航)。 */
  onOpen: (id: string) => void
  loading: boolean
  error: string | null
  items: WorkflowListRow[]
  onRefresh: () => void
  /** 创建:成功返回新工作流 id,失败返回 null(取数由平台薄壳层承担)。 */
  onCreate: (input: WorkflowCreateInput) => Promise<string | null>
}

const TRIGGER_KEYS: Record<WfTriggerType, string> = {
  manual: 'workflowsPage.triggerManual',
  schedule: 'workflowsPage.triggerSchedule',
  event: 'workflowsPage.triggerEvent',
  webhook: 'workflowsPage.triggerWebhook',
}

const TRIGGER_OPTIONS: WfTriggerType[] = ['manual', 'schedule', 'event', 'webhook']

const DEFAULT_STEPS_JSON = '[\n  { "name": "Step 1", "type": "echo", "input": "hello world" }\n]'

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * 工作流列表共享屏(Wave1 workflows 域,对齐 web /workflows 三件套语义):
 * 头部返回 + 标题 + 新建入口;内联创建表单(名称/描述/触发四选一/步骤 JSON);
 * 卡片列表(名称 + 启停徽章 + 触发/步骤数/创建时间 + 描述);loading/error/empty/refresh 四态。
 */
export function WorkflowListScreen({
  t,
  colorScheme = 'light',
  onBack,
  onOpen,
  loading,
  error,
  items,
  onRefresh,
  onCreate,
}: WorkflowListScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [trigger, setTrigger] = useState<WfTriggerType>('manual')
  const [stepsJson, setStepsJson] = useState(DEFAULT_STEPS_JSON)
  const [formErr, setFormErr] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const resetForm = () => {
    setName('')
    setDesc('')
    setTrigger('manual')
    setStepsJson(DEFAULT_STEPS_JSON)
    setFormErr(null)
  }

  const handleSubmit = async () => {
    if (submitting) return
    setFormErr(null)
    if (!name.trim()) {
      setFormErr(t('workflowsPage.nameRequired'))
      return
    }
    let steps: unknown
    try {
      steps = JSON.parse(stepsJson)
    } catch {
      setFormErr(t('workflowsPage.stepsJsonInvalid'))
      return
    }
    if (!Array.isArray(steps)) {
      setFormErr(t('workflowsPage.stepsJsonInvalid'))
      return
    }
    setSubmitting(true)
    const id = await onCreate({
      name: name.trim(),
      description: desc.trim(),
      triggerType: trigger,
      steps,
    })
    setSubmitting(false)
    if (id) {
      resetForm()
      setCreateOpen(false)
      onOpen(id)
    } else {
      setFormErr(t('workflowsPage.createdFailed'))
    }
  }

  const header = (
    <View style={styles.header}>
      <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
      <Text style={styles.headerTitle}>{t('workflowsPage.title')}</Text>
      <TouchableOpacity
        style={styles.createBtn}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={t('workflowsPage.create')}
        onPress={() => setCreateOpen((o) => !o)}
      >
        <Plus size={14} color={tk.brand.ctaForeground} strokeWidth={2.4} />
        <Text style={styles.createBtnText}>{t('workflowsPage.create')}</Text>
      </TouchableOpacity>
    </View>
  )

  return (
    <View style={styles.container}>
      {header}
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={loading && !error}
            onRefresh={onRefresh}
            tintColor={tk.text.secondary}
          />
        }
      >
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>{t('workflowsPage.title')}</Text>
          <Text style={styles.heroSubtitle}>{t('workflowsPage.subtitle')}</Text>
        </View>

        {createOpen ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('workflowsPage.createTitle')}</Text>
            <Text style={styles.formDesc}>{t('workflowsPage.createDesc')}</Text>

            <Text style={styles.fieldLabel}>{t('workflowsPage.fieldName')}</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder={t('workflowsPage.fieldName')}
              placeholderTextColor={tk.text.tertiary}
            />

            <Text style={styles.fieldLabel}>{t('workflowsPage.fieldDesc')}</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={desc}
              onChangeText={setDesc}
              multiline
              placeholder={t('workflowsPage.fieldDesc')}
              placeholderTextColor={tk.text.tertiary}
            />

            <Text style={styles.fieldLabel}>{t('workflowsPage.fieldTrigger')}</Text>
            <View style={styles.chipRow}>
              {TRIGGER_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[styles.chip, trigger === opt && styles.chipActive]}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  onPress={() => setTrigger(opt)}
                >
                  <Text style={[styles.chipText, trigger === opt && styles.chipTextActive]}>
                    {t(TRIGGER_KEYS[opt])}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>{t('workflowsPage.fieldSteps')}</Text>
            <TextInput
              style={[styles.input, styles.stepsInput]}
              value={stepsJson}
              onChangeText={setStepsJson}
              multiline
              autoCorrect={false}
              placeholderTextColor={tk.text.tertiary}
            />

            {formErr ? <Text style={styles.formErr}>{formErr}</Text> : null}

            <View style={styles.formActions}>
              <TouchableOpacity
                style={styles.secondaryBtn}
                activeOpacity={0.85}
                accessibilityRole="button"
                disabled={submitting}
                onPress={() => {
                  resetForm()
                  setCreateOpen(false)
                }}
              >
                <Text style={styles.secondaryBtnText}>{t('workflowsPage.createCancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryBtn, submitting && styles.btnDisabled]}
                activeOpacity={0.85}
                accessibilityRole="button"
                disabled={submitting}
                onPress={() => void handleSubmit()}
              >
                <Text style={styles.primaryBtnText}>{t('workflowsPage.createSubmit')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {error && !loading ? (
          <View style={styles.card}>
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
        ) : loading && items.length === 0 ? (
          <View style={styles.card}>
            <View style={styles.skeletonRow} />
            <View style={styles.skeletonRow} />
          </View>
        ) : items.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>{t('workflowsPage.empty')}</Text>
          </View>
        ) : (
          items.map((w) => {
            const stepCount = Array.isArray(w.steps) ? w.steps.length : 0
            return (
              <TouchableOpacity
                key={w.id}
                style={styles.card}
                activeOpacity={0.85}
                accessibilityRole="button"
                onPress={() => onOpen(w.id)}
              >
                <View style={styles.cardHead}>
                  <View style={styles.iconBox}>
                    <Workflow size={17} color={tk.brandAccent.deep} strokeWidth={2} />
                  </View>
                  <Text style={styles.cardTitleText} numberOfLines={1}>
                    {w.name}
                  </Text>
                  <View
                    style={[styles.badge, w.isActive ? styles.badgeActive : styles.badgeInactive]}
                  >
                    <Text
                      style={[
                        styles.badgeText,
                        w.isActive ? styles.badgeTextActive : styles.badgeTextInactive,
                      ]}
                    >
                      {w.isActive
                        ? t('workflowsPage.statusActive')
                        : t('workflowsPage.statusInactive')}
                    </Text>
                  </View>
                </View>
                <Text style={styles.descText}>{w.description || '-'}</Text>
                <View style={styles.metaRow}>
                  <View style={styles.metaItem}>
                    <Zap size={12} color={tk.text.tertiary} strokeWidth={2} />
                    <Text style={styles.metaText}>{t(TRIGGER_KEYS[w.triggerType])}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <ListChecks size={12} color={tk.text.tertiary} strokeWidth={2} />
                    <Text style={styles.metaText}>
                      {t('workflowsPage.stepsCount', { count: stepCount })}
                    </Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Clock size={12} color={tk.text.tertiary} strokeWidth={2} />
                    <Text style={styles.metaText}>{formatDateTime(w.createdAt)}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            )
          })
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
    createBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
    },
    createBtnText: { fontSize: 13, fontWeight: '600', color: tk.brand.ctaForeground },
    scroll: { padding: 12, paddingBottom: 32, gap: 12 },
    hero: { gap: 4 },
    heroTitle: { fontSize: 22, fontWeight: '700', color: tk.text.primary },
    heroSubtitle: { fontSize: 12, color: tk.text.secondary },
    card: {
      backgroundColor: tk.surface.light,
      borderRadius: rnRadius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.light,
      padding: 12,
      gap: 10,
    },
    cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    iconBox: {
      width: 32,
      height: 32,
      borderRadius: rnRadius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tk.brandAccent.light,
    },
    cardTitle: { fontSize: 16, fontWeight: '700', color: tk.text.primary },
    cardTitleText: { flex: 1, fontSize: 15, fontWeight: '600', color: tk.text.primary },
    descText: { fontSize: 12, color: tk.text.secondary, lineHeight: 17 },
    badge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: rnRadius.md,
    },
    badgeText: { fontSize: 11, fontWeight: '600' },
    badgeActive: { backgroundColor: tk.success.light },
    badgeTextActive: { color: tk.success.deepText },
    badgeInactive: { backgroundColor: tk.surface.muted },
    badgeTextInactive: { color: tk.text.secondary },
    metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaText: { fontSize: 11, color: tk.text.secondary },
    formDesc: { fontSize: 12, color: tk.text.secondary },
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
    stepsInput: { minHeight: 96, textAlignVertical: 'top', fontFamily: 'monospace', fontSize: 12 },
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
    chipTextActive: { color: tk.brand.ctaForeground, fontWeight: '600' },
    formErr: { fontSize: 12, color: tk.danger.DEFAULT },
    errorText: { fontSize: 13, color: tk.danger.DEFAULT },
    formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
    primaryBtn: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
    },
    primaryBtnText: { fontSize: 13, fontWeight: '600', color: tk.brand.ctaForeground },
    secondaryBtn: {
      alignSelf: 'flex-start',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: rnRadius.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.medium,
      backgroundColor: tk.surface.inputBg,
    },
    secondaryBtnText: { fontSize: 13, color: tk.text.medium },
    btnDisabled: { opacity: 0.6 },
    emptyBox: {
      borderWidth: StyleSheet.hairlineWidth,
      borderStyle: 'dashed',
      borderColor: tk.border.medium,
      borderRadius: rnRadius.lg,
      paddingVertical: 32,
      alignItems: 'center',
    },
    emptyText: { fontSize: 13, color: tk.text.secondary },
    skeletonRow: { height: 44, borderRadius: rnRadius.lg, backgroundColor: tk.border.light },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
