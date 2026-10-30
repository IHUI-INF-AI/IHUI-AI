import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'

import { useEffect, useMemo, useState } from 'react'
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { ArrowLeft, Search } from 'lucide-react-native'
import type { TFunction } from '@ihui/types'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import { EmptyState, ErrorState } from '../../components/ScreenStates'

/**
 * 检索命中项(结构对齐 @ihui/api-client KBArticleListItem,wrapper 直接传其值)。
 * 列集 = apps/api/src/routes/other/knowledge-base-routes.ts:66-74 的显式 select,
 * 后端列表接口不返回 content,故本屏只渲染摘要(不做正文预览)。
 */
export interface KBArticleSearchItem {
  id: string
  title: string
  summary: string | null
  categoryName: string | null
  updatedAt: string | null
}

/**
 * KBArticleSearchScreen 知识库文章检索(共享层)props 契约。
 * 平台无关:listKBArticles 数据流、关键词与路由参数同步、导航由 wrapper 注入。
 */
export interface KBArticleSearchScreenProps {
  t: TFunction
  /** 已提交的检索词(来自路由参数;空串 = 还没搜) */
  keyword: string
  /** 命中列表(未搜 / 搜空都是 []) */
  items: KBArticleSearchItem[]
  /** 命中总数(后端 total,非本页条数) */
  total: number
  /** 检索请求进行中(web isLoading 同位;未提交关键词时忽略) */
  searching: boolean
  /** 加载失败文案(非空渲染错误态 + 重试) */
  error: string
  /** 未登录:数据区替换为登录引导(web AuthGatePrompt 同口径) */
  requiresLogin: boolean
  /** 提交检索(由 wrapper 写回路由参数,与 web router.push 同形) */
  onSubmit: (keyword: string) => void
  /** 打开文章详情 */
  onOpenArticle: (item: KBArticleSearchItem) => void
  /** 去登录 */
  onLogin: () => void
  /** 错误态重试(按当前关键词重查) */
  onRetry: () => void
  /** 返回知识库列表(与 web t('knowledgeBase.search.backToKb') 同口径) */
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/**
 * 关键词命中文本切片(对齐 web search/PageClient.tsx:33-49 的 <Highlight>)。
 * web 用 `split(转义后的关键词正则)` + 大小写不敏感比较;本实现同语义但不引正则:
 * 逐段按 indexOf(小写)切分,避免用户输入里的 `*` `(` 等被当元字符(语义等价、更稳)。
 */
function splitByKeyword(text: string, kw: string): { part: string; hit: boolean }[] {
  const needle = kw.trim().toLowerCase()
  if (!needle) return [{ part: text, hit: false }]
  const out: { part: string; hit: boolean }[] = []
  const lower = text.toLowerCase()
  let cursor = 0
  for (;;) {
    const at = lower.indexOf(needle, cursor)
    if (at < 0) break
    if (at > cursor) out.push({ part: text.slice(cursor, at), hit: false })
    out.push({ part: text.slice(at, at + needle.length), hit: true })
    cursor = at + needle.length
  }
  if (cursor < text.length) out.push({ part: text.slice(cursor), hit: false })
  return out
}

/**
 * KBArticleSearchScreen 知识库文章检索结果页(共享层)
 *
 * 2026-10-26 承载 web `/knowledge-base/search`
 * (apps/web/app/(main)/knowledge-base/search/PageClient.tsx):
 * - 结构:返回行 → 标题 + 摘要行 → 搜索表单 → 结果区。
 * - 结果区分档与 web :121-167 判定顺序逐档对齐:
 *   登录引导 → 未输入关键词 → 搜索中(loading)→ 错误 + 重试 → 空结果 → 命中列表。
 * - 摘要行:web `resultSummary` 传 { q, count },count 取后端 total(不是 items.length)。
 * - 搜索提交:web 的表单只有 Enter 提交(:85-89 handleSearch),没有独立按钮 ⇒
 *   本屏同样只提供 returnKeyType="search"(造一个没有文案出处的按钮 = 假控件)。
 * - 样式:getTokens(colorScheme) 语义 token(零 hex)。命中底色取 tk.warning.amberLight,
 *   对齐 web `bg-yellow-200/70 dark:bg-yellow-500/30` 的琥珀底同族档(亮档 #fef3c7)。
 * - i18n:本屏只用 kbArticleSearchPage.*(值逐字抄 web knowledgeBase.search.* /
 *   knowledgeBase.searchPlaceholder / chatHistory.loginRequired)。
 */
export function KBArticleSearchScreen({
  t,
  keyword,
  items,
  total,
  searching,
  error,
  requiresLogin,
  onSubmit,
  onOpenArticle,
  onLogin,
  onRetry,
  onBack,
  colorScheme = 'light',
}: KBArticleSearchScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  const [input, setInput] = useState(keyword)

  // 与 web :63 `useEffect(() => setInput(q), [q])` 同形:路由参数变了才回填,输入中不打断
  useEffect(() => setInput(keyword), [keyword])

  const submit = () => {
    const kw = input.trim()
    if (kw) onSubmit(kw)
  }

  const renderItem = ({ item }: { item: KBArticleSearchItem }) => (
    <TouchableOpacity
      onPress={() => onOpenArticle(item)}
      accessibilityRole="button"
      accessibilityLabel={item.title}
    >
      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          {splitByKeyword(item.title, keyword).map((seg, i) => (
            <Text key={i} style={seg.hit ? styles.mark : undefined}>
              {seg.part}
            </Text>
          ))}
        </Text>
        {item.summary ? (
          <Text style={styles.cardDesc} numberOfLines={2}>
            {splitByKeyword(item.summary, keyword).map((seg, i) => (
              <Text key={i} style={seg.hit ? styles.mark : undefined}>
                {seg.part}
              </Text>
            ))}
          </Text>
        ) : null}
        <View style={styles.cardFooter}>
          {item.categoryName ? (
            <View style={styles.categoryChip}>
              <Text style={styles.categoryText}>{item.categoryName}</Text>
            </View>
          ) : (
            <View />
          )}
          <Text style={styles.cardDate}>
            {item.updatedAt ? String(item.updatedAt).slice(0, 10) : '-'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  )

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={onBack}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel={t('kbArticleSearchPage.backToKb')}
        style={styles.headerBar}
      >
        <View style={styles.backRow}>
          <ArrowLeft size={rnType.body.size} color={tk.text.secondary} />
          <Text style={styles.backText}>{t('kbArticleSearchPage.backToKb')}</Text>
        </View>
      </TouchableOpacity>

      <View style={styles.titleRow}>
        <Search size={rnType.subtitle.size} color={tk.brandAccent.deep} />
        <Text style={styles.titleText}>{t('kbArticleSearchPage.title')}</Text>
      </View>
      {keyword ? (
        <Text style={styles.summaryText}>
          {t('kbArticleSearchPage.resultSummary', { q: keyword, count: total })}
        </Text>
      ) : null}

      <View style={styles.searchRow}>
        <Search size={rnType.body.size} color={tk.text.tertiary} />
        <TextInput
          value={input}
          onChangeText={setInput}
          onSubmitEditing={submit}
          placeholder={t('kbArticleSearchPage.searchPlaceholder')}
          placeholderTextColor={tk.text.tertiary}
          returnKeyType="search"
          style={styles.input}
          accessibilityLabel={t('kbArticleSearchPage.searchPlaceholder')}
        />
      </View>

      {requiresLogin ? (
        <EmptyState
          title={t('kbArticleSearchPage.loginRequired')}
          actionLabel={t('common.login')}
          onAction={onLogin}
          colorScheme={colorScheme}
        />
      ) : !keyword.trim() ? (
        <EmptyState title={t('kbArticleSearchPage.inputKeyword')} colorScheme={colorScheme} />
      ) : searching ? (
        <View style={styles.inlineState}>
          <Text style={styles.inlineStateText}>{t('kbArticleSearchPage.searching')}</Text>
        </View>
      ) : error ? (
        <ErrorState
          message={error}
          onRetry={onRetry}
          retryLabel={t('common.retry')}
          colorScheme={colorScheme}
        />
      ) : (
        <FlatList<KBArticleSearchItem>
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <EmptyState title={t('kbArticleSearchPage.noResult')} colorScheme={colorScheme} />
          }
        />
      )}
    </View>
  )
}

/**
 * 样式:对齐 web search/PageClient.tsx 的 tailwind 语义档(px-4 / text-2xl 标题 /
 * text-xs 元信息 / rounded-lg 卡片 / space-y-3),颜色全部走 AppThemeTokens,零 hex。
 */
function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: tk.surface.bg,
      paddingHorizontal: rnSpacing.lg,
    },
    headerBar: {
      paddingTop: rnSpacing.md,
      paddingBottom: rnSpacing.xs,
      alignSelf: 'flex-start',
    },
    backRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.xs,
    },
    backText: {
      ...rnType.body,
      color: tk.text.secondary,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
      marginTop: rnSpacing.xs,
    },
    titleText: {
      ...rnType.heading,
      color: tk.text.primary,
    },
    summaryText: {
      ...rnType.label,
      color: tk.text.secondary,
      marginTop: rnSpacing.xs,
    },
    /* 搜索表单 */
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
      marginTop: rnSpacing.md,
      marginBottom: rnSpacing.sm,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.inputBg,
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: rnSpacing.xs,
    },
    input: {
      ...rnType.body,
      flex: 1,
      color: tk.text.primary,
      paddingVertical: rnSpacing.xs,
    },
    /* 结果列表 */
    listContent: {
      paddingBottom: rnSpacing.xl,
    },
    card: {
      marginBottom: rnSpacing.md,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
      padding: rnSpacing.lg,
    },
    cardTitle: {
      ...rnType.strong,
      color: tk.text.primary,
    },
    cardDesc: {
      ...rnType.body,
      color: tk.text.secondary,
      marginTop: rnSpacing.xs,
    },
    /* 命中高亮:对齐 web bg-yellow-200/70 dark:bg-yellow-500/30(琥珀底同族档) */
    mark: {
      backgroundColor: tk.warning.amberLight,
      color: tk.text.primary,
    },
    cardFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: rnSpacing.sm,
    },
    categoryChip: {
      borderRadius: rnRadius.sm,
      backgroundColor: tk.surface.muted,
      paddingHorizontal: rnSpacing.xs,
      paddingVertical: 2,
    },
    categoryText: {
      ...rnType.label,
      color: tk.text.secondary,
    },
    cardDate: {
      ...rnType.label,
      color: tk.text.tertiary,
    },
    /* 行内 loading 态 */
    inlineState: {
      paddingVertical: rnSpacing.xl,
      alignItems: 'center',
    },
    inlineStateText: {
      ...rnType.body,
      color: tk.text.secondary,
    },
  } satisfies Record<string, ViewStyle | TextStyle>)
}
