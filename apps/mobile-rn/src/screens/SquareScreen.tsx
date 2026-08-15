/**
 * SquareScreen AI资讯页(mobile-rn 端)
 *
 * 对齐历史项目 pages/table/share/index.vue(AI资讯 / 动态广场):
 * - 顶部 NavBar(标题「AI资讯」+ 菜单按钮打开 Drawer,对齐 navigation-bars showMenu)
 * - 分类筛选 SingleTypeBar(对齐 share title-switch 赛道分类弹层 informationList)
 * - 资讯/文章卡片流(分类 / 标题 / 摘要 / 作者 / 相对时间 / 阅读量,对齐 information-item 时间轴条目)
 * - 数据加载走 fetchApi(@ihui/api-client),拉取 /api/knowledge 文章流
 * - 下拉刷新 / 错误态 / 空态(common/Empty);浅色优雅风;圆角守门;无分割线
 * - 返回顶部按钮(对齐 share toodown,滚动超过 200rpx≈100dp 显示)
 * - FloatBox 悬浮提示(对齐 share float-box)
 * - Drawer 侧滑抽屉(对齐 share DrawerComponent,菜单按钮控制 drawerVisible)
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
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
import { getRnTokens, type RnThemeTokens } from '@ihui/design-tokens'
import { formatRelativeTime } from '@ihui/shared'
import Empty from '../components/common/Empty'
import Loading from '../components/common/Loading'
import Drawer, {
  type DrawerConversationItem,
  type DrawerExtraMenu,
  type DrawerTab,
} from '../components/Drawer'
import { FloatBox, type FloatBoxType } from '../components/FloatBox'
import { NavBar, type NavBarAction } from '../components/NavBar'
import { SingleTypeBar } from '../components/SingleTypeBar'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { mainScreenForTab, type MainTabKey } from '../navigation/RootNavigator'

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

interface CategoryItem {
  id: string
  label: string
  /** 传给后端的分类 code(对齐 Uniapp informationList item.code) */
  code: string
}

const FLOAT_BOX_DEFAULT: FloatBoxState = { visible: false, type: 'info', message: '' }

const PAGE_SIZE = 20
const DEFAULT_AUTHOR = 'AI 智汇社'

/** 分类筛选条(对齐 Uniapp share/informationList 赛道分类;"全部"对应 ARTF_INTG 默认) */
const CATEGORIES: readonly CategoryItem[] = [
  { id: 'all', label: '全部', code: 'ARTF_INTG' },
  { id: 'ai', label: '人工智能', code: 'AI' },
  { id: 'ml', label: '机器学习', code: 'ML' },
  { id: 'cv', label: '计算机视觉', code: 'CV' },
  { id: 'nlp', label: '自然语言', code: 'NLP' },
  { id: 'chip', label: 'AI芯片', code: 'CHIP' },
  { id: 'rec', label: '智能推荐', code: 'REC' },
] as const

/** 返回顶部按钮显示阈值(对齐 share handleToodownVisibility: scrollTop > 200,200rpx≈100dp) */
const BACK_TO_TOP_THRESHOLD = 100

/** Drawer 领取免费资料链接(对齐 Uniapp lingqu 方法) */
const FREE_RESOURCE_URL =
  'https://aizhihuishe.feishu.cn/wiki/GPs7wff9PiDekQkKvBncryrmnIh?from=from_copylink'

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

export function SquareScreen() {
  const { t, locale } = useI18n()
  const { user } = useAuth()
  const navigation = useNavigation<NavigationProp>()
  const rootNav = navigation.getParent<RootNav>()
  const tk = getRnTokens('light')
  const styles = useMemo(() => createStyles(tk), [tk])

  const [items, setItems] = useState<Knowledge[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [floatBox, setFloatBox] = useState<FloatBoxState>(FLOAT_BOX_DEFAULT)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [showBackTop, setShowBackTop] = useState(false)

  // Drawer 侧滑抽屉(对齐 share DrawerComponent,菜单按钮控制)
  const [drawerVisible, setDrawerVisible] = useState(false)
  const [drawerConversations, setDrawerConversations] = useState<DrawerConversationItem[]>([])
  const [drawerConversationsLoaded, setDrawerConversationsLoaded] = useState(false)

  const listRef = useRef<FlatList<Knowledge>>(null)

  const showFloat = useCallback((message: string, type: FloatBoxType = 'error') => {
    setFloatBox({ visible: true, type, message })
  }, [])

  const hideFloat = useCallback(() => {
    setFloatBox((prev) => ({ ...prev, visible: false }))
  }, [])

  const currentCode = useMemo(
    () => CATEGORIES.find((c) => c.id === selectedCategory)?.code ?? 'ARTF_INTG',
    [selectedCategory],
  )

  const load = useCallback(async () => {
    setError('')
    try {
      const url =
        currentCode === 'ARTF_INTG'
          ? `/api/knowledge?page=1&pageSize=${PAGE_SIZE}`
          : `/api/knowledge?page=1&pageSize=${PAGE_SIZE}&category=${encodeURIComponent(currentCode)}`
      const res = await fetchApi<KnowledgePage>(url)
      if (!res.success) throw new Error(res.error)
      setItems(res.data?.list ?? [])
    } catch {
      const message = t('common.loadFailed')
      setError(message)
      if (items.length > 0) showFloat(message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [t, items.length, showFloat, currentCode])

  useEffect(() => {
    void load()
  }, [load])

  const onRefresh = () => {
    setRefreshing(true)
    void load()
  }

  const onItemClick = (id: string) => navigation.navigate('ArticleDetail', { id })

  // ── Drawer 回调(对齐 share DrawerComponentall + ProfileScreen 模式) ──
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
    try {
      Clipboard.setString(FREE_RESOURCE_URL)
      showFloat('链接已复制', 'success')
    } catch {
      showFloat('复制失败,请重试', 'warning')
    }
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

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y
      // 对齐 share handleToodownVisibility: scrollTop > 200 (200rpx≈100dp)
      setShowBackTop(y > BACK_TO_TOP_THRESHOLD)
    },
    [],
  )

  const backToTop = () => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true })
  }

  const renderItem = ({ item }: { item: Knowledge }) => {
    const author = item.authorName || DEFAULT_AUTHOR
    const time = formatRelativeTime(item.createdAt, locale)
    const views = item.viewCount ?? 0
    // 对齐 information-item 的 sourceName:无来源时显示"来源:网络"
    const source = (item as Knowledge & { sourceName?: string }).sourceName
    const sourceText = source && source !== 'Not_Support' ? `来源:${source}` : '来源:网络'
    return (
      <Pressable
        style={({ pressed }) => [styles.card, pressed ? styles.cardPressed : null]}
        onPress={() => onItemClick(item.id)}
        accessibilityRole="button"
        accessibilityLabel={item.title}
      >
        <View style={styles.content}>
          {item.category ? (
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText} numberOfLines={1} allowFontScaling={false}>
                {item.category}
              </Text>
            </View>
          ) : null}
          <Text style={styles.title} numberOfLines={2}>
            {item.title}
          </Text>
          {item.summary ? (
            <Text style={styles.summary} numberOfLines={2}>
              {item.summary}
            </Text>
          ) : null}
          <View style={styles.metaRow}>
            <View style={styles.authorBadge}>
              <Text style={styles.authorText} numberOfLines={1} allowFontScaling={false}>
                {author}
              </Text>
            </View>
            <Text style={styles.metaText} allowFontScaling={false}>
              {time}
            </Text>
            <Text style={styles.metaText} allowFontScaling={false}>
              {`${views} 阅读`}
            </Text>
          </View>
          <Text style={styles.sourceText} allowFontScaling={false}>
            {sourceText}
          </Text>
        </View>
      </Pressable>
    )
  }

  return (
    <View style={styles.container}>
      <NavBar title="AI资讯" leftActions={leftActions} onBack={() => navigation.goBack()} />
      <View style={styles.categoryBar}>
        <SingleTypeBar
          items={CATEGORIES.map((c) => ({ id: c.id, label: c.label }))}
          selectedId={selectedCategory}
          onSelect={(id) => {
            setSelectedCategory(id)
            setLoading(true)
          }}
        />
      </View>
      {loading ? (
        <View style={styles.centerWrap}>
          <Loading text="加载中..." />
        </View>
      ) : error && items.length === 0 ? (
        <View style={styles.centerWrap}>
          <Empty text={error} actionText={t('common.retry')} onAction={() => void load()} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.itemGap} />}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tk.text.secondary} />
          }
          ListEmptyComponent={<Empty />}
          onScroll={onScroll}
          scrollEventThrottle={16}
        />
      )}
      {/* 返回顶部按钮(对齐 share toodown:68rpx×68rpx≈34dp,圆角 8rpx≈4dp) */}
      {showBackTop ? (
        <Pressable
          style={styles.backToTop}
          onPress={backToTop}
          accessibilityRole="button"
          accessibilityLabel="返回顶部"
        >
          <Text style={styles.backToTopIcon}>{'↑'}</Text>
        </Pressable>
      ) : null}
      {/* FloatBox 悬浮提示(对齐 share float-box) */}
      <FloatBox
        visible={floatBox.visible}
        type={floatBox.type}
        message={floatBox.message}
        onHide={hideFloat}
      />
      {/* Drawer 侧滑抽屉(对齐 share DrawerComponentall) */}
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

function createStyles(tk: RnThemeTokens) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: tk.surface.bg,
    } as ViewStyle,
    categoryBar: {
      paddingVertical: 4,
      backgroundColor: tk.surface.card,
    } as ViewStyle,
    centerWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    } as ViewStyle,
    listContent: {
      padding: 8,
    } as ViewStyle,
    itemGap: {
      height: 8,
    } as ViewStyle,

    // 卡片
    card: {
      borderRadius: 12,
      padding: 8,
      backgroundColor: tk.surface.light,
    } as ViewStyle,
    cardPressed: {
      backgroundColor: tk.surface.muted,
    } as ViewStyle,
    content: {
      gap: 6,
    } as ViewStyle,
    categoryBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      backgroundColor: tk.indigo.light,
    } as ViewStyle,
    categoryText: {
      fontSize: 11,
      lineHeight: 14,
      color: tk.indigo.DEFAULT,
      fontWeight: '600',
    } as TextStyle,
    title: {
      fontSize: 15,
      lineHeight: 21,
      fontWeight: '600',
      color: tk.text.primary,
    } as TextStyle,
    summary: {
      fontSize: 13,
      lineHeight: 19,
      color: tk.text.secondary,
    } as TextStyle,
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 4,
    } as ViewStyle,
    authorBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      backgroundColor: tk.purple.light,
    } as ViewStyle,
    authorText: {
      fontSize: 11,
      lineHeight: 14,
      color: tk.purple.DEFAULT,
      fontWeight: '600',
    } as TextStyle,
    metaText: {
      fontSize: 11,
      lineHeight: 14,
      color: tk.text.tertiary,
    } as TextStyle,
    sourceText: {
      fontSize: 11,
      lineHeight: 14,
      color: tk.text.tertiary,
      marginTop: 2,
    } as TextStyle,

    // 返回顶部按钮(对齐 share toodown:68rpx≈34dp,圆角 8rpx≈4dp)
    backToTop: {
      position: 'absolute',
      left: '50%',
      marginLeft: -17,
      bottom: 44,
      width: 34,
      height: 34,
      borderRadius: 4,
      backgroundColor: 'rgba(147, 210, 243, 0.9)',
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 2,
      shadowColor: tk.gray[900],
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.15,
      shadowRadius: 2,
    } as ViewStyle,
    backToTopIcon: {
      fontSize: 20,
      color: tk.text.primary,
      fontWeight: '600',
      includeFontPadding: false,
    } as TextStyle,
  })
}

export default SquareScreen
