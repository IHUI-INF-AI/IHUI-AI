/**
 * ChatScreen — AI 对话社区主屏 (mobile-rn 端)
 *
 * 1:1 复刻历史 Uniapp ai_index.vue 核心结构:
 * - 顶部 NavBar:菜单入口(打开 Drawer)+ 标题"智汇AI"+ 加入按钮(二维码弹窗)
 * - 模型类型切换区:8 种模型类型按钮(skills/talk/image/video/audio/videoa/other/sck)
 *   注:Uniapp 第 8 个按钮是 'sck'(素材库/我的创作),非任务描述的 'all';
 *   'sck' 是素材库入口,'all' 是任务作者语义映射,这里按 Uniapp 保真用 'sck'。
 * - Material 卡片区:当前对话引入的素材(materialCards),横向卡片 + 关闭按钮(对齐 Uniapp materialCards)
 *   素材库浏览弹窗(sck 点击)用现有 MaterialList 组件(分类 tab + 网格),不支持删除;
 *   materialCards 是"引入到输入区的素材",需删除,故自定义实现。在注释中说明分工。
 * - 消息列表:FlatList 渲染气泡(user 右 / assistant 左),保留 streamChat 流式逻辑
 * - 底部输入区:输入框 + 语音 + 图片(自定义)+ 功能开关 chip 行(对齐 Uniapp ToggleButtonGroup)
 *   + BottomActionBar(发送 + 模型列表,承载 send-message / show-model-list 事件)
 * - 二维码弹窗 + 分享领智汇值弹窗(Modal)
 * - Drawer 集成(H3 重建版,管理 visible 状态)
 *
 * BottomActionBar 30+ 事件回调:15 个已实现(send-message/toggle-voice-input/
 * toggle-super-agent/toggle-super-agentfu/toggle-mcp/toggle-knowledge-base/
 * toggle-permanent-memory/showModelConfig/show-model-list/remove-image/update:prompt/
 * function-handle/source-handle/icon-click/fangda),其余 stub(H22 补全)。
 *
 * 平台独占:仅 mobile-rn 端,不涉及其他端。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAudioPlayer } from 'expo-audio'
import * as DocumentPicker from 'expo-document-picker'
import { File, Paths } from 'expo-file-system'
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import type { FlatList } from 'react-native'
import Clipboard from '@react-native-clipboard/clipboard'
import * as MediaLibrary from 'expo-media-library'
import { captureRef } from 'react-native-view-shot'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import {
  Bot,
  BookOpen,
  Clapperboard,
  Copy,
  Cpu,
  Download,
  Image as ImageIcon,
  Library,
  Link,
  type LucideIcon,
  Menu,
  MessageCircle,
  MessageSquare,
  Music,
  Paperclip,
  QrCode,
  RefreshCw,
  Share2,
  Sparkles,
  Star,
  Trash2,
  Video,
  Volume2,
  X,
} from 'lucide-react-native'
import {
  claimShareFirstReward,
  deleteAgent,
  deleteConversation,
  fetchModels,
  fetchTextToSpeechAudio,
  formatSSEError,
  getAgents,
  getMessages,
  getModelContextCapacity,
  getMyCreation,
  getMyCreationDetail,
  getShareFirstStatus,
  listConversations,
  resolveFileUrl,
  streamChat,
  uploadFileMultipart,
  type Agent,
  type ConversationDetail,
  type LlmModel,
  type MyCreationItem,
  type MyCreationType,
} from '@ihui/api-client'
import { FALLBACK_MODELS as SHARED_FALLBACK_MODELS } from '@ihui/shared'
import type { ChatMessage } from '@ihui/shared'
import type { ModelConfigType } from '@ihui/ui-native'
import {
  ChatScreen as SharedChatScreen,
  type ChatScreenMessage,
  type ChatScreenModel,
} from '@ihui/rn-app'
import { NavBar } from '../components/NavBar'
import { BottomActionBar } from '../components/BottomActionBar'
// 对齐 Uniapp ai_index2.vue 行 117-131:对话页顶部「查看卡片」折叠区(智汇值卡)
import IntelligentAssistant from '../components/IntelligentAssistant'
import MaterialList, { type MaterialCategory, type MaterialItem } from '../components/MaterialList'
import {
  Drawer,
  type DrawerConversationItem,
  type DrawerExtraMenu,
  type DrawerTab,
} from '../components/Drawer'
import { ModelConfigDialog, type ModelConfig } from '../components/ModelConfigDialog'
import ModelList, { type ModelListGroup } from '../components/ModelList'
import AgentList, { type AgentListItem } from '../components/AgentList'
import { BottomPops } from '../components/BottomPops'
import { FloatBox, type FloatBoxType } from '../components/FloatBox'
import NotificationPanel from '../components/NotificationPanel'
import { useAuth } from '../context/AuthContext'
import { useChatInput } from '../hooks/useChatInput'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { DRAWER_TAB_TO_RN_TAB, mainScreenForTab } from '../navigation/tab-utils'
import { useI18n } from '../i18n'
import { rpx } from '../utils/rpx'
// 消息富内容解析(代码块/图片/文本分段,对齐 ai_index2 agent_content_list;独立模块供单测共用)
import { parseMessageContent } from '../utils/message-parse'

// ── 类型定义(强类型,禁用 any) ──

type RootNav = NativeStackNavigationProp<RootStackParamList>

/**
 * 模型类型(对齐 Uniapp ai_index.vue 的 8 种模型类型按钮)。
 * Uniapp 实际第 8 个按钮是 'sck'(素材库),非 'all';按 Uniapp 保真用 'sck'。
 */
type ModelType = 'skills' | 'talk' | 'image' | 'video' | 'audio' | 'videoa' | 'other' | 'sck'

/** 素材卡片(对齐 Uniapp materialCards,引入到输入区的素材,支持删除) */
interface MaterialCard {
  id: string
  /** 1文本 2图片 3视频 4音频(对齐 Uniapp materialCards.type) */
  type: 1 | 2 | 3 | 4
  title: string
  content?: string
  imageList?: string[]
  videoUrl?: string
  audioUrl?: string
  posterUrl?: string
}

/** 模型类型按钮配置 */
interface ModelTypeConfig {
  key: ModelType
  label: string
  Icon: LucideIcon
}

/**
 * 带推理过程(thinking)的 AI 消息(对齐 Uniapp ai_index2.vue thinking-process)。
 * ChatScreenMessage(@ihui/types)仅有 id/role/content,本地扩展 reasoning 字段,
 * 对齐 @ihui/shared ChatMessage.reasoning(chat_messages 表已有该字段)。
 */
interface ChatScreenMessageWithReasoning extends ChatScreenMessage {
  reasoning?: string
}

/**
 * 底部上滑面板列表项配置(对齐 Uniapp function-handle / source-handle 子组件)。
 * function-handle 提供 6 项 AI 功能(切换模型/清空/导出/分享/转语音/收藏);
 * source-handle 提供 4 项知识来源(素材库/网页链接/文件上传/历史对话)。
 */
interface PanelItem {
  key: string
  label: string
  Icon: LucideIcon
  onPress: () => void
}

// ── 转换函数 ──

const toChatScreenMessage = (m: ChatMessage): ChatScreenMessageWithReasoning => ({
  id: m.id,
  role: m.role as 'user' | 'assistant',
  content: m.content,
  // 推理过程随消息一起透传(历史/流式消息均可能带 reasoning,渲染思考过程展开块用)
  reasoning: m.reasoning,
})

const toChatScreenModel = (m: LlmModel): ChatScreenModel => ({
  id: m.id,
  name: m.name,
  provider: m.provider,
  context_length: m.context_length,
  input_price: m.input_price,
})

// ── 常量 ──

const FALLBACK_MODELS: LlmModel[] = SHARED_FALLBACK_MODELS.map((m) => ({
  id: m.value,
  name: m.label,
  provider: m.vendor,
  context_length: 8192,
  input_price: 0,
}))

/** 8 种模型类型按钮(对齐 Uniapp ai_index.vue 的 8 个 model-type-btn) */
const MODEL_TYPES: readonly ModelTypeConfig[] = [
  { key: 'skills', label: '技能', Icon: Sparkles },
  { key: 'talk', label: '对话', Icon: MessageCircle },
  { key: 'image', label: '图片', Icon: ImageIcon },
  { key: 'video', label: '视频', Icon: Video },
  { key: 'audio', label: '音频', Icon: Music },
  { key: 'videoa', label: '视音', Icon: Clapperboard },
  { key: 'other', label: '其他', Icon: Cpu },
  { key: 'sck', label: '素材', Icon: Library },
] as const

/** 素材库分类(对齐 Uniapp MaterialList 的 4 tab:文本/图片/视频/音频) */
const MATERIAL_CATEGORIES: readonly MaterialCategory[] = [
  { key: 'text', label: '文本' },
  { key: 'image', label: '图片' },
  { key: 'video', label: '视频' },
  { key: 'audio', label: '音频' },
] as const

/** 素材分类 tab → getMyCreation API type(对齐 Uniapp getMaterialApiType:
 *  agent=智能体创作(文本)/plugin=插件(图片)/workflow=工作流(视频);audio 无对应类型 → null 空态) */
const materialApiTypeForCategory = (key: string): MyCreationType | null => {
  switch (key) {
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
 *  agent=文本(text 预览)/plugin=图片(agentUrl 缩略图)/workflow=视频(poster/cover 缩略图)) */
const mapMyCreationItem = (it: MyCreationItem, category: string): MaterialItem => {
  // agents 表主键是 agentId(非 id),getMyCreation('agent') 返回原始 agents 行 → id 用 agentId 回退 id
  const itemId = strField(it, 'agentId') || it.id
  if (category === 'image') {
    return {
      id: itemId,
      title: it.name || '图片内容',
      type: 'image' as const,
      url: strField(it, 'agentUrl') || strField(it, 'url') || undefined,
      createdAt: it.createdAt,
    }
  }
  if (category === 'video') {
    return {
      id: itemId,
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
    id: itemId,
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

/** TTS 语音类型选项(P1.1 转语音 Modal,真实 TTS 已接入) */
const TTS_VOICE_OPTIONS: readonly string[] = ['男声', '女声', '儿童'] as const

/** 文件上传支持类型徽章(P1.5,expo-document-picker 未安装,Modal 占位) */
const FILE_TYPE_BADGES: readonly string[] = ['PDF', 'Word', 'Excel', 'TXT'] as const

// DrawerTab 中 home/ai/mine 是 MainStack 路由(走 Main navigator);
// square/share 是 RootStack 路由(直接 navigate,见 handleDrawerNavigate)。

// ── ChatScreen 组件 ──

export function ChatScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const route = useRoute<RouteProp<RootStackParamList, 'Chat'>>()
  const rootNav = navigation.getParent<RootNav>()
  const { user: authUser, logout } = useAuth()
  const { inputFiles, isVoiceMode, onInputAddImage, onInputRemoveFile, onInputVoiceToggle } =
    useChatInput()

  // ── 弹窗/抽屉状态 ──
  const [drawerVisible, setDrawerVisible] = useState(false)
  const [qrCodeVisible, setQrCodeVisible] = useState(false)
  const [shareValueVisible, setShareValueVisible] = useState(false)
  const [shareFirstReward, setShareFirstReward] = useState(0)
  const [showMaterialList, setShowMaterialList] = useState(false)
  const [materialTab, setMaterialTab] = useState<string>('text')
  // 素材库数据(getMyCreation 按分类映射 agent/plugin/workflow 我的创作,对齐 Uniapp loadMaterialContent)
  const [materialItems, setMaterialItems] = useState<MaterialItem[]>([])
  const [materialLoading, setMaterialLoading] = useState(false)
  // ── 素材详情弹窗(点击列表项「详情」→ getMyCreationDetail 按类型查询单条) ──
  const [materialDetailItem, setMaterialDetailItem] = useState<MaterialItem | null>(null)
  const [materialDetailLoading, setMaterialDetailLoading] = useState(false)
  const [materialDetailData, setMaterialDetailData] = useState<Record<string, unknown> | null>(null)
  const [materialDetailError, setMaterialDetailError] = useState<string>('')
  // 接入 ModelConfigDialog / ModelList / AgentList(对齐 Uniapp ai_index.vue 行 32/34/104)
  const [modelConfigVisible, setModelConfigVisible] = useState(false)
  const [modelListVisible, setModelListVisible] = useState(false)
  const [agentListVisible, setAgentListVisible] = useState(false)
  const [modelConfig, setModelConfig] = useState<ModelConfig>({
    temperature: 0.7,
    maxTokens: 2048,
    topP: 0.9,
    systemPrompt: '',
    streamEnabled: true,
  })

  // ── 模型/对话状态 ──
  const [currentModelType, setCurrentModelType] = useState<ModelType | ''>('')
  // 对话页顶部「查看卡片」折叠(对齐 Uniapp ai_index2.vue tishi_show:初始展开,点击 tishiHandle 切换)
  const [tishiShow, setTishiShow] = useState(true)
  // 智汇值卡占位(对齐 Uniapp ai_index2 tokenQuantity;暂无 getTokenCount 接口,占位 0,充值跳 AppTopup)
  const [tokenQuantity] = useState(0)
  const [materialCards, setMaterialCards] = useState<MaterialCard[]>([])
  const [prompt, setPrompt] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  // 消息富内容状态:代码块展开(msgId-partIndex) + 图片全屏预览(对齐 ai_index2 toggleCodeBlock/previewImage)
  const [expandedCodeBlocks, setExpandedCodeBlocks] = useState<Set<string>>(new Set())
  // 思考过程展开状态(msgId,对齐 ai_index2 thinking-process:默认收起,点击标题展开/收起)
  const [expandedThinking, setExpandedThinking] = useState<Set<string>>(new Set())
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null)
  const [models, setModels] = useState<LlmModel[]>(FALLBACK_MODELS)
  const [model, setModel] = useState<string>(FALLBACK_MODELS[0]!.id)
  const [agents, setAgents] = useState<Agent[]>([])

  // ── BottomActionBar 开关(对齐 Uniapp ToggleButtonGroup) ──
  const [superAgentEnabled, setSuperAgentEnabled] = useState(false)
  const [mcpEnabled, setMcpEnabled] = useState(false)
  const [knowledgeBaseEnabled, setKnowledgeBaseEnabled] = useState(false)
  const [permanentMemoryEnabled, setPermanentMemoryEnabled] = useState(false)
  const [superAgentfuEnabled, setSuperAgentfuEnabled] = useState(false)
  const [fangdaVisible, setFangdaVisible] = useState(false)
  // 输入框键盘焦点状态(handleInputFocus/handleInputBlur 维护,供 SharedChatScreen isInputFocused 等 UI 调整)
  const [inputFocused, setInputFocused] = useState(false)
  // 功能面板/来源面板占位弹窗(对齐 Uniapp function-handle / source-handle,后续任务对接真实面板)
  const [functionPanelVisible, setFunctionPanelVisible] = useState<boolean>(false)
  const [sourcePanelVisible, setSourcePanelVisible] = useState<boolean>(false)
  // P1.1 转语音 Modal(语音类型选项 + 真实 TTS loading)
  const [ttsVisible, setTtsVisible] = useState(false)
  const [ttsLoading, setTtsLoading] = useState(false)
  const ttsPlayer = useAudioPlayer(null)
  // P1.2 收藏 UI 状态(不调 API,用 Set 跟踪已收藏消息 id)
  const [favoritedMessageIds, setFavoritedMessageIds] = useState<Set<string>>(new Set())
  // P1.4 网页链接输入 Modal
  const [urlInputVisible, setUrlInputVisible] = useState(false)
  const [urlInputValue, setUrlInputValue] = useState('')
  // P1.5 文件上传 Modal(expo-document-picker 已装,DocumentPicker + uploadFileMultipart 真实上传)
  const [fileUploadVisible, setFileUploadVisible] = useState(false)
  const [fileUploading, setFileUploading] = useState(false)
  // Drawer 历史对话列表(对齐 Uniapp loadHistoryChat → getModelChat API + groupDataByDate)
  const [drawerConversations, setDrawerConversations] = useState<DrawerConversationItem[]>([])
  const [drawerConversationsLoaded, setDrawerConversationsLoaded] = useState(false)
  // 上下文自动压缩提示条(chatAlert.compaction.*):当前无对话上下文压缩逻辑,
  // 仅预留渲染阀门;接入压缩逻辑时 set 前/后条数即可展示真实参数。

  const [compactionInfo, setCompactionInfo] = useState<{
    before: number
    after: number
    removed: number
  } | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  const idCounter = useRef(0)
  const listRef = useRef<FlatList<ChatMessage> | null>(null)
  const materialCardIdCounter = useRef(0)
  const qrCodeViewRef = useRef<View | null>(null)
  // 消息气泡节点 Map(长按截图用,id → 原生节点)
  const messageRefs = useRef<Map<string, View | null>>(new Map())
  const nextId = (): string => `msg-${++idCounter.current}`
  const nextMaterialCardId = (): string => `card-${++materialCardIdCounter.current}`

  // FloatBox 浮层提示状态(替代单按钮 Alert.alert 的非阻塞反馈)
  const [toastVisible, setToastVisible] = useState(false)
  const [toastType, setToastType] = useState<FloatBoxType>('info')
  const [toastMessage, setToastMessage] = useState('')
  const showToast = useCallback(
    (type: FloatBoxType, message: string): void => {
      setToastType(type)
      setToastMessage(message)
      setToastVisible(true)
    },
    [setToastType, setToastMessage, setToastVisible],
  )
  const hideToast = useCallback((): void => setToastVisible(false), [])

  // ── 模型列表加载(保留原 streamChat 链路) ──
  useEffect(() => {
    let cancelled = false
    fetchModels()
      .then((res) => {
        if (cancelled) return
        const list = res?.models?.length ? res.models : FALLBACK_MODELS
        setModels(list)
        const def =
          res.default && list.some((m) => m.id === res.default) ? res.default : list[0]!.id
        setModel(def)
      })
      .catch(() => {
        if (!cancelled) setModels(FALLBACK_MODELS)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // ── Agent 列表加载(对齐 Uniapp getCozeApiList → AgentList) ──
  useEffect(() => {
    let cancelled = false
    getAgents({ status: 'published' })
      .then((res) => {
        if (!cancelled && res.success) setAgents(res.data.list ?? [])
      })
      .catch(() => {
        // 静默失败:Agent 列表非核心功能
      })
    return () => {
      cancelled = true
    }
  }, [])

  /**
   * 加载 Drawer 历史对话(对齐 Uniapp loadHistoryChat → getModelChat API + groupDataByDate)。
   * 懒加载:首次打开 Drawer 时拉取。Drawer 的 groupByModelAndDate 在组件内实现。
   */
  const loadDrawerConversations = useCallback(async (): Promise<void> => {
    const res = await listConversations({ page: 1, pageSize: 50 })
    if (res.success) {
      setDrawerConversations(res.data.conversations.map(mapConversationToDrawer))
    } else {
      setDrawerConversations([])
    }
    setDrawerConversationsLoaded(true)
  }, [])

  // Drawer 首次打开时懒加载历史对话
  useEffect(() => {
    if (drawerVisible && !drawerConversationsLoaded && authUser) {
      void loadDrawerConversations()
    }
  }, [drawerVisible, drawerConversationsLoaded, authUser, loadDrawerConversations])

  // ── 发送消息(send-message 事件) ──
  const send = async (overrideText?: string): Promise<void> => {
    // 登录校验:未登录提示并跳转 Login(logout 触发 RootNavigator 切换到 Login 流)
    if (!authUser) {
      Alert.alert('提示', '请先登录后再发送消息', [
        {
          text: t('chatAlert.loginBtn'),
          onPress: () => {
            void logout()
          },
        },
        { text: '取消', style: 'cancel' },
      ])
      return
    }
    // VIP 校验:付费模型(input_price > 0)需 VIP,非 VIP 提示跳转 Vip
    const currentModelInfo = models.find((m) => m.id === model)
    const isPaidModel = currentModelInfo ? currentModelInfo.input_price > 0 : false
    const isVip = authUser.isVip === 1
    if (isPaidModel && !isVip) {
      Alert.alert('提示', '该模型为 VIP 专享,开通会员后可使用', [
        { text: '开通会员', onPress: () => navigation.navigate('Vip') },
        { text: '取消', style: 'cancel' },
      ])
      return
    }
    // overrideText 用于 P1.4 网页链接发送等场景;onSend 已 wrap 为 () => send() 防止 PressableEvent 传入
    const text = (typeof overrideText === 'string' ? overrideText : prompt).trim()
    if (!text || isStreaming) return
    setPrompt('')
    const userMsg: ChatMessage = { id: nextId(), role: 'user', content: text }
    const aiMsg: ChatMessage = { id: nextId(), role: 'assistant', content: '' }
    const history = [...messages, userMsg]
    setMessages([...history, aiMsg])
    setIsStreaming(true)
    const controller = new AbortController()
    abortRef.current = controller
    const apiMessages = history.map((m) => ({ role: m.role, content: m.content }))
    await streamChat({
      model,
      messages: apiMessages,
      signal: controller.signal,
      // 2026-08-16 修复:显式声明流式,避免后端/中间件对 request.stream 做严格字段检测时关闭 SSE。
      stream: true,
      contextLimit: getModelContextCapacity(model),
      onDelta: (delta) => {
        setMessages((prev) => {
          const next = [...prev]
          const last = next[next.length - 1]
          if (last && last.role === 'assistant') {
            next[next.length - 1] = { ...last, content: last.content + delta }
          }
          return next
        })
      },
      // 2026-08-25 立:思考过程流式同步(对齐 Uniapp ai_index2 thinking-process,
      // 后端 SSE reasoning_content/type==='reasoning' 增量,追加到当前流式 assistant 消息)
      onReasoning: (delta) => {
        setMessages((prev) => {
          const next = [...prev]
          const last = next[next.length - 1]
          if (last && last.role === 'assistant') {
            next[next.length - 1] = { ...last, reasoning: (last.reasoning ?? '') + delta }
          }
          return next
        })
      },
      onError: (err) => {
        const formatted = formatSSEError(new Error(err))
        setIsStreaming(false)
        abortRef.current = null
        if (formatted.severity === 'auth') {
          Alert.alert(formatted.title, formatted.message, [
            { text: '重新登录', onPress: () => logout() },
            { text: '取消', style: 'cancel' },
          ])
        } else {
          showToast('error', formatted.message)
        }
      },
      onDone: () => {
        setIsStreaming(false)
        abortRef.current = null
      },
    })
  }

  const stop = (): void => {
    abortRef.current?.abort()
    abortRef.current = null
    setIsStreaming(false)
  }

  // ── 模型类型按钮点击(对齐 Uniapp handleModelTypeClick / toggleMaterialPopup) ──
  /** 按分类加载素材库(对齐 Uniapp loadMaterialContent;数据源 getMyCreation,按分类映射 API type;
   *  audio 无对应类型 → 空态) */
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

  /** 切素材分类:先切 tab 再加载对应类型数据(对齐 Uniapp handleMaterialTabChange → loadMaterialContent) */
  const handleMaterialCategoryChange = useCallback(
    (key: string): void => {
      setMaterialTab(key)
      loadMaterials(key)
    },
    [loadMaterials],
  )

  const handleModelTypeClick = useCallback(
    (type: ModelType): void => {
      if (type === 'sck') {
        // 素材库:切换弹窗(对齐 Uniapp toggleMaterialPopup)
        setCurrentModelType((prev) => {
          if (prev === 'sck') {
            setShowMaterialList(false)
            return ''
          }
          setShowMaterialList(true)
          // 打开素材库默认切回文本 tab 并加载(对齐 Uniapp materialTab=1 + loadMaterialContent(1))
          setMaterialTab('text')
          void loadMaterials('text')
          return 'sck'
        })
        return
      }
      // 其他类型:切换选中态 + 打开 ModelList 弹窗
      // (对齐 Uniapp handleModelTypeClick 行 698-777:点击类型 → showModelList=true 显示
      // 对应类型模型列表;二次点击同一类型收起。RN 端 ModelList 弹窗按 vendor 分组展示全部
      // 模型,不区分类型,为内联等价实现)
      setCurrentModelType((prev) => {
        if (prev === type) {
          setModelListVisible(false)
          return ''
        }
        setModelListVisible(true)
        setShowMaterialList(false)
        setAgentListVisible(false)
        return type
      })
    },
    [loadMaterials],
  )

  // ── BottomActionBar 核心事件回调(10 个核心) ──

  /** toggle-voice-input:切换语音输入(复用 useChatInput 平台能力) */
  const toggleVoiceInput = (): void => {
    onInputVoiceToggle()
  }

  /** toggle-super-agent:切换超级智能体 */
  const toggleSuperAgent = (): void => {
    setSuperAgentEnabled((prev) => !prev)
  }

  /** toggle-mcp:切换 MCP */
  const toggleMCP = (): void => {
    setMcpEnabled((prev) => !prev)
  }

  /** toggle-knowledge-base:切换知识库 */
  const toggleKnowledgeBase = (): void => {
    setKnowledgeBaseEnabled((prev) => !prev)
  }

  /** toggle-permanent-memory:切换永久记忆 */
  const togglePermanentMemory = (): void => {
    setPermanentMemoryEnabled((prev) => !prev)
  }

  /** toggle-super-agentfu:切换智能体辅(对齐 Uniapp ToggleChip '智能体辅') */
  const toggleSuperAgentfu = (): void => {
    setSuperAgentfuEnabled(!superAgentfuEnabled)
  }

  /** showModelConfig:显示模型配置(对齐 Uniapp ai_index.vue 行 104 ModelConfigDialog) */
  const showModelConfig = (): void => {
    setModelConfigVisible(true)
  }

  /** show-model-list:显示模型列表(对齐 Uniapp ai_index.vue 行 32 ModelList) */
  const showModelList = (): void => {
    setModelListVisible(true)
  }

  /** show-agent-list:显示 Agent 列表(对齐 Uniapp ai_index.vue 行 34 AgentList) */
  const showAgentList = (): void => {
    setAgentListVisible(true)
  }

  /** ChatScreen ModelType → ModelConfigType(ModelConfigDialog 内部用) */
  const getModelConfigType = (): ModelConfigType => {
    switch (currentModelType) {
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

  /** remove-image:删除图片(复用 useChatInput onInputRemoveFile) */
  const removeImage = useCallback(
    (id: string): void => {
      onInputRemoveFile(id)
    },
    [onInputRemoveFile],
  )

  /** update:prompt:更新输入内容 */
  const updatePrompt = (value: string): void => {
    setPrompt(value)
  }

  // ── BottomActionBar 其余事件 stub(对齐 Uniapp 30+ 事件,后续 H22 补全) ──
  // 已挂载到 UI 的:handleInputFocus/handleInputBlur(TextInput)、textareaHeightChange(TextInput onContentSizeChange)
  // H22 接线:handleInputFocus/handleInputBlur 记录键盘焦点状态 inputFocused(供 isInputFocused 等 UI 调整);
  // textareaHeightChange 仅 BottomActionBar 接线(回调带 height 参数),Shared ChatScreen 未接线,保留空实现。
  const handleInputFocus = (): void => setInputFocused(true)
  const handleInputBlur = (): void => setInputFocused(false)
  const textareaHeightChange = (): void => {}

  /** function-handle:打开功能面板(对齐 Uniapp function-handle 子组件,6 项 AI 功能) */
  const handleFunctionHandle = (): void => {
    setFunctionPanelVisible(true)
  }

  /** source-handle:打开来源面板(对齐 Uniapp source-handle 子组件,4 项知识来源) */
  const handleSourceHandle = (): void => {
    setSourcePanelVisible(true)
  }

  /** 文件上传(对齐 Uniapp source-handle 文件上传:DocumentPicker 选文件 → uploadFileMultipart 上传) */
  const handleFileUpload = useCallback(async (): Promise<void> => {
    setFileUploadVisible(false)
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
      setFileUploading(true)
      const up = await uploadFileMultipart({
        uri: asset.uri,
        type: asset.mimeType ?? 'application/octet-stream',
        name: asset.name ?? `file-${Date.now()}`,
      })
      if (up.success && up.data?.path) {
        const fileName = asset.name ?? '文件'
        setPrompt((p) => `${p ? `${p}\n` : ''}[文件] ${fileName} ${resolveFileUrl(up.data!.path)}`)
        showToast('success', `已上传:${fileName}`)
      } else {
        showToast('warning', '文件上传失败')
      }
    } catch {
      showToast('warning', '文件选择失败,请重试')
    } finally {
      setFileUploading(false)
    }
  }, [showToast, setPrompt])

  /** 关闭功能/来源面板 */
  const closeFunctionPanel = (): void => setFunctionPanelVisible(false)
  const closeSourcePanel = (): void => setSourcePanelVisible(false)

  /**
   * P1.1 转语音:打开语音类型选项 Modal,调用真实 TTS 接口并播放生成的音频。
   */
  const openTtsPanel = (): void => {
    setFunctionPanelVisible(false)
    setTtsVisible(true)
  }
  const handleTtsSelect = async (voiceType: string): Promise<void> => {
    const lastAi = [...messages]
      .reverse()
      .find((message) => message.role === 'assistant' && message.content.trim())
    if (!lastAi) {
      setTtsVisible(false)
      showToast('info', '暂无消息可转换')
      return
    }

    setTtsLoading(true)
    try {
      const voice =
        voiceType === '女声' ? 'longyue' : voiceType === '儿童' ? 'longxiaochun' : 'longxiaochun'
      const audio = await fetchTextToSpeechAudio(lastAi.content, voice)
      const audioFile = new File(Paths.cache, `tts-${Date.now()}.mp3`)
      audioFile.write(new Uint8Array(await audio.arrayBuffer()))
      ttsPlayer.replace(audioFile.uri)
      ttsPlayer.play()
      setTtsVisible(false)
      showToast('success', `语音生成成功(${voiceType})`)
    } catch {
      showToast('error', '语音生成失败,请重试')
    } finally {
      setTtsLoading(false)
    }
  }

  /**
   * P1.2 收藏:切换最近一条 assistant 消息的收藏状态。
   * 不调 API,仅用 Set 跟踪 UI 状态 + toast 反馈。
   */
  const toggleFavorite = (): void => {
    setFunctionPanelVisible(false)
    const lastAi = [...messages].reverse().find((m) => m.role === 'assistant' && m.content.trim())
    if (!lastAi) {
      showToast('info', '暂无消息可收藏')
      return
    }
    const isFavorited = favoritedMessageIds.has(lastAi.id)
    setFavoritedMessageIds((prev) => {
      const next = new Set(prev)
      if (isFavorited) next.delete(lastAi.id)
      else next.add(lastAi.id)
      return next
    })
    showToast('success', isFavorited ? '已取消收藏' : '已收藏')
  }

  /**
   * P1.4 网页链接确认:将输入的 URL 作为消息发送。
   * 复用 send(overrideText) 走完整的登录/VIP/流式校验链路。
   */
  const handleUrlConfirm = async (): Promise<void> => {
    const url = urlInputValue.trim()
    setUrlInputVisible(false)
    setUrlInputValue('')
    if (!url) return
    await send(url)
  }

  /** 清空对话(对齐 Uniapp ai_index.vue clearMessages,二次确认 + 重置 messages/materialCards/prompt) */
  const confirmClearMessages = (): void => {
    setFunctionPanelVisible(false)
    if (messages.length === 0) {
      showToast('warning', '当前对话为空')
      return
    }
    Alert.alert('清空对话', '确认清空当前对话的所有消息?', [
      { text: '取消', style: 'cancel' },
      {
        text: '清空',
        style: 'destructive',
        onPress: () => {
          setMessages([])
          setMaterialCards([])
          setPrompt('')
          abortRef.current?.abort()
          abortRef.current = null
          setIsStreaming(false)
        },
      },
    ])
  }

  /** 把当前消息列表格式化为可分享文本(对齐 Uniapp 导出对话格式) */
  const formatMessagesText = useCallback((): string => {
    if (messages.length === 0) return '智汇AI 对话(空)'
    const lines: string[] = ['智汇AI 对话记录', '================']
    messages.forEach((m) => {
      const speaker = m.role === 'user' ? '我' : m.role === 'assistant' ? 'AI' : m.role
      lines.push(`【${speaker}】${m.content}`)
    })
    return lines.join('\n')
  }, [messages])

  // ── 分享领智汇值弹窗(对齐 Uniapp showSharePointsPopup / first/share/show) ──
  // 触发:任意分享动作成功后自动检查首次分享奖励(未领取则弹窗);领取走 /api/share/first-claim(幂等)。
  const hideSharePoints = (): void => setShareValueVisible(false)

  /** 首次分享奖励自动触发:分享成功后查询未领取状态,可领则弹分享领智汇值弹窗 */
  const maybeTriggerFirstShareReward = useCallback(async (): Promise<void> => {
    try {
      const res = await getShareFirstStatus()
      if (res.success && res.data.canClaim) {
        setShareFirstReward(res.data.rewardPoints)
        setShareValueVisible(true)
      }
    } catch {
      // 接口异常静默降级,不阻塞分享流程
    }
  }, [])

  /** 导出对话(对齐 Uniapp handleExport,调 Share.share 分享对话文本) */
  const handleExportMessages = async (): Promise<void> => {
    setFunctionPanelVisible(false)
    try {
      await Share.share({ message: formatMessagesText() })
      void maybeTriggerFirstShareReward()
    } catch {
      // 用户取消分享,静默处理
    }
  }

  /** 分享对话(对齐 Uniapp handleShareChat,与导出共用 Share.share,语义独立) */
  const handleShareChat = async (): Promise<void> => {
    setFunctionPanelVisible(false)
    try {
      await Share.share({ message: formatMessagesText() })
      void maybeTriggerFirstShareReward()
    } catch {
      // 用户取消分享,静默处理
    }
  }

  /**
   * function-handle 面板 6 项列表(对齐 Uniapp function-handle 子组件)。
   * 1. 切换模型 → 复用 ModelList 弹窗(setModelListVisible)
   * 2. 清空对话 → Alert 二次确认
   * 3. 导出对话 → Share.share 分享对话文本
   * 4. 分享对话 → Share.share(语义独立,UI 入口分离)
   * 5. 转语音 → 占位提示(后续接 TTS)
   * 6. 收藏 → 占位提示(后续接收藏 API)
   */
  const functionPanelItems: readonly PanelItem[] = [
    {
      key: 'switch-model',
      label: '切换模型',
      Icon: RefreshCw,
      onPress: () => {
        setFunctionPanelVisible(false)
        setModelListVisible(true)
      },
    },
    {
      key: 'clear-messages',
      label: '清空对话',
      Icon: Trash2,
      onPress: confirmClearMessages,
    },
    {
      key: 'export',
      label: '导出对话',
      Icon: Download,
      onPress: () => {
        void handleExportMessages()
      },
    },
    {
      key: 'share',
      label: '分享对话',
      Icon: Share2,
      onPress: () => {
        void handleShareChat()
      },
    },
    {
      key: 'tts',
      label: '转语音',
      Icon: Volume2,
      onPress: openTtsPanel,
    },
    {
      key: 'favorite',
      label: '收藏',
      Icon: Star,
      onPress: toggleFavorite,
    },
  ]

  /**
   * source-handle 面板 4 项列表(对齐 Uniapp source-handle 子组件)。
   * 1. 素材库 → 占位提示(后续接 MaterialList 列表)
   * 2. 网页链接 → 占位提示(后续接输入弹窗)
   * 3. 文件上传 → 占位提示(后续接 DocumentPicker)
   * 4. 历史对话 → 复用 Drawer(setDrawerVisible)
   */
  const sourcePanelItems: readonly PanelItem[] = [
    {
      key: 'material',
      label: '素材库',
      Icon: BookOpen,
      onPress: () => {
        // P1.3:复用 sck 模型类型 + MaterialList 弹窗
        setSourcePanelVisible(false)
        setCurrentModelType('sck')
        setShowMaterialList(true)
      },
    },
    {
      key: 'web-link',
      label: '网页链接',
      Icon: Link,
      onPress: () => {
        // P1.4:打开 URL 输入 Modal
        setSourcePanelVisible(false)
        setUrlInputVisible(true)
      },
    },
    {
      key: 'file-upload',
      label: '文件上传',
      Icon: Paperclip,
      onPress: () => {
        // P1.5:打开文件选择 Modal(DocumentPicker + uploadFileMultipart 真实上传)
        setSourcePanelVisible(false)
        setFileUploadVisible(true)
      },
    },
    {
      key: 'history',
      label: '历史对话',
      Icon: MessageSquare,
      onPress: () => {
        setSourcePanelVisible(false)
        setDrawerVisible(true)
      },
    },
  ]

  /**
   * icon-click:图标按钮点击(相机/相册/文件)。
   * BottomActionBar onIconClick 签名为 () => void,三个图标共用同一回调。
   * 复用 useChatInput 的 onInputAddImage(expo-image-picker launchImageLibraryAsync)。
   * 后续 BottomActionBar 支持 type 参数后可按 camera/album/file 分发。
   */
  const handleIconClick = (): void => {
    onInputAddImage()
  }

  /** fangda:放大输入区(切换展开状态,占位提示) */
  const handleFangda = (): void => {
    setFangdaVisible(!fangdaVisible)
  }

  // 以下事件无对应 UI 触发点(ModelList 弹窗/键盘监听等未实现),待 H22 补全:
  // start-long-press / end-long-press / input-click / start-voice-animation / stop-voice-animation /
  // modelConfigChange / keyboard-show / keyboard-hide

  // ── 共享组件渲染回调 ──

  /** 领取首次分享奖励(幂等:已领过后端返回 409) */
  const handleClaimShareReward = async (): Promise<void> => {
    try {
      const res = await claimShareFirstReward()
      hideSharePoints()
      if (res.success) {
        showToast('success', `已领取 ${res.data.points} 智汇值`)
      } else {
        showToast('info', res.error ?? '已领取过首次分享奖励')
      }
    } catch {
      showToast('error', '领取失败,请稍后重试')
    }
  }

  // ── 长按消息:截图 + 分享(chatAlert.longPress.*) ──
  // 复用 shared ChatScreen 已接好的 onLongPress 传递;此处通过 renderMessage 的 Pressable 触发。
  const handleLongPressMessage = useCallback(
    async (msg: ChatScreenMessage): Promise<void> => {
      let uri: string | undefined
      const node = messageRefs.current.get(msg.id)
      if (node) {
        try {
          uri = await captureRef(node, { format: 'png', quality: 0.9 })
        } catch {
          uri = undefined
        }
      }
      const title =
        msg.role === 'user' ? t('chatAlert.longPress.myTitle') : t('chatAlert.longPress.aiTitle')
      const shareText = uri ? { url: uri, message: msg.content } : { message: msg.content }
      Alert.alert(title, t('chatAlert.longPress.message'), [
        {
          text: t('chatAlert.longPress.shareBtn'),
          onPress: () => {
            void Share.share(shareText).catch(() => undefined)
          },
        },
        { text: t('common.cancel'), style: 'cancel' },
      ])
    },
    [t],
  )

  const renderMessage = useCallback(
    (item: ChatScreenMessage, _index: number): React.ReactNode => {
      const isUser = item.role === 'user'
      const isLastMessage = messages.length > 0 && item.id === messages[messages.length - 1]?.id
      const showActions = !isUser && item.content.trim() !== '' && !(isStreaming && isLastMessage)
      // 富内容分段(代码块/图片/文本,对齐 ai_index2 agent_content_list;消息内容不长,直接解析)
      const segments = parseMessageContent(item.content)
      // 思考过程(对齐 ai_index2 thinking-process:assistant 消息带 reasoning 时渲染折叠区块,
      // 默认收起只显示标题行;reasoning 由 toChatScreenMessage 映射透传)
      const reasoning = !isUser ? ((item as ChatScreenMessageWithReasoning).reasoning ?? '') : ''
      const thinkingKey = item.id
      const thinkingExpanded = expandedThinking.has(thinkingKey)
      return (
        <View style={[styles.msgRow, isUser ? styles.msgRowUser : styles.msgRowAi]}>
          <View style={styles.msgContent}>
            <Pressable
              ref={(el) => {
                if (el) messageRefs.current.set(item.id, el)
                else messageRefs.current.delete(item.id)
              }}
              onLongPress={() => void handleLongPressMessage(item)}
              delayLongPress={500}
              style={[styles.msgBubble, isUser ? styles.msgBubbleUser : styles.msgBubbleAi]}
            >
              {reasoning.trim() !== '' ? (
                <View style={styles.thinkingBlock}>
                  <Pressable
                    style={styles.thinkingHeader}
                    hitSlop={6}
                    onPress={() =>
                      setExpandedThinking((prev) => {
                        const next = new Set(prev)
                        if (next.has(thinkingKey)) next.delete(thinkingKey)
                        else next.add(thinkingKey)
                        return next
                      })
                    }
                    accessibilityRole="button"
                    accessibilityLabel={thinkingExpanded ? '收起思考过程' : '展开思考过程'}
                  >
                    <Text style={styles.thinkingTitle}>💭 思考过程</Text>
                    <Text style={styles.thinkingToggle}>{thinkingExpanded ? '收起' : '展开'}</Text>
                  </Pressable>
                  {thinkingExpanded ? (
                    <Text style={styles.thinkingContent} selectable>
                      {reasoning}
                    </Text>
                  ) : null}
                </View>
              ) : null}
              {segments.map((seg, segIndex) => {
                if (seg.type === 'image') {
                  return (
                    <Pressable
                      key={`${item.id}-img-${segIndex}`}
                      onPress={() => setPreviewImageUrl(seg.url)}
                      style={styles.msgImageWrap}
                    >
                      <Image
                        source={{ uri: seg.url }}
                        style={styles.msgImage}
                        resizeMode="cover"
                        accessibilityLabel="消息图片,点击预览"
                      />
                    </Pressable>
                  )
                }
                if (seg.type === 'code') {
                  const codeKey = `${item.id}-${segIndex}`
                  const expanded = expandedCodeBlocks.has(codeKey)
                  return (
                    <View key={`${item.id}-code-${segIndex}`} style={styles.codeBlock}>
                      <View style={styles.codeBlockHeader}>
                        <Text style={styles.codeBlockLang} numberOfLines={1}>
                          {seg.language || 'code'}
                        </Text>
                        <View style={styles.codeBlockActions}>
                          <TouchableOpacity
                            style={styles.codeBlockBtn}
                            hitSlop={6}
                            onPress={() => {
                              Clipboard.setString(seg.code)
                              showToast('success', '已复制')
                            }}
                            accessibilityRole="button"
                            accessibilityLabel="复制代码"
                          >
                            <Copy size={13} color="#e8e8e8" />
                            <Text style={styles.codeBlockBtnText}>复制</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.codeBlockBtn}
                            hitSlop={6}
                            onPress={() =>
                              setExpandedCodeBlocks((prev) => {
                                const next = new Set(prev)
                                if (next.has(codeKey)) next.delete(codeKey)
                                else next.add(codeKey)
                                return next
                              })
                            }
                            accessibilityRole="button"
                            accessibilityLabel={expanded ? '收起代码' : '展开代码'}
                          >
                            <Text style={styles.codeBlockBtnText}>
                              {expanded ? '收起' : '展开'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                      {expanded ? (
                        <Text style={styles.codeBlockContent} selectable>
                          {seg.code}
                        </Text>
                      ) : (
                        <Text style={styles.codeBlockContent} numberOfLines={4}>
                          {seg.code}
                        </Text>
                      )}
                    </View>
                  )
                }
                return (
                  <Text
                    key={`${item.id}-text-${segIndex}`}
                    style={[styles.msgText, isUser ? styles.msgTextUser : styles.msgTextAi]}
                  >
                    {seg.text}
                  </Text>
                )
              })}
              {segments.length === 0 ? (
                <Text style={[styles.msgText, isUser ? styles.msgTextUser : styles.msgTextAi]}>
                  {item.content || (isStreaming && !isUser ? '正在思考…' : item.content)}
                </Text>
              ) : null}
            </Pressable>
            {showActions ? (
              <View style={styles.msgActions}>
                <TouchableOpacity
                  style={styles.msgActionBtn}
                  hitSlop={8}
                  onPress={() => {
                    Clipboard.setString(item.content)
                    showToast('success', '已复制')
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="复制"
                >
                  <Copy size={16} color={tokens.text.secondary} />
                  <Text style={styles.msgActionText}>复制</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.msgActionBtn}
                  hitSlop={8}
                  onPress={() => {
                    void Share.share({ message: item.content }).then(() => {
                      void maybeTriggerFirstShareReward()
                    })
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="分享"
                >
                  <Share2 size={16} color={tokens.text.secondary} />
                  <Text style={styles.msgActionText}>分享</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </View>
      )
    },
    [
      messages,
      isStreaming,
      expandedCodeBlocks,
      expandedThinking,
      maybeTriggerFirstShareReward,
      showToast,
      handleLongPressMessage,
    ],
  )

  const renderListHeader = useCallback((): React.ReactNode => {
    const nodes: React.ReactNode[] = []
    // 对话页顶部「查看卡片」折叠区(对齐 Uniapp ai_index2.vue 行 117-131:tishi_block + intelligent-assistant)
    nodes.push(
      <View key="tishi-block" style={styles.tishiBlock}>
        <Pressable
          style={styles.tishiBtn}
          onPress={() => setTishiShow((v) => !v)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={tishiShow ? '关闭卡片' : '查看卡片'}
        >
          <Text style={styles.tishiBtnText}>{tishiShow ? '关闭' : '查看'}卡片</Text>
        </Pressable>
        {tishiShow ? (
          <View style={styles.tishiCardWrap}>
            <IntelligentAssistant
              tokenQuantity={tokenQuantity}
              onRecharge={() => navigation.navigate('AppTopup')}
            />
          </View>
        ) : null}
      </View>,
    )
    if (compactionInfo) {
      nodes.push(
        <View style={styles.compactionBanner}>
          <Text style={styles.compactionTitle}>{t('chatAlert.compaction.title')}</Text>
          <Text style={styles.compactionMessage}>
            {t('chatAlert.compaction.message', {
              before: compactionInfo.before,
              after: compactionInfo.after,
              removed: compactionInfo.removed,
            })}
          </Text>
        </View>,
      )
    }
    if (materialCards.length > 0) {
      nodes.push(
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.materialCardsScroll}
          contentContainerStyle={styles.materialCardsContent}
        >
          {materialCards.map((card) => (
            <View key={card.id} style={styles.materialCard}>
              <Pressable
                hitSlop={8}
                onPress={() => removeMaterialCard(card.id)}
                style={styles.materialCardClose}
                accessibilityLabel="删除素材"
              >
                <X size={12} color={tokens.surface.light} />
              </Pressable>
              <Text style={styles.materialCardTitle} numberOfLines={1}>
                {card.title}
              </Text>
              <Text style={styles.materialCardPreview} numberOfLines={1}>
                {card.content ? card.content.slice(0, 20) : `类型${card.type}`}
              </Text>
            </View>
          ))}
        </ScrollView>,
      )
    }
    if (inputFiles.length > 0) {
      nodes.push(
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.imgsListScroll}
          contentContainerStyle={styles.imgsListContent}
        >
          {inputFiles.map((file) => (
            <View key={file.id} style={styles.imgsListItem}>
              <Pressable
                hitSlop={8}
                onPress={() => removeImage(file.id)}
                style={styles.imgsListClose}
                accessibilityLabel="删除图片"
              >
                <X size={10} color={tokens.surface.light} />
              </Pressable>
            </View>
          ))}
        </ScrollView>,
      )
    }
    return nodes.length > 0 ? <>{nodes}</> : null
  }, [
    materialCards,
    inputFiles,
    removeImage,
    compactionInfo,
    t,
    tishiShow,
    tokenQuantity,
    navigation,
  ])

  const renderListFooter = useCallback((): React.ReactNode => {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.modelTypeScroll}
        contentContainerStyle={styles.modelTypeContent}
      >
        {MODEL_TYPES.map(({ key, label, Icon }) => {
          const active = currentModelType === key
          return (
            <Pressable
              key={key}
              onPress={() => handleModelTypeClick(key)}
              style={[styles.modelTypeBtn, active ? styles.modelTypeBtnActive : null]}
              accessibilityLabel={label}
            >
              <Icon size={24} color={active ? tokens.brand.DEFAULT : tokens.text.secondary} />
              <Text style={[styles.modelTypeLabel, active ? styles.modelTypeLabelActive : null]}>
                {label}
              </Text>
            </Pressable>
          )
        })}
      </ScrollView>
    )
  }, [currentModelType, handleModelTypeClick])

  // ── 二维码弹窗(对齐 Uniapp showQrCode / hideQrCode) ──
  const showQrCode = (): void => setQrCodeVisible(true)
  const hideQrCode = (): void => setQrCodeVisible(false)
  const handleLongPressQrCode = async (): Promise<void> => {
    try {
      const perm = await MediaLibrary.requestPermissionsAsync()
      if (!perm.granted) {
        showToast('warning', '需要相册权限才能保存二维码')
        return
      }
      if (!qrCodeViewRef.current) {
        showToast('error', '二维码未渲染,请稍后重试')
        return
      }
      const uri = await captureRef(qrCodeViewRef, { format: 'png', quality: 1 })
      await MediaLibrary.saveToLibraryAsync(uri)
      showToast('success', '二维码已保存到相册')
    } catch {
      showToast('error', '保存失败,请重试')
    }
  }

  // ── 跳转个人中心(对齐 Uniapp goToMyPage,Share2 按钮承载 share-image 跳转) ──
  const goToMyPage = (): void => {
    rootNav?.navigate('Main', { screen: 'ProfileMain' })
  }
  const handleShareClick = async (): Promise<void> => {
    try {
      await Share.share({ message: '智汇AI社区 — 邀请你加入,一起探索 AI 对话!' })
    } catch {
      // 用户取消分享,静默处理
    }
  }

  // ── Material 卡片操作(对齐 Uniapp handleMaterialItemClick / removeMaterialCard) ──
  const handleMaterialItemClick = (id: string): void => {
    // 素材库选中 → 引入到 materialCards(对齐 Uniapp handleMaterialItemClick)
    // 注:MaterialList 组件 items 是 MaterialItem(无 content/imageList),这里用占位卡片
    const card: MaterialCard = {
      id: nextMaterialCardId(),
      type: 1,
      title: `素材 ${id}`,
      content: '',
    }
    setMaterialCards((prev) => [...prev, card])
    setShowMaterialList(false)
    setCurrentModelType('')
  }
  /** 素材长按删除(对齐 Uniapp MaterialList 删除;后端 DELETE /agents/:agentId) */
  const handleMaterialDelete = useCallback(
    (item: MaterialItem): void => {
      Alert.alert('删除素材', `确认删除「${item.title}」？`, [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: () => {
            void deleteAgent(item.id)
              .then((res) => {
                if (res.success) {
                  setMaterialItems((prev) => prev.filter((m) => m.id !== item.id))
                  showToast('success', '已删除')
                } else {
                  showToast('warning', '删除失败')
                }
              })
              .catch(() => showToast('warning', '删除失败'))
          },
        },
      ])
    },
    [showToast],
  )
  /** 素材详情弹窗:按当前分类 tab 推导 API type,getMyCreationDetail 拉取单条后展示
   *  audio 无对应类型 → toast 提示;失败置 error,弹窗内提供重试 */
  const handleMaterialDetail = useCallback(
    (item: MaterialItem): void => {
      const apiType = materialApiTypeForCategory(materialTab)
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
            setMaterialDetailError(res.error ?? '加载详情失败')
          }
        })
        .catch(() => setMaterialDetailError('网络异常,加载失败'))
        .finally(() => setMaterialDetailLoading(false))
    },
    [materialTab, showToast],
  )

  /** 关闭素材详情弹窗并清空数据 */
  const closeMaterialDetail = useCallback((): void => {
    setMaterialDetailItem(null)
    setMaterialDetailData(null)
    setMaterialDetailError('')
    setMaterialDetailLoading(false)
  }, [])

  const removeMaterialCard = (id: string): void => {
    setMaterialCards((prev) => prev.filter((c) => c.id !== id))
  }

  // ── Drawer 回调 ──
  const closeDrawer = (): void => setDrawerVisible(false)
  const handleDrawerNavigate = (tab: DrawerTab): void => {
    // square/share 是 RootStack 路由(非 Main),直接 navigate 到根路由
    if (tab === 'square') {
      navigation.navigate('Plaza')
      return
    }
    if (tab === 'share') {
      navigation.navigate('News')
      return
    }
    // home/ai/mine 是 MainStack 路由,通过 Main navigator 跳转
    // DrawerTab('mine'等)必须先映射成 RN Tab 路由名('ProfileMain'),直接 cast 会静默跳转失败
    rootNav?.navigate('Main', { screen: mainScreenForTab(DRAWER_TAB_TO_RN_TAB[tab]) })
  }
  const handleDrawerNavigateCompany = (): void => {
    // 一人公司:跳 Distribution 路由(已在 RootNavigator 注册,对齐 Uniapp gotocompany)
    navigation.navigate('Distribution')
  }
  const handleDrawerClaimFree = (): void => {
    // 复制飞书免费资料链接到剪贴板 + FloatBox 提示
    const feishuUrl =
      'https://aizhihuishe.feishu.cn/wiki/GPs7wff9PiDekQkKvBncryrmnIh?from=from_copylink'
    Clipboard.setString(feishuUrl)
    showToast('success', '链接已复制到剪贴板,可在浏览器粘贴打开')
  }
  const handleDrawerCreateNewChat = (): void => {
    setMessages([])
    setPrompt('')
    setMaterialCards([])
    setCompactionInfo(null)
  }
  /** 加载历史对话消息并填入当前消息列表(对齐 Uniapp handleShowFullList) */
  const loadConversationMessages = useCallback(
    async (id: string): Promise<void> => {
      const res = await getMessages(id, { page: 1, pageSize: 100 })
      if (res.success) {
        const loaded: ChatMessage[] = res.data.messages.map((m, idx) => ({
          id: `${m.id}-${idx}`,
          role: m.role,
          content: m.content,
          // 历史消息思考过程透传(chat_messages.reasoning,供思考过程展开块渲染)
          reasoning: m.reasoning,
        }))
        setMessages(loaded)
        setPrompt('')
        setMaterialCards([])
        requestAnimationFrame(() => {
          listRef.current?.scrollToEnd({ animated: true })
        })
      } else {
        showToast('error', '加载历史对话失败,请重试')
      }
    },
    [showToast],
  )

  // 从 ProfileScreen Drawer 跳转时携带 conversationId,自动加载对应对话
  useEffect(() => {
    const conversationId = route.params?.conversationId
    if (conversationId) void loadConversationMessages(conversationId)
  }, [route.params?.conversationId, loadConversationMessages])

  // ── 分享智汇值弹窗自动触发(对齐 Uniapp checkFirstShareStatus API 自动检查) ──
  // Uniapp:用户进页面时若未领过智汇值则由 API 自动弹出 share-points 弹窗。
  // mobile-rn:Share2 按钮改为跳个人中心(对齐 goToMyPage),弹窗改由本 effect 自动触发。
  //
  // 待后端积分系统接入后启用(接口契约,对齐原项目 /resource/first/share/show):
  //   GET  /api/user/share/first-status → { data: { claimed: boolean } }  // 是否已领
  //   POST /api/user/share/first-claim   → { data: { granted: number } }  // 领取智汇值
  // 前端接入点(放开下方注释即启用):
  //   useEffect(() => {
  //     void (async () => {
  //       const res = await fetchApi<{ claimed: boolean }>('/api/user/share/first-status')
  //       if (res.success && res.data && !res.data.claimed) setShareValueVisible(true)
  //     })()
  //   }, [])
  // 关闭弹窗时若用户已分享,调 POST /api/user/share/first-claim 完成领取;
  // 当前不自动弹出(避免"弹了但领不到"误导,符合禁空承诺铁律)。

  const handleDrawerSelectConversation = (id: string): void => {
    setDrawerVisible(false)
    void loadConversationMessages(id)
  }
  const handleDrawerDeleteConversation = (id: string): void => {
    Alert.alert('删除对话', '确认删除此对话?', [
      { text: '取消', style: 'cancel' },
      {
        text: '确认',
        style: 'destructive',
        onPress: () => {
          // 乐观删除:先从本地列表移除,API 失败时回滚
          const snapshot = drawerConversations
          setDrawerConversations((prev) => prev.filter((c) => c.id !== id))
          void (async () => {
            const res = await deleteConversation(id)
            if (!res.success) {
              setDrawerConversations(snapshot)
              showToast('error', '删除失败,请重试')
            }
          })()
        },
      },
    ])
  }
  const handleDrawerOpenSettings = (): void => {
    navigation.navigate('Settings')
  }
  const handleDrawerOpenMessages = (): void => {
    navigation.navigate('MessageCenter')
  }
  const handleDrawerGoHome = (): void => {
    navigation.navigate('Main', { screen: 'HomeMain' })
  }
  const handleNavigateExtra = (menu: DrawerExtraMenu): void => {
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
      case 'assistant':
        navigation?.navigate('Assistant')

        break

      case 'tools':
        navigation.navigate('Settings')
        break
    }
  }

  // ── Drawer user 映射(AuthUser → Drawer user) ──
  const drawerUser = {
    avatar: authUser?.avatar,
    nickname: authUser?.nickname ?? authUser?.username ?? '未登录',
    level: (authUser?.isVip === 1 ? 'vip' : 'normal') as 'vip' | 'normal',
  }

  // ── 素材库列表(getMyCreation 按分类映射 agent/plugin/workflow 我的创作,对齐 Uniapp loadMaterialContent) ──
  // (materialItems/materialLoading 为 state,见组件顶部)

  // ── ModelList groups(由 models 派生,对齐 Uniapp ModelList 按 vendor 分组) ──
  const modelListGroups: ModelListGroup[] =
    models.length > 0
      ? [
          {
            vendor: '可用模型',
            models: models.map((m) => ({
              id: m.id,
              name: m.name,
              description: m.provider ?? '',
              icon: '🤖',
              isFree: !m.input_price,
            })),
          },
        ]
      : []

  // ── AgentList items(由 agents 派生,对齐 Uniapp getCozeApiList → AgentList) ──
  const agentListItems: AgentListItem[] = agents.map((a) => ({
    id: a.id,
    name: a.name,
    avatar: a.avatar ?? undefined,
    description: a.description,
    category: a.category,
  }))

  // ── AgentList 选中回调 ──
  const handleAgentSelect = (id: string): void => {
    setAgentListVisible(false)
    // 对齐 Uniapp:Agent 选中后跳 AiAssistant 传 agentId 参数
    // (AiAssistant 路由 params 已更新为 { agentId?: string; title?: string })
    // 对齐 Uniapp ai_index.vue handleAgentPitch → /pages/tools/ai_assistant(智能体对话页)
    navigation.navigate('AiAssistantN8n', { agentId: id })
  }

  // BottomActionBar 已切换到 prompt 模式(模型条 + 开关 + 输入 + 发送 + 辅助行 + 图标组)
  // bottomActions 旧 API 已移除,所有交互通过 prompt 模式 props 传入

  // ── 共享组件数据准备 ──
  const sharedModels: ChatScreenModel[] = models.map(toChatScreenModel)
  const sharedMessages: ChatScreenMessageWithReasoning[] = messages
    .filter((m) => m.role !== 'system')
    .map(toChatScreenMessage)

  return (
    <View style={styles.root}>
      {/* 推送通知弹窗(对齐 Uniapp 顶层 PushNotification,组件自管 visible) */}
      <NotificationPanel />

      {/* 顶部导航区(对齐 Uniapp navigation-bars:菜单 + 标题 + 加入) */}
      <NavBar
        title="智汇AI"
        rightAction={
          <View style={styles.navRight}>
            <Pressable
              hitSlop={8}
              onPress={() => setDrawerVisible(true)}
              accessibilityLabel="打开菜单"
            >
              <Menu size={22} color={tokens.text.primary} />
            </Pressable>
            <Pressable hitSlop={8} onPress={showAgentList} accessibilityLabel="选择 Agent">
              <Bot size={22} color={tokens.text.primary} />
            </Pressable>
            <Pressable hitSlop={8} onPress={goToMyPage} accessibilityLabel="个人中心">
              <Share2 size={22} color={tokens.text.primary} />
            </Pressable>
            <Pressable hitSlop={8} onPress={showQrCode} accessibilityLabel="加入社区">
              <QrCode size={22} color={tokens.text.primary} />
            </Pressable>
          </View>
        }
      />

      <KeyboardAvoidingView
        style={styles.body}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <SharedChatScreen
          t={t}
          messages={sharedMessages}
          inputText={prompt}
          isStreaming={isStreaming}
          error=""
          models={sharedModels}
          model={model}
          pickerOpen={false}
          navItems={[]}
          inputFiles={inputFiles}
          isInputFocused={inputFocused}
          isInputFullscreen={false}
          isVoiceMode={isVoiceMode}
          isRecording={false}
          isSending={isStreaming}
          inputError=""
          showHeader={false}
          showModelBar={false}
          showInput={false}
          renderMessage={renderMessage}
          renderListHeader={renderListHeader() as React.ReactNode}
          renderListFooter={renderListFooter() as React.ReactNode}
          itemSeparatorComponent={null}
          containerStyle={{ flex: 1 }}
          flatListStyle={{ flex: 1 }}
          onListRef={(ref) => {
            listRef.current = ref as FlatList<ChatMessage> | null
          }}
          onInputTextChange={updatePrompt}
          onSend={() => send()}
          onStop={stop}
          onModelChange={setModel}
          // 共享层 onPickerOpenChange 语义=模型选择器开关(showModelBar 点开/关闭),
          // RN 端对应 ModelList 弹窗(modelListVisible,showModelBar=false 时不会被触发)
          onPickerOpenChange={(open) => setModelListVisible(open)}
          onLongPressMessage={(msg) => void handleLongPressMessage(msg)}
          onInputFocus={handleInputFocus}
          onInputBlur={handleInputBlur}
          onInputFullscreenToggle={handleFangda}
          onInputVoiceToggle={onInputVoiceToggle}
          onInputAddImage={onInputAddImage}
          onInputAddFile={() => void handleFileUpload()}
          onInputRemoveFile={onInputRemoveFile}
          onInputClear={() => {}}
          onInputVoiceStart={() => {}}
          onInputVoiceEnd={() => {}}
        />
        <BottomActionBar
          prompt={prompt}
          onPromptChange={updatePrompt}
          onSend={isStreaming ? stop : () => send()}
          modelName={models.find((m) => m.id === model)?.name}
          onShowModelList={showModelList}
          onShowModelConfig={showModelConfig}
          onToggleSuperAgent={toggleSuperAgent}
          onToggleSuperAgentfu={toggleSuperAgentfu}
          onToggleMcp={toggleMCP}
          onToggleKnowledgeBase={toggleKnowledgeBase}
          onTogglePermanentMemory={togglePermanentMemory}
          onToggleVoiceInput={toggleVoiceInput}
          onRemoveImage={
            inputFiles.length > 0 ? () => onInputRemoveFile(inputFiles[0]!.id) : undefined
          }
          onInputFocus={handleInputFocus}
          onInputBlur={handleInputBlur}
          onFunctionHandle={handleFunctionHandle}
          onSourceHandle={handleSourceHandle}
          onIconClick={handleIconClick}
          onFangda={handleFangda}
          onTextareaHeightChange={textareaHeightChange}
          superAgentEnabled={superAgentEnabled}
          mcpEnabled={mcpEnabled}
          knowledgeBaseEnabled={knowledgeBaseEnabled}
          permanentMemoryEnabled={permanentMemoryEnabled}
          voiceInputEnabled={isVoiceMode}
          images={inputFiles.filter((f) => f.type === 'image').map((f) => f.url)}
          isLoading={isStreaming}
          isShowIcon={functionPanelVisible || sourcePanelVisible}
        />
      </KeyboardAvoidingView>

      {/* 素材库弹窗(sck 点击,对齐 Uniapp showMaterialList + MaterialList 组件) */}
      {showMaterialList ? (
        <Modal
          visible={showMaterialList}
          transparent
          animationType="slide"
          onRequestClose={() => {
            setShowMaterialList(false)
            setCurrentModelType('')
          }}
        >
          <Pressable
            style={styles.modalMask}
            onPress={() => {
              setShowMaterialList(false)
              setCurrentModelType('')
            }}
          >
            <Pressable style={styles.materialPopup} onPress={(e) => e.stopPropagation()}>
              <View style={styles.materialPopupHeader}>
                <Text style={styles.materialPopupTitle}>我的创作</Text>
                <Pressable
                  hitSlop={8}
                  onPress={() => {
                    setShowMaterialList(false)
                    setCurrentModelType('')
                  }}
                >
                  <X size={20} color={tokens.text.secondary} />
                </Pressable>
              </View>
              <MaterialList
                categories={[...MATERIAL_CATEGORIES]}
                activeCategory={materialTab}
                onCategoryChange={handleMaterialCategoryChange}
                items={materialItems}
                onPress={handleMaterialItemClick}
                onDelete={handleMaterialDelete}
                onDetail={handleMaterialDetail}
                loading={materialLoading}
              />
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}

      {/* 素材详情弹窗(点击列表项「详情」→ getMyCreationDetail;居中对话框,复用 listDialog 样式) */}
      <Modal
        visible={materialDetailItem !== null}
        transparent
        animationType="fade"
        onRequestClose={closeMaterialDetail}
      >
        <Pressable style={styles.modalMask} onPress={closeMaterialDetail}>
          <Pressable style={styles.listDialogContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.listDialogHeader}>
              <Text style={styles.listDialogTitle} numberOfLines={1}>
                {materialDetailItem?.title ?? '素材详情'}
              </Text>
              <Pressable hitSlop={8} onPress={closeMaterialDetail} style={styles.listDialogClose}>
                <X size={18} color={tokens.text.secondary} />
              </Pressable>
            </View>
            <View style={styles.detailDialogBody}>
              {materialDetailLoading ? (
                <ActivityIndicator size="small" color={tokens.brand.DEFAULT} />
              ) : materialDetailError ? (
                <View style={styles.detailDialogErrorWrap}>
                  <Text style={styles.detailDialogErrorText}>{materialDetailError}</Text>
                  <Pressable
                    onPress={() => materialDetailItem && handleMaterialDetail(materialDetailItem)}
                    style={styles.detailDialogRetryBtn}
                  >
                    <Text style={styles.detailDialogRetryText}>重试</Text>
                  </Pressable>
                </View>
              ) : materialDetailData ? (
                <ScrollView style={styles.detailDialogScroll}>
                  {MATERIAL_DETAIL_FIELDS.map((f) => {
                    const value = formatDetailValue(materialDetailData[f.key])
                    if (!value) return null
                    return (
                      <View key={f.key} style={styles.detailDialogFieldRow}>
                        <Text style={styles.detailDialogFieldLabel}>{f.label}</Text>
                        <Text style={styles.detailDialogFieldValue}>{value}</Text>
                      </View>
                    )
                  })}
                </ScrollView>
              ) : null}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* 二维码弹窗(对齐 Uniapp qr-code-modal) */}
      <Modal visible={qrCodeVisible} transparent animationType="fade" onRequestClose={hideQrCode}>
        <Pressable style={styles.modalMask} onPress={hideQrCode}>
          <Pressable style={styles.qrCodeContent} onPress={(e) => e.stopPropagation()}>
            <Pressable hitSlop={8} onPress={hideQrCode} style={styles.qrCodeClose}>
              <X size={20} color={tokens.text.primary} />
            </Pressable>
            <Pressable
              ref={qrCodeViewRef}
              style={styles.qrCodePlaceholder}
              collapsable={false}
              onLongPress={handleLongPressQrCode}
            >
              <QrCode size={240} color={tokens.text.primary} />
            </Pressable>
            <Text style={styles.qrCodeTitle}>扫描二维码加入社区</Text>
            <Pressable onLongPress={handleLongPressQrCode} style={styles.qrCodeHint}>
              <Text style={styles.qrCodeHintText}>长按二维码可保存</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* 分享领智汇值弹窗(对齐 Uniapp share-points-popup) */}
      <Modal
        visible={shareValueVisible}
        transparent
        animationType="fade"
        onRequestClose={hideSharePoints}
      >
        <Pressable style={styles.modalMask} onPress={hideSharePoints}>
          <Pressable style={styles.shareContent} onPress={(e) => e.stopPropagation()}>
            <Pressable hitSlop={8} onPress={hideSharePoints} style={styles.shareClose}>
              <X size={20} color={tokens.text.primary} />
            </Pressable>
            <Share2 size={48} color={tokens.purple.DEFAULT} />
            <Text style={styles.shareTitle}>分享领智汇值</Text>
            <Text style={styles.shareDesc}>
              首次分享成功,获得 {shareFirstReward}{' '}
              智汇值奖励;邀请好友加入智汇AI社区,好友注册成功后双方均可再获智汇值。智汇值可用于兑换模型算力、会员权益等。
            </Text>
            <Pressable onPress={handleClaimShareReward} style={styles.shareBtn}>
              <Text style={styles.shareBtnText}>领取 {shareFirstReward} 智汇值</Text>
            </Pressable>
            <Pressable
              onPress={handleShareClick}
              style={[styles.shareBtn, styles.shareBtnSecondary]}
            >
              <Text style={styles.shareBtnText}>立即分享邀请好友</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* P1.1 转语音 Modal(语音类型选项 + 真实 TTS loading) */}
      <Modal
        visible={ttsVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!ttsLoading) setTtsVisible(false)
        }}
      >
        <Pressable
          style={styles.modalMask}
          onPress={() => {
            if (!ttsLoading) setTtsVisible(false)
          }}
        >
          <Pressable style={styles.listDialogContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.listDialogHeader}>
              <Text style={styles.listDialogTitle}>转语音</Text>
              <Pressable
                hitSlop={8}
                onPress={() => {
                  if (!ttsLoading) setTtsVisible(false)
                }}
                style={styles.listDialogClose}
              >
                <X size={20} color={tokens.text.primary} />
              </Pressable>
            </View>
            {ttsLoading ? (
              <View style={styles.ttsLoadingWrap}>
                <Text style={styles.ttsLoadingText}>TTS 转换中...</Text>
              </View>
            ) : (
              <View style={styles.ttsOptions}>
                {TTS_VOICE_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt}
                    onPress={() => handleTtsSelect(opt)}
                    style={({ pressed }) => [
                      styles.ttsOptionBtn,
                      pressed && styles.panelItemPressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={opt}
                  >
                    <Text style={styles.ttsOptionText}>{opt}</Text>
                  </Pressable>
                ))}
              </View>
            )}
            {!ttsLoading ? (
              <Pressable
                onPress={() => setTtsVisible(false)}
                style={[styles.panelCancelBtn, styles.ttsCancelBtn]}
                accessibilityRole="button"
                accessibilityLabel="取消"
              >
                <Text style={styles.panelCancelText}>取消</Text>
              </Pressable>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      {/* P1.4 网页链接输入 Modal */}
      <Modal
        visible={urlInputVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setUrlInputVisible(false)}
      >
        <Pressable style={styles.modalMask} onPress={() => setUrlInputVisible(false)}>
          <Pressable style={styles.listDialogContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.listDialogHeader}>
              <Text style={styles.listDialogTitle}>网页链接</Text>
              <Pressable
                hitSlop={8}
                onPress={() => setUrlInputVisible(false)}
                style={styles.listDialogClose}
              >
                <X size={20} color={tokens.text.primary} />
              </Pressable>
            </View>
            <View style={styles.urlInputBody}>
              <TextInput
                style={styles.urlInputField}
                value={urlInputValue}
                onChangeText={setUrlInputValue}
                placeholder="请输入网页链接(https://...)"
                placeholderTextColor={tokens.text.tertiary}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                autoFocus
              />
              <Pressable
                onPress={() => {
                  void handleUrlConfirm()
                }}
                style={styles.urlInputConfirmBtn}
                accessibilityRole="button"
                accessibilityLabel="发送链接"
              >
                <Text style={styles.urlInputConfirmText}>发送</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* P1.5 文件上传 Modal(expo-document-picker 未安装,Modal 占位) */}
      <Modal
        visible={fileUploadVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFileUploadVisible(false)}
      >
        <Pressable style={styles.modalMask} onPress={() => setFileUploadVisible(false)}>
          <Pressable style={styles.listDialogContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.listDialogHeader}>
              <Text style={styles.listDialogTitle}>文件上传</Text>
              <Pressable
                hitSlop={8}
                onPress={() => setFileUploadVisible(false)}
                style={styles.listDialogClose}
              >
                <X size={20} color={tokens.text.primary} />
              </Pressable>
            </View>
            <View style={styles.fileUploadBody}>
              <Text style={styles.fileUploadDesc}>支持文件类型:</Text>
              <View style={styles.fileUploadTypeList}>
                {FILE_TYPE_BADGES.map((t) => (
                  <View key={t} style={styles.fileUploadTypeBadge}>
                    <Text style={styles.fileUploadTypeText}>{t}</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.fileUploadHint}>选择文件后自动上传,支持常见文档/文本格式</Text>
              <Pressable
                onPress={() => void handleFileUpload()}
                style={styles.fileUploadConfirmBtn}
                accessibilityRole="button"
                accessibilityLabel="选择文件"
              >
                <Text style={styles.fileUploadConfirmText}>
                  {fileUploading ? '上传中…' : '选择文件'}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ModelConfigDialog 模型配置弹窗(对齐 Uniapp ai_index.vue 行 104 ModelConfigDialog) */}
      <ModelConfigDialog
        visible={modelConfigVisible}
        modelType={getModelConfigType()}
        config={modelConfig}
        onChange={setModelConfig}
        onClose={() => setModelConfigVisible(false)}
      />

      {/* ModelList 模型列表弹窗(对齐 Uniapp ai_index.vue 行 32 ModelList) */}
      <Modal
        visible={modelListVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModelListVisible(false)}
      >
        <Pressable style={styles.modalMask} onPress={() => setModelListVisible(false)}>
          <Pressable style={styles.listDialogContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.listDialogHeader}>
              <Text style={styles.listDialogTitle}>选择模型</Text>
              <Pressable
                hitSlop={8}
                onPress={() => setModelListVisible(false)}
                style={styles.listDialogClose}
              >
                <X size={20} color={tokens.text.primary} />
              </Pressable>
            </View>
            <ModelList
              groups={modelListGroups}
              selectedIds={[model]}
              onSelectChange={(ids) => {
                const next = ids[0]
                if (next) {
                  setModel(next)
                  setModelListVisible(false)
                }
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* AgentList 弹窗(对齐 Uniapp ai_index.vue 行 34 AgentList) */}
      <Modal
        visible={agentListVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAgentListVisible(false)}
      >
        <Pressable style={styles.modalMask} onPress={() => setAgentListVisible(false)}>
          <Pressable style={styles.listDialogContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.listDialogHeader}>
              <Text style={styles.listDialogTitle}>选择 Agent</Text>
              <Pressable
                hitSlop={8}
                onPress={() => setAgentListVisible(false)}
                style={styles.listDialogClose}
              >
                <X size={20} color={tokens.text.primary} />
              </Pressable>
            </View>
            <AgentList items={agentListItems} onItemClick={handleAgentSelect} />
          </Pressable>
        </Pressable>
      </Modal>

      {/* 功能面板(对齐 Uniapp function-handle 子组件,底部上滑 6 项 AI 功能) */}
      <BottomPops visible={functionPanelVisible} onClose={closeFunctionPanel} title="功能">
        {functionPanelItems.map((item) => (
          <Pressable
            key={item.key}
            onPress={item.onPress}
            style={({ pressed }) => [styles.panelItem, pressed && styles.panelItemPressed]}
            accessibilityRole="button"
            accessibilityLabel={item.label}
          >
            <item.Icon size={22} color={tokens.text.primary} />
            <Text style={styles.panelItemText}>{item.label}</Text>
          </Pressable>
        ))}
        <Pressable
          onPress={closeFunctionPanel}
          style={({ pressed }) => [styles.panelCancelBtn, pressed && styles.panelItemPressed]}
          accessibilityRole="button"
          accessibilityLabel="取消"
        >
          <Text style={styles.panelCancelText}>取消</Text>
        </Pressable>
      </BottomPops>

      {/* 来源面板(对齐 Uniapp source-handle 子组件,底部上滑 4 项知识来源) */}
      <BottomPops visible={sourcePanelVisible} onClose={closeSourcePanel} title="知识来源">
        {sourcePanelItems.map((item) => (
          <Pressable
            key={item.key}
            onPress={item.onPress}
            style={({ pressed }) => [styles.panelItem, pressed && styles.panelItemPressed]}
            accessibilityRole="button"
            accessibilityLabel={item.label}
          >
            <item.Icon size={22} color={tokens.text.primary} />
            <Text style={styles.panelItemText}>{item.label}</Text>
          </Pressable>
        ))}
        <Pressable
          onPress={closeSourcePanel}
          style={({ pressed }) => [styles.panelItem, pressed && styles.panelItemPressed]}
          accessibilityRole="button"
          accessibilityLabel="取消"
        >
          <Text style={styles.panelCancelText}>取消</Text>
        </Pressable>
      </BottomPops>

      {/* Drawer(H3 重建版,管理 visible 状态) */}
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
      <FloatBox visible={toastVisible} type={toastType} message={toastMessage} onHide={hideToast} />

      {/* 放大输入区弹窗(对齐 Uniapp fangdaVisible 放大输入) */}
      <Modal
        visible={fangdaVisible}
        animationType="slide"
        onRequestClose={() => setFangdaVisible(false)}
      >
        <View style={styles.fangdaContainer}>
          <View style={styles.fangdaHeader}>
            <Text style={styles.fangdaTitle}>放大输入</Text>
            <Pressable
              hitSlop={8}
              onPress={() => setFangdaVisible(false)}
              style={styles.fangdaCloseBtn}
            >
              <X size={24} color={tokens.text.primary} />
            </Pressable>
          </View>
          <TextInput
            style={styles.fangdaInput}
            value={prompt}
            onChangeText={setPrompt}
            placeholder="请输入内容..."
            placeholderTextColor={tokens.text.tertiary}
            multiline
            autoFocus
            textAlignVertical="top"
          />
          <View style={styles.fangdaFooter}>
            <Pressable
              style={styles.fangdaSendBtn}
              onPress={() => {
                setFangdaVisible(false)
                void send()
              }}
            >
              <Text style={styles.fangdaSendBtnText}>发送</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* 消息图片全屏预览(对齐 Uniapp ai_index2 previewImage) */}
      <Modal
        visible={previewImageUrl !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewImageUrl(null)}
      >
        <View style={styles.imagePreviewOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setPreviewImageUrl(null)} />
          {previewImageUrl ? (
            <Image
              source={{ uri: previewImageUrl }}
              style={styles.imagePreviewFull}
              resizeMode="contain"
              accessibilityLabel="图片预览"
            />
          ) : null}
          <Pressable
            hitSlop={10}
            onPress={() => setPreviewImageUrl(null)}
            style={styles.imagePreviewClose}
            accessibilityRole="button"
            accessibilityLabel="关闭预览"
          >
            <X size={26} color="#fff" />
          </Pressable>
        </View>
      </Modal>
    </View>
  )
}

// ── 辅助函数(对齐 Uniapp getModelChat → DrawerConversationItem 映射) ──

/**
 * 把 API 返回的 ConversationDetail 映射为 DrawerConversationItem。
 * 对齐 Uniapp getModelChat 返回的 { id, title, time, modelName } 结构。
 */
function mapConversationToDrawer(c: ConversationDetail): DrawerConversationItem {
  const tsStr = c.lastMessageAt ?? c.updatedAt ?? c.createdAt
  const createdAt = tsStr ? new Date(tsStr).getTime() : Date.now()
  const mdl = c.model ?? ''
  return {
    id: c.id,
    title: c.title?.trim() || '未命名对话',
    modelConfig: mdl ? { id: mdl, name: mdl, icon: undefined } : undefined,
    createdAt,
  }
}

// ── 样式(StyleSheet + tokens,禁用 rounded-full / 禁用分割线,compact 紧凑) ──

const BOTTOM_BAR_TOTAL = 68 // BottomActionBar 高度估值(12+44+12)

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: tokens.surface.bg,
  },
  body: {
    flex: 1,
  },
  navRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rpx(32),
  },
  // ── 对话页顶部「查看卡片」折叠区(对齐 Uniapp ai_index2.vue tishi_block) ──
  tishiBlock: {
    marginBottom: rpx(16),
  },
  tishiBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: rpx(16),
    paddingVertical: rpx(6),
    borderRadius: rpx(8),
    backgroundColor: tokens.surface.muted,
    marginBottom: rpx(8),
  },
  tishiBtnText: {
    fontSize: rpx(13),
    color: tokens.text.secondary,
  },
  tishiCardWrap: {
    borderRadius: rpx(12),
    overflow: 'hidden',
  },
  // ── 上下文自动压缩提示条(chatAlert.compaction.*) ──
  compactionBanner: {
    marginBottom: rpx(16),
    padding: rpx(12),
    borderRadius: rpx(8),
    backgroundColor: tokens.surface.muted,
  },
  compactionTitle: {
    fontSize: rpx(13),
    fontWeight: '600',
    color: tokens.text.primary,
    marginBottom: rpx(4),
  },
  compactionMessage: {
    fontSize: rpx(12),
    color: tokens.text.secondary,
  },
  // ── 消息列表 ──
  msgListContent: {
    paddingHorizontal: rpx(16),
    paddingVertical: rpx(24),
    paddingBottom: BOTTOM_BAR_TOTAL + 8,
  },
  msgRow: {
    marginVertical: rpx(20),
    flexDirection: 'row',
  },
  msgRowUser: {
    justifyContent: 'flex-end',
  },
  msgRowAi: {
    justifyContent: 'flex-start',
  },
  msgContent: {
    flexDirection: 'column',
  },
  msgActions: {
    flexDirection: 'row',
    gap: rpx(16),
    marginTop: rpx(8),
    paddingLeft: rpx(24),
  },
  msgActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rpx(8),
  },
  msgActionText: {
    fontSize: 12,
    color: tokens.text.secondary,
  },
  msgBubble: {
    maxWidth: '78%',
    paddingHorizontal: rpx(28),
    paddingVertical: rpx(20),
    borderRadius: 16,
  },
  msgBubbleUser: {
    backgroundColor: tokens.brand.DEFAULT,
  },
  msgBubbleAi: {
    backgroundColor: tokens.surface.card,
  },
  msgText: {
    fontSize: 15,
    lineHeight: 20,
  },
  msgTextUser: {
    color: tokens.surface.light,
  },
  msgTextAi: {
    color: tokens.text.primary,
  },
  // ── 消息富内容:图片(点击全屏预览) ──
  msgImageWrap: {
    marginVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
    alignSelf: 'flex-start',
    maxWidth: 220,
  },
  msgImage: {
    width: 180,
    height: 140,
    backgroundColor: tokens.surface.muted,
  },
  // ── 消息富内容:代码块(展开/收起 + 复制,对齐 ai_index2 code-block) ──
  codeBlock: {
    marginVertical: 6,
    borderRadius: 8,
    backgroundColor: '#1e1e2e',
    overflow: 'hidden',
  },
  codeBlockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#2d2d44',
  },
  codeBlockLang: {
    fontSize: 11,
    color: '#9cdcfe',
    fontWeight: '600',
    flexShrink: 1,
    marginRight: 8,
  },
  codeBlockActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  codeBlockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
  },
  codeBlockBtnText: {
    fontSize: 11,
    color: '#e8e8e8',
  },
  codeBlockContent: {
    padding: 10,
    fontSize: 12,
    lineHeight: 17,
    color: '#e8e8e8',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  // ── 消息富内容:思考过程(推理 reasoning,对齐 ai_index2 thinking-process) ──
  // 用浅灰/中性色区分代码块(深色底):思考过程是半成品,别和最终代码混淆
  thinkingBlock: {
    marginBottom: 6,
    borderRadius: 8,
    backgroundColor: tokens.surface.muted,
    overflow: 'hidden',
  },
  thinkingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  thinkingTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: tokens.text.secondary,
    flexShrink: 1,
  },
  thinkingToggle: {
    fontSize: 11,
    color: tokens.text.tertiary,
    marginLeft: 8,
  },
  thinkingContent: {
    paddingHorizontal: 10,
    paddingBottom: 10,
    fontSize: 12,
    lineHeight: 17,
    color: tokens.text.secondary,
  },
  // ── 消息图片全屏预览 ──
  imagePreviewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePreviewFull: {
    width: '94%',
    height: '80%',
  },
  imagePreviewClose: {
    position: 'absolute',
    top: 52,
    right: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ── 素材库弹窗(Modal 内部对话框样式,参考 listDialogContent) ──
  materialPopup: {
    width: '88%',
    maxHeight: '70%',
    backgroundColor: tokens.surface.light,
    borderRadius: 8,
    overflow: 'hidden',
  },
  materialPopupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: rpx(24),
    paddingVertical: rpx(20),
  },
  materialPopupTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: tokens.text.primary,
  },
  // ── Material 卡片区 ──
  materialCardsScroll: {
    maxHeight: 72,
  },
  materialCardsContent: {
    paddingHorizontal: rpx(24),
    gap: rpx(16),
  },
  materialCard: {
    width: 120,
    height: 56,
    backgroundColor: tokens.surface.card,
    borderRadius: 8,
    paddingHorizontal: rpx(16),
    paddingVertical: rpx(12),
    justifyContent: 'center',
  },
  materialCardClose: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 4,
    backgroundColor: tokens.text.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  materialCardTitle: {
    fontSize: 12,
    color: tokens.text.primary,
    fontWeight: '500',
  },
  materialCardPreview: {
    fontSize: 11,
    color: tokens.text.secondary,
    marginTop: rpx(4),
  },
  // ── 图片附件列表 ──
  imgsListScroll: {
    maxHeight: 60,
  },
  imgsListContent: {
    paddingHorizontal: rpx(24),
    gap: rpx(16),
  },
  imgsListItem: {
    position: 'relative',
    width: 48,
    height: 48,
    borderRadius: 6,
    backgroundColor: tokens.surface.card,
  },
  imgsListClose: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 4,
    backgroundColor: tokens.danger.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ── 模型类型切换区 ──
  modelTypeScroll: {
    maxHeight: 44,
  },
  modelTypeContent: {
    paddingHorizontal: rpx(24),
    gap: rpx(16),
    alignItems: 'center',
  },
  modelTypeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rpx(8),
    paddingHorizontal: rpx(20),
    paddingVertical: rpx(12),
    borderRadius: 8,
    backgroundColor: tokens.surface.card,
    height: 30,
    minWidth: 100,
  },
  modelTypeBtnActive: {
    backgroundColor: tokens.surface.light,
    borderWidth: 1,
    borderColor: tokens.brand.DEFAULT,
  },
  modelTypeLabel: {
    fontSize: 12,
    color: tokens.text.secondary,
  },
  modelTypeLabelActive: {
    color: tokens.brand.DEFAULT,
    fontWeight: '500',
  },
  // ── 功能开关组(ToggleButtonGroup 容器) ──
  toggleGroupWrap: {
    paddingHorizontal: rpx(24),
    paddingVertical: rpx(4),
  },
  // ── 输入框区域 ──
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: rpx(24),
    paddingVertical: rpx(16),
    gap: rpx(16),
    backgroundColor: tokens.surface.light,
    marginBottom: BOTTOM_BAR_TOTAL,
  },
  inputIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 6,
    backgroundColor: tokens.surface.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputIconBtnActive: {
    backgroundColor: tokens.brand.DEFAULT,
  },
  input: {
    flex: 1,
    minHeight: 36,
    maxHeight: 100,
    paddingHorizontal: rpx(24),
    paddingVertical: rpx(16),
    borderRadius: 6,
    backgroundColor: tokens.surface.card,
    fontSize: 14,
    color: tokens.text.primary,
    textAlignVertical: 'top',
  },
  // ── 二维码弹窗 ──
  modalMask: {
    flex: 1,
    backgroundColor: tokens.overlay.modal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrCodeContent: {
    width: 320,
    backgroundColor: tokens.surface.light,
    borderRadius: 12,
    padding: rpx(40),
    alignItems: 'center',
  },
  qrCodeClose: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrCodePlaceholder: {
    width: 280,
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.surface.muted,
    borderRadius: 8,
    marginBottom: rpx(24),
  },
  qrCodeTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: tokens.text.primary,
    marginBottom: rpx(20),
  },
  qrCodeHint: {
    padding: rpx(8),
  },
  qrCodeHintText: {
    fontSize: 12,
    color: tokens.text.secondary,
  },
  // ── 分享领值弹窗 ──
  shareContent: {
    width: 300,
    backgroundColor: tokens.surface.light,
    borderRadius: 12,
    padding: rpx(48),
    alignItems: 'center',
  },
  shareClose: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: tokens.text.primary,
    marginTop: rpx(24),
    marginBottom: rpx(16),
  },
  shareDesc: {
    fontSize: 13,
    lineHeight: 19,
    color: tokens.text.secondary,
    textAlign: 'center',
    marginBottom: rpx(32),
  },
  shareBtn: {
    paddingHorizontal: rpx(48),
    paddingVertical: rpx(20),
    borderRadius: 6,
    backgroundColor: tokens.brand.DEFAULT,
  },
  shareBtnText: {
    fontSize: 14,
    color: tokens.surface.light,
    fontWeight: '500',
  },
  shareBtnSecondary: {
    marginTop: rpx(16),
  },
  // ── 列表弹窗(ModelList / AgentList 共用容器) ──
  listDialogContent: {
    width: '88%',
    maxHeight: '70%',
    backgroundColor: tokens.surface.light,
    borderRadius: 12,
    overflow: 'hidden',
  },
  listDialogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: rpx(32),
    paddingVertical: rpx(24),
    backgroundColor: tokens.surface.light,
  },
  listDialogTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: tokens.text.primary,
  },
  listDialogClose: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ── 素材详情弹窗内容区(复用 listDialogContent/Header,以下为正文/字段/错误态) ──
  detailDialogBody: {
    paddingHorizontal: rpx(32),
    paddingVertical: rpx(16),
    minHeight: 120,
  },
  detailDialogScroll: {
    alignSelf: 'stretch',
  },
  detailDialogFieldRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: rpx(10),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.border.light,
  },
  detailDialogFieldLabel: {
    width: rpx(140),
    fontSize: 13,
    color: tokens.text.tertiary,
  },
  detailDialogFieldValue: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: tokens.text.primary,
  },
  detailDialogErrorWrap: {
    alignSelf: 'center',
    alignItems: 'center',
    gap: rpx(16),
  },
  detailDialogErrorText: {
    fontSize: 13,
    color: tokens.text.secondary,
  },
  detailDialogRetryBtn: {
    paddingHorizontal: rpx(32),
    paddingVertical: rpx(12),
    borderRadius: 6,
    backgroundColor: tokens.brand.DEFAULT,
  },
  detailDialogRetryText: {
    fontSize: 13,
    color: tokens.surface.light,
    fontWeight: '600',
  },
  // ── 功能面板/来源面板(BottomPops 子内容样式) ──
  panelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: rpx(32),
    height: 56,
    gap: rpx(28),
  },
  panelItemPressed: {
    opacity: 0.85,
  },
  panelItemText: {
    flex: 1,
    fontSize: 16,
    color: tokens.text.primary,
  },
  panelCancelBtn: {
    marginHorizontal: rpx(32),
    marginTop: rpx(16),
    height: 48,
    borderRadius: 8,
    backgroundColor: tokens.surface.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelCancelText: {
    fontSize: 16,
    fontWeight: '500',
    color: tokens.text.primary,
  },
  // ── 放大输入区弹窗(对齐 Uniapp fangdaVisible) ──
  fangdaContainer: {
    flex: 1,
    backgroundColor: tokens.surface.bg,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  fangdaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: rpx(32),
    paddingVertical: rpx(24),
    backgroundColor: tokens.surface.card,
  },
  fangdaTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: tokens.text.primary,
  },
  fangdaCloseBtn: {
    padding: rpx(8),
  },
  fangdaInput: {
    flex: 1,
    fontSize: 16,
    color: tokens.text.primary,
    paddingHorizontal: rpx(32),
    paddingVertical: rpx(24),
    textAlignVertical: 'top',
  },
  fangdaFooter: {
    paddingHorizontal: rpx(32),
    paddingVertical: rpx(24),
    backgroundColor: tokens.surface.card,
  },
  fangdaSendBtn: {
    backgroundColor: tokens.brand.DEFAULT,
    borderRadius: 8,
    paddingVertical: rpx(24),
    alignItems: 'center',
  },
  fangdaSendBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: tokens.surface.light,
  },
  // ── P1.1 转语音 Modal ──
  ttsLoadingWrap: {
    paddingVertical: rpx(64),
    alignItems: 'center',
    justifyContent: 'center',
  },
  ttsLoadingText: {
    fontSize: 14,
    color: tokens.text.secondary,
  },
  ttsOptions: {
    paddingVertical: rpx(16),
    gap: rpx(8),
  },
  ttsOptionBtn: {
    paddingHorizontal: rpx(32),
    paddingVertical: rpx(28),
    backgroundColor: tokens.surface.muted,
    marginHorizontal: rpx(32),
    borderRadius: 8,
    alignItems: 'center',
  },
  ttsOptionText: {
    fontSize: 15,
    color: tokens.text.primary,
  },
  ttsCancelBtn: {
    marginTop: rpx(24),
    marginBottom: rpx(32),
  },
  // ── P1.4 网页链接输入 Modal ──
  urlInputBody: {
    padding: rpx(32),
    gap: rpx(24),
  },
  urlInputField: {
    paddingHorizontal: rpx(24),
    paddingVertical: rpx(20),
    borderRadius: 8,
    backgroundColor: tokens.surface.muted,
    fontSize: 14,
    color: tokens.text.primary,
  },
  urlInputConfirmBtn: {
    backgroundColor: tokens.brand.DEFAULT,
    borderRadius: 8,
    paddingVertical: rpx(24),
    alignItems: 'center',
  },
  urlInputConfirmText: {
    fontSize: 15,
    fontWeight: '500',
    color: tokens.surface.light,
  },
  // ── P1.5 文件上传 Modal ──
  fileUploadBody: {
    padding: rpx(32),
    gap: rpx(24),
  },
  fileUploadDesc: {
    fontSize: 14,
    color: tokens.text.primary,
    fontWeight: '500',
  },
  fileUploadTypeList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: rpx(16),
  },
  fileUploadTypeBadge: {
    paddingHorizontal: rpx(20),
    paddingVertical: rpx(12),
    borderRadius: 6,
    backgroundColor: tokens.surface.muted,
  },
  fileUploadTypeText: {
    fontSize: 12,
    color: tokens.text.secondary,
  },
  fileUploadHint: {
    fontSize: 12,
    color: tokens.text.tertiary,
  },
  fileUploadConfirmBtn: {
    backgroundColor: tokens.brand.DEFAULT,
    borderRadius: 8,
    paddingVertical: rpx(24),
    alignItems: 'center',
    marginTop: rpx(8),
  },
  fileUploadConfirmText: {
    fontSize: 15,
    fontWeight: '500',
    color: tokens.surface.light,
  },
})

export default ChatScreen
