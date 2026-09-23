// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import { rnRadius } from '@ihui/design-tokens'

import { useMemo } from 'react'
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import type { TFunction } from '@ihui/types'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'

/**
 * KnowledgeCreateScreen 知识库新建(共享层)props 契约。
 * 平台无关:ingestKnowledgeText 提交流、Alert 反馈、导航由 wrapper 注入。
 */
export interface KnowledgeCreateScreenProps {
  t: TFunction
  /** 文档标题(受控值) */
  title: string
  /** 标题变更 */
  onTitleChange: (value: string) => void
  /** 正文文本(受控值) */
  text: string
  /** 正文变更 */
  onTextChange: (value: string) => void
  /** 提交中(右上角提交按钮禁用) */
  submitting: boolean
  /** 提交(必填校验 + ingestKnowledgeText + Alert 由 wrapper 处理) */
  onSubmit: () => void
  /** 顶部返回 */
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/**
 * KnowledgeCreateScreen 知识库新建(共享层)
 *
 * 2026-09-15 承接 mobile-rn KnowledgeCreateScreen 1:1 迁移(文本入库):
 * - 结构:顶部导航行(返回/标题/提交)→ 标题输入(≤200 字)+ 正文多行输入(≥220dp)+ 提示
 * - 平台无关:ingestKnowledgeText 提交、Alert 成功/失败反馈、导航由 wrapper 注入
 * - 样式:getTokens(colorScheme) 语义 token(零 hex),对齐原屏 tailwind 间距(dp)
 * - i18n:沿用 knowledgeCreate. 与 common.(mobile-rn i18n 既有 key)
 */
export function KnowledgeCreateScreen({
  t,
  title,
  onTitleChange,
  text,
  onTextChange,
  submitting,
  onSubmit,
  onBack,
  colorScheme = 'light',
}: KnowledgeCreateScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  const placeholderColor = colorScheme === 'dark' ? tk.text.secondary : tk.text.tertiary

  return (
    <View style={styles.container}>
      {/* 顶部导航行:返回 / 标题 / 提交(校验与请求由 wrapper 的 onSubmit 处理) */}
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.titleText}>{t('knowledgeCreate.title')}</Text>
        <TouchableOpacity
          onPress={onSubmit}
          disabled={submitting}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.submitText}>{t('knowledgeCreate.submit')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>{t('knowledgeCreate.titleLabel')}</Text>
        <TextInput
          value={title}
          onChangeText={onTitleChange}
          placeholder={t('knowledgeCreate.titlePlaceholder')}
          placeholderTextColor={placeholderColor}
          maxLength={200}
          style={[styles.input, styles.titleInput]}
        />
        <Text style={styles.label}>{t('knowledgeCreate.textLabel')}</Text>
        <TextInput
          value={text}
          onChangeText={onTextChange}
          placeholder={t('knowledgeCreate.textPlaceholder')}
          placeholderTextColor={placeholderColor}
          multiline
          textAlignVertical="top"
          style={[styles.input, styles.textInput]}
        />
        <Text style={styles.hint}>{t('knowledgeCreate.hint')}</Text>
      </ScrollView>
    </View>
  )
}

/**
 * 样式:对齐原 RN nativewind 布局(px-4/pt-2/mb-4/min-h-220px/text-sm 等),
 * 全部颜色走 AppThemeTokens 语义 token,零 hex。
 */
function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: tk.surface.bg,
    },
    /* 顶部导航行 */
    headerBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 8,
    },
    backText: {
      fontSize: 14,
      color: tk.text.secondary,
    },
    titleText: {
      fontSize: 16,
      fontWeight: '500',
      color: tk.text.primary,
    },
    submitText: {
      fontSize: 14,
      fontWeight: '500',
      color: tk.brandAccent.deep,
    },
    /* 表单 */
    scroll: {
      flex: 1,
      paddingHorizontal: 16,
      paddingTop: 8,
    },
    label: {
      marginBottom: 6,
      fontSize: 14,
      color: tk.text.medium,
    },
    input: {
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tk.border.medium,
      backgroundColor: tk.surface.card,
      padding: 12,
      fontSize: 16,
      color: tk.text.primary,
    },
    titleInput: {
      marginBottom: 16,
    },
    textInput: {
      minHeight: 220,
      textAlignVertical: 'top',
    },
    hint: {
      marginTop: 8,
      fontSize: 12,
      color: tk.text.tertiary,
    },
  } satisfies Record<string, ViewStyle | TextStyle>)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
