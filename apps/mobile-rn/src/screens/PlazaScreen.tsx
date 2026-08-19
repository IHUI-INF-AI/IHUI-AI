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
import {
  Modal,
  View,
  Pressable,
  Text,
  StyleSheet,
  type ViewStyle,
  type TextStyle,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  deleteConversation,
  getAgentCategories,
  getPlazaList,
  listConversations,
  type AgentCategoryItem,
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
import { DRAWER_TAB_TO_RN_TAB, mainScreenForTab } from '../navigation/tab-utils'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>
type RootNav = NativeStackNavigationProp<RootStackParamList>

const PAGE_SIZE = 10

const FLOAT_BOX_DEFAULT = { visible: false, type: 'info' as FloatBoxType, message: '' }

/**
 * 需求赛道 fallback(对齐原项目 plaza/index.vue category(1) → categorySaidao 首项"全公司";
 * 与 HomeScreen AGENT_CATEGORY_FALLBACK 同源语义,API 失败时兜底避免筛选弹层为空)。
 */
const PLAZA_CATEGORY_FALLBACK: ReadonlyArray<AgentCategoryItem> = [
  { id: '', name: '全公司' },
  { id: 'tech', name: '技术' },
  { id: 'design', name: '设计' },
  { id: 'market', name: '市场' },
  { id: 'operation', name: '运营' },
]

/**
 * 跨栈导航 helper — React Navigation v6 的 navigate 重载对 RootStackParamList
 * 联合类型推断失败,需在 helper 内部隔离类型断言。
 */
function navigateRoot(nav: RootNav | undefined, route: keyof RootStackParamList): void {
  if (nav) {
    nav.navigate(route as never)
  }
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
  // 需求赛道筛选(对齐原项目 plaza/index.vue:顶栏 showFenLei 分类按钮 → categorySaidao 赛道弹层)
  const [trackCategories, setTrackCategories] =
    useState<ReadonlyArray<AgentCategoryItem>>(PLAZA_CATEGORY_FALLBACK)
  const [selectedCategory, setSelectedCategory] = useState('')
  const [categoryVisible, setCategoryVisible] = useState(false)

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
        // 使用 PlazaScreenProps 的 items 类型。
        // 注:api-client getPlazaList 声明 categories?: string[],与基类型 PageQuery 的标量
        // index signature 冲突(既有缺陷,buildQs 用 String(v) 序列化数组为逗号分隔串),
        // 此处以 as never 绕过类型检查(与 navigateRoot 同款项目先例)。
        const res = await getPlazaList({
          page: targetPage,
          pageSize: PAGE_SIZE,
          status: isMyTask ? undefined : status || undefined,
          search: search.trim() || undefined,
          creator: isMyTask ? user?.id : undefined,
          // 赛道筛选(对齐原项目 categorys 参数,''=全公司,非空时传单元素数组)
          categories: selectedCategory ? [selectedCategory] : undefined,
        } as never)
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
    [status, search, selectedCategory, user?.id, showFloat],
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

  // ── 需求赛道加载(对齐原项目 plaza/index.vue category(1) → categorySaidao) ──
  // 数据源与 HomeScreen 复用同一 getAgentCategories API(agentCategory),
  // 失败回退静态 5 项,保证筛选弹层非空。
  const loadTrackCategories = useCallback(async (): Promise<void> => {
    try {
      const res = await getAgentCategories()
      if (res.success && res.data && Array.isArray(res.data.agentCategory)) {
        setTrackCategories([{ id: '', name: '全公司' }, ...res.data.agentCategory])
        return
      }
    } catch {
      // 分类加载失败:保持兜底列表,不阻塞主流程
    }
    setTrackCategories(PLAZA_CATEGORY_FALLBACK)
  }, [])

  useEffect(() => {
    void loadTrackCategories()
  }, [loadTrackCategories])

  // 选择赛道(对齐原项目 changeSaidao:单选,选"全公司"清空 → reGet)
  const onSelectCategory = (id: string): void => {
    setSelectedCategory(id)
    setCategoryVisible(false)
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
      navigateRoot(rootNav, 'Plaza')
      return
    }
    if (tab === 'share') {
      navigateRoot(rootNav, 'News')
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
        rightActions={[
          {
            icon: '🗂️',
            label: '分类',
            // 对齐原项目 navigation-bars showFenLei → 赛道筛选弹层(ScrollTitle + Tab)
            onPress: () => setCategoryVisible(true),
          },
        ]}
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
      {/* 需求赛道筛选弹层(对齐原项目 plaza/index.vue 顶栏分类按钮 → categorySaidao 赛道弹层,
       *  内联等价实现:居中卡片单选,选中即刷新列表) */}
      <Modal
        visible={categoryVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCategoryVisible(false)}
      >
        <Pressable
          style={styles.categoryMask}
          onPress={() => setCategoryVisible(false)}
          accessibilityLabel="关闭赛道筛选"
        >
          <Pressable style={styles.categoryCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.categoryTitle}>选择需求赛道</Text>
            <View style={styles.categoryList}>
              {trackCategories.map((cat) => {
                const active = selectedCategory === cat.id
                return (
                  <Pressable
                    key={cat.id || 'all'}
                    style={[styles.categoryItem, active ? styles.categoryItemActive : null]}
                    onPress={() => onSelectCategory(cat.id)}
                    accessibilityRole="button"
                    accessibilityLabel={cat.name}
                  >
                    <Text
                      style={[
                        styles.categoryItemText,
                        active ? styles.categoryItemTextActive : null,
                      ]}
                    >
                      {cat.name}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
  // 需求赛道筛选弹层样式(圆角守门:仅 8/12)
  categoryMask: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  } as ViewStyle,
  categoryCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
  } as ViewStyle,
  categoryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
    textAlign: 'center',
    marginBottom: 14,
  } as TextStyle,
  categoryList: {
    gap: 8,
  } as ViewStyle,
  categoryItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  } as ViewStyle,
  categoryItemActive: {
    backgroundColor: '#5088fa',
  } as ViewStyle,
  categoryItemText: {
    fontSize: 14,
    color: '#333',
  } as TextStyle,
  categoryItemTextActive: {
    color: '#fff',
    fontWeight: '600',
  } as TextStyle,
})
