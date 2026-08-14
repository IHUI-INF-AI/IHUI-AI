/**
 * StudyIndexScreen AI 视频页(mobile-rn 端)
 *
 * 对齐历史项目 pagesA/studyindex/index.vue(AI 视频 / 学习视频列表):
 * - 顶部 NavBar(标题「AI 视频」+ 返回)+ 右侧搜索开关 + 菜单入口(打开 Drawer)
 * - ScrollTitle 赛道分类切换(横向 ScrollView + Pressable,对齐 Uniapp ScrollTitle)
 * - Tab 视频/模型双标签页切换(对齐 Uniapp pageType:index/model/study)
 * - 视频页:单列视频卡片(封面 / 标题 / 时长徽章 / 讲师 / 相对时间)
 * - 模型页:ModelList 模型列表(复用 ChatScreen 的 ModelList 组件,对齐 Uniapp ModelList)
 * - Drawer 侧边栏(复用现有 Drawer 组件,对齐 Uniapp DrawerComponent)
 * - 数据加载:fetchApi 拉取 /api/study/videos(分页 + 搜索)+ fetchModels 加载模型
 * - 下拉刷新 + 上拉分页 + 空态(Empty)+ 加载态(Loading)+ 错误重试
 * - 悬浮发布按钮(对齐 .vue floating-publish-btn → /pagesA/study/publish)
 * - 浅色优雅风,rnLightTokens;圆角守门(无 rounded-full);无分割线(gap 间距)
 */
import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import Clipboard from '@react-native-clipboard/clipboard'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
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
import Empty from '../components/common/Empty'
import Loading from '../components/common/Loading'
import Drawer, {
  type DrawerConversationItem,
  type DrawerExtraMenu,
  type DrawerTab,
} from '../components/Drawer'
import ModelList, { type ModelListGroup } from '../components/ModelList'
import { SingleTypeBar } from '../components/SingleTypeBar'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const PAGE_SIZE = 10
const API_PATH = '/api/study/videos'
const COVER_HEIGHT = 120
const BACK_HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 } as const
const FREE_RESOURCE_URL = 'https://ihui.feishu.cn/wiki/free-resources'

/** Tab 页类型(对齐 Uniapp pageType:index=视频 / model=模型) */
type PageType = 'video' | 'model'

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
  cover?: string
  duration?: number | string
  teacherName?: string
  createdAt?: string
}

interface StudyVideoResponse {
  list: StudyVideoItem[]
  total: number
}

function formatDuration(duration: number | string | undefined): string {
  if (duration === undefined || duration === null || duration === '') return ''
  if (typeof duration === 'number') {
    const minutes = Math.floor(duration / 60)
    const seconds = duration % 60
    return minutes > 0 ? `${minutes}:${String(seconds).padStart(2, '0')}` : `${seconds}s`
  }
  return String(duration)
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

export function StudyIndexScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const { user } = useAuth()
  const navigation = useNavigation<NavigationProp>()
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

  // Tab 视频/模型切换(对齐 Uniapp pageType)
  const [pageType, setPageType] = useState<PageType>('video')
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
    [search],
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
    const rnTab = tab as 'home' | 'ai' | 'mine'
    navigation.navigate('Tabs', { screen: rnTab } as never)
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
    navigation.navigate('Chat')
  }
  const handleDrawerSelectConversation = (_id: string) => {
    setDrawerVisible(false)
    navigation.navigate('Chat')
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
    navigation.navigate('Tabs', { screen: 'home' } as never)
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

  const renderItem = ({ item }: { item: StudyVideoItem }) => {
    const duration = formatDuration(item.duration)
    const time = item.createdAt ? formatRelativeTime(item.createdAt) : ''
    return (
      <Pressable
        style={({ pressed }) => [styles.card, pressed ? styles.cardPressed : null]}
        onPress={() => onVideoClick(item)}
        accessibilityRole="button"
        accessibilityLabel={item.title}
      >
        <View style={styles.coverWrap}>
          {item.cover ? (
            <Image source={{ uri: item.cover }} style={styles.cover} resizeMode="cover" />
          ) : (
            <View style={styles.coverPlaceholder}>
              <Text style={styles.coverPlaceholderText}>▶</Text>
            </View>
          )}
          {duration ? (
            <View style={styles.durationBadge}>
              <Text style={styles.durationText}>{duration}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={2}>
            {item.title}
          </Text>
          {item.teacherName ? (
            <Text style={styles.teacher} numberOfLines={1}>
              讲师:{item.teacherName}
            </Text>
          ) : null}
          {time ? <Text style={styles.time}>{time}</Text> : null}
        </View>
      </Pressable>
    )
  }

  return (
    <View style={styles.container}>
      <NavBar
        title="AI 视频"
        onBack={() => navigation.goBack()}
        rightActions={[{ icon: '☰', onPress: () => setDrawerVisible(true), label: '菜单' }]}
        rightAction={
          <Pressable
            hitSlop={BACK_HIT_SLOP}
            onPress={() => setShowSearch((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel="搜索"
          >
            <Text style={styles.searchIcon}>{showSearch ? '✕' : '🔍'}</Text>
          </Pressable>
        }
      />
      {showSearch ? (
        <View style={styles.searchBar}>
          <TextInput
            style={styles.searchInput}
            value={searchInput}
            onChangeText={setSearchInput}
            placeholder="搜索视频"
            placeholderTextColor={tk.text.tertiary}
            returnKeyType="search"
            onSubmitEditing={onSubmitSearch}
          />
        </View>
      ) : null}

      {/* 赛道分类切换(对齐 Uniapp type-bar/tab + scroll_title,复用 SingleTypeBar 共享组件) */}
      <View style={styles.scrollTitleWrap}>
        <SingleTypeBar
          items={TRACK_CATEGORIES.map((c) => ({ id: c.id, label: c.name }))}
          selectedId={activeCategory}
          onSelect={setActiveCategory}
        />
      </View>

      {/* Tab 视频/模型双标签页(对齐 Uniapp pageType 切换) */}
      <View style={styles.tabBar}>
        <Pressable
          style={[styles.tabItem, pageType === 'video' ? styles.tabItemActive : null]}
          onPress={() => setPageType('video')}
          accessibilityRole="button"
          accessibilityLabel="视频"
        >
          <Text style={[styles.tabText, pageType === 'video' ? styles.tabTextActive : null]}>
            视频
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tabItem, pageType === 'model' ? styles.tabItemActive : null]}
          onPress={() => setPageType('model')}
          accessibilityRole="button"
          accessibilityLabel="模型"
        >
          <Text style={[styles.tabText, pageType === 'model' ? styles.tabTextActive : null]}>
            模型
          </Text>
        </Pressable>
      </View>

      {/* 内容区:视频列表 / 模型列表 */}
      {pageType === 'video' ? (
        initialLoading ? (
          <View style={styles.centerWrap}>
            <Loading text="加载中..." />
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
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
            ListFooterComponent={loadingMore ? <Loading text="加载更多..." /> : null}
          />
        )
      ) : (
        <View style={styles.modelListWrap}>
          <ModelList groups={modelListGroups} selectionMode="single" />
        </View>
      )}
      <Pressable
        style={styles.fab}
        onPress={onPublish}
        accessibilityRole="button"
        accessibilityLabel="发布视频"
      >
        <Text style={styles.fabIcon}>＋</Text>
      </Pressable>

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
  searchIcon: { fontSize: 18, color: tk.text.primary } as TextStyle,
  searchBar: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: tk.surface.card,
  } as ViewStyle,
  searchInput: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: tk.surface.muted,
    fontSize: 14,
    color: tk.text.primary,
  } as TextStyle,
  // 赛道分类容器(复用 SingleTypeBar 共享组件)
  scrollTitleWrap: {
    backgroundColor: tk.surface.card,
    paddingVertical: 8,
  } as ViewStyle,
  // Tab 视频/模型(对齐 Uniapp pageType 切换)
  tabBar: {
    flexDirection: 'row',
    backgroundColor: tk.surface.card,
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  } as ViewStyle,
  tabItem: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: tk.surface.muted,
    alignItems: 'center',
  } as ViewStyle,
  tabItemActive: {
    backgroundColor: tk.brand.DEFAULT,
  } as ViewStyle,
  tabText: {
    fontSize: 14,
    color: tk.text.secondary,
  } as TextStyle,
  tabTextActive: {
    color: tk.surface.light,
    fontWeight: '600',
  } as TextStyle,
  // 视频列表
  listContent: {
    padding: 16,
    paddingBottom: 96,
    gap: 12,
  } as ViewStyle,
  card: {
    backgroundColor: tk.surface.card,
    borderRadius: 12,
    padding: 12,
    gap: 12,
  } as ViewStyle,
  cardPressed: {
    backgroundColor: tk.surface.muted,
  } as ViewStyle,
  coverWrap: {
    position: 'relative',
    height: COVER_HEIGHT,
  } as ViewStyle,
  cover: {
    width: '100%',
    height: COVER_HEIGHT,
    borderRadius: 8,
  } as ImageStyle,
  coverPlaceholder: {
    width: '100%',
    height: COVER_HEIGHT,
    borderRadius: 8,
    backgroundColor: tk.surface.muted,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  coverPlaceholderText: {
    fontSize: 28,
    color: tk.text.tertiary,
  } as TextStyle,
  durationBadge: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
  } as ViewStyle,
  durationText: {
    fontSize: 11,
    color: tk.surface.light,
    fontWeight: '500',
  } as TextStyle,
  content: {
    gap: 6,
  } as ViewStyle,
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: tk.text.primary,
    lineHeight: 20,
  } as TextStyle,
  teacher: {
    fontSize: 12,
    color: tk.text.secondary,
  } as TextStyle,
  time: {
    fontSize: 11,
    color: tk.text.tertiary,
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
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 24,
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: tk.brand.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: tk.gray[900],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  } as ViewStyle,
  fabIcon: {
    fontSize: 24,
    color: tk.surface.light,
    fontWeight: '600',
  } as TextStyle,
})

export default StudyIndexScreen
