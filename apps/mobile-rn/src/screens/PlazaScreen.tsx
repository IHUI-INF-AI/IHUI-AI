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
import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { PlazaScreen as SharedPlazaScreen, type PlazaScreenProps } from '@ihui/rn-app'
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import Drawer, {
  type DrawerConversationItem,
  type DrawerExtraMenu,
  type DrawerTab,
} from '../components/Drawer'
import { FloatBox, type FloatBoxType } from '../components/FloatBox'
import { NavBar, type NavBarAction } from '../components/NavBar'
// 底部导航(对齐原 customTabBar 5 主 Tab,PlazaScreen 对应「广场」Tab)
import TabBar, { type TabBarKey } from '../components/TabBar'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { DRAWER_TAB_TO_RN_TAB, mainScreenForTab } from '../navigation/tab-utils'
import { rpx } from '../utils/rpx'
import { Search, User, Menu, FolderOpen, X } from 'lucide-react-native'

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
  const [trackCategories, setTrackCategories] =
    useState<ReadonlyArray<AgentCategoryItem>>(PLAZA_CATEGORY_FALLBACK)
  const [selectedCategory, setSelectedCategory] = useState('')
  const [categoryVisible, setCategoryVisible] = useState(false)
  // 身份切换弹窗(对齐原项目 plaza/index.vue L78-108:切换身份 Modal)
  const [identityVisible, setIdentityVisible] = useState(false)
  // 开发者须知弹窗(对齐原项目 L110-150:开发者须知 Modal,5 条规则)
  const [noticeVisible, setNoticeVisible] = useState(false)

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
    // 真复制资料链接后再提示(对齐原项目 lingqu → setClipboardData)
    Clipboard.setString(FREE_RESOURCE_URL)
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
    nickname: user?.nickname ?? user?.username ?? '未登录',
    level: ((user as { isVip?: boolean } | null)?.isVip ? 'vip' : 'normal') as 'vip' | 'normal',
  }

  const leftActions = useMemo<ReadonlyArray<NavBarAction>>(
    () => [{ icon: Menu, label: '菜单', onPress: () => setDrawerVisible(true) }],
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
            icon: FolderOpen,
            label: '分类',
            // 对齐原项目 navigation-bars showFenLei → 赛道筛选弹层(ScrollTitle + Tab)
            onPress: () => setCategoryVisible(true),
          },
          {
            icon: User,
            label: '身份',
            // 对齐原项目 plaza/index.vue setshowBottom → 切换身份弹窗
            onPress: () => setIdentityVisible(true),
          },
        ]}
        rightAction={
          <Pressable
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            onPress={() => setShowSearch((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel="搜索"
          >
            {showSearch ? (
              <X size={20} color={tokens.gray.black} />
            ) : (
              <Search size={20} color={tokens.gray.black} />
            )}
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
          accessibilityLabel="关闭身份切换"
        >
          <Pressable style={styles.identityCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.identityTitle}>切换身份</Text>
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
                  {user?.nickname || user?.username || '未登录用户'}
                </Text>
                <Text style={styles.identitySubtext}>选择合适的身份，更好地发布或承接需求</Text>
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
                accessibilityLabel="找大佬开发"
              >
                <Text style={styles.identityBtnTextOutline}>找大佬开发</Text>
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
                accessibilityLabel="我是开发者"
              >
                <Text style={styles.identityBtnTextPrimary}>我是开发者</Text>
              </Pressable>
            </View>
            <Pressable
              style={styles.identityFooter}
              onPress={() => {
                setIdentityVisible(false)
                setNoticeVisible(true)
              }}
              accessibilityRole="button"
              accessibilityLabel="开发者须知"
            >
              <Text style={styles.identityFooterTitle}>开发者须知</Text>
              <Text style={styles.identityFooterText}>
                成为开发者前，请先阅读并确认开发者须知。
              </Text>
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
          accessibilityLabel="关闭开发者须知"
        >
          <Pressable style={styles.identityCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.identityTitle}>开发者须知</Text>
            <View style={styles.noticeList}>
              <Text style={styles.noticeItem}>
                <Text style={styles.noticeBold}>1. 开发者责任 </Text>
                开发者应当确保所提供的技术服务符合相关法律法规，不得提供违法违规的技术支持。
              </Text>
              <Text style={styles.noticeItem}>
                <Text style={styles.noticeBold}>2. 知识产权 </Text>
                开发者应当尊重知识产权，不得侵犯他人的专利权、著作权、商标权等合法权益。
              </Text>
              <Text style={styles.noticeItem}>
                <Text style={styles.noticeBold}>3. 交易规范 </Text>
                开发者与需求方的交易应当遵循公平、公正、诚信的原则，确保交易过程的透明化。
              </Text>
              <Text style={styles.noticeItem}>
                <Text style={styles.noticeBold}>4. 隐私保护 </Text>
                开发者应当严格保护用户隐私，不得泄露、出售或非法使用用户个人信息。
              </Text>
              <Text style={styles.noticeItem}>
                <Text style={styles.noticeBold}>5. 技术标准 </Text>
                开发者应当提供符合行业标准的技术服务，确保技术方案的可行性和可靠性。
              </Text>
            </View>
            <Pressable
              style={[styles.identityBtn, styles.identityBtnOutline, styles.identityBtnPrimary]}
              onPress={() => setNoticeVisible(false)}
              accessibilityRole="button"
              accessibilityLabel="我知道了"
            >
              <Text style={styles.identityBtnTextPrimary}>我知道了</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
      {/* 底部导航(对齐原 customTabBar 5 主 Tab) */}
      <TabBar activeTab="plaza" onChange={handleTabChange} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.surface.light,
  } as ViewStyle,
  navIcon: {
    fontSize: 20,
    color: tokens.gray.black,
  } as TextStyle,
  // 需求赛道筛选弹层样式(圆角守门:仅 8/12)
  categoryMask: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: rpx(48),
  } as ViewStyle,
  categoryCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: tokens.surface.light,
    borderRadius: 12,
    padding: rpx(40),
  } as ViewStyle,
  // ── 身份切换弹窗(对齐原项目 plaza identity-card) ──
  identityCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: tokens.surface.light,
    borderRadius: 12,
    padding: rpx(48),
    alignItems: 'center',
  } as ViewStyle,
  identityTitle: { fontSize: 18, fontWeight: '700', color: tokens.gray[900], marginBottom: rpx(12) },
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
    borderRadius: 28,
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
    fontSize: 16,
    fontWeight: '600',
    color: tokens.gray[900],
    marginBottom: rpx(8),
  } as TextStyle,
  identitySubtext: { fontSize: 13, color: tokens.text.tertiary },
  identityButtons: { flexDirection: 'row', gap: rpx(24), width: '100%' },
  identityBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  identityBtnOutline: { borderColor: tokens.border.light, backgroundColor: tokens.surface.light },
  identityBtnPrimary: { borderColor: tokens.indigo.DEFAULT, backgroundColor: tokens.indigo.DEFAULT },
  identityBtnTextOutline: { fontSize: 15, color: tokens.gray[900], fontWeight: '600' },
  identityBtnTextPrimary: { fontSize: 15, color: tokens.surface.light, fontWeight: '600' },
  identityFooter: { marginTop: rpx(36), alignItems: 'center' },
  identityFooterTitle: { fontSize: 14, color: tokens.indigo.DEFAULT, fontWeight: '600', marginBottom: rpx(4) },
  identityFooterText: { fontSize: 12, color: tokens.text.tertiary },
  noticeList: { width: '100%', marginTop: rpx(24), gap: rpx(24) },
  noticeItem: { fontSize: 13, color: tokens.text.medium, lineHeight: 20 },
  noticeBold: { fontWeight: '700', color: tokens.gray[900] },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: tokens.gray.black,
    textAlign: 'center',
    marginBottom: rpx(28),
  } as TextStyle,
  categoryList: {
    gap: rpx(16),
  } as ViewStyle,
  categoryItem: {
    paddingVertical: rpx(20),
    paddingHorizontal: rpx(24),
    borderRadius: 8,
    backgroundColor: tokens.surface.muted,
    alignItems: 'center',
  } as ViewStyle,
  categoryItemActive: {
    backgroundColor: tokens.indigo.DEFAULT,
  } as ViewStyle,
  categoryItemText: {
    fontSize: 14,
    color: tokens.text.medium,
  } as TextStyle,
  categoryItemTextActive: {
    color: tokens.surface.light,
    fontWeight: '600',
  } as TextStyle,
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
