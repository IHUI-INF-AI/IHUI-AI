// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'

import { useMemo } from 'react'
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import type { TFunction } from '@ihui/types'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'
import {
  EmptyState,
  ErrorState,
  PressableCard,
  ScreenSkeleton,
} from '../../components/ScreenStates'

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
      <View style={styles.container}>
        <ScreenSkeleton variant="card" count={4} colorScheme={colorScheme} />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* 顶部导航行:返回 / 标题 / 占位 */}
      <View style={styles.headerBar}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.headerTitle} numberOfLines={1}>
          {t('aiSkill.title')}
        </Text>
        <View style={styles.headerSidePlaceholder} />
      </View>

      {error ? (
        <ErrorState
          message={error}
          onRetry={onRetry}
          retryLabel={t('aiSkill.retry')}
          colorScheme={colorScheme}
        />
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
          ListEmptyComponent={<EmptyState title={t('aiSkill.empty')} colorScheme={colorScheme} />}
          renderItem={({ item }) => (
            // 卡片盒由 PressableCard 承接(描边/圆角/底色 + 按压缩放反馈);
            // 宽度仍由 cardFace 显式还给盒子(改前由列表列的父级 stretch 撑出)。
            <PressableCard
              onPress={() => onOpenSkill(item)}
              colorScheme={colorScheme}
              style={[styles.cardFace, styles.card]}
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
            </PressableCard>
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
      maxWidth: '60%',
    },
    headerSidePlaceholder: {
      width: 40, // w-10
    },
    /* 列表 */
    listContent: {
      padding: rnSpacing.lg, // p-4
    },
    /* 技能卡片 */
    // 守门 131 转换新增:卡片盒下移到子 View 后,宽度由该档显式还给盒子
    // (改前那一维由列表列的父级 stretch 撑出),未引入任何新数字档。
    cardFace: {
      width: '100%',
    },
    card: {
      marginBottom: rnSpacing.md, // mb-3
      borderRadius: rnRadius.lg, // rounded-lg
      borderWidth: 1, // border
      borderColor: tk.border.light,
      padding: rnSpacing.lg, // p-4
      backgroundColor: tk.surface.card,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    cardName: {
      flex: 1,
      fontSize: rnType.title.size, // text-base
      fontWeight: '500', // font-medium
      color: tk.text.primary,
    },
    categoryBadge: {
      marginLeft: rnSpacing.sm, // ml-2
      borderRadius: rnRadius.md, // rounded-sm
      paddingHorizontal: 6, // px-1.5
      paddingVertical: 2, // py-0.5
      backgroundColor: tk.surface.muted,
    },
    categoryText: {
      fontSize: rnType.label.size, // text-xs
      color: tk.text.secondary,
    },
    cardDescription: {
      marginTop: rnSpacing.xs, // mt-1
      fontSize: rnType.body.size, // text-sm
      lineHeight: 20, // leading-5
      color: tk.text.secondary,
    },
    tagRow: {
      marginTop: rnSpacing.sm, // mt-2
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6, // gap-1.5
    },
    tagChip: {
      borderRadius: rnRadius.md, // rounded-sm
      paddingHorizontal: 6, // px-1.5
      paddingVertical: 2, // py-0.5
      backgroundColor: tk.warning.orangeLight,
    },
    tagText: {
      fontSize: rnType.label.size, // text-xs
      color: tk.warning.amber,
    },
  } satisfies Record<string, ViewStyle | TextStyle>)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
