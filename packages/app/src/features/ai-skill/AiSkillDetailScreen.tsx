// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'

import { useMemo } from 'react'
import { ScrollView, StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native'
import type { TFunction } from '@ihui/types'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'
import { ErrorState, ScreenSkeleton } from '../../components/ScreenStates'

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
}: AiSkillDetailScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenSkeleton variant="card" count={3} colorScheme={colorScheme} />
      </View>
    )
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

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
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
          </>
        ) : null}
      </ScrollView>
    </View>
  )
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
      gap: 6, // gap-1.5
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
