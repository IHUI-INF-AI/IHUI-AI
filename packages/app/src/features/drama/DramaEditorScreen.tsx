// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { PenLine, Sparkles } from 'lucide-react-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import type { TFunction } from '../../types'
import { getTokens, type AppThemeMode, type AppThemeTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'

const NS = 'dramaEditorPage'

export interface DramaEnhanceResultView {
  /** 角色一致性(web 直接 JSON.stringify 展示,薄壳做同口径预格式化) */
  consistency: string
  /** 节奏分析 */
  pacing: string
  /** 章节大纲 */
  outline: string
}

export interface DramaLineResultView {
  original: string
  rewritten: string
}

export interface DramaEditorScreenProps {
  t: TFunction
  colorScheme: AppThemeMode
  onBack: () => void

  /** 整体增强表单 */
  scriptId: string
  onScriptIdChange: (value: string) => void
  title: string
  onTitleChange: (value: string) => void
  enhanceLoading: boolean
  enhanceError: string | null
  enhanceResult: DramaEnhanceResultView | null
  onSubmitEnhance: () => void

  /** 单行改写表单 */
  lineScriptId: string
  onLineScriptIdChange: (value: string) => void
  sceneIndex: string
  onSceneIndexChange: (value: string) => void
  lineIndex: string
  onLineIndexChange: (value: string) => void
  content: string
  onContentChange: (value: string) => void
  instruction: string
  onInstructionChange: (value: string) => void
  lineLoading: boolean
  lineError: string | null
  lineResult: DramaLineResultView | null
  onSubmitLine: () => void
}

/**
 * 短剧编辑器共享屏 —— 承载 web /drama。
 *
 * 后端契约现读:POST /api/drama/scripts/:id/enhance(apps/api/src/routes/drama.ts:35-48)
 * 与 POST /api/drama/scripts/:id/scenes/:sceneIndex/lines/:lineIndex/enhance
 * (同文件 50-107),均 success(...) 信封 + authenticate。
 *
 * 口径差(如实登记):web 用 Card/Button/Alert(@ihui/ui-react),RN 落为卡片 + Pressable
 * 主按钮 + 内联错误文本;web 三个 JSON.stringify(…, null, 2) 的 <pre> 展示改由薄壳预格式化成
 * 字符串后交本屏 Text 呈现(平台无关:取数 / 校验 / 提交全在薄壳,本文件只管渲染与三态)。
 */
export function DramaEditorScreen({
  t,
  colorScheme,
  onBack,
  scriptId,
  onScriptIdChange,
  title,
  onTitleChange,
  enhanceLoading,
  enhanceError,
  enhanceResult,
  onSubmitEnhance,
  lineScriptId,
  onLineScriptIdChange,
  sceneIndex,
  onSceneIndexChange,
  lineIndex,
  onLineIndexChange,
  content,
  onContentChange,
  instruction,
  onInstructionChange,
  lineLoading,
  lineError,
  lineResult,
  onSubmitLine,
}: DramaEditorScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  const inputStyle = [styles.input, { color: tk.text.primary }]

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <View style={styles.titleBox}>
          <View style={styles.titleRow}>
            <Sparkles size={20} color={tk.brand.DEFAULT} />
            <Text style={styles.title}>{t(`${NS}.title`)}</Text>
          </View>
          <Text style={styles.subtitle}>{t(`${NS}.subtitle`)}</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Sparkles size={16} color={tk.text.primary} />
            <Text style={styles.cardTitle}>{t(`${NS}.enhanceTitle`)}</Text>
          </View>

          <TextInput
            style={inputStyle}
            placeholder={t(`${NS}.enhanceScriptIdPlaceholder`)}
            placeholderTextColor={tk.text.tertiary}
            value={scriptId}
            onChangeText={onScriptIdChange}
            autoCapitalize="none"
          />
          <TextInput
            style={inputStyle}
            placeholder={t(`${NS}.enhanceTitlePlaceholder`)}
            placeholderTextColor={tk.text.tertiary}
            value={title}
            onChangeText={onTitleChange}
          />

          <Pressable
            style={[styles.submitBtn, enhanceLoading ? styles.submitBtnBusy : null]}
            onPress={onSubmitEnhance}
            disabled={enhanceLoading}
          >
            {enhanceLoading ? (
              <ActivityIndicator size="small" color={tk.brand.foreground} />
            ) : (
              <Sparkles size={16} color={tk.brand.foreground} />
            )}
            <Text style={styles.submitText}>{t(`${NS}.enhanceSubmit`)}</Text>
          </Pressable>

          {enhanceError ? <Text style={styles.error}>{enhanceError}</Text> : null}

          {enhanceResult ? (
            <View style={styles.resultBox}>
              <Text style={styles.resultLabel}>{t(`${NS}.consistency`)}</Text>
              <Text style={styles.resultValue}>{enhanceResult.consistency}</Text>
              <Text style={styles.resultLabel}>{t(`${NS}.pacing`)}</Text>
              <Text style={styles.resultValue}>{enhanceResult.pacing}</Text>
              <Text style={styles.resultLabel}>{t(`${NS}.outline`)}</Text>
              <Text style={styles.resultValue}>{enhanceResult.outline}</Text>
            </View>
          ) : !enhanceLoading && !enhanceError ? (
            <Text style={styles.muted}>{t('common.empty')}</Text>
          ) : null}
        </View>

        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <PenLine size={16} color={tk.text.primary} />
            <Text style={styles.cardTitle}>{t(`${NS}.lineTitle`)}</Text>
          </View>

          <TextInput
            style={inputStyle}
            placeholder={t(`${NS}.lineScriptIdPlaceholder`)}
            placeholderTextColor={tk.text.tertiary}
            value={lineScriptId}
            onChangeText={onLineScriptIdChange}
            autoCapitalize="none"
          />
          <View style={styles.indexRow}>
            <TextInput
              style={[inputStyle, styles.indexInput]}
              placeholder={t(`${NS}.scenePlaceholder`)}
              placeholderTextColor={tk.text.tertiary}
              value={sceneIndex}
              onChangeText={onSceneIndexChange}
              keyboardType="number-pad"
            />
            <TextInput
              style={[inputStyle, styles.indexInput]}
              placeholder={t(`${NS}.linePlaceholder`)}
              placeholderTextColor={tk.text.tertiary}
              value={lineIndex}
              onChangeText={onLineIndexChange}
              keyboardType="number-pad"
            />
          </View>
          <TextInput
            style={[inputStyle, styles.textArea]}
            placeholder={t(`${NS}.contentPlaceholder`)}
            placeholderTextColor={tk.text.tertiary}
            value={content}
            onChangeText={onContentChange}
            multiline
          />
          <TextInput
            style={inputStyle}
            placeholder={t(`${NS}.instructionPlaceholder`)}
            placeholderTextColor={tk.text.tertiary}
            value={instruction}
            onChangeText={onInstructionChange}
          />

          <Pressable
            style={[styles.submitBtn, lineLoading ? styles.submitBtnBusy : null]}
            onPress={onSubmitLine}
            disabled={lineLoading}
          >
            {lineLoading ? (
              <ActivityIndicator size="small" color={tk.brand.foreground} />
            ) : (
              <PenLine size={16} color={tk.brand.foreground} />
            )}
            <Text style={styles.submitText}>{t(`${NS}.lineSubmit`)}</Text>
          </Pressable>

          {lineError ? <Text style={styles.error}>{lineError}</Text> : null}

          {lineResult ? (
            <View style={styles.resultBox}>
              <Text style={styles.resultLabel}>{t(`${NS}.original`)}</Text>
              <Text style={styles.resultValue}>{lineResult.original}</Text>
              <Text style={styles.resultLabelAccent}>{t(`${NS}.rewritten`)}</Text>
              <Text style={styles.resultValue}>{lineResult.rewritten}</Text>
            </View>
          ) : !lineLoading && !lineError ? (
            <Text style={styles.muted}>{t('common.empty')}</Text>
          ) : null}
        </View>
      </ScrollView>
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
    subtitle: { marginTop: 2, fontSize: rnType.label.size, color: tk.text.secondary },
    scroll: { flex: 1, marginTop: rnSpacing.md },
    scrollContent: { gap: rnSpacing.md, paddingBottom: rnSpacing['2xl'] },
    card: {
      gap: rnSpacing.sm,
      padding: rnSpacing.md,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
    cardTitle: { fontSize: rnType.body.size, fontWeight: '600', color: tk.text.primary },
    input: {
      minHeight: 38,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tk.border.medium,
      backgroundColor: tk.surface.inputBg,
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: rnSpacing.xs,
      fontSize: rnType.body.size,
    },
    indexRow: { flexDirection: 'row', gap: rnSpacing.sm },
    indexInput: { flex: 1 },
    textArea: { minHeight: 80, textAlignVertical: 'top' },
    submitBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.xs,
      alignSelf: 'flex-start',
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
      borderRadius: rnRadius.md,
      backgroundColor: tk.brand.cta,
    },
    submitBtnBusy: { opacity: 0.6 },
    submitText: { fontSize: rnType.label.size, fontWeight: '600', color: tk.brand.ctaForeground },
    error: { fontSize: rnType.label.size, color: tk.danger.DEFAULT },
    muted: { fontSize: rnType.label.size, color: tk.text.secondary },
    resultBox: {
      gap: 2,
      padding: rnSpacing.sm,
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
    },
    resultLabel: { fontSize: rnType.label.size, fontWeight: '600', color: tk.text.primary },
    resultLabelAccent: { fontSize: rnType.label.size, fontWeight: '600', color: tk.brandAccent.deep },
    resultValue: { fontSize: rnType.caption.size, color: tk.text.medium },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
