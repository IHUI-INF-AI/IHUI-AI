// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Calendar, Eye, FileText, Tag } from 'lucide-react-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import type { TFunction } from '../../types'
import { getTokens, type AppThemeMode, type AppThemeTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'

const NS = 'knowledgeBaseDetailPage'

export interface KnowledgeBaseArticleView {
  title: string
  summary: string | null
  /** web 用 MarkdownViewer 渲染;RN 无 markdown 渲染器,这里按纯文本正文渲染(口径差如实登记) */
  content: string
  categoryName: string | null
  authorName: string | null
  /** 薄壳按 web 同参 Intl 格式化(web:year:'numeric' + month:'long' + day:'numeric')后的文本 */
  updatedText: string
  viewCount: number
  tags: string[]
}

export interface KnowledgeBaseArticleScreenProps {
  t: TFunction
  colorScheme: AppThemeMode
  onBack: () => void
  loading: boolean
  error: string | null
  /** null = 后端 404/未命中 → 渲染「文章不存在」空态 */
  article: KnowledgeBaseArticleView | null
  onRetry: () => void
}

/**
 * 知识库文章详情共享屏 —— 承载 web /knowledge-base/[id](GET /api/knowledge-base/:id)。
 *
 * 后端信封是 success({ item })(apps/api/src/routes/other/knowledge-base-routes.ts:144),
 * 而 web 页按 { article, prev, next } 解析(同仓 web PageClient.tsx:31-35)⇒ web 侧恒 undefined;
 * 本屏按**后端真实信封**渲染 data.item。
 * 与 web 的口径差(如实登记):
 *  - 后端不返回 prev/next ⇒ 不渲染「上一篇/下一篇」,不造假导航;
 *  - 后端行不含 tags ⇒ 标签区按空集渲染,不做伪标签;
 *  - 后端只回 categoryId 不回 categoryName(knowledge-base-routes.ts:133-137 为全列 select)⇒ 分类位只在
 *    薄壳能补名时显示,否则隐藏;
 *  - web 右栏「目录」靠 markdown 锚点(RN 无渲染器)⇒ 省略,不放假目录。
 * 平台无关:取数 / Intl 日期 / 错误文案由薄壳注入,本文件只渲染 loading / error / empty / 正文。
 */
export function KnowledgeBaseArticleScreen({
  t,
  colorScheme,
  onBack,
  loading,
  error,
  article,
  onRetry,
}: KnowledgeBaseArticleScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
      </View>

      {loading ? (
        <View style={styles.centerBlock}>
          <ActivityIndicator size="small" color={tk.brand.DEFAULT} />
          <Text style={styles.muted}>{t('common.loading')}</Text>
        </View>
      ) : error ? (
        <ScrollView contentContainerStyle={styles.centerBlock}>
          <Text style={styles.error}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={onRetry}>
            <Text style={styles.retryText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : !article ? (
        <View style={styles.centerBlock}>
          <FileText size={30} color={tk.text.tertiary} />
          <Text style={styles.muted}>{t(`${NS}.notFound`)}</Text>
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <Text style={styles.title}>{article.title}</Text>
          {article.summary ? <Text style={styles.summary}>{article.summary}</Text> : null}

          <View style={styles.metaRow}>
            {article.authorName ? <Text style={styles.meta}>{article.authorName}</Text> : null}
            {article.categoryName ? <Text style={styles.chip}>{article.categoryName}</Text> : null}
            <View style={styles.metaInline}>
              <Calendar size={14} color={tk.text.secondary} />
              <Text style={styles.meta}>{article.updatedText}</Text>
            </View>
            <View style={styles.metaInline}>
              <Eye size={14} color={tk.text.secondary} />
              <Text style={styles.meta}>{t(`${NS}.viewCount`, { count: article.viewCount })}</Text>
            </View>
          </View>

          {article.tags.length > 0 ? (
            <View style={styles.tagRow}>
              {article.tags.map((tag) => (
                <View key={tag} style={styles.tag}>
                  <Tag size={12} color={tk.brand.DEFAULT} />
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.card}>
            {article.content ? (
              <Text style={styles.content}>{article.content}</Text>
            ) : (
              <Text style={styles.muted}>{t(`${NS}.notFound`)}</Text>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: tk.surface.bg,
      paddingHorizontal: rnSpacing.md,
    },
    header: { marginTop: rnSpacing.md },
    centerBlock: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing['2xl'],
    },
    muted: { fontSize: rnType.label.size, color: tk.text.secondary, textAlign: 'center' },
    error: { fontSize: rnType.body.size, color: tk.danger.DEFAULT, textAlign: 'center' },
    retryBtn: {
      marginTop: rnSpacing.xs,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.xs,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    retryText: { fontSize: rnType.label.size, color: tk.brand.DEFAULT },
    scroll: { flex: 1, marginTop: rnSpacing.sm },
    scrollContent: { gap: rnSpacing.sm, paddingBottom: rnSpacing['2xl'] },
    title: { fontSize: 22, fontWeight: '700', color: tk.text.primary },
    summary: { fontSize: rnType.caption.size, color: tk.text.secondary },
    metaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: rnSpacing.sm,
    },
    metaInline: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.xs },
    meta: { fontSize: rnType.caption.size, color: tk.text.secondary },
    chip: {
      paddingHorizontal: rnSpacing.xs,
      paddingVertical: 2,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.surface.muted,
      fontSize: rnType.caption.size,
      color: tk.text.secondary,
    },
    tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: rnSpacing.xs },
    tag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: 2,
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.card,
    },
    tagText: { fontSize: rnType.caption.size, color: tk.brand.DEFAULT },
    card: {
      padding: rnSpacing.md,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    content: {
      fontSize: rnType.body.size,
      lineHeight: rnType.body.lineHeight,
      color: tk.text.primary,
    },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
