// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import { rnRadius } from '@ihui/design-tokens'

import { useMemo } from 'react'
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import type { TFunction } from '@ihui/types'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'

/**
 * 列表项(结构对齐 @ihui/api-client KnowledgeDocSummary,wrapper 直接传其值)。
 */
export interface KnowledgeDocListItem {
  id: number
  title: string
  sourceType: string
  chunkCount: number
  createdAt: string | null
}

/**
 * KnowledgeBaseScreen 知识库文档列表(共享层)props 契约。
 * 平台无关:listKnowledgeDocs / deleteKnowledgeDoc 数据流、Alert 二次确认、导航由 wrapper 注入。
 */
export interface KnowledgeBaseScreenProps {
  t: TFunction
  /** 文档列表(ownerUuid=当前用户,wrapper 已拉取) */
  docs: KnowledgeDocListItem[]
  /** 首屏加载中(整屏 loading) */
  loading: boolean
  /** 下拉刷新中(RefreshControl) */
  refreshing: boolean
  /** 加载失败文案(非空渲染错误态 + 重试) */
  error: string
  /** 删除请求执行中(命中时删除按钮禁用) */
  deleting: boolean
  /** 下拉刷新 */
  onRefresh: () => void
  /** 错误态重试 */
  onRetry: () => void
  /** 打开文档详情(路由跳转由 wrapper 决定) */
  onOpenDoc: (doc: KnowledgeDocListItem) => void
  /** 删除文档(Alert 二次确认由 wrapper 处理) */
  onDeleteDoc: (doc: KnowledgeDocListItem) => void
  /** 新建文档入口 */
  onCreate: () => void
  /** 顶部返回 */
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/**
 * KnowledgeBaseScreen 知识库文档列表(共享层)
 *
 * 2026-09-15 承接 mobile-rn KnowledgeBaseScreen 1:1 迁移(web /knowledge-rag 移动端原生入口):
 * - 结构:顶部导航行(返回/标题/新建)→ 错误态(文案 + 重试)或 FlatList 文档卡
 *   (标题一行 + 切片数与日期元信息 + 删除按钮)+ 下拉刷新 + 空态提示
 * - 平台无关:API、删除确认 Alert、导航由 wrapper 注入
 * - 样式:getTokens(colorScheme) 语义 token(零 hex),对齐原屏 tailwind 间距(dp)
 * - i18n:沿用 knowledgeBase. 与 common.(mobile-rn i18n 既有 key)
 */
export function KnowledgeBaseScreen({
  t,
  docs,
  loading,
  refreshing,
  error,
  deleting,
  onRefresh,
  onRetry,
  onOpenDoc,
  onDeleteDoc,
  onCreate,
  onBack,
  colorScheme = 'light',
}: KnowledgeBaseScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const renderItem = ({ item }: { item: KnowledgeDocListItem }) => (
    <View style={styles.card}>
      <TouchableOpacity onPress={() => onOpenDoc(item)}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.cardMeta}>
          {item.chunkCount} {t('knowledgeBase.chunks')}
          {item.createdAt ? ` · ${String(item.createdAt).slice(0, 10)}` : ''}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => onDeleteDoc(item)}
        disabled={deleting}
        style={styles.deleteBtn}
        accessibilityRole="button"
        accessibilityLabel={t('knowledgeBase.delete')}
      >
        <Text style={styles.deleteText}>{t('knowledgeBase.delete')}</Text>
      </TouchableOpacity>
    </View>
  )

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* 顶部导航行:返回 / 标题 / 新建入口(跳转由 wrapper 的 onCreate 决定) */}
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.titleText}>{t('knowledgeBase.title')}</Text>
        <TouchableOpacity onPress={onCreate} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.addText}>{t('knowledgeBase.add')}</Text>
        </TouchableOpacity>
      </View>

      {error ? (
        <View style={styles.errorWrap}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={onRetry}>
            <Text style={styles.retryText}>{t('knowledgeBase.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList<KnowledgeDocListItem>
          data={docs}
          keyExtractor={(item) => String(item.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>{t('knowledgeBase.empty')}</Text>
              <Text style={styles.emptyHint}>{t('knowledgeBase.emptyHint')}</Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
          renderItem={renderItem}
        />
      )}
    </View>
  )
}

/**
 * 样式:对齐原 RN nativewind 布局(px-4/pt-3/pb-2/mb-3/rounded-lg/text-xs 等),
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
    loadingText: {
      fontSize: 14,
      color: tk.text.secondary,
    },
    /* 顶部导航行 */
    headerBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 8,
    },
    backText: {
      fontSize: 14,
      color: tk.text.secondary,
    },
    titleText: {
      fontSize: 16,
      fontWeight: '500',
      color: tk.text.primary,
    },
    addText: {
      fontSize: 14,
      fontWeight: '500',
      color: tk.brandAccent.deep,
    },
    /* 错误态 */
    errorWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
    },
    errorText: {
      marginBottom: 12,
      fontSize: 14,
      textAlign: 'center',
      color: tk.text.secondary,
    },
    retryBtn: {
      borderRadius: rnRadius.md,
      paddingHorizontal: 16,
      paddingVertical: 8,
      backgroundColor: tk.surface.muted,
    },
    retryText: {
      fontSize: 14,
      color: tk.text.primary,
    },
    /* 文档列表 */
    listContent: {
      padding: 16,
    },
    card: {
      marginBottom: 12,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
      padding: 16,
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: '500',
      color: tk.text.primary,
    },
    cardMeta: {
      marginTop: 4,
      fontSize: 12,
      color: tk.text.secondary,
    },
    deleteBtn: {
      marginTop: 8,
      alignSelf: 'flex-start',
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tk.danger.light,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    deleteText: {
      fontSize: 12,
      color: tk.danger.DEFAULT,
    },
    /* 空态 */
    empty: {
      alignItems: 'center',
      paddingVertical: 64,
    },
    emptyText: {
      fontSize: 14,
      color: tk.text.secondary,
    },
    emptyHint: {
      marginTop: 4,
      fontSize: 12,
      color: tk.text.tertiary,
    },
  } satisfies Record<string, ViewStyle | TextStyle>)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
