// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import QrCodeImage from '../../assets/images/common/qewm.png'
import {
  ActivityIndicator,
  Image,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Clipboard from '@react-native-clipboard/clipboard'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as MediaLibrary from 'expo-media-library'
import * as ImagePicker from 'expo-image-picker'
import * as DocumentPicker from 'expo-document-picker'
import { Asset } from 'expo-asset'
import {
  BookOpen,
  Bot,
  Camera,
  Folder,
  SlidersHorizontal,
  Search,
  History,
  Bookmark,
  Target,
  Radio,
  Clapperboard,
  Paperclip,
  HelpCircle,
  Gift,
  CheckCircle2,
  Calendar,
  Trophy,
  Brain,
  MessageSquare,
  Image as ImageIcon,
  Music,
  Video,
  Settings,
  Palette,
  Film,
  Volume2,
  Mic,
  Handshake,
  MessageCircle,
} from 'lucide-react-native'
import { tokens } from '../theme/active-tokens'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  addFavorite,
  checkFavorite,
  claimShareFirstReward,
  deleteAgent,
  deleteFavorite,
  getActiveCarousels,
  getAllStudyProgress,
  getAgentCategories,
  getAgentDetail,
  getAgentUseHistory,
  getAgents,
  getCourses,
  getLiveList,
  getMyCreation,
  getMyCreationDetail,
  getShareFirstStatus,
  getTokenBalance,
  fetchModels,
  resolveFileUrl,
  uploadFileMultipart,
  type Agent,
  type AgentCategoryItem,
  type Course,
  type Live,
  type MyCreationItem,
  type MyCreationType,
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
import type { AiModelData, AppIcon } from '@ihui/types'
import { apiFailureToText, toUserFriendlyMessage } from '@ihui/shared/utils'
import Carousel from '../components/Carousel'
import { PanelLeftRounded } from '../components/PanelLeftRounded'
import CardWithList, { type CardWithListItem } from '../components/CardWithList'
import AiModelCard from '../components/AiModelCard'
import { KnowledgePlanet, type KnowledgePlanetItem } from '../components/KnowledgePlanet'
import PopularCourses, { type PopularCourse } from '../components/PopularCourses'
import { FunctionBlockColumn, type FunctionBlock } from '../components/FunctionBlockColumn'
import { ShareRewardDialog } from '../components/ShareRewardDialog'
import { ShareSheet } from '../components/ShareSheet'
import { SearchOverlay } from '../components/SearchOverlay'
import { BottomFigure, type BottomFigureItem } from '../components/BottomFigure'
import { MoreTitles } from '../components/MoreTitles'
// 对齐 Uniapp ai_index:复用共享组件 NavBar / Drawer / InputArea / FloatBox / RecentAgents
import { NavBar, type NavBarAction } from '../components/NavBar'
import { Drawer, type DrawerExtraMenu, type DrawerTab } from '../components/Drawer'
import { InputArea } from '../components/InputArea'
import { AddPanel } from '../components/AddPanel'
import { useVoiceRecorder } from '../hooks/use-voice-recorder'
import ModelList, { type ModelListGroup, type ModelListItem } from '../components/ModelList'
import MaterialList, {
  type MaterialCategory,
  type MaterialItem,
  type MaterialType,
} from '../components/MaterialList'
// 对齐 Uniapp toggleSkillsPopup → AgentList 智能体选择列表(技能弹窗真实数据源)
import AgentList, { type AgentListItem } from '../components/AgentList'
import ModelConfigDialog, {
  type ModelConfig,
  type ModelType as ConfigModelType,
} from '../components/ModelConfigDialog'
import { FloatBox, type FloatBoxType } from '../components/FloatBox'
import RecentAgents, { type RecentAgentItem } from '../components/RecentAgents'
// 对齐 Uniapp tools/index(AI应用商店):ai-list 智能体列表 + tagWrapShow 赛道分类弹层
import type { AgentShopItem } from '../components/AgentShopList'
import { FenLeiOverlay } from '../components/FenLeiOverlay'
// 对齐 Uniapp tools/index:MyAgents(我的AI APP)+ IntelligentAssistant(智汇值卡)
import MyAgents, { type MyAgentItem } from '../components/MyAgents'
import IntelligentAssistant from '../components/IntelligentAssistant'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useNotificationStore } from '../stores/notification'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { DRAWER_TAB_TO_RN_TAB, mainScreenForTab } from '../navigation/tab-utils'
import { formatShortDateTime } from '../utils/date-utils'
import { rpx } from '../utils/rpx'
import { inferVendor } from '../lib/vendor-infer'
// 底部导航(对齐原 customTabBar 5 主 Tab,HomeScreen 对应「首页」Tab)
import TabBar, { type TabBarKey } from '../components/TabBar'
import {
  glassBlurLayer,
  tabBarDockSpacer,
} from '../components/TabBar.styles'

import { rnRadius, rnRadiusFor } from '@ihui/design-tokens'
import { NavChrome } from '../components/NavChrome'

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>
type RootNav = NativeStackNavigationProp<RootStackParamList>

/** 社群二维码图片(对齐 Uniapp ai_index /static/images/qewm.png 二维码弹窗) */

/**
 * 「发现」区入口标签一律取目标页自己的 `<route>.title` —— 这 9 个命名空间与
 * `key`(路由名)同名,五语言在位。此前写的是 `menu.search` 等 9 个从未存在的键,
 * 界面直接回显键名;另立一份 `menu.*` 会让入口标签和页面标题变成两处真相。
 */
const MENU_ITEMS: HomeMenuItem[] = [
  { key: 'Search', labelKey: 'search.title', icon: Search },
  { key: 'History', labelKey: 'history.title', icon: History },
  { key: 'Bookmark', labelKey: 'bookmark.title', icon: Bookmark },
  { key: 'CourseFilter', labelKey: 'courseFilter.title', icon: Target },
  { key: 'LiveList', labelKey: 'liveList.title', icon: Radio },
  { key: 'LivePlaybackList', labelKey: 'livePlaybackList.title', icon: Clapperboard },
  { key: 'CourseAnnex', labelKey: 'courseAnnex.title', icon: Paperclip },
  { key: 'CourseResource', labelKey: 'courseResource.title', icon: BookOpen },
  { key: 'CourseQAList', labelKey: 'courseQAList.title', icon: HelpCircle },
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
    // 封面图透传(对齐 Course.cover,轮播 banner 用)
    cover: c.cover,
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
  { id: 'distribution', title: '分销中心', icon: Gift, description: '推广赚佣金' },
  { id: 'task', title: '任务中心', icon: CheckCircle2, description: '完成领奖励' },
  { id: 'checkin', title: '每日签到', icon: Calendar, description: '连续签到得好礼' },
  { id: 'ranking', title: '排行榜', icon: Trophy, description: '查看学习排名' },
]

// ── 对齐 Uniapp ai_index BottomActionBar 8 种 model-type-btn(行 44-97) ──
/** AI 模型类型(skills 技能 / talk 对话 / image 图片 / video 视频 / audio 音频 / videoa 视频音频 / other 其他 / sck 知识库) */
type ModelType = 'skills' | 'talk' | 'image' | 'video' | 'audio' | 'videoa' | 'other' | 'sck'

/** 模型类型按钮配置(对应 Uniapp model-type-btn:icon + label + active 态) */
interface ModelTypeOption {
  type: ModelType
  label: string
  icon: AppIcon | string
}

/** 当前选中的模型(对齐 Uniapp modelName/modelNameEN/modelId 三元组,简化为 type+id+name) */
interface SelectedModel {
  type: ModelType
  id: string
  name: string
}

/** 素材卡片(对齐 Uniapp materialCards:点击素材作为卡片插入输入区上方,uid 保证可重复添加/独立移除) */
interface MaterialCard {
  uid: string
  id: string
  title: string
  type: MaterialType
}

/** 8 种模型类型按钮(顺序与图标含义对齐 Uniapp ai_index 行 44-97) */
const MODEL_TYPES: ModelTypeOption[] = [
  { type: 'skills', label: '技能', icon: Brain },
  { type: 'talk', label: '对话', icon: MessageSquare },
  { type: 'image', label: '图片', icon: ImageIcon },
  { type: 'video', label: '视频', icon: Clapperboard },
  { type: 'audio', label: '音频', icon: Music },
  { type: 'videoa', label: '视音', icon: Video },
  { type: 'other', label: '其他', icon: Settings },
  { type: 'sck', label: '知识库', icon: BookOpen },
]

/**
 * 模型数字类型(0 其他/1 对话/2 图片/3 视频/4 音频/5 数字人,ModelListItem.type) →
 * 输入区分类 ModelType 的近似映射。仅用于「直接选模型面板」(无分类前置,2026-10-15
 * 对齐 web ModelSelector)回填 SelectedModel.type:提交链只送 name/id 不上送 type,
 * type 只影响选中高亮匹配与参数配置表单形态(toConfigModelType),近似即可。
 */
const NUMERIC_MODEL_TYPE_TO_MODEL_TYPE: Record<number, ModelType> = {
  0: 'other',
  1: 'talk',
  2: 'image',
  3: 'video',
  4: 'audio',
  5: 'other',
}

/**
 * 模型 category(与 web 同源字段,fetchModels /llm/models 透传)→ 弹窗分类 tab 映射,
 * 对齐 web normalizeCategory 语义;缺失兜底 chat(web 同款)。
 */
const MODEL_CATEGORY_TO_TAB: Readonly<Record<string, ModelType>> = {
  chat: 'talk',
  vision: 'talk',
  image: 'image',
  video: 'video',
  tts: 'audio',
  asr: 'audio',
  embedding: 'sck',
  rerank: 'sck',
  guard: 'other',
  ocr: 'other',
}

/** 代次档位 → 中文标签(模型行 description 用;空串=老后端无档位不显示) */
const MODEL_TIER_LABELS: Readonly<Record<string, string>> = {
  latest: '最新',
  standard: '标准',
  legacy: '历史',
}
/** 代次档位排序权重(组内 latest 在前,对齐 web MODEL_TIER_ORDER) */
const MODEL_TIER_ORDER: Readonly<Record<string, number>> = {
  latest: 0,
  standard: 1,
  legacy: 2,
}

/** 把 legacy 档模型收编进尾部「历史模型(N)」独立分组(数据级折叠:ModelList 分组标题
 *  字段 title 直承接住,不改共享组件;对齐 web 历史模型折叠语义)。
 *  收编行的 description 从档位标签换成厂商名 —— 分组标题不再承载厂商信息。
 *  非 legacy 分组保持原序;无 legacy 时原样返回。 */
function foldLegacyGroups(groups: ModelListGroup[]): ModelListGroup[] {
  const primary = groups
    .map((g) => ({ ...g, models: g.models.filter((m) => m.modelTier !== 'legacy') }))
    .filter((g) => g.models.length > 0)
  const legacy: ModelListItem[] = []
  for (const g of groups) {
    for (const m of g.models) {
      if (m.modelTier === 'legacy') legacy.push({ ...m, description: g.vendor ?? '' })
    }
  }
  return legacy.length > 0
    ? [...primary, { title: `历史模型 (${legacy.length})`, models: legacy }]
    : primary
}

/** 模型参数默认配置(对齐 Uniapp ModelConfigDialog 初始值) */
const DEFAULT_MODEL_CONFIG: ModelConfig = {
  temperature: 0.7,
  maxTokens: 2048,
  topP: 0.9,
  systemPrompt: '',
  streamEnabled: true,
}

/** 本屏 ModelType → ModelConfigDialog 期望的 ModelConfigType(对齐 ui-native ModelConfigType) */
const toConfigModelType = (t: ModelType): ConfigModelType => {
  switch (t) {
    case 'image':
      return 'image'
    case 'video':
    case 'videoa':
      return 'video'
    case 'audio':
      return 'audio'
    default:
      return 'text'
  }
}

/** 素材分类(对齐 Uniapp MaterialList 分类 tab:全部/文本/图片/视频/音频) */
const MATERIAL_CATEGORIES: MaterialCategory[] = [
  { key: 'all', label: '全部' },
  { key: 'text', label: '文本' },
  { key: 'image', label: '图片' },
  { key: 'video', label: '视频' },
  { key: 'audio', label: '音频' },
]

/** 素材分类 tab → getMyCreation API type(对齐 Uniapp getMaterialApiType:
 *  agent=智能体创作(文本)/plugin=插件(图片)/workflow=工作流(视频);audio 无对应类型 → null 空态) */
const materialApiTypeForCategory = (key: string): MyCreationType | null => {
  switch (key) {
    case 'all':
    case 'text':
      return 'agent'
    case 'image':
      return 'plugin'
    case 'video':
      return 'workflow'
    case 'audio':
      return null
    default:
      return null
  }
}

/** 安全读取 MyCreationItem 索引字段([key:string]: unknown 索引签名,强类型化避免 any) */
const strField = (it: MyCreationItem, key: string): string => {
  const v: unknown = it[key]
  return typeof v === 'string' ? v : ''
}

/** MyCreationItem → MaterialItem(对齐 Uniapp loadMaterialContent 各 tab 字段映射:
 *  agent=文本(text 预览)/plugin=图片(agentUrl 缩略图)/workflow=视频(poster/cover 缩略图))
 *  注意:agents 表主键为 agentId(非 id),删除接口 DELETE /agents/:agentId 需要 agentId,
 *  故 agent 条目优先取 agentId 字段,workflow/plugin 才回退到 id */
const mapMyCreationItem = (it: MyCreationItem, category: string): MaterialItem => {
  const id = strField(it, 'agentId') || it.id
  if (category === 'image') {
    return {
      id,
      title: it.name || '图片内容',
      type: 'image' as const,
      url: strField(it, 'agentUrl') || strField(it, 'url') || undefined,
      createdAt: it.createdAt,
    }
  }
  if (category === 'video') {
    return {
      id,
      title: it.name || '视频内容',
      type: 'video' as const,
      url:
        strField(it, 'posterUrl') ||
        strField(it, 'coverUrl') ||
        strField(it, 'thumbnail') ||
        strField(it, 'agentUrl') ||
        strField(it, 'url') ||
        undefined,
      createdAt: it.createdAt,
    }
  }
  return {
    id,
    title: it.name || '文本内容',
    type: 'text' as const,
    text: it.description ?? '',
    createdAt: it.createdAt,
  }
}

/** 素材详情通用字段展示定义(agent/workflow/plugin 三类型字段并集,仅展示存在且有值的字段) */
const MATERIAL_DETAIL_FIELDS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'name', label: '名称' },
  { key: 'displayName', label: '显示名' },
  { key: 'description', label: '描述' },
  { key: 'status', label: '状态' },
  { key: 'author', label: '作者' },
  { key: 'version', label: '版本' },
  { key: 'category', label: '分类' },
  { key: 'createdBy', label: '创建者' },
  { key: 'createdAt', label: '创建时间' },
  { key: 'updatedAt', label: '更新时间' },
]

/** 详情字段值 → 展示文本(boolean/对象转字符串;null/undefined/空串返回 '' 隐藏) */
const formatDetailValue = (v: unknown): string => {
  if (v === null || v === undefined || v === '') return ''
  if (typeof v === 'boolean') return v ? '是' : '否'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

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
          icon: Bot,
          isFree: true,
        },
      ],
    },
  ],
  talk: [
    {
      vendor: '文本模型',
      models: [
        {
          id: 'talk-gpt',
          name: 'GPT 对话',
          description: '通用文本对话',
          icon: MessageSquare,
          isFree: true,
        },
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
          icon: Palette,
          isFree: false,
        },
      ],
    },
  ],
  video: [
    {
      vendor: '视频生成',
      models: [
        { id: 'vid-sora', name: 'Sora 视频', description: '文生视频', icon: Film, isFree: false },
      ],
    },
  ],
  audio: [
    {
      vendor: '语音模型',
      models: [
        { id: 'aud-tts', name: 'TTS 语音', description: '文本转语音', icon: Volume2, isFree: true },
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
          icon: Mic,
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
          icon: Settings,
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
          icon: BookOpen,
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

/** Agent → AgentShopItem 映射(点赞数后端 Agent 无字段,省略由卡片显示 0 占位) */
function toAgentShopItem(a: Agent): AgentShopItem {
  return {
    id: a.id,
    name: a.name,
    avatar: a.avatar ?? undefined,
    description: a.description,
    tags: a.tags?.length ? a.tags : undefined,
    isCollect: a.isFavorited,
    collectCount: a.favoriteCount,
    usageCount: a.useCount,
  }
}

/** AgentShopItem → AgentListItem 映射(技能弹窗复用 AgentList,字段契约逐一对齐;tags 不入列表) */
function toAgentListItem(a: AgentShopItem): AgentListItem {
  return {
    id: a.id,
    name: a.name,
    avatar: a.avatar,
    isNew: a.isNew,
    description: a.description,
    type: a.type,
    source: a.source,
    isCollect: a.isCollect,
    isThumbs: a.isThumbs,
    collectCount: a.collectCount,
    likeCount: a.likeCount,
    usageCount: a.usageCount,
    isHot: a.isHot,
    userNickname: a.userNickname,
    userAvatar: a.userAvatar,
  }
}

/** Local do-not-disturb flag for the first-share reward popup (timestamp string). */
const SHARE_FIRST_DISMISSED_KEY = 'share_first_dismissed'

/** Read local do-not-disturb flag; false on missing/unreadable (silent downgrade). */
async function readShareFirstDismissed(): Promise<boolean> {
  try {
    const raw: string | null = await AsyncStorage.getItem(SHARE_FIRST_DISMISSED_KEY)
    return raw !== null
  } catch {
    return false
  }
}

/** Persist local do-not-disturb flag; silent downgrade on failure. */
async function persistShareFirstDismissed(): Promise<void> {
  try {
    await AsyncStorage.setItem(SHARE_FIRST_DISMISSED_KEY, String(Date.now()))
  } catch {
    // Silent downgrade: keep original behavior, never crash.
  }
}

/** AiModelCard 收藏资源标识(品牌主推卡固定资源;resourceType='agent' 已入后端枚举,2026-10-15) */
const ASSISTANT_FAVORITE = { resourceType: 'agent' as const, resourceId: 'zhihui-ai-assistant' }

export function HomeScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const { user, token } = useAuth()
  const { resolvedTheme } = useTheme()
  const { connected, unreadCount, setVisible } = useNotificationStore()
  // 离线横条由 App.tsx 全局挂载(见该处 OfflineBanner);此处曾另挂一份,
  // 断网时同屏叠两条,且它是普通流节点,会把整屏内容再往下推。
  const [recommends, setRecommends] = useState<HomeRecommendItem[]>([])
  const [lives, setLives] = useState<HomeLiveItem[]>([])
  const [progress, setProgress] = useState<HomeProgressItem[]>([])
  // 置顶轮播运营数据(GET /api/carousels?position=home);空/失败时 BottomFigure 回退内置默认图
  const [carouselList, setCarouselList] = useState<BottomFigureItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  /** 父级 RootStack 导航(用于跳转 Search/Chat/Promote 等 RootStack 路由) */
  const rootNav = navigation.getParent<RootNav>()

  /** 底部 Tab 切换(对齐原 customTabBar 5 主 Tab;广场/动态为 RootStack 独立路由) */
  const handleTabChange = (key: TabBarKey): void => {
    switch (key) {
      case 'aiShop':
        rootNav?.navigate('Main', { screen: 'AiMain' })
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
      case 'home':
        break // 当前 Tab
    }
  }

  // ── 对齐 Uniapp ai_index:NavBar 菜单按钮触发 Drawer ──
  const [drawerVisible, setDrawerVisible] = useState(false)
  // ── 二维码弹窗(对齐 Uniapp ai_index showQrCodeModal;图片 assets/images/common/qewm.png) ──
  const [qrCodeVisible, setQrCodeVisible] = useState(false)
  // 分享面板(2026-10-15:导航栏「分享」从跳我的页改为弹微信分享面板,产品定)
  const [shareSheetVisible, setShareSheetVisible] = useState(false)
  // 搜索弹层(2026-10-15 用户定:顶栏搜索按钮与 web 端一致 —— 弹窗形态,弹窗内直接出结果;
  // 三处入口(NavBar 搜索钮 / 九宫格「搜索」/ AgentScreen 顶栏钮)统一开同一个 SearchOverlay)
  const [searchOverlayVisible, setSearchOverlayVisible] = useState(false)
  // ── FloatBox toast(对齐 Uniapp uni.showToast 顶部悬浮提示,替代阻塞式 Alert) ──
  const [toastVisible, setToastVisible] = useState(false)
  const [toastType, setToastType] = useState<FloatBoxType>('info')
  const [toastMessage, setToastMessage] = useState('')
  // ── InputArea 底部输入区(对齐 Uniapp BottomActionBar 输入部分) ──
  const [inputValue, setInputValue] = useState('')
  // ── 模型选择(对齐 web ModelSelector:输入区模型钮 → 同一弹窗,弹窗内 8 分类 tab 切换) ──
  // selectedModel:已选模型(显示在输入区小标签)
  const [selectedModel, setSelectedModel] = useState<SelectedModel | null>(null)
  // 真实模型列表(fetchModels,按 provider 分组;加载成功替换 PLACEHOLDER_MODELS 占位样例)
  const [realModelGroups, setRealModelGroups] = useState<ModelListGroup[]>([])
  // ── 模型参数配置弹窗(对齐 Uniapp ai_index showModelaConfig → ModelConfigDialog) ──
  const [showModelConfig, setShowModelConfig] = useState(false)
  // 模型选择弹窗(2026-10-15 用户定:弹窗内顶部横向分类 tab,点击切换对应分类模型列表)
  const [showModelSelect, setShowModelSelect] = useState(false)
  /** 弹窗内当前分类 tab(打开时按已选模型类型预选,默认「对话」) */
  const [modelModalTab, setModelModalTab] = useState<ModelType>('talk')
  /** 弹窗内搜索词(非空时跨全部分类搜索模型名/厂商,web ModelSelector 同语义) */
  const [modelSearch, setModelSearch] = useState('')
  /** 搜索框展开态(头部右侧图标开关;收起时清空搜索词) */
  const [showModelSearch, setShowModelSearch] = useState(false)
  const [modelConfig, setModelConfig] = useState<ModelConfig>(DEFAULT_MODEL_CONFIG)
  // ── 素材列表弹窗(对齐 Uniapp ai_index showMaterialList → MaterialList「我的创作」) ──
  // 数据源:getMyCreation,按分类映射 agent/plugin/workflow(对齐 Uniapp getMyCreation → /agent/creation/my/:type)
  const [showMaterialList, setShowMaterialList] = useState(false)
  const [activeMaterialCategory, setActiveMaterialCategory] = useState('all')
  const [materialItems, setMaterialItems] = useState<MaterialItem[]>([])
  const [materialLoading, setMaterialLoading] = useState(false)
  // ── 素材详情弹窗(点击列表项「详情」按钮 → getMyCreationDetail 按类型查询单条) ──
  const [materialDetailItem, setMaterialDetailItem] = useState<MaterialItem | null>(null)
  const [materialDetailLoading, setMaterialDetailLoading] = useState(false)
  const [materialDetailData, setMaterialDetailData] = useState<Record<string, unknown> | null>(null)
  const [materialDetailError, setMaterialDetailError] = useState<string>('')
  // ── 素材卡片(对齐 Uniapp materialCards:点击素材插入输入区上方,每卡右上 × 移除) ──
  const [materialCards, setMaterialCards] = useState<MaterialCard[]>([])
  // ── 分享领智汇值弹窗(对齐 Uniapp ai_index showSharePointsPopup:onShow 自动检查首次分享奖励) ──
  const [rewardDialogVisible, setrewardDialogVisible] = useState(false)
  const [shareFirstReward, setShareFirstReward] = useState(0)

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

  /** MyAgents 我的AI APP(对齐 Uniapp tools/index MyAgents.vue)
   *  数据源:与 agentItems 同源(loadAgentList 填充后取前 6 条),点击跳 AiAssistantN8n */
  const [myAgents, setMyAgents] = useState<MyAgentItem[]>([])

  /** IntelligentAssistant 智汇值卡(对齐 Uniapp Intelligent-assistant.vue;数据源 getTokenBalance) */
  const [tokenQuantity, setTokenQuantity] = useState(0)

  // ── 对齐 Uniapp tools/index.vue:ai-list 智能体列表 + tagWrapShow 赛道分类弹层 ──
  const [agentItems, setAgentItems] = useState<AgentShopItem[]>([])
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

  // ── 底部玻璃停靠区(2026-10-16 用户定稿:整个底部菜单栏液态玻璃,内容若隐若现)──
  // 输入区 + 底部导航整块绝对定位悬浮;ScrollView 预留 = 停靠区实测高度 + 呼吸距。
  // 首帧用估值兜底(输入区约 104dp + 胶囊让位区),onLayout 后按实测校正。
  const insets = useSafeAreaInsets()
  const [dockHeight, setDockHeight] = useState(
    104 + tabBarDockSpacer(insets.bottom),
  )

  // ── Drawer 回调(对齐 Uniapp gopage / gotocompany / lingqu / addNewChat) ──
  const closeDrawer = (): void => setDrawerVisible(false)
  const handleDrawerNavigate = (tab: DrawerTab): void => {
    // square/share 是 RootStack 路由(Uniapp: 广场/动态)
    if (tab === 'square') {
      rootNav?.navigate('Plaza')
      return
    }
    if (tab === 'share') {
      rootNav?.navigate('News')
      return
    }
    // home/ai/mine 是 Tab 路由(Uniapp: AI 对话社区/AI 应用/我的)
    // DrawerTab('mine'等)必须先映射成 RN Tab 路由名('ProfileMain'),直接 cast 会静默跳转失败
    rootNav?.navigate('Main', { screen: mainScreenForTab(DRAWER_TAB_TO_RN_TAB[tab]) })
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
      case 'assistant':
        rootNav?.navigate('Assistant')

        break

      case 'tools':
        rootNav?.navigate('AiAssistantN8n', {})
        break
      default:
        // 未识别的扩展菜单,静默忽略(防御性:防止 EXTRA_MENUS 配置漂移)
        break
    }
  }

  // ── NavBar 按钮回调(对齐 Uniapp navigation-bars 事件) ──
  /** 菜单按钮:打开 Drawer(对齐 Uniapp handleNavClick → tagWrapShow = true) */
  const handleMenuPress = (): void => setDrawerVisible(true)
  /** 加入社区群:显示二维码弹窗(对齐 Uniapp join-click → showQrCodeModal = true;
   *  图片资源 assets/images/common/qewm.png,长按保存到相册) */
  const handleJoinPress = (): void => setQrCodeVisible(true)
  /** 长按二维码:保存到相册(对齐 Uniapp handleLongPressQrCode → saveQrCodeToAlbum) */
  const handleLongPressQrCode = async (): Promise<void> => {
    try {
      const perm = await MediaLibrary.requestPermissionsAsync()
      if (!perm.granted) {
        showToast('warning', '需要相册权限才能保存')
        return
      }
      const localAsset = Asset.fromModule(QrCodeImage)
      await localAsset.downloadAsync()
      const asset = await MediaLibrary.createAssetAsync(localAsset.localUri ?? localAsset.uri)
      await MediaLibrary.saveToLibraryAsync(asset.uri)
      showToast('success', '已保存到相册')
    } catch {
      showToast('warning', '保存失败,请重试')
    }
  }
  /** NavBar 左右按钮配置(对齐 Uniapp navigation-bars:菜单 + 搜索 + 加入社区群 + 分享)
   *  搜索按钮(2026-10-15 用户定):与 web 端一致改纯图标(去文字,a11yLabel 保语义)+
   *  点击开 SearchOverlay 弹窗(遮罩 + 三段面板,弹窗内直接出结果,不再跳全屏搜索页;
   *  RootStack 'Search' 路由保留)
   *  间距对齐:Uniapp padding 0 24rpx ≈ 12dp(NavBar 内部已实现 paddingHorizontal: rpx(24))
   *  分享按钮(2026-10-15 产品定):原对齐 Uniapp share-image → goToMyPage 跳我的页,
   *  改为弹微信分享面板 ShareSheet(微信好友/朋友圈原生分享 + 复制链接兜底) */
  const navLeftActions: ReadonlyArray<NavBarAction> = [
    { icon: PanelLeftRounded, a11yLabel: '菜单', onPress: handleMenuPress },
  ]
  const navRightActions: ReadonlyArray<NavBarAction> = [
    { icon: Search, a11yLabel: t('common.search'), onPress: () => setSearchOverlayVisible(true) },
    { icon: Handshake, label: '加入群', onPress: handleJoinPress },
    { icon: Gift, label: '分享', onPress: () => setShareSheetVisible(true) },
  ]

  // ── InputArea 提交(对齐 Uniapp handleSendMessageabc → 跳 ai_index2) ──
  // 携带选中模型信息(对齐 Uniapp modelType/modelName/modelId 跳参),未选模型时仅传 title
  // 2026-10-16:改走 autoSendPrompt —— ChatScreen 只消费该字段(原 title 预留给后续接入,
  // 首页输入的文字此前落不到会话里);登录/VIP/流式校验在 send() 内,不新造调用链。
  const handleInputSubmit = (text: string): void => {
    setInputValue('')
    rootNav?.navigate('Chat', {
      autoSendPrompt: text,
      modelName: selectedModel?.name,
      modelId: selectedModel?.id,
    })
  }

  /**
   * 2026-10-16 录音消息:首页大输入框长按录音 → 松手上传 → 跳 Chat 带 autoSendVoice,
   * 由 ChatScreen 作为首条用户消息发出(语音气泡,可回听)。
   * 上传走 uploadFileMultipart(后端白名单已开 m4a);失败 toast,不跳转。
   */
  const handleVoiceRecorded = useCallback(
    async (uri: string, durationSec: number): Promise<void> => {
      try {
        const up = await uploadFileMultipart({
          uri,
          type: 'audio/m4a',
          name: `voice-${Date.now()}.m4a`,
        })
        if (up.success && up.data?.path) {
          rootNav?.navigate('Chat', {
            autoSendVoice: { url: resolveFileUrl(up.data.path), durationSec },
            modelName: selectedModel?.name,
            modelId: selectedModel?.id,
          })
        } else {
          showToast('warning', '语音上传失败,请重试')
        }
      } catch {
        showToast('warning', '语音上传失败,请重试')
      }
    },
    [rootNav, selectedModel?.name, selectedModel?.id, showToast],
  )
  // 麦克风不可用反馈(2026-10-15:useVoiceRecorder 原先失败路径静默,web 预览长按无任何提示)
  const handleVoiceUnavailable = useCallback(
    (reason: 'permission-denied' | 'record-failed'): void => {
      showToast(
        'warning',
        reason === 'permission-denied' ? '无法访问麦克风,请检查权限设置' : '录音启动失败,请重试',
      )
    },
    [showToast],
  )
  // 2026-10-16:原始录音模式(transcribe=false)—— 松手走 onRecorded 上传发语音消息,
  // 不再 STT 转文字回填输入框(转写能力保留在 hook 内,VoiceInput 场景仍在用)。
  const voiceRecorder = useVoiceRecorder({
    transcribe: false,
    onUnavailable: handleVoiceUnavailable,
    onRecorded: (uri, durationSec) => {
      void handleVoiceRecorded(uri, durationSec)
    },
  })

  // ── 模型类型按钮(对齐 Uniapp handleModelTypeClick / toggleSkillsPopup / toggleMaterialPopup) ──
  // 入口统一:输入区模型钮/九宫格等入口 → openModelModal(tab) 打开同一弹窗,弹窗内 tab 切换分类
  /** 关闭模型选择弹窗(搜索词与展开态一并重置,重开时是干净的分类浏览态) */
  const closeModelModal = (): void => {
    setShowModelSelect(false)
    setModelSearch('')
    setShowModelSearch(false)
  }
  /** 打开模型选择弹窗(tab 预选:入口可带分类,如九宫格技能入口 → 'skills') */
  const openModelModal = (tab: ModelType = selectedModel?.type ?? 'talk'): void => {
    setModelModalTab(tab)
    setShowModelSelect(true)
  }
  /**
   * 弹窗内模型分组:搜索词非空时跨全部分类按 名称/id/厂商 过滤(web 同语义,忽略 tab);
   * 否则按 category(与 web 同源字段,缺失兜底 chat)过滤 vendor 分组;该分类无真实模型
   * 命中时回落 PLACEHOLDER_MODELS 占位(与既有兜底策略一致)。
   * skills tab 渲染真实智能体列表(AgentList),不走模型过滤(搜索态除外)。
   * 两个分支统一走 foldLegacyGroups:legacy 档收编进尾部「历史模型(N)」分组。
   */
  const modalModelGroups = useMemo<ModelListGroup[]>(() => {
    const q = modelSearch.trim().toLowerCase()
    if (q) {
      const hit = realModelGroups
        .map((g) => ({
          ...g,
          models: g.models.filter(
            (m) =>
              m.name.toLowerCase().includes(q) ||
              m.id.toLowerCase().includes(q) ||
              (g.vendor ?? '').toLowerCase().includes(q),
          ),
        }))
        .filter((g) => g.models.length > 0)
      return foldLegacyGroups(hit)
    }
    if (modelModalTab === 'skills') return []
    const filtered = realModelGroups
      .map((g) => ({
        ...g,
        models: g.models.filter(
          (m) => MODEL_CATEGORY_TO_TAB[m.category ?? 'chat'] === modelModalTab,
        ),
      }))
      .filter((g) => g.models.length > 0)
    return foldLegacyGroups(filtered.length > 0 ? filtered : PLACEHOLDER_MODELS[modelModalTab])
  }, [modelModalTab, realModelGroups, modelSearch])
  const modalModelCount = useMemo(
    () => modalModelGroups.reduce((n, g) => n + g.models.length, 0),
    [modalModelGroups],
  )
  /**
   * 选择模型(对齐 Uniapp modelList selectModel → 设置 modelName/modelId 后关闭弹窗)。
   * SelectedModel.type 由模型 category 映射回填(与 web 同源字段;缺失按数字 type 近似,
   * 提交链只送 name/id 不上送 type,type 只影响选中高亮匹配与参数配置表单形态)
   */
  const handleModelSelect = (ids: string[]): void => {
    if (ids.length === 0) return
    const foundGroup = modalModelGroups.find((g) => g.models.some((m) => m.id === ids[0]))
    const found = foundGroup?.models.find((m) => m.id === ids[0])
    if (!found || !foundGroup) return
    const modelType: ModelType =
      MODEL_CATEGORY_TO_TAB[found.category ?? 'chat'] ??
      (found.type !== undefined
        ? (NUMERIC_MODEL_TYPE_TO_MODEL_TYPE[found.type] ?? 'other')
        : 'other')
    setSelectedModel({ type: modelType, id: found.id, name: found.name })
    setShowModelSelect(false)
    setModelSearch('')
    setShowModelSearch(false)
  }
  /** 清除已选模型(对齐 Uniapp 切换类型时清空 modelName) */
  const handleClearModel = (): void => setSelectedModel(null)
  /** 打开/关闭模型参数配置弹窗(对齐 Uniapp showModelaConfig 开关) */
  const closeModelConfig = (): void => setShowModelConfig(false)
  /** 素材项点击(对齐 Uniapp handleMaterialItemClick:素材作为卡片插入输入区上方,可移除)
   *  数据源 getMyCreation(按分类映射 agent/plugin/workflow),点击即插入卡片并关闭素材弹窗。
   *  注:后端无 /api/material 端点,素材库接口未开通,本地列表找不到 item 时明确提示,不伪造实现 */
  const handleMaterialPress = useCallback(
    (id: string): void => {
      const item = materialItems.find((m) => m.id === id)
      if (!item) {
        showToast('info', '素材库接口未开通')
        return
      }
      const uid = `${item.id}-${Date.now()}`
      setMaterialCards((prev) => [
        ...prev,
        { uid, id: item.id, title: item.title || '素材内容', type: item.type },
      ])
      setShowMaterialList(false)
    },
    [materialItems, showToast],
  )
  /** 移除素材卡片(对齐 Uniapp removeMaterialCard:按 uid 独立移除,允许重复素材同时存在) */
  const handleRemoveMaterialCard = useCallback((uid: string): void => {
    setMaterialCards((prev) => prev.filter((c) => c.uid !== uid))
  }, [])

  /** 长按素材项删除(对齐 Uniapp 素材删除语义:父级 Alert 确认 → deleteAgent → 本地过滤 + toast。
   *  MaterialItem.id 即 agentId(agent 条目映射自 agentId 字段),删除后直接过滤本地列表,不重新拉取) */
  const handleMaterialDelete = useCallback(
    (item: MaterialItem): void => {
      Alert.alert('删除素材', `确认删除「${item.title}」？`, [
        { text: '取消', style: 'cancel' },
        {
          text: '确认',
          style: 'destructive',
          onPress: () => {
            void deleteAgent(item.id)
              .then((res) => {
                if (res.success) {
                  setMaterialItems((prev) => prev.filter((m) => m.id !== item.id))
                  showToast('success', '已删除')
                } else {
                  showToast('error', '删除失败')
                }
              })
              .catch(() => showToast('error', '删除失败'))
          },
        },
      ])
    },
    [showToast],
  )

  /** 素材详情弹窗:按当前分类推导 API type,getMyCreationDetail 拉取单条后展示
   *  audio 无对应类型 → toast 提示;失败置 error,弹窗内提供重试 */
  const handleMaterialDetail = useCallback(
    (item: MaterialItem): void => {
      const apiType = materialApiTypeForCategory(activeMaterialCategory)
      if (apiType === null) {
        showToast('info', '该素材暂不支持查看详情')
        return
      }
      setMaterialDetailItem(item)
      setMaterialDetailData(null)
      setMaterialDetailError('')
      setMaterialDetailLoading(true)
      void getMyCreationDetail(apiType, item.id)
        .then((res) => {
          if (res.success) {
            setMaterialDetailData(res.data)
          } else {
            setMaterialDetailError(apiFailureToText(res, '加载详情失败'))
          }
        })
        .catch(() => setMaterialDetailError('网络异常,加载失败'))
        .finally(() => setMaterialDetailLoading(false))
    },
    [activeMaterialCategory, showToast],
  )

  /** 关闭素材详情弹窗并清空数据 */
  const closeMaterialDetail = useCallback((): void => {
    setMaterialDetailItem(null)
    setMaterialDetailData(null)
    setMaterialDetailError('')
    setMaterialDetailLoading(false)
  }, [])

  /** 按分类加载素材(对齐 Uniapp loadMaterialContent:切 tab 即重新拉取;
   *  数据源 getMyCreation;audio 无对应 API type → 空态) */
  const loadMaterials = useCallback((category: string): void => {
    setMaterialLoading(true)
    const apiType = materialApiTypeForCategory(category)
    if (apiType === null) {
      // 音频无对应后端类型,直接空态(对齐 Uniapp tab4 加载空列表)
      setMaterialItems([])
      setMaterialLoading(false)
      return
    }
    void getMyCreation(apiType, { page: 1, pageSize: 50 })
      .then((res) => {
        if (res.success) {
          setMaterialItems(res.data.list.map((it) => mapMyCreationItem(it, category)))
        } else {
          setMaterialItems([])
        }
      })
      .catch(() => setMaterialItems([]))
      .finally(() => setMaterialLoading(false))
  }, [])

  /** 打开素材列表并加载"全部"(对齐 Uniapp showMaterialList + loadMaterialContent(tab=1);
   *  数据源 getMyCreation('agent') 我的创作) */
  const handleOpenMaterialList = useCallback((): void => {
    setShowMaterialList(true)
    setActiveMaterialCategory('all')
    loadMaterials('all')
  }, [loadMaterials])

  // ── 输入框「+」底部滑出菜单(对齐 Uniapp functionHandle → 图标按钮组:
  //    相机 / 相册 / 本地文件 / 微信文件,与 ChatScreen BottomActionBar 图标组同款) ──
  // 上传链路对齐 ChatScreen handleFileUpload:选择 → uploadFileMultipart 真实上传 →
  // 结果以「[图片]/[文件] url」拼入输入框,随提交跳 Chat 发送,真实可消费不伪造。
  const [plusPanelVisible, setPlusPanelVisible] = useState(false)
  const [plusUploading, setPlusUploading] = useState(false)
  /** 「+」切换:展开时收起键盘,避免软键盘遮挡底部滑出面板 */
  const handlePlusToggle = (): void => {
    if (!plusPanelVisible) Keyboard.dismiss()
    setPlusPanelVisible(!plusPanelVisible)
  }
  const closePlusPanel = (): void => setPlusPanelVisible(false)
  /** 相机(对齐 ChatScreen handleIconClick('camera'):相机拍摄待接入,占位提示) */
  const handlePlusCamera = (): void => {
    setPlusPanelVisible(false)
    showToast('info', '相机拍摄待接入,请先用相册上传图片')
  }
  /** 相册选图 → 上传 → 拼入输入框 */
  const handlePlusAlbum = async (): Promise<void> => {
    setPlusPanelVisible(false)
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: false,
        quality: 0.8,
      })
      if (result.canceled) return
      const asset = result.assets?.[0]
      if (!asset?.uri) return
      setPlusUploading(true)
      const up = await uploadFileMultipart({
        uri: asset.uri,
        type: asset.mimeType ?? 'image/jpeg',
        name: asset.fileName ?? `image-${Date.now()}.jpg`,
      })
      if (up.success && up.data?.path) {
        setInputValue((p) => `${p ? `${p}\n` : ''}[图片] ${resolveFileUrl(up.data!.path)}`)
        showToast('success', '图片已上传,发送后可在对话中使用')
      } else {
        showToast('warning', '图片上传失败')
      }
    } catch {
      showToast('warning', '图片选择失败,请重试')
    } finally {
      setPlusUploading(false)
    }
  }
  /** 本地文件 / 微信文件选择 → 上传 → 拼入输入框(对齐 ChatScreen handleFileUpload:
   *  wxfile 与 file 走同一 DocumentPicker 链路) */
  const handlePlusFile = async (): Promise<void> => {
    setPlusPanelVisible(false)
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'text/plain',
        ],
        copyToCacheDirectory: true,
        multiple: false,
      })
      if (result.canceled || result.assets.length === 0) return
      const asset = result.assets[0]!
      setPlusUploading(true)
      const up = await uploadFileMultipart({
        uri: asset.uri,
        type: asset.mimeType ?? 'application/octet-stream',
        name: asset.name ?? `file-${Date.now()}`,
      })
      if (up.success && up.data?.path) {
        const fileName = asset.name ?? '文件'
        setInputValue(
          (p) => `${p ? `${p}\n` : ''}[文件] ${fileName} ${resolveFileUrl(up.data!.path)}`,
        )
        showToast('success', `已上传:${fileName}`)
      } else {
        showToast('warning', '文件上传失败')
      }
    } catch {
      showToast('warning', '文件选择失败,请重试')
    } finally {
      setPlusUploading(false)
    }
  }

  /** 切素材分类:先切 tab 再加载对应类型数据(对齐 Uniapp handleMaterialTabChange → loadMaterialContent) */
  const handleMaterialCategoryChange = useCallback(
    (key: string): void => {
      setActiveMaterialCategory(key)
      loadMaterials(key)
    },
    [loadMaterials],
  )

  // ── 分享领智汇值弹窗(对齐 Uniapp ai_index showSharePointsPopup / first/share/show) ──
  // Local do-not-disturb: any dismiss path persists the flag so cold starts stop popping.
  const closeRewardDialog = (): void => {
    setrewardDialogVisible(false)
    void persistShareFirstDismissed()
  }

  /** 首次分享奖励自动触发:进页检查(对齐 Uniapp ai_index onShow → checkFirstShareStatus) */
  const maybeTriggerFirstShareReward = useCallback(async (): Promise<void> => {
    try {
      const dismissed = await readShareFirstDismissed()
      if (dismissed) return
      const res = await getShareFirstStatus()
      if (res.success && res.data.canClaim) {
        setShareFirstReward(res.data.rewardPoints)
        setrewardDialogVisible(true)
      }
    } catch {
      // 接口异常静默降级,不阻塞进页
    }
  }, [])

  /** 领取首次分享奖励(幂等:已领过后端返回 409) */
  const handleClaimShareReward = async (): Promise<void> => {
    try {
      const res = await claimShareFirstReward()
      closeRewardDialog()
      if (res.success) {
        showToast('success', `已领取 ${res.data.points} 智汇值`)
      } else {
        showToast('info', res.error ?? '已领取过首次分享奖励')
      }
    } catch (e: unknown) {
      const detail = e instanceof Error ? e.message : typeof e === 'string' ? e : ''
      showToast('error', detail.trim() ? toUserFriendlyMessage(e) : '领取失败,请稍后重试')
    }
  }

  // 进页自动检查首次分享奖励(对齐 Uniapp ai_index onShow checkFirstShareStatus → showSharePointsPopup)
  useEffect(() => {
    void maybeTriggerFirstShareReward()
  }, [maybeTriggerFirstShareReward])

  // ── RecentAgents 点击(对齐 Uniapp pitchHandlea → ai_assistant 对话页) ──
  const handleRecentAgentPress = (item: RecentAgentItem): void => {
    rootNav?.navigate('AiAssistantN8n', { agentId: item.id, title: item.name })
  }

  // ── MyAgents 我的AI APP 点击(对齐 Uniapp MyAgents.vue navigateTo → ai_assistant/ai_assistant_n8n) ──
  const handleMyAgentPress = (item: MyAgentItem): void => {
    const id = item.agentId ?? item.id
    if (!id) return
    rootNav?.navigate('AiAssistantN8n', { agentId: id, title: item.agentName ?? item.name })
  }
  /** 我的AI员工(对齐 Uniapp MyAgents.vue goToTeam → /pages/tools/ai_group/index) */
  const handleTeamPress = (): void => {
    rootNav?.navigate('AiGroup')
  }
  /** 智汇值卡充值(对齐 Uniapp Intelligent-assistant.vue topupClick → /pagesA/top-up/index) */
  const handleRechargePress = (): void => {
    if (!user) {
      rootNav?.navigate('Login')
      return
    }
    rootNav?.navigate('AppTopup')
  }

  /** Carousel 轮播 banner(对齐 Uniapp 首页轮播图) */
  const bannerItems: CarouselItem[] = useMemo(
    () =>
      // 仅取有封面图的推荐(对齐原 tools Carousel banner_carousel;无 cover 则不渲染空图轮播)
      recommends
        .filter((r) => Boolean(r.cover))
        .slice(0, 5)
        .map((r) => ({
          img: r.cover ?? '',
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
        icon: BookOpen,
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

  // ── AiModelCard 交互接线(2026-10-15:收藏接真后端 / 警告跳反馈页 / 分享用 ShareSheet) ──
  const [assistantFavorited, setAssistantFavorited] = useState(false)
  const [assistantShareVisible, setAssistantShareVisible] = useState(false)

  // 已登录时同步收藏状态(GET /favorites/check)
  useEffect(() => {
    if (!token) return
    let cancelled = false
    checkFavorite(ASSISTANT_FAVORITE.resourceType, ASSISTANT_FAVORITE.resourceId)
      .then((res) => {
        if (!cancelled && res.success) setAssistantFavorited(Boolean(res.data?.favorited))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [token])

  /** 收藏/取消收藏(POST/DELETE /favorites,幂等) */
  const handleAssistantFavorite = useCallback(async () => {
    if (!token) {
      showToast('info', '请先登录后再收藏')
      return
    }
    try {
      if (assistantFavorited) {
        const res = await deleteFavorite(
          ASSISTANT_FAVORITE.resourceType,
          ASSISTANT_FAVORITE.resourceId,
        )
        if (res.success) {
          setAssistantFavorited(false)
          showToast('info', '已取消收藏')
        } else {
          showToast('error', res.error || '操作失败,请稍后重试')
        }
      } else {
        const res = await addFavorite(
          ASSISTANT_FAVORITE.resourceType,
          ASSISTANT_FAVORITE.resourceId,
        )
        if (res.success) {
          setAssistantFavorited(true)
          showToast('success', '收藏成功')
        } else {
          showToast('error', res.error || '操作失败,请稍后重试')
        }
      }
    } catch {
      showToast('error', '网络异常,请稍后重试')
    }
  }, [token, assistantFavorited, showToast])

  /** 警告(举报)→ 反馈页 */
  const handleAssistantWarning = useCallback(() => {
    rootNav?.navigate('Feedback')
  }, [rootNav])

  /** 踩:后端无点踩接口,本地轻反馈 */
  const handleAssistantDislike = useCallback(() => {
    showToast('info', '已收到你的反馈,我们会持续优化')
  }, [showToast])

  /** 信息:卡片完整介绍(web 下 Alert.alert 静默,统一用 toast 保证端间可见) */
  const handleAssistantInfo = useCallback(() => {
    showToast('info', '智汇社区官方 AI 助手:智能问答/课程推荐,点卡片免费开聊')
  }, [showToast])

  /** 分享 → ShareSheet */
  const handleAssistantShare = useCallback(() => {
    setAssistantShareVisible(true)
  }, [])

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
    try {
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
    } catch (error) {
      setError(error instanceof Error ? error.message : t('common.networkError'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    void load()
    // 智汇值卡余额(对齐 Uniapp Intelligent-assistant.vue 展示用户智汇值;getTokenBalance)
    void getTokenBalance()
      .then((res) => {
        if (res.success) setTokenQuantity(res.data.balance)
      })
      .catch(() => undefined)
    // 真实模型列表(fetchModels → /llm/models,与 web ModelSelector fetchSelectorModels 同源;
    // 按 provider 分组;category 透传 —— 弹窗分类 tab 过滤依赖它,缺失按 web normalizeCategory 兜底 chat。
    // description 显示代次档位(厂商名与分组标题重复,无信息量);组内按 latest→standard→legacy 排序)
    void fetchModels()
      .then((res) => {
        const list = res?.models ?? []
        if (list.length > 0) {
          const grouped = new Map<string, ModelListItem[]>()
          for (const m of list) {
            const key = m.provider || '可用模型'
            const models = grouped.get(key) ?? []
            models.push({
              id: m.id,
              name: m.name,
              description: m.model_tier ? (MODEL_TIER_LABELS[m.model_tier] ?? '') : '',
              // 厂商品牌图标优先:vendor 有值时 ModelList 渲染 BrandIcon 真实矢量
              // (web 同源 @lobehub/icons);provider 缺失按 inferVendor 从模型 id 推断
              // (真源 vendor-infer.ts,零依赖)。icon 保留首字母,作 native / 未映射兜底
              icon: (m.provider || 'M').charAt(0).toUpperCase(),
              vendor: m.provider || inferVendor(m.id),
              isFree: !m.input_price,
              category: m.category,
              modelTier: m.model_tier,
            })
            grouped.set(key, models)
          }
          setRealModelGroups(
            Array.from(grouped.entries()).map(([vendor, models]) => ({
              vendor,
              // 组内代次排序:最新在前(web 同语义),同档保持原序
              models: [...models].sort(
                (a, b) =>
                  (MODEL_TIER_ORDER[a.modelTier ?? 'latest'] ?? 0) -
                  (MODEL_TIER_ORDER[b.modelTier ?? 'latest'] ?? 0),
              ),
            })),
          )
        }
      })
      .catch(() => undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** 置顶轮播运营数据(对齐 miniapp-taro getBannerList 降级语义):
   *  GET /api/carousels?position=home(公开端点,后端按 sort 升序返回 status=1 的运营位图);
   *  失败/空列表静默保持空数组 → BottomFigure 回退内置 3 张本地默认图 */
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await getActiveCarousels('home')
        if (!cancelled && res.success) {
          setCarouselList(
            (res.data ?? [])
              .filter((c) => Boolean(c.imageUrl))
              .map((c) => ({
                id: c.id,
                imageUrl: c.imageUrl,
                img: c.imageUrl,
                title: c.title ?? undefined,
                link: c.linkUrl ?? undefined,
              })),
          )
        }
      } catch {
        // 接口失败静默,回退内置默认图
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  /** 最近使用智能体(对齐 Uniapp getAgentUseHistory → /agents/use-history;
   *  返回 botId 列表,并行查详情关联名称/头像;失败降级用 agentItems 前 5 条) */
  const loadRecentAgents = useCallback(async (fallback: AgentShopItem[] = []): Promise<void> => {
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
    setRecentAgents(fallback.slice(0, 5).map((a) => ({ id: a.id, name: a.name, avatar: a.avatar })))
  }, [])

  // ── 智能体列表加载(对齐 Uniapp tools/index getAgentList:带赛道/主分类筛选) ──
  const loadAgentList = useCallback(
    async (trackId: string, mainId: string): Promise<void> => {
      const res = await getAgents({
        status: 'published',
        pageSize: 20,
        // buildQs 自动忽略空串,''=全公司/全部
        agentCategory: trackId,
        agentMainCategory: mainId,
      })
      if (res.success) {
        const list = (res.data.list ?? []).map(toAgentShopItem)
        setAgentItems(list)
        setMyAgents(
          list.slice(0, 6).map((a) => ({ agentId: a.id, agentName: a.name, avatar: a.avatar })),
        )
        void loadRecentAgents(list)
      }
    },
    [loadRecentAgents],
  )

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

  // ── 技能弹窗智能体列表(对齐 Uniapp toggleSkillsPopup → AgentList;与 ai-list 同源 agentItems) ──
  const skillAgentItems: AgentListItem[] = useMemo(
    () => agentItems.map(toAgentListItem),
    [agentItems],
  )
  /** 技能弹窗智能体点击(对齐 Uniapp handleAgentPitch → ai_assistant 对话页;跳转后关闭弹窗) */
  const handleSkillAgentPress = useCallback(
    (id: string): void => {
      const agent = agentItems.find((a) => a.id === id)
      setShowModelSelect(false)
      rootNav?.navigate('AiAssistantN8n', { agentId: id, title: agent?.name })
    },
    [agentItems, rootNav],
  )

  // ── toodown 返回顶部(对齐 Uniapp handleToodownVisibility/backToTop,RN 端阈值 600) ──
  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>): void => {
    setShowBackTop(e.nativeEvent.contentOffset.y > 600)
  }, [])
  const backToTop = useCallback((): void => {
    scrollRef.current?.scrollTo({ y: 0, animated: true })
  }, [])

  return (
    <View style={shellStyles.root}>
      {/* NavBar 顶部导航栏(对齐 Uniapp navigation-bars:标题"智汇AI社区"+菜单按钮+加入社区群)
       *  左按钮☰ 触发 Drawer(对齐 handleNavClick);右按钮🤝/🎁 对齐 join-click/share-image
       *  右侧追加分类按钮(对齐 Uniapp tools 页 showFenLei → tagWrapShow 赛道分类弹层)
       *  NavBar 置于 ScrollView 外,等价于 Uniapp viscosity=true 粘性效果(始终固定顶部) */}
      <NavChrome>
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
              <SlidersHorizontal size={20} color={tokens.text.medium} />
            </TouchableOpacity>
          }
        />
      </NavChrome>
      <ScrollView
        ref={scrollRef}
        style={shellStyles.scroll}
        contentContainerStyle={[
          shellStyles.scrollContent,
          // 底部玻璃停靠区让位:内容可滚到输入区/胶囊底下若隐若现(2026-10-16)
          { paddingBottom: dockHeight + 16 },
        ]}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {/* BottomFigure 轮播(2026-10-15 用户定稿:轮播图置顶;数据源 GET /api/carousels?position=home,
            运营数据为空/接口失败时回退组件内置本地默认图) */}
        <View style={shellStyles.bottomFigureWrap}>
          <BottomFigure items={carouselList.length > 0 ? carouselList : undefined} />
        </View>
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
        {/* AiModelCard AI 模型卡片(对齐 Uniapp 首页 AI 模型入口;
            2026-10-15 全交互接线:收藏/举报/踩/详情/分享) */}
        <View style={shellStyles.aiModelWrap}>
          <AiModelCard
            data={aiModelData}
            favorited={assistantFavorited}
            onPress={() => rootNav?.navigate('Chat', {})}
            onWarningPress={handleAssistantWarning}
            onDislikePress={handleAssistantDislike}
            onFavoritePress={handleAssistantFavorite}
            onInfoPress={handleAssistantInfo}
            onSharePress={handleAssistantShare}
          />
        </View>
        {/* RecentAgents 最近使用智能体(对齐 Uniapp tools/index RecentAgents)
         *  数据源:无 getAgentUseHistory 接口,降级取智能体列表前 5 条(loadAgentList 内更新);
         *  点击跳 AiAssistant(对齐 Uniapp pitchHandlea → /pages/tools/ai_assistant) */}
        {recentAgents.length > 0 ? (
          <View style={shellStyles.sectionWrap}>
            <RecentAgents items={recentAgents} onItemClick={handleRecentAgentPress} />
          </View>
        ) : null}
        {/* IntelligentAssistant 智汇值卡(对齐 Uniapp Intelligent-assistant.vue:小方欢迎卡 + 剩余智汇值 + 充值) */}
        <View style={shellStyles.sectionWrap}>
          <IntelligentAssistant tokenQuantity={tokenQuantity} onRecharge={handleRechargePress} />
        </View>
        {/* MyAgents 我的AI APP(对齐 Uniapp tools/index MyAgents.vue:标题 + 我的AI员工入口 + 横滑卡片)
         *  数据源:与 ai-list 同源取前 6 条;点击跳 AiAssistantN8n */}
        <View style={shellStyles.sectionWrap}>
          <MyAgents
            items={myAgents}
            onItemClick={handleMyAgentPress}
            onTeamPress={handleTeamPress}
          />
        </View>
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
                // 九宫格「搜索」与 NavBar 搜索钮一致(2026-10-15):开 SearchOverlay 弹窗,不跳全屏搜索页
                setSearchOverlayVisible(true)
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
          colorScheme={resolvedTheme}
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
      </ScrollView>
      {/* toodown 返回顶部悬浮按钮(对齐 Uniapp toodown:68rpx≈34dp 圆角8rpx≈4dp,样式对齐 NewsScreen)
       *  滚动 offsetY > 600 显示,点击 scrollTo 回顶 */}
      {showBackTop ? (
        <TouchableOpacity
          style={[shellStyles.backToTop, { bottom: dockHeight + 12 }]}
          onPress={backToTop}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="返回顶部"
        >
          <Text style={shellStyles.backToTopIcon}>{'↑'}</Text>
        </TouchableOpacity>
      ) : null}
      {/* ModelTypeBar 模型类型选择栏(原对齐 Uniapp BottomActionBar 8 种 model-type-btn 行 44-97)
       *  2026-10-15 用户重构:外挂选择栏整块移除,8 种分类改经 categories props 收进 InputArea
       *  大输入框内「+」左侧(对齐 web 输入卡底栏两行布局);selectedModel 小标签随分类行内嵌 */}
      {/* 我的创作入口(对齐 Uniapp ai_index MaterialList 触发按钮 showMaterialList=true,
       *  点击打开并加载"全部"tab(getMyCreation('agent') 我的创作数据) */}
      <TouchableOpacity
        onPress={handleOpenMaterialList}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="我的创作"
        style={shellStyles.creationEntry}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Folder size={13} color={tokens.brand.DEFAULT} />
          <Text style={shellStyles.creationEntryText}>我的创作</Text>
        </View>
      </TouchableOpacity>
      {/* 语音输入已内嵌 InputArea 大输入框(麦克风长按录音,2026-09-22 用户定稿):
          原独立 VoiceInput「按住说出你的问题」行移除,转文字回填输入框,随提交跳 Chat */}
      {/* 素材卡片行(对齐 Uniapp material-cards-wrap:点击素材插入输入区上方,每卡右上 × 移除)
       *  数据源 materialCards 由 handleMaterialPress 写入,横向滚动包裹 */}
      {materialCards.length > 0 ? (
        <View style={shellStyles.materialCardsWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={shellStyles.materialCardsRow}>
              {materialCards.map((card) => (
                <View key={card.uid} style={shellStyles.materialCardItem}>
                  <Text style={shellStyles.materialCardTitle} numberOfLines={1}>
                    {card.title}
                  </Text>
                  <Pressable
                    onPress={() => handleRemoveMaterialCard(card.uid)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="移除素材"
                  >
                    <Text style={shellStyles.materialCardClose}>×</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      ) : null}
      {/* 输入框「+」底部滑出菜单:统一走共享 AddPanel(图标按钮组:相机/相册/本地文件/微信文件,
          与 BottomActionBar/ChatScreen 同源),上传结果拼入输入框随提交发送 */}
      <AddPanel
        visible={plusPanelVisible}
        onClose={closePlusPanel}
        items={[
          {
            key: 'camera',
            label: '相机',
            icon: <Camera size={24} color={tokens.text.secondary} />,
            onPress: handlePlusCamera,
          },
          {
            key: 'album',
            label: '相册',
            icon: plusUploading ? (
              <ActivityIndicator size="small" color={tokens.text.secondary} />
            ) : (
              <ImageIcon size={24} color={tokens.text.secondary} />
            ),
            onPress: () => void handlePlusAlbum(),
          },
          {
            key: 'file',
            label: '本地文件',
            icon: <Folder size={24} color={tokens.text.secondary} />,
            onPress: () => void handlePlusFile(),
          },
          {
            key: 'wxfile',
            label: '微信文件',
            icon: <MessageCircle size={24} color={tokens.text.secondary} />,
            onPress: () => void handlePlusFile(),
          },
        ]}
      />
      {/* 悬浮栏(赚米/客服/反馈)由 App.tsx 的 GlobalFloatBox 单点渲染;
          此处曾另挂一份,两份同屏叠出双栏,且这份的「反馈」错跳 Settings。 */}
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
      {/* ModelList Modal(对齐 web ModelSelector:底部 sheet + 弹窗内 8 分类 tab 切换模型列表)
       *  入口:输入区模型钮/九宫格技能入口 → openModelModal(tab);选模型后填充输入区小标签 */}
      <Modal
        visible={showModelSelect}
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
            {/* 拖拽指示条(iOS bottom-sheet 惯例,可下滑关闭) */}
            <View style={shellStyles.modelModalGrabber} />
            <View style={shellStyles.modelModalHeader}>
              <View style={shellStyles.modelModalHeading}>
                <Text style={shellStyles.modelModalTitle} numberOfLines={1}>
                  模型选择
                </Text>
                <Text style={shellStyles.modelModalSubtitle} numberOfLines={1}>
                  {modelSearch.trim()
                    ? `搜索到 ${modalModelCount} 个模型`
                    : modelModalTab === 'skills'
                      ? `共 ${skillAgentItems.length} 个智能体`
                      : `共 ${modalModelCount} 个模型 · 按厂商分组`}
                </Text>
              </View>
              {/* 搜索开关(图标钮,2026-10-15 用户定:最右上一个图标,不带文字) */}
              <Pressable
                onPress={() => {
                  if (showModelSearch) {
                    setShowModelSearch(false)
                    setModelSearch('')
                  } else {
                    setShowModelSearch(true)
                  }
                }}
                hitSlop={8}
                style={shellStyles.modelSearchToggle}
                accessibilityRole="button"
                accessibilityLabel="搜索模型"
                accessibilityState={{ selected: showModelSearch }}
              >
                <Search
                  size={18}
                  color={showModelSearch ? tokens.brand.cta : tokens.text.tertiary}
                />
              </Pressable>
              <Pressable
                onPress={closeModelModal}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="关闭"
              >
                <Text style={shellStyles.modelModalClose}>×</Text>
              </Pressable>
            </View>
            {/* 搜索框:头部搜索图标开关控制展开/收起(收起即清词);非空时跨全部分类过滤 */}
            {showModelSearch ? (
              <View style={shellStyles.modelSearchBox}>
                <Search size={16} color={tokens.text.tertiary} />
                <TextInput
                  style={shellStyles.modelSearchInput}
                  value={modelSearch}
                  onChangeText={setModelSearch}
                  placeholder="搜索模型或厂商"
                  placeholderTextColor={tokens.text.tertiary}
                  returnKeyType="search"
                  clearButtonMode="while-editing"
                  accessibilityLabel="搜索模型输入"
                />
                {modelSearch ? (
                  <Pressable
                    onPress={() => setModelSearch('')}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="清除搜索"
                  >
                    <Text style={shellStyles.modelSearchClear}>×</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
            {/* 分类 tab:8 分类横向滚动,active 品牌实心底;与列表间发丝线分层 */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={shellStyles.modelModalTabRow}
              contentContainerStyle={shellStyles.modelModalTabContent}
            >
              {MODEL_TYPES.map((mt) => {
                const active = !modelSearch.trim() && modelModalTab === mt.type
                const Icon = mt.icon
                return (
                  <Pressable
                    key={mt.type}
                    onPress={() => {
                      setModelSearch('')
                      setModelModalTab(mt.type)
                    }}
                    style={[shellStyles.modelModalTab, active && shellStyles.modelModalTabActive]}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={mt.label}
                  >
                    <Icon
                      size={14}
                      color={active ? tokens.brand.ctaForeground : tokens.text.secondary}
                    />
                    <Text
                      style={[
                        shellStyles.modelModalTabText,
                        active && shellStyles.modelModalTabActiveText,
                      ]}
                    >
                      {mt.label}
                    </Text>
                  </Pressable>
                )
              })}
            </ScrollView>
            <View style={shellStyles.modelModalHairline} />
            {/* 技能 tab 渲染真实智能体列表(对齐 Uniapp toggleSkillsPopup → AgentList);
                搜索态跨全部分类渲染模型列表;其余 tab 渲染分类过滤后的模型列表 */}
            {modelModalTab === 'skills' && !modelSearch.trim() ? (
              <AgentList
                style={shellStyles.modelModalListBody}
                items={skillAgentItems}
                onItemClick={handleSkillAgentPress}
                isLoading={false}
                emptyText="暂无智能体"
              />
            ) : (
              <ModelList
                style={shellStyles.modelModalListBody}
                groups={modalModelGroups}
                selectionMode="single"
                selectedIds={selectedModel ? [selectedModel.id] : []}
                onSelectChange={handleModelSelect}
              />
            )}
          </View>
        </View>
      </Modal>
      {/* MaterialList 素材弹窗(对齐 Uniapp showMaterialList → MaterialList「我的创作」,底部 sheet)
       *  共享组件:MaterialList 自身不带 Modal,包裹 RN Modal 实现底部 sheet(对齐 BottomPopup 同款) */}
      <Modal
        visible={showMaterialList}
        transparent
        animationType="slide"
        onRequestClose={() => setShowMaterialList(false)}
        statusBarTranslucent
      >
        <View style={shellStyles.materialBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setShowMaterialList(false)}
            accessibilityLabel="关闭素材列表"
          />
          <View style={shellStyles.materialSheet}>
            <View style={shellStyles.materialSheetBar}>
              <Pressable
                onPress={() => setShowMaterialList(false)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="关闭"
              >
                <Text style={shellStyles.materialSheetClose}>×</Text>
              </Pressable>
            </View>
            <MaterialList
              categories={MATERIAL_CATEGORIES}
              activeCategory={activeMaterialCategory}
              onCategoryChange={handleMaterialCategoryChange}
              items={materialItems}
              onPress={handleMaterialPress}
              onDelete={handleMaterialDelete}
              onDetail={handleMaterialDetail}
              loading={materialLoading}
              hasMore={false}
            />
          </View>
        </View>
      </Modal>
      {/* 素材详情弹窗(点击列表项「详情」→ getMyCreationDetail;居中对话框,参照 ChatScreen listDialog 模式) */}
      <Modal
        visible={materialDetailItem !== null}
        transparent
        animationType="fade"
        onRequestClose={closeMaterialDetail}
        statusBarTranslucent
      >
        <View style={shellStyles.detailDialogMask}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={closeMaterialDetail}
            accessibilityLabel="关闭素材详情"
          />
          <View style={shellStyles.detailDialogContent}>
            <View style={shellStyles.detailDialogHeader}>
              <Text style={shellStyles.detailDialogTitle} numberOfLines={1}>
                {materialDetailItem?.title ?? '素材详情'}
              </Text>
              <Pressable
                onPress={closeMaterialDetail}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="关闭"
              >
                <Text style={shellStyles.detailDialogClose}>×</Text>
              </Pressable>
            </View>
            <View style={shellStyles.detailDialogBody}>
              {materialDetailLoading ? (
                <ActivityIndicator size="small" color={tokens.brand.DEFAULT} />
              ) : materialDetailError ? (
                <View style={shellStyles.detailDialogErrorWrap}>
                  <Text style={shellStyles.detailDialogErrorText}>{materialDetailError}</Text>
                  <Pressable
                    onPress={() => materialDetailItem && handleMaterialDetail(materialDetailItem)}
                    style={shellStyles.detailDialogRetryBtn}
                    accessibilityRole="button"
                  >
                    <Text style={shellStyles.detailDialogRetryText}>重试</Text>
                  </Pressable>
                </View>
              ) : materialDetailData ? (
                <ScrollView style={shellStyles.detailDialogScroll}>
                  {MATERIAL_DETAIL_FIELDS.map((f) => {
                    const value = formatDetailValue(materialDetailData[f.key])
                    if (!value) return null
                    return (
                      <View key={f.key} style={shellStyles.detailDialogFieldRow}>
                        <Text style={shellStyles.detailDialogFieldLabel}>{f.label}</Text>
                        <Text style={shellStyles.detailDialogFieldValue}>{value}</Text>
                      </View>
                    )
                  })}
                </ScrollView>
              ) : null}
            </View>
          </View>
        </View>
      </Modal>
      {/* ModelConfigDialog 模型参数配置弹窗(对齐 Uniapp showModelaConfig → ModelConfigDialog)
       *  共享组件:内部自带 Modal;visible 控制显隐,modelType 映射自本屏 ModelType */}
      <ModelConfigDialog
        visible={showModelConfig}
        modelType={selectedModel ? toConfigModelType(selectedModel.type) : 'text'}
        config={modelConfig}
        onChange={setModelConfig}
        onClose={closeModelConfig}
      />
      {/* 二维码弹窗(对齐 Uniapp ai_index qr-code-modal:qewm.png 600rpx + 长按保存 + 关闭) */}
      <Modal
        visible={qrCodeVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setQrCodeVisible(false)}
      >
        <Pressable
          style={shellStyles.modalMask}
          onPress={() => setQrCodeVisible(false)}
          accessibilityRole="button"
          accessibilityLabel="关闭二维码"
        >
          <Pressable style={shellStyles.qrContent} onPress={(e) => e.stopPropagation()}>
            <Pressable
              onLongPress={() => void handleLongPressQrCode()}
              delayLongPress={500}
              accessibilityRole="imagebutton"
              accessibilityLabel="社群二维码,长按保存"
            >
              <Image source={QrCodeImage} style={shellStyles.qrImage} resizeMode="contain" />
            </Pressable>
            <Text style={shellStyles.qrTitle}>扫描二维码加入社区</Text>
            <Pressable
              hitSlop={8}
              onPress={() => setQrCodeVisible(false)}
              style={shellStyles.qrClose}
              accessibilityRole="button"
              accessibilityLabel="关闭"
            >
              <Text style={shellStyles.qrCloseText}>×</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
      {/* 分享领智汇值弹窗(对齐 Uniapp ai_index share-points-popup)
       *  2026-10-15 深度重构:抽共享组件 ShareRewardDialog(金渐变纪念币 Hero +
       *  brandAccent 渐变 CTA),Home/Chat 两屏统一;渲染容器病理说明见组件头注释 */}
      <ShareRewardDialog
        visible={rewardDialogVisible}
        reward={shareFirstReward}
        onClaim={handleClaimShareReward}
        onClose={closeRewardDialog}
        secondaryLabel="稍后再说"
      />
      {/* AiModelCard 分享面板(2026-10-15 接线) */}
      <ShareSheet
        visible={assistantShareVisible}
        onClose={() => setAssistantShareVisible(false)}
        shareTitle="智汇AI社区 - 智汇 AI 助手"
        shareDescription="智能问答 / 课程推荐,用AI.找AI.学AI就到智汇AI社区"
        onNotify={(type, message) => showToast(type, message)}
      />
      {/* 分享面板(导航栏「分享」触发;微信原生分享 + web 复制链接降级,见组件头注释) */}
      <ShareSheet
        visible={shareSheetVisible}
        onClose={() => setShareSheetVisible(false)}
        onNotify={showToast}
      />
      {/* 搜索弹窗(2026-10-15 与 web 端一致:NavBar 搜索钮 + 九宫格「搜索」统一开此弹层,
       *  遮罩 + 三段面板(历史/热门/联想),弹窗内直接出结果) */}
      <SearchOverlay
        visible={searchOverlayVisible}
        onClose={() => setSearchOverlayVisible(false)}
      />
      {/* 底部玻璃停靠区(2026-10-16 用户定稿「整个底部菜单栏液态玻璃、内容若隐若现」):
          输入区 + 底部导航胶囊整块绝对定位悬浮在内容之上,玻璃底(glass.bg 半透明 +
          web 预览 backdrop blur);停靠区实测高度回灌 ScrollView 预留,内容滚到底下若隐若现。 */}
      <View
        style={shellStyles.bottomDock}
        onLayout={(e) => setDockHeight(e.nativeEvent.layout.height)}
      >
        {/* InputArea 底部输入区(对齐 Uniapp BottomActionBar 输入部分)
         *  常驻输入栏(2026-09-22 用户明令去掉折叠 FAB 加号球:collapsible/defaultCollapsed 均不传,
         *  组件默认 collapsible=false → 永久展开,无「×」回折按钮)。
         *  大输入框(2026-09-22 用户定稿):麦克风+文本+发送同框,长按麦克风「按住说出你的问题」。
         *  提交跳 Chat(对齐 Uniapp handleSendMessageabc → 跳 ai_index2)。
         *  transparentBackground:底色/顶描边由停靠区玻璃统一提供(2026-10-16)。 */}
        <InputArea
          value={inputValue}
          onChangeText={setInputValue}
          placeholder="请输入您的问题,或长按说话"
          onSubmit={handleInputSubmit}
          showVoiceMic
          voiceRecording={voiceRecorder.recording}
          voiceTranscribing={voiceRecorder.transcribing}
          voiceDuration={voiceRecorder.duration}
          onVoiceStart={voiceRecorder.start}
          onVoiceEnd={() => void voiceRecorder.stop()}
          onPlusToggle={handlePlusToggle}
          plusActive={plusPanelVisible}
          // 模型选择收进大输入框(2026-10-15 用户定:对齐 web 输入卡 ModelSelector ——
          // 单按钮显示当前模型/「自动」,点击直接弹全量模型列表;8 分类 chips 平铺已废)
          onOpenModelSelect={() => openModelModal()}
          selectedModelName={selectedModel?.name ?? null}
          onClearModel={handleClearModel}
          onOpenModelConfig={() => setShowModelConfig(true)}
          transparentBackground
        />
        {/* 悬浮胶囊让位区:透明,停靠区玻璃透出;TabBar 绝对定位在其中浮起 */}
        <View style={{ height: tabBarDockSpacer(insets.bottom) }} />
        <TabBar activeTab="home" onChange={handleTabChange} />
      </View>
    </View>
  )
}

const shellStyles = {
  root: { flex: 1, backgroundColor: tokens.surface.bg } as const,
  // 底部玻璃停靠区(2026-10-16):输入区 + TabBar 胶囊整块悬浮,液态玻璃底 + web 预览模糊,
  // 顶部圆角与细描边;内容区由 ScrollView 预留 paddingBottom 让位,可滚到玻璃底下若隐若现
  bottomDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: tokens.glass.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tokens.border.light,
    borderTopLeftRadius: rnRadius.xl,
    borderTopRightRadius: rnRadius.xl,
    ...glassBlurLayer,
  } as const,
  // 顶栏行取白档,与 App.tsx 给 Home 的状态栏带同色;主体仍走 root 的 surface.bg
  scroll: { flex: 1 } as const,
  scrollContent: { paddingBottom: rpx(120) } as const,
  // 轮播(对齐 Uniapp custom-carousel-wrapper:margin 18rpx 0 0 0 ≈ marginTop: rpx(18) + 圆角 30rpx≈15)
  carouselWrap: {
    marginTop: rpx(18),
    marginBottom: rpx(16),
    borderRadius: rnRadius['2xl'],
    overflow: 'hidden',
  } as const,
  cardListWrap: { paddingHorizontal: rpx(20), paddingVertical: rpx(16) } as const,
  aiModelWrap: { paddingHorizontal: rpx(20), paddingVertical: rpx(16) } as const,
  sectionWrap: { paddingHorizontal: rpx(20), paddingVertical: rpx(16) } as const,
  bottomFigureWrap: {
    // 横向留白已内聚于 BottomFigure(SIDE_INSET),此处仅保留底部间距(2026-10-15)
    marginBottom: rpx(20),
  } as const,
  // ── toodown 返回顶部按钮(对齐 Uniapp toodown:68rpx≈34dp 圆角8rpx≈4dp,样式对齐 NewsScreen) ──
  // bottom 运行时按底部玻璃停靠区实测高度上浮(样式内只留几何与外观)
  backToTop: {
    position: 'absolute',
    left: '50%',
    marginLeft: rpx(-34),
    width: 34,
    height: 34,
    borderRadius: rnRadius.sm,
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
  // ── ModelTypeBar 模型类型选择栏样式已随外挂选择栏移除(2026-10-15 用户重构:
  //  分类收进 InputArea 大输入框,样式随迁至 InputArea.tsx catChip 族) ──
  // ── creationEntry 我的创作入口(对齐 Uniapp ai_index MaterialList 触发按钮) ──
  creationEntry: {
    alignSelf: 'flex-start',
    paddingHorizontal: rpx(24),
    paddingVertical: rpx(12),
  } as const,
  creationEntryText: {
    fontSize: 13,
    color: tokens.brand.DEFAULT,
    fontWeight: '600',
  } as const,
  // ── 素材卡片行(对齐 Uniapp material-cards-wrap:卡片带标题 + 右上 × 移除,compact 风格) ──
  materialCardsWrap: {
    paddingHorizontal: rpx(24),
    paddingBottom: rpx(8),
  } as const,
  materialCardsRow: {
    flexDirection: 'row',
    gap: rpx(12),
  } as const,
  materialCardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: rpx(460),
    paddingLeft: rpx(20),
    paddingRight: rpx(6),
    paddingVertical: rpx(10),
    borderRadius: rnRadius.lg,
    backgroundColor: tokens.surface.muted,
  } as const,
  materialCardTitle: {
    maxWidth: rpx(340),
    fontSize: 13,
    color: tokens.text.primary,
  } as const,
  materialCardClose: {
    fontSize: 16,
    lineHeight: 18,
    color: tokens.text.tertiary,
    fontWeight: '400',
    marginLeft: rpx(12),
    paddingHorizontal: rpx(4),
  } as const,
  // ── MaterialList Modal 弹窗(对齐 BottomPopup sheet 风格) ──
  materialBackdrop: {
    flex: 1,
    backgroundColor: tokens.overlay.modal,
    justifyContent: 'flex-end',
  } as const,
  materialSheet: {
    width: '100%',
    height: '80%',
    backgroundColor: tokens.surface.card,
    borderTopLeftRadius: rnRadius.xl,
    borderTopRightRadius: rnRadius.xl,
  } as const,
  materialSheetBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: rpx(24),
    paddingVertical: rpx(12),
    backgroundColor: tokens.surface.card,
  } as const,
  materialSheetClose: {
    fontSize: 22,
    lineHeight: 24,
    color: tokens.text.tertiary,
    fontWeight: '300',
    paddingHorizontal: rpx(8),
  } as const,
  // ── 素材详情弹窗(参照 ChatScreen listDialog 居中对话框风格) ──
  detailDialogMask: {
    flex: 1,
    backgroundColor: tokens.overlay.modal,
    alignItems: 'center',
    justifyContent: 'center',
  } as const,
  detailDialogContent: {
    width: '84%',
    maxHeight: '70%',
    backgroundColor: tokens.surface.card,
    borderRadius: rnRadius.xl,
    overflow: 'hidden',
  } as const,
  detailDialogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // 固定 chrome 不被压缩:弹窗唯一弹性路径 = 内容区 ScrollView(默认 shrink)
    // (sheet-flex 契约,详见 scripts/check-sheet-flex-contract.mjs)
    flexShrink: 0,
    paddingHorizontal: rpx(32),
    paddingVertical: rpx(24),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.border.light,
  } as const,
  detailDialogTitle: {
    flex: 1,
    marginRight: rpx(16),
    fontSize: 15,
    fontWeight: '600',
    color: tokens.text.primary,
  } as const,
  detailDialogClose: {
    fontSize: 22,
    lineHeight: 24,
    color: tokens.text.tertiary,
    fontWeight: '300',
    paddingHorizontal: rpx(8),
  } as const,
  detailDialogBody: {
    paddingHorizontal: rpx(32),
    paddingVertical: rpx(16),
    minHeight: 120,
  } as const,
  detailDialogScroll: {
    alignSelf: 'stretch',
    // 唯一弹性块:bounded 弹窗(maxHeight 70%)内 ScrollView flex:1 内部滚动
    // (sheet-flex 契约,详见 scripts/check-sheet-flex-contract.mjs)
    flex: 1,
  } as const,
  detailDialogFieldRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: rpx(10),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.border.light,
  } as const,
  detailDialogFieldLabel: {
    width: rpx(140),
    fontSize: 13,
    color: tokens.text.tertiary,
  } as const,
  detailDialogFieldValue: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: tokens.text.primary,
  } as const,
  detailDialogErrorWrap: {
    alignSelf: 'center',
    alignItems: 'center',
    gap: rpx(16),
  } as const,
  detailDialogErrorText: {
    fontSize: 13,
    color: tokens.text.secondary,
  } as const,
  detailDialogRetryBtn: {
    paddingHorizontal: rpx(32),
    paddingVertical: rpx(12),
    borderRadius: rnRadius.sm,
    backgroundColor: tokens.brand.cta,
  } as const,
  detailDialogRetryText: {
    fontSize: 13,
    color: tokens.brand.ctaForeground,
    fontWeight: '600',
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
    backgroundColor: tokens.surface.card,
    borderTopLeftRadius: rnRadius.xl,
    borderTopRightRadius: rnRadius.xl,
    paddingTop: rpx(32),
    paddingBottom: rpx(16),
  } as const,
  modelModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: rpx(32),
    paddingBottom: rpx(16),
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
    paddingHorizontal: rpx(8),
  } as const,
  // ── 弹窗深化(2026-10-15):把手 + 副标题计数 + 分类 tab + 发丝线 + 搜索 ──
  modelModalGrabber: {
    alignSelf: 'center',
    width: rpx(72),
    height: 4,
    borderRadius: 2,
    backgroundColor: tokens.border.medium,
    marginBottom: rpx(16),
  } as const,
  modelModalHeading: {
    flex: 1,
    paddingRight: rpx(16),
  } as const,
  modelModalSubtitle: {
    fontSize: 12,
    color: tokens.text.tertiary,
    marginTop: 2,
  } as const,
  modelModalTabRow: {
    // 横向 tab 行:纵向不收缩,滚动交由内容
    flexGrow: 0,
    // 固定 chrome 永不被 flex 压缩:此前列表未约束 flex,自然高度撑爆 sheet 的
    // maxHeight 时 tab 行被 shrink 压扁(33→14px,背景条比文字矮 → 图标/文字穿帮错位)
    flexShrink: 0,
  } as const,
  modelModalListBody: {
    // 列表区是弹窗里唯一弹性块:吃掉 sheet 剩余高度并内部滚动
    // (SectionList 需要确定高度父容器才能滚,RN 0.86),
    // 避免自然高度撑爆 maxHeight 后压缩固定块(flexShrink 灾难)
    flex: 1,
    minHeight: 0,
  } as const,
  modelModalTabContent: {
    gap: rpx(12),
    paddingHorizontal: rpx(32),
    paddingBottom: rpx(16),
  } as const,
  modelModalTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rpx(8),
    // 分类胶囊:角色档 chip(6),与 InputArea 分类入口同视觉语言
    borderRadius: rnRadiusFor.chip,
    borderWidth: 1,
    borderColor: tokens.border.light,
    backgroundColor: tokens.surface.muted,
    paddingHorizontal: rpx(24),
    paddingVertical: rpx(12),
  } as const,
  modelModalTabActive: {
    backgroundColor: tokens.brand.cta,
    borderColor: tokens.brand.cta,
  } as const,
  modelModalTabText: {
    fontSize: 13,
    color: tokens.text.secondary,
  } as const,
  modelModalTabActiveText: {
    // 底取 brand.cta、字必须取配对档 ctaForeground:cta 暗档是纯白底,写死 #FFFFFF 就是
    // 白底白字(2026-10-16 用户实测「鬼能看清字」)。配对档两态恒反相,永不撞色。
    // 键名必须是 modelModalTabActive + Text 的兄弟形(与 modelModalTabActive 成 R4 兄弟对),
    // 否则判据认不出配对、R3 只能靠无配对实底兜账 —— 命名改对才让 R4/R9 直接可判。
    color: tokens.brand.ctaForeground,
    fontWeight: '600',
  } as const,
  modelModalHairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: tokens.border.light,
    marginHorizontal: rpx(32),
  } as const,
  // ── 弹窗内搜索(头部图标开关 + 展开态胶囊输入框)──
  modelSearchToggle: {
    width: rpx(56),
    height: rpx(56),
    alignItems: 'center',
    justifyContent: 'center',
  } as const,
  modelSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rpx(12),
    marginHorizontal: rpx(32),
    marginBottom: rpx(16),
    paddingHorizontal: rpx(24),
    height: rpx(64),
    borderRadius: rnRadiusFor.chip,
    borderWidth: 1,
    borderColor: tokens.border.light,
    backgroundColor: tokens.surface.muted,
  } as const,
  modelSearchInput: {
    flex: 1,
    fontSize: 14,
    color: tokens.text.primary,
    // RN web 端 TextInput 默认内边距偏大,压平与图标同行
    paddingVertical: 0,
  } as const,
  modelSearchClear: {
    fontSize: 18,
    lineHeight: 20,
    color: tokens.text.tertiary,
    paddingHorizontal: rpx(8),
  } as const,
  // ── 分享领智汇值弹窗(2026-10-15 重构为共享组件 ShareRewardDialog,样式随组件) ──
  modalMask: {
    flex: 1,
    backgroundColor: tokens.overlay.modal,
    alignItems: 'center',
    justifyContent: 'center',
  } as const,
  // 二维码弹窗(对齐 Uniapp qr-code-modal:图片 600rpx≈300dp + 关闭按钮)
  qrContent: {
    width: '80%',
    borderRadius: rnRadius.xl,
    backgroundColor: tokens.surface.card,
    paddingVertical: rpx(36),
    paddingHorizontal: rpx(24),
    alignItems: 'center',
    position: 'relative',
  } as const,
  qrImage: {
    width: 240,
    height: 240,
    borderRadius: rnRadius.lg,
  } as const,
  qrTitle: {
    marginTop: rpx(20),
    fontSize: 16,
    fontWeight: '600',
    color: tokens.text.primary,
    textAlign: 'center',
  } as const,
  qrClose: {
    position: 'absolute',
    top: 10,
    right: 14,
    padding: 4,
  } as const,
  qrCloseText: {
    fontSize: 24,
    lineHeight: 26,
    color: tokens.text.tertiary,
    fontWeight: '300',
  } as const,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
