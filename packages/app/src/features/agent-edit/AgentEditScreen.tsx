// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { Pencil } from 'lucide-react-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import type { TFunction } from '../../types'
import { getTokens, type AppThemeMode, type AppThemeTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'
import { EmptyState, ErrorState } from '../../components/ScreenStates'
import { TextField } from '../../components/TextField'

const NS = 'agentEditPage'

/** 与 web 同取值集(apps/web/app/(main)/agents/create/helpers.ts:24 STATUS_OPTIONS) */
const STATUS_OPTIONS = ['pending', 'published', 'rejected', 'offline'] as const

/** 与 web STATUS_KEY 同表(helpers.ts:26-31),值=本页 ns 下的键 */
const STATUS_KEY: Record<string, string> = {
  pending: 'statusPending',
  published: 'statusPublished',
  rejected: 'statusRejected',
  offline: 'statusOffline',
}

export interface AgentEditFormState {
  name: string
  description: string
  avatar: string
  cover: string
  categoryId: string
  status: string
  price: string
  isFree: boolean
  sort: string
  remark: string
}

export interface AgentEditCategoryOption {
  categoryId: string
  name: string
}

export interface AgentEditScreenProps {
  t: TFunction
  colorScheme: AppThemeMode
  onBack: () => void
  loading: boolean
  error: string | null
  /** 详情 404(后端 GET /api/agents/:agentId 对不存在/非 published 回 404)⇒ 空态 */
  notFound: boolean
  form: AgentEditFormState | null
  categories: AgentEditCategoryOption[]
  /** 表单级错误(web PageClient.tsx:100/111 同义:名称必填 + 提交失败) */
  formError: string | null
  /** 提交成功提示(web toast.success(t('updateSuccess')) 的 RN 落地:内联横幅,不引 toast 库) */
  saved: boolean
  pending: boolean
  onChange: <K extends keyof AgentEditFormState>(key: K, value: AgentEditFormState[K]) => void
  onSubmit: () => void
  onRetry: () => void
}

/**
 * 智能体编辑共享屏 —— 承载 web /agents/edit/[id]。
 *
 * 后端:GET /api/agents/:agentId 取详情(复用 endpoints/agent.ts:66 getAgentDetail)、
 * PUT /api/agents/:agentId 保存(endpoints/agents-edit.ts)、GET /api/categories/list 取分类下拉。
 * 口径差(如实登记):web 用 Select 下拉选分类/状态,RN 落为「可换行胶囊选择」——同取值集、
 * 同提交字段,只是交互控件形态不同;web 的「绑定技能」子面板(AgentCreateForm.tsx:176-180)
 * 未承载:其 skillIds 也**不参与** PUT body(PageClient.tsx:79-90),故不影响保存语义。
 * 平台无关:取数 / 提交 / 导航全由薄壳注入,本文件只管渲染与 loading / error / empty 三态。
 */
export function AgentEditScreen({
  t,
  colorScheme,
  onBack,
  loading,
  error,
  notFound,
  form,
  categories,
  formError,
  saved,
  pending,
  onChange,
  onSubmit,
  onRetry,
}: AgentEditScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <View style={styles.titleBox}>
          <View style={styles.titleRow}>
            <Pencil size={18} color={tk.brand.DEFAULT} />
            <Text style={styles.title}>{t(`${NS}.title`)}</Text>
          </View>
          <Text style={styles.muted}>{t(`${NS}.subtitle`)}</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centerBlock}>
          <ActivityIndicator size="small" color={tk.brand.DEFAULT} />
          <Text style={styles.muted}>{t(`${NS}.loading`)}</Text>
        </View>
      ) : error ? (
        <ErrorState
          message={error}
          retryLabel={t(`${NS}.retry`)}
          onRetry={onRetry}
          colorScheme={colorScheme}
        />
      ) : notFound || !form ? (
        <EmptyState title={t(`${NS}.notFound`)} colorScheme={colorScheme} />
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {saved ? <Text style={styles.saved}>{t(`${NS}.updateSuccess`)}</Text> : null}

          <Text style={styles.label}>{`${t(`${NS}.fieldName`)} *`}</Text>
          <TextField
            colorScheme={colorScheme}
            style={styles.input}
            value={form.name}
            onChangeText={(v) => onChange('name', v)}
            placeholder={t(`${NS}.namePlaceholder`)}
            placeholderTextColor={tk.text.tertiary}
          />

          <Text style={styles.label}>{t(`${NS}.fieldDescription`)}</Text>
          <TextField
            colorScheme={colorScheme}
            style={[styles.input, styles.inputMultiline]}
            value={form.description}
            onChangeText={(v) => onChange('description', v)}
            placeholder={t(`${NS}.descPlaceholder`)}
            placeholderTextColor={tk.text.tertiary}
            multiline
            textAlignVertical="top"
          />

          <Text style={styles.label}>{t(`${NS}.fieldAvatar`)}</Text>
          <TextField
            colorScheme={colorScheme}
            style={styles.input}
            value={form.avatar}
            onChangeText={(v) => onChange('avatar', v)}
            placeholder={t(`${NS}.avatarPlaceholder`)}
            placeholderTextColor={tk.text.tertiary}
          />

          <Text style={styles.label}>{t(`${NS}.fieldCover`)}</Text>
          <TextField
            colorScheme={colorScheme}
            style={styles.input}
            value={form.cover}
            onChangeText={(v) => onChange('cover', v)}
            placeholder={t(`${NS}.coverPlaceholder`)}
            placeholderTextColor={tk.text.tertiary}
          />

          <Text style={styles.label}>{t(`${NS}.fieldCategory`)}</Text>
          {categories.length === 0 ? (
            <Text style={styles.hint}>{t(`${NS}.categoryPlaceholder`)}</Text>
          ) : (
            <View style={styles.chipRow}>
              {categories.map((c) => {
                const active = form.categoryId === c.categoryId
                return (
                  <TouchableOpacity
                    key={c.categoryId}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => onChange('categoryId', c.categoryId)}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
                      {c.name}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          )}

          <Text style={styles.label}>{t(`${NS}.fieldStatus`)}</Text>
          <View style={styles.chipRow}>
            {STATUS_OPTIONS.map((value) => {
              const active = form.status === value
              return (
                <TouchableOpacity
                  key={value}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => onChange('status', value)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {t(`${NS}.${STATUS_KEY[value]}`)}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>

          <View style={styles.inlineRow}>
            <View style={styles.inlineField}>
              <Text style={styles.label}>{t(`${NS}.fieldPrice`)}</Text>
              <TextField
                colorScheme={colorScheme}
                style={[styles.input, form.isFree && styles.inputDisabled]}
                value={form.price}
                onChangeText={(v) => onChange('price', v)}
                editable={!form.isFree}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.inlineField}>
              <Text style={styles.label}>{t(`${NS}.fieldSort`)}</Text>
              <TextField
                colorScheme={colorScheme}
                style={styles.input}
                value={form.sort}
                onChangeText={(v) => onChange('sort', v)}
                keyboardType="numeric"
              />
            </View>
          </View>

          <View style={[styles.freeToggle, form.isFree && styles.freeToggleOn]}>
            <Text style={styles.freeToggleText}>{t(`${NS}.fieldIsFree`)}</Text>
            <Switch
              value={form.isFree}
              onValueChange={(v) => onChange('isFree', v)}
              trackColor={{ true: tk.brand.DEFAULT, false: tk.border.light }}
              thumbColor={tk.surface.light}
            />
          </View>

          <Text style={styles.label}>{t(`${NS}.remark`)}</Text>
          <TextField
            colorScheme={colorScheme}
            style={[styles.input, styles.inputMultiline]}
            value={form.remark}
            onChangeText={(v) => onChange('remark', v)}
            multiline
            textAlignVertical="top"
          />

          {formError ? <Text style={styles.error}>{formError}</Text> : null}

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onBack} disabled={pending}>
              <Text style={styles.cancelText}>{t(`${NS}.cancel`)}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitBtn, pending && styles.submitBtnDisabled]}
              onPress={onSubmit}
              disabled={pending}
            >
              <Text style={styles.submitText}>
                {pending ? t(`${NS}.submitting`) : t(`${NS}.submit`)}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg, paddingHorizontal: rnSpacing.md },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.md,
      marginTop: rnSpacing.md,
    },
    titleBox: { flex: 1 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
    title: { fontSize: 22, fontWeight: '600', color: tk.text.primary },
    muted: { marginTop: 2, fontSize: rnType.label.size, color: tk.text.secondary },
    centerBlock: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing['2xl'],
    },
    scroll: { flex: 1, marginTop: rnSpacing.md },
    scrollContent: { paddingBottom: rnSpacing['3xl'] },
    saved: {
      marginBottom: rnSpacing.sm,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.xs,
      borderRadius: rnRadius.md,
      backgroundColor: tk.success.lightest,
      color: tk.success.deepText,
      fontSize: rnType.label.size,
    },
    label: { marginTop: rnSpacing.md, fontSize: rnType.body.size, color: tk.text.secondary },
    input: {
      marginTop: rnSpacing.xs,
      borderWidth: 1,
      borderColor: tk.border.light,
      borderRadius: rnRadius.sm,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
      fontSize: rnType.body.size,
      color: tk.text.primary,
      backgroundColor: tk.surface.muted,
    },
    inputDisabled: { opacity: 0.5 },
    inputMultiline: { minHeight: 84, maxHeight: 160 },
    hint: { marginTop: rnSpacing.xs, fontSize: rnType.label.size, color: tk.text.tertiary },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: rnSpacing.sm,
      marginTop: rnSpacing.xs,
    },
    chip: {
      maxWidth: '100%',
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.xs,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    chipActive: { borderColor: tk.brand.DEFAULT, backgroundColor: tk.surface.card },
    chipText: { fontSize: rnType.label.size, color: tk.text.secondary },
    chipTextActive: { color: tk.brand.DEFAULT, fontWeight: '600' },
    inlineRow: { flexDirection: 'row', gap: rnSpacing.md },
    inlineField: { flex: 1 },
    freeToggle: {
      marginTop: rnSpacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: tk.border.light,
      borderRadius: rnRadius.lg,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
    },
    freeToggleOn: { borderColor: tk.brand.DEFAULT, backgroundColor: tk.surface.card },
    freeToggleText: { fontSize: rnType.body.size, color: tk.text.primary },
    error: { marginTop: rnSpacing.md, fontSize: rnType.body.size, color: tk.danger.DEFAULT },
    actions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: rnSpacing.md,
      marginTop: rnSpacing.xl,
    },
    cancelBtn: {
      paddingHorizontal: rnSpacing.lg,
      paddingVertical: rnSpacing.sm,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    cancelText: { fontSize: rnType.body.size, color: tk.text.secondary },
    submitBtn: {
      paddingHorizontal: rnSpacing.xl,
      paddingVertical: rnSpacing.sm,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
    },
    submitBtnDisabled: { opacity: 0.5 },
    submitText: { fontSize: rnType.body.size, fontWeight: '600', color: tk.surface.light },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
