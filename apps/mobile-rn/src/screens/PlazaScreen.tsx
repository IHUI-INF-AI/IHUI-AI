// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Modal,
  View,
  Pressable,
  Text,
  Image,
  StyleSheet,
  type ImageStyle,
  type ViewStyle,
  type TextStyle,
} from 'react-native'
import { BlurTargetView } from 'expo-blur'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import Clipboard from '@react-native-clipboard/clipboard'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  deleteConversation,
  getAgentCategories,
  getPlazaList,
  listConversations,
  type AgentCategoryItem,
  type ConversationDetail,
} from '@ihui/api-client'
import {
  PlazaScreen as SharedPlazaScreen,
  CategoryDropdown,
  type CategoryItem,
  type PlazaScreenProps,
} from '@ihui/rn-app'
import { apiFailureToError, toUserFriendlyMessage } from '@ihui/shared/utils'
import { tokens } from '../theme/active-tokens'
import { useTheme } from '../context/ThemeContext'
import Drawer, {
  type DrawerConversationItem,
  type DrawerExtraMenu,
  type DrawerTab,
} from '../components/Drawer'
import { FloatBox, type FloatBoxType } from '../components/FloatBox'
import { NavBar, type NavBarAction } from '../components/NavBar'
// 底部导航(对齐原 customTabBar 5 主 Tab,PlazaScreen 对应「广场」Tab)
import TabBar, { type TabBarKey } from '../components/TabBar'
import { tabBarScrollReserve } from '../components/TabBar.styles'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { navigateDrawerTab } from '../navigation/tab-utils'
import { rpx } from '../utils/rpx'
import { Search, User, LayoutGrid, X } from 'lucide-react-native'
import { PanelLeftRounded } from '../components/PanelLeftRounded'

import { rnRadius, rnRadiusFor, rnType, rnCssLight } from '@ihui/design-tokens'
import { NavChrome } from '../components/NavChrome'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>
type RootNav = NativeStackNavigationProp<RootStackParamList>

const PAGE_SIZE = 10

/** 免费资料链接(对齐原项目 plaza/index.vue lingqu → setClipboardData) */
const FREE_RESOURCE_URL =
  'https://aizhihuishe.feishu.cn/wiki/GPs7wff9PiDekQkKvBncryrmnIh?from=from_copylink'

const PLAZA_TASK_STATUS = {
  waiting: 'waiting',
  developing: 'developing',
  completed: 'completed',
  mine: 'mine',
} as const

const FLOAT_BOX_DEFAULT = { visible: false, type: 'info' as FloatBoxType, message: '' }

/**
 * 需求赛道 fallback(对齐原项目 plaza/index.vue category(1) → categorySaidao 首项「全公司」;
 * RN 无中文赛道名接口 ⇒ 兜底 5 项走 i18n 键,消费侧 makePlazaCategoryFallback 解析)
 * [2026-10-24 修复头尾脱节]原定义名 FALLBACK_TRACKS 与两处引用名 PLAZA_CATEGORY_FALLBACK
 * 改名改半(HEAD 即 TS2304 悬空引用),本次一并接正。
 */
const PLAZA_TRACK_FALLBACK_KEYS: ReadonlyArray<{ id: string; nameKey: string }> = [
  { id: '', nameKey: 'plaza.index.trackAll' },
  { id: 'tech', nameKey: 'plaza.index.trackTech' },
  { id: 'design', nameKey: 'plaza.index.trackDesign' },
  { id: 'market', nameKey: 'plaza.index.trackMarket' },
  { id: 'operation', nameKey: 'plaza.index.trackOperation' },
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

/** ConversationDetail → DrawerConversationItem 映射(对齐 ProfileScreen mapConversationToDrawer;
 *  空标题兜底文案由调用方以 i18n 传入,禁止端内写死) */
function mapConversationToDrawer(c: ConversationDetail, untitled: string): DrawerConversationItem {
  const tsStr = c.lastMessageAt ?? c.updatedAt ?? c.createdAt
  const createdAt = tsStr ? new Date(tsStr).getTime() : Date.now()
  const model = c.model ?? ''
  return {
    id: c.id,
    title: c.title?.trim() || untitled,
    modelConfig: model ? { id: model, name: model, icon: undefined } : undefined,
    createdAt,
    favorited: c.favorite === true,
  }
}

export function PlazaScreen() {
  const { t } = useI18n()
  const { user } = useAuth()
  const navigation = useNavigation<NavigationProp>()
  const rootNav = navigation.getParent<RootNav>()
  // 悬浮 TabBar 让位(2026-10-16):内容滚到底部时仍完整露在胶囊之上,可继续滚到玻璃底下
  const insets = useSafeAreaInsets()
  const tabBarBlurTargetRef = useRef<View>(null)

  /** 赛道兜底 5 项(nameKey→展示词,语言切换后新拉取自然用新语言) */
  const makePlazaCategoryFallback = useCallback(
    (): AgentCategoryItem[] =>
      PLAZA_TRACK_FALLBACK_KEYS.map((f) => ({ id: f.id, name: t(f.nameKey) })),
    [t],
  )

  /** 底部 Tab 切换(对齐原 customTabBar 5 主 Tab;Plaza 为 RootStack 独立路由,经 Main 聚焦 Tab) */
  const handleTabChange = (key: TabBarKey): void => {
    switch (key) {
      case 'aiShop':
        navigation.navigate('Main', { screen: 'AiMain' })
        break
      case 'home':
        navigation.navigate('Main', { screen: 'HomeMain' })
        break
      case 'news':
        navigation.navigate('News')
        break
      case 'mine':
        navigation.navigate('Main', { screen: 'ProfileMain' })
        break
      case 'plaza':
        break // 当前 Tab
    }
  }

  const [items, setItems] = useState<PlazaScreenProps['items']>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [status, setStatus] = useState<string>(PLAZA_TASK_STATUS.waiting)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [floatBox, setFloatBox] = useState(FLOAT_BOX_DEFAULT)
  // 需求赛道筛选(对齐原项目 plaza/index.vue:顶栏 showFenLei 分类按钮 → categorySaidao 赛道弹层)
  const [trackCategories, setTrackCategories] = useState<ReadonlyArray<AgentCategoryItem>>(() =>
    makePlazaCategoryFallback(),
  )
  const [selectedCategory, setSelectedCategory] = useState('')
  const [categoryVisible, setCategoryVisible] = useState(false)
  // 身份切换弹窗(对齐原项目 plaza/index.vue L78-108:切换身份 Modal)
  const [identityVisible, setIdentityVisible] = useState(false)
  // 开发者须知弹窗(对齐原项目 L110-150:开发者须知 Modal,5 条规则)
  const [noticeVisible, setNoticeVisible] = useState(false)
  const { resolvedTheme } = useTheme()
  const trackCategoryItems = useMemo<CategoryItem[]>(
    () => trackCategories.map((cat) => ({ id: cat.id, label: cat.name })),
    [trackCategories],
  )

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
        const isMyTask = status === PLAZA_TASK_STATUS.mine
        // 使用 PlazaScreenProps 的 items 类型。
        const res = await getPlazaList({
          page: targetPage,
          pageSize: PAGE_SIZE,
          taskStatus: isMyTask ? undefined : status || undefined,
          search: search.trim() || undefined,
          creator: isMyTask ? user?.id : undefined,
          // 赛道筛选(对齐原项目 categorys 参数,''=全公司,非空时传单元素数组)
          categories: selectedCategory ? [selectedCategory] : undefined,
        })
        // status/errorCode 必须跟着 throw 一起走:toUserFriendlyMessage 的判序是
        // errorCode → HTTP status → 文案正则。只抛 message 时,401 的
        // "Invalid or expired token" 会先撞上参数类正则(/invalid/),用户看到的是
        // "提交的信息有误,请检查后重试"而不是"登录已过期"(真机实测:进广场 tab 即弹)。
        // 出口用 apiFailureToError —— 全仓另有 212 处同型 `throw new Error(res.error)`,
        // 迁移时逐处换成本函数,不要各处手搓 Object.assign。
        if (!res.success) throw apiFailureToError(res)
        const list = (res.data.list ?? []) as PlazaScreenProps['items']
        setItems((prev) => (reset ? list : [...prev, ...list]))
        setTotal(res.data.total ?? 0)
        setPage(targetPage)
      } catch (e: unknown) {
        // 透出服务端的具体原因(如 429 需人机验证);错误体无可用信息时才回退本页通用文案
        const detail = e instanceof Error ? e.message : typeof e === 'string' ? e : ''
        const errMsg = detail.trim() ? toUserFriendlyMessage(e) : t('plaza.index.loadFailedRefresh')
        setError(errMsg)
        showFloat(errMsg)
      } finally {
        setLoading(false)
        setRefreshing(false)
        setLoadingMore(false)
      }
    },
    [status, search, selectedCategory, user?.id, showFloat, t],
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
        setTrackCategories([{ id: '', name: t('plaza.index.trackAll') }, ...res.data.agentCategory])
        return
      }
    } catch {
      // 分类加载失败:保持兜底列表,不阻塞主流程
    }
    setTrackCategories(makePlazaCategoryFallback())
  }, [makePlazaCategoryFallback, t])

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
      const list: DrawerConversationItem[] = res.data.conversations.map((c) =>
        mapConversationToDrawer(c, t('plaza.index.untitledConv')),
      )
      setDrawerConversations(list)
    } else {
      setDrawerConversations([])
    }
    setDrawerConversationsLoaded(true)
  }, [t])

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
    navigateDrawerTab(rootNav, tab)
  }

  const handleDrawerNavigateCompany = () => {
    setDrawerVisible(false)
    navigateRoot(rootNav, 'Distribution')
  }

  const handleDrawerClaimFree = () => {
    setDrawerVisible(false)
    // 真复制资料链接后再提示(对齐原项目 lingqu → setClipboardData)
    Clipboard.setString(FREE_RESOURCE_URL)
    showFloat(t('plaza.index.linkCopied'), 'success')
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

  // [2026-10-24 修复并发写拼接残骸]原 376-385 把「删除会话」与一段引用不存在
  // (setPendingDeleteId/drawerTab 在本组件无声明)的「删帖子」IIFE 尾块焊在一起,
  // 属另一会话旧基线回写事故。按本组件可查证符号(load/showFloat/loadDrawerConversations)
  // 重建为 ProfileScreen 同型语义:删除失败回滚+toast,成功刷新+toast。
  const handleDrawerDeleteConversation = (id: string) => {
    const snapshot = drawerConversations
    setDrawerConversations((prev) => prev.filter((c) => c.id !== id))
    void (async () => {
      const res = await deleteConversation(id)
      if (!res.success) {
        setDrawerConversations(snapshot)
        showFloat(t('profile.delFailedRetry'), 'warning')
        return
      }
      void load({ reset: true })
      showFloat(t('plaza.index.delOk'), 'success')
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
  }

  const drawerUser = {
    avatar: user?.avatar,
    nickname: user?.nickname ?? user?.username ?? t('plaza.index.notLoggedIn'),
    level: ((user as { isVip?: boolean } | null)?.isVip ? 'vip' : 'normal') as 'vip' | 'normal',
  }

  const leftActions = useMemo<ReadonlyArray<NavBarAction>>(
    () => [
      {
        icon: PanelLeftRounded,
        a11yLabel: t('common.menu'),
        onPress: () => setDrawerVisible(true),
      },
    ],
    [t],
  )

  return (
    <View style={styles.container}>
      {/* Android 真模糊:背景内容包进 BlurTargetView 供 TabBar 胶囊取样(两个 Modal 不包) */}
      <BlurTargetView ref={tabBarBlurTargetRef} style={{ flex: 1 }}>
        <NavChrome>
          <NavBar
            title={t('plaza.index.title')}
            leftActions={leftActions}
            onBack={() => navigation.goBack()}
            rightActions={[
              {
                icon: LayoutGrid,
                a11yLabel: t('plaza.index.navCategory'),
                icon: FolderOpen,
                label: t('plaza.index.navCategory'),
                // 对齐原项目 navigation-bars showFenLei → 赛道筛选弹层(ScrollTitle + Tab)
                onPress: () => setCategoryVisible(true),
              },
              {
                icon: User,
                label: t('plaza.index.identityLabel'),
                // 对齐原项目 plaza/index.vue setshowBottom → 切换身份弹窗
                onPress: () => setIdentityVisible(true),
              },
            ]}
            rightAction={
              <Pressable
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                onPress={() => setShowSearch((v) => !v)}
                accessibilityRole="button"
                accessibilityLabel={t('common.search')}
              >
                {showSearch ? (
                  <X size={20} color={tokens.text.medium} />
                ) : (
                  <Search size={20} color={tokens.text.medium} />
                )}
              </Pressable>
            }
          />
        </NavChrome>
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
          contentBottomPadding={tabBarScrollReserve(insets.bottom)}
          colorScheme={resolvedTheme}
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
        {/* 需求赛道筛选(对齐原项目 plaza/index.vue 顶栏分类按钮 → categorySaidao 赛道弹层):
         *  改走统一 CategoryDropdown —— 顶栏 LayoutGrid 受控开合,选中即刷新列表(语义未变) */}
         *  改走统一 CategoryDropdown —— 顶栏 FolderOpen 受控开合,选中即刷新列表(语义未变) */}
        <CategoryDropdown
          items={trackCategoryItems}
          selectedId={selectedCategory}
          onSelect={onSelectCategory}
          colorScheme={resolvedTheme}
          visible={categoryVisible}
          onVisibleChange={setCategoryVisible}
          hideTrigger
          panelTitle={t('plaza.index.trackPanelTitle')}
          backdropA11yLabel={t('plaza.index.closeTrackFilter')}
          testID="plaza-track-dropdown"
        />
      </BlurTargetView>
      <NavChrome>
        <NavBar
          title={t('plaza.index.title')}
          leftActions={leftActions}
          onBack={() => navigation.goBack()}
          rightActions={[
            {
              // 2026-10-28 用户定:FolderOpen「分类」换 LayoutGrid 纯图标去文字(位置不动,
              // 仍在右侧操作区首位,紧邻身份钮),a11yLabel 保语义
              icon: LayoutGrid,
              a11yLabel: t('plaza.index.navCategory'),
              // 对齐原项目 navigation-bars showFenLei → 赛道筛选弹层(ScrollTitle + Tab)
              onPress: () => setCategoryVisible(true),
            },
            {
              icon: User,
              label: t('plaza.index.identityLabel'),
              // 对齐原项目 plaza/index.vue setshowBottom → 切换身份弹窗
              onPress: () => setIdentityVisible(true),
            },
          ]}
          rightAction={
            <Pressable
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              onPress={() => setShowSearch((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={t('common.search')}
            >
              {showSearch ? (
                <X size={20} color={tokens.text.medium} />
              ) : (
                <Search size={20} color={tokens.text.medium} />
              )}
            </Pressable>
          }
      </NavChrome>
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
        contentBottomPadding={tabBarScrollReserve(insets.bottom)}
        colorScheme={resolvedTheme}
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
      {/* 需求赛道筛选(对齐原项目 plaza/index.vue 顶栏分类按钮 → categorySaidao 赛道弹层):
       *  改走统一 CategoryDropdown —— 顶栏分类钮(LayoutGrid,2026-10-28 去 FolderOpen)受控开合,选中即刷新列表(语义未变) */}
      <CategoryDropdown
        items={trackCategoryItems}
        selectedId={selectedCategory}
        onSelect={onSelectCategory}
        colorScheme={resolvedTheme}
        visible={categoryVisible}
        onVisibleChange={setCategoryVisible}
        hideTrigger
        panelTitle={t('plaza.index.trackPanelTitle')}
        backdropA11yLabel={t('plaza.index.closeTrackFilter')}
        testID="plaza-track-dropdown"
      />
      {/* 身份切换弹窗(对齐原项目 plaza/index.vue L78-108:
       *  切换身份 → 找大佬开发(普通身份) / 我是开发者(跳开发者页);footer 打开开发者须知) */}
      <Modal
        visible={identityVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIdentityVisible(false)}
      >
        <Pressable
          style={styles.categoryMask}
          onPress={() => setIdentityVisible(false)}
          accessibilityLabel={t('plaza.index.closeIdentity')}
        >
          <Pressable style={styles.identityCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.identityTitle}>{t('plaza.index.identityTitle')}</Text>
            {/* 身份用户区(对齐原项目 plaza/index.vue identity-user:头像 + 昵称 + 副文案) */}
            <View style={styles.identityUser}>
              {user?.avatar ? (
                <Image source={{ uri: user.avatar }} style={styles.identityAvatar} />
              ) : (
                <View style={[styles.identityAvatar, styles.identityAvatarFallback]}>
                  <User size={28} color={tokens.text.secondary} />
                </View>
              )}
              <View style={styles.identityUserInfo}>
                <Text style={styles.identityNickname}>
                  {user?.nickname || user?.username || t('plaza.index.notLoggedInUser')}
                </Text>
                <Text style={styles.identitySubtext}>{t('plaza.index.identitySub')}</Text>
              </View>
            </View>
            <View style={styles.identityButtons}>
              <Pressable
                style={[styles.identityBtn, styles.identityBtnOutline]}
                onPress={() => {
                  // 对齐原项目 toSet:写身份 userStatus='nomal' + 关弹窗(切换发布路径视图)
                  setIdentityVisible(false)
                  void AsyncStorage.setItem('userStatus', 'nomal')
                }}
                accessibilityRole="button"
                accessibilityLabel={t('plaza.index.identityFindDemander')}
              >
                <Text style={styles.identityBtnTextOutline}>
                  {t('plaza.index.identityFindDemander')}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.identityBtn, styles.identityBtnOutline, styles.identityBtnPrimary]}
                onPress={() => {
                  setIdentityVisible(false)
                  // 对齐原项目 toDev:先写身份 userStatus='developer' 再跳开发者页
                  void AsyncStorage.setItem('userStatus', 'developer').then(() => {
                    navigation.navigate('Developer', { id: 'self' })
                  })
                }}
                accessibilityRole="button"
                accessibilityLabel={t('plaza.index.identityImDev')}
              >
                <Text style={styles.identityBtnTextPrimary}>{t('plaza.index.identityImDev')}</Text>
              </Pressable>
            </View>
            <Pressable
              style={styles.identityFooter}
              onPress={() => {
                setIdentityVisible(false)
                setNoticeVisible(true)
              }}
              accessibilityRole="button"
              accessibilityLabel={t('plaza.index.devNoticeTitle')}
            >
              <Text style={styles.identityFooterTitle}>{t('plaza.index.devNoticeTitle')}</Text>
              <Text style={styles.identityFooterText}>{t('plaza.index.footerDesc')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
      {/* 开发者须知弹窗(对齐原项目 plaza/index.vue L110-150,5 条规则文案逐字) */}
      <Modal
        visible={noticeVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setNoticeVisible(false)}
      >
        <Pressable
          style={styles.categoryMask}
          onPress={() => setNoticeVisible(false)}
          accessibilityLabel={t('plaza.index.closeDevNotice')}
        >
          <Pressable style={styles.identityCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.identityTitle}>{t('plaza.index.devNoticeTitle')}</Text>
            <View style={styles.noticeList}>
              <Text style={styles.noticeItem}>
                <Text style={styles.noticeBold}>{t('plaza.index.n1t')}</Text>
                {t('plaza.index.n1b')}
              </Text>
              <Text style={styles.noticeItem}>
                <Text style={styles.noticeBold}>{t('plaza.index.n2t')}</Text>
                {t('plaza.index.n2b')}
              </Text>
              <Text style={styles.noticeItem}>
                <Text style={styles.noticeBold}>{t('plaza.index.n3t')}</Text>
                {t('plaza.index.n3b')}
              </Text>
              <Text style={styles.noticeItem}>
                <Text style={styles.noticeBold}>{t('plaza.index.n4t')}</Text>
                {t('plaza.index.n4b')}
              </Text>
              <Text style={styles.noticeItem}>
                <Text style={styles.noticeBold}>{t('plaza.index.n5t')}</Text>
                {t('plaza.index.n5b')}
              </Text>
            </View>
            <Pressable
              style={[styles.identityBtn, styles.identityBtnOutline, styles.identityBtnPrimary]}
              onPress={() => setNoticeVisible(false)}
              accessibilityRole="button"
              accessibilityLabel={t('common.gotIt')}
            >
              <Text style={styles.identityBtnTextPrimary}>{t('common.gotIt')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
      {/* 底部导航(对齐原 customTabBar 5 主 Tab) */}
      <TabBar activeTab="plaza" onChange={handleTabChange} blurTarget={tabBarBlurTargetRef} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.surface.bg,
  } as ViewStyle,
  navIcon: {
    fontSize: rnType.heading.size,
    color: tokens.gray.black,
  } as TextStyle,
  // 需求赛道筛选弹层样式(圆角守门:仅 8/12)
  categoryMask: {
    flex: 1,
    backgroundColor: rnCssLight.black50,
    alignItems: 'center',
    justifyContent: 'center',
    padding: rpx(48),
  } as ViewStyle,
  // ── 身份切换弹窗(对齐原项目 plaza identity-card) ──
  identityCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: tokens.surface.card,
    borderRadius: rnRadiusFor.panel,
    padding: rpx(48),
    alignItems: 'center',
  } as ViewStyle,
  identityTitle: {
    fontSize: rnType.subtitle.size,
    fontWeight: '700',
    color: tokens.gray[900],
    marginBottom: rpx(12),
  },
  // ── 身份用户区(对齐原项目 plaza identity-user:头像 + 昵称 + 副文案) ──
  identityUser: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: rpx(24),
    marginBottom: rpx(36),
  } as ViewStyle,
  identityAvatar: {
    width: 56,
    height: 56,
    borderRadius: rnRadius['2xl'],
    backgroundColor: tokens.surface.muted,
    overflow: 'hidden',
  } as ImageStyle,
  identityAvatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  identityAvatarFallbackText: {
    fontSize: 28,
  } as TextStyle,
  identityUserInfo: {
    flex: 1,
  } as ViewStyle,
  identityNickname: {
    fontSize: rnType.title.size,
    fontWeight: '600',
    color: tokens.gray[900],
    marginBottom: rpx(8),
  } as TextStyle,
  identitySubtext: { fontSize: 13, color: tokens.text.tertiary },
  identityButtons: { flexDirection: 'row', gap: rpx(24), width: '100%' },
  identityBtn: {
    flex: 1,
    height: 44,
    borderRadius: rnRadius.sm, // control 档 sm(4)(RADIUS_ROLES:control→sm)
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  identityBtnOutline: { borderColor: tokens.border.light, backgroundColor: tokens.surface.card },
  identityBtnPrimary: {
    borderColor: tokens.brandAccent.deep,
    backgroundColor: tokens.brandAccent.DEFAULT,
  },
  identityBtnTextOutline: {
    fontSize: rnType.strong.size,
    color: tokens.gray[900],
    fontWeight: '600',
  },
  identityBtnTextPrimary: {
    fontSize: rnType.strong.size,
    color: tokens.brandAccent.foreground,
    fontWeight: '600',
  },
  identityFooter: { marginTop: rpx(36), alignItems: 'center' },
  identityFooterTitle: {
    fontSize: rnType.body.size,
    color: tokens.brandAccent.deep,
    fontWeight: '600',
    marginBottom: rpx(4),
  },
  identityFooterText: { fontSize: rnType.label.size, color: tokens.text.tertiary },
  noticeList: { width: '100%', marginTop: rpx(24), gap: rpx(24) },
  noticeItem: { fontSize: 13, color: tokens.text.medium, lineHeight: 20 },
  noticeBold: { fontWeight: '700', color: tokens.gray[900] },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
