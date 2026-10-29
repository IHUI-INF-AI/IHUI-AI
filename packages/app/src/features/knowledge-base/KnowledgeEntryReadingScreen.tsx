// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { Calendar, ChevronLeft, ChevronRight, Eye } from 'lucide-react-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import type {
  KnowledgeEntryArticle,
  KnowledgeEntryNavItem,
  KnowledgeEntryReadingScreenProps,
  KnowledgeEntryTocItem,
} from '@ihui/types'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'
import { ErrorState, ScreenSkeleton } from '../../components/ScreenStates'

export type {
  KnowledgeEntryArticle,
  KnowledgeEntryNavItem,
  KnowledgeEntryReadingScreenProps,
  KnowledgeEntryTocItem,
}

/**
 * 从 Markdown 正文里抽目录 —— 与 web `apps/web/src/lib/content.tsx:141` 的 extractToc 同口径:
 * 只认 `##` / `###` 两级(`#` 是文章标题,不进目录),行内强调符 `* _ \`` 一律剥掉。
 *
 * RN 不做锚点跳转(无 `<a href="#id">`),所以这里**不产出 slug id**,只留 text + level;
 * web 的 id 只服务于 scroll 定位,搬过来就是死字段。
 */
export function extractToc(content: string): KnowledgeEntryTocItem[] {
  const items: KnowledgeEntryTocItem[] = []
  for (const line of content.split('\n')) {
    const m = /^(#{2,3})\s+(.+?)\s*$/.exec(line)
    if (!m || !m[1] || !m[2]) continue
    items.push({ level: m[1].length, text: m[2].replace(/[*_`]/g, '') })
  }
  return items
}

/** ISO → `YYYY-MM-DD`(web 用 Intl 长日期,RN 端统一走短日期,与 KnowledgeBaseScreen 卡片同格式) */
function formatDate(value?: string | null): string {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * KnowledgeEntryReadingScreen 知识库条目阅读页(共享层)
 *
 * 2026-10-28 补屏立,承载 web `/knowledge-base/[id]`
 * (apps/web/app/(main)/knowledge-base/[id]/PageClient.tsx):
 * - 结构:顶栏(返回 / 标题)→ 文章头(标题 + 摘要 + 元信息 + 标签)
 *   → 正文卡 → 目录卡(`##`/`###`,正文无标题则整块不渲染)→ 上一篇/下一篇
 * - 正文:RN 无 markdown 渲染组件,按原文 `<Text selectable>` 直出(不引新依赖);
 *   web 的 MarkdownViewer 排版能力不在本屏承诺范围内
 * - 平台无关:取数、导航由 wrapper 注入;`prev`/`next` 缺失时不留空位(web 留空 `<span/>`)
 * - 样式:getTokens(colorScheme) 语义 token,零 hex,间距走 rnSpacing/rnType/rnRadius
 * - i18n:knowledgeBase.read*(新增) + 复用 knowledgeBase.retry / common.back
 */
export function KnowledgeEntryReadingScreen({
  t,
  article,
  prev,
  next,
  loading,
  error,
  onBack,
  onRetry,
  onPrev,
  onNext,
  colorScheme = 'light',
}: KnowledgeEntryReadingScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  const content = article?.content ?? ''
  const toc = useMemo(() => (content ? extractToc(content) : []), [content])

  const header = (
    <View style={styles.headerBar}>
      <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
      <Text style={styles.headerTitle}>{t('knowledgeBase.readTitle')}</Text>
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
          retryLabel={t('knowledgeBase.retry')}
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
          message={t('knowledgeBase.readingNotFound')}
          onRetry={onRetry}
          retryLabel={t('knowledgeBase.retry')}
          colorScheme={colorScheme}
        />
      </View>
    )
  }

  const tags = article.tags ?? []

  return (
    <View style={styles.container}>
      {header}
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{article.title}</Text>
        {article.summary ? <Text style={styles.summary}>{article.summary}</Text> : null}

        <View style={styles.metaCard}>
          {article.authorName ? (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>{t('knowledgeBase.author')}</Text>
              <Text style={styles.metaValue}>{article.authorName}</Text>
            </View>
          ) : null}
          {article.categoryName ? (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>{t('knowledgeBase.category')}</Text>
              <Text style={styles.metaValue}>{article.categoryName}</Text>
            </View>
          ) : null}
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>{t('knowledgeBase.updatedAt')}</Text>
            <View style={styles.metaInline}>
              <Calendar size={13} color={tk.text.tertiary} strokeWidth={2} />
              <Text style={styles.metaValue}>{formatDate(article.updatedAt)}</Text>
            </View>
          </View>
          <View style={styles.metaRow}>
            <View style={styles.metaInline}>
              <Eye size={13} color={tk.text.tertiary} strokeWidth={2} />
              <Text style={styles.metaValue}>
                {t('knowledgeBase.viewCount', { count: article.viewCount ?? 0 })}
              </Text>
            </View>
          </View>
        </View>

        {tags.length > 0 ? (
          <View style={styles.tagRow}>
            {tags.map((tag) => (
              <View key={tag} style={styles.tagChip}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.contentCard}>
          {article.content ? (
            <Text style={styles.content} selectable>
              {article.content}
            </Text>
          ) : (
            <Text style={styles.contentEmpty}>{t('knowledgeBase.readingEmptyContent')}</Text>
          )}
        </View>

        {toc.length > 0 ? (
          <View style={styles.tocCard}>
            <Text style={styles.tocTitle}>{t('knowledgeBase.tableOfContents')}</Text>
            {toc.map((item, index) => (
              <Text
                key={`${item.level}-${item.text}-${index}`}
                style={[styles.tocItem, item.level === 3 ? styles.tocItemNested : null]}
                numberOfLines={1}
              >
                {item.text}
              </Text>
            ))}
          </View>
        ) : null}

        {(prev && onPrev) || (next && onNext) ? (
          <View style={styles.navRow}>
            {prev && onPrev ? (
              <TouchableOpacity
                style={styles.navBtn}
                onPress={() => onPrev(prev)}
                accessibilityRole="button"
                activeOpacity={0.7}
              >
                <ChevronLeft size={14} color={tk.text.secondary} strokeWidth={2} />
                <View style={styles.navTextWrap}>
                  <Text style={styles.navLabel}>{t('knowledgeBase.prevEntry')}</Text>
                  <Text style={styles.navTitle} numberOfLines={1}>
                    {prev.title}
                  </Text>
                </View>
              </TouchableOpacity>
            ) : (
              <View style={styles.navBtn} />
            )}
            {next && onNext ? (
              <TouchableOpacity
                style={[styles.navBtn, styles.navBtnRight]}
                onPress={() => onNext(next)}
                accessibilityRole="button"
                activeOpacity={0.7}
              >
                <View style={[styles.navTextWrap, styles.navTextRight]}>
                  <Text style={styles.navLabel}>{t('knowledgeBase.nextEntry')}</Text>
                  <Text style={[styles.navTitle, styles.navTitleRight]} numberOfLines={1}>
                    {next.title}
                  </Text>
                </View>
                <ChevronRight size={14} color={tk.text.secondary} strokeWidth={2} />
              </TouchableOpacity>
            ) : (
              <View style={styles.navBtn} />
            )}
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
    metaCard: {
      marginTop: rnSpacing.md,
      padding: rnSpacing.md,
      gap: rnSpacing.sm,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
    },
    metaInline: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.xs,
    },
    metaLabel: {
      fontSize: rnType.caption.size,
      color: tk.text.tertiary,
    },
    metaValue: {
      fontSize: rnType.label.size,
      color: tk.text.primary,
    },
    tagRow: {
      marginTop: rnSpacing.md,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: rnSpacing.xs,
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
    contentCard: {
      marginTop: rnSpacing.md,
      padding: rnSpacing.md,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    content: {
      fontSize: rnType.body.size,
      lineHeight: 24,
      color: tk.text.primary,
    },
    contentEmpty: {
      fontSize: rnType.label.size,
      color: tk.text.tertiary,
    },
    /* 目录 */
    tocCard: {
      marginTop: rnSpacing.md,
      padding: rnSpacing.md,
      gap: rnSpacing.xs,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    tocTitle: {
      marginBottom: rnSpacing.xs,
      fontSize: rnType.caption.size,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      color: tk.text.secondary,
    },
    tocItem: {
      fontSize: rnType.label.size,
      color: tk.text.secondary,
    },
    /* 三级标题按 web 的 pl-4 缩进一档 */
    tocItemNested: {
      paddingLeft: rnSpacing.lg,
    },
    /* 上一篇 / 下一篇 */
    navRow: {
      marginTop: rnSpacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: rnSpacing.sm,
    },
    navBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.xs,
      paddingVertical: rnSpacing.sm,
    },
    navBtnRight: {
      justifyContent: 'flex-end',
    },
    navTextWrap: {
      flexShrink: 1,
    },
    navTextRight: {
      alignItems: 'flex-end',
    },
    navLabel: {
      fontSize: rnType.caption.size,
      color: tk.text.tertiary,
    },
    navTitleRight: {
      textAlign: 'right',
    },
    navTitle: {
      fontSize: rnType.label.size,
      fontWeight: '500',
      color: tk.text.primary,
    },
  } satisfies Record<string, ViewStyle | TextStyle>)
}
