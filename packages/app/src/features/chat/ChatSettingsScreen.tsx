// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { Settings } from 'lucide-react-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import type { TFunction } from '../../types'
import { getTokens, type AppThemeMode, type AppThemeTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'

const NS = 'chatSettingsPage'

export interface ChatModelOptionView {
  value: string
  label: string
}

export interface ChatSettingsScreenProps {
  t: TFunction
  colorScheme: AppThemeMode
  /** 返回(承载 web back 按钮 + cancel 跳转 —— web 两者同去向 /chat) */
  onBack: () => void
  /** 非空即未登录门(与 web useAuthGate/AuthGatePrompt 同口径) */
  loginRequiredText: string
  models: ChatModelOptionView[]
  model: string
  temperature: string
  maxTokens: string
  systemPrompt: string
  onField: (field: 'model' | 'temperature' | 'maxTokens' | 'systemPrompt', value: string) => void
  error: string | null
  saving: boolean
  onSubmit: () => void
}

/**
 * 聊天设置共享屏 —— 承载 web /chat/settings(仅 PUT /api/chat/settings,无 GET 注水,
 * 表单初值 = FALLBACK 首项 + 0.7 + 2048 + 空,与 web page.tsx:58-63 同式)。
 *
 * 口径差(如实登记):
 *  - web <select> 下拉 → RN 横滑 chip 列(同数据源、同选择语义;初始值不在选项内时
 *    web select 渲染为未选中,RN chip 列同样不高亮,行为等价);
 *  - web toast「设置已保存」为非阻塞自动跳转,RN 统一替代物 appAlert 确认后 goBack
 *    (本仓禁止原生弹窗,appAlert 为 BottomPops 既定形态),由薄壳执行;
 *  - 取消按钮 web 与返回同去向(push('/chat')),RN 合并为返回键 + 同语义取消按钮。
 * 平台无关:取数 / 模型列表拉取 / 校验 / PUT 提交 / 登录态判定全部由薄壳注入,
 * 本文件只管渲染与输入回调转发。
 */
export function ChatSettingsScreen({
  t,
  colorScheme,
  onBack,
  loginRequiredText,
  models,
  model,
  temperature,
  maxTokens,
  systemPrompt,
  onField,
  error,
  saving,
  onSubmit,
}: ChatSettingsScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <View style={styles.titleBox}>
          <View style={styles.titleRow}>
            <Settings size={20} color={tk.brand.DEFAULT} />
            <Text style={styles.title}>{t(`${NS}.title`)}</Text>
          </View>
          <Text style={styles.subtitle}>{t(`${NS}.subtitle`)}</Text>
        </View>
      </View>

      {loginRequiredText ? (
        <Text style={styles.loginHint}>{loginRequiredText}</Text>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.label}>{t(`${NS}.model`)}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipScroll}
            contentContainerStyle={styles.chipRow}
          >
            {models.map((m) => {
              const selected = m.value === model
              return (
                <TouchableOpacity
                  key={m.value}
                  style={[styles.chip, selected ? styles.chipSelected : null]}
                  onPress={() => onField('model', m.value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <Text
                    style={[styles.chipText, selected ? styles.chipTextSelected : null]}
                    numberOfLines={1}
                  >
                    {m.label || m.value}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </ScrollView>

          <View style={styles.fieldRow}>
            <View style={styles.fieldHalf}>
              <Text style={styles.label}>{t(`${NS}.temperature`)}</Text>
              <TextInput
                style={styles.input}
                value={temperature}
                onChangeText={(v) => onField('temperature', v)}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.fieldHalf}>
              <Text style={styles.label}>{t(`${NS}.maxTokens`)}</Text>
              <TextInput
                style={styles.input}
                value={maxTokens}
                onChangeText={(v) => onField('maxTokens', v)}
                keyboardType="number-pad"
              />
            </View>
          </View>

          <Text style={styles.label}>{t(`${NS}.systemPrompt`)}</Text>
          <TextInput
            style={[styles.input, styles.promptInput]}
            value={systemPrompt}
            onChangeText={(v) => onField('systemPrompt', v)}
            placeholder={t(`${NS}.systemPromptPlaceholder`)}
            placeholderTextColor={tk.text.tertiary}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.cancelBtn, saving ? styles.dimBtn : null]}
              onPress={onBack}
              disabled={saving}
              accessibilityRole="button"
            >
              <Text style={styles.cancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, saving ? styles.dimBtn : null]}
              onPress={onSubmit}
              disabled={saving}
              accessibilityRole="button"
            >
              {saving ? (
                <ActivityIndicator size="small" color={tk.surface.light} />
              ) : null}
              <Text style={styles.saveText}>{saving ? t(`${NS}.saving`) : t('common.save')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.md,
      paddingHorizontal: rnSpacing.md,
      marginTop: rnSpacing.md,
    },
    titleBox: { flex: 1 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
    title: { fontSize: 22, fontWeight: '600', color: tk.text.primary },
    subtitle: { marginTop: 2, fontSize: rnType.label.size, color: tk.text.secondary },
    loginHint: { marginTop: rnSpacing.xl, fontSize: rnType.body.size, color: tk.text.secondary },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: rnSpacing.md, paddingVertical: rnSpacing.lg },
    label: {
      marginTop: rnSpacing.lg,
      marginBottom: rnSpacing.sm,
      fontSize: rnType.label.size,
      fontWeight: '500',
      color: tk.text.secondary,
    },
    chipScroll: { flexGrow: 0 },
    chipRow: { gap: rnSpacing.sm, paddingVertical: rnSpacing.xs },
    chip: {
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
      borderRadius: rnRadius.xl,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
    },
    chipSelected: { borderColor: tk.brand.DEFAULT, backgroundColor: tk.surface.muted },
    chipText: { fontSize: rnType.caption.size, color: tk.text.medium, maxWidth: 180 },
    chipTextSelected: { color: tk.brand.DEFAULT, fontWeight: '600' },
    fieldRow: { flexDirection: 'row', gap: rnSpacing.md },
    fieldHalf: { flex: 1 },
    input: {
      borderWidth: 1,
      borderColor: tk.border.light,
      borderRadius: rnRadius.md,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
      fontSize: rnType.body.size,
      color: tk.text.primary,
      backgroundColor: tk.surface.light,
    },
    promptInput: { minHeight: 120, paddingTop: rnSpacing.md },
    error: {
      marginTop: rnSpacing.lg,
      fontSize: rnType.body.size,
      color: tk.danger.DEFAULT,
    },
    actionRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: rnSpacing.sm,
      marginTop: rnSpacing.xl,
      marginBottom: rnSpacing['2xl'],
    },
    dimBtn: { opacity: 0.5 },
    cancelBtn: {
      paddingHorizontal: rnSpacing.lg,
      paddingVertical: rnSpacing.md,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    cancelText: { fontSize: rnType.body.size, color: tk.text.medium },
    saveBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
      paddingHorizontal: rnSpacing.lg,
      paddingVertical: rnSpacing.md,
      borderRadius: rnRadius.md,
      backgroundColor: tk.brand.cta,
    },
    saveText: { fontSize: rnType.body.size, fontWeight: '600', color: tk.surface.light },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
