// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * StudyIndexScreen AI 视频页 —— mobile-rn 薄壳。
 *
 * 渲染主体是共享层 `@ihui/rn-app` 的 StudyIndexScreen（单一真相源）：
 * 壳侧只保留 `/api/study/videos` + `fetchModels` 取数、三态 pageType 与搜索/分类状态、
 * NavBar（共享屏不接管返回）与导航端口注入，不再复制共享屏的列表/预览渲染。
 *
 * 路由与入口：RootNavigator.tsx:680/1247（默认导出），drawer-nav.ts:244/903-904。
 * 端口口径：共享屏全部 props 逐项真实接线；不回落空函数，不造 noop。
 */
import { useCallback, useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import Clipboard from '@react-native-clipboard/clipboard'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Search, X } from 'lucide-react-native'
import {
  deleteConversation,
  fetchApi,
  fetchModels,
  listConversations,
  type ConversationDetail,
  type LlmModel,
} from '@ihui/api-client'
import { apiFailureToError, toUserFriendlyMessage } from '@ihui/shared/utils'
import { StudyIndexScreen as SharedStudyIndexScreen } from '@ihui/rn-app'
import { Tappable } from '@ihui/ui-native'
import { tokens as tk } from '../theme/active-tokens'
import { appAlert } from '../components/BottomPops'
import Drawer, {
  type DrawerConversationItem,
  type DrawerExtraMenu,
  type DrawerTab,
} from '../components/Drawer'
import { NavBar } from '../components/NavBar'
import { NavChrome } from '../components/NavChrome'
import { PanelLeftRounded } from '../components/PanelLeftRounded'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useI18n } from '../i18n'
import { navigateDrawerTab } from '../navigation/tab-utils'
import type { RootStackParamList } from '../navigation/RootNavigator'
import type { StudyVideoItem } from '@ihui/types'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>
type RootNav = NativeStackNavigationProp<RootStackParamList>
type PageType = 'index' | 'model' | 'study'

const PAGE_SIZE = 10
const API_PATH = '/api/study/videos'
const BACK_HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 } as const
/** 免费资料飞书链接(对齐 Uniapp user/index.vue lingqu,与 ProfileScreen 保持一致) */
const FREE_RESOURCE_URL =
  'https://aizhihuishe.feishu.cn/wiki/GPs7wff9PiDekQkKvBncryrmnIh?from=from_copylink'

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
    favorited: c.favorite === true,
  }
}

/** 赛道分类(对齐 Uniapp categoryDictionary 静态占位) */
const TRACK_CATEGORIES = [
  { id: 'all', name: '全部' },
  { id: 'douyin', name: '抖音运营' },
  { id: 'private', name: '私域运营' },
  { id: 'content', name: '内容创作' },
  { id: 'data', name: '数据分析' },
] as const

interface StudyVideoResponse {
  list: StudyVideoItem[]
  total: number
}

export function StudyIndexScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const rootNav = navigation.getParent<RootNav>()
  const { user } = useAuth()
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
  const [pageType, setPageType] = useState<PageType>('index')
  const [activeCategory, setActiveCategory] = useState('all')
  const [models, setModels] = useState<LlmModel[]>([])

  // Drawer 侧边栏(对齐 Uniapp DrawerComponent；手势/遮罩为 RN 平台 chrome,不进共享屏)
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
            category: activeCategory !== 'all' ? activeCategory : undefined,
          },
        })
        if (!res.success) throw apiFailureToError(res)
        const list = res.data.list ?? []
        setItems((prev) => (reset ? list : [...prev, ...list]))
        setTotal(res.data.total ?? 0)
        setPage(targetPage)
      } catch (e: unknown) {
        const detail = e instanceof Error ? e.message : typeof e === 'string' ? e : ''
        setError(detail.trim() ? toUserFriendlyMessage(e) : '加载失败,请下拉刷新重试')
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

  useEffect(() => {
    void load({ reset: true })
  }, [load])

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

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    void load({ reset: true })
  }, [load])

  const onEndReached = useCallback(() => {
    if (loadingMore || loading || refreshing) return
    if (items.length >= total) return
    setLoadingMore(true)
    void load({ reset: false, nextPage: page + 1 })
  }, [items.length, loading, loadingMore, load, page, refreshing, total])

  const onSubmitSearch = useCallback(() => {
    setSearch(searchInput)
    setShowSearch(false)
  }, [searchInput])

  // 返回逻辑(对齐原端内 backPage:model/study → index,index → 上一页)
  const handleBack = useCallback(() => {
    if (pageType !== 'index') {
      setPageType('index')
      return
    }
    navigation.goBack()
  }, [navigation, pageType])

  // 发布视频：FAB 渲染在共享屏，RN 只给导航端口
  const onPublish = useCallback(() => {
    navigation.navigate('StudyPublish')
  }, [navigation])

  // ── Drawer 回调(对齐 Uniapp DrawerComponent 事件) ──
  const handleDrawerNavigate = (tab: DrawerTab) => {
    setDrawerVisible(false)
    if (tab === 'square') {
      navigation.navigate('Plaza')
      return
    }
    if (tab === 'share') {
      navigation.navigate('News')
      return
    }
    // DrawerTab('mine'等)必须先映射成 RN Tab 路由名('ProfileMain'),直接 cast 会静默跳转失败
    navigateDrawerTab(rootNav, tab)
  }
  const handleDrawerNavigateCompany = () => {
    setDrawerVisible(false)
    navigation.navigate('Distribution')
  }
  const handleDrawerClaimFree = () => {
    setDrawerVisible(false)
    Clipboard.setString(FREE_RESOURCE_URL)
    appAlert('领取免费资料', '链接已复制到剪贴板,可在浏览器粘贴打开')
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
    appAlert('删除对话', '确认删除此对话?', [
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
              appAlert('提示', '删除失败,请重试')
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
      case 'assistant':
        navigation.navigate('Assistant')
        break
      case 'tools':
        navigation.navigate('AiAssistantN8n', {})
        break
    }
  }

  const drawerUser = {
    avatar: user?.avatar,
    nickname: user?.nickname ?? user?.username ?? '未登录',
    level: (user?.isVip ? 'vip' : 'normal') as 'vip' | 'normal',
  }

  // index 预览态:模型 / 课程各取前 3 条(与共享屏口径一致)
  const previewModels = models.slice(0, 3).map((m) => ({
    id: m.id,
    name: m.name,
    description: m.provider,
    isFree: !m.input_price,
  }))
  const previewItems = items.slice(0, 3)

  return (
    <View style={styles.container}>
      <NavChrome>
        <NavBar
          title="AI 视频"
          onBack={handleBack}
          rightActions={[
            { icon: PanelLeftRounded, a11yLabel: '菜单', onPress: () => setDrawerVisible(true) },
          ]}
          rightAction={
            <Tappable
              hitSlop={BACK_HIT_SLOP}
              onPress={() => setShowSearch((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel="搜索"
            >
              {showSearch ? (
                <X size={20} color={tk.text.medium} />
              ) : (
                <Search size={20} color={tk.text.medium} />
              )}
            </Tappable>
          }
        />
      </NavChrome>
      <SharedStudyIndexScreen
        colorScheme={resolvedTheme}
        items={items}
        refreshing={refreshing}
        loadingMore={loadingMore}
        error={error}
        total={total}
        searchInput={searchInput}
        showSearch={showSearch}
        pageType={pageType}
        activeCategory={activeCategory}
        previewModels={previewModels}
        previewItems={previewItems}
        initialLoading={loading && items.length === 0 && !refreshing}
        trackCategories={TRACK_CATEGORIES}
        onRefresh={onRefresh}
        onEndReached={onEndReached}
        onSubmitSearch={onSubmitSearch}
        onSearchInputChange={setSearchInput}
        onCategoryChange={setActiveCategory}
        onViewMoreModels={() => setPageType('model')}
        onViewMoreCourses={() => setPageType('study')}
        retryText="重试"
        emptyText="暂无学习视频"
        noMoreText="没有更多了"
        loadingText={t('common.loading')}
        loadingMoreText="加载更多..."
        onPublish={onPublish}
      />

      {/* Drawer 侧边栏(对齐 Uniapp DrawerComponent)：手势/遮罩属 RN 平台 chrome，不进共享屏 */}
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
  container: { flex: 1, backgroundColor: tk.surface.bg },
})

export default StudyIndexScreen
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
