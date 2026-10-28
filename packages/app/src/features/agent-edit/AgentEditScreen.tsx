// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { AgentEditScreenProps } from '../../types'

import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { BackChevron } from '../../components/BackChevron'
import { TextField } from '../../components/TextField'

/**
 * Agent 编辑共享屏 — 跨端唯一功能源(props 注入式，业务状态与取数全在宿主 wrapper)。
 *
 * 立因(2026-10-29 P0 跨端对齐):web 有 `/agents/edit/[id]`，RN 端此前只能新建、不能编辑，
 * 而 RN 的 AgentCreateScreen 提交的是 POST /api/agents 另一套契约(model/systemPrompt)，
 * 与 PUT /api/agents/:agentId 的市场形字段集(name/avatar/cover/categoryId/status/price/isFree/sort/remark)
 * **不是同一物** ⇒ 不能给创建屏硬挂 editId 复用，否则会把"编辑"写成"用另一套字段重建"。
 *
 * 字段取舍逐条对齐基准端 apps/web/app/(main)/agents/edit/[id]/PageClient.tsx:79-90 的提交 body:
 * 不承载 workspaceId / skillIds(基准端亦不提交)。分类与状态的候选集由宿主注入
 * (禁在模块求值期调 t，状态标签经 statusKeyOf 折成键名后在渲染处解析)。
 *
 * 安卓返回键:选项弹层自成窗口，每个 Modal 必须给 onRequestClose，否则返回键会退整屏而非关面板。
 */
export type { AgentEditScreenProps }

export function AgentEditScreen({
  t,
  form,
  loading,
  saving,
  error,
  categories,
  statusOptions,
  statusKeyOf,
  categoryTextOf,
  onChange,
  onSubmit,
  onBack,
  colorScheme = 'light',
}: AgentEditScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  const [picker, setPicker] = useState<'category' | 'status' | null>(null)

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={tk.brand.DEFAULT} />
        <Text style={styles.muted}>{t('common.loading')}</Text>
      </View>
    )
  }

  return (
    <View style={styles.root}>
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.title}>{t('agentEdit.title')}</Text>
        <Text style={styles.muted}>{t('agentEdit.subtitle')}</Text>

        {error ? (
          <Text style={styles.error} accessibilityRole="text">
            {error}
          </Text>
        ) : null}

        <Text style={styles.label}>{t('agentEdit.fieldName')}</Text>
        <TextField
          colorScheme={colorScheme}
          style={styles.input}
          value={form.name}
          onChangeText={(v) => onChange('name', v)}
          placeholder={t('agentEdit.namePlaceholder')}
          placeholderTextColor={tk.text.tertiary}
          maxLength={100}
        />

        <Text style={styles.label}>{t('agentEdit.fieldDescription')}</Text>
        <TextField
          colorScheme={colorScheme}
          style={[styles.input, styles.inputMultiline]}
          value={form.description}
          onChangeText={(v) => onChange('description', v)}
          placeholder={t('agentEdit.descPlaceholder')}
          placeholderTextColor={tk.text.tertiary}
          multiline
          textAlignVertical="top"
        />

        <Text style={styles.label}>{t('agentEdit.fieldAvatar')}</Text>
        <TextField
          colorScheme={colorScheme}
          style={styles.input}
          value={form.avatar}
          onChangeText={(v) => onChange('avatar', v)}
          placeholder={t('agentEdit.avatPlaceholder')}
          placeholderTextColor={tk.text.tertiary}
          autoCapitalize="none"
        />

        <Text style={styles.label}>{t('agentEdit.fieldCover')}</Text>
        <TextField
          colorScheme={colorScheme}
          style={styles.input}
          value={form.cover}
          onChangeText={(v) => onChange('cover', v)}
          placeholder={t('agentEdit.coverPlaceholder')}
          placeholderTextColor={tk.text.tertiary}
          autoCapitalize="none"
        />

        <Text style={styles.label}>{t('agentEdit.fieldCategory')}</Text>
        <TouchableOpacity
          style={styles.selectRow}
          onPress={() => setPicker('category')}
          accessibilityRole="button"
        >
          <Text style={form.categoryId ? styles.selectValue : styles.selectPlaceholder}>
            {form.categoryId ? categoryTextOf(form.categoryId) : t('agentEdit.categoryPlaceholder')}
          </Text>
          <Text style={styles.selectHint}>{t('agentEdit.select')}</Text>
        </TouchableOpacity>

        <Text style={styles.label}>{t('agentEdit.fieldStatus')}</Text>
        <TouchableOpacity
          style={styles.selectRow}
          onPress={() => setPicker('status')}
          accessibilityRole="button"
        >
          <Text style={styles.selectValue}>{t(statusKeyOf(form.status))}</Text>
          <Text style={styles.selectHint}>{t('agentEdit.select')}</Text>
        </TouchableOpacity>

        <View style={styles.rowTwo}>
          <View style={styles.rowCell}>
            <Text style={styles.label}>{t('agentEdit.fieldPrice')}</Text>
            <TextField
              colorScheme={colorScheme}
              style={[styles.input, form.isFree ? styles.inputDisabled : null]}
              value={form.price}
              onChangeText={(v) => onChange('price', v)}
              placeholder="0"
              placeholderTextColor={tk.text.tertiary}
              keyboardType="numeric"
              editable={!form.isFree}
            />
          </View>
          <View style={styles.rowCell}>
            <Text style={styles.label}>{t('agentEdit.fieldSort')}</Text>
            <TextField
              colorScheme={colorScheme}
              style={styles.input}
              value={form.sort}
              onChangeText={(v) => onChange('sort', v)}
              placeholder="0"
              placeholderTextColor={tk.text.tertiary}
              keyboardType="numeric"
            />
          </View>
        </View>

        <TouchableOpacity
          style={styles.toggleRow}
          onPress={() => onChange('isFree', !form.isFree)}
          accessibilityRole="switch"
          accessibilityState={{ checked: form.isFree }}
        >
          <Text style={styles.toggleLabel}>{t('agentEdit.fieldIsFree')}</Text>
          <Text style={styles.toggleValue}>
            {form.isFree ? t('agentEdit.freeOn') : t('agentEdit.freeOff')}
          </Text>
        </TouchableOpacity>

        <Text style={styles.label}>{t('agentEdit.fieldRemark')}</Text>
        <TextField
          colorScheme={colorScheme}
          style={[styles.input, styles.inputMultiline]}
          value={form.remark}
          onChangeText={(v) => onChange('remark', v)}
          placeholder={t('agentEdit.remarkPlaceholder')}
          placeholderTextColor={tk.text.tertiary}
          multiline
          textAlignVertical="top"
        />

        <TouchableOpacity
          style={[styles.submitBtn, saving ? styles.submitBtnDisabled : null]}
          onPress={onSubmit}
          disabled={saving}
          accessibilityRole="button"
        >
          <Text style={styles.submitBtnText}>
            {saving ? t('agentEdit.saving') : t('common.save')}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* 选项弹层:自成窗口 ⇒ 避让容器必须放在 Modal 内侧，压外层 KAV 吃不到 */}
      <Modal
        visible={picker !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPicker(null)}
      >
        <KeyboardAvoidingView
          style={styles.modalAvoid}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity style={styles.modalScrim} onPress={() => setPicker(null)}>
            <View style={styles.modalPanel}>
              <Text style={styles.modalTitle}>
                {picker === 'status'
                  ? t('agentEdit.fieldStatus')
                  : t('agentEdit.categoryPickerTitle')}
              </Text>
              <ScrollView style={styles.modalList}>
                {picker === 'status'
                  ? statusOptions.map((s) => (
                      <TouchableOpacity
                        key={s}
                        onPress={() => {
                          onChange('status', s)
                          setPicker(null)
                        }}
                        style={[
                          styles.modalItem,
                          s === form.status ? styles.modalItemActive : null,
                        ]}
                      >
                        <Text
                          style={[
                            styles.modalItemText,
                            s === form.status ? styles.modalItemTextActive : null,
                          ]}
                        >
                          {t(statusKeyOf(s))}
                        </Text>
                      </TouchableOpacity>
                    ))
                  : categories.map((c) => (
                      <TouchableOpacity
                        key={c.id}
                        style={[
                          styles.modalItem,
                          c.id === form.categoryId ? styles.modalItemActive : null,
                        ]}
                        onPress={() => {
                          onChange('categoryId', c.id)
                          setPicker(null)
                        }}
                      >
                        <Text
                          style={[
                            styles.modalItemText,
                            c.id === form.categoryId ? styles.modalItemTextActive : null,
                          ]}
                        >
                          {c.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
              </ScrollView>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setPicker(null)}>
                <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: tk.surface.bg },
    container: { flex: 1, backgroundColor: tk.surface.bg },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: rnSpacing.lg,
      backgroundColor: tk.surface.bg,
    },
    muted: { fontSize: rnType.body.size, color: tk.text.secondary },
    title: {
      marginTop: rnSpacing.sm,
      fontSize: rnType.display.size,
      fontWeight: '700',
      color: tk.text.primary,
    },
    error: { marginTop: rnSpacing.md, fontSize: rnType.body.size, color: tk.error.text },
    label: { marginTop: rnSpacing.md, fontSize: rnType.body.size, color: tk.text.secondary },
    input: {
      marginTop: rnSpacing.sm,
      borderWidth: 1,
      borderColor: tk.border.light,
      borderRadius: rnRadius.sm,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
      fontSize: rnType.title.size,
      color: tk.text.primary,
      backgroundColor: tk.surface.muted,
    },
    inputMultiline: { minHeight: 72, maxHeight: 160 },
    inputDisabled: { opacity: 0.5 },
    rowTwo: { flexDirection: 'row', gap: rnSpacing.sm },
    rowCell: { flex: 1, minWidth: 140 },
    selectRow: {
      marginTop: rnSpacing.sm,
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: tk.border.light,
      borderRadius: rnRadius.sm,
      paddingHorizontal: rnSpacing.md,
      backgroundColor: tk.surface.muted,
    },
    selectValue: { flex: 1, fontSize: rnType.title.size, color: tk.text.primary },
    selectPlaceholder: { flex: 1, fontSize: rnType.title.size, color: tk.text.tertiary },
    selectHint: { fontSize: rnType.caption.size, color: tk.brand.DEFAULT },
    toggleRow: {
      marginTop: rnSpacing.md,
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: tk.border.light,
      borderRadius: rnRadius.sm,
      paddingHorizontal: rnSpacing.md,
      backgroundColor: tk.surface.light,
    },
    toggleLabel: { fontSize: rnType.title.size, color: tk.text.primary },
    toggleValue: { fontSize: rnType.body.size, fontWeight: '600', color: tk.brand.DEFAULT },
    submitBtn: {
      marginTop: rnSpacing.xl,
      height: 50,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
      alignItems: 'center',
      justifyContent: 'center',
    },
    submitBtnDisabled: { opacity: 0.5 },
    submitBtnText: {
      color: tk.brand.ctaForeground,
      fontSize: rnType.title.size,
      fontWeight: '600',
    },
    modalAvoid: { flex: 1, justifyContent: 'flex-end' },
    modalScrim: {
      flex: 1,
      backgroundColor: tk.overlay.modal,
      justifyContent: 'flex-end',
    },
    modalPanel: {
      backgroundColor: tk.surface.card,
      borderTopLeftRadius: rnRadius['2xl'],
      borderTopRightRadius: rnRadius['2xl'],
      paddingHorizontal: rnSpacing.lg,
      paddingTop: rnSpacing.lg,
      paddingBottom: rnSpacing.xl,
    },
    modalTitle: {
      fontSize: rnType.title.size,
      fontWeight: '600',
      color: tk.text.primary,
      marginBottom: rnSpacing.sm,
    },
    modalList: { maxHeight: 300 },
    modalItem: {
      paddingVertical: rnSpacing.md,
      borderRadius: rnRadius.sm,
      paddingHorizontal: rnSpacing.sm,
    },
    modalItemActive: { backgroundColor: tk.surface.muted },
    modalItemText: { fontSize: rnType.body.size, color: tk.text.primary },
    modalItemTextActive: { color: tk.brand.DEFAULT, fontWeight: '600' },
    modalCancel: {
      marginTop: rnSpacing.md,
      paddingVertical: rnSpacing.md,
      alignItems: 'center',
    },
    modalCancelText: { fontSize: rnType.body.size, color: tk.text.secondary },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
