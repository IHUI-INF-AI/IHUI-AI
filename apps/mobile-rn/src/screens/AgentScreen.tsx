// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native'
import Clipboard from '@react-native-clipboard/clipboard'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { mainScreenForTab, type MainTabKey } from '../navigation/tab-utils'
import {
  deleteConversation,
  getAgentCategories,
  getAgentDetail,
  getAgentUseHistory,
  getAgents,
  getAiModels,
  getTokenBalance,
  listConversations,
  type Agent,
  type AgentCategoryItem,
  type AiModel,
  type ConversationDetail,
} from '@ihui/api-client'
import { AgentScreen as SharedAgentScreen, type AgentScreenItem } from '@ihui/rn-app'
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import Carousel from '../components/Carousel'
import Drawer, {
  type DrawerConversationItem,
  type DrawerExtraMenu,
  type DrawerTab,
} from '../components/Drawer'
import FloatBox, { type FloatBoxType } from '../components/FloatBox'
// 对齐 Uniapp tools/index.vue float-box:悬浮导航(赚米/客服/反馈),原页面 5 个核心 Tab 页均有,补齐 AgentScreen
import { GlobalFloatBox } from '../components/GlobalFloatBox'
// 底部导航(对齐原 customTabBar 5 主 Tab,AgentScreen 对应「AI」Tab)
import TabBar, { type TabBarKey } from '../components/TabBar'
import InputArea from '../components/InputArea'
import ModelList, { type ModelListGroup, type ModelListItem } from '../components/ModelList'
import NavBar from '../components/NavBar'
import RecentAgents, { type RecentAgentItem } from '../components/RecentAgents'
import MyAgents, { type MyAgentItem } from '../components/MyAgents'
import IntelligentAssistant from '../components/IntelligentAssistant'
import type { CarouselItem } from '@ihui/ui-native'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { rpx } from '../utils/rpx'
import { type LucideIcon, Bot, Film, FolderOpen, Menu, Palette, Search } from 'lucide-react-native'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>
type RootNav = NativeStackNavigationProp<RootStackParamList>

type ViewMode = 'shared' | 'local'

// ── 赛道分类弹层静态 fallback(对齐 Uniapp tools/index.vue 两行并列结构) ──
// API(getAgentCategories)失败时使用,避免列表为空
//   第一行:agentCategory(赛道,首项"全公司" id='')—— 对应接口参数 agentCategory
//   第二行:agentMainCategory(主分类,首项"全部" id='all')—— 对应接口参数 agentMainCategory
const AGENT_CATEGORY_FALLBACK: ReadonlyArray<AgentCategoryItem> = [
  { id: '', name: '全公司' },
  { id: 'tech', name: '技术' },
  { id: 'design', name: '设计' },
  { id: 'market', name: '市场' },
  { id: 'operation', name: '运营' },
]
const AGENT_MAIN_CATEGORY_FALLBACK: ReadonlyArray<AgentCategoryItem> = [
  { id: 'all', name: '全部' },
  { id: 'writing', name: '写作' },
  { id: 'coding', name: '编程' },
  { id: 'office', name: '办公' },
  { id: 'learning', name: '学习' },
]

/** Drawer 5 主菜单 → RN Tab 路由映射(square/share 跳独立页) */
const DRAWER_TAB_TO_RN_TAB: Record<DrawerTab, MainTabKey> = {
  home: 'HomeMain',
  ai: 'AiMain',
  square: 'HomeMain',
  share: 'HomeMain',
  mine: 'ProfileMain',
}

/** 飞书免费资料链接(对齐 Uniapp lingqu → 复制链接) */
const FREE_RESOURCE_URL =
  'https://aizhihuishe.feishu.cn/wiki/GPs7wff9PiDekQkKvBncryrmnIh?from=from_copylink'

function mapToItem(a: Agent): AgentScreenItem {
  return {
    id: a.id,
    name: a.name,
    avatar: a.avatar ?? undefined,
    description: a.description,
    isVipExclusive: a.isVipExclusive,
    useCount: a.useCount,
    rating: a.rating,
  }
}

function readNumber(v: unknown): number | null {
  return typeof v === 'number' && !Number.isNaN(v) ? v : null
}

function readModelType(v: unknown): 'image' | 'av' | 'text' {
  return v === 'image' || v === 'av' ? v : 'text'
}

function modelIcon(type: 'image' | 'av' | 'text' | string | undefined): LucideIcon {
  if (type === 'image') return Palette
  if (type === 'av') return Film
  return Bot
}

function toModelListItem(m: AiModel): ModelListItem {
  const inputPrice = readNumber(m.inputPrice) ?? 0
  const outputPrice = readNumber(m.outputPrice) ?? 0
  return {
    id: m.id,
    name: m.name,
    description: m.description ?? '',
    icon: modelIcon(readModelType(m.type)),
    isFree: inputPrice === 0 && outputPrice === 0,
  }
}

function buildModelGroups(models: AiModel[]): ModelListGroup[] {
  const map = new Map<string, ModelListItem[]>()
  for (const m of models) {
    const provider = m.provider || '其他'
    const list = map.get(provider) ?? []
    list.push(toModelListItem(m))
    map.set(provider, list)
  }
  const groups: ModelListGroup[] = []
  for (const [vendor, list] of map) {
    groups.push({ vendor, models: list })
  }
  return groups
}

export function AgentScreen() {
  const { t } = useI18n()
  const { token, user } = useAuth()
  const navigation = useNavigation<NavigationProp>()
  const rootNav = navigation.getParent<RootNav>()
  const [viewMode, setViewMode] = useState<ViewMode>('shared')
  const [items, setItems] = useState<AgentScreenItem[]>([])
  // 完整智能体列表(与 items 同源,保留 model 等映射时丢失的字段,供点击跳转带模型参数)
  const [agents, setAgents] = useState<Agent[]>([])
  const [aiModels, setAiModels] = useState<AiModel[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([])
  const [banners, setBanners] = useState<CarouselItem[]>([])
  const [recentAgents, setRecentAgents] = useState<RecentAgentItem[]>([])
  // 我的AI APP(对齐 Uniapp tools/index MyAgents.vue):与 items 同源取前 6 条
  const [myAgents, setMyAgents] = useState<MyAgentItem[]>([])
  // 智汇值卡(对齐 Uniapp Intelligent-assistant.vue):getTokenBalance 返回余额,失败保持 0
  const [tokenQuantity, setTokenQuantity] = useState(0)
  // 搜索关键词 + 搜索框显隐(对齐 Uniapp showSearchBox:默认隐藏,点击导航搜索按钮展开)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [showSearchBox, setShowSearchBox] = useState(false)
  // 返回顶部按钮(对齐 Uniapp toodown-wrapper)
  const [showBackToTop, setShowBackToTop] = useState(false)
  const contentScrollRef = useRef<ScrollView>(null)
  // FloatBox toast 提示
  const [toast, setToast] = useState<{ visible: boolean; type: FloatBoxType; message: string }>({
    visible: false,
    type: 'info',
    message: '',
  })
  const showToast = useCallback((message: string, type: FloatBoxType = 'info'): void => {
    setToast({ visible: true, type, message })
  }, [])
  // Drawer 侧滑抽屉
  const [drawerVisible, setDrawerVisible] = useState(false)
  const [drawerConversations, setDrawerConversations] = useState<DrawerConversationItem[]>([])
  const [drawerConversationsLoaded, setDrawerConversationsLoaded] = useState(false)
  // 赛道分类弹层(对齐 Uniapp s_t_b 两行并列)
  const [tagWrapVisible, setTagWrapVisible] = useState(false)
  const [activeCategory, setActiveCategory] = useState<string>('')
  const [activeMain, setActiveMain] = useState<string>('all')
  // 分类字典:初始用静态 fallback,API 成功后覆盖
  const [agentCategoryList, setAgentCategoryList] =
    useState<ReadonlyArray<AgentCategoryItem>>(AGENT_CATEGORY_FALLBACK)
  const [agentMainCategoryList, setAgentMainCategoryList] = useState<
    ReadonlyArray<AgentCategoryItem>
  >(AGENT_MAIN_CATEGORY_FALLBACK)

  /** 最近使用智能体(对齐 HomeScreen loadRecentAgents:getAgentUseHistory → 并行查详情关联
   *  名称/头像;失败降级用智能体列表前 5 条) */
  const loadRecentAgents = useCallback(async (fallback: Agent[] = []): Promise<void> => {
    try {
      const res = await getAgentUseHistory({ page: 1, pageSize: 5 })
      if (res.success && res.data.list.length > 0) {
        const bots = res.data.list.slice(0, 5)
        const details = await Promise.all(
          bots.map((b) =>
            getAgentDetail(b.botId).then(
              (d) => (d.success ? d.data : null),
              () => null,
            ),
          ),
        )
        const items: RecentAgentItem[] = details
          .filter((d): d is Agent => d !== null)
          .map((d) => ({ id: d.id, name: d.name, avatar: d.avatar ?? undefined }))
        if (items.length > 0) {
          setRecentAgents(items)
          return
        }
      }
    } catch {
      // 接口失败走降级
    }
    setRecentAgents(
      fallback.slice(0, 5).map((a) => ({ id: a.id, name: a.name, avatar: a.avatar ?? undefined })),
    )
  }, [])

  const loadAgents = useCallback(
    async (opts?: { agentCategory?: string; agentMainCategory?: string }): Promise<void> => {
      const res = await getAgents({
        status: 'published',
        pageSize: 50,
        agentCategory: opts?.agentCategory,
        agentMainCategory: opts?.agentMainCategory,
      })
      if (res.success) {
        setAgents(res.data.list ?? [])
        setItems((res.data.list ?? []).map(mapToItem))
        // MyAgents 我的AI APP:与智能体列表同源取前 6 条(对齐 uniapp myAgents 独立接口降级)
        setMyAgents(
          (res.data.list ?? [])
            .slice(0, 6)
            .map((a) => ({ agentId: a.id, agentName: a.name, avatar: a.avatar ?? undefined })),
        )
        // RecentAgents 最近使用:走 getAgentUseHistory 独立加载(见 loadRecentAgents),
        // 失败时降级取列表前 5 条(对齐 HomeScreen 模式)
        void loadRecentAgents(res.data.list ?? [])
      } else setError(res.error || t('agentScreen.loadFailed'))
    },
    [t, loadRecentAgents],
  )

  const loadModels = useCallback(async () => {
    try {
      const res = await getAiModels({ pageSize: 100 })
      if (res.success) {
        setAiModels(res.data.list ?? [])
      } else {
        // 模型列表加载失败不阻塞页面,toast 提示(模型选择视图降级为空)
        showToast(res.error || t('agentScreen.loadFailed'), 'warning')
      }
    } catch {
      showToast(t('agentScreen.loadFailed'), 'warning')
    }
  }, [showToast, t])

  const loadCategories = useCallback(async (): Promise<void> => {
    try {
      const res = await getAgentCategories()
      if (res.success && res.data) {
        const main = Array.isArray(res.data.agentMainCategory) ? res.data.agentMainCategory : []
        const sub = Array.isArray(res.data.agentCategory) ? res.data.agentCategory : []
        setAgentMainCategoryList([{ id: 'all', name: '全部' }, ...main])
        setAgentCategoryList([{ id: '', name: '全公司' }, ...sub])
      } else {
        // 分类加载失败不阻塞页面,toast 提示(分类弹层降级为静态 fallback)
        showToast(res?.error || t('agentScreen.loadFailed'), 'warning')
      }
    } catch {
      showToast(t('agentScreen.loadFailed'), 'warning')
    }
  }, [showToast, t])

  const load = useCallback(async () => {
    setError(null)
    try {
      await Promise.all([loadAgents(), loadModels(), loadCategories()])
    } catch (e) {
      setError(e instanceof Error ? e.message : t('agentScreen.loadFailed'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [loadAgents, loadModels, loadCategories, t])

  useEffect(() => {
    void load()
  }, [load])

  /** 顶部轮播(对齐 Uniapp tools/index.vue banner_carousel):
   *  api-client 无 getBanners 端点,从智能体列表派生:取前 5 条有头像的智能体转 CarouselItem
   *  (对齐 HomeScreen bannerItems 派生模式,独立于分类筛选,仅在挂载时加载一次) */
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await getAgents({ status: 'published', pageSize: 50 })
        if (!cancelled && res.success) {
          setBanners(
            (res.data.list ?? [])
              .filter((a) => Boolean(a.avatar))
              .slice(0, 5)
              .map((a) => ({ img: a.avatar ?? '', title: a.name, link: a.id })),
          )
        }
      } catch {
        // 轮播加载失败静默,保持空态(条件渲染仍由 banners.length > 0 控制)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  /** 智汇值卡余额(对齐 Uniapp Intelligent-assistant.vue getTokenCount):
   *  调 getTokenBalance 取真实余额,失败保持 0 */
  useEffect(() => {
    if (!token) return
    let cancelled = false
    void (async () => {
      try {
        const res = await getTokenBalance()
        if (!cancelled && res.success) setTokenQuantity(res.data.balance)
      } catch {
        // 失败保持 0(未登录/网络异常/接口不可用均静默,不阻塞页面)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  const modelGroups = useMemo<ModelListGroup[]>(() => buildModelGroups(aiModels), [aiModels])

  /** 已选模型名(消费 selectedModelIds,供"开始对话"入口展示;未命中回退 id) */
  const selectedModelName = useMemo<string>(() => {
    if (selectedModelIds.length === 0) return ''
    const id = selectedModelIds[0] ?? ''
    for (const g of modelGroups) {
      const m = g.models.find((x) => x.id === id)
      if (m) return m.name
    }
    return id
  }, [selectedModelIds, modelGroups])

  /** 开始对话(对齐 handleItemClick 跳 AiAssistantN8n,仅带模型名进入对话页) */
  const handleStartModelChat = useCallback((): void => {
    if (selectedModelIds.length === 0) return
    navigation.navigate('AiAssistantN8n', { title: selectedModelName })
  }, [navigation, selectedModelIds.length, selectedModelName])

  const filteredItems = useMemo<AgentScreenItem[]>(() => {
    const kw = searchKeyword.trim().toLowerCase()
    if (!kw) return items
    return items.filter(
      (item) => item.name.toLowerCase().includes(kw) || item.description.toLowerCase().includes(kw),
    )
  }, [items, searchKeyword])

  const handleToastHide = useCallback((): void => {
    setToast((prev) => ({ ...prev, visible: false }))
  }, [])

  const handleContentScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>): void => {
      setShowBackToTop(event.nativeEvent.contentOffset.y > 200)
    },
    [],
  )

  const handleBackToTop = useCallback((): void => {
    contentScrollRef.current?.scrollTo({ y: 0, animated: true })
  }, [])

  const handleItemClick = useCallback(
    (id: string) => {
      if (!token) {
        Alert.alert(t('common.hint'), '请先登录', [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('common.login'), onPress: () => navigation.navigate('Login') },
        ])
        return
      }
      const agent = items.find((a) => a.id === id)
      // 完整智能体详情(取绑定模型,补全跳转参数;对齐 Uniapp handleAgentPitch 带 modelNamea/type)
      const full = agents.find((a) => a.id === id)
      // as never:RootStackParamList 未声明 modelId/modelName(路由运行时可接收,见 AiAssistantN8n LocalParamList)
      navigation.navigate('AiAssistantN8n', {
        agentId: id,
        title: agent?.name ?? full?.name,
      } as never)
    },
    [token, t, navigation, items, agents],
  )

  // ── MyAgents 我的AI APP 点击(对齐 Uniapp MyAgents.vue navigateTo → ai_assistant/ai_assistant_n8n) ──
  const handleMyAgentPress = useCallback(
    (item: MyAgentItem): void => {
      if (!token) {
        Alert.alert(t('common.hint'), '请先登录', [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('common.login'), onPress: () => navigation.navigate('Login') },
        ])
        return
      }
      const id = item.agentId ?? item.id
      if (!id) return
      navigation.navigate('AiAssistantN8n', { agentId: id, title: item.agentName ?? item.name })
    },
    [token, t, navigation],
  )
  /** 我的AI员工(对齐 Uniapp MyAgents.vue goToTeam → /pages/tools/ai_group/index) */
  const handleTeamPress = useCallback((): void => {
    navigation.navigate('AiGroup')
  }, [navigation])
  /** 智汇值卡充值(对齐 Uniapp Intelligent-assistant.vue topupClick → /pagesA/top-up/index) */
  const handleRechargePress = useCallback((): void => {
    if (!token) {
      navigation.navigate('Login')
      return
    }
    navigation.navigate('AppTopup')
  }, [token, navigation])

  // ── 两行分类按钮回调 ──
  const handleCategorySelect = useCallback((id: string): void => {
    setActiveCategory(id)
  }, [])
  const handleMainSelect = useCallback(
    (id: string): void => {
      setActiveMain(id)
      setTagWrapVisible(false)
      const mainParam = id === 'all' ? '' : id
      void loadAgents({ agentCategory: activeCategory, agentMainCategory: mainParam })
    },
    [activeCategory, loadAgents],
  )

  // ── Drawer 历史对话懒加载(对齐 ProfileScreen loadDrawerConversations:
  // 首次打开 Drawer 时拉取,后续复用缓存) ──
  const loadDrawerConversations = useCallback(async (): Promise<void> => {
    const res = await listConversations({ page: 1, pageSize: 50 })
    if (res.success) {
      const items: DrawerConversationItem[] = res.data.conversations.map(mapConversationToDrawer)
      setDrawerConversations(items)
    } else {
      // 静默失败:不弹错误(对齐 ProfileScreen 写法)
      setDrawerConversations([])
    }
    setDrawerConversationsLoaded(true)
  }, [])

  useEffect(() => {
    if (drawerVisible && !drawerConversationsLoaded && token) {
      void loadDrawerConversations()
    }
  }, [drawerVisible, drawerConversationsLoaded, token, loadDrawerConversations])

  // ── NavBar 按钮回调 ──
  const handleCategoryPress = useCallback((): void => {
    setTagWrapVisible((prev) => !prev)
  }, [])
  const handleMenuPress = useCallback((): void => {
    setDrawerVisible(true)
  }, [])
  const handleSearchPress = useCallback((): void => {
    setShowSearchBox((prev) => !prev)
  }, [])

  // ── Drawer 回调 ──
  const closeDrawer = useCallback((): void => setDrawerVisible(false), [])
  const handleDrawerNavigate = useCallback(
    (tab: DrawerTab): void => {
      setDrawerVisible(false)
      if (tab === 'square') {
        navigation.navigate('Plaza')
        return
      }
      if (tab === 'share') {
        navigation.navigate('News')
        return
      }
      const rnTab = DRAWER_TAB_TO_RN_TAB[tab]
      rootNav?.navigate('Main', { screen: mainScreenForTab(rnTab) })
    },
    [navigation, rootNav],
  )
  const handleDrawerNavigateCompany = useCallback((): void => {
    setDrawerVisible(false)
    navigation.navigate('Distribution')
  }, [navigation])
  const handleDrawerClaimFree = useCallback((): void => {
    setDrawerVisible(false)
    try {
      Clipboard.setString(FREE_RESOURCE_URL)
      showToast('链接已复制到剪贴板', 'success')
    } catch {
      showToast('复制失败,请重试', 'warning')
    }
  }, [showToast])
  const handleDrawerCreateNewChat = useCallback((): void => {
    setDrawerVisible(false)
    // 对齐 Uniapp addNewChat → ai_index2/ai_assistant 对话页;带默认标题进入全新对话
    navigation.navigate('AiAssistantN8n', { title: t('aiAssistantN8n.title') })
  }, [navigation, t])
  const handleDrawerSelectConversation = useCallback(
    (id: string): void => {
      setDrawerVisible(false)
      const conv = drawerConversations.find((c) => c.id === id)
      navigation.navigate('AiAssistantN8n', { agentId: id, title: conv?.title })
    },
    [navigation, drawerConversations],
  )
  const handleDrawerDeleteConversation = useCallback(
    (id: string): void => {
      Alert.alert('删除对话', '确认删除此对话?', [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: () => {
            // 乐观删除:先从本地列表移除,API 失败时回滚(对齐 ProfileScreen 删除对话体验)
            const snapshot = drawerConversations
            setDrawerConversations((prev) => prev.filter((c) => c.id !== id))
            void (async () => {
              const res = await deleteConversation(id)
              if (!res.success) {
                setDrawerConversations(snapshot)
                showToast('删除失败,请重试', 'warning')
              } else {
                showToast('已删除', 'success')
              }
            })()
          },
        },
      ])
    },
    [drawerConversations, showToast],
  )
  const handleDrawerOpenSettings = useCallback((): void => {
    setDrawerVisible(false)
    navigation.navigate('Settings')
  }, [navigation])
  const handleDrawerOpenMessages = useCallback((): void => {
    setDrawerVisible(false)
    navigation.navigate('MessageCenter')
  }, [navigation])
  const handleDrawerGoHome = useCallback((): void => {
    setDrawerVisible(false)
    navigation.navigate('Main', { screen: 'HomeMain' })
  }, [navigation])
  const handleNavigateExtra = useCallback(
    (menu: DrawerExtraMenu): void => {
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
          navigation?.navigate('Assistant')

          break

        case 'tools':
          navigation.navigate('Settings')
          break
      }
    },
    [navigation],
  )

  const drawerUser = {
    avatar: user?.avatar,
    nickname: user?.nickname ?? user?.username ?? '未登录',
    level: (user?.isVip === 1 ? 'vip' : 'normal') as 'vip' | 'normal',
  }

  /** 底部 Tab 切换(对齐原 customTabBar 5 主 Tab;广场/动态为 RootStack 独立路由) */
  const handleTabChange = (key: TabBarKey): void => {
    switch (key) {
      case 'home':
        rootNav?.navigate('Main', { screen: 'HomeMain' })
        break
      case 'plaza':
        rootNav?.navigate('Plaza')
        break
      case 'news':
        rootNav?.navigate('News')
        break
      case 'mine':
        rootNav?.navigate('Main', { screen: 'ProfileMain' })
        break
      case 'aiShop':
        break // 当前 Tab
    }
  }

  return (
    <View style={styles.shell}>
      <NavBar
        title={t('agentScreen.title')}
        leftActions={[
          { icon: FolderOpen, label: '分类', onPress: handleCategoryPress },
          { icon: Menu, label: '菜单', onPress: handleMenuPress },
        ]}
        rightActions={[{ icon: Search, label: '搜索', onPress: handleSearchPress }]}
      />
      <ScrollView
        ref={contentScrollRef}
        style={styles.contentScroll}
        onScroll={handleContentScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true)
              void load()
            }}
          />
        }
      >
        {banners.length > 0 ? (
          <View style={styles.carouselWrap}>
            <Carousel
              banner={banners}
              onItemPress={(item) => {
                // 点击轮播跳转对应智能体对话(banner 派生自智能体列表,link 为智能体 id;
                // 对齐 Uniapp banner_carousel @item-click → ai_assistant)
                if (!token) {
                  Alert.alert(t('common.hint'), '请先登录', [
                    { text: t('common.cancel'), style: 'cancel' },
                    { text: t('common.login'), onPress: () => navigation.navigate('Login') },
                  ])
                  return
                }
                navigation.navigate('AiAssistantN8n', {
                  agentId: item.link,
                  title: item.title,
                })
              }}
            />
          </View>
        ) : null}
        {/* 搜索框位置对齐 Uniapp tools/index.vue 行 44:轮播图之后、RecentAgents 之前 */}
        {showSearchBox ? (
          <InputArea
            value={searchKeyword}
            onChangeText={setSearchKeyword}
            placeholder="搜索AI应用"
            onSubmit={(text) => setSearchKeyword(text)}
          />
        ) : null}
        {recentAgents.length > 0 ? (
          <RecentAgents items={recentAgents} onItemClick={(item) => handleItemClick(item.id)} />
        ) : null}
        {/* IntelligentAssistant 智汇值卡(对齐 Uniapp Intelligent-assistant.vue:小方欢迎卡 + 剩余智汇值 + 充值) */}
        <View style={styles.sectionWrap}>
          <IntelligentAssistant tokenQuantity={tokenQuantity} onRecharge={handleRechargePress} />
        </View>
        {/* MyAgents 我的AI APP(对齐 Uniapp tools/index MyAgents.vue:标题 + 我的AI员工入口 + 横滑卡片) */}
        <View style={styles.sectionWrap}>
          <MyAgents
            items={myAgents}
            onItemClick={handleMyAgentPress}
            onTeamPress={handleTeamPress}
          />
        </View>
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tab, viewMode === 'shared' && styles.tabActive]}
            onPress={() => setViewMode('shared')}
            activeOpacity={0.8}
          >
            <Text style={viewMode === 'shared' ? styles.tabTextActive : styles.tabText}>
              智能体
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, viewMode === 'local' && styles.tabActive]}
            onPress={() => setViewMode('local')}
            activeOpacity={0.8}
          >
            <Text style={viewMode === 'local' ? styles.tabTextActive : styles.tabText}>
              模型选择
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.viewport}>
          {viewMode === 'shared' ? (
            <SharedAgentScreen
              t={t}
              items={filteredItems}
              loading={loading}
              refreshing={refreshing}
              error={error}
              onRefresh={() => {
                setRefreshing(true)
                void load()
              }}
              onPressItem={(id) => handleItemClick(id)}
              onBack={() => navigation.goBack()}
            />
          ) : (
            <>
              <ModelList
                groups={modelGroups}
                selectionMode="single"
                selectedIds={selectedModelIds}
                onSelectChange={setSelectedModelIds}
              />
              {/* 已选模型操作条(对齐 Uniapp 模型选择后进入对话;消费 selectedModelIds,避免死状态) */}
              {selectedModelIds.length > 0 ? (
                <View style={styles.modelSelectionBar}>
                  <Text style={styles.modelSelectionText} numberOfLines={1}>
                    已选模型:{selectedModelName}
                  </Text>
                  <TouchableOpacity
                    style={styles.modelStartBtn}
                    activeOpacity={0.8}
                    onPress={handleStartModelChat}
                    accessibilityRole="button"
                    accessibilityLabel="开始对话"
                  >
                    <Text style={styles.modelStartBtnText}>开始对话</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>
      {showBackToTop ? (
        <TouchableOpacity style={styles.backToTopBtn} activeOpacity={0.7} onPress={handleBackToTop}>
          <Text style={styles.backToTopIcon}>↑</Text>
        </TouchableOpacity>
      ) : null}
      <FloatBox
        visible={toast.visible}
        type={toast.type}
        message={toast.message}
        onHide={handleToastHide}
      />
      {/* GlobalFloatBox 悬浮导航(对齐 Uniapp tools/index.vue float-box:赚米/客服/反馈) */}
      <GlobalFloatBox
        onPromote={() => rootNav?.navigate('Promote')}
        onConsult={() => rootNav?.navigate('CustomerService')}
        onFeedback={() => rootNav?.navigate('Settings')}
      />
      <Drawer
        visible={drawerVisible}
        onClose={closeDrawer}
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
      <Modal
        visible={tagWrapVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setTagWrapVisible(false)}
      >
        <View style={styles.trackOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setTagWrapVisible(false)} />
          <View style={styles.trackContent}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {agentCategoryList.map((cat) => {
                const selected = activeCategory === cat.id
                return (
                  <Pressable
                    key={cat.id || 'all-company'}
                    style={[styles.trackBtn, selected && styles.trackBtnActive]}
                    onPress={() => handleCategorySelect(cat.id)}
                  >
                    <Text style={selected ? styles.trackBtnTextActive : styles.trackBtnText}>
                      {cat.name}
                    </Text>
                  </Pressable>
                )
              })}
            </ScrollView>
            <View style={styles.trackDivider} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {agentMainCategoryList.map((main) => {
                const selected = activeMain === main.id
                return (
                  <Pressable
                    key={main.id}
                    style={[styles.trackBtn, selected && styles.trackBtnActive]}
                    onPress={() => handleMainSelect(main.id)}
                  >
                    <Text style={selected ? styles.trackBtnTextActive : styles.trackBtnText}>
                      {main.name}
                    </Text>
                  </Pressable>
                )
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
      {/* 底部导航(对齐原 customTabBar 5 主 Tab) */}
      <TabBar activeTab="aiShop" onChange={handleTabChange} />
    </View>
  )
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

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: tokens.surface.bg },
  contentScroll: { flex: 1 },
  carouselWrap: {
    marginTop: rpx(18),
    marginHorizontal: rpx(20),
    borderRadius: 15,
    overflow: 'hidden',
  },
  sectionWrap: { marginHorizontal: rpx(24), marginTop: rpx(16) },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: rpx(24),
    paddingTop: rpx(20),
    paddingBottom: rpx(16),
    gap: rpx(16),
    backgroundColor: tokens.surface.bg,
  },
  tab: {
    paddingHorizontal: rpx(28),
    paddingVertical: rpx(12),
    borderRadius: 8,
    backgroundColor: tokens.surface.muted,
  },
  tabActive: { backgroundColor: tokens.brand.DEFAULT },
  tabText: { fontSize: 13, color: tokens.text.secondary },
  tabTextActive: { fontSize: 13, color: tokens.surface.light, fontWeight: '600' },
  viewport: { minHeight: 400, paddingHorizontal: rpx(20) },
  // 已选模型操作条(模型选择视图下方,消费 selectedModelIds)
  modelSelectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: rpx(12),
    paddingHorizontal: rpx(16),
    paddingVertical: rpx(10),
    borderRadius: 8,
    backgroundColor: tokens.surface.card,
  },
  modelSelectionText: {
    flex: 1,
    fontSize: 13,
    color: tokens.text.primary,
    marginRight: rpx(12),
  },
  modelStartBtn: {
    paddingHorizontal: rpx(20),
    paddingVertical: rpx(8),
    borderRadius: 6,
    backgroundColor: tokens.brand.DEFAULT,
  },
  modelStartBtnText: { fontSize: 13, color: tokens.surface.light, fontWeight: '600' },
  backToTopBtn: {
    position: 'absolute',
    bottom: 20,
    right: 16,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: tokens.surface.card,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: tokens.gray.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  backToTopIcon: {
    fontSize: 18,
    color: tokens.text.secondary,
    lineHeight: 20,
    includeFontPadding: false,
  },
  trackOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  trackContent: {
    backgroundColor: tokens.surface.card,
    paddingHorizontal: rpx(20),
    paddingVertical: rpx(10),
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  trackBtn: {
    paddingHorizontal: rpx(8),
    height: 22,
    justifyContent: 'center',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: tokens.surface.light,
    backgroundColor: 'transparent',
    marginRight: rpx(6),
  },
  trackBtnActive: {
    backgroundColor: 'rgba(248, 249, 252, 0.65)',
    borderColor: tokens.indigo.light,
    shadowColor: tokens.gray.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  trackBtnText: { fontSize: 11, color: tokens.overlay.modal },
  trackBtnTextActive: { fontSize: 11, color: tokens.gray.black, fontWeight: '700' },
  trackDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: tokens.surface.muted,
    marginVertical: rpx(10),
  },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
