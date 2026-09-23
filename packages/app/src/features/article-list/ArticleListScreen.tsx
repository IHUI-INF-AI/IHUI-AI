// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useEffect, useMemo, useRef } from 'react'
import {
  Animated,
  Easing,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ViewStyle,
} from 'react-native'
import { AlertTriangle, Newspaper, RefreshCw } from 'lucide-react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { ArticleListItem, ArticleListScreenProps } from '../../types'

/** 文章列表/Props 类型 re-export(单一来源 @ihui/types) */
export type { ArticleListItem, ArticleListScreenProps }

/** 骨架屏卡片数量(模拟首屏可见区域的文章卡片数) */
const SKELETON_COUNT = 5

/**
 * 骨架屏卡片 — Animated.opacity pulse 呼吸动画(对齐 web animate-pulse 语义)。
 * 容器复用真实卡片样式(card),内部用灰色占位条模拟标题+元信息行,避免布局抖动。
 */
function SkeletonCard({
  card,
  titleBar,
  metaBar,
}: {
  card: ViewStyle
  titleBar: ViewStyle
  metaBar: ViewStyle
}) {
  const opacity = useRef(new Animated.Value(0.4)).current

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 750,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 750,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [opacity])

  return (
    <View style={card}>
      <Animated.View style={[titleA, { opacity }]} />
      <Animated.View style={[metaA, { opacity }]} />
    </View>
  )
}

/**
 * 文章列表共享屏 — props 注入式跨端组件
 *
 * 平台无关:负责渲染 header(返回 + 标题)+ 加载态(骨架屏)+ 错误态(重试)
 * + 文章卡片列表(title + author + views + publishedAt)
 * + 下拉刷新 + 空态(图标 + 引导文字 + 刷新按钮)。
 * 平台特定(导航 / API 调用)由 wrapper 通过 props 注入。
 *
 * 2026-09-23 修复:
 * - P1:首次加载改为骨架屏(Animated pulse),保持 header 框架可见,不再全灰屏
 * - P2:空状态添加 Newspaper 图标 + 引导文字 + 刷新按钮
 * - P3:错误状态添加 AlertTriangle 图标 + 重试按钮,框架保持可见
 */
export function ArticleListScreen({
  t,
  items,
  loading,
  refreshing,
  error,
  onRefresh,
  onPressItem,
  onBack,
  colorScheme = 'light',
}: ArticleListScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  /** 首次加载(无数据时的 loading 态)→ 骨架屏 */
  const showSkeleton = loading && items.length === 0
  /** 错误态(无数据时的 error)→ 居中错误提示 + 重试 */
  const showError = !loading && error.length > 0 && items.length === 0

  return (
    <View style={styles.container}>
      {/* header 始终渲染 — 保持页面框架可见(修复 P1 全灰屏连导航消失) */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('articleList.title')}</Text>
      </View>

      {/* 内容区:根据状态条件渲染,header 框架始终可见 */}
      {showSkeleton ? (
        /* P1 修复:骨架屏替代纯文字"加载中...",模拟文章卡片占位 */
        <View style={styles.listBody}>
          {Array.from({ length: SKELETON_COUNT }, (_, i) => (
            <SkeletonCard
              key={`skeleton-${i}`}
              card={styles.card}
              titleBar={styles.skeletonTitle}
              metaBar={styles.skeletonMeta}
            />
          ))}
        </View>
      ) : showError ? (
        /* P3 修复:错误态居中显示图标 + 错误文字 + 重试按钮 */
        <View style={styles.centerWrap}>
          <AlertTriangle size={48} color={tk.text.tertiary} />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable
            style={styles.actionBtn}
            onPress={onRefresh}
            accessibilityRole="button"
            accessibilityLabel={t('common.retry')}
          >
            <RefreshCw size={16} color={tk.surface.light} />
            <Text style={styles.actionBtnTextPrimary}>{t('common.retry')}</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList<ArticleListItem>
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listBody}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            /* P2 修复:空状态添加 Newspaper 图标 + 引导文字 + 刷新按钮 */
            <View style={styles.centerWrap}>
              <Newspaper size={48} color={tk.text.tertiary} />
              <Text style={styles.emptyText}>{t('articleList.empty')}</Text>
              <Pressable
                style={styles.refreshBtn}
                onPress={onRefresh}
                accessibilityRole="button"
                accessibilityLabel={t('common.retry')}
              >
                <RefreshCw size={16} color={tk.text.secondary} />
                <Text style={styles.refreshBtnText}>{t('common.retry')}</Text>
              </Pressable>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => onPressItem(item)}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            >
              <Text style={styles.cardTitle} numberOfLines={2}>
                {item.title}
              </Text>
              <View style={styles.metaRow}>
                <Text style={styles.author}>{item.author}</Text>
                <Text style={styles.meta}>
                  {t('articleList.views', { count: item.views })} · {item.publishedAt}
                </Text>
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
    container: { flex: 1, backgroundColor: tk.surface.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 12,
      gap: 12,
    },
    backText: { fontSize: 16, color: tk.text.medium },
    title: { flex: 1, fontSize: 20, fontWeight: '700', color: tk.text.primary },
    errorText: { paddingHorizontal: 10, fontSize: 14, color: tk.danger.DEFAULT },
    center: { alignItems: 'center', paddingVertical: 48 },
    muted: { fontSize: 14, color: tk.text.secondary, marginTop: 8 },
    listBody: { padding: 10 },
    separator: { height: 12 },
    card: {
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
    },
    cardTitle: { fontSize: 16, fontWeight: '600', color: tk.text.primary },
    metaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 8,
    },
    author: { fontSize: 11, color: tk.text.tertiary },
    meta: { fontSize: 11, color: tk.text.tertiary },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
