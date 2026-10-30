// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { FileText, Search } from 'lucide-react-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import type { TFunction } from '../../types'
import { getTokens, type AppThemeMode, type AppThemeTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'

const NS = 'knowledgeBaseSearchPage'

export interface KnowledgeBaseSearchRowView {
  id: string
  title: string
  summary: string | null
  categoryName: string | null
  /** 薄壳按 web 同参 Intl 格式化(web:month:'short' + day:'numeric')后的文本 */
  updatedText: string
}

export interface KnowledgeBaseSearchScreenProps {
  t: TFunction
  colorScheme: AppThemeMode
  onBack: () => void
  /** 非空即未登录门(与 web knowledge-base/search 的 AuthGatePrompt 同口径) */
  loginRequiredText: string
  /** 已提交的关键词(决定「请输入搜索关键词」空态与摘要) */
  query: string
  /** 输入框受控值 */
  keyword: string
  onKeywordChange: (value: string) => void
  onSubmit: () => void
  loading: boolean
  error: string | null
  rows: KnowledgeBaseSearchRowView[]
  total: number
  onOpenArticle: (id: string) => void
  onRetry: () => void
}

/**
 * 知识库搜索结果共享屏 —— 承载 web /knowledge-base/search(GET /api/knowledge-base?search=&pageSize=)。
 *
 * 与 web 的口径差(如实登记):web 用 <mark> 高亮命中词,RN 无等价内联高亮组件(需富文本切片),
 * 落在标题/摘要原文渲染;web 单页取 pageSize=50 无分页,RN 同参同单页;web 分类筛选取
 * ?category= 查询串,RN 入口由知识库列表屏带入(本屏只透传给薄壳)。
 * 平台无关:取数 / 登录态 / Intl 日期 / 关键词路由全部由薄壳注入,本文件只渲染三态与行。
 */
export function KnowledgeBaseSearchScreen({
  t,
  colorScheme,
  onBack,
  loginRequiredText,
  query,
  keyword,
  onKeywordChange,
  onSubmit,
  loading,
  error,
  rows,
  total,
  onOpenArticle,
  onRetry,
}: KnowledgeBaseSearchScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <View style={styles.titleRow}>
          <Search size={20} color={tk.brand.DEFAULT} />
          <Text style={styles.title}>{t(`${NS}.title`)}</Text>
        </View>
        {query ? (
          <Text style={styles.muted}>{t(`${NS}.resultSummary`, { q: query, count: total })}</Text>
        ) : null}
      </View>

      <View style={styles.searchBox}>
        <Search size={16} color={tk.text.tertiary} />
        <TextInput
          style={styles.input}
          value={keyword}
          onChangeText={onKeywordChange}
          onSubmitEditing={onSubmit}
          placeholder={t(`${NS}.searchPlaceholder`)}
          placeholderTextColor={tk.text.tertiary}
          returnKeyType="search"
          autoCapitalize="none"
          accessibilityLabel={t(`${NS}.searchPlaceholder`)}
        />
        <TouchableOpacity style={styles.searchBtn} onPress={onSubmit}>
          <Text style={styles.searchBtnText}>{t('common.search')}</Text>
        </TouchableOpacity>
      </View>

      {loginRequiredText ? (
        <Text style={styles.hint}>{loginRequiredText}</Text>
      ) : !query ? (
        <View style={styles.centerBlock}>
          <Search size={30} color={tk.text.tertiary} />
          <Text style={styles.muted}>{t(`${NS}.inputKeyword`)}</Text>
        </View>
      ) : loading ? (
        <View style={styles.centerBlock}>
          <ActivityIndicator size="small" color={tk.brand.DEFAULT} />
          <Text style={styles.muted}>{t(`${NS}.searching`)}</Text>
        </View>
      ) : error ? (
        <ScrollView contentContainerStyle={styles.centerBlock}>
          <Text style={styles.error}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={onRetry}>
            <Text style={styles.retryText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : rows.length === 0 ? (
        <View style={styles.centerBlock}>
          <FileText size={30} color={tk.text.tertiary} />
          <Text style={styles.muted}>{t(`${NS}.noResult`)}</Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.row} onPress={() => onOpenArticle(item.id)}>
              <Text style={styles.rowTitle} numberOfLines={2}>
                {item.title}
              </Text>
              {item.summary ? (
                <Text style={styles.rowSummary} numberOfLines={2}>
                  {item.summary}
                </Text>
              ) : null}
              <View style={styles.rowFoot}>
                {item.categoryName ? (
                  <Text style={styles.chip}>{item.categoryName}</Text>
                ) : (
                  <View />
                )}
                <Text style={styles.rowMuted}>{item.updatedText}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
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
    header: {
      gap: rnSpacing.xs,
      marginTop: rnSpacing.md,
    },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
    title: { fontSize: 22, fontWeight: '600', color: tk.text.primary },
    muted: { fontSize: rnType.label.size, color: tk.text.secondary },
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
      marginTop: rnSpacing.md,
      paddingHorizontal: rnSpacing.sm,
      borderWidth: 1,
      borderColor: tk.border.light,
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.card,
    },
    input: {
      flex: 1,
      paddingVertical: rnSpacing.sm,
      fontSize: rnType.body.size,
      color: tk.text.primary,
    },
    searchBtn: {
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: rnSpacing.xs,
      borderRadius: rnRadius.sm,
    },
    searchBtnText: { fontSize: rnType.label.size, fontWeight: '600', color: tk.brand.DEFAULT },
    hint: { marginTop: rnSpacing.xl, fontSize: rnType.body.size, color: tk.text.secondary },
    centerBlock: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing['2xl'],
    },
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
    list: { flex: 1, marginTop: rnSpacing.md },
    listContent: { paddingBottom: rnSpacing['2xl'] },
    row: {
      gap: rnSpacing.xs,
      marginBottom: rnSpacing.md,
      padding: rnSpacing.md,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    rowTitle: { fontSize: rnType.body.size, fontWeight: '600', color: tk.text.primary },
    rowSummary: { fontSize: rnType.caption.size, color: tk.text.secondary },
    rowFoot: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: rnSpacing.sm,
    },
    chip: {
      paddingHorizontal: rnSpacing.xs,
      paddingVertical: 2,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.surface.muted,
      fontSize: rnType.caption.size,
      color: tk.text.secondary,
    },
    rowMuted: { fontSize: rnType.caption.size, color: tk.text.tertiary },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
