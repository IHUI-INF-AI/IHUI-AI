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
  getAgentCategories,
  getAgents,
  getAiModels,
  type Agent,
  type AgentCategoryItem,
  type AiModel,
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
import InputArea from '../components/InputArea'
import ModelList, { type ModelListGroup, type ModelListItem } from '../components/ModelList'
import NavBar from '../components/NavBar'
import RecentAgents, { type RecentAgentItem } from '../components/RecentAgents'
import type { CarouselItem } from '@ihui/ui-native'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

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
const FREE_RESOURCE_URL = 'https://ihui.feishu.cn/wiki/'

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

function modelIcon(type: 'image' | 'av' | 'text' | string | undefined): string {
  if (type === 'image') return '🎨'
  if (type === 'av') return '🎬'
  return '🤖'
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
  const [aiModels, setAiModels] = useState<AiModel[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([])
  const [banners] = useState<CarouselItem[]>([])
  const [recentAgents] = useState<RecentAgentItem[]>([])
  // 搜索关键词 + 搜索框显隐(对齐 Uniapp showSearchBox)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [showSearchBox, setShowSearchBox] = useState(true)
  // 返回顶部按钮(对齐 Uniapp toodown-wrapper)
  const [showBackToTop, setShowBackToTop] = useState(false)
  const contentScrollRef = useRef<ScrollView>(null)
  // FloatBox toast 提示
  const [toast, setToast] = useState<{ visible: boolean; type: FloatBoxType; message: string }>({
    visible: false,
    type: 'info',
    message: '',
  })
  // Drawer 侧滑抽屉
  const [drawerVisible, setDrawerVisible] = useState(false)
  const [drawerConversations] = useState<DrawerConversationItem[]>([])
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

  const loadAgents = useCallback(
    async (opts?: { agentCategory?: string; agentMainCategory?: string }): Promise<void> => {
      const res = await getAgents({
        status: 'published',
        pageSize: 50,
        agentCategory: opts?.agentCategory,
        agentMainCategory: opts?.agentMainCategory,
      })
      if (res.success) setItems((res.data.list ?? []).map(mapToItem))
      else setError(res.error || t('agentScreen.loadFailed'))
    },
    [t],
  )

  const loadModels = useCallback(async () => {
    const res = await getAiModels({ pageSize: 100 })
    if (res.success) setAiModels(res.data.list ?? [])
  }, [])

  const loadCategories = useCallback(async (): Promise<void> => {
    const res = await getAgentCategories()
    if (res.success && res.data) {
      const main = Array.isArray(res.data.agentMainCategory) ? res.data.agentMainCategory : []
      const sub = Array.isArray(res.data.agentCategory) ? res.data.agentCategory : []
      setAgentMainCategoryList([{ id: 'all', name: '全部' }, ...main])
      setAgentCategoryList([{ id: '', name: '全公司' }, ...sub])
    }
  }, [])

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

  const modelGroups = useMemo<ModelListGroup[]>(() => buildModelGroups(aiModels), [aiModels])

  const filteredItems = useMemo<AgentScreenItem[]>(() => {
    const kw = searchKeyword.trim().toLowerCase()
    if (!kw) return items
    return items.filter(
      (item) => item.name.toLowerCase().includes(kw) || item.description.toLowerCase().includes(kw),
    )
  }, [items, searchKeyword])

  const showToast = useCallback((message: string, type: FloatBoxType = 'info'): void => {
    setToast({ visible: true, type, message })
  }, [])

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
      navigation.navigate('AiAssistant', { agentId: id, title: agent?.name })
    },
    [token, t, navigation, items],
  )

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
        navigation.navigate('Square')
        return
      }
      if (tab === 'share') {
        navigation.navigate('Share')
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
    navigation.navigate('AiAssistant')
  }, [navigation])
  const handleDrawerSelectConversation = useCallback(
    (id: string): void => {
      setDrawerVisible(false)
      const conv = drawerConversations.find((c) => c.id === id)
      navigation.navigate('AiAssistant', { agentId: id, title: conv?.title })
    },
    [navigation, drawerConversations],
  )
  const handleDrawerDeleteConversation = useCallback(
    (_id: string): void => {
      Alert.alert('删除对话', '确认删除此对话?', [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: () => showToast('删除功能待 API 接入', 'info'),
        },
      ])
    },
    [showToast],
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

  return (
    <View style={styles.shell}>
      <NavBar
        title={t('agentScreen.title')}
        leftActions={[
          { icon: '🗂️', label: '分类', onPress: handleCategoryPress },
          { icon: '☰', label: '菜单', onPress: handleMenuPress },
        ]}
        rightActions={[{ icon: '🔍', label: '搜索', onPress: handleSearchPress }]}
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
        {showSearchBox ? (
          <InputArea
            value={searchKeyword}
            onChangeText={setSearchKeyword}
            placeholder="搜索AI应用"
            onSubmit={(text) => setSearchKeyword(text)}
          />
        ) : null}
        {banners.length > 0 ? (
          <View style={styles.carouselWrap}>
            <Carousel
              banner={banners}
              onItemPress={(item) => {
                void item
              }}
            />
          </View>
        ) : null}
        {recentAgents.length > 0 ? (
          <RecentAgents items={recentAgents} onItemClick={(item) => handleItemClick(item.id)} />
        ) : null}
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
            <ModelList
              groups={modelGroups}
              selectionMode="single"
              selectedIds={selectedModelIds}
              onSelectChange={setSelectedModelIds}
            />
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
    </View>
  )
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: tokens.surface.bg },
  contentScroll: { flex: 1 },
  carouselWrap: { marginTop: 9, marginHorizontal: 10, borderRadius: 15, overflow: 'hidden' },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
    gap: 8,
    backgroundColor: tokens.surface.bg,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: tokens.surface.muted,
  },
  tabActive: { backgroundColor: tokens.brand.DEFAULT },
  tabText: { fontSize: 13, color: tokens.text.secondary },
  tabTextActive: { fontSize: 13, color: tokens.surface.light, fontWeight: '600' },
  viewport: { minHeight: 400, paddingHorizontal: 10 },
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
    shadowColor: '#000',
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
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  trackBtn: {
    paddingHorizontal: 4,
    height: 22,
    justifyContent: 'center',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#ffffff',
    backgroundColor: 'transparent',
    marginRight: 3,
  },
  trackBtnActive: {
    backgroundColor: 'rgba(248, 249, 252, 0.65)',
    borderColor: '#e0e8ff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  trackBtnText: { fontSize: 11, color: 'rgba(0,0,0,0.6)' },
  trackBtnTextActive: { fontSize: 11, color: '#000000', fontWeight: '700' },
  trackDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: tokens.surface.muted,
    marginVertical: 5,
  },
})
