// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { Check, CheckCircle2, Copy, History, Mic, Wand2, XCircle } from 'lucide-react-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import type { TFunction } from '../../types'
import { getTokens, type AppThemeMode, type AppThemeTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'
import { ErrorState } from '../../components/ScreenStates'

const NS = 'selfMedia.kouboPage'

/** 正在跑的动作(与 web running 状态同值,page.tsx:61) */
export type KouboRunningOp = 'generate' | 'validate' | 'all' | null

export interface KouboArticleView {
  index: number
  content: string
}

/** 运行结果展示模型(数字/时长文案由薄壳格式化后注入) */
export interface KouboResultView {
  ok: boolean
  /** 如 "rc=0",空串不渲染 */
  returnCodeText: string
  /** 如 "1.2s",空串不渲染 */
  durationText: string
  /** 如 "8 篇",空串不渲染 */
  articlesCountText: string
  guide: string
  error: string
  outputPath: string
  articles: KouboArticleView[]
  displayOutput: string
  stdout: string
  stderr: string
}

export interface KouboHistoryRowView {
  id: string
  title: string
  status: string
  /** 如 "10-27",空串不渲染 */
  timeText: string
}

export interface SelfMediaKouboScreenProps {
  t: TFunction
  colorScheme: AppThemeMode
  onBack: () => void
  /** 非空即登录门(与 web useAuthGate 同口径) */
  loginRequiredText: string
  /** 历史加载中 */
  loading: boolean
  /** 历史加载失败(非空渲染错误态 + 重试) */
  error: string | null
  date: string
  topic: string
  filePath: string
  onDateChange: (text: string) => void
  onTopicChange: (text: string) => void
  onFilePathChange: (text: string) => void
  running: KouboRunningOp
  result: KouboResultView | null
  copiedIndex: number | null
  onCopyArticle: (index: number, content: string) => void
  onDownloadAll: () => void
  onGenerate: () => void
  onValidate: () => void
  onRunAll: () => void
  history: KouboHistoryRowView[]
  onApplyHistory: (row: KouboHistoryRowView) => void
  onRetry: () => void
}

/**
 * 口播稿流水线共享屏 —— 承载 web /self-media/koubo。
 *
 * 覆盖:表单(日期 MMDD / 选题方向 / 口播稿路径)、三动作(生成引导 / 双门禁验证 / 一键流水线)、
 * 运行结果(成功失败徽章 + rc/耗时/篇数 + guide + 错误 + 8 篇稿件逐篇复制 + 全量导出 +
 * displayOutput/stdout/stderr)、历史记录(点击复用参数)。
 *
 * 与 web 的口径差(如实登记):
 * - web「下载全部」用 Blob+a.click(page.tsx:176-188),RN 无该能力,改由薄壳注入系统分享/写文件;
 * - web 逐篇「复制」用 navigator.clipboard(:166-174),RN 由薄壳注入 Clipboard;
 * - 时间格式化(历史项 createdAt)与错误文案由薄壳注入,本文件不碰平台 API。
 */
export function SelfMediaKouboScreen({
  t,
  colorScheme,
  onBack,
  loginRequiredText,
  loading,
  error,
  date,
  topic,
  filePath,
  onDateChange,
  onTopicChange,
  onFilePathChange,
  running,
  result,
  copiedIndex,
  onCopyArticle,
  onDownloadAll,
  onGenerate,
  onValidate,
  onRunAll,
  history,
  onApplyHistory,
  onRetry,
}: SelfMediaKouboScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  const busy = running !== null
  const dateValid = /^\d{4}$/.test(date)

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.headerTitle}>{t('selfMedia.koubo')}</Text>
      </View>

      {loginRequiredText ? (
        <Text style={styles.loginHint}>{loginRequiredText}</Text>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* 表单 */}
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <Mic size={15} color={tk.text.secondary} />
              <Text style={styles.cardTitle}>{t(`${NS}.formTitle`)}</Text>
            </View>

            <View style={styles.fieldRow}>
              <View style={styles.fieldCol}>
                <Text style={styles.fieldLabel}>{t(`${NS}.dateLabel`)}</Text>
                <TextInput
                  style={styles.input}
                  value={date}
                  onChangeText={onDateChange}
                  placeholder="0720"
                  placeholderTextColor={tk.text.tertiary}
                  maxLength={4}
                  keyboardType="number-pad"
                  editable={!busy}
                />
              </View>
              <View style={styles.fieldCol}>
                <Text style={styles.fieldLabel}>{t(`${NS}.topicLabel`)}</Text>
                <TextInput
                  style={styles.input}
                  value={topic}
                  onChangeText={onTopicChange}
                  placeholder={t(`${NS}.topicPlaceholder`)}
                  placeholderTextColor={tk.text.tertiary}
                  editable={!busy}
                />
              </View>
            </View>

            <View>
              <Text style={styles.fieldLabel}>{t(`${NS}.filePathLabel`)}</Text>
              <TextInput
                style={styles.input}
                value={filePath}
                onChangeText={onFilePathChange}
                placeholder={t(`${NS}.filePathPlaceholder`)}
                placeholderTextColor={tk.text.tertiary}
                editable={!busy}
              />
              {result?.outputPath ? (
                <Text style={styles.hintText}>
                  {t(`${NS}.latestOutput`)} {result.outputPath}
                </Text>
              ) : null}
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.primaryBtn, !dateValid || busy ? styles.btnDisabled : null]}
                onPress={onGenerate}
                disabled={!dateValid || busy}
                accessibilityRole="button"
              >
                {running === 'generate' || running === 'all' ? (
                  <ActivityIndicator size="small" color={tk.brand.ctaForeground} />
                ) : (
                  <Mic size={14} color={tk.brand.ctaForeground} />
                )}
                <Text style={styles.primaryBtnText}>{t(`${NS}.generate`)}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.outlineBtn, !filePath || busy ? styles.btnDisabled : null]}
                onPress={onValidate}
                disabled={!filePath || busy}
                accessibilityRole="button"
              >
                {running === 'validate' ? (
                  <ActivityIndicator size="small" color={tk.text.secondary} />
                ) : (
                  <CheckCircle2 size={14} color={tk.text.secondary} />
                )}
                <Text style={styles.outlineBtnText}>{t(`${NS}.validate`)}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.secondaryBtn, !dateValid || busy ? styles.btnDisabled : null]}
                onPress={onRunAll}
                disabled={!dateValid || busy}
                accessibilityRole="button"
              >
                {running === 'all' ? (
                  <ActivityIndicator size="small" color={tk.brand.DEFAULT} />
                ) : (
                  <Wand2 size={14} color={tk.brand.DEFAULT} />
                )}
                <Text style={styles.secondaryBtnText}>{t(`${NS}.pipeline`)}</Text>
              </TouchableOpacity>
            </View>

            {running === 'all' ? (
              <Text style={styles.hintText}>{t(`${NS}.pipelineRunning`)}</Text>
            ) : null}
          </View>

          {/* 运行结果 */}
          {result ? (
            <View style={styles.card}>
              <View style={styles.cardHeadBetween}>
                <Text style={styles.cardTitle}>{t(`${NS}.resultTitle`)}</Text>
                {result.articles.length > 0 ? (
                  <TouchableOpacity
                    style={styles.ghostBtn}
                    onPress={onDownloadAll}
                    accessibilityRole="button"
                  >
                    <Copy size={12} color={tk.text.secondary} />
                    <Text style={styles.ghostBtnText}>{t(`${NS}.downloadAll`)}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              <View style={styles.resultHeadline}>
                {result.ok ? (
                  <CheckCircle2 size={15} color={tk.success.DEFAULT} />
                ) : (
                  <XCircle size={15} color={tk.danger.DEFAULT} />
                )}
                <Text style={result.ok ? styles.okText : styles.failText}>
                  {result.ok ? t(`${NS}.runSuccess`) : t(`${NS}.runFailed`)}
                </Text>
                {result.returnCodeText ? (
                  <Text style={styles.metaText}>{result.returnCodeText}</Text>
                ) : null}
                {result.durationText ? (
                  <Text style={styles.metaText}>· {result.durationText}</Text>
                ) : null}
                {result.articlesCountText ? (
                  <Text style={styles.metaText}>· {result.articlesCountText}</Text>
                ) : null}
              </View>

              {result.guide ? <Text style={styles.guideText}>{result.guide}</Text> : null}
              {result.error ? <Text style={styles.errorBox}>{result.error}</Text> : null}

              {result.articles.map((a) => (
                <View key={a.index} style={styles.articleCard}>
                  <View style={styles.articleHead}>
                    <Text style={styles.articleTitle}>
                      {t(`${NS}.articleNumber`, { n: a.index })}
                    </Text>
                    <TouchableOpacity
                      style={styles.ghostBtn}
                      onPress={() => onCopyArticle(a.index, a.content)}
                      accessibilityRole="button"
                    >
                      {copiedIndex === a.index ? (
                        <Check size={12} color={tk.success.DEFAULT} />
                      ) : (
                        <Copy size={12} color={tk.text.secondary} />
                      )}
                      <Text style={styles.ghostBtnText}>
                        {copiedIndex === a.index ? t(`${NS}.copied`) : t(`${NS}.copy`)}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.articleBody}>{a.content}</Text>
                </View>
              ))}

              {result.displayOutput ? (
                <Text style={styles.monoBox}>{result.displayOutput}</Text>
              ) : null}
              {result.stdout ? <Text style={styles.monoBox}>{result.stdout}</Text> : null}
              {result.stderr ? <Text style={styles.stderrBox}>{result.stderr}</Text> : null}
            </View>
          ) : null}

          {/* 历史记录 */}
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <History size={15} color={tk.text.secondary} />
              <Text style={styles.cardTitle}>{t(`${NS}.historyTitle`)}</Text>
            </View>
            {loading ? (
              <View style={styles.stateBlock}>
                <ActivityIndicator size="small" color={tk.brand.DEFAULT} />
                <Text style={styles.hintText}>{t('common.loading')}</Text>
              </View>
            ) : error ? (
              <ErrorState
                message={error}
                onRetry={onRetry}
                retryLabel={t('common.retry')}
                colorScheme={colorScheme}
              />
            ) : history.length === 0 ? (
              <Text style={styles.historyEmpty}>{t(`${NS}.historyEmpty`)}</Text>
            ) : (
              history.map((row) => (
                <TouchableOpacity
                  key={row.id}
                  style={styles.historyRow}
                  onPress={() => onApplyHistory(row)}
                  accessibilityRole="button"
                  accessibilityLabel={t(`${NS}.historyItemHint`)}
                >
                  <Text style={styles.historyTitle} numberOfLines={1}>
                    {row.title}
                  </Text>
                  <View style={styles.historyMetaRow}>
                    <Text
                      style={
                        row.status === 'published'
                          ? styles.metaOk
                          : row.status === 'failed'
                            ? styles.failText
                            : styles.metaMuted
                      }
                    >
                      {row.status}
                    </Text>
                    {row.timeText ? (
                      <Text style={styles.metaMuted}>· {row.timeText}</Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
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
    scrollContent: { paddingBottom: rnSpacing['2xl'], gap: rnSpacing.md },
    card: {
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
      padding: rnSpacing.md,
      gap: rnSpacing.sm,
    },
    cardHead: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.xs },
    cardHeadBetween: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: rnSpacing.sm,
    },
    cardTitle: { fontSize: rnType.label.size, fontWeight: '600', color: tk.text.primary },
    fieldRow: { flexDirection: 'row', gap: rnSpacing.sm },
    fieldCol: { flex: 1, gap: 4 },
    fieldLabel: { fontSize: rnType.caption.size, color: tk.text.secondary },
    input: {
      height: 36,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.light,
      paddingHorizontal: rnSpacing.sm,
      fontSize: rnType.body.size,
      color: tk.text.primary,
    },
    hintText: { marginTop: 4, fontSize: rnType.caption.size, color: tk.text.tertiary },
    actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: rnSpacing.sm, marginTop: 2 },
    primaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: 7,
    },
    primaryBtnText: { fontSize: rnType.caption.size, color: tk.brand.ctaForeground },
    outlineBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.medium,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: 7,
    },
    outlineBtnText: { fontSize: rnType.caption.size, color: tk.text.secondary },
    secondaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.surface.muted,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: 7,
    },
    secondaryBtnText: { fontSize: rnType.caption.size, color: tk.brand.DEFAULT },
    ghostBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderRadius: rnRadius.sm,
      paddingHorizontal: rnSpacing.xs,
      paddingVertical: 3,
    },
    ghostBtnText: { fontSize: rnType.caption.size, color: tk.text.secondary },
    btnDisabled: { opacity: 0.5 },
    resultHeadline: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 },
    okText: { fontSize: rnType.label.size, fontWeight: '600', color: tk.success.DEFAULT },
    failText: { fontSize: rnType.label.size, fontWeight: '600', color: tk.danger.DEFAULT },
    metaText: { fontSize: rnType.caption.size, color: tk.text.tertiary },
    metaMuted: { fontSize: rnType.caption.size, color: tk.text.tertiary },
    metaOk: { fontSize: rnType.caption.size, color: tk.success.DEFAULT },
    guideText: {
      borderRadius: rnRadius.sm,
      backgroundColor: tk.surface.muted,
      padding: 6,
      fontSize: rnType.caption.size,
      color: tk.text.secondary,
    },
    errorBox: {
      borderRadius: rnRadius.sm,
      backgroundColor: tk.surface.muted,
      padding: 6,
      fontSize: rnType.caption.size,
      color: tk.danger.DEFAULT,
    },
    articleCard: {
      gap: 4,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tk.border.light,
      padding: rnSpacing.sm,
    },
    articleHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: rnSpacing.sm,
    },
    articleTitle: { fontSize: rnType.caption.size, fontWeight: '600', color: tk.text.primary },
    articleBody: { fontSize: rnType.caption.size, lineHeight: 18, color: tk.text.secondary },
    monoBox: {
      maxHeight: 200,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.surface.muted,
      padding: 6,
      fontSize: 10,
      lineHeight: 15,
      color: tk.text.secondary,
    },
    stderrBox: {
      maxHeight: 140,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.surface.muted,
      padding: 6,
      fontSize: 10,
      lineHeight: 15,
      color: tk.warning.DEFAULT,
    },
    stateBlock: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.xs,
      paddingVertical: rnSpacing.md,
    },
    historyEmpty: {
      paddingVertical: rnSpacing.md,
      fontSize: rnType.caption.size,
      color: tk.text.secondary,
    },
    historyRow: { gap: 2, paddingVertical: rnSpacing.xs },
    historyTitle: { fontSize: rnType.caption.size, fontWeight: '600', color: tk.text.primary },
    historyMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  } satisfies Record<string, ViewStyle | TextStyle>)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
