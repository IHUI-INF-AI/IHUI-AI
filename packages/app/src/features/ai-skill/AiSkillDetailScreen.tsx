// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import { rnRadius } from '@ihui/design-tokens'

import { useMemo } from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import type { TFunction } from '@ihui/types'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'

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
      <View style={[styles.container, styles.center]}>
        <Text style={styles.hintText}>{t('common.loading')}</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* 顶部导航行:返回 / 标题(路由参数 name)/ 占位 */}
      <View style={styles.headerBar}>
        <Pressable
          onPress={onBack}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="back"
        >
          <Text style={styles.backText}>{t('common.back')}</Text>
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.headerSidePlaceholder} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {error ? (
          <View style={styles.errorWrap}>
            <Text style={[styles.hintText, styles.errorText]}>{error}</Text>
            <Pressable
              style={({ pressed }) => [styles.retryBtn, pressed ? styles.pressed : null]}
              onPress={onRetry}
              accessibilityRole="button"
              accessibilityLabel={t('aiSkillDetail.retry')}
            >
              <Text style={styles.retryText}>{t('aiSkillDetail.retry')}</Text>
            </Pressable>
          </View>
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
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pressed: {
      opacity: 0.85,
    },
    hintText: {
      fontSize: 14, // text-sm
      color: tk.text.secondary,
      textAlign: 'center',
    },
    /* 顶部导航行 */
    headerBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16, // px-4
      paddingBottom: 8, // pb-2
      paddingTop: 12, // pt-3
    },
    backText: {
      fontSize: 14, // text-sm
      color: tk.text.secondary,
    },
    headerTitle: {
      fontSize: 16, // text-base
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
      paddingHorizontal: 16, // px-4
      paddingTop: 8, // pt-2
      paddingBottom: 24,
    },
    /* 错误态 */
    errorWrap: {
      alignItems: 'center',
      paddingVertical: 64, // py-16
    },
    errorText: {
      marginBottom: 12, // mt-3 对称间距
    },
    retryBtn: {
      marginTop: 12, // mt-3
      borderRadius: rnRadius.md, // rounded-md
      paddingHorizontal: 16, // px-4
      paddingVertical: 8, // py-2
      backgroundColor: tk.surface.muted,
    },
    retryText: {
      fontSize: 14, // text-sm
      color: tk.text.primary,
    },
    /* 详情内容 */
    description: {
      fontSize: 14, // text-sm
      lineHeight: 24, // leading-6
      color: tk.text.secondary,
    },
    tagRow: {
      marginTop: 12, // mt-3
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6, // gap-1.5
    },
    metaChip: {
      borderRadius: rnRadius.xs, // rounded-sm
      paddingHorizontal: 8, // px-2
      paddingVertical: 4, // py-1
      backgroundColor: tk.surface.muted,
    },
    metaChipText: {
      fontSize: 12, // text-xs
      color: tk.text.secondary,
    },
    tagChip: {
      borderRadius: rnRadius.xs, // rounded-sm
      paddingHorizontal: 8, // px-2
      paddingVertical: 4, // py-1
      backgroundColor: tk.warning.orangeLight,
    },
    tagText: {
      fontSize: 12, // text-xs
      color: tk.warning.amber,
    },
    sectionLabel: {
      marginTop: 20, // mt-5
      marginBottom: 8, // mb-2
      fontSize: 14, // text-sm
      fontWeight: '500', // font-medium
      color: tk.text.medium,
    },
    promptBox: {
      borderRadius: rnRadius.lg, // rounded-lg
      borderWidth: 1, // border
      borderColor: tk.border.light,
      padding: 12, // p-3
      backgroundColor: tk.surface.inputBg,
    },
    promptText: {
      fontSize: 14, // text-sm
      lineHeight: 24, // leading-6
      color: tk.text.medium,
    },
    sourceText: {
      fontSize: 14, // text-sm
      color: tk.text.secondary,
    },
  } satisfies Record<string, ViewStyle | TextStyle>)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
