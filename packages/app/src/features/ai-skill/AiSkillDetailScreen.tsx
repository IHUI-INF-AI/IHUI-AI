// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'

import { useEffect, useMemo, useState } from 'react'
import { ScrollView, StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native'
import { Star } from 'lucide-react-native'
import { Tappable } from '@ihui/ui-native'
import type { TFunction } from '@ihui/types'
import {
  getLabelKey,
  getMaxLen,
  getPlaceholderKey,
  isLongText,
  parseVariables,
} from '@ihui/shared/utils/ai-skill-variables'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'
import { ErrorState, ScreenSkeleton } from '../../components/ScreenStates'
import { TextField } from '../../components/TextField'

/** AI 技能详情数据(平台无关,由 wrapper 从 AiSkillMeta 映射) */
export interface AiSkillDetailData {
  id: string
  name: string
  description: string
  category: string
  tags: string[]
  promptTemplate: string
  source: string
  sourceUrl: string | null
}

/** 调用结果(仅 text/json;HTML 分支待 T0-5 人工闸门,不做 WebView) */
export interface SkillInvokeResult {
  kind: 'text' | 'json'
  text?: string
  json?: unknown
}

/** 评分汇总(与 api-client 的 RatingStats 结构兼容) */
export interface SkillRatingStats {
  average: number
  total: number
}

/** AiSkillDetailScreen AI 技能详情(共享层)props — 数据/回调/t 由 wrapper 注入 */
export interface AiSkillDetailScreenProps {
  t: TFunction
  /** 顶部标题(原屏取路由参数 name,非接口返回) */
  title: string
  skill: AiSkillDetailData | null
  loading: boolean
  /** 加载失败文案(已由 wrapper 翻译;非空时展示错误态 + 重试) */
  error: string
  onRetry: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
  /** 调用表单的变量值(默认 {});不传 & 不传 onInvoke 时旧行为不变 */
  variables?: Record<string, string>
  onVariableChange?: (key: string, value: string) => void
  /** undefined → 不渲染调用表单 */
  onInvoke?: () => void
  invoking?: boolean
  invokeError?: string
  /** undefined → 不渲染结果区 */
  invokeResult?: SkillInvokeResult
  /** undefined → 不渲染导出入口 */
  onExport?: () => void
  exporting?: boolean
  /** undefined → 不渲染评分提交表单(未登录场景) */
  onRate?: (rating: number, comment?: string) => void
  ratingStats?: SkillRatingStats
  ratingSubmitted?: boolean
  ratingError?: string
  /** 未登录时的评分区提示文案(仅在 onRate 缺失时展示) */
  ratingLoginHint?: string
}

/**
 * AiSkillDetailScreen AI 技能详情(共享层)
 *
 * 2026-09-15 承接 mobile-rn AiSkillDetailScreen 1:1 迁移(M3:展示 prompt 模板与来源):
 * - 结构:顶部导航行(返回/标题)→ 描述 → 分类/标签 chips → Prompt 模板块 → 来源
 * - 三态:加载(居中 Loading)→ 错误(文案 + 重试按钮)→ 详情内容
 * - 平台无关:API(getAiSkill)、导航由 wrapper 注入
 * - 样式:getTokens(colorScheme) 语义 token(零 hex、零 Tailwind class)
 * - i18n:沿用 aiSkillDetail.* 与 common.*(mobile-rn i18n 既有 key)
 */
export function AiSkillDetailScreen({
  t,
  title,
  skill,
  loading,
  error,
  onRetry,
  onBack,
  colorScheme = 'light',
  variables = {},
  onVariableChange,
  onInvoke,
  invoking = false,
  invokeError,
  invokeResult,
  onExport,
  exporting = false,
  onRate,
  ratingStats,
  ratingSubmitted = false,
  ratingError,
  ratingLoginHint,
}: AiSkillDetailScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  const [missing, setMissing] = useState<string[]>([])
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')

  // 切换 skill 时清空本地校验/评分态(不污染下一条详情)
  useEffect(() => {
    setMissing([])
    setRating(0)
    setComment('')
  }, [skill?.id])

  /** 按定义渲染输入框:模板含 {var} 取模板变量,否则回退 content(对齐 web) */
  const inputVars = useMemo(() => {
    const detected = skill ? parseVariables(skill.promptTemplate) : []
    if (detected.length > 0) return detected
    return onInvoke ? ['content'] : []
  }, [skill, onInvoke])

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenSkeleton variant="card" count={3} colorScheme={colorScheme} />
      </View>
    )
  }

  const handleVariableChange = (key: string, value: string) => {
    onVariableChange?.(key, value)
    if (value.trim()) setMissing((prev) => prev.filter((k) => k !== key))
  }

  /** 必填缺失阻断请求:不调用 onInvoke,只标红缺失字段 */
  const handleInvoke = () => {
    const nextMissing = inputVars.filter((key) => !(variables[key] ?? '').trim())
    if (nextMissing.length > 0) {
      setMissing(nextMissing)
      return
    }
    setMissing([])
    onInvoke?.()
  }

  return (
    <View style={styles.container}>
      {/* 顶部导航行:返回 / 标题(路由参数 name)/ 占位 */}
      <View style={styles.headerBar}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.headerSidePlaceholder} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {error ? (
          <ErrorState
            message={error}
            onRetry={onRetry}
            retryLabel={t('aiSkillDetail.retry')}
            colorScheme={colorScheme}
          />
        ) : skill ? (
          <>
            <Text style={styles.description}>{skill.description}</Text>

            {/* 分类 + 标签 chips */}
            <View style={styles.tagRow}>
              <View style={styles.metaChip}>
                <Text style={styles.metaChipText} numberOfLines={1}>
                  {skill.category}
                </Text>
              </View>
              {skill.tags.map((tag) => (
                <View key={tag} style={styles.tagChip}>
                  <Text style={styles.tagText} numberOfLines={1}>
                    {tag}
                  </Text>
                </View>
              ))}
            </View>

            {/* 导出(不传 onExport 时整块不渲染) */}
            {onExport ? (
              <View style={styles.actionRow}>
                <Tappable
                  style={[styles.secondaryBtn, exporting ? styles.btnDisabled : null]}
                  disabled={exporting}
                  onPress={onExport}
                  accessibilityRole="button"
                >
                  <Text style={styles.secondaryBtnText}>
                    {exporting ? t('aiSkillDetail.exporting') : t('aiSkillDetail.export')}
                  </Text>
                </Tappable>
              </View>
            ) : null}

            {/* Prompt 模板 */}
            <Text style={styles.sectionLabel}>{t('aiSkillDetail.prompt')}</Text>
            <View style={styles.promptBox}>
              <Text style={styles.promptText}>
                {skill.promptTemplate || t('aiSkillDetail.noPrompt')}
              </Text>
            </View>

            {/* 来源 */}
            <Text style={styles.sectionLabel}>{t('aiSkillDetail.source')}</Text>
            <Text style={styles.sourceText}>
              {skill.source}
              {skill.sourceUrl ? ` · ${skill.sourceUrl}` : ''}
            </Text>

            {/* 调用区(不传 onInvoke 时不渲染) */}
            {onInvoke ? (
              <>
                <Text style={styles.sectionLabel}>{t('aiSkillDetail.invokeVariables')}</Text>
                {inputVars.map((key) => {
                  const labelKey = `aiSkillDetail.${getLabelKey(key)}`
                  const labelValue = t(labelKey)
                  // mobile-rn 尚未下发变量专属键时,回退到变量名,不把 i18n key 直接炫给用户
                  const label = labelValue === labelKey ? key : labelValue
                  const placeholderKey = `aiSkillDetail.${getPlaceholderKey(key)}`
                  const placeholderValue = t(placeholderKey)
                  const placeholder = placeholderValue === placeholderKey ? '' : placeholderValue
                  const isMissing = missing.includes(key)
                  const long = isLongText(key)
                  return (
                    <View key={key} style={styles.fieldBlock}>
                      <Text
                        style={[styles.fieldLabel, isMissing ? styles.fieldLabelMissing : null]}
                      >
                        {label}
                        {isMissing ? (
                          <Text style={styles.fieldRequired}>
                            {` *${t('aiSkillDetail.invokeRequired')}`}
                          </Text>
                        ) : null}
                      </Text>
                      <TextField
                        colorScheme={colorScheme}
                        value={variables[key] ?? ''}
                        onChangeText={(value) => handleVariableChange(key, value)}
                        placeholder={placeholder}
                        placeholderTextColor={tk.text.tertiary}
                        maxLength={getMaxLen(key)}
                        multiline={long}
                        numberOfLines={long ? 4 : 1}
                        style={[
                          styles.input,
                          long ? styles.inputMultiline : null,
                          isMissing ? styles.inputMissing : null,
                        ]}
                      />
                    </View>
                  )
                })}
                {missing.length > 0 && !invokeError ? (
                  <Text style={styles.errorText}>{t('aiSkillDetail.invokeRequired')}</Text>
                ) : null}
                {invokeError ? <Text style={styles.errorText}>{invokeError}</Text> : null}
                <View style={styles.actionRow}>
                  <Tappable
                    style={[styles.primaryBtn, invoking ? styles.btnDisabled : null]}
                    disabled={invoking}
                    onPress={handleInvoke}
                    accessibilityRole="button"
                  >
                    <Text style={styles.primaryBtnText}>
                      {invoking ? t('aiSkillDetail.invoking') : t('aiSkillDetail.invoke')}
                    </Text>
                  </Tappable>
                </View>
              </>
            ) : null}

            {/* 结果区:纯文本渲染(text/json),不引入 WebView */}
            {invokeResult ? (
              <>
                <Text style={styles.sectionLabel}>{t('aiSkillDetail.invokeResult')}</Text>
                <View style={styles.resultBox}>
                  <Text style={styles.resultText} selectable>
                    {invokeResult.kind === 'json'
                      ? stringifyResult(invokeResult.json, invokeResult.text)
                      : (invokeResult.text ?? '')}
                  </Text>
                </View>
              </>
            ) : null}

            {/* 评分区:有 onRate 才给提交表单;未登录只给提示 */}
            {onRate || ratingStats || ratingLoginHint ? (
              <>
                <Text style={styles.sectionLabel}>{t('aiSkillDetail.rateTitle')}</Text>
                {ratingStats && ratingStats.total > 0 ? (
                  <Text style={styles.ratingSummary}>
                    {`★ ${ratingStats.average.toFixed(1)} · ${ratingStats.total}`}
                  </Text>
                ) : null}
                {onRate ? (
                  ratingSubmitted ? (
                    <Text style={styles.successText}>{t('aiSkillDetail.ratingSubmitted')}</Text>
                  ) : (
                    <>
                      <View style={styles.starRow}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Tappable
                            key={star}
                            style={styles.starBtn}
                            onPress={() => setRating(star)}
                            accessibilityRole="button"
                            accessibilityLabel={`${star}`}
                          >
                            <Star
                              size={22}
                              color={star <= rating ? tk.warning.amber : tk.text.tertiary}
                              fill={star <= rating ? tk.warning.amber : 'transparent'}
                            />
                          </Tappable>
                        ))}
                      </View>
                      <TextField
                        colorScheme={colorScheme}
                        value={comment}
                        onChangeText={setComment}
                        placeholder={t('aiSkillDetail.commentPlaceholder')}
                        placeholderTextColor={tk.text.tertiary}
                        maxLength={500}
                        style={styles.input}
                      />
                      {ratingError ? <Text style={styles.errorText}>{ratingError}</Text> : null}
                      <View style={styles.actionRow}>
                        <Tappable
                          style={[styles.primaryBtn, rating === 0 ? styles.btnDisabled : null]}
                          disabled={rating === 0}
                          onPress={() => onRate(rating, comment.trim() || undefined)}
                          accessibilityRole="button"
                        >
                          <Text style={styles.primaryBtnText}>{t('aiSkillDetail.rateSubmit')}</Text>
                        </Tappable>
                      </View>
                    </>
                  )
                ) : (
                  <Text style={styles.hintText}>
                    {ratingLoginHint ?? t('aiSkillDetail.ratingLoginHint')}
                  </Text>
                )}
              </>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </View>
  )
}

/** JSON 结果 prettify;解析失败时退回原文(纯文本展示) */
function stringifyResult(json: unknown, fallback?: string): string {
  if (json !== undefined) {
    try {
      return JSON.stringify(json, null, 2)
    } catch {
      /* 退回 fallback */
    }
  }
  return fallback ?? ''
}

/**
 * 样式:原屏 NativeWind class 值直译为 dp(NativeWind 1 单位 = 1dp)。
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
      paddingHorizontal: rnSpacing.lg, // px-4
      paddingBottom: rnSpacing.sm, // pb-2
      paddingTop: rnSpacing.md, // pt-3
    },
    headerTitle: {
      fontSize: rnType.title.size, // text-base
      fontWeight: '500', // font-medium
      color: tk.text.primary,
      maxWidth: '60%', // max-w-[60%]
    },
    headerSidePlaceholder: {
      width: 40, // w-10
    },
    /* 滚动区 */
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: rnSpacing.lg, // px-4
      paddingTop: rnSpacing.sm, // pt-2
      paddingBottom: rnSpacing['2xl'],
    },
    /* 详情内容 */
    description: {
      fontSize: rnType.body.size, // text-sm
      lineHeight: 24, // leading-6
      color: tk.text.secondary,
    },
    tagRow: {
      marginTop: rnSpacing.md, // mt-3
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: rnSpacing['xs-loose'], // gap-1.5
    },
    metaChip: {
      borderRadius: rnRadius.md, // rounded-md
      paddingHorizontal: rnSpacing.sm, // px-2
      paddingVertical: rnSpacing.xs, // py-1
      backgroundColor: tk.surface.muted,
    },
    metaChipText: {
      fontSize: rnType.label.size, // text-xs
      color: tk.text.secondary,
    },
    tagChip: {
      borderRadius: rnRadius.md, // rounded-md
      paddingHorizontal: rnSpacing.sm, // px-2
      paddingVertical: rnSpacing.xs, // py-1
      backgroundColor: tk.warning.orangeLight,
    },
    tagText: {
      fontSize: rnType.label.size, // text-xs
      color: tk.warning.amber,
    },
    /* 操作按钮行 */
    actionRow: {
      marginTop: rnSpacing.md,
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: rnSpacing.sm,
    },
    primaryBtn: {
      paddingHorizontal: rnSpacing.lg,
      paddingVertical: rnSpacing.sm,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
    },
    primaryBtnText: {
      fontSize: rnType.body.size,
      fontWeight: '500',
      color: tk.brand.ctaForeground,
    },
    secondaryBtn: {
      paddingHorizontal: rnSpacing.lg,
      paddingVertical: rnSpacing.sm,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
    },
    secondaryBtnText: {
      fontSize: rnType.body.size,
      fontWeight: '500',
      color: tk.text.primary,
    },
    btnDisabled: {
      opacity: 0.5,
    },
    /* 调用表单 */
    fieldBlock: {
      marginBottom: rnSpacing.md,
      gap: rnSpacing.xs,
    },
    fieldLabel: {
      fontSize: rnType.label.size,
      fontWeight: '500',
      color: tk.text.primary,
    },
    fieldLabelMissing: {
      color: tk.error.text,
    },
    fieldRequired: {
      fontSize: rnType.label.size,
      color: tk.error.text,
    },
    input: {
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.light,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
      fontSize: rnType.body.size,
      color: tk.text.primary,
      backgroundColor: tk.surface.inputBg,
    },
    inputMultiline: {
      minHeight: 96,
      textAlignVertical: 'top',
    },
    inputMissing: {
      borderColor: tk.error.text,
    },
    /* 结果 / 提示 */
    resultBox: {
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      padding: rnSpacing.md,
      backgroundColor: tk.surface.inputBg,
    },
    resultText: {
      fontSize: rnType.body.size,
      lineHeight: 22,
      color: tk.text.medium,
    },
    errorText: {
      marginTop: rnSpacing.sm,
      fontSize: rnType.label.size,
      color: tk.error.text,
    },
    hintText: {
      fontSize: rnType.body.size,
      color: tk.text.secondary,
    },
    successText: {
      fontSize: rnType.body.size,
      color: tk.success.deepText,
    },
    /* 评分 */
    ratingSummary: {
      marginBottom: rnSpacing.sm,
      fontSize: rnType.body.size,
      fontWeight: '500',
      color: tk.text.medium,
    },
    starRow: {
      flexDirection: 'row',
      gap: rnSpacing.xs,
      marginBottom: rnSpacing.sm,
    },
    starBtn: {
      paddingVertical: rnSpacing.xs,
      paddingHorizontal: rnSpacing.xs,
    },
    sectionLabel: {
      marginTop: rnSpacing.xl, // mt-5
      marginBottom: rnSpacing.sm, // mb-2
      fontSize: rnType.body.size, // text-sm
      fontWeight: '500', // font-medium
      color: tk.text.medium,
    },
    promptBox: {
      borderRadius: rnRadius.lg, // rounded-lg
      borderWidth: 1, // border
      borderColor: tk.border.light,
      padding: rnSpacing.md, // p-3
      backgroundColor: tk.surface.inputBg,
    },
    promptText: {
      fontSize: rnType.body.size, // text-sm
      lineHeight: 24, // leading-6
      color: tk.text.medium,
    },
    sourceText: {
      fontSize: rnType.body.size, // text-sm
      color: tk.text.secondary,
    },
  } satisfies Record<string, ViewStyle | TextStyle>)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
