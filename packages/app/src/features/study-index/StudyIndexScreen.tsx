/**
 * StudyIndexScreen AI 视频页(共享层,平台无关 UI)
 *
 * 对齐 mobile-rn StudyIndexScreen 核心 UI:
 * - index 预览态:TipBanner 滚动 + 推荐模型前 3 + 最新课程前 3 + 各自「查看更多」
 * - study 全屏态:双列视频卡片(封面/标题/时长/讲师/相对时间)
 * - 赛道分类 chip 切换(替代 SingleTypeBar,保持平台无关)
 * - 搜索输入框 + 下拉刷新 + 上拉分页 + 空态/加载态/错误重试
 * - 浅色优雅风,圆角守门(无 rounded-full);无分割线(gap 间距)
 */
import { useMemo, useEffect, useRef } from 'react'
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'

/** 赛道分类 */
export interface StudyTrackCategory {
  id: string
  name: string
}

/** 学习视频项 */
export interface StudyVideoItem {
  id: string | number
  courseId?: string | number
  title: string
  name?: string
  cover?: string
  teacherName?: string
  avatar?: string
  createdAt?: string
}

/** 模型预览项(简化,对齐 ModelListItem 子集) */
export interface StudyModelPreview {
  id: string
  name: string
  description: string
  icon?: string
  isFree?: boolean
}

/** StudyIndexScreen props(wrapper 注入数据+回调) */
export interface StudyIndexScreenProps {
  colorScheme?: 'light' | 'dark'
  items: StudyVideoItem[]
  refreshing: boolean
  loadingMore: boolean
  error: string
  total: number
  searchInput: string
  showSearch: boolean
  pageType: 'index' | 'model' | 'study'
  activeCategory: string
  previewModels: StudyModelPreview[]
  previewItems: StudyVideoItem[]
  initialLoading: boolean
  trackCategories: readonly StudyTrackCategory[]
  onRefresh: () => void
  onEndReached: () => void
  onSubmitSearch: () => void
  onSearchInputChange: (v: string) => void
  onCategoryChange: (id: string) => void
  onViewMoreModels: () => void
  onViewMoreCourses: () => void
  retryText: string
  emptyText: string
  noMoreText: string
  loadingText: string
  loadingMoreText: string
}

/** 网格封面高度(对齐 Uniapp study_list .video height: 178rpx ≈ 89dp) */
const GRID_COVER_HEIGHT = 89

/**
 * Tip 提示横幅(对齐 Uniapp pagesA/studyindex/components/tip.vue):
 * - 蓝色描边容器(#d9e6fd)+ 灰色内层(#eee)+ 圆角 15rpx≈7dp
 * - 左侧 tip 图标 + 中间滚动文字 + 右侧「我的合集」按钮
 */
const TIP_TEXT = '智汇AI 云教育/短视频  欢迎所有AI相关视频上传分享'

export function StudyIndexScreen({
  colorScheme = 'light',
  items,
  refreshing,
  loadingMore,
  error,
  total,
  searchInput,
  showSearch,
  pageType,
  activeCategory,
  previewModels,
  previewItems,
  initialLoading,
  trackCategories,
  onRefresh,
  onEndReached,
  onSubmitSearch,
  onSearchInputChange,
  onCategoryChange,
  onViewMoreModels,
  onViewMoreCourses,
  retryText,
  emptyText,
  noMoreText,
  loadingText,
  loadingMoreText,
}: StudyIndexScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  function TipBanner({ onPressMyModel }: { onPressMyModel: () => void }) {
    const translateX = useRef(new Animated.Value(0)).current

    useEffect(() => {
      const loop = Animated.loop(
        Animated.timing(translateX, {
          toValue: 1,
          duration: 8000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      )
      loop.start()
      return () => loop.stop()
    }, [translateX])

    const animTranslateX = translateX.interpolate({
      inputRange: [0, 1],
      outputRange: [0, -300],
    })

    return (
      <View style={styles.tipOuter}>
        <View style={styles.tipInner}>
          <Text style={styles.tipIcon}>💡</Text>
          <View style={styles.tipScrollContainer}>
            <Animated.View
              style={[styles.tipTextWrapper, { transform: [{ translateX: animTranslateX }] }]}
            >
              <Text style={styles.tipText}>{TIP_TEXT}</Text>
              <Text style={styles.tipText}>{TIP_TEXT}</Text>
            </Animated.View>
          </View>
          <Pressable
            style={styles.tipMyModel}
            onPress={onPressMyModel}
            accessibilityRole="button"
            accessibilityLabel="我的合集"
          >
            <Text style={styles.tipMyModelText}>我的合集</Text>
          </Pressable>
        </View>
      </View>
    )
  }

  const renderVideoItem = ({ item }: { item: StudyVideoItem }) => {
    const time = item.createdAt ? item.createdAt : ''
    const author = item.teacherName || '智汇社区-官方'
    return (
      <Pressable
        style={({ pressed }) => [styles.gridCard, pressed ? styles.gridCardPressed : null]}
        accessibilityRole="button"
        accessibilityLabel={item.title}
      >
        <View style={styles.gridCoverWrap}>
          {item.cover ? (
            <Image source={{ uri: item.cover }} style={styles.gridCover} resizeMode="cover" />
          ) : (
            <View style={styles.gridCoverPlaceholder}>
              <Text style={styles.gridCoverPlaceholderText}>▶</Text>
            </View>
          )}
          <View style={styles.gridCoverInfo}>
            <Text style={styles.gridCoverTitle} numberOfLines={1}>
              {item.title}
            </Text>
            {time ? (
              <Text style={styles.gridCoverDate} numberOfLines={1}>
                {time}
              </Text>
            ) : null}
          </View>
        </View>
        {item.name ? (
          <Text style={styles.gridTitle} numberOfLines={1}>
            {item.name}
          </Text>
        ) : null}
        <View style={styles.gridAuthorRow}>
          {item.avatar ? <Image source={{ uri: item.avatar }} style={styles.gridAvatar} /> : null}
          <Text style={styles.gridAuthor} numberOfLines={1}>
            {author}
          </Text>
        </View>
      </Pressable>
    )
  }

  return (
    <View style={styles.container}>
      {showSearch ? (
        <View style={styles.searchBar}>
          <TextInput
            style={styles.searchInput}
            value={searchInput}
            onChangeText={onSearchInputChange}
            placeholder="搜索视频"
            placeholderTextColor={tk.text.tertiary}
            returnKeyType="search"
            onSubmitEditing={onSubmitSearch}
          />
        </View>
      ) : null}

      {/* 赛道分类 chip 切换 */}
      <View style={styles.scrollTitleWrap}>
        <View style={styles.chipRow}>
          {trackCategories.map((cat) => (
            <Pressable
              key={cat.id}
              style={[styles.chip, activeCategory === cat.id ? styles.chipActive : null]}
              onPress={() => onCategoryChange(cat.id)}
              accessibilityRole="button"
              accessibilityLabel={cat.name}
            >
              <Text
                style={[styles.chipText, activeCategory === cat.id ? styles.chipTextActive : null]}
              >
                {cat.name}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* 内容区 */}
      {pageType === 'index' ? (
        <ScrollView
          style={styles.indexScroll}
          contentContainerStyle={styles.indexContent}
          showsVerticalScrollIndicator={false}
        >
          <TipBanner onPressMyModel={onViewMoreModels} />

          {/* 推荐课程合集预览 */}
          <View style={styles.previewSection}>
            <View style={styles.previewHeader}>
              <View style={styles.previewTitleRow}>
                <Text style={styles.previewIcon}>🔥</Text>
                <Text style={styles.previewTitle}>推荐课程合集</Text>
              </View>
              <Pressable
                style={styles.previewMoreRow}
                onPress={onViewMoreModels}
                accessibilityRole="button"
                accessibilityLabel="查看更多模型"
              >
                <Text style={styles.previewMoreText}>查看更多</Text>
                <Text style={styles.previewMoreArrow}>›</Text>
              </Pressable>
            </View>
            {previewModels.length > 0 ? (
              previewModels.map((m) => (
                <View key={m.id} style={styles.previewModelRow}>
                  <View style={styles.previewModelIcon}>
                    <Text style={styles.previewModelEmoji}>{m.icon || '🤖'}</Text>
                  </View>
                  <View style={styles.previewModelBody}>
                    <Text style={styles.previewModelName} numberOfLines={1}>
                      {m.name}
                    </Text>
                    <Text style={styles.previewModelDesc} numberOfLines={1}>
                      {m.description}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.previewBadge,
                      m.isFree ? styles.previewBadgeFree : styles.previewBadgePaid,
                    ]}
                  >
                    <Text
                      style={[
                        styles.previewBadgeText,
                        m.isFree ? styles.previewBadgeFreeText : styles.previewBadgePaidText,
                      ]}
                    >
                      {m.isFree ? '免费' : '付费'}
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.previewEmpty}>暂无模型</Text>
            )}
          </View>

          {/* 最新课程预览 */}
          <View style={styles.previewSection}>
            <View style={styles.previewHeader}>
              <View style={styles.previewTitleRow}>
                <Text style={styles.previewIcon}>🎬</Text>
                <Text style={styles.previewTitle}>最新课程</Text>
              </View>
              <Pressable
                style={styles.previewMoreRow}
                onPress={onViewMoreCourses}
                accessibilityRole="button"
                accessibilityLabel="查看更多课程"
              >
                <Text style={styles.previewMoreText}>查看更多</Text>
                <Text style={styles.previewMoreArrow}>›</Text>
              </Pressable>
            </View>
            {initialLoading ? (
              <View style={styles.centerWrap}>
                <ActivityIndicator color={tk.brand.DEFAULT} />
                <Text style={styles.loadingText}>{loadingText}</Text>
              </View>
            ) : previewItems.length > 0 ? (
              <View style={styles.previewGrid}>
                {previewItems.map((item) => (
                  <View key={String(item.id)} style={styles.previewGridItem}>
                    {renderVideoItem({ item })}
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.centerWrap}>
                <Text style={styles.emptyText}>{emptyText}</Text>
              </View>
            )}
          </View>
        </ScrollView>
      ) : initialLoading ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator color={tk.brand.DEFAULT} />
          <Text style={styles.loadingText}>{loadingText}</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          renderItem={(info) => renderVideoItem(info)}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={tk.text.tertiary}
            />
          }
          onEndReached={onEndReached}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            error ? (
              <View style={styles.centerWrap}>
                <Text style={styles.errorText}>{error}</Text>
                <Pressable style={styles.retryBtn} onPress={() => void onRefresh()}>
                  <Text style={styles.retryText}>{retryText}</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.centerWrap}>
                <Text style={styles.emptyText}>{emptyText}</Text>
              </View>
            )
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerWrap}>
                <ActivityIndicator color={tk.brand.DEFAULT} size="small" />
                <Text style={styles.footerText}>{loadingMoreText}</Text>
              </View>
            ) : items.length > 0 && items.length >= total ? (
              <View style={styles.noMoreWrap}>
                <View style={styles.noMoreLine} />
                <Text style={styles.noMoreText}>{noMoreText}</Text>
                <View style={styles.noMoreLine} />
              </View>
            ) : null
          }
        />
      )}
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg } as ViewStyle,
    searchBar: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      backgroundColor: tk.surface.card,
    } as ViewStyle,
    searchInput: {
      height: 36,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: tk.border.light,
      paddingHorizontal: 12,
      fontSize: 14,
      color: tk.text.primary,
      backgroundColor: tk.surface.bg,
    } as TextStyle,
    // 赛道分类 chip 切换
    scrollTitleWrap: {
      backgroundColor: tk.surface.card,
      paddingVertical: 8,
    } as ViewStyle,
    chipRow: {
      flexDirection: 'row',
      paddingHorizontal: 12,
      gap: 8,
    } as ViewStyle,
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: tk.surface.muted,
      borderWidth: 1,
      borderColor: tk.border.light,
    } as ViewStyle,
    chipActive: {
      backgroundColor: tk.brand.DEFAULT,
      borderColor: tk.brand.DEFAULT,
    } as ViewStyle,
    chipText: {
      fontSize: 13,
      color: tk.text.secondary,
    } as TextStyle,
    chipTextActive: {
      color: tk.brand.DEFAULT,
      fontWeight: '600',
    } as TextStyle,
    // index 预览态容器
    indexScroll: {
      flex: 1,
    } as ViewStyle,
    indexContent: {
      padding: 16,
      paddingBottom: 96,
    } as ViewStyle,
    // 预览区块
    previewSection: {
      marginTop: 12,
    } as ViewStyle,
    previewHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    } as ViewStyle,
    previewTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
    } as ViewStyle,
    previewIcon: {
      fontSize: 18,
      marginRight: 6,
    } as TextStyle,
    previewTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: tk.text.primary,
    } as TextStyle,
    previewMoreRow: {
      flexDirection: 'row',
      alignItems: 'center',
    } as ViewStyle,
    previewMoreText: {
      fontSize: 13,
      color: tk.text.secondary,
    } as TextStyle,
    previewMoreArrow: {
      fontSize: 18,
      color: tk.text.secondary,
      marginLeft: 2,
      lineHeight: 18,
    } as TextStyle,
    // 模型预览行
    previewModelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 12,
      gap: 12,
      backgroundColor: tk.surface.card,
      borderRadius: 8,
      marginBottom: 6,
    } as ViewStyle,
    previewModelIcon: {
      width: 36,
      height: 36,
      borderRadius: 8,
      backgroundColor: tk.surface.muted,
      alignItems: 'center',
      justifyContent: 'center',
    } as ViewStyle,
    previewModelEmoji: {
      fontSize: 18,
    } as TextStyle,
    previewModelBody: {
      flex: 1,
    } as ViewStyle,
    previewModelName: {
      fontSize: 14,
      fontWeight: '600',
      color: tk.text.primary,
    } as TextStyle,
    previewModelDesc: {
      fontSize: 12,
      color: tk.text.secondary,
      marginTop: 2,
    } as TextStyle,
    previewBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 4,
    } as ViewStyle,
    previewBadgeFree: {
      backgroundColor: tk.success.lighter,
    } as ViewStyle,
    previewBadgePaid: {
      backgroundColor: tk.warning.amberLight,
    } as ViewStyle,
    previewBadgeText: {
      fontSize: 11,
    } as TextStyle,
    previewBadgeFreeText: {
      color: tk.success.DEFAULT,
    } as TextStyle,
    previewBadgePaidText: {
      color: tk.warning.amberText,
    } as TextStyle,
    previewEmpty: {
      fontSize: 13,
      color: tk.text.tertiary,
      textAlign: 'center',
      paddingVertical: 16,
    } as TextStyle,
    // 课程预览网格
    previewGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
    } as ViewStyle,
    previewGridItem: {
      width: '48%',
    } as ViewStyle,
    // 视频列表(双列网格)
    listContent: {
      padding: 16,
      paddingBottom: 96,
    } as ViewStyle,
    gridRow: {
      justifyContent: 'space-between',
    } as ViewStyle,
    gridCard: {
      flex: 1,
      marginHorizontal: 2,
      marginBottom: 8,
    } as ViewStyle,
    gridCardPressed: {
      opacity: 0.8,
    } as ViewStyle,
    gridCoverWrap: {
      position: 'relative',
      height: GRID_COVER_HEIGHT,
    } as ViewStyle,
    gridCover: {
      width: '100%',
      height: GRID_COVER_HEIGHT,
      borderRadius: 7,
      backgroundColor: '#000',
    } as ImageStyle,
    gridCoverPlaceholder: {
      width: '100%',
      height: GRID_COVER_HEIGHT,
      borderRadius: 7,
      backgroundColor: tk.surface.muted,
      alignItems: 'center',
      justifyContent: 'center',
    } as ViewStyle,
    gridCoverPlaceholderText: {
      fontSize: 24,
      color: tk.text.tertiary,
    } as TextStyle,
    // 标题+日期覆盖层
    gridCoverInfo: {
      position: 'absolute',
      bottom: 4,
      left: 6,
      right: 6,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    } as ViewStyle,
    gridCoverTitle: {
      flex: 1,
      fontSize: 9,
      fontWeight: '700',
      color: '#FFFFFF',
    } as TextStyle,
    gridCoverDate: {
      fontSize: 9,
      fontWeight: '700',
      color: '#FFFFFF',
      marginLeft: 4,
    } as TextStyle,
    // 下方课程名
    gridTitle: {
      fontSize: 12,
      color: '#3D3D3D',
      marginTop: 4,
      marginBottom: 4,
    } as TextStyle,
    gridAuthorRow: {
      flexDirection: 'row',
      alignItems: 'center',
    } as ViewStyle,
    gridAvatar: {
      width: 12,
      height: 12,
      borderRadius: 4,
      marginRight: 2,
    } as ImageStyle,
    gridAuthor: {
      fontSize: 9,
      fontWeight: '700',
      color: 'rgba(0,0,0,0.6)',
      flex: 1,
    } as TextStyle,
    // Tip 提示横幅
    tipOuter: {
      backgroundColor: '#d9e6fd',
      padding: 1,
      borderRadius: 7,
      marginBottom: 9,
    } as ViewStyle,
    tipInner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#eee',
      borderRadius: 7,
      paddingVertical: 2,
      paddingHorizontal: 3,
    } as ViewStyle,
    tipIcon: {
      fontSize: 18,
      marginRight: 6,
    } as TextStyle,
    tipScrollContainer: {
      flex: 1,
      height: 20,
      overflow: 'hidden',
    } as ViewStyle,
    tipTextWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
    } as ViewStyle,
    tipText: {
      fontSize: 14,
      fontWeight: '700',
      color: '#666666',
      paddingRight: 10,
    } as TextStyle,
    tipMyModel: {
      width: 72,
      height: 28,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: '#518dfd',
      backgroundColor: '#d9e6fd',
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 4,
    } as ViewStyle,
    tipMyModelText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#000',
    } as TextStyle,
    // 没有更多了
    noMoreWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 20,
      marginTop: 10,
    } as ViewStyle,
    noMoreLine: {
      flex: 1,
      height: 1,
      backgroundColor: '#e0e0e0',
    } as ViewStyle,
    noMoreText: {
      marginHorizontal: 10,
      color: '#767676',
      fontSize: 12,
    } as TextStyle,
    centerWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      gap: 12,
    } as ViewStyle,
    errorText: {
      fontSize: 14,
      color: tk.error.text,
      textAlign: 'center',
    } as TextStyle,
    retryBtn: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: tk.brand.DEFAULT,
    } as ViewStyle,
    retryText: {
      fontSize: 13,
      fontWeight: '600',
      color: tk.surface.light,
    } as TextStyle,
    emptyText: {
      fontSize: 14,
      color: tk.text.tertiary,
      textAlign: 'center',
    } as TextStyle,
    loadingText: {
      fontSize: 14,
      color: tk.text.secondary,
      marginTop: 8,
    } as TextStyle,
    footerWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      gap: 6,
    } as ViewStyle,
    footerText: {
      fontSize: 12,
      color: tk.text.tertiary,
    } as TextStyle,
  })
}
