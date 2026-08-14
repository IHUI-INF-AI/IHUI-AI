import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import Clipboard from '@react-native-clipboard/clipboard'
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs'
import {
  getAllStudyProgress,
  getCourses,
  getLiveList,
  type Course,
  type Live,
  type StudyProgress,
} from '@ihui/api-client'
import {
  HomeScreen as SharedHomeScreen,
  type HomeLiveItem,
  type HomeMenuItem,
  type HomeProgressItem,
  type HomeRecommendItem,
} from '@ihui/rn-app'
import type { CarouselItem } from '@ihui/ui-native'
import type { AiModelData } from '@ihui/types'
import CourseCarousel, { type CourseCarouselItem } from '../components/CourseCarousel'
import Carousel from '../components/Carousel'
import CardWithList, { type CardWithListItem } from '../components/CardWithList'
import { OfflineBanner } from '../components/OfflineBanner'
import AiModelCard from '../components/AiModelCard'
import { Toolbar, type ToolbarItem } from '../components/Toolbar'
import { GlobalFloatBox } from '../components/GlobalFloatBox'
import { KnowledgePlanet, type KnowledgePlanetItem } from '../components/KnowledgePlanet'
import PopularCourses, { type PopularCourse } from '../components/PopularCourses'
import { FunctionBlockColumn, type FunctionBlock } from '../components/FunctionBlockColumn'
import { BottomFigure } from '../components/BottomFigure'
import { MoreTitles } from '../components/MoreTitles'
// 对齐 Uniapp ai_index:复用共享组件 NavBar / Drawer / InputArea / FloatBox / RecentAgents
import { NavBar, type NavBarAction } from '../components/NavBar'
import {
  Drawer,
  type DrawerExtraMenu,
  type DrawerTab,
} from '../components/Drawer'
import { InputArea } from '../components/InputArea'
import ModelList, { type ModelListGroup } from '../components/ModelList'
import { FloatBox, type FloatBoxType } from '../components/FloatBox'
import RecentAgents, { type RecentAgentItem } from '../components/RecentAgents'
import { useAuth } from '../context/AuthContext'
import { useNotificationStore } from '../stores/notification'
import { useI18n } from '../i18n'
import type {
  HomeStackParamList,
  MainTabParamList,
  RootStackParamList,
} from '../navigation/RootNavigator'
import { formatShortDateTime } from '../utils/date-utils'

type NavigationProp = NativeStackNavigationProp<HomeStackParamList>
type RootNav = NativeStackNavigationProp<RootStackParamList>
type TabNav = BottomTabNavigationProp<MainTabParamList>

const MENU_ITEMS: HomeMenuItem[] = [
  { key: 'Search', labelKey: 'menu.search', icon: '🔍' },
  { key: 'History', labelKey: 'menu.history', icon: '🕘' },
  { key: 'Bookmark', labelKey: 'menu.bookmark', icon: '🔖' },
  { key: 'CourseFilter', labelKey: 'menu.courseFilter', icon: '🎯' },
  { key: 'LiveList', labelKey: 'menu.liveList', icon: '📡' },
  { key: 'LivePlaybackList', labelKey: 'menu.livePlaybackList', icon: '🎬' },
  { key: 'CourseAnnex', labelKey: 'menu.courseAnnex', icon: '📎' },
  { key: 'CourseResource', labelKey: 'menu.courseResource', icon: '📚' },
  { key: 'CourseQAList', labelKey: 'menu.courseQAList', icon: '❓' },
]

function toRecommend(courses: Course[]): HomeRecommendItem[] {
  return courses.map((c) => ({
    id: c.id,
    title: c.title,
    instructor: c.instructor,
    level: c.level,
    studentCount: c.studentCount,
    price: c.price,
    isFree: c.isFree,
  }))
}

function toLiveItem(lives: Live[]): HomeLiveItem[] {
  return lives.map((l) => ({
    id: l.id,
    title: l.title,
    lecturerName: l.lecturerName,
    isLive: l.isLive,
    startTimeText: formatShortDateTime(l.startTime),
  }))
}

function toProgressItem(items: StudyProgress[]): HomeProgressItem[] {
  return items.map((p) => ({
    courseId: p.courseId,
    courseTitle: p.courseTitle,
    progress: p.progress,
    completedLessons: p.completedLessons,
    totalLessons: p.totalLessons,
  }))
}

/** 顶部轮播:取前 5 条推荐课程,适配 CourseCarouselItem 形状 */
function toCarouselItems(items: HomeRecommendItem[]): CourseCarouselItem[] {
  return items.slice(0, 5).map((r) => ({
    id: r.id,
    title: r.title,
    price: r.price,
    isFree: r.isFree,
    icon: '📘',
  }))
}

/** KnowledgePlanet 数据:取推荐课程前 5 条转为资讯卡片形式 */
function toKnowledgeItems(items: HomeRecommendItem[]): KnowledgePlanetItem[] {
  return items.slice(0, 5).map((r) => ({
    id: r.id,
    title: r.title,
    summary: r.instructor ? `讲师:${r.instructor}` : undefined,
    author: r.instructor || 'AI 智汇社',
    createdAt: Date.now(),
  }))
}

/** PopularCourses 数据:取推荐课程前 4 条(2 列网格 × 2 行) */
function toPopularCourseItems(items: HomeRecommendItem[]): PopularCourse[] {
  return items.slice(0, 4).map((r) => ({
    id: r.id,
    title: r.title,
    instructor: r.instructor || '未知讲师',
    lessons: 0,
    price: r.price,
    isFree: r.isFree,
    isVip: !r.isFree,
    studentCount: r.studentCount,
  }))
}

/** FunctionBlockColumn 功能块(对齐 Uniapp 首页功能入口) */
const FUNCTION_BLOCKS: FunctionBlock[] = [
  { id: 'distribution', title: '分销中心', icon: '🎁', description: '推广赚佣金' },
  { id: 'task', title: '任务中心', icon: '✅', description: '完成领奖励' },
  { id: 'checkin', title: '每日签到', icon: '📅', description: '连续签到得好礼' },
  { id: 'ranking', title: '排行榜', icon: '🏆', description: '查看学习排名' },
]

// ── 对齐 Uniapp ai_index BottomActionBar 8 种 model-type-btn(行 44-97) ──
/** AI 模型类型(skills 技能 / talk 对话 / image 图片 / video 视频 / audio 音频 / videoa 视频音频 / other 其他 / sck 知识库) */
type ModelType = 'skills' | 'talk' | 'image' | 'video' | 'audio' | 'videoa' | 'other' | 'sck'

/** 模型类型按钮配置(对应 Uniapp model-type-btn:icon + label + active 态) */
interface ModelTypeOption {
  type: ModelType
  label: string
  icon: string
}

/** 当前选中的模型(对齐 Uniapp modelName/modelNameEN/modelId 三元组,简化为 type+id+name) */
interface SelectedModel {
  type: ModelType
  id: string
  name: string
}

/** 8 种模型类型按钮(顺序与图标含义对齐 Uniapp ai_index 行 44-97) */
const MODEL_TYPES: ModelTypeOption[] = [
  { type: 'skills', label: '技能', icon: '🧠' },
  { type: 'talk', label: '对话', icon: '💬' },
  { type: 'image', label: '图片', icon: '🖼️' },
  { type: 'video', label: '视频', icon: '🎬' },
  { type: 'audio', label: '音频', icon: '🎵' },
  { type: 'videoa', label: '视音', icon: '📹' },
  { type: 'other', label: '其他', icon: '⚙️' },
  { type: 'sck', label: '知识库', icon: '📚' },
]

/** 各类型占位模型列表(对齐 Uniapp modelList.imageList/videoList/audioList/... 分类,
 *  空数据占位待 API 接入,沿用 recentAgents 同款占位策略;每类 1 条样例保证 Modal 非空可演示) */
const PLACEHOLDER_MODELS: Record<ModelType, ModelListGroup[]> = {
  skills: [
    {
      vendor: '智能体',
      models: [
        { id: 'agent-default', name: '通用智能体', description: '通用问答 Agent', icon: '🤖', isFree: true },
      ],
    },
  ],
  talk: [
    {
      vendor: '文本模型',
      models: [
        { id: 'talk-gpt', name: 'GPT 对话', description: '通用文本对话', icon: '💬', isFree: true },
      ],
    },
  ],
  image: [
    {
      vendor: '图像生成',
      models: [
        { id: 'img-sdxl', name: 'SDXL 图像', description: '高质量图像生成', icon: '🎨', isFree: false },
      ],
    },
  ],
  video: [
    {
      vendor: '视频生成',
      models: [
        { id: 'vid-sora', name: 'Sora 视频', description: '文生视频', icon: '🎞️', isFree: false },
      ],
    },
  ],
  audio: [
    {
      vendor: '语音模型',
      models: [
        { id: 'aud-tts', name: 'TTS 语音', description: '文本转语音', icon: '🔊', isFree: true },
      ],
    },
  ],
  videoa: [
    {
      vendor: '视频音频',
      models: [
        { id: 'va-default', name: '视音合成', description: '视频音频一体化', icon: '🎤', isFree: false },
      ],
    },
  ],
  other: [
    {
      vendor: '其他',
      models: [
        { id: 'other-default', name: '通用模型', description: '其他类型模型', icon: '⚙️', isFree: true },
      ],
    },
  ],
  sck: [
    {
      vendor: '知识库',
      models: [
        { id: 'sck-default', name: '默认知识库', description: '通用知识库检索', icon: '📚', isFree: true },
      ],
    },
  ],
}

export function HomeScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const { user } = useAuth()
  const { connected, unreadCount, setVisible } = useNotificationStore()
  const [recommends, setRecommends] = useState<HomeRecommendItem[]>([])
  const [lives, setLives] = useState<HomeLiveItem[]>([])
  const [progress, setProgress] = useState<HomeProgressItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  /** 父级 RootStack 导航(用于跳转 Search/Chat/Promote 等 RootStack 路由) */
  const rootNav = navigation.getParent<RootNav>()
  /** 父级 Tabs 导航(用于跳转 'course' / 'live' 等 Tab 路由) */
  const tabNav = navigation.getParent<TabNav>()

  // ── 对齐 Uniapp ai_index:NavBar 菜单按钮触发 Drawer ──
  const [drawerVisible, setDrawerVisible] = useState(false)
  // ── FloatBox toast(对齐 Uniapp uni.showToast 顶部悬浮提示,替代阻塞式 Alert) ──
  const [toastVisible, setToastVisible] = useState(false)
  const [toastType, setToastType] = useState<FloatBoxType>('info')
  const [toastMessage, setToastMessage] = useState('')
  // ── InputArea 底部输入区(对齐 Uniapp BottomActionBar 输入部分) ──
  const [inputValue, setInputValue] = useState('')
  // ── 模型选择(对齐 Uniapp ai_index currentModelType + modelName/modelId) ──
  // activeModelType:当前展开的类型弹窗(null 表示关闭);selectedModel:已选模型(显示在输入区小标签)
  const [activeModelType, setActiveModelType] = useState<ModelType | null>(null)
  const [selectedModel, setSelectedModel] = useState<SelectedModel | null>(null)

  const showToast = useCallback((type: FloatBoxType, message: string): void => {
    setToastType(type)
    setToastMessage(message)
    setToastVisible(true)
  }, [])
  const hideToast = useCallback((): void => setToastVisible(false), [])

  /** Drawer 用户信息(对齐 Uniapp DrawerComponent userinfo prop) */
  const drawerUser = {
    avatar: user?.avatar,
    nickname: user?.nickname || user?.phone || '未登录',
    level: (user?.isVip === 1 ? 'vip' : 'normal') as 'vip' | 'normal',
  }

  /** RecentAgents 最近使用智能体(对齐 Uniapp AgentList,空数组占位待 API 接入) */
  const recentAgents: RecentAgentItem[] = []

  // ── Drawer 回调(对齐 Uniapp gopage / gotocompany / lingqu / addNewChat) ──
  const closeDrawer = (): void => setDrawerVisible(false)
  const handleDrawerNavigate = (tab: DrawerTab): void => {
    // square/share 是 RootStack 路由(Uniapp: 广场/动态)
    if (tab === 'square') {
      rootNav?.navigate('Square')
      return
    }
    if (tab === 'share') {
      rootNav?.navigate('Share')
      return
    }
    // home/ai/mine 是 Tab 路由(Uniapp: AI 对话社区/AI 应用/我的)
    const rnTab: 'home' | 'ai' | 'mine' = tab
    rootNav?.navigate('Tabs', { screen: rnTab } as never)
  }
  const handleDrawerNavigateCompany = (): void => {
    // 一人公司:跳 Distribution(对齐 Uniapp gotocompany → /pagesA/distribution/index)
    rootNav?.navigate('Distribution')
  }
  const handleDrawerClaimFree = (): void => {
    // 领取免费资料:复制飞书链接 + FloatBox 提示(对齐 Uniapp lingqu → setClipboardData)
    Clipboard.setString('https://aizhihuishe.feishu.cn/wiki/GPs7wff9PiDekQkKvBncryrmnIh')
    showToast('success', '链接已复制,请在浏览器中打开')
  }
  const handleDrawerCreateNewChat = (): void => {
    // 创建新对话:跳 Chat(对齐 Uniapp addNewChat → 跳 ai_index2)
    rootNav?.navigate('Chat', {})
  }
  const handleDrawerSelectConversation = (id: string): void => {
    // 选择历史对话:跳 Chat 并携带 conversationId(对齐 Uniapp handleShowFullList)
    rootNav?.navigate('Chat', { conversationId: id })
  }
  const handleDrawerDeleteConversation = (_id: string): void => {
    // HomeScreen 不持有历史对话列表,删除由 ChatScreen 负责;此处仅提示
    showToast('info', '请在对话页管理历史记录')
  }
  const handleDrawerOpenSettings = (): void => {
    rootNav?.navigate('Settings')
  }
  const handleDrawerOpenMessages = (): void => {
    rootNav?.navigate('MessageCenter')
  }
  const handleDrawerGoHome = (): void => {
    rootNav?.navigate('Tabs', { screen: 'home' } as never)
  }
  const handleNavigateExtra = (menu: DrawerExtraMenu): void => {
    // 扩展菜单(对齐 Uniapp 隐藏菜单 + label_content 入口)
    switch (menu) {
      case 'aigc':
        rootNav?.navigate('AigcList')
        break
      case 'learn':
        rootNav?.navigate('Learn')
        break
      case 'modelPlaza':
        rootNav?.navigate('ModelPlaza')
        break
      case 'company':
        rootNav?.navigate('Distribution')
        break
      case 'tools':
        rootNav?.navigate('AiAssistant')
        break
      default:
        // 未识别的扩展菜单,静默忽略(防御性:防止 EXTRA_MENUS 配置漂移)
        break
    }
  }

  // ── NavBar 按钮回调(对齐 Uniapp navigation-bars 事件) ──
  /** 菜单按钮:打开 Drawer(对齐 Uniapp handleNavClick → tagWrapShow = true) */
  const handleMenuPress = (): void => setDrawerVisible(true)
  /** 加入社区群:显示二维码提示(对齐 Uniapp join-click → showQrCode → showQrCodeModal = true)
   *  RN 端无二维码图片资源,用 FloatBox 提示替代弹窗 */
  const handleJoinPress = (): void => {
    showToast('info', '请扫描社群二维码加入(二维码图片待接入)')
  }
  /** 分享图:跳我的页面(对齐 Uniapp share-image → goToMyPage → /pages/table/user/index) */
  const handleGoToMyPage = (): void => {
    rootNav?.navigate('Tabs', { screen: 'mine' } as never)
  }

  /** NavBar 左右按钮配置(对齐 Uniapp navigation-bars:菜单 + 加入社区群 + 分享)
   *  间距对齐:Uniapp padding 0 24rpx ≈ 12dp(NavBar 内部已实现 paddingHorizontal:12) */
  const navLeftActions: ReadonlyArray<NavBarAction> = [
    { icon: '☰', label: '菜单', onPress: handleMenuPress },
  ]
  const navRightActions: ReadonlyArray<NavBarAction> = [
    { icon: '🤝', label: '加入群', onPress: handleJoinPress },
    { icon: '🎁', label: '分享', onPress: handleGoToMyPage },
  ]

  // ── InputArea 提交(对齐 Uniapp handleSendMessageabc → 跳 ai_index2) ──
  // 携带选中模型信息(对齐 Uniapp modelType/modelName/modelId 跳参),未选模型时仅传 title
  const handleInputSubmit = (text: string): void => {
    setInputValue('')
    rootNav?.navigate('Chat', {
      title: text,
      modelName: selectedModel?.name,
      modelId: selectedModel?.id,
    })
  }

  // ── 模型类型按钮(对齐 Uniapp handleModelTypeClick / toggleSkillsPopup / toggleMaterialPopup) ──
  /** 点击类型按钮:同类型再点收起(对齐 Uniapp 第二次点击收起),不同类型切换 activeModelType 弹 Modal */
  const handleModelTypePress = (type: ModelType): void => {
    setActiveModelType((prev) => (prev === type ? null : type))
  }
  /** 关闭 Modal(对齐 Uniapp 互斥关闭其他弹窗) */
  const closeModelModal = (): void => setActiveModelType(null)
  /** 选择模型(对齐 Uniapp modelList selectModel → 设置 modelName/modelNameEN/modelId 后关闭弹窗) */
  const handleModelSelect = (ids: string[]): void => {
    if (!activeModelType || ids.length === 0) return
    const found = PLACEHOLDER_MODELS[activeModelType]
      .flatMap((g) => g.models)
      .find((m) => m.id === ids[0])
    if (!found) return
    setSelectedModel({ type: activeModelType, id: found.id, name: found.name })
    setActiveModelType(null)
  }
  /** 清除已选模型(对齐 Uniapp 切换类型时清空 modelName) */
  const handleClearModel = (): void => setSelectedModel(null)

  // ── RecentAgents 点击(对齐 Uniapp pitchHandlea → /pages/tools/ai_assistant) ──
  const handleRecentAgentPress = (item: RecentAgentItem): void => {
    rootNav?.navigate('AiAssistant', { agentId: item.id, title: item.name })
  }

  /** Carousel 轮播 banner(对齐 Uniapp 首页轮播图) */
  const bannerItems: CarouselItem[] = useMemo(
    () =>
      recommends.slice(0, 5).map((r) => ({
        img: '',
        title: r.title,
        link: r.id,
      })),
    [recommends],
  )

  /** CardWithList 推荐课程横向列表(对齐 Uniapp 首页推荐区) */
  const cardItems: CardWithListItem[] = useMemo(
    () =>
      recommends.slice(0, 6).map((r) => ({
        id: r.id,
        title: r.title,
        subtitle: r.instructor,
        icon: '📘',
      })),
    [recommends],
  )

  /** KnowledgePlanet 知识星球卡片数据(对齐 Uniapp 首页知识星球入口) */
  const knowledgeItems = useMemo(() => toKnowledgeItems(recommends), [recommends])

  /** PopularCourses 热门课程网格数据(对齐 Uniapp 首页热门课程区) */
  const popularCourseItems = useMemo(() => toPopularCourseItems(recommends), [recommends])

  /** AiModelCard AI 模型卡片(对齐 Uniapp 首页 AI 模型入口) */
  const aiModelData: AiModelData = {
    name: '智汇 AI 助手',
    subname: '智能问答 / 课程推荐',
    userType: 'freeuse',
    tags: ['免费', '热门'],
  }

  /** Toolbar 快捷工具栏(对齐 Uniapp 首页工具条) */
  const toolbarItems: ToolbarItem[] = [
    { key: 'search', icon: '🔍', onPress: () => rootNav?.navigate('Search') },
    { key: 'bookmark', icon: '🔖', onPress: () => rootNav?.navigate('Bookmark') },
    { key: 'history', icon: '🕘', onPress: () => rootNav?.navigate('History') },
    { key: 'share', icon: '📤', onPress: () => rootNav?.navigate('Share') },
  ]

  /** FunctionBlockColumn 点击路由映射 */
  const onFunctionBlockPress = (id: string) => {
    switch (id) {
      case 'distribution':
        rootNav?.navigate('Distribution')
        break
      case 'task':
        rootNav?.navigate('TaskCenter')
        break
      case 'checkin':
        rootNav?.navigate('CheckIn')
        break
      case 'ranking':
        rootNav?.navigate('Ranking')
        break
      default:
        // 未识别的入口 id,静默忽略(防御性:防止 FUNCTION_BLOCKS 配置漂移)
        break
    }
  }

  const load = async (refresh = false) => {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    setError('')
    const [courseRes, liveRes, progressRes] = await Promise.all([
      getCourses({ page: 1, pageSize: 6 }),
      getLiveList({ page: 1, pageSize: 3 }),
      getAllStudyProgress({ page: 1, pageSize: 3 }),
    ])
    if (courseRes.success) setRecommends(toRecommend(courseRes.data.list))
    if (liveRes.success) setLives(toLiveItem(liveRes.data.list))
    if (progressRes.success) setProgress(toProgressItem(progressRes.data.list))
    if (!courseRes.success && !liveRes.success && !progressRes.success) {
      setError(courseRes.error || liveRes.error || progressRes.error || t('common.networkError'))
    }
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const carouselItems = useMemo<CourseCarouselItem[]>(
    () => toCarouselItems(recommends),
    [recommends],
  )

  return (
    <View style={shellStyles.root}>
      {/* OfflineBanner 网络状态横条(对齐 Uniapp 离线提示) */}
      <OfflineBanner isOnline={connected} />
      {/* NavBar 顶部导航栏(对齐 Uniapp navigation-bars:标题"智汇AI社区"+菜单按钮+加入社区群)
       *  左按钮☰ 触发 Drawer(对齐 handleNavClick);右按钮🤝/🎁 对齐 join-click/share-image
       *  NavBar 置于 ScrollView 外,等价于 Uniapp viscosity=true 粘性效果(始终固定顶部) */}
      <NavBar
        title="智汇AI社区"
        leftActions={navLeftActions}
        rightActions={navRightActions}
      />
      <ScrollView style={shellStyles.scroll} contentContainerStyle={shellStyles.scrollContent}>
        {/* Carousel banner 轮播(对齐 Uniapp 首页轮播图) */}
        {bannerItems.length > 0 ? (
          <View style={shellStyles.carouselWrap}>
            <Carousel
              banner={bannerItems}
              onItemPress={(item) => {
                if (item.link) navigation.navigate('CourseDetail', { id: item.link })
              }}
            />
          </View>
        ) : null}
        <CourseCarousel
          courses={carouselItems}
          onPress={(id) => navigation.navigate('CourseDetail', { id })}
        />
        {/* Toolbar 快捷工具栏(对齐 Uniapp 首页工具条) */}
        <View style={shellStyles.toolbarWrap}>
          <Toolbar items={toolbarItems} separators={['history']} />
        </View>
        {/* CardWithList 推荐课程横向列表(对齐 Uniapp 首页推荐区) */}
        {cardItems.length > 0 ? (
          <View style={shellStyles.cardListWrap}>
            <CardWithList
              title="推荐课程"
              items={cardItems}
              onItemClick={(id) => navigation.navigate('CourseDetail', { id })}
            />
          </View>
        ) : null}
        {/* AiModelCard AI 模型卡片(对齐 Uniapp 首页 AI 模型入口) */}
        <View style={shellStyles.aiModelWrap}>
          <AiModelCard
            data={aiModelData}
            onPress={() => rootNav?.navigate('Chat', {})}
          />
        </View>
        {/* RecentAgents 最近使用智能体(对齐 Uniapp ai_index AgentList 横向列表)
         *  空数组占位待 API 接入(对齐 AgentScreen 同款占位策略);
         *  点击跳 AiAssistant(对齐 Uniapp pitchHandlea → /pages/tools/ai_assistant) */}
        {recentAgents.length > 0 ? (
          <View style={shellStyles.sectionWrap}>
            <RecentAgents items={recentAgents} onItemClick={handleRecentAgentPress} />
          </View>
        ) : null}
        <SharedHomeScreen
          t={t}
          userNickname={user?.nickname || user?.phone || ''}
          connected={connected}
          unreadCount={unreadCount}
          recommends={recommends}
          lives={lives}
          progress={progress}
          menuItems={MENU_ITEMS}
          loading={loading}
          refreshing={refreshing}
          error={error}
          onRefresh={() => load(true)}
          onOpenNotifications={() => setVisible(true)}
          onPressProgress={(courseId) => navigation.navigate('CourseDetail', { id: courseId })}
          onPressLive={(id) => navigation.navigate('LiveDetail', { id })}
          onPressCourse={(id) => navigation.navigate('CourseDetail', { id })}
          onPressMenu={(key) => {
            switch (key) {
              case 'Search':
                rootNav?.navigate('Search')
                break
              case 'History':
                rootNav?.navigate('History')
                break
              case 'Bookmark':
                rootNav?.navigate('Bookmark')
                break
              case 'CourseFilter':
                rootNav?.navigate('CourseFilter')
                break
              case 'LiveList':
                rootNav?.navigate('LiveList')
                break
              case 'LivePlaybackList':
                rootNav?.navigate('LivePlaybackList')
                break
              case 'CourseAnnex':
                rootNav?.navigate('CourseAnnex')
                break
              case 'CourseResource':
                rootNav?.navigate('CourseResource')
                break
              case 'CourseQAList':
                rootNav?.navigate('CourseQAList')
                break
              default:
                // 未识别的菜单 key,静默忽略(防御性:防止菜单配置漂移)
                break
            }
          }}
          onNavigateCourses={() => tabNav?.navigate('course')}
          onNavigateLives={() => tabNav?.navigate('live')}
        />
        {/* KnowledgePlanet 知识星球卡片列表(对齐 Uniapp 首页知识星球入口) */}
        {knowledgeItems.length > 0 ? (
          <View style={shellStyles.sectionWrap}>
            <MoreTitles title="知识星球" />
            <KnowledgePlanet
              items={knowledgeItems}
              onItemClick={(id) => navigation.navigate('CourseDetail', { id })}
            />
          </View>
        ) : null}
        {/* PopularCourses 热门课程 2 列网格(对齐 Uniapp 首页热门课程区) */}
        {popularCourseItems.length > 0 ? (
          <View style={shellStyles.sectionWrap}>
            <PopularCourses
              courses={popularCourseItems}
              title="热门课程"
              subtitle="精选好课 0 元学"
              onPress={(id) => navigation.navigate('CourseDetail', { id })}
            />
          </View>
        ) : null}
        {/* FunctionBlockColumn 功能块列(对齐 Uniapp 首页功能入口) */}
        <View style={shellStyles.sectionWrap}>
          <MoreTitles title="功能入口" />
          <FunctionBlockColumn blocks={FUNCTION_BLOCKS} onBlockPress={onFunctionBlockPress} />
        </View>
        {/* BottomFigure 底部装饰图(对齐 Uniapp 首页底部装饰) */}
        <View style={shellStyles.bottomFigureWrap}>
          <BottomFigure />
        </View>
      </ScrollView>
      {/* ModelTypeBar 模型类型选择栏(对齐 Uniapp BottomActionBar 8 种 model-type-btn 行 44-97)
       *  横向 ScrollView 8 个图标按钮;点击同类型收起、不同类型切换(对齐 handleModelTypeClick 互斥)
       *  selectedModel 显示为输入区小标签(对齐 Uniapp modelName 显示) */}
      <View style={shellStyles.modelTypeBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {MODEL_TYPES.map((opt) => {
            const active = activeModelType === opt.type
            return (
              <TouchableOpacity
                key={opt.type}
                style={[
                  shellStyles.modelTypeBtn,
                  active ? shellStyles.modelTypeBtnActive : null,
                ]}
                onPress={() => handleModelTypePress(opt.type)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={opt.label}
              >
                <Text style={shellStyles.modelTypeIcon}>{opt.icon}</Text>
                <Text
                  style={[
                    shellStyles.modelTypeLabel,
                    active ? shellStyles.modelTypeLabelActive : null,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            )
          })}
        </ScrollView>
        {selectedModel ? (
          <View style={shellStyles.selectedChip}>
            <Text style={shellStyles.selectedChipText} numberOfLines={1}>
              {selectedModel.name}
            </Text>
            <Pressable
              onPress={handleClearModel}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="清除模型"
            >
              <Text style={shellStyles.selectedChipClose}>×</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
      {/* InputArea 底部输入区(对齐 Uniapp BottomActionBar 输入部分,固定底部)
       *  提交跳 Chat(对齐 Uniapp handleSendMessageabc → 跳 ai_index2) */}
      <InputArea
        value={inputValue}
        onChangeText={setInputValue}
        placeholder="请输入您的问题,或选择模型开始对话"
        onSubmit={handleInputSubmit}
      />
      {/* GlobalFloatBox 全局浮窗按钮(对齐 Uniapp App.vue 全局浮窗) */}
      <GlobalFloatBox
        onPromote={() => rootNav?.navigate('Promote')}
        onConsult={() => rootNav?.navigate('CustomerService')}
        onMore={() => rootNav?.navigate('Settings')}
      />
      {/* Drawer 侧滑抽屉(对齐 Uniapp DrawerComponent,由 NavBar 菜单按钮触发) */}
      <Drawer
        visible={drawerVisible}
        onClose={closeDrawer}
        user={drawerUser}
        conversations={[]}
        onNavigate={handleDrawerNavigate}
        onNavigateExtra={handleNavigateExtra}
        onNavigateCompany={handleDrawerNavigateCompany}
        onClaimFree={handleDrawerClaimFree}
        onCreateNewChat={handleDrawerCreateNewChat}
        onSelectConversation={handleDrawerSelectConversation}
        onDeleteConversation={handleDrawerDeleteConversation}
        onOpenSettings={handleDrawerOpenSettings}
        onOpenMessages={handleDrawerOpenMessages}
        onGoHome={handleDrawerGoHome}
      />
      {/* FloatBox toast(对齐 Uniapp uni.showToast 顶部悬浮提示) */}
      <FloatBox visible={toastVisible} type={toastType} message={toastMessage} onHide={hideToast} />
      {/* ModelList Modal(对齐 Uniapp showModelList → ModelList 弹窗,选模型后填充输入区)
       *  共享组件:RN 内置 Modal + ModelList;底部 sheet 风格(对齐 BottomPopup 同款) */}
      <Modal
        visible={activeModelType !== null}
        transparent
        animationType="slide"
        onRequestClose={closeModelModal}
        statusBarTranslucent
      >
        <View style={shellStyles.modelModalBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={closeModelModal}
            accessibilityLabel="关闭模型列表"
          />
          <View style={shellStyles.modelModalSheet}>
            <View style={shellStyles.modelModalHeader}>
              <Text style={shellStyles.modelModalTitle} numberOfLines={1}>
                {activeModelType
                  ? MODEL_TYPES.find((m) => m.type === activeModelType)?.label ?? ''
                  : ''}
                {' 模型选择'}
              </Text>
              <Pressable
                onPress={closeModelModal}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="关闭"
              >
                <Text style={shellStyles.modelModalClose}>×</Text>
              </Pressable>
            </View>
            {activeModelType ? (
              <ModelList
                groups={PLACEHOLDER_MODELS[activeModelType]}
                selectionMode="single"
                selectedIds={
                  selectedModel?.type === activeModelType ? [selectedModel.id] : []
                }
                onSelectChange={handleModelSelect}
              />
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  )
}

const shellStyles = {
  root: { flex: 1 } as const,
  scroll: { flex: 1 } as const,
  scrollContent: { paddingBottom: 16 } as const,
  carouselWrap: { marginBottom: 8 } as const,
  toolbarWrap: { paddingHorizontal: 10, paddingVertical: 8 } as const,
  cardListWrap: { paddingHorizontal: 10, paddingVertical: 8 } as const,
  aiModelWrap: { paddingHorizontal: 10, paddingVertical: 8 } as const,
  sectionWrap: { paddingHorizontal: 10, paddingVertical: 8 } as const,
  bottomFigureWrap: { paddingHorizontal: 10, paddingTop: 8, marginBottom: 10 } as const,
  // ── ModelTypeBar 模型类型选择栏(对齐 Uniapp model-type-btn 8 个) ──
  modelTypeBar: {
    backgroundColor: tokens.surface.card,
    borderTopWidth: 1,
    borderTopColor: tokens.border.light,
    paddingHorizontal: 8,
    paddingVertical: 6,
  } as const,
  modelTypeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 6,
    borderRadius: 16,
    backgroundColor: tokens.surface.muted,
  } as const,
  modelTypeBtnActive: {
    backgroundColor: tokens.brand.DEFAULT,
  } as const,
  modelTypeIcon: {
    fontSize: 14,
    marginRight: 4,
  } as const,
  modelTypeLabel: {
    fontSize: 12,
    color: tokens.text.secondary,
  } as const,
  modelTypeLabelActive: {
    color: tokens.surface.light,
    fontWeight: '600',
  } as const,
  // ── selectedChip 已选模型小标签(对齐 Uniapp modelName 显示) ──
  selectedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: tokens.purple.light,
  } as const,
  selectedChipText: {
    fontSize: 11,
    color: tokens.purple.DEFAULT,
    fontWeight: '600',
    maxWidth: 200,
  } as const,
  selectedChipClose: {
    fontSize: 14,
    lineHeight: 16,
    color: tokens.purple.DEFAULT,
    marginLeft: 6,
    fontWeight: '700',
  } as const,
  // ── ModelList Modal 弹窗(对齐 BottomPopup sheet 风格) ──
  modelModalBackdrop: {
    flex: 1,
    backgroundColor: tokens.overlay.modal,
    justifyContent: 'flex-end',
  } as const,
  modelModalSheet: {
    width: '100%',
    maxHeight: '70%',
    backgroundColor: tokens.surface.light,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 16,
    paddingBottom: 8,
  } as const,
  modelModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  } as const,
  modelModalTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: tokens.text.primary,
  } as const,
  modelModalClose: {
    fontSize: 22,
    lineHeight: 24,
    color: tokens.text.tertiary,
    fontWeight: '300',
    paddingHorizontal: 4,
  } as const,
}
