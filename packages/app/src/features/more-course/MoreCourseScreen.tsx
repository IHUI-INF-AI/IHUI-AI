// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import {
  View,
  Text,
  Image,
  FlatList,
  RefreshControl,
  Pressable,
  StyleSheet,
  type ImageSourcePropType,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import { BookOpen } from 'lucide-react-native'
import type { MoreCourseScreenProps } from '../../types'
import { BannerCarousel } from '../_shared/BannerCarousel'

import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { BackChevron } from '../../components/BackChevron'
import { EmptyState, ErrorState, ScreenSkeleton } from '../../components/ScreenStates'

/** MoreCourseScreen props re-export(单一来源 @ihui/types) */
export type { MoreCourseScreenProps }

/** 知识星球资讯条目（由薄壳用 `/api/knowledge-planet/news` 映射后注入） */
export interface MoreCoursePlanetItem {
  id: string
  title: string
  cover?: string
  summary?: string
  createdAt: number
}

/** 知识星球区块：items 为空也保留标题栏与「进入星球」入口（与旧端内组件一致） */
export interface MoreCoursePlanetSection {
  items: readonly MoreCoursePlanetItem[]
  onEnter?: () => void
  onItemPress?: (id: string) => void
}

function formatPrice(price: number, isFree: boolean): string {
  if (isFree || price <= 0) return '免费'
  return `¥${price.toFixed(2)}`
}

export function MoreCourseScreen({
  t,
  items,
  loading,
  refreshing,
  loadingMore,
  error,
  total,
  onRefresh,
  onEndReached,
  onPressItem,
  onBack,
  onRetry,
  bannerImages,
  planet,
  colorScheme = 'light'
}: MoreCourseScreenProps & {
  onRetry?: () => void
  bannerImages?: readonly ImageSourcePropType[]
  planet?: MoreCoursePlanetSection
}) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const initialLoading = loading && items.length === 0 && !refreshing

  const renderCard = ({ item }: { item: (typeof items)[number] }) => (
    // 按压态样式**不得写在 Pressable 的 style 上**(守门 131 那一型):Pressable 注册过
    // cssInterop,函数形态声明被 `{ ...declaration }` 清成 `{}`,卡面底色/圆角/overflow 裁切
    // 静默消失。这份表里 card 是**纯视觉档**(无 margin/flex),外层在列表 column 里默认撑满宽度
    // ⇒ 整档下移到内层,盒子宽高与封面圆角裁切范围逐像素不变。
    <Pressable onPress={() => onPressItem({ id: String(item.id), title: item.title })}>
      {({ pressed }) => (
        <View style={[styles.card, pressed ? styles.cardPressed : null]}>
          {item.cover ? (
            <View style={styles.cover} />
          ) : (
            <View style={[styles.cover, styles.coverFallback]}>
              <BookOpen size={40} color={tk.text.medium} />
            </View>
          )}
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {item.title}
            </Text>
            <View style={styles.metaRow}>
              <Text style={styles.instructor} numberOfLines={1}>
                {'讲师:' + (item.instructor || '匿名')}
              </Text>
              <Text style={styles.lessonCount}>{item.lessonCount ?? 0} 课时</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.price}>{formatPrice(item.price, item.isFree)}</Text>
              <Text style={styles.studentCount}>
                {(item.studentCount ?? 0) > 0 ? `${item.studentCount} 人学过` : ''}
              </Text>
            </View>
          </View>
        </View>
      )}
    </Pressable>
  )

  const renderPlanetItem = (item: MoreCoursePlanetItem) => {
    const body = (
      <View style={styles.planetRow}>
        {item.cover ? (
          <Image source={{ uri: item.cover }} style={styles.planetCover} resizeMode="cover" />
        ) : (
          <View style={[styles.planetCover, styles.planetCoverFallback]}>
            <BookOpen size={20} color={tk.text.medium} />
          </View>
        )}
        <View style={styles.planetBody}>
          <Text style={styles.planetItemTitle} numberOfLines={1}>
            {item.title}
          </Text>
          {item.summary ? (
            <Text style={styles.planetSummary} numberOfLines={2}>
              {item.summary}
            </Text>
          ) : null}
        </View>
      </View>
    )
    return planet?.onItemPress ? (
      <Pressable
        key={item.id}
        onPress={() => planet.onItemPress?.(item.id)}
        accessibilityRole="button"
        accessibilityLabel={item.title}
      >
        {body}
      </Pressable>
    ) : (
      <View key={item.id}>{body}</View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.title}>更多课程</Text>
        {total > 0 ? <Text style={styles.countText}>{`共${total}门`}</Text> : null}
      </View>
      {initialLoading ? (
        <ScreenSkeleton variant="card" count={4} colorScheme={colorScheme} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderCard}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colorScheme === 'dark' ? tk.text.tertiary : tk.text.secondary}
            />
          }
          onEndReached={onEndReached}
          onEndReachedThreshold={0.3}
          ListHeaderComponent={
            bannerImages?.length ? <BannerCarousel images={bannerImages} /> : null
          }
          ListEmptyComponent={
            error ? (
              <ErrorState
                message={error}
                onRetry={onRetry}
                retryLabel={t('common.retry')}
                colorScheme={colorScheme}
              />
            ) : (
              <EmptyState title="暂无课程,敬请期待" colorScheme={colorScheme} />
            )
          }
          ListFooterComponent={
            <>
              {loadingMore ? (
                <View style={styles.footerLoading}>
                  <Text style={styles.footerText}>加载更多...</Text>
                </View>
              ) : null}
              {planet ? (
                <View style={styles.planetSection}>
                  <View style={styles.planetHeader}>
                    <Text style={styles.planetTitle}>知识星球</Text>
                    {planet.onEnter ? (
                      <Pressable
                        onPress={planet.onEnter}
                        accessibilityRole="button"
                        accessibilityLabel="进入星球"
                      >
                        <Text style={styles.planetEnter}>进入星球</Text>
                      </Pressable>
                    ) : null}
                  </View>
                  {planet.items.map(renderPlanetItem)}
                </View>
              ) : null}
            </>
          }
        />
      )}
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg } as ViewStyle,
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: rnSpacing['sm-loose'],
      paddingBottom: rnSpacing.md,
      gap: rnSpacing.md,
    },
    title: {
      fontSize: rnType.heading.size,
      fontWeight: '600',
      color: tk.text.primary,
    } as TextStyle,
    countText: {
      fontSize: rnType.body.size,
      color: tk.text.tertiary,
      marginLeft: 'auto',
    } as TextStyle,
    listContent: {
      paddingHorizontal: rnSpacing['sm-loose'],
      paddingVertical: rnSpacing.md,
      gap: rnSpacing.md,
    } as ViewStyle,
    card: {
      backgroundColor: tk.surface.light,
      borderRadius: rnRadius.lg,
      overflow: 'hidden',
    } as ViewStyle,
    cardPressed: { backgroundColor: tk.surface.muted } as ViewStyle,
    cover: { width: '100%', height: 160, backgroundColor: tk.surface.muted } as ImageStyle,
    coverFallback: {
      alignItems: 'center',
      justifyContent: 'center',
    } as ViewStyle,
    cardBody: { padding: rnSpacing.md, gap: rnSpacing['xs-loose'] } as ViewStyle,
    cardTitle: {
      fontSize: rnType.title.size,
      fontWeight: '600',
      color: tk.text.primary,
      lineHeight: 20,
    } as TextStyle,
    metaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    } as ViewStyle,
    instructor: { fontSize: rnType.body.size, color: tk.text.medium, flex: 1 } as TextStyle,
    lessonCount: { fontSize: rnType.label.size, color: tk.text.tertiary } as TextStyle,
    price: {
      fontSize: rnType.subtitle.size,
      fontWeight: '700',
      color: tk.brand.DEFAULT,
    } as TextStyle,
    studentCount: { fontSize: rnType.label.size, color: tk.text.tertiary } as TextStyle,
    footerLoading: { paddingVertical: rnSpacing.md, alignItems: 'center' } as ViewStyle,
    footerText: { fontSize: rnType.body.size, color: tk.text.secondary } as TextStyle,
    planetSection: {
      marginTop: rnSpacing.lg,
      padding: rnSpacing.md,
      borderRadius: rnRadius.lg,
      backgroundColor: tk.surface.light,
    } as ViewStyle,
    planetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: rnSpacing.md,
    } as ViewStyle,
    planetTitle: {
      fontSize: rnType.subtitle.size,
      fontWeight: '600',
      color: tk.text.primary,
    } as TextStyle,
    planetEnter: { fontSize: rnType.body.size, color: tk.brand.DEFAULT } as TextStyle,
    planetRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
    } as ViewStyle,
    planetCover: {
      width: 72,
      height: 48,
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
    } as ImageStyle,
    planetCoverFallback: { alignItems: 'center', justifyContent: 'center' } as ViewStyle,
    planetBody: { flex: 1, gap: rnSpacing['xs-loose'] } as ViewStyle,
    planetItemTitle: {
      fontSize: rnType.body.size,
      fontWeight: '600',
      color: tk.text.primary,
    } as TextStyle,
    planetSummary: { fontSize: rnType.label.size, color: tk.text.secondary } as TextStyle,
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
