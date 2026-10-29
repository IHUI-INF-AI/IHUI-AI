// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import { Calendar, Eye, Sparkles, Star, Tag } from 'lucide-react-native'
import { Image, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import type { TFunction } from '../../types'
import { getTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'
import { ErrorState, ScreenSkeleton } from '../../components/ScreenStates'
import { createAiWorldDetailStyles } from './ai-world-detail-styles'

/** 条目详情展示数据 — 由 wrapper 从 GET /api/ai-world/:id 的 world DTO 映射 */
export interface AiWorldDetailData {
  id: string
  title: string
  content: string | null
  coverImage: string | null
  /** 分类名(wrapper 用 categories 按 categoryId 解析;未命中传 null) */
  categoryName: string | null
  viewCount: number
  createdAt: string
  updatedAt: string
}

export interface AiWorldDetailScreenProps {
  t: TFunction
  colorScheme?: 'light' | 'dark'
  onBack: () => void
  loading: boolean
  error: string
  data: AiWorldDetailData | null
  onRetry: () => void
  /** 仅登录态展示收藏按钮(与 web 端 isAuthed 门同口径) */
  showFavorite: boolean
  favorited: boolean
  favoritePending: boolean
  onToggleFavorite: () => void
  /** 收藏写操作失败的内联提示(不顶替正文) */
  favoriteError: string
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '-'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * AiWorldDetailScreen AI 世界条目详情(共享层)
 *
 * 2026-10-26 Wave2 补屏立,承载 web `/ai-world/[id]`(apps/web/app/(main)/ai-world/[id]/PageClient.tsx):
 * - 结构:顶栏(返回/标题)→ 封面 → 标题+收藏按钮 → 元信息(分类/浏览数/发布时间)
 *   → 正文 → 更新时间。web 端「相关推荐」依赖 GET /api/ai-world 的 hotApps 字段,
 *   后端该响应从不返回 hotApps(web 实渲染恒为空),故本屏不承载,见 wave2 manifest note。
 * - 平台无关:取数(详情/分类/收藏检查与切换)、登录态、导航由 wrapper 注入
 * - i18n:aiWorldDetailPage.* 新增键 + 复用既有 aiWorld.*(viewCount/empty/favorites)与 common.*
 */
export function AiWorldDetailScreen({
  t,
  colorScheme = 'light',
  onBack,
  loading,
  error,
  data,
  onRetry,
  showFavorite,
  favorited,
  favoritePending,
  onToggleFavorite,
  favoriteError,
}: AiWorldDetailScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createAiWorldDetailStyles(tk), [tk])

  const header = (
    <View style={styles.header}>
      <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
      <Text style={styles.headerTitle}>{t('aiWorldDetailPage.title')}</Text>
    </View>
  )

  if (loading && !data) {
    return (
      <View style={styles.container}>
        {header}
        <ScreenSkeleton variant="card" count={3} colorScheme={colorScheme} />
      </View>
    )
  }

  if (error && !data) {
    return (
      <View style={styles.container}>
        {header}
        <ErrorState
          message={error}
          onRetry={onRetry}
          retryLabel={t('common.retry')}
          colorScheme={colorScheme}
        />
      </View>
    )
  }

  const world = data!

  return (
    <View style={styles.container}>
      {header}
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          {world.coverImage ? (
            <Image source={{ uri: world.coverImage }} style={styles.cover} resizeMode="cover" />
          ) : (
            <View style={styles.coverFallback}>
              <Sparkles size={36} color={tk.text.tertiary} strokeWidth={1.5} />
            </View>
          )}

          <View style={styles.titleRow}>
            <Text style={styles.title}>{world.title}</Text>
            {showFavorite ? (
              <TouchableOpacity
                style={[styles.favBtn, favorited && styles.favBtnActive]}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityState={{ selected: favorited }}
                disabled={favoritePending}
                onPress={onToggleFavorite}
              >
                <Star
                  size={14}
                  color={favorited ? tk.brand.ctaForeground : tk.text.secondary}
                  strokeWidth={2}
                />
                <Text
                  style={[
                    styles.favBtnText,
                    favorited ? styles.favBtnActiveText : null,
                    favoritePending ? styles.favBtnTextPending : null,
                  ]}
                >
                  {favorited ? t('aiWorldDetailPage.favorited') : t('aiWorld.favorites')}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {favoriteError ? <Text style={styles.favErrorText}>{favoriteError}</Text> : null}

          <View style={styles.metaRow}>
            {world.categoryName ? (
              <View style={styles.metaChip}>
                <Tag size={12} color={tk.text.secondary} strokeWidth={2} />
                <Text style={styles.metaText}>{world.categoryName}</Text>
              </View>
            ) : null}
            <View style={styles.metaItem}>
              <Eye size={12} color={tk.text.tertiary} strokeWidth={2} />
              <Text style={styles.metaText}>
                {world.viewCount} {t('aiWorld.viewCount')}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Calendar size={12} color={tk.text.tertiary} strokeWidth={2} />
              <Text style={styles.metaText}>
                {t('aiWorldDetailPage.createdLabel')} {formatDateTime(world.createdAt)}
              </Text>
            </View>
          </View>

          {world.content ? (
            <Text style={styles.content}>{world.content}</Text>
          ) : (
            <Text style={styles.contentEmpty}>{t('aiWorld.empty')}</Text>
          )}

          <Text style={styles.updatedText}>
            {t('aiWorldDetailPage.updatedLabel')} {formatDateTime(world.updatedAt)}
          </Text>
        </View>
      </ScrollView>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
