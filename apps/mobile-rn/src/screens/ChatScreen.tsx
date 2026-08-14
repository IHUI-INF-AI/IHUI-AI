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
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ListRenderItem,
} from 'react-native'
import Clipboard from '@react-native-clipboard/clipboard'
import * as MediaLibrary from 'expo-media-library'
import { captureRef } from 'react-native-view-shot'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import {
  Bot,
  BookOpen,
  Clapperboard,
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
  deleteConversation,
  fetchModels,
  formatSSEError,
  getAgents,
  getMessages,
  getModelContextCapacity,
  listConversations,
  streamChat,
  type Agent,
  type ConversationDetail,
  type LlmModel,
} from '@ihui/api-client'
import { FALLBACK_MODELS as SHARED_FALLBACK_MODELS } from '@ihui/shared'
import type { ChatMessage } from '@ihui/shared'
import type { ModelConfigType } from '@ihui/ui-native'
import { NavBar } from '../components/NavBar'
import { BottomActionBar } from '../components/BottomActionBar'
import MaterialList, {
  type MaterialCategory,
  type MaterialItem,
} from '../components/MaterialList'
import {
  Drawer,
  type DrawerConversationItem,
  type DrawerExtraMenu,
  type DrawerTab,
} from '../components/Drawer'
import {
  ModelConfigDialog,
  type ModelConfig,
} from '../components/ModelConfigDialog'
import ModelList, {
  type ModelListGroup,
} from '../components/ModelList'
import AgentList, {
  type AgentListItem,
} from '../components/AgentList'
import { BottomPops } from '../components/BottomPops'
import { FloatBox, type FloatBoxType } from '../components/FloatBox'
import NotificationPanel from '../components/NotificationPanel'
import { useAuth } from '../context/AuthContext'
import { useChatInput } from '../hooks/useChatInput'
import type { RootStackParamList } from '../navigation/RootNavigator'

// ── 类型定义(强类型,禁用 any) ──

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

/** TTS 语音类型选项(P1.1 转语音 Modal,真实 TTS 待 API 接入) */
const TTS_VOICE_OPTIONS: readonly string[] = ['男声', '女声', '儿童'] as const

/** 文件上传支持类型徽章(P1.5,expo-document-picker 未安装,Modal 占位) */
const FILE_TYPE_BADGES: readonly string[] = ['PDF', 'Word', 'Excel', 'TXT'] as const

// DrawerTab 中 home/ai/mine 是 Tab 路由(走 Tabs navigator);
// square/share 是 RootStack 路由(直接 navigate,见 handleDrawerNavigate)。

// ── ChatScreen 组件 ──

export function ChatScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'Chat'>) {
  const { user: authUser, logout } = useAuth()
  const {
    inputFiles,
    isVoiceMode,
    onInputAddImage,
    onInputRemoveFile,
    onInputVoiceToggle,
  } = useChatInput()

  // ── 弹窗/抽屉状态 ──
  const [drawerVisible, setDrawerVisible] = useState(false)
  const [qrCodeVisible, setQrCodeVisible] = useState(false)
  const [shareValueVisible, setShareValueVisible] = useState(false)
  const [showMaterialList, setShowMaterialList] = useState(false)
  const [materialTab, setMaterialTab] = useState<string>('text')
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
  const [materialCards, setMaterialCards] = useState<MaterialCard[]>([])
  const [prompt, setPrompt] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
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
  // 功能面板/来源面板占位弹窗(对齐 Uniapp function-handle / source-handle,后续任务对接真实面板)
  const [functionPanelVisible, setFunctionPanelVisible] = useState<boolean>(false)
  const [sourcePanelVisible, setSourcePanelVisible] = useState<boolean>(false)
  // P1.1 转语音 Modal(占位 TODO 替换:语音类型选项 + 模拟 TTS loading)
  const [ttsVisible, setTtsVisible] = useState(false)
  const [ttsLoading, setTtsLoading] = useState(false)
  // P1.2 收藏 UI 状态(不调 API,用 Set 跟踪已收藏消息 id)
  const [favoritedMessageIds, setFavoritedMessageIds] = useState<Set<string>>(new Set())
  // P1.4 网页链接输入 Modal
  const [urlInputVisible, setUrlInputVisible] = useState(false)
  const [urlInputValue, setUrlInputValue] = useState('')
  // P1.5 文件上传 Modal(expo-document-picker 未安装,Modal 占位)
  const [fileUploadVisible, setFileUploadVisible] = useState(false)
  // Drawer 历史对话列表(对齐 Uniapp loadHistoryChat → getModelChat API + groupDataByDate)
  const [drawerConversations, setDrawerConversations] = useState<DrawerConversationItem[]>([])
  const [drawerConversationsLoaded, setDrawerConversationsLoaded] = useState(false)

  const abortRef = useRef<AbortController | null>(null)
  const idCounter = useRef(0)
  const listRef = useRef<FlatList<ChatMessage> | null>(null)
  const materialCardIdCounter = useRef(0)
  const qrCodeViewRef = useRef<View | null>(null)
  const nextId = (): string => `msg-${++idCounter.current}`
  const nextMaterialCardId = (): string => `card-${++materialCardIdCounter.current}`

  // FloatBox 浮层提示状态(替代单按钮 Alert.alert 的非阻塞反馈)
  const [toastVisible, setToastVisible] = useState(false)
  const [toastType, setToastType] = useState<FloatBoxType>('info')
  const [toastMessage, setToastMessage] = useState('')
  const showToast = useCallback((type: FloatBoxType, message: string): void => {
    setToastType(type)
    setToastMessage(message)
    setToastVisible(true)
  }, [])
  const hideToast = useCallback((): void => setToastVisible(false), [])

  // ── 模型列表加载(保留原 streamChat 链路) ──
  useEffect(() => {
    let cancelled = false
    fetchModels()
      .then((res) => {
        if (cancelled) return
        const list = res?.models?.length ? res.models : FALLBACK_MODELS
        setModels(list)
        const def = res.default && list.some((m) => m.id === res.default) ? res.default : list[0]!.id
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
        { text: '去登录', onPress: () => { void logout() } },
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
  const handleModelTypeClick = (type: ModelType): void => {
    if (type === 'sck') {
      // 素材库:切换弹窗(对齐 Uniapp toggleMaterialPopup)
      if (currentModelType === 'sck') {
        setCurrentModelType('')
        setShowMaterialList(false)
      } else {
        setCurrentModelType('sck')
        setShowMaterialList(true)
      }
      return
    }
    // 其他类型:切换选中态(对齐 Uniapp handleModelTypeClick,二次点击收起)
    setCurrentModelType((prev) => (prev === type ? '' : type))
    setShowMaterialList(false)
  }

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
  const removeImage = (id: string): void => {
    onInputRemoveFile(id)
  }

  /** update:prompt:更新输入内容 */
  const updatePrompt = (value: string): void => {
    setPrompt(value)
  }

  // ── BottomActionBar 其余事件 stub(对齐 Uniapp 30+ 事件,后续 H22 补全) ──
  // 已挂载到 UI 的:handleInputFocus/handleInputBlur(TextInput)、textareaHeightChange(TextInput onContentSizeChange)
  const handleInputFocus = (): void => {}
  const handleInputBlur = (): void => {}
  const textareaHeightChange = (): void => {}

  /** function-handle:打开功能面板(对齐 Uniapp function-handle 子组件,6 项 AI 功能) */
  const handleFunctionHandle = (): void => {
    setFunctionPanelVisible(true)
  }

  /** source-handle:打开来源面板(对齐 Uniapp source-handle 子组件,4 项知识来源) */
  const handleSourceHandle = (): void => {
    setSourcePanelVisible(true)
  }

  /** 关闭功能/来源面板 */
  const closeFunctionPanel = (): void => setFunctionPanelVisible(false)
  const closeSourcePanel = (): void => setSourcePanelVisible(false)

  /**
   * P1.1 转语音:打开语音类型选项 Modal(占位 TODO 替换)。
   * 选中类型后模拟 3s TTS 转换,真实 TTS 待 API 接入。
   */
  const openTtsPanel = (): void => {
    setFunctionPanelVisible(false)
    setTtsVisible(true)
  }
  const handleTtsSelect = (voiceType: string): void => {
    setTtsLoading(true)
    // 模拟 TTS 转换 3s(真实 API 接入后替换为流式回调)
    setTimeout(() => {
      setTtsLoading(false)
      setTtsVisible(false)
      showToast('success', `语音生成成功(${voiceType})`)
    }, 3000)
  }

  /**
   * P1.2 收藏:切换最近一条 assistant 消息的收藏状态(占位 TODO 替换)。
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
   * P1.4 网页链接确认:将输入的 URL 作为消息发送(占位 TODO 替换)。
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

  /** 导出对话(对齐 Uniapp handleExport,调 Share.share 分享对话文本) */
  const handleExportMessages = async (): Promise<void> => {
    setFunctionPanelVisible(false)
    try {
      await Share.share({ message: formatMessagesText() })
    } catch {
      // 用户取消分享,静默处理
    }
  }

  /** 分享对话(对齐 Uniapp handleShareChat,与导出共用 Share.share,语义独立) */
  const handleShareChat = async (): Promise<void> => {
    setFunctionPanelVisible(false)
    try {
      await Share.share({ message: formatMessagesText() })
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
   * 5. 转语音 → 占位提示(TODO: 后续接 TTS)
   * 6. 收藏 → 占位提示(TODO: 后续接收藏 API)
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
      onPress: () => { void handleExportMessages() },
    },
    {
      key: 'share',
      label: '分享对话',
      Icon: Share2,
      onPress: () => { void handleShareChat() },
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
   * 1. 素材库 → 占位提示(TODO: 后续接 MaterialList 列表)
   * 2. 网页链接 → 占位提示(TODO: 后续接输入弹窗)
   * 3. 文件上传 → 占位提示(TODO: 后续接 DocumentPicker)
   * 4. 历史对话 → 复用 Drawer(setDrawerVisible)
   */
  const sourcePanelItems: readonly PanelItem[] = [
    {
      key: 'material',
      label: '素材库',
      Icon: BookOpen,
      onPress: () => {
        // P1.3:复用 sck 模型类型 + MaterialList 弹窗(占位 TODO 替换)
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
        // P1.4:打开 URL 输入 Modal(占位 TODO 替换)
        setSourcePanelVisible(false)
        setUrlInputVisible(true)
      },
    },
    {
      key: 'file-upload',
      label: '文件上传',
      Icon: Paperclip,
      onPress: () => {
        // P1.5:expo-document-picker 未安装,弹 Modal 占位(占位 TODO 替换)
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

  // ── 分享领智汇值弹窗(对齐 Uniapp showSharePointsPopup) ──
  // showSharePoints 已移除:Share2 按钮改为跳个人中心(goToMyPage),
  // 弹窗触发改为进页面自动检查(见下方 useEffect,待 checkFirstShareStatus API 接入)。
  const hideSharePoints = (): void => setShareValueVisible(false)

  // ── 跳转个人中心(对齐 Uniapp goToMyPage,Share2 按钮承载 share-image 跳转) ──
  const goToMyPage = (): void => {
    navigation.navigate('Tabs', { screen: 'mine' } as never)
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
  const removeMaterialCard = (id: string): void => {
    setMaterialCards((prev) => prev.filter((c) => c.id !== id))
  }

  // ── Drawer 回调 ──
  const closeDrawer = (): void => setDrawerVisible(false)
  const handleDrawerNavigate = (tab: DrawerTab): void => {
    // square/share 是 RootStack 路由(非 Tab),直接 navigate 到根路由
    if (tab === 'square') {
      navigation.navigate('Square')
      return
    }
    if (tab === 'share') {
      navigation.navigate('Share')
      return
    }
    // home/ai/mine 是 Tab 路由,通过 Tabs navigator 跳转
    const rnTab: 'home' | 'ai' | 'mine' = tab
    navigation.navigate('Tabs', { screen: rnTab } as never)
  }
  const handleDrawerNavigateCompany = (): void => {
    // 一人公司:跳 Distribution 路由(已在 RootNavigator 注册,对齐 Uniapp gotocompany)
    navigation.navigate('Distribution')
  }
  const handleDrawerClaimFree = (): void => {
    // 复制飞书免费资料链接到剪贴板 + FloatBox 提示
    const feishuUrl = 'https://ihui.feishu.cn/wiki/'
    Clipboard.setString(feishuUrl)
    showToast('success', '链接已复制到剪贴板,可在浏览器粘贴打开')
  }
  const handleDrawerCreateNewChat = (): void => {
    setMessages([])
    setPrompt('')
    setMaterialCards([])
  }
  /** 加载历史对话消息并填入当前消息列表(对齐 Uniapp handleShowFullList) */
  const loadConversationMessages = useCallback(async (id: string): Promise<void> => {
    const res = await getMessages(id, { page: 1, pageSize: 100 })
    if (res.success) {
      const loaded: ChatMessage[] = res.data.messages.map((m, idx) => ({
        id: `${m.id}-${idx}`,
        role: m.role,
        content: m.content,
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
  }, [])

  // 从 ProfileScreen Drawer 跳转时携带 conversationId,自动加载对应对话
  useEffect(() => {
    const conversationId = route.params?.conversationId
    if (conversationId) void loadConversationMessages(conversationId)
  }, [route.params?.conversationId, loadConversationMessages])

  // ── 分享智汇值弹窗自动触发(对齐 Uniapp checkFirstShareStatus API 自动检查) ──
  // Uniapp:用户进页面时若未领过智汇值则由 API 自动弹出 share-points 弹窗。
  // mobile-rn:Share2 按钮改为跳个人中心(对齐 goToMyPage),弹窗改由本 effect 自动触发。
  // TODO: 待 API 实现 checkFirstShareStatus 后接入真实检查;
  //   当前用注释占位,不自动弹出(避免每次进页面都弹,影响 UX)。
  // useEffect(() => {
  //   void (async () => {
  //     const shouldShow = await checkFirstShareStatus()
  //     if (shouldShow) setShareValueVisible(true)
  //   })()
  // }, [])

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
    navigation.navigate('Tabs', { screen: 'home' } as never)
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

  // ── 素材库列表(占位,后续对接 getMyCreation API) ──
  const materialItems: MaterialItem[] = []
  const materialLoading = false

  // ── 消息列表渲染 ──
  const renderMessage: ListRenderItem<ChatMessage> = ({ item }) => {
    const isUser = item.role === 'user'
    return (
      <View style={[styles.msgRow, isUser ? styles.msgRowUser : styles.msgRowAi]}>
        <View
          style={[
            styles.msgBubble,
            isUser ? styles.msgBubbleUser : styles.msgBubbleAi,
          ]}
        >
          <Text
            style={[
              styles.msgText,
              isUser ? styles.msgTextUser : styles.msgTextAi,
            ]}
          >
            {item.content || (isStreaming && !isUser ? '正在思考…' : item.content)}
          </Text>
        </View>
      </View>
    )
  }

  const handleMessagesChange = (): void => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true })
    })
  }

  // ToggleButtonGroup 已合并到 BottomActionBar prompt 模式的 toggle chips

  // ── ModelList groups(由 models 派生,对齐 Uniapp ModelList 按 vendor 分组) ──
  const modelListGroups: ModelListGroup[] = models.length > 0
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
    navigation.navigate('AiAssistant', { agentId: id })
  }

  // BottomActionBar 已切换到 prompt 模式(模型条 + 开关 + 输入 + 发送 + 辅助行 + 图标组)
  // bottomActions 旧 API 已移除,所有交互通过 prompt 模式 props 传入

  return (
    <View style={styles.root}>
      {/* 推送通知弹窗(对齐 Uniapp 顶层 PushNotification,组件自管 visible) */}
      <NotificationPanel />

      {/* 顶部导航区(对齐 Uniapp navigation-bars:菜单 + 标题 + 加入) */}
      <NavBar
        title="智汇AI"
        rightAction={
          <View style={styles.navRight}>
            {/* 菜单按钮:打开 Drawer(受限于 NavBar 组件左侧固定为返回/占位,菜单放右侧) */}
            <Pressable
              hitSlop={8}
              onPress={() => setDrawerVisible(true)}
              accessibilityLabel="打开菜单"
            >
              <Menu size={22} color={tokens.text.primary} />
            </Pressable>
            {/* Agent 按钮:打开 Agent 列表(对齐 Uniapp ai_index.vue 行 34 AgentList) */}
            <Pressable
              hitSlop={8}
              onPress={showAgentList}
              accessibilityLabel="选择 Agent"
            >
              <Bot size={22} color={tokens.text.primary} />
            </Pressable>
            {/* 分享按钮:跳个人中心(对齐 Uniapp share-image + goToMyPage);
                share-points 弹窗改为进页面自动触发,见上方 useEffect) */}
            <Pressable
              hitSlop={8}
              onPress={goToMyPage}
              accessibilityLabel="个人中心"
            >
              <Share2 size={22} color={tokens.text.primary} />
            </Pressable>
            {/* 加入按钮:显示二维码弹窗 */}
            <Pressable
              hitSlop={8}
              onPress={showQrCode}
              accessibilityLabel="加入社区"
            >
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
        {/* 消息列表区(对齐 Uniapp conversationMessages) */}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.msgListContent}
          onContentSizeChange={handleMessagesChange}
          onLayout={handleMessagesChange}
          showsVerticalScrollIndicator={false}
        />

        {/* 素材库弹窗(sck 点击,对齐 Uniapp showMaterialList + MaterialList 组件,Modal 形式避免挤压消息列表) */}
        {showMaterialList ? (
          <Modal
            visible={showMaterialList}
            transparent
            animationType="slide"
            onRequestClose={() => { setShowMaterialList(false); setCurrentModelType('') }}
          >
            <Pressable
              style={styles.modalMask}
              onPress={() => { setShowMaterialList(false); setCurrentModelType('') }}
            >
              <Pressable
                style={styles.materialPopup}
                onPress={(e) => e.stopPropagation()}
              >
                <View style={styles.materialPopupHeader}>
                  <Text style={styles.materialPopupTitle}>我的创作</Text>
                  <Pressable
                    hitSlop={8}
                    onPress={() => { setShowMaterialList(false); setCurrentModelType('') }}
                  >
                    <X size={20} color={tokens.text.secondary} />
                  </Pressable>
                </View>
                <MaterialList
                  categories={[...MATERIAL_CATEGORIES]}
                  activeCategory={materialTab}
                  onCategoryChange={setMaterialTab}
                  items={materialItems}
                  onPress={handleMaterialItemClick}
                  loading={materialLoading}
                />
              </Pressable>
            </Pressable>
          </Modal>
        ) : null}

        {/* Material 卡片区(当前对话引入的素材,横向 + 删除,对齐 Uniapp materialCards) */}
        {materialCards.length > 0 ? (
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
          </ScrollView>
        ) : null}

        {/* 图片附件列表(对齐 Uniapp imgsList,复用 useChatInput inputFiles) */}
        {inputFiles.length > 0 ? (
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
          </ScrollView>
        ) : null}

        {/* 模型类型切换区(横向 ScrollView,对齐 Uniapp 8 个 model-type-btn) */}
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
                <Text
                  style={[
                    styles.modelTypeLabel,
                    active ? styles.modelTypeLabelActive : null,
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            )
          })}
        </ScrollView>

        {/* 功能开关组已合并到 BottomActionBar prompt 模式(对齐 Uniapp BottomActionBar 大一统) */}

        {/* BottomActionBar prompt 模式(模型条 + 开关组 + 图片预览 + 输入框 + 发送 + 辅助行 + 图标组)
            对齐 Uniapp BottomActionBar.vue 单一组件承载所有底部交互 */}
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
          onRemoveImage={inputFiles.length > 0 ? () => onInputRemoveFile(inputFiles[0]!.id) : undefined}
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
      <Modal visible={shareValueVisible} transparent animationType="fade" onRequestClose={hideSharePoints}>
        <Pressable style={styles.modalMask} onPress={hideSharePoints}>
          <Pressable style={styles.shareContent} onPress={(e) => e.stopPropagation()}>
            <Pressable hitSlop={8} onPress={hideSharePoints} style={styles.shareClose}>
              <X size={20} color={tokens.text.primary} />
            </Pressable>
            <Share2 size={48} color={tokens.purple.DEFAULT} />
            <Text style={styles.shareTitle}>分享领智汇值</Text>
            <Text style={styles.shareDesc}>
              邀请好友加入智汇AI社区,好友注册成功后双方均可获得智汇值奖励。智汇值可用于兑换模型算力、会员权益等。
            </Text>
            <Pressable onPress={handleShareClick} style={styles.shareBtn}>
              <Text style={styles.shareBtnText}>立即分享</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* P1.1 转语音 Modal(语音类型选项 + 模拟 TTS loading) */}
      <Modal
        visible={ttsVisible}
        transparent
        animationType="fade"
        onRequestClose={() => { if (!ttsLoading) setTtsVisible(false) }}
      >
        <Pressable
          style={styles.modalMask}
          onPress={() => { if (!ttsLoading) setTtsVisible(false) }}
        >
          <Pressable style={styles.listDialogContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.listDialogHeader}>
              <Text style={styles.listDialogTitle}>转语音</Text>
              <Pressable
                hitSlop={8}
                onPress={() => { if (!ttsLoading) setTtsVisible(false) }}
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
                    style={({ pressed }) => [styles.ttsOptionBtn, pressed && styles.panelItemPressed]}
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
                onPress={() => { void handleUrlConfirm() }}
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
              <Text style={styles.fileUploadHint}>
                文件选择功能待接入(expo-document-picker 未安装)
              </Text>
              <Pressable
                onPress={() => {
                  setFileUploadVisible(false)
                  showToast('info', '文件选择功能待接入')
                }}
                style={styles.fileUploadConfirmBtn}
                accessibilityRole="button"
                accessibilityLabel="知道了"
              >
                <Text style={styles.fileUploadConfirmText}>知道了</Text>
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
      <Modal visible={modelListVisible} transparent animationType="fade" onRequestClose={() => setModelListVisible(false)}>
        <Pressable style={styles.modalMask} onPress={() => setModelListVisible(false)}>
          <Pressable style={styles.listDialogContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.listDialogHeader}>
              <Text style={styles.listDialogTitle}>选择模型</Text>
              <Pressable hitSlop={8} onPress={() => setModelListVisible(false)} style={styles.listDialogClose}>
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
      <Modal visible={agentListVisible} transparent animationType="fade" onRequestClose={() => setAgentListVisible(false)}>
        <Pressable style={styles.modalMask} onPress={() => setAgentListVisible(false)}>
          <Pressable style={styles.listDialogContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.listDialogHeader}>
              <Text style={styles.listDialogTitle}>选择 Agent</Text>
              <Pressable hitSlop={8} onPress={() => setAgentListVisible(false)} style={styles.listDialogClose}>
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
    gap: 16,
  },
  // ── 消息列表 ──
  msgListContent: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    paddingBottom: BOTTOM_BAR_TOTAL + 8,
  },
  msgRow: {
    marginVertical: 4,
    flexDirection: 'row',
  },
  msgRowUser: {
    justifyContent: 'flex-end',
  },
  msgRowAi: {
    justifyContent: 'flex-start',
  },
  msgBubble: {
    maxWidth: '78%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  msgBubbleUser: {
    backgroundColor: tokens.brand.DEFAULT,
  },
  msgBubbleAi: {
    backgroundColor: tokens.surface.card,
  },
  msgText: {
    fontSize: 14,
    lineHeight: 20,
  },
  msgTextUser: {
    color: tokens.surface.light,
  },
  msgTextAi: {
    color: tokens.text.primary,
  },
  // ── 素材库弹窗(Modal 内部对话框样式,参考 listDialogContent) ──
  materialPopup: {
    width: '88%',
    maxHeight: '70%',
    backgroundColor: tokens.surface.light,
    borderRadius: 12,
    overflow: 'hidden',
  },
  materialPopupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
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
    paddingHorizontal: 12,
    gap: 8,
  },
  materialCard: {
    width: 120,
    height: 56,
    backgroundColor: tokens.surface.card,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
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
    marginTop: 2,
  },
  // ── 图片附件列表 ──
  imgsListScroll: {
    maxHeight: 60,
  },
  imgsListContent: {
    paddingHorizontal: 12,
    gap: 8,
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
    paddingHorizontal: 12,
    gap: 8,
    alignItems: 'center',
  },
  modelTypeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
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
    paddingHorizontal: 12,
    paddingVertical: 2,
  },
  // ── 输入框区域 ──
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
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
    paddingHorizontal: 12,
    paddingVertical: 8,
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
    padding: 20,
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
    marginBottom: 12,
  },
  qrCodeTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: tokens.text.primary,
    marginBottom: 10,
  },
  qrCodeHint: {
    padding: 4,
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
    padding: 24,
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
    marginTop: 12,
    marginBottom: 8,
  },
  shareDesc: {
    fontSize: 13,
    lineHeight: 19,
    color: tokens.text.secondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  shareBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 6,
    backgroundColor: tokens.brand.DEFAULT,
  },
  shareBtnText: {
    fontSize: 14,
    color: tokens.surface.light,
    fontWeight: '500',
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
    paddingHorizontal: 16,
    paddingVertical: 12,
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
  // ── 功能面板/来源面板(BottomPops 子内容样式) ──
  panelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 56,
    gap: 14,
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
    marginHorizontal: 16,
    marginTop: 8,
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: tokens.surface.card,
  },
  fangdaTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: tokens.text.primary,
  },
  fangdaCloseBtn: {
    padding: 4,
  },
  fangdaInput: {
    flex: 1,
    fontSize: 16,
    color: tokens.text.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    textAlignVertical: 'top',
  },
  fangdaFooter: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: tokens.surface.card,
  },
  fangdaSendBtn: {
    backgroundColor: tokens.brand.DEFAULT,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  fangdaSendBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: tokens.surface.light,
  },
  // ── P1.1 转语音 Modal ──
  ttsLoadingWrap: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ttsLoadingText: {
    fontSize: 14,
    color: tokens.text.secondary,
  },
  ttsOptions: {
    paddingVertical: 8,
    gap: 4,
  },
  ttsOptionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: tokens.surface.muted,
    marginHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  ttsOptionText: {
    fontSize: 15,
    color: tokens.text.primary,
  },
  ttsCancelBtn: {
    marginTop: 12,
    marginBottom: 16,
  },
  // ── P1.4 网页链接输入 Modal ──
  urlInputBody: {
    padding: 16,
    gap: 12,
  },
  urlInputField: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: tokens.surface.muted,
    fontSize: 14,
    color: tokens.text.primary,
  },
  urlInputConfirmBtn: {
    backgroundColor: tokens.brand.DEFAULT,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  urlInputConfirmText: {
    fontSize: 15,
    fontWeight: '500',
    color: tokens.surface.light,
  },
  // ── P1.5 文件上传 Modal ──
  fileUploadBody: {
    padding: 16,
    gap: 12,
  },
  fileUploadDesc: {
    fontSize: 14,
    color: tokens.text.primary,
    fontWeight: '500',
  },
  fileUploadTypeList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  fileUploadTypeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
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
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  fileUploadConfirmText: {
    fontSize: 15,
    fontWeight: '500',
    color: tokens.surface.light,
  },
})

export default ChatScreen
