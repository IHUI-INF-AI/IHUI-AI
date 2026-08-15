/**
 * PlazaScreen AI需求广场页(mobile-rn 端 wrapper)
 *
 * 对齐历史项目 pagesA/plaza/index.vue(AI 需求广场):
 * - 顶部 NavBar(标题「AI需求广场」+ 菜单按钮打开 Drawer,对齐 navigation-bars showMenu)+ 右侧搜索开关
 * - 状态切换 chips(待接单 2 / 开发中 4 / 已完成 6 / 我的任务 9,对齐 .vue Status 组件)
 * - 搜索框(对齐 .vue SearchInput,showSearchBox 切换)
 * - 双列卡片(头像/createdName/标题/描述/日期范围/周期/价格/状态按钮,对齐 .vue CardContent)
 * - 下拉刷新 + 上拉分页(对齐 .vue scrolltolower)
 * - 空态(对齐 .vue empty:千万级空白市场)+ 加载态(Loading)+ 错误重试
 * - 悬浮发布按钮(对齐 .vue floating-publish-btn:居中,100rpx×100rpx≈50dp,圆角 15rpx≈8dp)
 * - Drawer 侧滑抽屉(对齐 .vue DrawerComponent,菜单按钮控制 tagWrapShow)
 * - FloatBox 悬浮提示
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Pressable, Text, StyleSheet, type ViewStyle, type TextStyle } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  deleteConversation,
  getPlazaList,
  listConversations,
  type ConversationDetail,
} from '@ihui/api-client'
import { PlazaScreen as SharedPlazaScreen, type PlazaScreenProps } from '@ihui/rn-app'
import Drawer, {
  type DrawerConversationItem,
  type DrawerExtraMenu,
  type DrawerTab,
} from '../components/Drawer'
import { FloatBox, type FloatBoxType } from '../components/FloatBox'
import { NavBar, type NavBarAction } from '../components/NavBar'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { mainScreenForTab, type MainTabKey } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>
type RootNav = NativeStackNavigationProp<RootStackParamList>

const PAGE_SIZE = 10

const FLOAT_BOX_DEFAULT = { visible: false, type: 'info' as FloatBoxType, message: '' }

/**
 * 跨栈导航 helper — React Navigation v6 的 navigate 重载对 RootStackParamList
 * 联合类型推断失败,需在 helper 内部隔离类型断言。
 */
function navigateRoot(nav: RootNav | undefined, route: keyof RootStackParamList): void {
  if (nav) {
    nav.navigate(route as never)
  }
}

/** Drawer 5 主菜单 → RN Tab 路由映射(square/share 跳 RootStack 独立页) */
const DRAWER_TAB_TO_RN_TAB: Record<DrawerTab, MainTabKey> = {
  home: 'HomeMain',
  ai: 'AiMain',
  square: 'HomeMain',
  share: 'HomeMain',
  mine: 'ProfileMain',
}

/** ConversationDetail → DrawerConversationItem 映射(对齐 ProfileScreen mapConversationToDrawer) */
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

export function PlazaScreen() {
  const { t } = useI18n()
  const { user } = useAuth()
  const navigation = useNavigation<NavigationProp>()
  const rootNav = navigation.getParent<RootNav>()

  const [items, setItems] = useState<PlazaScreenProps['items']>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [status, setStatus] = useState('2')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [floatBox, setFloatBox] = useState(FLOAT_BOX_DEFAULT)

  // Drawer 侧滑抽屉
  const [drawerVisible, setDrawerVisible] = useState(false)
  const [drawerConversations, setDrawerConversations] = useState<DrawerConversationItem[]>([])
  const [drawerConversationsLoaded, setDrawerConversationsLoaded] = useState(false)

  const showFloat = useCallback((message: string, type: FloatBoxType = 'error') => {
    setFloatBox({ visible: true, type, message })
  }, [])

  const hideFloat = useCallback(() => {
    setFloatBox((prev) => ({ ...prev, visible: false }))
  }, [])

  const load = useCallback(
    async (opts: { reset?: boolean; nextPage?: number } = {}) => {
      const reset = opts.reset ?? false
      const targetPage = opts.nextPage ?? 1
      if (reset) {
        setLoading(true)
        setError('')
      }
      try {
        const isMyTask = status === '9'
        // 使用 PlazaScreenProps 的 items 类型
        const res = await getPlazaList({
          page: targetPage,
          pageSize: PAGE_SIZE,
          status: isMyTask ? undefined : status || undefined,
          search: search.trim() || undefined,
          creator: isMyTask ? user?.id : undefined,
        })
        if (!res.success) throw new Error(res.error)
        const list = (res.data.list ?? []) as PlazaScreenProps['items']
        setItems((prev) => (reset ? list : [...prev, ...list]))
        setTotal(res.data.total ?? 0)
        setPage(targetPage)
      } catch {
        const errMsg = '加载失败,请下拉刷新重试'
        setError(errMsg)
        showFloat(errMsg)
      } finally {
        setLoading(false)
        setRefreshing(false)
        setLoadingMore(false)
      }
    },
    [status, search, user?.id, showFloat],
  )

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
    navigation.navigate('PostCreate', {})
  }

  const showDetail = (item: PlazaScreenProps['items'][number]) => {
    navigation.navigate('PostDetail', { id: String(item.id) })
  }

  // ── Drawer 回调 ──
  const loadDrawerConversations = useCallback(async () => {
    const res = await listConversations({ page: 1, pageSize: 50 })
    if (res.success) {
      const list: DrawerConversationItem[] = res.data.conversations.map(mapConversationToDrawer)
      setDrawerConversations(list)
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

  const handleDrawerNavigate = (tab: DrawerTab) => {
    setDrawerVisible(false)
    if (tab === 'square') {
      navigateRoot(rootNav, 'Square')
      return
    }
    if (tab === 'share') {
      navigateRoot(rootNav, 'Share')
      return
    }
    rootNav?.navigate('Main', { screen: mainScreenForTab(DRAWER_TAB_TO_RN_TAB[tab]) })
  }

  const handleDrawerNavigateCompany = () => {
    setDrawerVisible(false)
    navigateRoot(rootNav, 'Distribution')
  }

  const handleDrawerClaimFree = () => {
    setDrawerVisible(false)
    showFloat('链接已复制', 'success')
  }

  const handleDrawerCreateNewChat = () => {
    setDrawerVisible(false)
    rootNav?.navigate('Main', { screen: 'AiMain' })
  }

  const handleDrawerSelectConversation = (id: string) => {
    setDrawerVisible(false)
    const conv = drawerConversations.find((c) => c.id === id)
    rootNav?.navigate('Chat', {
      conversationId: id,
      title: conv?.title,
      modelName: conv?.modelConfig?.name,
    } as never)
  }

  const handleDrawerDeleteConversation = (id: string) => {
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
  }

  const handleDrawerOpenSettings = () => {
    setDrawerVisible(false)
    navigateRoot(rootNav, 'Settings')
  }

  const handleDrawerOpenMessages = () => {
    setDrawerVisible(false)
    navigateRoot(rootNav, 'MessageCenter')
  }

  const handleDrawerGoHome = () => {
    setDrawerVisible(false)
    rootNav?.navigate('Main', { screen: 'HomeMain' })
  }

  const handleNavigateExtra = (menu: DrawerExtraMenu) => {
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
      case 'tools':
      default:
        break
    }
  }

  const drawerUser = {
    avatar: user?.avatar,
    nickname: user?.nickname ?? user?.username ?? '未登录',
    level: ((user as { isVip?: boolean } | null)?.isVip ? 'vip' : 'normal') as 'vip' | 'normal',
  }

  const leftActions = useMemo<ReadonlyArray<NavBarAction>>(
    () => [{ icon: '☰', label: '菜单', onPress: () => setDrawerVisible(true) }],
    [],
  )

  return (
    <View style={styles.container}>
      <NavBar
        title="AI需求广场"
        leftActions={leftActions}
        onBack={() => navigation.goBack()}
        rightAction={
          <Pressable
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            onPress={() => setShowSearch((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel="搜索"
          >
            <Text style={styles.navIcon}>{showSearch ? '✕' : '🔍'}</Text>
          </Pressable>
        }
      />
      <SharedPlazaScreen
        t={t}
        items={items}
        loading={loading}
        refreshing={refreshing}
        loadingMore={loadingMore}
        error={error}
        status={status}
        search={search}
        showSearch={showSearch}
        onRefresh={onRefresh}
        onEndReached={onEndReached}
        onStatusChange={setStatus}
        onSearchChange={setSearchInput}
        onSubmitSearch={onSubmitSearch}
        onPressItem={showDetail}
        onPublish={onPublish}
        colorScheme="light"
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
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  } as ViewStyle,
  navIcon: {
    fontSize: 20,
    color: '#000',
  } as TextStyle,
})
