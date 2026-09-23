// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import { rnRadius } from '@ihui/design-tokens'

import { useMemo } from 'react'
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import type { TFunction } from '@ihui/types'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'

/** AI 技能列表条目(平台无关,由 wrapper 从 AiSkillMeta 映射) */
export interface AiSkillListItem {
  id: string
  name: string
  description: string
  category: string
  tags: string[]
}

/** AiSkillScreen AI 技能市场(共享层)props — 数据/回调/t 由 wrapper 注入 */
export interface AiSkillScreenProps {
  t: TFunction
  items: AiSkillListItem[]
  loading: boolean
  refreshing: boolean
  /** 加载失败文案(已由 wrapper 翻译;非空时展示错误态 + 重试) */
  error: string
  onRefresh: () => void
  onRetry: () => void
  /** 点击技能卡(查看详情确认弹窗/跳转由 wrapper 决定) */
  onOpenSkill: (skill: AiSkillListItem) => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/**
 * AiSkillScreen AI 技能市场(共享层)
 *
 * 2026-09-15 承接 mobile-rn AiSkillScreen 1:1 迁移(M3 补齐:web /ai-skills 移动端入口):
 * - 结构:顶部导航行(返回/标题)→ 技能卡列表(名称/分类徽章/描述/标签 chips)
 * - 三态:加载(居中 Loading)→ 错误(文案 + 重试按钮)→ 列表(下拉刷新)
 * - 平台无关:API(listAiSkills)、Alert 确认、导航由 wrapper 注入
 * - 样式:getTokens(colorScheme) 语义 token(零 hex、零 Tailwind class)
 * - i18n:沿用 aiSkill.* 与 common.*(mobile-rn i18n 既有 key)
 */
export function AiSkillScreen({
  t,
  items,
  loading,
  refreshing,
  error,
  onRefresh,
  onRetry,
  onOpenSkill,
  onBack,
  colorScheme = 'light',
}: AiSkillScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* 顶部导航行:返回 / 标题 / 占位 */}
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
          {t('aiSkill.title')}
        </Text>
        <View style={styles.headerSidePlaceholder} />
      </View>

      {error ? (
        <View style={[styles.center, styles.errorWrap]}>
          <Text style={[styles.hintText, styles.errorText]}>{error}</Text>
          <Pressable
            style={({ pressed }) => [styles.retryBtn, pressed ? styles.pressed : null]}
            onPress={onRetry}
            accessibilityRole="button"
            accessibilityLabel={t('aiSkill.retry')}
          >
            <Text style={styles.retryText}>{t('aiSkill.retry')}</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={tk.text.secondary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.hintText}>{t('aiSkill.empty')}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}
              onPress={() => onOpenSkill(item)}
              accessibilityRole="button"
              accessibilityLabel={item.name}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardName} numberOfLines={1}>
                  {item.name}
                </Text>
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryText} numberOfLines={1}>
                    {item.category}
                  </Text>
                </View>
              </View>
              <Text style={styles.cardDescription} numberOfLines={2}>
                {item.description}
              </Text>
              {item.tags.length > 0 ? (
                <View style={styles.tagRow}>
                  {item.tags.slice(0, 4).map((tag) => (
                    <View key={tag} style={styles.tagChip}>
                      <Text style={styles.tagText} numberOfLines={1}>
                        {tag}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </Pressable>
          )}
        />
      )}
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
    loadingText: {
      fontSize: 14, // text-sm
      color: tk.text.secondary,
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
      maxWidth: '60%',
    },
    headerSidePlaceholder: {
      width: 40, // w-10
    },
    /* 错误态 */
    errorWrap: {
      paddingHorizontal: 24, // px-6
    },
    hintText: {
      fontSize: 14, // text-sm
      color: tk.text.secondary,
      textAlign: 'center',
    },
    errorText: {
      marginBottom: 12, // mb-3
    },
    retryBtn: {
      borderRadius: rnRadius.md, // rounded-md
      paddingHorizontal: 16, // px-4
      paddingVertical: 8, // py-2
      backgroundColor: tk.surface.muted,
    },
    retryText: {
      fontSize: 14, // text-sm
      color: tk.text.primary,
    },
    /* 列表 */
    listContent: {
      padding: 16, // p-4
    },
    emptyWrap: {
      alignItems: 'center',
      paddingVertical: 64, // py-16
    },
    /* 技能卡片 */
    card: {
      marginBottom: 12, // mb-3
      borderRadius: rnRadius.lg, // rounded-lg
      borderWidth: 1, // border
      borderColor: tk.border.light,
      padding: 16, // p-4
      backgroundColor: tk.surface.card,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    cardName: {
      flex: 1,
      fontSize: 16, // text-base
      fontWeight: '500', // font-medium
      color: tk.text.primary,
    },
    categoryBadge: {
      marginLeft: 8, // ml-2
      borderRadius: rnRadius.xs, // rounded-sm
      paddingHorizontal: 6, // px-1.5
      paddingVertical: 2, // py-0.5
      backgroundColor: tk.surface.muted,
    },
    categoryText: {
      fontSize: 12, // text-xs
      color: tk.text.secondary,
    },
    cardDescription: {
      marginTop: 4, // mt-1
      fontSize: 14, // text-sm
      lineHeight: 20, // leading-5
      color: tk.text.secondary,
    },
    tagRow: {
      marginTop: 8, // mt-2
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6, // gap-1.5
    },
    tagChip: {
      borderRadius: rnRadius.xs, // rounded-sm
      paddingHorizontal: 6, // px-1.5
      paddingVertical: 2, // py-0.5
      backgroundColor: tk.warning.orangeLight,
    },
    tagText: {
      fontSize: 12, // text-xs
      color: tk.warning.amber,
    },
  } satisfies Record<string, ViewStyle | TextStyle>)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
