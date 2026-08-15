import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native'
import Clipboard from '@react-native-clipboard/clipboard'
import { SlidersHorizontal } from 'lucide-react-native'
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  fetchApi,
  getAllStudyProgress,
  getAgentCategories,
  getAgents,
  getCourses,
  getLiveList,
  type Agent,
  type AgentCategoryItem,
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
import type { AiModelData, ApiResult } from '@ihui/types'
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
import { Drawer, type DrawerExtraMenu, type DrawerTab } from '../components/Drawer'
import { InputArea } from '../components/InputArea'
import { VoiceInput } from '../components/VoiceInput'
import ModelList, { type ModelListGroup } from '../components/ModelList'
import { FloatBox, type FloatBoxType } from '../components/FloatBox'
import RecentAgents, { type RecentAgentItem } from '../components/RecentAgents'
// 对齐 Uniapp tools/index(AI应用商店):ai-list 智能体列表 + tagWrapShow 赛道分类弹层
import AgentList, { type AgentListItem } from '../components/AgentList'
import { FenLeiOverlay } from '../components/FenLeiOverlay'
import { useAuth } from '../context/AuthContext'
import { useNetwork } from '../context/NetworkContext'
import { useNotificationStore } from '../stores/notification'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { mainScreenForTab, type MainTabKey } from '../navigation/tab-utils'
import { formatShortDateTime } from '../utils/date-utils'

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>
type RootNav = NativeStackNavigationProp<RootStackParamList>

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
        {
          id: 'agent-default',
          name: '通用智能体',
          description: '通用问答 Agent',
          icon: '🤖',
          isFree: true,
        },
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
        {
          id: 'img-sdxl',
          name: 'SDXL 图像',
          description: '高质量图像生成',
          icon: '🎨',
          isFree: false,
        },
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
        {
          id: 'va-default',
          name: '视音合成',
          description: '视频音频一体化',
          icon: '🎤',
          isFree: false,
        },
      ],
    },
  ],
  other: [
    {
      vendor: '其他',
      models: [
        {
          id: 'other-default',
          name: '通用模型',
          description: '其他类型模型',
          icon: '⚙️',
          isFree: true,
        },
      ],
    },
  ],
  sck: [
    {
      vendor: '知识库',
      models: [
        {
          id: 'sck-default',
          name: '默认知识库',
          description: '通用知识库检索',
          icon: '📚',
          isFree: true,
        },
      ],
    },
  ],
}

// ── 对齐 Uniapp tools/index.vue(AI 应用商店)智能体列表相关 ──

/** 赛道分类 fallback(复用 AgentScreen 同款数据源口径:getAgentCategories 失败时兜底,避免弹层为空)
 *  第一层:agentCategory(赛道,首项"全公司" id='')—— 对应接口参数 agentCategory */
const AGENT_CATEGORY_FALLBACK: ReadonlyArray<AgentCategoryItem> = [
  { id: '', name: '全公司' },
  { id: 'tech', name: '技术' },
  { id: 'design', name: '设计' },
  { id: 'market', name: '市场' },
  { id: 'operation', name: '运营' },
]
/** 第二层:agentMainCategory(主分类,首项"全部" id='')—— 对应接口参数 agentMainCategory */
const AGENT_MAIN_CATEGORY_FALLBACK: ReadonlyArray<AgentCategoryItem> = [
  { id: '', name: '全部' },
  { id: 'writing', name: '写作' },
  { id: 'coding', name: '编程' },
  { id: 'office', name: '办公' },
  { id: 'learning', name: '学习' },
]

/** Agent → AgentListItem 映射(点赞数后端 Agent 无字段,省略由卡片显示 0 占位) */
function toAgentListItem(a: Agent): AgentListItem {
  return {
    id: a.id,
    name: a.name,
    avatar: a.avatar ?? undefined,
    description: a.description,
    category: a.category,
    isCollect: a.isFavorited,
    collectCount: a.favoriteCount,
    usageCount: a.useCount,
  }
}

/** 智能体收藏(对齐 Uniapp pay.js getAgentCollect:POST /cozeZhsApi/agents/collect,body {uuid, botId})
 *  api-client 暂无封装,按项目模式用 fetchApi 在本文件内定义 */
function postAgentCollect(uuid: string, botId: string): Promise<ApiResult<unknown>> {
  return fetchApi<unknown>('/cozeZhsApi/agents/collect', {
    method: 'POST',
    body: JSON.stringify({ uuid, botId }),
  })
}

/** 智能体点赞(对齐 Uniapp pay.js getAgentLike:POST /cozeZhsApi/agents/thumbs,body {uuid, botId}) */
function postAgentLike(uuid: string, botId: string): Promise<ApiResult<unknown>> {
  return fetchApi<unknown>('/cozeZhsApi/agents/thumbs', {
    method: 'POST',
    body: JSON.stringify({ uuid, botId }),
  })
}

export function HomeScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const { user } = useAuth()
  const { connected, unreadCount, setVisible } = useNotificationStore()
  // OfflineBanner 数据源:用 NetworkContext 的 fetch 探测(/api/health),而非 WebSocket 通知连接状态。
  // 通知 WS 断开 ≠ 网络断开(REST 数据仍可正常加载),语义必须区分。
  const { isOnline } = useNetwork()
  const [recommends, setRecommends] = useState<HomeRecommendItem[]>([])
  const [lives, setLives] = useState<HomeLiveItem[]>([])
  const [progress, setProgress] = useState<HomeProgressItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  /** 父级 RootStack 导航(用于跳转 Search/Chat/Promote 等 RootStack 路由) */
  const rootNav = navigation.getParent<RootNav>()

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

  /** RecentAgents 最近使用智能体(对齐 Uniapp tools/index RecentAgents)
   *  api-client 暂无 getAgentUseHistory(/agent/use/history)封装,降级取智能体列表前 5 条占位 */
  const [recentAgents, setRecentAgents] = useState<RecentAgentItem[]>([])

  // ── 对齐 Uniapp tools/index.vue:ai-list 智能体列表 + tagWrapShow 赛道分类弹层 ──
  const [agentItems, setAgentItems] = useState<AgentListItem[]>([])
  const [trackCategories, setTrackCategories] =
    useState<ReadonlyArray<AgentCategoryItem>>(AGENT_CATEGORY_FALLBACK)
  const [mainCategories, setMainCategories] = useState<ReadonlyArray<AgentCategoryItem>>(
    AGENT_MAIN_CATEGORY_FALLBACK,
  )
  const [fenleiVisible, setFenleiVisible] = useState(false)
  /** 选中的赛道(agentCategory,''=全公司,对齐 uniapp agentCategory_active) */
  const [selectedTrackId, setSelectedTrackId] = useState('')
  /** 选中的主分类(agentMainCategory,''=全部,对齐 uniapp fenlei_active_id) */
  const [selectedMainId, setSelectedMainId] = useState('')
  // ── toodown 返回顶部(对齐 Uniapp onPageScroll > 阈值显示,RN 端 >600 显示) ──
  const [showBackTop, setShowBackTop] = useState(false)
  const scrollRef = useRef<ScrollView>(null)

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
    const rnTab: MainTabKey = tab as MainTabKey
    rootNav?.navigate('Main', { screen: mainScreenForTab(rnTab) })
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
    rootNav?.navigate('Main', { screen: 'HomeMain' })
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
    rootNav?.navigate('Main', { screen: 'ProfileMain' })
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

  // VoiceInput 语音转文字回填(对齐 Uniapp ai_index2.vue 行 436-451/601-618 搜索输入区
  // :isVoiceInput + @toggle-voice-input:语音结果写入 prompt,随发送跳 Chat)
  const handleVoiceComplete = (text: string): void => {
    if (text) setInputValue(text)
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

  // ── RecentAgents 点击(对齐 Uniapp pitchHandlea → ai_assistant 对话页) ──
  const handleRecentAgentPress = (item: RecentAgentItem): void => {
    rootNav?.navigate('AiAssistantN8n', { agentId: item.id, title: item.name })
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

  // ── 智能体列表加载(对齐 Uniapp tools/index getAgentList:带赛道/主分类筛选) ──
  const loadAgentList = useCallback(async (trackId: string, mainId: string): Promise<void> => {
    const res = await getAgents({
      status: 'published',
      pageSize: 20,
      // buildQs 自动忽略空串,''=全公司/全部
      agentCategory: trackId,
      agentMainCategory: mainId,
    })
    if (res.success) {
      const list = (res.data.list ?? []).map(toAgentListItem)
      setAgentItems(list)
      // RecentAgents 降级数据源:无 getAgentUseHistory 接口,取列表前 5 条(对齐 uniapp slice(0,5))
      setRecentAgents(list.slice(0, 5).map((a) => ({ id: a.id, name: a.name, avatar: a.avatar })))
    }
  }, [])

  // ── 分类字典加载(对齐 Uniapp onShow categories(),失败 fallback 静态占位) ──
  const loadAgentCategories = useCallback(async (): Promise<void> => {
    const res = await getAgentCategories()
    if (res.success && res.data) {
      const track = Array.isArray(res.data.agentCategory) ? res.data.agentCategory : []
      const main = Array.isArray(res.data.agentMainCategory) ? res.data.agentMainCategory : []
      // 对齐 uniapp:赛道首项补"全公司"(id=''),主分类首项补"全部"
      setTrackCategories([{ id: '', name: '全公司' }, ...track])
      setMainCategories([{ id: '', name: '全部' }, ...main])
    }
  }, [])

  useEffect(() => {
    void loadAgentList(selectedTrackId, selectedMainId)
    void loadAgentCategories()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── 分类弹层确定(对齐 Uniapp handleItemClicks/fenlei_active_btn:清列表 + page=1 + 重新加载) ──
  const handleFenLeiConfirm = useCallback(
    (trackId: string, mainId: string): void => {
      setSelectedTrackId(trackId)
      setSelectedMainId(mainId)
      void loadAgentList(trackId, mainId)
    },
    [loadAgentList],
  )

  // ── 智能体卡片点击(对齐 Uniapp ai-list 点击 → ai_assistant 对话页) ──
  const handleAgentPress = useCallback(
    (id: string): void => {
      const agent = agentItems.find((a) => a.id === id)
      rootNav?.navigate('AiAssistantN8n', { agentId: id, title: agent?.name })
    },
    [agentItems, rootNav],
  )

  // ── 点赞/收藏(对齐 Uniapp getAgentLike/getAgentCollect:乐观更新,失败回滚提示) ──
  const toggleAgentReaction = useCallback(
    async (id: string, kind: 'like' | 'collect'): Promise<void> => {
      const uuid = user?.id
      if (!uuid) {
        showToast('info', '请先登录后再操作')
        return
      }
      const prev = agentItems
      // 乐观更新(对齐 uniapp 遍历 agentList 翻转 isThumbs/isCollect + 计数 ±1)
      setAgentItems((items) =>
        items.map((it) => {
          if (it.id !== id) return it
          if (kind === 'like') {
            const next = !it.isThumbs
            return {
              ...it,
              isThumbs: next,
              likeCount: Math.max(0, (it.likeCount ?? 0) + (next ? 1 : -1)),
            }
          }
          const nextCollect = !it.isCollect
          return {
            ...it,
            isCollect: nextCollect,
            collectCount: Math.max(0, (it.collectCount ?? 0) + (nextCollect ? 1 : -1)),
          }
        }),
      )
      try {
        const res =
          kind === 'like' ? await postAgentLike(uuid, id) : await postAgentCollect(uuid, id)
        if (!res.success) throw new Error(res.error || '操作失败')
        showToast('success', kind === 'like' ? '点赞成功' : '收藏成功')
      } catch {
        // 失败回滚
        setAgentItems(prev)
        showToast('error', kind === 'like' ? '点赞失败' : '收藏失败')
      }
    },
    [agentItems, user?.id, showToast],
  )
  const handleAgentLike = useCallback(
    (id: string): void => {
      void toggleAgentReaction(id, 'like')
    },
    [toggleAgentReaction],
  )
  const handleAgentCollect = useCallback(
    (id: string): void => {
      void toggleAgentReaction(id, 'collect')
    },
    [toggleAgentReaction],
  )

  // ── toodown 返回顶部(对齐 Uniapp handleToodownVisibility/backToTop,RN 端阈值 600) ──
  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>): void => {
    setShowBackTop(e.nativeEvent.contentOffset.y > 600)
  }, [])
  const backToTop = useCallback((): void => {
    scrollRef.current?.scrollTo({ y: 0, animated: true })
  }, [])

  const carouselItems = useMemo<CourseCarouselItem[]>(
    () => toCarouselItems(recommends),
    [recommends],
  )

  return (
    <View style={shellStyles.root}>
      {/* OfflineBanner 网络状态横条(对齐 Uniapp 离线提示) */}
      <OfflineBanner isOnline={isOnline} />
      {/* NavBar 顶部导航栏(对齐 Uniapp navigation-bars:标题"智汇AI社区"+菜单按钮+加入社区群)
       *  左按钮☰ 触发 Drawer(对齐 handleNavClick);右按钮🤝/🎁 对齐 join-click/share-image
       *  右侧追加分类按钮(对齐 Uniapp tools 页 showFenLei → tagWrapShow 赛道分类弹层)
       *  NavBar 置于 ScrollView 外,等价于 Uniapp viscosity=true 粘性效果(始终固定顶部) */}
      <NavBar
        title="智汇AI社区"
        leftActions={navLeftActions}
        rightActions={navRightActions}
        rightAction={
          <TouchableOpacity
            onPress={() => setFenleiVisible(true)}
            hitSlop={8}
            activeOpacity={0.6}
            accessibilityRole="button"
            accessibilityLabel="分类"
          >
            <SlidersHorizontal size={20} color={tokens.text.primary} />
          </TouchableOpacity>
        }
      />
      <ScrollView
        ref={scrollRef}
        style={shellStyles.scroll}
        contentContainerStyle={shellStyles.scrollContent}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
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
          <AiModelCard data={aiModelData} onPress={() => rootNav?.navigate('Chat', {})} />
        </View>
        {/* RecentAgents 最近使用智能体(对齐 Uniapp tools/index RecentAgents)
         *  数据源:无 getAgentUseHistory 接口,降级取智能体列表前 5 条(loadAgentList 内更新);
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
          onNavigateCourses={() => rootNav?.navigate('Main', { screen: 'CourseMain' })}
          onNavigateLives={() => rootNav?.navigate('Main', { screen: 'LiveMain' })}
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
        {/* AgentList 智能体列表(对齐 Uniapp tools/index AI应用商店主体 ai-list,核心区块)
         *  卡片可点赞(getAgentLike)/收藏(getAgentCollect),点击跳 AiAssistant;
         *  scrollEnabled=false 嵌套外层 ScrollView,由页面整体滚动 */}
        <View style={shellStyles.agentListWrap}>
          <MoreTitles title="AI 应用商店" />
          <AgentList
            items={agentItems}
            onItemClick={handleAgentPress}
            onItemLike={handleAgentLike}
            onItemCollect={handleAgentCollect}
            emptyText="该分类下暂无智能体"
            scrollEnabled={false}
          />
        </View>
        {/* BottomFigure 底部装饰图(对齐 Uniapp 首页底部装饰) */}
        <View style={shellStyles.bottomFigureWrap}>
          <BottomFigure />
        </View>
      </ScrollView>
      {/* toodown 返回顶部悬浮按钮(对齐 Uniapp toodown:68rpx≈34dp 圆角8rpx≈4dp,样式对齐 SquareScreen)
       *  滚动 offsetY > 600 显示,点击 scrollTo 回顶 */}
      {showBackTop ? (
        <TouchableOpacity
          style={shellStyles.backToTop}
          onPress={backToTop}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="返回顶部"
        >
          <Text style={shellStyles.backToTopIcon}>{'↑'}</Text>
        </TouchableOpacity>
      ) : null}
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
                style={[shellStyles.modelTypeBtn, active ? shellStyles.modelTypeBtnActive : null]}
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
      {/* VoiceInput 语音输入(对齐 Uniapp ai_index2.vue 行 436/601 输入区 :isVoiceInput 语音模式,
          转文字回填输入框,随提交跳 Chat) */}
      <View style={shellStyles.voiceInputWrap}>
        <VoiceInput placeholder="按住说出你的问题" onComplete={handleVoiceComplete} />
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
      {/* FenLeiOverlay 赛道分类弹层(对齐 Uniapp tools/index tagWrapShow:NavBar 分类按钮触发)
       *  赛道(agentCategory)+ 主分类(agentMainCategory)两层单选,确定后过滤智能体列表 */}
      <FenLeiOverlay
        visible={fenleiVisible}
        onClose={() => setFenleiVisible(false)}
        trackCategories={trackCategories}
        mainCategories={mainCategories}
        selectedTrackId={selectedTrackId}
        selectedMainId={selectedMainId}
        onConfirm={handleFenLeiConfirm}
      />
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
                  ? (MODEL_TYPES.find((m) => m.type === activeModelType)?.label ?? '')
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
                selectedIds={selectedModel?.type === activeModelType ? [selectedModel.id] : []}
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
  // 语音输入行(对齐 Uniapp ai_index2.vue 输入区语音模式,置于底部 InputArea 上方)
  voiceInputWrap: { paddingHorizontal: 12, paddingVertical: 6 } as const,
  // 轮播(对齐 Uniapp custom-carousel-wrapper:margin 18rpx 0 0 0 ≈ marginTop:9 + 圆角 30rpx≈15)
  carouselWrap: { marginTop: 9, marginBottom: 8, borderRadius: 15, overflow: 'hidden' } as const,
  toolbarWrap: { paddingHorizontal: 10, paddingVertical: 8 } as const,
  cardListWrap: { paddingHorizontal: 10, paddingVertical: 8 } as const,
  aiModelWrap: { paddingHorizontal: 10, paddingVertical: 8 } as const,
  sectionWrap: { paddingHorizontal: 10, paddingVertical: 8 } as const,
  // 智能体列表区块(对齐 Uniapp tools/index ailist_content 主体区块)
  agentListWrap: { paddingVertical: 8 } as const,
  bottomFigureWrap: { paddingHorizontal: 10, paddingTop: 8, marginBottom: 10 } as const,
  // ── toodown 返回顶部按钮(对齐 Uniapp toodown:68rpx≈34dp 圆角8rpx≈4dp,样式对齐 SquareScreen) ──
  backToTop: {
    position: 'absolute',
    left: '50%',
    marginLeft: -17,
    bottom: 150,
    width: 34,
    height: 34,
    borderRadius: 4,
    backgroundColor: 'rgba(147, 210, 243, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: tokens.gray[900],
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  } as const,
  backToTopIcon: {
    fontSize: 20,
    color: tokens.text.primary,
    fontWeight: '600',
    includeFontPadding: false,
  } as const,
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
