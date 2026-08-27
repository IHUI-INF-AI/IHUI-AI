/**
 * NewsScreen AI资讯页(mobile-rn 端 wrapper)
 *
 * 保留 RN 特定逻辑: useState/useEffect/useNavigation/useAuth/fetchApi/Drawer/FloatBox/NavBar
 * 主 UI 委托给 @ihui/rn-app SquareScreen 共享组件
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, View, type FlatList, type ViewStyle } from 'react-native'
import Clipboard from '@react-native-clipboard/clipboard'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  deleteConversation,
  fetchApi,
  listConversations,
  type ConversationDetail,
  type Knowledge,
} from '@ihui/api-client'
import Drawer, {
  type DrawerConversationItem,
  type DrawerExtraMenu,
  type DrawerTab,
} from '../components/Drawer'
import { FloatBox, type FloatBoxType } from '../components/FloatBox'
import { NavBar, type NavBarAction } from '../components/NavBar'
import { Menu, ExternalLink } from 'lucide-react-native'
// 底部导航(对齐原 customTabBar 5 主 Tab,NewsScreen 对应「动态」Tab)
import TabBar, { type TabBarKey } from '../components/TabBar'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { DRAWER_TAB_TO_RN_TAB, mainScreenForTab } from '../navigation/tab-utils'
import {
  SquareScreen as SharedSquareScreen,
  type ArticleItem,
  type CategoryItem,
} from '@ihui/rn-app'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>
type RootNav = NativeStackNavigationProp<RootStackParamList>

/** /api/knowledge 分页响应(对齐 PageData<Knowledge>) */
interface KnowledgePage {
  list: Knowledge[]
  total: number
}

interface FloatBoxState {
  visible: boolean
  type: FloatBoxType
  message: string
}

const FLOAT_BOX_DEFAULT: FloatBoxState = { visible: false, type: 'info', message: '' }

const PAGE_SIZE = 20

const CATEGORIES: readonly { id: string; label: string; code: string }[] = [
  { id: 'all', label: '全部', code: 'ARTF_INTG' },
  { id: 'ai', label: '人工智能', code: 'AI' },
  { id: 'ml', label: '机器学习', code: 'ML' },
  { id: 'cv', label: '计算机视觉', code: 'CV' },
  { id: 'nlp', label: '自然语言', code: 'NLP' },
  { id: 'chip', label: 'AI芯片', code: 'CHIP' },
  { id: 'rec', label: '智能推荐', code: 'REC' },
] as const

const FREE_RESOURCE_URL =
  'https://aizhihuishe.feishu.cn/wiki/GPs7wff9PiDekQkKvBncryrmnIh?from=from_copylink'

const navigateRoot = (nav: RootNav | undefined, route: keyof RootStackParamList | string) => {
  if (!nav) return
  try {
    nav.navigate(route as never)
  } catch {
    // ignore
  }
}

export default function NewsScreenWrapper() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const { user } = useAuth()
  const navigation = useNavigation<NavigationProp>()
  const rootNav = navigation.getParent<RootNav>()

  /** 底部 Tab 切换(对齐原 customTabBar 5 主 Tab;News 为 RootStack 独立路由) */
  const handleTabChange = (key: TabBarKey): void => {
    switch (key) {
      case 'aiShop':
        navigation.navigate('Main', { screen: 'AiMain' })
        break
      case 'home':
        navigation.navigate('Main', { screen: 'HomeMain' })
        break
      case 'plaza':
        navigation.navigate('Plaza')
        break
      case 'mine':
        navigation.navigate('Main', { screen: 'ProfileMain' })
        break
      case 'news':
        break // 当前 Tab
    }
  }

  const [items, setItems] = useState<ArticleItem[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState('')
  const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[0]?.id ?? 'all')

  const [floatBox, setFloatBox] = useState<FloatBoxState>(FLOAT_BOX_DEFAULT)
  const [drawerVisible, setDrawerVisible] = useState(false)
  const [drawerConversations, setDrawerConversations] = useState<DrawerConversationItem[]>([])
  const [drawerConversationsLoaded, setDrawerConversationsLoaded] = useState(false)
  /** 资讯列表 ref(共享 SquareScreen 通过 onListRef 暴露,用于返回顶部 scrollToOffset) */
  const listRef = useRef<FlatList<ArticleItem> | null>(null)

  const showFloat = useCallback((message: string, type: FloatBoxType = 'info') => {
    setFloatBox({ visible: true, type, message })
  }, [])

  const hideFloat = useCallback(() => {
    setFloatBox((prev) => ({ ...prev, visible: false }))
  }, [])

  const loadDrawerConversations = useCallback(async () => {
    if (!user) return
    try {
      const res = await listConversations({ page: 1, pageSize: 20 })
      if (res.success) {
        const list: DrawerConversationItem[] = res.data.conversations.map(mapConversationToDrawer)
        setDrawerConversations(list)
      } else {
        setDrawerConversations([])
      }
    } catch {
      setDrawerConversations([])
    } finally {
      setDrawerConversationsLoaded(true)
    }
  }, [user])

  useEffect(() => {
    if (drawerVisible && !drawerConversationsLoaded && user) {
      void loadDrawerConversations()
    }
  }, [drawerVisible, drawerConversationsLoaded, user, loadDrawerConversations])

  const handleDrawerNavigate = useCallback(
    (tab: DrawerTab) => {
      setDrawerVisible(false)
      if (tab === 'square') {
        navigateRoot(rootNav, 'Plaza')
        return
      }
      if (tab === 'share') return // 已在 AI资讯页,仅收起抽屉
      rootNav?.navigate('Main', { screen: mainScreenForTab(DRAWER_TAB_TO_RN_TAB[tab]) })
    },
    [rootNav],
  )

  const handleDrawerNavigateCompany = useCallback(() => {
    setDrawerVisible(false)
    navigateRoot(rootNav, 'Distribution')
  }, [rootNav])

  const handleDrawerClaimFree = useCallback(() => {
    setDrawerVisible(false)
    try {
      Clipboard.setString(FREE_RESOURCE_URL)
      showFloat('链接已复制', 'success')
    } catch {
      showFloat('复制失败,请重试', 'warning')
    }
  }, [showFloat])

  const handleDrawerCreateNewChat = useCallback(() => {
    setDrawerVisible(false)
    rootNav?.navigate('Main', { screen: 'AiMain' })
  }, [rootNav])

  const handleDrawerSelectConversation = useCallback(
    (id: string) => {
      setDrawerVisible(false)
      const conv = drawerConversations.find((c) => c.id === id)
      rootNav?.navigate('Chat', {
        conversationId: id,
        title: conv?.title,
        modelName: conv?.modelConfig?.name,
      } as never)
    },
    [rootNav, drawerConversations],
  )

  const handleDrawerDeleteConversation = useCallback(
    (id: string) => {
      const snapshot = drawerConversations
      setDrawerConversations((prev) => prev.filter((c) => c.id !== id))
      void (async () => {
        const res = await deleteConversation(id)
        if (!res.success) {
          setDrawerConversations(snapshot)
          showFloat('删除失败,请重试', 'warning')
        } else {
          showFloat('删除成功', 'success')
        }
      })()
    },
    [drawerConversations, showFloat],
  )

  const handleDrawerOpenSettings = useCallback(() => {
    setDrawerVisible(false)
    navigateRoot(rootNav, 'Settings')
  }, [rootNav])

  const handleDrawerOpenMessages = useCallback(() => {
    setDrawerVisible(false)
    navigateRoot(rootNav, 'MessageCenter')
  }, [rootNav])

  const handleDrawerGoHome = useCallback(() => {
    setDrawerVisible(false)
    rootNav?.navigate('Main', { screen: 'HomeMain' })
  }, [rootNav])

  const handleNavigateExtra = useCallback(
    (menu: DrawerExtraMenu) => {
      setDrawerVisible(false)
      switch (menu) {
        case 'aigc':
          navigateRoot(rootNav, 'AigcList')
          break
        case 'learn':
          navigateRoot(rootNav, 'Learn')
          break
        case 'modelPlaza':
          navigateRoot(rootNav, 'ModelPlaza')
          break
        case 'company':
          navigateRoot(rootNav, 'Distribution')

          break

        case 'assistant':
          navigation?.navigate('Assistant')

          break

        case 'tools':
          navigateRoot(rootNav, 'Settings')

          break

        default:
          break
      }
    },
    [navigation, rootNav],
  )

  const drawerUser = useMemo(
    () => ({
      avatar: user?.avatar,
      nickname: user?.nickname ?? user?.username ?? '未登录',
      level: ((user as { isVip?: boolean } | null)?.isVip ? 'vip' : 'normal') as 'vip' | 'normal',
    }),
    [user],
  )

  const leftActions = useMemo<ReadonlyArray<NavBarAction>>(
    () => [{ icon: Menu, label: '菜单', onPress: () => setDrawerVisible(true) }],
    [],
  )

  // 分享入口(孤儿路由修复:Share 注册无入口,资讯/动态页补挂)
  const rightActions = useMemo<ReadonlyArray<NavBarAction>>(
    () => [
      {
        icon: ExternalLink,
        label: '分享',
        onPress: () => {
          const nav = navigation.getParent<RootNav>() ?? navigation
          nav.navigate('Share')
        },
      },
    ],
    [navigation],
  )

  const load = useCallback(
    async (targetPage: number, append: boolean) => {
      // 追加分页时不触发全屏 loading(避免上拉时列表闪加载态)
      if (!append) {
        setLoading(true)
        setError('')
      }
      try {
        const code = CATEGORIES.find((c) => c.id === selectedCategory)?.code ?? 'ARTF_INTG'
        const res = await fetchApi<KnowledgePage>('/api/knowledge', {
          method: 'GET',
          params: { code, page: targetPage, pageSize: PAGE_SIZE },
        })
        if (res.success && res.data) {
          const list: ArticleItem[] = res.data.list.map((k) => ({
            id: k.id,
            title: k.title,
            summary: k.summary,
            authorName: k.authorName || '佚名',
            createdAt: k.createdAt,
            viewCount: k.viewCount ?? 0,
            category: k.category,
            sourceName: (k as Knowledge & { sourceName?: string }).sourceName,
          }))
          setItems((prev) => (append ? [...prev, ...list] : list))
          setPage(targetPage)
          // 不足 pageSize 视为无更多(对齐原 scrolltolower 语义)
          setHasMore(list.length >= PAGE_SIZE)
        } else {
          if (!append) {
            setItems([])
            setError(res.error || '加载失败')
          }
        }
      } catch {
        if (!append) {
          setItems([])
          setError('网络异常')
        }
      } finally {
        if (!append) setLoading(false)
        setRefreshing(false)
        setLoadingMore(false)
      }
    },
    [selectedCategory],
  )

  useEffect(() => {
    void load(1, false)
  }, [load])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await load(1, false)
  }, [load])

  const handleEndReached = useCallback(() => {
    // 上拉分页(对齐原 scrolltolower):加载中防重入,无更多则停止
    if (loading || loadingMore || refreshing || !hasMore) return
    setLoadingMore(true)
    void load(page + 1, true)
  }, [loading, loadingMore, refreshing, hasMore, page, load])

  const handleSelectCategory = useCallback(
    (id: string) => {
      setSelectedCategory(id)
      setLoading(true)
    },
    [setSelectedCategory],
  )

  const handleItemClick = useCallback(
    (id: string) => {
      // 对齐 Uniapp share 页资讯卡片跳 Official-information 详情;RN 等价已注册路由为 ArticleDetail
      rootNav?.navigate('ArticleDetail', { id })
    },
    [rootNav],
  )

  const categoriesForShared = useMemo<CategoryItem[]>(
    () => CATEGORIES.map((c) => ({ id: c.id, label: c.label })),
    [],
  )

  const handleBack = useCallback(() => {
    navigation.goBack()
  }, [navigation])

  /** 返回顶部(对齐 Uniapp backToTop → pageScrollTo,RN 端用列表 ref scrollToOffset) */
  const handleBackToTop = useCallback(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true })
  }, [])

  return (
    <View style={styles.container}>
      <NavBar
        title="AI资讯"
        leftActions={leftActions}
        rightActions={rightActions}
        onBack={handleBack}
      />
      <SharedSquareScreen
        t={t}
        colorScheme={resolvedTheme === 'dark' ? 'dark' : 'light'}
        items={items}
        loading={loading}
        refreshing={refreshing}
        error={error}
        categories={categoriesForShared}
        selectedCategory={selectedCategory}
        onSelectCategory={handleSelectCategory}
        onRefresh={handleRefresh}
        onEndReached={handleEndReached}
        onItemClick={handleItemClick}
        showBackTop={true}
        onBackToTop={handleBackToTop}
        onListRef={(ref) => {
          listRef.current = ref as FlatList<ArticleItem> | null
        }}
        onBack={handleBack}
      />
      <FloatBox
        visible={floatBox.visible}
        type={floatBox.type}
        message={floatBox.message}
        onHide={hideFloat}
      />
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
      {/* 底部导航(对齐原 customTabBar 5 主 Tab) */}
      <TabBar activeTab="news" onChange={handleTabChange} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F7FB',
  } as ViewStyle,
})

/** ConversationDetail → DrawerConversationItem 映射(对齐 PlazaScreen/ProfileScreen 写法) */
function mapConversationToDrawer(item: ConversationDetail): DrawerConversationItem {
  const tsStr = item.lastMessageAt ?? item.updatedAt ?? item.createdAt
  const createdAt = tsStr ? new Date(tsStr).getTime() : Date.now()
  const model = item.model ?? ''
  return {
    id: item.id,
    title: item.title?.trim() || '未命名对话',
    modelConfig: model ? { id: model, name: model, icon: undefined } : undefined,
    createdAt,
  }
}

/** RootNavigator 默认导入 NewsScreenWrapper(具名导出 NewsScreen 保持兼容,见上) */
export { NewsScreenWrapper as NewsScreen }
