// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import { rnRadius } from '@ihui/design-tokens'

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
import type { TFunction } from '@ihui/types'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'

/**
 * 文档详情(结构对齐 @ihui/api-client KnowledgeDocDetail,wrapper 直接传其值)。
 */
export interface KnowledgeDocDetailItem {
  id: number
  title: string
  sourceType: string
  chunkCount: number
  createdAt: string | null
  sourcePath: string | null
  contentHash: string | null
}

/**
 * 切片预览项(结构对齐 @ihui/api-client KnowledgeChunkPreview)。
 */
export interface KnowledgeChunkPreviewItem {
  id: number
  chunkIndex: number
  content: string
}

/**
 * KnowledgeDocScreen 知识库文档详情(共享层)props 契约。
 * 平台无关:getKnowledgeDoc / getKnowledgeDocChunks 数据流、路由参数、导航由 wrapper 注入。
 */
export interface KnowledgeDocScreenProps {
  t: TFunction
  /** 标题(来自路由参数,顶部居中展示) */
  title: string
  /** 文档详情(加载中或失败为 null) */
  doc: KnowledgeDocDetailItem | null
  /** 切片预览(wrapper 拉取前 10 条,失败时为空数组) */
  chunks: KnowledgeChunkPreviewItem[]
  /** 首屏加载中(整屏 loading) */
  loading: boolean
  /** 加载失败文案(非空在内容区渲染错误态 + 重试) */
  error: string
  /** 错误态重试 */
  onRetry: () => void
  /** 顶部返回 */
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/**
 * KnowledgeDocScreen 知识库文档详情(共享层)
 *
 * 2026-09-15 承接 mobile-rn KnowledgeDocScreen 1:1 迁移(详情 + 切片预览):
 * - 结构:顶部导航行(返回/标题/占位)→ 内容区:元信息(切片数与日期 + 来源类型)
 *   → 切片预览区块(切片序号 + 内容卡)→ 加载失败错误态(文案 + 重试)
 * - 平台无关:API、导航由 wrapper 注入
 * - 样式:getTokens(colorScheme) 语义 token(零 hex),对齐原屏 tailwind 间距(dp)
 * - i18n:沿用 knowledgeDoc. 与 common.(mobile-rn i18n 既有 key)
 */
export function KnowledgeDocScreen({
  t,
  title,
  doc,
  chunks,
  loading,
  error,
  onRetry,
  onBack,
  colorScheme = 'light',
}: KnowledgeDocScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* 顶部导航行:返回 / 标题(路由参数)/ 右侧占位 */}
      <View style={styles.headerBar}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scroll}>
        {error ? (
          <View style={styles.errorWrap}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={onRetry}>
              <Text style={styles.retryText}>{t('knowledgeDoc.retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : doc ? (
          <>
            <Text style={styles.metaText}>
              {doc.chunkCount} {t('knowledgeDoc.chunksTotal')}
              {doc.createdAt ? ` · ${String(doc.createdAt).slice(0, 10)}` : ''}
            </Text>
            <Text style={styles.metaText}>
              {t('knowledgeDoc.source')}: {doc.sourceType}
            </Text>

            <Text style={styles.previewTitle}>{t('knowledgeDoc.preview')}</Text>
            {chunks.length === 0 ? (
              <Text style={styles.noChunks}>{t('knowledgeDoc.noChunks')}</Text>
            ) : (
              chunks.map((c) => (
                <View key={c.id} style={styles.chunkCard}>
                  <Text style={styles.chunkIndex}>#{c.chunkIndex + 1}</Text>
                  <Text style={styles.chunkContent}>{c.content}</Text>
                </View>
              ))
            )}
          </>
        ) : null}
      </ScrollView>
    </View>
  )
}

/**
 * 样式:对齐原 RN nativewind 布局(px-4/pt-2/mt-5/leading-6/text-xs 等),
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
    headerTitle: {
      maxWidth: '60%',
      fontSize: 16,
      fontWeight: '500',
      color: tk.text.primary,
    },
    headerSpacer: {
      width: 40,
    },
    /* 内容区 */
    scroll: {
      flex: 1,
      paddingHorizontal: 16,
      paddingTop: 8,
    },
    metaText: {
      fontSize: 12,
      color: tk.text.tertiary,
    },
    previewTitle: {
      marginTop: 20,
      marginBottom: 8,
      fontSize: 14,
      fontWeight: '500',
      color: tk.text.medium,
    },
    noChunks: {
      fontSize: 14,
      color: tk.text.tertiary,
    },
    chunkCard: {
      marginBottom: 12,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
      padding: 12,
    },
    chunkIndex: {
      fontSize: 12,
      color: tk.text.tertiary,
    },
    chunkContent: {
      marginTop: 4,
      fontSize: 14,
      lineHeight: 24,
      color: tk.text.medium,
    },
    /* 错误态 */
    errorWrap: {
      alignItems: 'center',
      paddingVertical: 64,
    },
    errorText: {
      fontSize: 14,
      textAlign: 'center',
      color: tk.text.secondary,
    },
    retryBtn: {
      marginTop: 12,
      borderRadius: rnRadius.md,
      paddingHorizontal: 16,
      paddingVertical: 8,
      backgroundColor: tk.surface.muted,
    },
    retryText: {
      fontSize: 14,
      color: tk.text.primary,
    },
  } satisfies Record<string, ViewStyle | TextStyle>)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
