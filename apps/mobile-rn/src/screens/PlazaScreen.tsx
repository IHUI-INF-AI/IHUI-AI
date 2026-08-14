/**
 * PlazaScreen AI需求广场页(mobile-rn 端)
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
  FlatList,
  Image,
  Pressable,
  RefreshControl,
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
import { Search, X } from 'lucide-react-native'
import {
  deleteConversation,
  getPlazaList,
  listConversations,
  type ConversationDetail,
  type PlazaItem,
} from '@ihui/api-client'
import { rnLightTokens as tk } from '@ihui/design-tokens'
import { formatRelativeTime } from '@ihui/shared'
import Drawer, {
  type DrawerConversationItem,
  type DrawerExtraMenu,
  type DrawerTab,
} from '../components/Drawer'
import { FloatBox, type FloatBoxType } from '../components/FloatBox'
import { NavBar, type NavBarAction } from '../components/NavBar'
import Default from '../components/common/Default'
import Loading from '../components/common/Loading'
import { SearchInput } from '../components/SearchInput'
import { SingleTypeBar } from '../components/SingleTypeBar'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>
type RootNav = NativeStackNavigationProp<RootStackParamList>

const PAGE_SIZE = 10

/** 状态切换(对齐 plaza components/status.vue:待接单 2 / 开发中 4 / 已完成 6 / 我的任务 9) */
interface StatusChip {
  label: string
  /** 传给后端的 status 值;"我的任务"用 '9' 标记,请求时转为空 + creator */
  value: string
}

const STATUS_CHIPS: readonly StatusChip[] = [
  { label: '待接单', value: '2' },
  { label: '开发中', value: '4' },
  { label: '已完成', value: '6' },
  { label: '我的任务', value: '9' },
] as const

/** 周期单位映射(对齐 card_content.vue cycleUnits:0日/1周/2月/3年) */
const CYCLE_UNITS: Readonly<Record<string, string>> = {
  '0': '日',
  '1': '周',
  '2': '月',
  '3': '年',
}

const PLACEHOLDER_AVATAR = '🧑‍💻'
const AVATAR_SIZE = 30
/** 卡片圆角(对齐 plaza .scroll_item border-radius:20rpx≈10dp) */
const CARD_RADIUS = 10
/** 悬浮发布按钮尺寸(对齐 plaza floating-publish-btn:100rpx≈50dp,圆角 15rpx≈8dp) */
const FAB_SIZE = 50
const FAB_RADIUS = 8
const BACK_HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 } as const

/** Drawer 领取免费资料链接(对齐 Uniapp lingqu 方法) */
const FREE_RESOURCE_URL =
  'https://aizhihuishe.feishu.cn/wiki/GPs7wff9PiDekQkKvBncryrmnIh?from=from_copylink'

interface FloatBoxState {
  visible: boolean
  type: FloatBoxType
  message: string
}

const FLOAT_BOX_DEFAULT: FloatBoxState = { visible: false, type: 'info', message: '' }

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
const DRAWER_TAB_TO_RN_TAB: Record<DrawerTab, 'home' | 'ai' | 'mine'> = {
  home: 'home',
  ai: 'ai',
  square: 'home',
  share: 'home',
  mine: 'mine',
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

/** 安全读取 PlazaItem 扩展字段(PlazaItem 有 [key: string]: unknown 索引签名) */
function getField(item: PlazaItem, key: string): string | undefined {
  const v = item[key]
  if (typeof v === 'string') return v
  if (typeof v === 'number') return String(v)
  return undefined
}

function avatarText(name: string): string {
  const trimmed = name.trim()
  return trimmed ? trimmed.slice(0, 1).toUpperCase() : PLACEHOLDER_AVATAR
}

/** 格式化价格(对齐 card_content.vue formatPrice:>=10000 万,>=1000 K) */
function formatPrice(price: string | number | undefined): string {
  const n = Number(price)
  if (!Number.isFinite(n)) return '0'
  if (n >= 10000) return `${(n / 10000).toFixed(0)}万`
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`
  return String(n)
}

/** 格式化日期:YYYY-MM-DD → YYYY.MM.DD(对齐 card_content.vue formatDate) */
function formatDate(dateStr: string | undefined): string {
  if (!dateStr || dateStr === '-') return '-'
  const date = dateStr.split(' ')[0] ?? dateStr
  return date.replace(/-/g, '.')
}

/** 格式化日期范围(对齐 card_content.vue formatDateRange:start——end) */
function formatDateRange(start: string | undefined, end: string | undefined): string {
  return `${formatDate(start)}——${formatDate(end)}`
}

export function PlazaScreen() {
  const { t } = useI18n()
  const { user } = useAuth()
  const navigation = useNavigation<NavigationProp>()
  const rootNav = navigation.getParent<RootNav>()

  const [items, setItems] = useState<PlazaItem[]>([])
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
  const [floatBox, setFloatBox] = useState<FloatBoxState>(FLOAT_BOX_DEFAULT)

  // Drawer 侧滑抽屉(对齐 plaza DrawerComponent,菜单按钮控制 tagWrapShow)
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
        // "我的任务"(value=9):status 置空,creator 传当前用户 id(对齐 plaza statusChange val==9 逻辑)
        const isMyTask = status === '9'
        const res = await getPlazaList({
          page: targetPage,
          pageSize: PAGE_SIZE,
          status: isMyTask ? undefined : status || undefined,
          search: search.trim() || undefined,
          creator: isMyTask ? user?.id : undefined,
        })
        if (!res.success) throw new Error(res.error)
        const list = res.data.list ?? []
        setItems((prev) => (reset ? list : [...prev, ...list]))
        setTotal(res.data.total ?? 0)
        setPage(targetPage)
      } catch {
        setError('加载失败,请下拉刷新重试')
        if (reset) showFloat('加载失败,请下拉刷新重试')
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

  const showDetail = (item: PlazaItem) => {
    navigation.navigate('PostDetail', { id: String(item.id) })
  }

  // ── Drawer 回调(对齐 plaza DrawerComponentall + ProfileScreen 模式) ──
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
    rootNav?.navigate('Tabs', { screen: DRAWER_TAB_TO_RN_TAB[tab] })
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
    rootNav?.navigate('Tabs', { screen: 'ai' })
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
    rootNav?.navigate('Tabs', { screen: 'home' })
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

  const initialLoading = loading && items.length === 0 && !refreshing

  const renderCard = ({ item }: { item: PlazaItem }) => {
    // 对齐 card_content.vue:createdName / avatar / context / cycle / cycleUnit / lowestPrice / peakPrice / closingTime / status
    const author = getField(item, 'createdName') || item.creator || '匿名'
    const avatar = getField(item, 'avatar')
    const desc = getField(item, 'context') || item.description || ''
    const createdAt = getField(item, 'createdAt') || item.createdAt || ''
    const closingTime = getField(item, 'closingTime')
    const cycle = getField(item, 'cycle')
    const cycleUnit = getField(item, 'cycleUnit')
    const lowestPrice = getField(item, 'lowestPrice')
    const peakPrice = getField(item, 'peakPrice')
    const itemStatus = getField(item, 'status') || item.status || ''
    const time = createdAt ? formatRelativeTime(createdAt) : ''

    return (
      <Pressable
        style={({ pressed }) => [styles.card, pressed ? styles.cardPressed : null]}
        onPress={() => showDetail(item)}
        accessibilityRole="button"
        accessibilityLabel={item.title}
      >
        <Text style={styles.cardTitle} numberOfLines={2}>
          {item.title}
        </Text>
        {desc ? (
          <Text style={styles.cardDesc} numberOfLines={3}>
            {desc}
          </Text>
        ) : null}
        {/* 日期范围(对齐 card_content formatDateRange) */}
        <Text style={styles.cardDate} allowFontScaling={false}>
          {formatDateRange(createdAt, closingTime)}
        </Text>
        {/* 周期(对齐 card_content cycle) */}
        {cycle ? (
          <Text style={styles.cardCycle} allowFontScaling={false}>
            {`周期时间:${cycle}${CYCLE_UNITS[cycleUnit ?? ''] ?? ''}`}
          </Text>
        ) : null}
        <View style={styles.cardMeta}>
          <View style={styles.avatarWrap}>
            {avatar ? (
              <Image source={{ uri: avatar }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarText}>{avatarText(author)}</Text>
              </View>
            )}
          </View>
          <Text style={styles.author} numberOfLines={1}>
            {author}
          </Text>
          {time ? <Text style={styles.time}>{time}</Text> : null}
        </View>
        {/* 价格 + 状态(对齐 card_content has_img1:money + status) */}
        <View style={styles.cardFooter}>
          <Text
            style={[styles.price, itemStatus === '6' ? styles.priceDone : null]}
            allowFontScaling={false}
          >
            <Text style={styles.priceUnit}>￥</Text>
            {`${formatPrice(lowestPrice)}-${formatPrice(peakPrice)}`}
          </Text>
          {itemStatus === '2' ? (
            <View style={styles.chatBtn}>
              <Text style={styles.chatBtnText} allowFontScaling={false}>
                聊一聊
              </Text>
            </View>
          ) : itemStatus === '6' ? (
            <Text style={styles.statusDone} allowFontScaling={false}>
              项目已完成
            </Text>
          ) : itemStatus === '4' ? (
            <Text style={styles.statusDev} allowFontScaling={false}>
              开发中...
            </Text>
          ) : null}
        </View>
      </Pressable>
    )
  }

  return (
    <View style={styles.container}>
      <NavBar
        title="AI需求广场"
        leftActions={leftActions}
        onBack={() => navigation.goBack()}
        rightAction={
          <Pressable
            hitSlop={BACK_HIT_SLOP}
            onPress={() => setShowSearch((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel="搜索"
          >
            {showSearch ? <X size={20} color={tk.text.primary} /> : <Search size={20} color={tk.text.primary} />}
          </Pressable>
        }
      />
      {showSearch ? (
        <View style={styles.searchBar}>
          <SearchInput
            value={searchInput}
            onChangeText={setSearchInput}
            placeholder="搜索需求"
            onSubmit={onSubmitSearch}
          />
        </View>
      ) : null}
      <View style={styles.chipsBar}>
        <SingleTypeBar
          items={STATUS_CHIPS.map((chip) => ({ id: chip.value, label: chip.label }))}
          selectedId={status}
          onSelect={(id) => setStatus(id)}
        />
      </View>
      {initialLoading ? (
        <View style={styles.centerWrap}>
          <Loading text="加载中..." />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderCard}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tk.text.secondary} />}
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
              // 对齐 plaza empty:当前赛道/千万级空白市场/不会开发?发布需求/快来抢占市场!
              <View style={styles.emptyWrap}>
                <Default text="当前赛道千万级空白市场,快来抢占市场!" icon="🌐" />
                <Pressable style={styles.emptyBtn} onPress={onPublish}>
                  <Text style={styles.emptyBtnText}>发布需求</Text>
                </Pressable>
              </View>
            )
          }
          ListFooterComponent={loadingMore ? <Loading text="加载更多..." /> : null}
        />
      )}
      {/* 悬浮发布按钮(对齐 plaza floating-publish-btn:居中,100rpx×100rpx≈50dp,圆角 15rpx≈8dp) */}
      <Pressable
        style={({ pressed }) => [styles.fab, pressed ? styles.fabPressed : null]}
        onPress={onPublish}
        accessibilityRole="button"
        accessibilityLabel="发布需求"
      >
        <Text style={styles.fabIcon}>＋</Text>
      </Pressable>
      {/* FloatBox 悬浮提示 */}
      <FloatBox
        visible={floatBox.visible}
        type={floatBox.type}
        message={floatBox.message}
        onHide={hideFloat}
      />
      {/* Drawer 侧滑抽屉(对齐 plaza DrawerComponentall) */}
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
  chipsBar: {
    paddingVertical: 4,
    backgroundColor: tk.surface.card,
  } as ViewStyle,
  listContent: {
    paddingHorizontal: 10,
    paddingBottom: 96,
  } as ViewStyle,
  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: 10,
  } as ViewStyle,
  // 卡片(对齐 plaza .scroll_item:width calc(50vw-28rpx),border-radius 20rpx≈10dp)
  card: {
    width: '48%',
    backgroundColor: tk.surface.card,
    borderRadius: CARD_RADIUS,
    padding: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: tk.border.light,
  } as ViewStyle,
  cardPressed: {
    backgroundColor: tk.surface.muted,
  } as ViewStyle,
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: tk.text.primary,
    lineHeight: 19,
  } as TextStyle,
  cardDesc: {
    fontSize: 12,
    color: tk.text.secondary,
    lineHeight: 17,
  } as TextStyle,
  cardDate: {
    fontSize: 11,
    color: tk.text.tertiary,
    lineHeight: 15,
  } as TextStyle,
  cardCycle: {
    fontSize: 11,
    color: tk.text.tertiary,
    lineHeight: 15,
  } as TextStyle,
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  } as ViewStyle,
  avatarWrap: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
  } as ViewStyle,
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: 4,
  } as ImageStyle,
  avatarFallback: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: 4,
    backgroundColor: tk.purple.light,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  avatarText: {
    fontSize: 13,
    fontWeight: '600',
    color: tk.purple.DEFAULT,
  } as TextStyle,
  author: {
    flex: 1,
    fontSize: 11,
    color: tk.text.medium,
  } as TextStyle,
  time: {
    fontSize: 11,
    color: tk.text.tertiary,
  } as TextStyle,
  // 价格 + 状态(对齐 card_content has_img1)
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tk.border.light,
  } as ViewStyle,
  price: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FF0000',
  } as TextStyle,
  priceUnit: {
    fontSize: 10,
    fontWeight: '600',
  } as TextStyle,
  priceDone: {
    color: '#8D8D8D',
  } as TextStyle,
  chatBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e4ec',
    backgroundColor: '#fff',
  } as ViewStyle,
  chatBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#000',
  } as TextStyle,
  statusDone: {
    fontSize: 10,
    color: '#8D8D8D',
  } as TextStyle,
  statusDev: {
    fontSize: 10,
    color: '#B0A0FF',
  } as TextStyle,
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  } as ViewStyle,
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 16,
  } as ViewStyle,
  emptyBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: tk.brand.DEFAULT,
  } as ViewStyle,
  emptyBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: tk.surface.light,
  } as TextStyle,
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
  // 悬浮发布按钮(对齐 plaza floating-publish-btn:居中,100rpx≈50dp,圆角 15rpx≈8dp)
  fab: {
    position: 'absolute',
    left: '50%',
    marginLeft: -FAB_SIZE / 2,
    bottom: 24,
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_RADIUS,
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: tk.gray[900],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  } as ViewStyle,
  fabPressed: {
    transform: [{ scale: 0.95 }],
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
  } as ViewStyle,
  fabIcon: {
    fontSize: 28,
    color: tk.text.primary,
    fontWeight: '600',
    includeFontPadding: false,
  } as TextStyle,
})

export default PlazaScreen
