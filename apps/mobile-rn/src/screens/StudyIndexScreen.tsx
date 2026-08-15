/**
 * StudyIndexScreen AI 视频页(mobile-rn 端)
 *
 * 对齐历史项目 pagesA/studyindex/index.vue(AI 视频 / 学习视频列表):
 * - 顶部 NavBar(标题「AI 视频」+ 返回)+ 右侧搜索开关 + 菜单入口(打开 Drawer)
 * - ScrollTitle 赛道分类切换(复用 SingleTypeBar 共享组件,对齐 Uniapp ScrollTitle)
 * - pageType 三态切换(对齐 Uniapp pageType:index 预览 / model 模型全屏 / study 课程全屏)
 * - index 预览态:ModelList 前 3 条 + StudyList 前 3 条 + 各自「查看更多」切全屏
 * - study 全屏态:双列视频卡片(封面 / 标题 / 时长徽章 / 讲师 / 相对时间)
 * - model 全屏态:ModelList 模型列表(复用 ChatScreen 的 ModelList 组件,对齐 Uniapp ModelList)
 * - Drawer 侧边栏(复用现有 Drawer 组件,对齐 Uniapp DrawerComponent)
 * - 数据加载:fetchApi 拉取 /api/study/videos(分页 + 搜索)+ fetchModels 加载模型
 * - 下拉刷新 + 上拉分页 + 空态(Empty)+ 加载态(Loading)+ 错误重试
 * - 悬浮发布按钮(对齐 .vue floating-publish-btn → /pagesA/study/publish)
 * - 浅色优雅风,rnLightTokens;圆角守门(无 rounded-full);无分割线(gap 间距)
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Alert,
  Animated,
  Easing,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import Clipboard from '@react-native-clipboard/clipboard'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { mainScreenForTab, type MainTabKey } from '../navigation/tab-utils'
import { Search, X } from 'lucide-react-native'
import {
  deleteConversation,
  fetchApi,
  fetchModels,
  listConversations,
  type ConversationDetail,
  type LlmModel,
} from '@ihui/api-client'
import { rnLightTokens as tk } from '@ihui/design-tokens'
import { formatRelativeTime } from '@ihui/shared'
import { NavBar } from '../components/NavBar'
import FloatingActionButton from '../components/FloatingActionButton'
import Empty from '../components/common/Empty'
import Loading from '../components/common/Loading'
import Drawer, {
  type DrawerConversationItem,
  type DrawerExtraMenu,
  type DrawerTab,
} from '../components/Drawer'
import ModelList, { type ModelListGroup } from '../components/ModelList'
import { SearchInput } from '../components/SearchInput'
import { SingleTypeBar } from '../components/SingleTypeBar'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>
type RootNav = NativeStackNavigationProp<RootStackParamList>

const PAGE_SIZE = 10
const API_PATH = '/api/study/videos'
/** 网格封面高度(对齐 Uniapp study_list .video height: 178rpx ≈ 89dp) */
const GRID_COVER_HEIGHT = 89
const BACK_HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 } as const
/** 免费资料飞书链接(对齐 Uniapp user/index.vue 行 682 lingqu,与 ProfileScreen 保持一致) */
const FREE_RESOURCE_URL = 'https://aizhihuishe.feishu.cn/wiki/GPs7wff9PiDekQkKvBncryrmnIh?from=from_copylink'

/** 页面三态(对齐 Uniapp pageType:index=首页预览 / model=模型全屏 / study=课程全屏) */
type PageType = 'index' | 'model' | 'study'

/** 赛道分类(对齐 Uniapp categoryDictionary 静态占位) */
interface TrackCategory {
  id: string
  name: string
}

const TRACK_CATEGORIES: readonly TrackCategory[] = [
  { id: 'all', name: '全部' },
  { id: 'douyin', name: '抖音运营' },
  { id: 'private', name: '私域运营' },
  { id: 'content', name: '内容创作' },
  { id: 'data', name: '数据分析' },
] as const

interface StudyVideoItem {
  id: string | number
  courseId?: string | number
  title: string
  /** 下方标题(对齐 Uniapp study_list item.name,封面图下方的课程名) */
  name?: string
  cover?: string
  /** 作者昵称(对齐 Uniapp study_list item.nickname,缺省'智汇社区-官方') */
  teacherName?: string
  /** 作者头像(对齐 Uniapp study_list item.avatar) */
  avatar?: string
  createdAt?: string
}

interface StudyVideoResponse {
  list: StudyVideoItem[]
  total: number
}

/**
 * 把 API 返回的 ConversationDetail 映射为 DrawerConversationItem。
 * 对齐 Uniapp getModelChat 返回的 { id, title, time, modelName } 结构。
 */
function mapConversationToDrawer(c: ConversationDetail): DrawerConversationItem {
  const tsStr = c.lastMessageAt ?? c.updatedAt ?? c.createdAt
  const createdAt = tsStr ? new Date(tsStr).getTime() : Date.now()
  const model = c.model ?? ''
  return {
    id: c.id,
    title: c.title?.trim() || '未命名对话',
    modelConfig: model ? { id: model, name: model, icon: undefined } : undefined,
    createdAt,
  }
}

/**
 * Tip 提示横幅(对齐 Uniapp pagesA/studyindex/components/tip.vue):
 * - 蓝色描边容器(#d9e6fd)+ 灰色内层(#eee)+ 圆角 15rpx≈7dp
 * - 左侧 tip 图标(对齐 study_icon_tip.png 48rpx≈24dp)
 * - 中间滚动文字"智汇AI 云教育/短视频  欢迎所有AI相关视频上传分享"(对齐 8s linear 无限滚动)
 * - 右侧"我的合集"按钮(对齐 144rpx 宽 + #518dfd 描边 + #d9e6fd 背景 + 12rpx 圆角)
 */
const TIP_TEXT = '智汇AI 云教育/短视频  欢迎所有AI相关视频上传分享'

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
  // 滚动范围:从 0 到 -50%(对齐 Uniapp @keyframes scroll-left translateX 0 → -50%)
  const animTranslateX = translateX.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -300],
  })
  return (
    <View style={styles.tipOuter}>
      <View style={styles.tipInner}>
        <Text style={styles.tipIcon}>💡</Text>
        <View style={styles.tipScrollContainer}>
          <Animated.View style={[styles.tipTextWrapper, { transform: [{ translateX: animTranslateX }] }]}>
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

export function StudyIndexScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const { user } = useAuth()
  const navigation = useNavigation<NavigationProp>()
  const rootNav = navigation.getParent<RootNav>()
  const [items, setItems] = useState<StudyVideoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [showSearch, setShowSearch] = useState(false)

  // 页面三态(对齐 Uniapp pageType:index/model/study);index 为首页预览态默认值
  const [pageType, setPageType] = useState<PageType>('index')
  // 赛道分类(对齐 Uniapp ScrollTitle categoryDictionary)
  const [activeCategory, setActiveCategory] = useState('all')

  // 模型列表(对齐 Uniapp getCozeApiList,复用 fetchModels)
  const [models, setModels] = useState<LlmModel[]>([])

  // Drawer 侧边栏(对齐 Uniapp DrawerComponent)
  const [drawerVisible, setDrawerVisible] = useState(false)
  const [drawerConversations, setDrawerConversations] = useState<DrawerConversationItem[]>([])
  const [drawerConversationsLoaded, setDrawerConversationsLoaded] = useState(false)

  const load = useCallback(
    async (opts: { reset?: boolean; nextPage?: number } = {}) => {
      const reset = opts.reset ?? false
      const targetPage = opts.nextPage ?? 1
      if (reset) {
        setLoading(true)
        setError('')
      }
      try {
        const res = await fetchApi<StudyVideoResponse>(API_PATH, {
          params: {
            page: targetPage,
            pageSize: PAGE_SIZE,
            search: search.trim() || undefined,
            // 分类筛选(对齐 Uniapp study_list getVideoList categorys 参数);
            // activeCategory 变化 → load 重建 → useEffect 自动触发刷新
            category: activeCategory !== 'all' ? activeCategory : undefined,
          },
        })
        if (!res.success) throw new Error(res.error)
        const list = res.data.list ?? []
        setItems((prev) => (reset ? list : [...prev, ...list]))
        setTotal(res.data.total ?? 0)
        setPage(targetPage)
      } catch {
        setError('加载失败,请下拉刷新重试')
      } finally {
        setLoading(false)
        setRefreshing(false)
        setLoadingMore(false)
      }
    },
    [search, activeCategory],
  )

  // 模型列表加载(对齐 Uniapp getCozeApiList,复用 fetchModels)
  useEffect(() => {
    let cancelled = false
    fetchModels()
      .then((res) => {
        if (!cancelled) setModels(res.models)
      })
      .catch(() => {
        // 静默失败:模型列表非核心功能
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Drawer 历史对话懒加载(对齐 Uniapp loadHistoryChat → getModelChat)
  const loadDrawerConversations = useCallback(async () => {
    const res = await listConversations({ page: 1, pageSize: 50 })
    if (res.success) {
      setDrawerConversations(res.data.conversations.map(mapConversationToDrawer))
    } else {
      setDrawerConversations([])
    }
    setDrawerConversationsLoaded(true)
  }, [])

  useEffect(() => {
    if (drawerVisible && !drawerConversationsLoaded && user) {
      void loadDrawerConversations()
    }
  }, [drawerVisible, drawerConversationsLoaded, user, loadDrawerConversations])

  useEffect(() => {
    void load({ reset: true })
  }, [load])

  const onRefresh = () => {
    setRefreshing(true)
    void load({ reset: true })
  }

  const onEndReached = () => {
    if (loadingMore || loading || refreshing) return
    if (items.length >= total) return
    setLoadingMore(true)
    void load({ reset: false, nextPage: page + 1 })
  }

  const onSubmitSearch = () => {
    setSearch(searchInput)
    setShowSearch(false)
  }

  const onPublish = () => {
    navigation.navigate('StudyPublish')
  }

  // 我的合集(对齐 Uniapp toMyModel → /pagesA/study/my_study;RN 端最接近的路由为 StudyRecord)
  const onMyModel = () => {
    navigation.navigate('StudyRecord')
  }

  // 返回逻辑(对齐 Uniapp backPage:model/study → index,index → 上一页)
  const handleBack = () => {
    if (pageType === 'model' || pageType === 'study') {
      setPageType('index')
    } else {
      navigation.goBack()
    }
  }

  const onVideoClick = (item: StudyVideoItem) => {
    navigation.navigate('VideoPlayer', {
      courseId: String(item.courseId ?? item.id),
      lessonId: String(item.id),
      title: item.title,
    })
  }

  // ── Drawer 回调(对齐 Uniapp DrawerComponent 事件) ──
  const handleDrawerNavigate = (tab: DrawerTab) => {
    setDrawerVisible(false)
    if (tab === 'square') {
      navigation.navigate('Square')
      return
    }
    if (tab === 'share') {
      navigation.navigate('Share')
      return
    }
    const rnTab: MainTabKey = tab as MainTabKey
    rootNav?.navigate('Main', { screen: mainScreenForTab(rnTab) })
  }
  const handleDrawerNavigateCompany = () => {
    setDrawerVisible(false)
    navigation.navigate('Distribution')
  }
  const handleDrawerClaimFree = () => {
    setDrawerVisible(false)
    Clipboard.setString(FREE_RESOURCE_URL)
    Alert.alert('领取免费资料', '链接已复制到剪贴板,可在浏览器粘贴打开')
  }
  const handleDrawerCreateNewChat = () => {
    setDrawerVisible(false)
    navigation.navigate('Chat', {})
  }
  const handleDrawerSelectConversation = (id: string) => {
    setDrawerVisible(false)
    navigation.navigate('Chat', { conversationId: id })
  }
  const handleDrawerDeleteConversation = (id: string) => {
    Alert.alert('删除对话', '确认删除此对话?', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => {
          const snapshot = drawerConversations
          setDrawerConversations((prev) => prev.filter((c) => c.id !== id))
          void (async () => {
            const res = await deleteConversation(id)
            if (!res.success) {
              setDrawerConversations(snapshot)
              Alert.alert('提示', '删除失败,请重试')
            }
          })()
        },
      },
    ])
  }
  const handleDrawerOpenSettings = () => {
    setDrawerVisible(false)
    navigation.navigate('Settings')
  }
  const handleDrawerOpenMessages = () => {
    setDrawerVisible(false)
    navigation.navigate('MessageCenter')
  }
  const handleDrawerGoHome = () => {
    setDrawerVisible(false)
    navigation.navigate('Main', { screen: 'HomeMain' })
  }
  const handleNavigateExtra = (menu: DrawerExtraMenu) => {
    setDrawerVisible(false)
    switch (menu) {
      case 'aigc':
        navigation.navigate('AigcList')
        break
      case 'learn':
        navigation.navigate('Learn')
        break
      case 'modelPlaza':
        navigation.navigate('ModelPlaza')
        break
      case 'company':
        navigation.navigate('Distribution')
        break
      case 'tools':
        navigation.navigate('AiAssistant')
        break
    }
  }

  const drawerUser = {
    avatar: user?.avatar,
    nickname: user?.nickname ?? user?.username ?? '未登录',
    level: (user?.isVip ? 'vip' : 'normal') as 'vip' | 'normal',
  }

  // ModelList groups(由 models 派生,对齐 Uniapp ModelList 按 vendor 分组)
  const modelListGroups: ModelListGroup[] =
    models.length > 0
      ? [
          {
            vendor: '可用模型',
            models: models.map((m) => ({
              id: m.id,
              name: m.name,
              description: m.provider,
              icon: '🤖',
              isFree: !m.input_price,
            })),
          },
        ]
      : []

  const initialLoading = loading && items.length === 0 && !refreshing

  // index 预览态:模型 / 课程各取前 3 条(对齐 Uniapp index 预览 + 查看更多)
  const previewModels = models.slice(0, 3)
  const previewItems = items.slice(0, 3)

  const renderItem = ({ item }: { item: StudyVideoItem }) => {
    const time = item.createdAt ? formatRelativeTime(item.createdAt) : ''
    const author = item.teacherName || '智汇社区-官方'
    return (
      <Pressable
        style={({ pressed }) => [styles.gridCard, pressed ? styles.gridCardPressed : null]}
        onPress={() => onVideoClick(item)}
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
          {/* 标题 + 日期覆盖在封面上(对齐 Uniapp study_list .video_info absolute) */}
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
        {/* 下方课程名(对齐 Uniapp study_list .title {{ item.name }}) */}
        {item.name ? (
          <Text style={styles.gridTitle} numberOfLines={1}>
            {item.name}
          </Text>
        ) : null}
        {/* 作者行(对齐 Uniapp study_list icon_logo + name) */}
        <View style={styles.gridAuthorRow}>
          {item.avatar ? (
            <Image source={{ uri: item.avatar }} style={styles.gridAvatar} />
          ) : null}
          <Text style={styles.gridAuthor} numberOfLines={1}>
            {author}
          </Text>
        </View>
      </Pressable>
    )
  }

  return (
    <View style={styles.container}>
      <NavBar
        title="AI 视频"
        onBack={handleBack}
        rightActions={[{ icon: '☰', onPress: () => setDrawerVisible(true), label: '菜单' }]}
        rightAction={
          <Pressable
            hitSlop={BACK_HIT_SLOP}
            onPress={() => setShowSearch((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel="搜索"
          >
            {showSearch ? (
              <X size={20} color={tk.text.primary} />
            ) : (
              <Search size={20} color={tk.text.primary} />
            )}
          </Pressable>
        }
      />
      {showSearch ? (
        <View style={styles.searchBar}>
          <SearchInput
            value={searchInput}
            onChangeText={setSearchInput}
            placeholder="搜索视频"
            onSubmit={onSubmitSearch}
          />
        </View>
      ) : null}

      {/* 赛道分类切换(对齐 Uniapp scroll_title,复用 SingleTypeBar 共享组件) */}
      <View style={styles.scrollTitleWrap}>
        <SingleTypeBar
          items={TRACK_CATEGORIES.map((c) => ({ id: c.id, label: c.name }))}
          selectedId={activeCategory}
          onSelect={setActiveCategory}
        />
      </View>

      {/* 内容区(对齐 Uniapp pageType 三态:index 预览 / model 全屏 / study 全屏) */}
      {pageType === 'index' ? (
        <ScrollView
          style={styles.indexScroll}
          contentContainerStyle={styles.indexContent}
          showsVerticalScrollIndicator={false}
        >
          <TipBanner onPressMyModel={onMyModel} />

          {/* ModelList 预览(对齐 Uniapp model_list index 态:推荐课程合集 + 查看更多) */}
          <View style={styles.previewSection}>
            <View style={styles.previewHeader}>
              <View style={styles.previewTitleRow}>
                <Text style={styles.previewIcon}>🔥</Text>
                <Text style={styles.previewTitle}>推荐课程合集</Text>
              </View>
              <Pressable
                style={styles.previewMoreRow}
                onPress={() => setPageType('model')}
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
                    <Text style={styles.previewModelEmoji}>🤖</Text>
                  </View>
                  <View style={styles.previewModelBody}>
                    <Text style={styles.previewModelName} numberOfLines={1}>
                      {m.name}
                    </Text>
                    <Text style={styles.previewModelDesc} numberOfLines={1}>
                      {m.provider}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.previewBadge,
                      m.input_price ? styles.previewBadgePaid : styles.previewBadgeFree,
                    ]}
                  >
                    <Text
                      style={[
                        styles.previewBadgeText,
                        m.input_price ? styles.previewBadgePaidText : styles.previewBadgeFreeText,
                      ]}
                    >
                      {m.input_price ? '付费' : '免费'}
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.previewEmpty}>暂无模型</Text>
            )}
          </View>

          {/* StudyList 预览(对齐 Uniapp study_list index 态:最新课程 + 查看更多) */}
          <View style={styles.previewSection}>
            <View style={styles.previewHeader}>
              <View style={styles.previewTitleRow}>
                <Text style={styles.previewIcon}>🎬</Text>
                <Text style={styles.previewTitle}>最新课程</Text>
              </View>
              <Pressable
                style={styles.previewMoreRow}
                onPress={() => setPageType('study')}
                accessibilityRole="button"
                accessibilityLabel="查看更多课程"
              >
                <Text style={styles.previewMoreText}>查看更多</Text>
                <Text style={styles.previewMoreArrow}>›</Text>
              </Pressable>
            </View>
            {initialLoading ? (
              <Loading text="加载中..." />
            ) : previewItems.length > 0 ? (
              <View style={styles.previewGrid}>
                {previewItems.map((item) => (
                  <View key={String(item.id)} style={styles.previewGridItem}>
                    {renderItem({ item })}
                  </View>
                ))}
              </View>
            ) : (
              <Empty text="暂无学习视频" icon="🎬" />
            )}
          </View>
        </ScrollView>
      ) : pageType === 'model' ? (
        <View style={styles.modelListWrap}>
          <ModelList groups={modelListGroups} selectionMode="single" />
        </View>
      ) : (
        initialLoading ? (
          <View style={styles.centerWrap}>
            <Loading text="加载中..." />
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            numColumns={2}
            columnWrapperStyle={styles.gridRow}
            contentContainerStyle={styles.listContent}
            ListHeaderComponent={<TipBanner onPressMyModel={onMyModel} />}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={resolvedTheme === 'dark' ? tk.text.tertiary : tk.text.secondary}
              />
            }
            onEndReached={onEndReached}
            onEndReachedThreshold={0.3}
            ListEmptyComponent={
              error ? (
                <View style={styles.centerWrap}>
                  <Text style={styles.errorText}>{error}</Text>
                  <Pressable style={styles.retryBtn} onPress={() => void load({ reset: true })}>
                    <Text style={styles.retryText}>{t('common.ok')}</Text>
                  </Pressable>
                </View>
              ) : (
                <Empty text="暂无学习视频" icon="🎬" />
              )
            }
            ListFooterComponent={
              loadingMore ? (
                <Loading text="加载更多..." />
              ) : items.length > 0 && items.length >= total ? (
                <View style={styles.noMoreWrap}>
                  <View style={styles.noMoreLine} />
                  <Text style={styles.noMoreText}>没有更多了</Text>
                  <View style={styles.noMoreLine} />
                </View>
              ) : null
            }
          />
        )
      )}
      <FloatingActionButton onPress={onPublish} accessibilityLabel="发布视频" />

      {/* Drawer 侧边栏(对齐 Uniapp DrawerComponent) */}
      <Drawer
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        user={drawerUser}
        conversations={drawerConversations}
        onNavigate={handleDrawerNavigate}
        onNavigateCompany={handleDrawerNavigateCompany}
        onClaimFree={handleDrawerClaimFree}
        onCreateNewChat={handleDrawerCreateNewChat}
        onSelectConversation={handleDrawerSelectConversation}
        onDeleteConversation={handleDrawerDeleteConversation}
        onOpenSettings={handleDrawerOpenSettings}
        onOpenMessages={handleDrawerOpenMessages}
        onGoHome={handleDrawerGoHome}
        onNavigateExtra={handleNavigateExtra}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tk.surface.bg } as ViewStyle,
  searchBar: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: tk.surface.card,
  } as ViewStyle,
  // 赛道分类容器(复用 SingleTypeBar 共享组件)
  scrollTitleWrap: {
    backgroundColor: tk.surface.card,
    paddingVertical: 8,
  } as ViewStyle,
  // index 预览态容器(对齐 Uniapp content scroll)
  indexScroll: {
    flex: 1,
  } as ViewStyle,
  indexContent: {
    padding: 16,
    paddingBottom: 96,
  } as ViewStyle,
  // 预览区块(对齐 Uniapp model_list/study_list index 态 header + 查看更多)
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
  // 模型预览行(对齐 ModelList row 简化版)
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
  // 课程预览网格(对齐 Uniapp study_list scroll_height flex-wrap)
  previewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  } as ViewStyle,
  previewGridItem: {
    width: '48%',
  } as ViewStyle,
  // 视频列表(双列网格,对齐 Uniapp study_list scroll_height flex-wrap)
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
  // 标题+日期覆盖层(对齐 Uniapp .video_info absolute,top:148rpx≈74dp)
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
  // 下方课程名(对齐 Uniapp .title {{ item.name }}:24rpx≈12dp,#3D3D3D)
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
  // Tip 提示横幅(对齐 Uniapp tip.vue)
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
  // 没有更多了(对齐 Uniapp study_list .line + .no-more-text)
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
  // 模型列表容器
  modelListWrap: {
    flex: 1,
  } as ViewStyle,
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
})

export default StudyIndexScreen
