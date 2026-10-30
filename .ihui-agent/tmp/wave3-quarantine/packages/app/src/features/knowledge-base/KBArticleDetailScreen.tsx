import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'

import { useMemo } from 'react'
import { ScrollView, StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native'
import { Calendar, Eye } from 'lucide-react-native'
import type { TFunction } from '@ihui/types'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'
import { EmptyState, ErrorState, ScreenSkeleton } from '../../components/ScreenStates'

/**
 * 文章详情(结构对齐 @ihui/api-client KBArticleDetail 的列集,
 * 即 apps/api routes/other/knowledge-base-routes.ts:133 `select()` 返回的整行)。
 */
export interface KBArticleDetailView {
  id: string
  title: string
  summary: string | null
  content: string | null
  viewCount: number | null
  updatedAt: string | null
}

/**
 * KBArticleDetailScreen 知识库文章阅读(共享层)props 契约。
 * 平台无关:getKBArticle 数据流、路由参数、导航与时间格式化由 wrapper 注入
 * (Intl.DateTimeFormat 在平台侧按 locale 预格式化,与 web 逐字同参)。
 */
export interface KBArticleDetailScreenProps {
  t: TFunction
  /** 文章(加载中 / 失败为 null) */
  article: KBArticleDetailView | null
  /** 首屏整屏 loading */
  loading: boolean
  /** 加载失败文案(非空在内容区渲染错误态 + 重试;后端 404 的「知识库不存在」原样呈现) */
  error: string
  /** 更新时间展示文本(wrapper 用 Intl.DateTimeFormat 生成) */
  updatedText: string
  /** 错误态重试 */
  onRetry: () => void
  /** 返回列表 */
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/**
 * KBArticleDetailScreen 知识库文章阅读页(共享层)
 *
 * 2026-10-26 承载 web `/knowledge-base/[id]`
 * (apps/web/app/(main)/knowledge-base/[id]/PageClient.tsx)。
 * 与 web 的差异全部来自后端事实(取证见 endpoints/knowledge-base.ts 头注),逐条如实登记:
 *  - 正文按**纯文本**分段呈现:RN 端无 markdown 依赖(web :129 用 MarkdownViewer),
 *    因此 web 的目录侧栏(:134-160,靠标题锚点滚动)在本屏无对应物,不伪造。
 *  - **不渲染上一篇/下一篇**:web :163-192 读 `data.prev / data.next`,而后端
 *    GET /knowledge-base/:id 只回 `{ item }`(knowledge-base-routes.ts:144),
 *    没有 prev/next ⇒ 造出来就是点了没反应的按钮。
 *  - **不渲染分类/作者徽章**:详情是裸 `select()` 不 join(knowledge-base-routes.ts:133-137),
 *    行里没有 categoryName/authorName;web :101-103 读的两个字段在真接口上恒 undefined。
 *  - **不渲染标签**:knowledge_base 表无 tags 列(packages/database/src/schema/knowledge-base.ts:24-36)。
 *  - `isPublished` / `status` / `likeCount` / `coverImage` 后端确实返回,但 web 详情页一个都不显示
 *    (也没有可抄的文案)⇒ 本屏同样不造徽章、不造"点赞"入口。
 * 三态:loading → ScreenSkeleton;error → ErrorState + 重试;无数据 → EmptyState(notFound)。
 */
export function KBArticleDetailScreen({
  t,
  article,
  loading,
  error,
  updatedText,
  onRetry,
  onBack,
  colorScheme = 'light',
}: KBArticleDetailScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.headerBar}>
          <BackChevron onPress={onBack} label={t('kbArticleDetailPage.backToList')} colorScheme={colorScheme} />
        </View>
        <ScreenSkeleton variant="list" count={4} colorScheme={colorScheme} />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <BackChevron onPress={onBack} label={t('kbArticleDetailPage.backToList')} colorScheme={colorScheme} />
        <View style={styles.headerSpacer} />
      </View>

      {error ? (
        <ErrorState
          message={error}
          onRetry={onRetry}
          retryLabel={t('common.retry')}
          colorScheme={colorScheme}
        />
      ) : !article ? (
        <EmptyState
          title={t('kbArticleDetailPage.notFound')}
          colorScheme={colorScheme}
        />
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <Text style={styles.title}>{article.title}</Text>
          {article.summary ? <Text style={styles.summary}>{article.summary}</Text> : null}

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Calendar size={rnType.label.size} color={tk.text.secondary} />
              <Text style={styles.metaText}>{updatedText}</Text>
            </View>
            <View style={styles.metaItem}>
              <Eye size={rnType.label.size} color={tk.text.secondary} />
              <Text style={styles.metaText}>
                {t('kbArticleDetailPage.viewCount', { count: article.viewCount ?? 0 })}
              </Text>
            </View>
          </View>

          {article.content ? (
            // 正文卡片:对齐 web :127-131 的 <Card><CardContent className="p-3">;
            // content 为 null 时整卡不渲染(web :129 此时同样渲染出空 viewer,无占位文案可抄)
            <View style={styles.card}>
              {article.content
                .split(/\n{2,}/)
                .map((block) => block.trim())
                .filter((block) => block.length > 0)
                .map((block, i) => (
                  <Text key={i} style={styles.paragraph}>
                    {block}
                  </Text>
                ))}
            </View>
          ) : null}
        </ScrollView>
      )}
    </View>
  )
}

/**
 * 样式:对齐 web [id]/PageClient.tsx 的 tailwind 语义档(px-4/py-4 容器、
 * text-xl→2xl 标题、text-xs 摘要、text-sm 元信息、rounded-lg 卡片),
 * 颜色全部走 AppThemeTokens 语义 token,零 hex。
 */
function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: tk.surface.bg,
    },
    headerBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: rnSpacing.lg,
      paddingTop: rnSpacing.md,
      paddingBottom: rnSpacing.sm,
    },
    headerSpacer: {
      width: rnType.title.size,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: rnSpacing.lg,
      paddingBottom: rnSpacing.xl,
    },
    title: {
      ...rnType.heading,
      color: tk.text.primary,
    },
    summary: {
      ...rnType.label,
      color: tk.text.secondary,
      marginTop: rnSpacing.xs,
    },
    metaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: rnSpacing.md,
      marginTop: rnSpacing.sm,
    },
    metaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.xs,
    },
    metaText: {
      ...rnType.label,
      color: tk.text.secondary,
    },
    /* 正文卡片:对齐 web :127-131 的 <Card><CardContent className="p-3">;
     * 用背景对比 + 描边分层替代分割线(AGENTS §4 禁纯分隔线) */
    card: {
      marginTop: rnSpacing.md,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
      padding: rnSpacing.md,
    },
    paragraph: {
      ...rnType.body,
      color: tk.text.primary,
      marginBottom: rnSpacing.sm,
      lineHeight: rnType.body.lineHeight + 6,
    },
  } satisfies Record<string, ViewStyle | TextStyle>)
}
