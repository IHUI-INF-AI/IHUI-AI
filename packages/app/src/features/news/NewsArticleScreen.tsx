// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { Bookmark, Calendar, Eye, Heart, MessageSquare } from 'lucide-react-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import type { NewsArticleItem, NewsArticleScreenProps } from '@ihui/types'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'
import { ErrorState, ScreenSkeleton } from '../../components/ScreenStates'
import { htmlToParagraphs } from '../agreement/agreement-type'

export type { NewsArticleItem, NewsArticleScreenProps }

/** ISO → `YYYY-MM-DD`(web 用 formatDateOnly,RN 端统一短日期,与知识库阅读屏同格式) */
function formatDate(value?: string | null): string {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * NewsArticleScreen 资讯详情页(共享层)
 *
 * 2026-10-28 补屏立,承载 web `/news/[id]`
 * (apps/web/app/(main)/news/[id]/PageClient.tsx),与 RN 既有 `ArticleDetailScreen`
 * **不是同一物**:后者走 `/api/articles/:id`(社区文章域),本屏走资讯域
 * `/api/news/articles/:id`,两个后端域不可互相复用。
 *
 * 结构(对齐 web 卡片):顶栏(返回 / 标题)→ 标题 + 摘要 → 元信息(作者 / 发布 / 浏览,
 * 交互计数只有真拿到才渲染)→ 封面图 → 正文卡 → 标签行。
 *
 * 与 web 的三处已知取舍:
 * - 正文:web 用 `SafeHtml` 渲染 HTML,RN 无 markdown/HTML 渲染组件(不引新依赖),故复用
 *   `agreement-type.ts` 的 `htmlToParagraphs` 剥标签后按段落 `<Text selectable>` 直出,
 *   web 的 prose 排版能力不在本屏承诺范围内;
 * - 交互计数:web 对缺失的 like/favorite/comment 用 `viewCount * 0.05` 之类**编数值**兜底,
 *   本屏不编 —— `undefined` 就不渲染那一格(后端详情确实不回这三项);
 * - 侧栏(热门资讯)与评论组件属 web 编排,不在共享屏范围内,由宿主按需另挂。
 *
 * 样式:getTokens(colorScheme) 语义 token,零 hex,间距走 rnSpacing/rnType/rnRadius。
 * i18n:`news.detailTitle` / `news.notFound` / `news.publishedAt` / `news.viewCount` /
 * `news.tags` / `news.emptyContent`(新增) + 复用 `common.back` / `common.retry`。
 */
export function NewsArticleScreen({
  t,
  article,
  loading,
  error,
  onBack,
  onRetry,
  colorScheme = 'light',
}: NewsArticleScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  const content = article?.content ?? ''
  const paragraphs = useMemo(() => (content ? htmlToParagraphs(content) : []), [content])

  const header = (
    <View style={styles.headerBar}>
      <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
      <Text style={styles.headerTitle}>{t('news.detailTitle')}</Text>
      {/* 右侧占位:与左侧返回键等宽,标题才是真居中而不是被按钮挤偏 */}
      <View style={styles.headerSpacer} />
    </View>
  )

  if (loading && !article) {
    return (
      <View style={styles.container}>
        {header}
        <ScreenSkeleton variant="card" count={3} colorScheme={colorScheme} />
      </View>
    )
  }

  if (error && !article) {
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

  if (!article) {
    return (
      <View style={styles.container}>
        {header}
        <ErrorState
          message={t('news.notFound')}
          onRetry={onRetry}
          retryLabel={t('common.retry')}
          colorScheme={colorScheme}
        />
      </View>
    )
  }

  const tags = article.tags ?? []
  const hasInteraction =
    typeof article.likeCount === 'number' ||
    typeof article.favoriteCount === 'number' ||
    typeof article.commentCount === 'number'

  return (
    <View style={styles.container}>
      {header}
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{article.title}</Text>
        {article.summary ? <Text style={styles.summary}>{article.summary}</Text> : null}

        <View style={styles.metaRow}>
          {article.authorName ? <Text style={styles.author}>{article.authorName}</Text> : null}
          {article.publishedAt ? (
            <View style={styles.metaInline}>
              <Calendar size={12} color={tk.text.tertiary} strokeWidth={2} />
              <Text style={styles.metaText}>
                {t('news.publishedAt', { date: formatDate(article.publishedAt) })}
              </Text>
            </View>
          ) : null}
          <View style={styles.metaInline}>
            <Eye size={12} color={tk.text.tertiary} strokeWidth={2} />
            <Text style={styles.metaText}>
              {t('news.viewCount', { count: article.viewCount ?? 0 })}
            </Text>
          </View>
        </View>

        {hasInteraction ? (
          <View style={styles.statRow}>
            {typeof article.favoriteCount === 'number' ? (
              <View style={styles.statInline}>
                <Bookmark size={12} color={tk.text.secondary} strokeWidth={2} />
                <Text style={styles.statText}>{article.favoriteCount}</Text>
              </View>
            ) : null}
            {typeof article.likeCount === 'number' ? (
              <View style={styles.statInline}>
                <Heart size={12} color={tk.text.secondary} strokeWidth={2} />
                <Text style={styles.statText}>{article.likeCount}</Text>
              </View>
            ) : null}
            {typeof article.commentCount === 'number' ? (
              <View style={styles.statInline}>
                <MessageSquare size={12} color={tk.text.secondary} strokeWidth={2} />
                <Text style={styles.statText}>{article.commentCount}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {article.coverImage ? (
          <Image source={{ uri: article.coverImage }} style={styles.cover} resizeMode="cover" />
        ) : null}

        <View style={styles.contentCard}>
          {paragraphs.length > 0 ? (
            paragraphs.map((paragraph, index) => (
              <Text key={`${index}-${paragraph.slice(0, 12)}`} style={styles.paragraph} selectable>
                {paragraph}
              </Text>
            ))
          ) : (
            <Text style={styles.contentEmpty}>{t('news.emptyContent')}</Text>
          )}
        </View>

        {tags.length > 0 ? (
          <View style={styles.tagRow}>
            <Text style={styles.tagLabel}>{t('news.tags')}</Text>
            {tags.map((tag) => (
              <View key={tag} style={styles.tagChip}>
                <Text style={styles.tagText}>{`#${tag}`}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  )
}

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
      paddingHorizontal: rnSpacing.lg,
      paddingTop: rnSpacing.md,
      paddingBottom: rnSpacing.sm,
    },
    headerTitle: {
      fontSize: rnType.title.size,
      fontWeight: '500',
      color: tk.text.primary,
    },
    headerSpacer: {
      width: 32,
    },
    /* 正文区 */
    scroll: {
      paddingHorizontal: rnSpacing.lg,
      paddingBottom: rnSpacing['3xl'],
    },
    title: {
      fontSize: rnType.heading.size,
      fontWeight: '700',
      color: tk.text.primary,
    },
    summary: {
      marginTop: rnSpacing.sm,
      fontSize: rnType.label.size,
      lineHeight: 19,
      color: tk.text.secondary,
    },
    metaRow: {
      marginTop: rnSpacing.md,
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: rnSpacing.sm,
    },
    author: {
      fontSize: rnType.label.size,
      fontWeight: '500',
      color: tk.text.primary,
    },
    metaInline: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.xs,
    },
    metaText: {
      fontSize: rnType.caption.size,
      color: tk.text.tertiary,
    },
    statRow: {
      marginTop: rnSpacing.sm,
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: rnSpacing.md,
    },
    statInline: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.xs,
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: 2,
      borderRadius: rnRadius.lg,
      backgroundColor: tk.surface.card,
    },
    statText: {
      fontSize: rnType.caption.size,
      color: tk.text.secondary,
    },
    cover: {
      marginTop: rnSpacing.md,
      width: '100%',
      height: 200,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.muted,
    },
    contentCard: {
      marginTop: rnSpacing.md,
      padding: rnSpacing.md,
      gap: rnSpacing.sm,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    paragraph: {
      fontSize: rnType.body.size,
      lineHeight: 24,
      color: tk.text.primary,
    },
    contentEmpty: {
      fontSize: rnType.label.size,
      color: tk.text.tertiary,
    },
    /* 标签行 */
    tagRow: {
      marginTop: rnSpacing.md,
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: rnSpacing.xs,
    },
    tagLabel: {
      fontSize: rnType.caption.size,
      color: tk.text.tertiary,
    },
    tagChip: {
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: 2,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.surface.light,
    },
    tagText: {
      fontSize: rnType.caption.size,
      color: tk.brandAccent.deep,
    },
  } satisfies Record<string, ViewStyle | TextStyle>)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
