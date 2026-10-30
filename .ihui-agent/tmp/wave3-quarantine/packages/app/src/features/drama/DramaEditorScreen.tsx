// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { PenLine, Sparkles } from 'lucide-react-native'
import { rnRadius } from '@ihui/design-tokens'

import type { TFunction } from '../../types'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'
import { TextField } from '../../components/TextField'

/**
 * 单行改写结果(与 packages/api-client/src/endpoints/drama.ts 的 DramaLineRewrite 同形;
 * 共享层独立声明不依赖 api-client,先例见 features/tools/ToolsScreen.tsx 的 ToolRow)。
 */
export interface DramaLineRewriteResult {
  original: string
  rewritten: string
}

/**
 * 整体增强结果的渲染视图。字段名与后端 data 载荷逐字一致,类型收口到本屏用到的形态:
 * consistency ← ConsistencyIssue[].message(plot-advisor-service.ts:86-90,后端生成文案,前端不翻译);
 * pacingScore/pacingSuggestions ← PacingAnalysis.score/suggestions(同文件:208-213);
 * outline ← outline: string[](同文件:307-310)。
 * byType 分桶 web 侧只随 JSON 整块打出、无现成标签可抄,故不渲染(见 ledger note)。
 */
export interface DramaEnhanceViewModel {
  consistency: string[]
  pacingScore: number | null
  pacingSuggestions: string[]
  outline: string[]
}

export interface DramaEditorScreenProps {
  t: TFunction
  colorScheme: 'light' | 'dark'
  onBack: () => void
  /** 整体增强表单 */
  scriptId: string
  scriptTitle: string
  onScriptIdChange: (value: string) => void
  onScriptTitleChange: (value: string) => void
  enhancing: boolean
  enhanceError: string | null
  enhanceResult: DramaEnhanceViewModel | null
  onEnhance: () => void
  /** 单行改写表单 */
  lineScriptId: string
  sceneIndex: string
  lineIndex: string
  content: string
  instruction: string
  onLineScriptIdChange: (value: string) => void
  onSceneIndexChange: (value: string) => void
  onLineIndexChange: (value: string) => void
  onContentChange: (value: string) => void
  onInstructionChange: (value: string) => void
  rewriting: boolean
  rewriteError: string | null
  rewriteResult: DramaLineRewriteResult | null
  onRewrite: () => void
}

/**
 * 短剧编辑器共享屏(Wave3 2026-10-26,drama 域;对齐 web apps/web/app/(main)/drama/page.tsx)。
 *
 * web 页面族只有 1 枚 page.tsx、两张卡片表单(整体增强 / 单行改写),RN 端零承载 ⇒ 本域为新建。
 * 屏结构逐区对齐:页头返回 + 标题/副题 + 「整体增强」卡 + 「单行改写」卡。
 * 输入区与 web 同形 = **无独立标签、靠 placeholder 认领**(web 原页即如此),
 * 因此本屏零自造文案:标题/按钮/占位/错误全取 web drama.editor.*,空态取既有 common.empty。
 * 结果区与 web 的唯一差异:web 把三块结果整块 JSON.stringify 打屏,本屏按后端真实类型分行渲染,
 * 语义等价、不新增文案。
 *
 * 状态与取数一律在平台薄壳(受控表单 + busy/error/result),本屏零业务判断。
 */
export function DramaEditorScreen({
  t,
  colorScheme,
  onBack,
  scriptId,
  scriptTitle,
  onScriptIdChange,
  onScriptTitleChange,
  enhancing,
  enhanceError,
  enhanceResult,
  onEnhance,
  lineScriptId,
  sceneIndex,
  lineIndex,
  content,
  instruction,
  onLineScriptIdChange,
  onSceneIndexChange,
  onLineIndexChange,
  onContentChange,
  onInstructionChange,
  rewriting,
  rewriteError,
  rewriteResult,
  onRewrite,
}: DramaEditorScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  const ctaForeground = tk.brand.ctaForeground

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} colorScheme={colorScheme} />
        <View style={styles.headerTitleBlock}>
          <View style={styles.titleRow}>
            <Sparkles size={18} color={tk.brand.DEFAULT} />
            <Text style={styles.title}>{t('dramaPage.title')}</Text>
          </View>
          <Text style={styles.subtitle}>{t('dramaPage.subtitle')}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* ── 整体增强(web page.tsx:105-161)─────────────────────── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Sparkles size={16} color={tk.brand.DEFAULT} />
            <Text style={styles.cardTitle}>{t('dramaPage.enhanceTitle')}</Text>
          </View>

          <TextField
            colorScheme={colorScheme}
            style={styles.input}
            value={scriptId}
            onChangeText={onScriptIdChange}
            placeholder={t('dramaPage.enhanceScriptIdPlaceholder')}
            placeholderTextColor={tk.text.tertiary}
            autoCapitalize="none"
          />
          <TextField
            colorScheme={colorScheme}
            style={styles.input}
            value={scriptTitle}
            onChangeText={onScriptTitleChange}
            placeholder={t('dramaPage.enhanceTitlePlaceholder')}
            placeholderTextColor={tk.text.tertiary}
          />

          <SubmitRow
            styles={styles}
            busy={enhancing}
            iconColor={ctaForeground}
            label={t('dramaPage.enhanceSubmit')}
            onPress={onEnhance}
            Icon={Sparkles}
          />

          {enhanceError ? <Text style={styles.error}>{enhanceError}</Text> : null}

          {enhanceResult ? (
            <View style={styles.resultBox}>
              <ResultLines
                styles={styles}
                label={t('dramaPage.resultConsistency')}
                lines={enhanceResult.consistency}
              />
              {enhanceResult.pacingScore !== null || enhanceResult.pacingSuggestions.length > 0 ? (
                <View style={styles.field}>
                  <Text style={styles.resultLabel}>{t('dramaPage.resultPacing')}</Text>
                  {enhanceResult.pacingScore !== null ? (
                    <Text style={styles.scoreText}>{String(enhanceResult.pacingScore)}</Text>
                  ) : null}
                  {enhanceResult.pacingSuggestions.map((line, i) => (
                    <Text key={`pacing-${i}`} style={styles.bullet}>
                      {line}
                    </Text>
                  ))}
                </View>
              ) : null}
              <ResultLines
                styles={styles}
                label={t('dramaPage.resultOutline')}
                lines={enhanceResult.outline}
              />
            </View>
          ) : enhancing || enhanceError ? null : (
            <Text style={styles.empty}>{t('common.empty')}</Text>
          )}
        </View>

        {/* ── 单行改写(web page.tsx:163-233)──────────────────────── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <PenLine size={16} color={tk.brand.DEFAULT} />
            <Text style={styles.cardTitle}>{t('dramaPage.lineRewriteTitle')}</Text>
          </View>

          <TextField
            colorScheme={colorScheme}
            style={styles.input}
            value={lineScriptId}
            onChangeText={onLineScriptIdChange}
            placeholder={t('dramaPage.lineScriptIdPlaceholder')}
            placeholderTextColor={tk.text.tertiary}
            autoCapitalize="none"
          />

          <View style={styles.row}>
            <TextField
              colorScheme={colorScheme}
              style={[styles.input, styles.fieldHalf]}
              value={sceneIndex}
              onChangeText={onSceneIndexChange}
              placeholder={t('dramaPage.scenePlaceholder')}
              placeholderTextColor={tk.text.tertiary}
              keyboardType="number-pad"
            />
            <TextField
              colorScheme={colorScheme}
              style={[styles.input, styles.fieldHalf]}
              value={lineIndex}
              onChangeText={onLineIndexChange}
              placeholder={t('dramaPage.linePlaceholder')}
              placeholderTextColor={tk.text.tertiary}
              keyboardType="number-pad"
            />
          </View>

          <TextField
            colorScheme={colorScheme}
            style={styles.textarea}
            value={content}
            onChangeText={onContentChange}
            placeholder={t('dramaPage.contentPlaceholder')}
            placeholderTextColor={tk.text.tertiary}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
          <TextField
            colorScheme={colorScheme}
            style={styles.input}
            value={instruction}
            onChangeText={onInstructionChange}
            placeholder={t('dramaPage.instructionPlaceholder')}
            placeholderTextColor={tk.text.tertiary}
          />

          <SubmitRow
            styles={styles}
            busy={rewriting}
            iconColor={ctaForeground}
            label={t('dramaPage.lineRewriteSubmit')}
            onPress={onRewrite}
            Icon={PenLine}
          />

          {rewriteError ? <Text style={styles.error}>{rewriteError}</Text> : null}

          {rewriteResult ? (
            <View style={styles.resultBox}>
              <View style={styles.field}>
                <Text style={styles.mutedLabel}>{t('dramaPage.originalLabel')}</Text>
                <Text style={styles.bodyText}>{rewriteResult.original}</Text>
              </View>
              <View style={styles.field}>
                <Text style={styles.accentLabel}>{t('dramaPage.rewrittenLabel')}</Text>
                <Text style={styles.bodyText}>{rewriteResult.rewritten}</Text>
              </View>
            </View>
          ) : rewriting || rewriteError ? null : (
            <Text style={styles.empty}>{t('common.empty')}</Text>
          )}
        </View>
      </ScrollView>
    </View>
  )
}

type DramaStyles = ReturnType<typeof createStyles>

interface ResultLinesProps {
  styles: DramaStyles
  label: string
  lines: string[]
}

/** 一组「标题 + 逐行文本」的结果区;空数组整块不渲染(web 打的是 `[]`,此处不留空框)。 */
function ResultLines({ styles, label, lines }: ResultLinesProps) {
  if (lines.length === 0) return null
  return (
    <View style={styles.field}>
      <Text style={styles.resultLabel}>{label}</Text>
      {lines.map((line, i) => (
        <Text key={`${label}-${i}`} style={styles.bullet}>
          {line}
        </Text>
      ))}
    </View>
  )
}

interface SubmitRowProps {
  styles: DramaStyles
  busy: boolean
  iconColor: string
  label: string
  onPress: () => void
  Icon: typeof Sparkles
}

/** 提交行:忙态转圈替代图标(web 的 Loader2 ↔ Sparkles/PenLine 同一条替换规则)。 */
function SubmitRow({ styles, busy, iconColor, label, onPress, Icon }: SubmitRowProps) {
  return (
    <TouchableOpacity
      style={[styles.cta, busy ? styles.ctaDisabled : null]}
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
    >
      {busy ? (
        <ActivityIndicator size="small" color={iconColor} />
      ) : (
        <Icon size={15} color={iconColor} />
      )}
      <Text style={styles.ctaText}>{label}</Text>
    </TouchableOpacity>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingTop: 12,
      paddingBottom: 4,
      gap: 8,
    },
    headerTitleBlock: { flex: 1, gap: 2 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    title: { fontSize: 18, fontWeight: '700', color: tk.text.primary },
    subtitle: { fontSize: 12, color: tk.text.secondary },
    scroll: { padding: 12, paddingBottom: 40, gap: 10 },
    card: {
      backgroundColor: tk.surface.card,
      borderRadius: rnRadius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.light,
      padding: 12,
      gap: 10,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    cardTitle: { fontSize: 15, fontWeight: '700', color: tk.text.primary },
    row: { flexDirection: 'row', gap: 10 },
    field: { gap: 4 },
    fieldHalf: { flex: 1 },
    input: {
      minHeight: 36,
      paddingHorizontal: 10,
      paddingVertical: 8,
      fontSize: 14,
      color: tk.text.primary,
      backgroundColor: tk.surface.inputBg,
      borderRadius: rnRadius.control,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.medium,
    },
    textarea: {
      minHeight: 88,
      paddingHorizontal: 10,
      paddingVertical: 8,
      fontSize: 14,
      color: tk.text.primary,
      backgroundColor: tk.surface.inputBg,
      borderRadius: rnRadius.control,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.medium,
    },
    cta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      minHeight: 36,
      paddingHorizontal: 14,
      borderRadius: rnRadius.control,
      backgroundColor: tk.brand.cta,
    },
    ctaDisabled: { opacity: 0.6 },
    ctaText: { fontSize: 14, fontWeight: '600', color: tk.brand.ctaForeground },
    error: { fontSize: 12, lineHeight: 18, color: tk.danger.DEFAULT },
    empty: { fontSize: 12, color: tk.text.tertiary },
    resultBox: {
      gap: 10,
      padding: 10,
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.light,
    },
    resultLabel: { fontSize: 12, fontWeight: '600', color: tk.text.primary },
    bullet: { fontSize: 12, lineHeight: 18, color: tk.text.secondary },
    scoreText: { fontSize: 20, fontWeight: '700', color: tk.brand.DEFAULT },
    mutedLabel: { fontSize: 12, color: tk.text.secondary },
    accentLabel: { fontSize: 12, fontWeight: '600', color: tk.brand.DEFAULT },
    bodyText: { fontSize: 13, lineHeight: 20, color: tk.text.primary },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
