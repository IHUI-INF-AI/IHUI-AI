// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  FolderOpen,
  Newspaper,
  Pin,
} from 'lucide-react-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import type { TFunction } from '../../types'
import { getTokens, type AppThemeMode, type AppThemeTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'

/**
 * 资讯分类页共享屏 —— 承载 web /news/category/[id](PageClient 同口径:分类头图缺失
 * 回落 Newspaper 占位、置顶徽章、发布时间/浏览量元信息、上一页/下一页分页 ≤20/页)。
 * 降级说明(如实):RN 无文章详情路由(无 NewsDetail),故条目为只读展示、不可点;
 * 后端分类/文章两路取数、日期 Intl 格式化由薄壳注入。
 */
export interface NewsCategoryArticleRow {
  id: string
  title: string
  summary: string | null
  /** 绝对 URL(薄壳已解析相对路径;取不到为 null ⇒ 占位图) */
  coverUri: string | null
  pinned: boolean
  authorName: string | null
  dateText: string
  viewText: string
}

export interface NewsCategoryScreenProps {
  t: TFunction
  colorScheme: AppThemeMode
  onBack: () => void
  categoriesLoading: boolean
  categoriesError: string | null
  /** null 且非 loading ⇒ 分类不存在态(web notFound) */
  categoryName: string | null
  articlesLoading: boolean
  articlesError: string | null
  articles: NewsCategoryArticleRow[]
  total: number
  page: number
  totalPages: number
  onPrevPage: () => void
  onNextPage: () => void
}

export function NewsCategoryScreen({
  t,
  colorScheme,
  onBack,
  categoriesLoading,
  categoriesError,
  categoryName,
  articlesLoading,
  articlesError,
  articles,
  total,
  page,
  totalPages,
  onPrevPage,
  onNextPage,
}: NewsCategoryScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  if (categoriesLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.centerBlock}>
          <ActivityIndicator size="large" color={tk.brand.DEFAULT} />
        </View>
      </View>
    )
  }

  if (!categoryName) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <BackChevron
            onPress={onBack}
            label={t('newsCategoryPage.backToList')}
            colorScheme={colorScheme}
          />
        </View>
        <View style={styles.centerBlock}>
          <FolderOpen size={36} color={tk.text.tertiary} />
          <Text style={styles.muted}>{categoriesError ?? t('newsCategoryPage.notFound')}</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron
          onPress={onBack}
          label={t('newsCategoryPage.backToList')}
          colorScheme={colorScheme}
        />
      </View>
      <View style={styles.titleRow}>
        <FolderOpen size={22} color={tk.brand.DEFAULT} />
        <Text style={styles.title}>{categoryName}</Text>
      </View>
      <Text style={styles.subtitle}>{t('newsCategoryPage.subtitle')}</Text>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {articlesLoading ? (
          <View style={styles.centerBlock}>
            <ActivityIndicator size="small" color={tk.brand.DEFAULT} />
            <Text style={styles.muted}>{t('newsCategoryPage.loading')}</Text>
          </View>
        ) : articlesError ? (
          <Text style={styles.error}>{articlesError}</Text>
        ) : articles.length === 0 ? (
          <View style={styles.emptyBlock}>
            <FileText size={28} color={tk.text.tertiary} />
            <Text style={styles.muted}>{t('newsCategoryPage.empty')}</Text>
          </View>
        ) : (
          articles.map((item) => (
            <View key={item.id} style={styles.articleCard}>
              <View style={styles.coverBox}>
                {item.coverUri ? (
                  <Image source={{ uri: item.coverUri }} style={styles.coverImage} />
                ) : (
                  <Newspaper size={28} color={tk.text.tertiary} />
                )}
              </View>
              <View style={styles.articleMain}>
                <View style={styles.articleTitleRow}>
                  {item.pinned ? (
                    <View style={styles.pinnedBadge}>
                      <Pin size={11} color={tk.brandAccent.deep} />
                      <Text style={styles.pinnedText}>{t('newsCategoryPage.pinned')}</Text>
                    </View>
                  ) : null}
                  <Text style={styles.articleTitle}>{item.title}</Text>
                </View>
                {item.summary ? <Text style={styles.articleSummary}>{item.summary}</Text> : null}
                <View style={styles.metaRow}>
                  {item.authorName ? <Text style={styles.metaText}>{item.authorName}</Text> : null}
                  <Text style={styles.metaText}>
                    {t('newsCategoryPage.publishedAt', { date: item.dateText })}
                  </Text>
                  <View style={styles.viewBox}>
                    <Eye size={13} color={tk.text.secondary} />
                    <Text style={styles.metaText}>{item.viewText}</Text>
                  </View>
                </View>
              </View>
            </View>
          ))
        )}

        {total > 0 && totalPages > 1 ? (
          <View style={styles.pagination}>
            <Text style={styles.muted}>{t('newsCategoryPage.total', { total })}</Text>
            <View style={styles.pagerBtns}>
              <TouchableOpacity
                style={page <= 1 ? styles.pagerBtnDisabled : styles.pagerBtn}
                onPress={onPrevPage}
                disabled={page <= 1}
              >
                <ChevronLeft size={15} color={page <= 1 ? tk.text.tertiary : tk.text.primary} />
                <Text style={styles.pagerText}>{t('newsCategoryPage.prev')}</Text>
              </TouchableOpacity>
              <Text style={styles.muted}>
                {page} / {totalPages}
              </Text>
              <TouchableOpacity
                style={page >= totalPages ? styles.pagerBtnDisabled : styles.pagerBtn}
                onPress={onNextPage}
                disabled={page >= totalPages}
              >
                <Text style={styles.pagerText}>{t('newsCategoryPage.next')}</Text>
                <ChevronRight
                  size={15}
                  color={page >= totalPages ? tk.text.tertiary : tk.text.primary}
                />
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg, paddingHorizontal: rnSpacing.md },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: rnSpacing.md,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
      marginTop: rnSpacing.md,
    },
    title: { flex: 1, fontSize: 22, fontWeight: '600', color: tk.text.primary },
    subtitle: { marginTop: rnSpacing.xs, fontSize: rnType.caption.size, color: tk.text.secondary },
    scroll: { paddingTop: rnSpacing.md, paddingBottom: 24 },
    centerBlock: {
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing['2xl'],
      flex: 1,
    },
    emptyBlock: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing['2xl'],
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    muted: { fontSize: rnType.label.size, color: tk.text.secondary },
    error: { fontSize: rnType.body.size, color: tk.danger.DEFAULT, paddingVertical: rnSpacing.md },
    articleCard: {
      flexDirection: 'row',
      gap: rnSpacing.md,
      padding: rnSpacing.md,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
      marginBottom: rnSpacing.md,
    },
    coverBox: {
      width: 132,
      height: 84,
      borderRadius: rnRadius.md,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tk.surface.muted,
    },
    coverImage: { width: '100%', height: '100%' },
    articleMain: { flex: 1, gap: rnSpacing.xs },
    articleTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
      flexWrap: 'wrap',
    },
    pinnedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      backgroundColor: tk.brandAccent.light,
      paddingHorizontal: 4,
      paddingVertical: 1,
      borderRadius: rnRadius.md,
    },
    pinnedText: { fontSize: rnType.caption.size, color: tk.brandAccent.deep, fontWeight: '500' },
    articleTitle: {
      fontSize: rnType.body.size,
      fontWeight: '600',
      color: tk.text.primary,
      flexShrink: 1,
    },
    articleSummary: { fontSize: rnType.label.size, color: tk.text.secondary },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
      flexWrap: 'wrap',
      marginTop: rnSpacing.xs,
    },
    metaText: { fontSize: rnType.caption.size, color: tk.text.secondary },
    viewBox: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    pagination: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: rnSpacing.sm,
      marginTop: rnSpacing.md,
    },
    pagerBtns: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
    pagerBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.medium,
    },
    pagerBtnDisabled: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.light,
      opacity: 0.5,
    },
    pagerText: { fontSize: rnType.label.size, color: tk.text.primary },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
