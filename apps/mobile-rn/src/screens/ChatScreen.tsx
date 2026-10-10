// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
 * BottomActionBar 30+ 事件回调已全部接线:send-message/toggle-voice-input/
 * toggle-super-agent/toggle-super-agentfu/toggle-mcp/toggle-knowledge-base/
 * toggle-permanent-memory/showModelConfig/show-model-list/remove-image/update:prompt/
 * function-handle/source-handle/icon-click/fangda/start-long-press/end-long-press/
 * input-click/start-voice-animation/stop-voice-animation/modelConfigChange/
 * keyboard-show/keyboard-hide。
 *
 * 平台独占:仅 mobile-rn 端,不涉及其他端。
 */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useTheme } from '../context/ThemeContext'
import { useAudioPlayer } from 'expo-audio'
import * as DocumentPicker from 'expo-document-picker'
import { File, Paths } from 'expo-file-system'
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
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
  useWindowDimensions,
} from 'react-native'
import type { FlatList } from 'react-native'
import Clipboard from '@react-native-clipboard/clipboard'
import * as MediaLibrary from 'expo-media-library'
import { captureRef } from 'react-native-view-shot'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { tokens } from '../theme/active-tokens'
import {
  AlertTriangle,
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
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Video,
  Volume2,
  X,
} from 'lucide-react-native'
import {
  batchOperateConversations,
  claimShareFirstReward,
  compactConversation,
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
  getTokenBalance,
  getWorkspacePermissionDefault,
  listConversations,
  rateChatMessage,
  resolveFileUrl,
  streamChat,
  uploadFileMultipart,
  type Agent,
  type ConversationDetail,
  type LlmModel,
  type MessageRating,
  type MyCreationItem,
  type MyCreationType,
} from '@ihui/api-client'
// D136(2026-10-01 立,承 V4 #94/D84):高危工具审批 —— 面板 + 常驻待审批胶囊,
// 三档 once/session/always 逐档对齐 web(tool-approval-dialog.tsx),默认 once 最小特权。
import { useToolApprovalQueue } from '../components/ai/ToolApprovalSheet'
import { apiFailureToText } from '@ihui/shared/utils'
import { FALLBACK_MODELS as SHARED_FALLBACK_MODELS, toUserFriendlyMessage } from '@ihui/shared'
import type { ChatMessage } from '@ihui/shared'
import {
  applyStreamError,
  isErrorTurn,
  resendTargetText,
  conversationMetaLedger,
} from '@ihui/shared/chat'
import type { ModelConfigType } from '@ihui/ui-native'
import {
  ChatScreen as SharedChatScreen,
  type ChatScreenMessage,
  type ChatScreenModel,
} from '@ihui/rn-app'
import { NavBar } from '../components/NavBar'
// G-166:交代区(RN 端共享组件)—— 引用来源 + 本轮上下文注入,与 N8n 屏同一实现
import {
  CitationList,
  InjectionDisclosure,
  PermissionTierRow,
  SteerNoticeList,
} from '../components/ChatDisclosure'
// D135(承 V4 #93):任务进度状态条 —— 执行帧折叠结果的可读出口,与 N8n 屏同一组件
import { TaskStatusBar } from '../components/ai/TaskStatusBar'
import {
  appendCitationFrames,
  applyAssistantExecutionFrame,
  applyInjectionFrame,
  appendSteerFrames,
  formatDurationMs,
  readSteerAppliedFromMetadata,
  type AssistantExecutionFrame,
  type AssistantExecutionViz,
  type MessageCitation,
  type MessageInjection,
  type SteerNotice,
} from '../utils/chat-render-model'
import { thinkingTitleView } from '@ihui/shared/chat/element-pack'
import { BottomActionBar, type BottomActionBarIconType } from '../components/BottomActionBar'
import { McpStatusStrip } from '../components/McpStatusStrip'
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
import ModelPickerList, { type ModelListItem } from '../components/ModelPickerList'
import AgentList, { type AgentListItem } from '../components/AgentList'
import { BottomPops } from '../components/BottomPops'
import { FloatBox, type FloatBoxType } from '../components/FloatBox'
import { useAuth } from '../context/AuthContext'
import { useChatInput } from '../hooks/useChatInput'
// D153b / D154(2026-09-30 立)per-user 广播消费面:会话元数据覆盖 + MCP 状态行。
// 跨端判据在 @ihui/shared/chat/user-broadcast-store,本端只做接线与 FloatBox 提示出口适配。
import { useUserBroadcastSync } from '../hooks/use-user-broadcast-sync'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { DRAWER_TAB_TO_RN_TAB, mainScreenForTab } from '../navigation/tab-utils'
import { uiControlToolsFor } from '../lib/ui-control-tools'
import { useUiTextField } from '../lib/use-ui-text-field'
// D135:额度分档告警一行措辞(两屏共用同一份,键挂 common.*)
import { budgetNoteText } from '../utils/budget-note'
import { useI18n } from '../i18n'
import { rpx } from '../utils/rpx'
// 消息富内容解析(代码块/图片/文本分段,对齐 ai_index2 agent_content_list;独立模块供单测共用)
import { parseMessageContent } from '../utils/message-parse'

import { rnRadius } from '@ihui/design-tokens'

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
  /** G-166 交代区:本轮引用来源 / 带了哪些上下文(与 @ihui/shared ChatMessage 同一形状) */
  citations?: MessageCitation[]
  injections?: MessageInjection[]
  /** D106 Steer(中途引导):本轮被用户注入的引导交代,对齐 web steerNoticesByMessageId。
   *  api 侧已随回调落库 metadata.steerApplied,历史水合读回(2026-09-24 立)。 */
  steerNotices?: SteerNotice[]
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

// steerNotices 是端内瞬时态:@ihui/shared ChatMessage 无此字段(types 包只读不扩),
// 交集类型承载(live 由 onSteer 累积,历史由 metadata.steerApplied 读回)
type ChatMessageWithSteer = ChatMessage & { steerNotices?: SteerNotice[] }

/**
 * D135(承 V4 #93)交互帧的最小承接形状(契约见 api-client StreamChatOptions.onQuestion /
 * FormRequestEvent)。完整弹窗 + 作答/填报续流属后续票面(D136 族),本票先保证
 * 帧到屏可见(列表条目),刻意不做假可交互控件。
 */
interface PendingQuestionEntry {
  questionId: string
  prompt: string
  options: Array<{ id: string; label: string }>
  allowCustom: boolean
  allowMultiple: boolean
}

interface PendingFormEntry {
  requestId: string
  kind: string
  fieldCount: number
}

const toChatScreenMessage = (m: ChatMessageWithSteer): ChatScreenMessageWithReasoning => ({
  id: m.id,
  role: m.role as 'user' | 'assistant',
  content: m.content,
  // 推理过程随消息一起透传(历史/流式消息均可能带 reasoning,渲染思考过程展开块用)
  reasoning: m.reasoning,
  // G-166:交代字段同样透传(历史消息由 metadata 水合,流式消息由 SSE 回调累积)
  citations: m.citations,
  injections: m.injections,
  // D106:steer 交代透传 —— 不透传则 live 帧(映射发生在 onSteer 落 state 之后)与
  // 历史读回都在本屏静默丢失
  steerNotices: m.steerNotices,
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

/** 文件上传支持类型徽章(P1.5,expo-document-picker 已装,DocumentPicker + uploadFileMultipart 真实上传) */
const FILE_TYPE_BADGES: readonly string[] = ['PDF', 'Word', 'Excel', 'TXT'] as const

// DrawerTab 中 home/ai/mine 是 MainStack 路由(走 Main navigator);
// square/share 是 RootStack 路由(直接 navigate,见 handleDrawerNavigate)。

// ── ChatScreen 组件 ──

export function ChatScreen() {
  const { resolvedTheme } = useTheme()
  const { t } = useI18n()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const route = useRoute<RouteProp<RootStackParamList, 'Chat'>>()
  const rootNav = navigation.getParent<RootNav>()
  const { user: authUser, token: authToken, logout } = useAuth()
  const {
    inputFiles,
    isVoiceMode,
    onInputAddImage,
    onInputRemoveFile,
    onInputVoiceToggle,
    onInputVoiceStart,
    onInputVoiceEnd,
  } = useChatInput()

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
  // RN 0.86 Fabric:百分比 maxHeight 不会给子节点确定高度,内部列表无法滚动 →
  // 用 useWindowDimensions 算出确定高度,并同步覆盖 listDialogContent 的 maxHeight:'70%'
  // (两者不一致会被 maxHeight 截断,导致底部内容被 overflow:hidden 裁掉)
  const { height: windowHeight } = useWindowDimensions()
  const modelPickerHeight = Math.round(windowHeight * 0.7)

  // ── 模型/对话状态 ──
  const [currentModelType, setCurrentModelType] = useState<ModelType | ''>('')
  // 对话页顶部「查看卡片」折叠(对齐 Uniapp ai_index2.vue tishi_show:初始展开,点击 tishiHandle 切换)
  const [tishiShow, setTishiShow] = useState(true)
  // 智汇值卡(对齐 Uniapp ai_index2 tokenQuantity;数据源 getTokenBalance 真实余额,
  // 接口异常静默降级为 0,不阻塞页面;充值跳 AppTopup)
  const [tokenQuantity, setTokenQuantity] = useState(0)
  const [materialCards, setMaterialCards] = useState<MaterialCard[]>([])
  // 当前对话 DB id(Profile/Drawer 跳转加载历史对话时写入;新会话为 null → 收藏降级为本地 UI 状态)
  const [conversationId, setConversationId] = useState<string | null>(
    route.params?.conversationId ?? null,
  )
  const [prompt, setPrompt] = useState('')
  useUiTextField({ label: '请输入内容...', value: prompt, setValue: setPrompt, multiline: true })
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
  /** 输入区滑出面板(对齐 Uniapp isShowIcon:辅助按钮行 + 图标按钮组,默认隐藏,
   *  点输入行「+」toggle 滑出/收起;发送后自动收起) */
  const [inputPanelVisible, setInputPanelVisible] = useState<boolean>(false)
  // P1.1 转语音 Modal(语音类型选项 + 真实 TTS loading)
  const [ttsVisible, setTtsVisible] = useState(false)
  const [ttsLoading, setTtsLoading] = useState(false)
  const ttsPlayer = useAudioPlayer(null)
  // P1.2 收藏 UI 状态(Set 跟踪已收藏消息 id;有 conversationId 时调 batchOperateConversations,
  // 无对话 id 时降级为纯本地 UI 状态,见 toggleFavorite)
  const [favoritedMessageIds, setFavoritedMessageIds] = useState<Set<string>>(new Set())
  // P1.4 网页链接输入 Modal
  const [urlInputVisible, setUrlInputVisible] = useState(false)
  const [urlInputValue, setUrlInputValue] = useState('')
  useUiTextField({
    label: '请输入网页链接(https://...)',
    value: urlInputValue,
    setValue: setUrlInputValue,
    keyboardType: 'url',
  })
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
  // 手动压缩上下文请求进行中(✂ 按钮 loading + 防重复点击)
  const [compacting, setCompacting] = useState(false)

  // D136(承 V4 #94/D84):高危工具审批。host = 审批面板 + 常驻待审批胶囊(AGENTS §30:
  // 关闭 ≠ 决策,被拒/收起后仍留人工放行入口);onToolApproval 挂进 streamChat 回调表。
  const toolApproval = useToolApprovalQueue()

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

  // ── D135 执行帧接线状态(承 V4 #93) ──
  // 本轮 assistant 消息 id → 折叠后的 tool/plan/terminal 快照。折叠实现唯一在
  // chat-render-model.ts 的 applyAssistantExecutionFrame(组合三个/五个既有 reducer):
  // tool-result 到达由 applyToolCallEvent 清掉 pending、增量走 applyToolDelta、
  // 计划走 applyPlanUpdate —— 屏内不自折,没有第二份真相。
  const [executionVizById, setExecutionVizById] = useState<Record<string, AssistantExecutionViz>>(
    {},
  )
  // D135 交互帧最小可视态(AI 提问 / 业务表单):先保证帧到屏可见,完整续流属后续票面
  const [pendingQuestions, setPendingQuestions] = useState<PendingQuestionEntry[]>([])
  const [pendingForms, setPendingForms] = useState<PendingFormEntry[]>([])
  // 无渲染位帧的计数器(最小态 = 计数 + 日志行,不静默丢帧,也不给永不触发的帧造假 UI)
  const streamDiagRef = useRef({
    response: 0,
    toolDelegate: 0,
    terminalDelta: 0,
    subagentSpawn: 0,
    subagentProgress: 0,
    subagentEnd: 0,
    agentDelta: 0,
    memoryUpdates: 0,
  })

  /**
   * D153b / D154:per-user 广播接线。
   * 提示出口**复用本端已有的 FloatBox**(showToast)—— 不新立 UI 面:新立一面就触发
   * AGENTS §17 的运行时 DOM 自验,而 RN 界面本机渲染不了,那条验收只会变成"写了没人验过"。
   */
  const notifyBroadcast = useCallback(
    (message: string): void => {
      showToast('info', message)
    },
    [showToast],
  )
  useUserBroadcastSync({ token: authToken, translate: t, notify: notifyBroadcast })
  // 账本被广播改过 ⇒ 版本递增 ⇒ 下面的抽屉列表重算覆盖值(不发任何 HTTP 请求)
  const broadcastMetaVersion = useSyncExternalStore(
    subscribeConversationMeta,
    getConversationMetaVersion,
  )
  /**
   * 抽屉里的会话行按广播账本盖过标题(另一端改名 ⇒ 本端不刷新就看到)。
   *
   * 覆盖发生在**渲染前的派生**而不是 setState 回写 state:state 里那份仍是上次拉取的原样,
   * 下一次 `loadDrawerConversations` 以库为准直接覆盖它 —— 账本因此不会被读成"第二份真相"。
   * 只盖 title:抽屉行没有归档列,`model` 在抽屉里是 modelConfig(名字档),
   * 把没有呈现面的字段算成"已同步"就是第二种分叉 —— 所以这条链路始终喊 pullOnly。
   */
  const drawerConversationsForRender = useMemo(() => {
    // 读一次版本键:账本改动不发请求,失效全靠它 —— 不读它则 eslint 判"多余依赖"而删掉即退化成
    // "另一端改了标题、本端不重算"(与上面那句注释是同一件事的两种写法,取能被静态检查看见的那一种)。
    void broadcastMetaVersion
    return drawerConversations.map((item) => {
      const title = conversationMetaLedger.titleFor(item.id, item.title)
      return title === item.title ? item : { ...item, title }
    })
  }, [drawerConversations, broadcastMetaVersion])

  // ── 智汇值卡余额加载(getTokenBalance;接口异常静默降级为 0,不阻塞页面) ──
  useEffect(() => {
    let cancelled = false
    getTokenBalance()
      .then((res) => {
        if (cancelled) return
        if (res.success) setTokenQuantity(res.data.balance)
        // 失败保持默认 0,静默降级
      })
      .catch(() => {
        // 接口异常不阻塞页面
      })
    return () => {
      cancelled = true
    }
  }, [])

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
      // D153b:把本端已知的会话 id 交进账本 —— 账本只覆盖"这一端正在显示的行",
      // 没交进去的会话收到广播会报 known:false,由 pullOnly 明示而不是凭空长出一行。
      conversationMetaLedger.remember(res.data.conversations.map((c) => c.id))
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

  // 会话列表失效(2026-09-21,外部会话导入):重新获得焦点即作废懒加载缓存,
  // 下次打开 Drawer 走既有 loadDrawerConversations 重新拉取,新导入的会话立即可见。
  // 复用既有 drawerConversationsLoaded 开关,不新造 store / 事件总线。
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setDrawerConversationsLoaded(false)
    })
    return unsubscribe
  }, [navigation])

  // ── 发送消息(send-message 事件) ──
  const send = async (overrideText?: string, baseHistory?: ChatMessage[]): Promise<void> => {
    // 发送即收起滑出面板(对齐 Uniapp handleSendMessageabc:isShowIcon = false)
    setInputPanelVisible(false)
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
        // 对齐历史 loginPopUp/index.vue openIntroduce:「开通会员」→ vip_info?type=IntroducePopup
        { text: '开通会员', onPress: () => navigation.navigate('Vip', { type: 'IntroducePopup' }) },
        { text: '取消', style: 'cancel' },
      ])
      return
    }
    // overrideText 用于 P1.4 网页链接发送等场景;onSend 已 wrap 为 () => send() 防止 PressableEvent 传入
    // baseHistory:失败轮重试时显式传入"截到上一次提问之前"的历史,避免用渲染闭包里的旧 messages
    const text = (typeof overrideText === 'string' ? overrideText : prompt).trim()
    if (!text || isStreaming) return
    setPrompt('')
    const userMsg: ChatMessage = { id: nextId(), role: 'user', content: text }
    const aiMsg: ChatMessage = { id: nextId(), role: 'assistant', content: '' }
    const history = [...(baseHistory ?? messages), userMsg]
    setMessages([...history, aiMsg])
    // D135:折叠键在 send() 里就锁到本轮那条 assistant 消息(不在回调里现算"最后一条",
    // 否则流式期间再来一条消息,帧就会折到错误的卡上)
    const turnAssistantId = aiMsg.id
    /** 本轮执行帧的唯一折叠出口(实现唯一在 chat-render-model,屏内不做第二份折叠) */
    const foldExecutionFrame = (frame: AssistantExecutionFrame): void => {
      setExecutionVizById((prev) => ({
        ...prev,
        [turnAssistantId]: applyAssistantExecutionFrame(prev[turnAssistantId], frame),
      }))
    }
    setIsStreaming(true)
    const controller = new AbortController()
    abortRef.current = controller
    // 失败轮不进下一轮上下文(与 web send-message.ts 同规则):
    // 否则"请求出错"那句会被模型当成自己上一轮的回答读进去
    const apiMessages = history
      .filter((m) => !isErrorTurn(m))
      .map((m) => ({ role: m.role, content: m.content }))
    // AI 操控本端(2026-09-21):只对"这一句"做意图判定,system/历史不参与 ——
    // 否则提示词里的"打开/进入"字样会让每次请求都带上工具,打字机流式首字延迟被拖进 tool 往返。
    const agentTools = uiControlToolsFor(text)
    await streamChat({
      model,
      messages: apiMessages,
      // 不命中意图时连字段都不出现,请求体与改造前逐字节一致
      ...(agentTools.length > 0 ? { agentTools } : {}),
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
      // ── D135(承 V4 #93):23 个缺失回调逐个接线。实现复用 chat-render-model 既有
      // reducer / N8n 屏同款出口 / 本端既有组件,不在屏内复制任何折叠实现。 ──
      // 工具调用可视化:tool-call-start/tool-result 折叠进本轮 viz(TaskStatusBar 渲染)
      onToolCall: (event) => {
        foldExecutionFrame({ kind: 'tool-call', event })
      },
      // D113 文件写类工具流中 diff 预览:覆盖写 partialDiff,tool-result 到达即清(同一出口)
      onToolDelta: (event) => {
        foldExecutionFrame({ kind: 'tool-delta', event })
      },
      // 工具调用汇总:主屏暂无摘要卡渲染位,最小态 = 落消息 meta(数据不静默丢)
      onToolSummary: (summary) => {
        setMessages((prev) => {
          const next = [...prev]
          const last = next[next.length - 1]
          if (last && last.role === 'assistant') {
            next[next.length - 1] = { ...last, meta: { ...last.meta, toolCallSummary: summary } }
          }
          return next
        })
      },
      // 高危工具审批(交互帧):D136 四点手术已接(toolApproval.onToolApproval),此处不重复
      // 工具委派(浏览器端 fs 执行族):RN 无工作区句柄,最小态 = 计数 + 日志行
      onToolDelegate: (event) => {
        streamDiagRef.current.toolDelegate += 1
        console.info(
          `[chat] tool-delegate #${streamDiagRef.current.toolDelegate} ${event.tool_name} iter=${event.iteration}`,
        )
      },
      // 计划步骤可视化:plan 为权威快照整体替换(TaskStatusBar 渲染)
      onPlanUpdate: (event) => {
        foldExecutionFrame({ kind: 'plan-update', event })
      },
      // 终端任务生命周期:折叠进本轮 viz(气泡内最小可视态 = 命令 + 状态 + 耗时)
      onTerminalStart: (event) => {
        foldExecutionFrame({ kind: 'terminal-start', event })
      },
      // 终端实时输出增量:主屏无终端面板(N8n 屏才有),最小态 = 计数 + 日志行
      onTerminalDelta: (event) => {
        streamDiagRef.current.terminalDelta += 1
        console.info(
          `[chat] terminal-delta #${streamDiagRef.current.terminalDelta} id=${event.terminalId} len=${event.text?.length ?? 0}`,
        )
      },
      // 终端任务收尾:终态/输出/退出码/耗时折叠进本轮 viz
      onTerminalEnd: (event) => {
        foldExecutionFrame({ kind: 'terminal-end', event })
      },
      // 子代理生命周期:主屏无 SubAgentActivityFeed 渲染位,最小态 = 计数 + 日志行
      onSubagentSpawn: (event) => {
        streamDiagRef.current.subagentSpawn += 1
        console.info(
          `[chat] subagent-spawn #${streamDiagRef.current.subagentSpawn} id=${event.id} task=${event.task}`,
        )
      },
      onSubagentProgress: (event) => {
        streamDiagRef.current.subagentProgress += 1
        console.info(
          `[chat] subagent-progress #${streamDiagRef.current.subagentProgress} id=${event.id} phase=${event.phase}`,
        )
      },
      onSubagentEnd: (event) => {
        streamDiagRef.current.subagentEnd += 1
        console.info(
          `[chat] subagent-end #${streamDiagRef.current.subagentEnd} id=${event.id} status=${event.status}`,
        )
      },
      // token 用量:写进消息 meta.totalTokens(与 N8n 屏 totalTokens 同义,主屏渲染位另行票面)
      onUsage: (usage) => {
        if (usage.totalTokens <= 0) return
        setMessages((prev) => {
          const next = [...prev]
          const last = next[next.length - 1]
          if (last && last.role === 'assistant') {
            next[next.length - 1] = {
              ...last,
              meta: { ...last.meta, totalTokens: usage.totalTokens },
            }
          }
          return next
        })
      },
      // 额度分档告警:复用两屏共用的一行措辞(utils/budget-note → @ihui/shared)
      onBudget: (event) => {
        showToast(event.level === 'critical' ? 'warning' : 'info', budgetNoteText(event, t))
      },
      // 上下文自动压缩提示:接入本屏既有提示条渲染阀门(renderListHeader 的 compactionInfo)
      onCompaction: (info) => {
        setCompactionInfo({
          before: info.tokensBefore,
          after: info.tokensAfter,
          removed: info.removedCount,
        })
      },
      // 模型降级(P4-2):本端无横幅位,FloatBox 是既有瞬时提示出口
      onFallback: (event) => {
        showToast('info', `模型降级:${event.primaryModel} → ${event.backupModel}`)
      },
      // 流式中断标记帧(G-815976 收口入契约):llm_gateway astream 异常中断且已发过
      // chunk 时发出,此后流终止不会再有 done —— 半截回答必须如实告知截断,
      // 不再与完整回答同形。提示出口复用本端既有 FloatBox(与 onFallback 同形)
      onPartialDone: () => {
        showToast('warning', t('chat.partialDoneTitle'))
      },
      // D39 重试交代:与 N8n 屏同一句词包(否则用户在流上只看到"卡住")
      onRetryScheduled: (event) => {
        showToast(
          'info',
          t('aiAssistantN8n.gatewayRetry', {
            attempt: event.attempt,
            max: event.maxRetries,
            seconds: Math.max(1, Math.round(event.retryInMs / 1000)),
          }),
        )
      },
      // AI 主动提问(交互帧):完整作答续流(/chat/answer)是另一条链路,先接最小可视态
      onQuestion: (question) => {
        setPendingQuestions((prev) =>
          prev.some((q) => q.questionId === question.questionId) ? prev : [...prev, question],
        )
      },
      // D77 业务表单请求(交互帧):BusinessFormCard 未搬到本端,最小可视态 = 列表条目
      onFormRequest: (event) => {
        setPendingForms((prev) =>
          prev.some((f) => f.requestId === event.requestId)
            ? prev
            : [
                ...prev,
                { requestId: event.requestId, kind: event.kind, fieldCount: event.fields.length },
              ],
        )
      },
      // 断线重连:提示出口复用 FloatBox(与 web"网络波动,正在重连…"同族)
      onReconnect: (attempt, delayMs) => {
        showToast(
          'info',
          `网络波动,正在第 ${attempt} 次重连(${Math.max(1, Math.round(delayMs / 1000))}s 后)`,
        )
      },
      // response 已到达(冷启动 watchdog 信号):本端无该 watchdog,最小态 = 计数
      onResponse: () => {
        streamDiagRef.current.response += 1
      },
      // 多 agent 分路增量:主屏无 agent 运行时面板(web 专用),最小态 = 计数 + 日志行
      onAgentDelta: (agentId, delta) => {
        streamDiagRef.current.agentDelta += 1
        console.info(
          `[chat] agent-delta #${streamDiagRef.current.agentDelta} agent=${agentId} len=${delta.length}`,
        )
      },
      // 记忆更新:主屏无「已记住」提示条,最小态 = 计数 + 日志行(条目数)
      onMemoryUpdates: (event) => {
        streamDiagRef.current.memoryUpdates += 1
        console.info(
          `[chat] memory-updates #${streamDiagRef.current.memoryUpdates} items=${event.items.length}`,
        )
      },
      onError: (err, info) => {
        // info 透传:errorCode 是"厂商账号额度耗尽"等稳定码的唯一判据(HTTP 仍回落默认 502)
        const formatted = formatSSEError(new Error(err), info)
        // 失败轮要"可辨认":此前只 toast,那条空 assistant 气泡既不进上下文也不给出口,
        // 界面上看成一轮"回答完了"。标记后由 renderMessage 渲染错误卡片 + 重试。
        setMessages((prev) => applyStreamError(prev, formatted.message))
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
      // G-166:交代帧在本屏此前 0 注册 —— 后端发了 citations / injection_applied,
      // 端内回调表不认这两个 type 就什么都看不到(与"parser 有帧 ≠ 端内显示"同因)。
      // 累积口径与 N8n 屏一致:引用**追加+去重**(整替会抹掉流首那批),注入按 kind 幂等追加。
      onCitations: (event) => {
        setMessages((prev) => {
          const next = [...prev]
          const last = next[next.length - 1]
          if (last && last.role === 'assistant') {
            next[next.length - 1] = {
              ...last,
              citations: appendCitationFrames(
                last.citations,
                (event.citations ?? []).map((x) => ({
                  source: x.source,
                  label: x.label,
                  ...(typeof x.url === 'string' ? { url: x.url } : {}),
                })),
              ),
            }
          }
          return next
        })
      },
      onInjectionApplied: (event) => {
        setMessages((prev) => {
          const next = [...prev]
          const last = next[next.length - 1]
          if (last && last.role === 'assistant') {
            next[next.length - 1] = {
              ...last,
              injections: applyInjectionFrame(last.injections, event),
            }
          }
          return next
        })
      },
      // D106 Steer(中途引导):ai-service 在 tool loop 边界注入引导后下发 steer 事件,
      // 这里逐字段承接(phase/text/timestamp/messageId)累积到最后一条 assistant 消息;
      // 空文本帧由 appendSteerFrames 整帧丢弃,不渲染空交代(与 N8n 屏同一累积口径)。
      onSteer: (event) => {
        // steerNotices:@ihui/shared ChatMessage 无此字段(types 包只读不扩),
        // 流式期间以本地交集类型承载(落库由 api 侧写 metadata.steerApplied,读回见
        // loadConversationMessages),渲染透传见 toChatScreenMessage。
        type StreamMessageWithSteer = ChatMessageWithSteer
        setMessages((prev) => {
          const next = [...prev]
          const last = next[next.length - 1] as StreamMessageWithSteer | undefined
          if (last && last.role === 'assistant') {
            const notices = appendSteerFrames(last.steerNotices, event)
            if (notices.length > 0) {
              next[next.length - 1] = { ...last, steerNotices: notices } as StreamMessageWithSteer
            }
          }
          return next
        })
      },
      // D136(承 V4 #94/D84):高危工具审批帧 —— 载荷已由 streamChat 内置解析
      // (api-client tryParseToolApproval,与 web 同一投影),这里只交给审批队列;
      // 不注册回调 ⇒ 帧照旧静默丢弃(本票立因:手机上高危操作没有任何弹窗)。
      onToolApproval: (event) => {
        toolApproval.onToolApproval(event)
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

  /** 失败轮重试:重发最后一条用户提问,并把历史截到它之前(失败轮不留进上下文)
   *  send 未包 useCallback(每轮渲染重建),故经 ref 间接调用,免得 retryLastTurn 身份每轮都变 */
  const sendRef = useRef(send)
  useEffect(() => {
    sendRef.current = send
  })
  const retryLastTurn = useCallback((): void => {
    const lastUserIdx = messages.map((m) => m.role).lastIndexOf('user')
    const text = resendTargetText(messages)
    if (lastUserIdx < 0 || !text) return
    const base = messages.slice(0, lastUserIdx)
    void sendRef.current(text, base)
  }, [messages])

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

  /** function-handle:打开功能面板(对齐 Uniapp function-handle 子组件,6 项 AI 功能)。
   *  面板(BottomPops)与滑出区(isShowIcon)解耦:开一个面板时关另一个,互斥防叠加 */
  const handleFunctionHandle = (): void => {
    setFunctionPanelVisible(true)
    setSourcePanelVisible(false)
  }

  /** source-handle:打开来源面板(对齐 Uniapp source-handle 子组件,4 项知识来源) */
  const handleSourceHandle = (): void => {
    setSourcePanelVisible(true)
    setFunctionPanelVisible(false)
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
   * 已接入 batchOperateConversations('favorite'/'unfavorite', [conversationId])(对话级收藏,
   * 后端 /api/chat/conversations/batch)。当前对话无 DB id(新会话/纯本地消息)时降级为
   * 本地 Set 跟踪 UI 状态 + toast,接口异常不阻塞收藏流程。
   */
  const toggleFavorite = useCallback((): void => {
    setFunctionPanelVisible(false)
    const lastAi = [...messages].reverse().find((m) => m.role === 'assistant' && m.content.trim())
    if (!lastAi) {
      showToast('info', '暂无消息可收藏')
      return
    }
    const isFavorited = favoritedMessageIds.has(lastAi.id)
    const applyLocalToggle = (): void => {
      setFavoritedMessageIds((prev) => {
        const next = new Set(prev)
        if (isFavorited) next.delete(lastAi.id)
        else next.add(lastAi.id)
        return next
      })
    }
    // 无 conversationId(未关联后端对话)时降级:仅本地 UI 状态,不调 API
    if (!conversationId) {
      applyLocalToggle()
      showToast('success', isFavorited ? '已取消收藏' : '已收藏')
      return
    }
    void batchOperateConversations(isFavorited ? 'unfavorite' : 'favorite', [conversationId])
      .then((res) => {
        if (res.success) {
          applyLocalToggle()
          showToast('success', isFavorited ? '已取消收藏' : '已收藏')
        } else {
          showToast('error', `收藏操作失败:${res.error ?? '未知错误'}`)
        }
      })
      .catch(() => showToast('error', '收藏失败,请稍后重试'))
  }, [conversationId, favoritedMessageIds, messages, showToast])

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
          // 清空后视为新会话,收藏降级为本地 UI 状态
          setConversationId(null)
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
   * 5. 转语音 → 真实 TTS(fetchTextToSpeechAudio + expo-audio 播放,openTtsPanel)
   * 6. 收藏 → batchOperateConversations('favorite'/'unfavorite', [conversationId])
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
   * 1. 素材库 → 已接 MaterialList 弹窗(数据源 getMyCreation 我的创作;
   *    后端无 /api/material 端点,素材库接口未开通,勿伪造)
   * 2. 网页链接 → 已接 URL 输入 Modal(纯前端实现,作为消息发送)
   * 3. 文件上传 → 已接 DocumentPicker + uploadFileMultipart 真实上传
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
   * icon-click:图标按钮点击(按 type 分发,对齐 Uniapp handleIconClick(type))。
   * album → 相册选图;camera → 相机拍摄(待接原生,占位提示);file / wxfile → 文件选择上传。
   */
  const handleIconClick = (type: BottomActionBarIconType): void => {
    if (type === 'album') {
      onInputAddImage()
      return
    }
    if (type === 'camera') {
      showToast('info', '相机拍摄待接入,请先用相册上传图片')
      return
    }
    // file / wxfile → 文件选择上传(复用 handleFileUpload DocumentPicker 流程)
    void handleFileUpload()
  }

  /** plus-toggle:输入行「+」按钮(对齐 Uniapp functionHandle → isShowIcon 切换)。
   *  展开:收起键盘 + 关闭 BottomPops 面板(互斥);收起:仅折叠滑出区 */
  const handlePlusToggle = (): void => {
    if (!inputPanelVisible) {
      Keyboard.dismiss()
      setFunctionPanelVisible(false)
      setSourcePanelVisible(false)
    }
    setInputPanelVisible(!inputPanelVisible)
  }

  /** fangda:放大输入区(切换展开状态,占位提示) */
  const handleFangda = (): void => {
    setFangdaVisible(!fangdaVisible)
  }

  // ── BottomActionBar 其余事件(补齐,全部纯前端逻辑,不涉及新后端接口) ──

  /** start-long-press / end-long-press:语音按钮长按开始/结束录音(复用 useChatInput 录音能力) */
  const handleStartLongPress = (): void => {
    if (!isVoiceMode) onInputVoiceToggle()
    void onInputVoiceStart()
  }
  const handleEndLongPress = (): void => {
    void onInputVoiceEnd()
  }

  /** input-click:输入框点击(标记聚焦,供 isInputFocused 等 UI 调整) */
  const handleInputClick = (): void => {
    setInputFocused(true)
  }

  /** start/stop-voice-animation:语音动画回调(BottomActionBar 内 voiceInputEnabled 变化触发)。
      语音动画 UI 尚未建立,mic 高亮由 voiceInputEnabled prop 驱动,此处保留空实现。 */
  const handleStartVoiceAnimation = (): void => {}
  const handleStopVoiceAnimation = (): void => {}

  /** keyboard-show / keyboard-hide:键盘监听回调(键盘避让由 KeyboardAvoidingView 处理,保留空实现) */
  const handleKeyboardShow = (): void => {}
  const handleKeyboardHide = (): void => {}

  /** model-config-change:模型名/配置按钮长按触发(对齐 Uniapp 长按进模型配置)→ 打开模型配置弹窗 */
  const handleModelConfigChange = (_config: unknown): void => {
    setModelConfigVisible(true)
  }

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
    } catch (e: unknown) {
      const detail = e instanceof Error ? e.message : typeof e === 'string' ? e : ''
      showToast('error', detail.trim() ? toUserFriendlyMessage(e) : '领取失败,请稍后重试')
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

  // D111:工作区权限档(null = 尚未取到/取数失败 → 整行隐藏,不假装知道档位;与 N8n 屏同一取数)。
  const [workspaceTier, setWorkspaceTier] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    getWorkspacePermissionDefault()
      .then((res) => {
        if (!cancelled && res.success && res.data) setWorkspaceTier(res.data.mode)
      })
      .catch(() => {
        // 取数失败:保持 null,该行隐藏
      })
    return () => {
      cancelled = true
    }
  }, [])

  // D111 消息反馈:点赞/点踩走 @ihui/api-client 唯一出口(rateChatMessage),不裸 fetch。
  const rateMessage = useCallback(async (messageId: string, next: MessageRating): Promise<void> => {
    try {
      await rateChatMessage({ messageId, rating: next })
    } catch {
      // 反馈提交失败不打断阅读流(与 web 端点赞失败静默同口径)
    }
  }, [])

  const renderMessage = useCallback(
    (item: ChatScreenMessage, _index: number): React.ReactNode => {
      const isUser = item.role === 'user'
      const isLastMessage = messages.length > 0 && item.id === messages[messages.length - 1]?.id
      const showActions = !isUser && item.content.trim() !== '' && !(isStreaming && isLastMessage)
      // 失败轮:渲染错误卡片而非正文;重试只在"确实有一条可重发的用户提问"时给
      const isFailed = !isUser && isErrorTurn(item)
      const retryable = isFailed && resendTargetText(messages) !== null
      // 富内容分段(代码块/图片/文本,对齐 ai_index2 agent_content_list;消息内容不长,直接解析)
      const segments = parseMessageContent(item.content)
      // 思考过程(对齐 ai_index2 thinking-process:assistant 消息带 reasoning 时渲染折叠区块,
      // 默认收起只显示标题行;reasoning 由 toChatScreenMessage 映射透传)
      const reasoning = !isUser ? ((item as ChatScreenMessageWithReasoning).reasoning ?? '') : ''
      // D64③ 双态标题判据走共享真相源:有思考 → thinkingTitle;无思考但有引用 → thinkingRefsTitle
      const thinkingView = thinkingTitleView(
        reasoning.trim() !== '',
        (item as ChatScreenMessageWithReasoning).citations?.length ?? 0,
      )
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
              {isFailed ? (
                // 失败轮:错误卡片(警示头 + 正文 + 重试出口),整块替换正文 —— 与 web D22 /
                // miniapp 同一形态,跨端一致:失败不产出内容,也不能看起来像一次正常回答。
                <View style={styles.msgErrorCard}>
                  <View style={styles.msgErrorHeader}>
                    <AlertTriangle size={14} color={tokens.error.text} />
                    <Text style={styles.msgErrorTitle}>{t('chatAlert.errorTitle')}</Text>
                  </View>
                  <Text style={styles.msgErrorBody} selectable>
                    {item.content}
                  </Text>
                  {retryable ? (
                    <TouchableOpacity
                      style={styles.msgErrorRetry}
                      hitSlop={8}
                      onPress={retryLastTurn}
                      accessibilityRole="button"
                      accessibilityLabel={t('chatAlert.errorRetry')}
                    >
                      <RefreshCw size={14} color={tokens.error.text} />
                      <Text style={styles.msgErrorRetryText}>{t('chatAlert.errorRetry')}</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : thinkingView ? (
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
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <MessageSquare size={12} color={tokens.text.secondary} />
                      <Text style={styles.thinkingTitle}>
                        {t(`ai.pane.${thinkingView.titleKey}`, thinkingView.values)}
                      </Text>
                    </View>
                    {reasoning.trim() !== '' ? (
                      <Text style={styles.thinkingToggle}>
                        {thinkingExpanded ? '收起' : '展开'}
                      </Text>
                    ) : null}
                  </Pressable>
                  {thinkingExpanded && reasoning.trim() !== '' ? (
                    <Text style={styles.thinkingContent} selectable>
                      {reasoning}
                    </Text>
                  ) : null}
                </View>
              ) : null}
              {!isFailed &&
                segments.map((seg, segIndex) => {
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
                              <Copy size={13} color={tokens.gray['200']} />
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
              {!isFailed && segments.length === 0 ? (
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
                {/* 失败轮不给"分享"(它不是内容);复制保留 —— 报错排查要用那段文字 */}
                {isFailed ? null : (
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
                )}
                {isFailed ? null : (
                  <TouchableOpacity
                    style={styles.msgActionBtn}
                    hitSlop={8}
                    onPress={() => void rateMessage(item.id, 'like')}
                    accessibilityRole="button"
                    accessibilityLabel="赞同"
                  >
                    <ThumbsUp size={16} color={tokens.text.secondary} />
                  </TouchableOpacity>
                )}
                {isFailed ? null : (
                  <TouchableOpacity
                    style={styles.msgActionBtn}
                    hitSlop={8}
                    onPress={() => void rateMessage(item.id, 'dislike')}
                    accessibilityRole="button"
                    accessibilityLabel="反对"
                  >
                    <ThumbsDown size={16} color={tokens.text.secondary} />
                  </TouchableOpacity>
                )}
              </View>
            ) : null}
            {/* G-166 交代区:本轮引用来源 + 带了哪些上下文(与 N8n 屏同一共享组件) */}
            {isFailed ? null : (
              <InjectionDisclosure
                items={(item as ChatScreenMessageWithReasoning).injections ?? []}
              />
            )}
            {isFailed ? null : (
              <CitationList items={(item as ChatScreenMessageWithReasoning).citations ?? []} />
            )}
            {/* D106 Steer(中途引导)交代:本轮被注入了哪些引导文本 */}
            {isFailed ? null : (
              <SteerNoticeList
                items={(item as ChatScreenMessageWithReasoning).steerNotices ?? []}
              />
            )}
            {/* D111 权限档交代行:档名 + 该档后果(与 N8n 屏同一共享组件;null 不渲染) */}
            {isFailed ? null : <PermissionTierRow key="permission-tier-row" mode={workspaceTier} />}
            {/* D135 终端任务最小可视态:命令 + 状态 + 耗时(完整终端面板在 N8n 屏,不在此复制) */}
            {isFailed ? null : executionVizById[item.id]?.terminalTasks?.length ? (
              <View style={styles.execRows}>
                {(executionVizById[item.id]!.terminalTasks ?? []).map((task) => (
                  <Text key={task.id} style={styles.execRowText} numberOfLines={1}>
                    {`$ ${task.command} · ${task.status}${
                      task.durationMs !== undefined ? ` · ${formatDurationMs(task.durationMs)}` : ''
                    }`}
                  </Text>
                ))}
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
      executionVizById,
      maybeTriggerFirstShareReward,
      showToast,
      handleLongPressMessage,
      rateMessage,
      retryLastTurn,
      t,
      workspaceTier,
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
    // D135 交互帧最小可视态(列表条目):AI 提问 / 业务表单请求帧到了就得看得见;
    // 完整弹窗 + 作答/填报续流属后续票面,此处刻意只读不写(不造假可交互控件)
    if (pendingQuestions.length > 0 || pendingForms.length > 0) {
      nodes.push(
        <View key="interaction-frames" style={styles.interactionCard}>
          {pendingQuestions.map((q) => (
            <View key={q.questionId} style={styles.interactionRow}>
              <Text style={styles.interactionTitle}>{q.prompt}</Text>
              {q.options.map((opt) => (
                <Text key={opt.id} style={styles.interactionMeta}>
                  {`· ${opt.label}`}
                </Text>
              ))}
            </View>
          ))}
          {pendingForms.map((f) => (
            <Text key={f.requestId} style={styles.interactionMeta}>
              {`表单请求 ${f.kind}(字段 ${f.fieldCount} 项)待填`}
            </Text>
          ))}
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
    pendingQuestions,
    pendingForms,
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
    // 数据源 getMyCreation(我的创作);后端无 /api/material 端点,素材库接口未开通,
    // 此处直接复用 materialItems 中的真实标题/类型生成卡片,不做额外接口调用
    const item = materialItems.find((m) => m.id === id)
    const cardType: 1 | 2 | 3 | 4 =
      item?.type === 'image' ? 2 : item?.type === 'video' ? 3 : item?.type === 'audio' ? 4 : 1
    const card: MaterialCard = {
      id: nextMaterialCardId(),
      type: cardType,
      // item 在列表中找不到时回退占位标题(仅理论边界,勿伪造接口)
      title: item?.title ?? `素材 ${id}`,
      content: item?.text ?? '',
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
            setMaterialDetailError(apiFailureToText(res, '加载详情失败'))
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
    // D135:切新会话,本轮执行帧快照整体清(旧会话的折叠结果不挂到新会话上)
    setExecutionVizById({})
    // 新会话无后端对话 id,收藏降级为本地 UI 状态
    setConversationId(null)
  }
  /** 加载历史对话消息并填入当前消息列表(对齐 Uniapp handleShowFullList) */
  const loadConversationMessages = useCallback(
    async (id: string): Promise<void> => {
      const res = await getMessages(id, { direction: 'initial', pageSize: 100 })
      if (res.success) {
        // steerNotices:live 由 onSteer 累积(下方 onSteer 回调),历史由
        // metadata.steerApplied 读回(api 侧已随回调落库,与 SSE 帧同源)
        const loaded: ChatMessageWithSteer[] = res.data.messages.map((m, idx) => {
          // G-166:服务端已把引用/注入交代随回调落库(metadata),此前本屏只读
          // id/role/content/reasoning → 重进历史会话时交代区整段消失。逐条类型守卫:
          // 脏条目单条丢弃,缺 url 不造"点不动的假链接"。
          const meta = m.metadata as {
            citations?: unknown
            injections?: unknown
            steerApplied?: unknown
          } | null
          const citations = Array.isArray(meta?.citations)
            ? (meta?.citations as Array<Record<string, unknown>>).flatMap((c) =>
                typeof c?.source === 'string' && typeof c.label === 'string'
                  ? [
                      {
                        source: c.source,
                        label: c.label,
                        ...(typeof c.url === 'string' && c.url ? { url: c.url } : {}),
                      },
                    ]
                  : [],
              )
            : undefined
          const injections = Array.isArray(meta?.injections)
            ? (meta?.injections as Array<Record<string, unknown>>).flatMap((x) =>
                typeof x?.kind === 'string' && typeof x.collapsed === 'string'
                  ? [
                      {
                        kind: x.kind,
                        collapsed: x.collapsed,
                        ...(typeof x.fullText === 'string' ? { fullText: x.fullText } : {}),
                        ...(typeof x.count === 'number' ? { count: x.count } : {}),
                      },
                    ]
                  : [],
              )
            : undefined
          // D106 收尾:steer 交代历史读回 —— 守卫(text 非空字符串、timestamp 仅
          // string、8 条封顶)收敛在纯函数里,无 steer / 全坏 → undefined 不写字段
          const steerNotices = readSteerAppliedFromMetadata(meta?.steerApplied)
          return {
            id: `${m.id}-${idx}`,
            role: m.role,
            content: m.content,
            // 历史消息思考过程透传(chat_messages.reasoning,供思考过程展开块渲染)
            reasoning: m.reasoning,
            ...(citations && citations.length > 0 ? { citations } : {}),
            ...(injections && injections.length > 0 ? { injections } : {}),
            ...(steerNotices && steerNotices.length > 0 ? { steerNotices } : {}),
          }
        })
        setMessages(loaded)
        setPrompt('')
        setMaterialCards([])
        // D135:切会话,执行帧快照整体清。历史回放缺口被点名,而不是被读成"已还原":
        // 历史消息 metadata 里的 toolCalls/planSteps 落库读回(映射)目前是 N8n 屏私有实现,
        // 本屏 executionVizById 只覆盖流式帧 —— 重进历史会话看不到执行卡,是已知缺口不是已接。
        setExecutionVizById({})
        // 记录当前对话 DB id(供收藏 batchOperateConversations 使用)
        setConversationId(id)
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

  /**
   * D28 补齐层(2026-10-03):导入页「用场景分析」跳进来时带 autoSendPrompt,
   * 历史加载完成后把它作为本会话的下一条用户消息自动发出。
   *
   * 为什么必须等 conversationId 就位:分析指令要落在**这个导入会话**里,
   * 而 send() 用的是渲染闭包里的 messages —— 历史未回填就发,本轮上下文里没有导入记录,
   * 分析就退化成"凭空分析"(提示词里那句"以上是本次导入的会话记录全文"会指向不存在的上文)。
   * 本屏 loadConversationMessages 成功后才置 conversationId,故以其为"历史已就位"信号。
   *
   * 经 sendRef 调 send(与 retryLastTurn 同一约定):send 未包 useCallback、每轮重建,
   * 直接把它列进本 effect 依赖会让 effect 每轮重跑、依赖数组每轮换引用。
   * autoSendDoneRef 保证"这段提示只发一次"(StrictMode 双跑 / params 换引用都不会重发)。
   */
  const autoSendDoneRef = useRef(false)
  useEffect(() => {
    const promptText = route.params?.autoSendPrompt
    if (!promptText || autoSendDoneRef.current) return
    if (!conversationId || isStreaming) return
    autoSendDoneRef.current = true
    void sendRef.current(promptText)
  }, [route.params?.autoSendPrompt, conversationId, isStreaming])

  // ── 手动压缩上下文(2026-09-02 立,对齐 web 端 message-input.tsx compactButton):
  // POST /api/chat/compact → compressed=true → 成功 toast + getMessages 刷新消息列表
  //   (压缩摘要已替换旧消息,本地列表需同步;仅刷新消息,不重置输入框/素材卡);
  // reason=too_few_messages / incompressible → info 提示;404/其他错误 → error 提示。
  // 仅已关联后端会话(conversationId 非空,即历史对话载入)时可用;流式中/压缩中禁止触发。
  const handleCompactContext = useCallback(async (): Promise<void> => {
    if (compacting || isStreaming) return
    if (!conversationId) {
      showToast('info', t('messageInput.compactNoSession'))
      return
    }
    setCompacting(true)
    try {
      const res = await compactConversation(conversationId)
      if (res.success && res.data) {
        if (res.data.compressed) {
          showToast(
            'success',
            t('messageInput.compactSuccess', {
              before: res.data.originalTokens,
              after: res.data.compressedTokens,
              saved: Math.max(0, res.data.originalTokens - res.data.compressedTokens),
            }),
          )
          const msgRes = await getMessages(conversationId, { direction: 'initial', pageSize: 100 })
          if (msgRes.success) {
            setMessages(
              msgRes.data.messages.map((m, idx) => ({
                id: `${m.id}-${idx}`,
                role: m.role,
                content: m.content,
                reasoning: m.reasoning,
              })),
            )
            requestAnimationFrame(() => {
              listRef.current?.scrollToEnd({ animated: true })
            })
          }
        } else if (res.data.reason === 'too_few_messages') {
          showToast('info', t('messageInput.compactTooFew'))
        } else {
          showToast('info', t('messageInput.compactIncompressible'))
        }
      } else {
        showToast('error', t('messageInput.compactFailed'))
      }
    } catch {
      showToast('error', t('messageInput.compactFailed'))
    } finally {
      setCompacting(false)
    }
  }, [compacting, isStreaming, conversationId, showToast, t])

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

  // ── 模型选择器条目(由 models 派生) ──
  // category / modelTier 原样透传给 ModelPickerList:默认只展示 latest + 对话/视觉类,
  // 其余(历史版本 + embedding/rerank/TTS/ASR/图像等非对话模型)收进「历史模型」折叠区。
  // 字段缺失(老后端/降级 FALLBACK_MODELS)时由共享层兜底为 latest+chat,不会误藏模型。
  const modelPickerItems: ModelListItem[] = useMemo(
    () =>
      models.map((m) => ({
        id: m.id,
        name: m.name,
        description: m.provider ?? '',
        icon: Bot,
        isFree: !m.input_price,
        category: m.category,
        modelTier: m.model_tier,
      })),
    [models],
  )

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

  // 任务进度状态条数据源(对齐 web / N8n 那条口径):plan_updated 权威快照写在
  // "那一条 assistant 消息"上,取最后一条带 planSteps 的 assistant 消息(倒序扫描)。
  const planViz = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i]
      if (m?.role !== 'assistant') continue
      const viz = executionVizById[m.id]
      if ((viz?.planSteps?.length ?? 0) > 0) return viz
    }
    return undefined
  }, [messages, executionVizById])

  // ── 共享组件数据准备 ──
  const sharedModels: ChatScreenModel[] = models.map(toChatScreenModel)
  const sharedMessages: ChatScreenMessageWithReasoning[] = messages
    .filter((m) => m.role !== 'system')
    .map(toChatScreenMessage)

  return (
    <View style={styles.root}>
      {/* 推送通知弹窗由 RootNavigator 全局挂载(见该处 <NotificationPanel />);
          此处曾另挂一份,两者读同一个 store 的 visible,打开通知会叠出两个相同面板。 */}

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
          colorScheme={resolvedTheme}
        />
        {/* D135:任务进度状态条(plan/tool 执行帧折叠结果的可读出口,对齐 web / N8n 位置:输入区上方) */}
        <TaskStatusBar
          planSteps={planViz?.planSteps ?? []}
          toolCalls={planViz?.toolCalls}
          isStreaming={isStreaming}
        />
        {/*
          D154(2026-10-01 收口渲染面):MCP 连接状态行,位置与小程序端一致(输入条上方)。
          数据源是共享层那一份 `mcpStatusLedger`(帧进表由 ../lib/user-broadcast 的唯一接线负责,
          本端渲染侧只读表 ⇒ 无第二条连接)。票面要求「至少显示状态行 + 桌面端管理提示」:
          FloatBox toast 会过期,这一行不会。空表 ⇒ 组件返回 null、零占位。
        */}
        <McpStatusStrip />
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
          // 附件按钮 → 真实 DocumentPicker + uploadFileMultipart(原占位 Alert 已移除)
          onAddFile={() => void handleFileUpload()}
          onIconClick={handleIconClick}
          onFangda={handleFangda}
          onCompactContext={() => void handleCompactContext()}
          compactContextLoading={compacting}
          onTextareaHeightChange={textareaHeightChange}
          onStartLongPress={handleStartLongPress}
          onEndLongPress={handleEndLongPress}
          onInputClick={handleInputClick}
          onStartVoiceAnimation={handleStartVoiceAnimation}
          onStopVoiceAnimation={handleStopVoiceAnimation}
          onKeyboardShow={handleKeyboardShow}
          onKeyboardHide={handleKeyboardHide}
          onModelConfigChange={handleModelConfigChange}
          superAgentEnabled={superAgentEnabled}
          mcpEnabled={mcpEnabled}
          knowledgeBaseEnabled={knowledgeBaseEnabled}
          permanentMemoryEnabled={permanentMemoryEnabled}
          voiceInputEnabled={isVoiceMode}
          images={inputFiles.filter((f) => f.type === 'image').map((f) => f.url)}
          isLoading={isStreaming}
          onPlusToggle={handlePlusToggle}
          plusActive={inputPanelVisible}
          isShowIcon={inputPanelVisible}
        />
      </KeyboardAvoidingView>

      {/* D136(承 V4 #94/D84):审批面板(RN Modal,置顶)+ 常驻待审批胶囊。
          关闭/被拒后胶囊仍在,人工放行入口不随面板消失(AGENTS §30)。 */}
      {toolApproval.host}

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
            <Share2 size={48} color={tokens.brandAccent.deep} />
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
                  // 守门 131 改型:marginHorizontal 槽位留外层,可视盒(ttsOptionBtn)+pressed
                  // 淡出落内层数组形态(ttsOptionBtn 的边距已搬到 slot 档,数值原样)。
                  <Pressable
                    key={opt}
                    onPress={() => handleTtsSelect(opt)}
                    style={styles.ttsOptionBtnSlot}
                    accessibilityRole="button"
                    accessibilityLabel={opt}
                  >
                    {({ pressed }) => (
                      <View style={[styles.ttsOptionBtn, pressed && styles.panelItemPressed]}>
                        <Text style={styles.ttsOptionText}>{opt}</Text>
                      </View>
                    )}
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

      {/* P1.5 文件上传 Modal(expo-document-picker 已装,DocumentPicker + uploadFileMultipart 真实上传) */}
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
          <Pressable
            style={[
              styles.listDialogContent,
              { height: modelPickerHeight, maxHeight: modelPickerHeight },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.listDialogHeader}>
              <Text style={styles.listDialogTitle}>{t('chat.selectModel')}</Text>
              <Pressable
                hitSlop={8}
                onPress={() => setModelListVisible(false)}
                style={styles.listDialogClose}
              >
                <X size={20} color={tokens.text.primary} />
              </Pressable>
            </View>
            <ModelPickerList
              items={modelPickerItems}
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
          // 守门 131 改型:panelItem 无边距、有定高 ⇒ 外层不设 style(父列默认拉伸+内容定高,
          // 命中盒与原 Pressable 全等),可视行盒 + pressed 淡出落内层。
          <Pressable
            key={item.key}
            onPress={item.onPress}
            accessibilityRole="button"
            accessibilityLabel={item.label}
          >
            {({ pressed }) => (
              <View style={[styles.panelItem, pressed && styles.panelItemPressed]}>
                <item.Icon size={22} color={tokens.text.primary} />
                <Text style={styles.panelItemText}>{item.label}</Text>
              </View>
            )}
          </Pressable>
        ))}
        <Pressable
          onPress={closeFunctionPanel}
          style={styles.panelCancelBtnSlot}
          accessibilityRole="button"
          accessibilityLabel="取消"
        >
          {({ pressed }) => (
            <View style={[styles.panelCancelBtnFace, pressed && styles.panelItemPressed]}>
              <Text style={styles.panelCancelText}>取消</Text>
            </View>
          )}
        </Pressable>
      </BottomPops>

      {/* 来源面板(对齐 Uniapp source-handle 子组件,底部上滑 4 项知识来源) */}
      <BottomPops visible={sourcePanelVisible} onClose={closeSourcePanel} title="知识来源">
        {sourcePanelItems.map((item) => (
          // 守门 131 改型:同功能面板 —— 外层不设 style,可视行盒 + pressed 落内层。
          <Pressable
            key={item.key}
            onPress={item.onPress}
            accessibilityRole="button"
            accessibilityLabel={item.label}
          >
            {({ pressed }) => (
              <View style={[styles.panelItem, pressed && styles.panelItemPressed]}>
                <item.Icon size={22} color={tokens.text.primary} />
                <Text style={styles.panelItemText}>{item.label}</Text>
              </View>
            )}
          </Pressable>
        ))}
        <Pressable onPress={closeSourcePanel} accessibilityRole="button" accessibilityLabel="取消">
          {({ pressed }) => (
            <View style={[styles.panelItem, pressed && styles.panelItemPressed]}>
              <Text style={styles.panelCancelText}>取消</Text>
            </View>
          )}
        </Pressable>
      </BottomPops>

      {/* Drawer(H3 重建版,管理 visible 状态) */}
      <Drawer
        visible={drawerVisible}
        onClose={closeDrawer}
        user={drawerUser}
        conversations={drawerConversationsForRender}
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
            <X size={26} color={tokens.surface.light} />
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
/**
 * D153b:useSyncExternalStore 的两个口必须是**稳定引用**,所以提在模块级而不是每次渲染新建
 * (每次新建会让 React 判"快照不稳定"而反复重渲染)。
 */
const subscribeConversationMeta = (onStoreChange: () => void): (() => void) =>
  conversationMetaLedger.subscribe(onStoreChange)
const getConversationMetaVersion = (): number => conversationMetaLedger.version()

function mapConversationToDrawer(c: ConversationDetail): DrawerConversationItem {
  const tsStr = c.lastMessageAt ?? c.updatedAt ?? c.createdAt
  const createdAt = tsStr ? new Date(tsStr).getTime() : Date.now()
  const mdl = c.model ?? ''
  return {
    id: c.id,
    title: c.title?.trim() || '未命名对话',
    modelConfig: mdl ? { id: mdl, name: mdl, icon: undefined } : undefined,
    createdAt,
    favorited: c.favorite === true,
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
    borderRadius: rnRadius.sm,
    backgroundColor: tokens.surface.muted,
    marginBottom: rpx(8),
  },
  tishiBtnText: {
    fontSize: rpx(13),
    color: tokens.text.secondary,
  },
  tishiCardWrap: {
    borderRadius: rnRadius.md,
    overflow: 'hidden',
  },
  // ── 上下文自动压缩提示条(chatAlert.compaction.*) ──
  compactionBanner: {
    marginBottom: rpx(16),
    padding: rpx(12),
    borderRadius: rnRadius.sm,
    backgroundColor: tokens.surface.card,
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
  // ── D135 执行/交互帧最小可视态 ──
  execRows: {
    marginTop: rpx(8),
    gap: rpx(4),
  },
  execRowText: {
    fontSize: rpx(12),
    color: tokens.text.tertiary,
  },
  interactionCard: {
    marginBottom: rpx(16),
    padding: rpx(12),
    borderRadius: rnRadius.lg,
    backgroundColor: tokens.surface.card,
    gap: rpx(8),
  },
  interactionRow: {
    gap: rpx(4),
  },
  interactionTitle: {
    fontSize: rpx(13),
    fontWeight: '600',
    color: tokens.text.primary,
  },
  interactionMeta: {
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
    borderRadius: rnRadius['2xl'],
  },
  msgBubbleUser: {
    backgroundColor: tokens.brand.cta,
  },
  msgBubbleAi: {
    backgroundColor: tokens.surface.card,
  },
  // 失败轮错误卡片(与 web D22 / miniapp 同形态:警示头 + 正文 + 重试出口)
  msgErrorCard: {
    width: '100%',
    borderRadius: rnRadius.lg,
    borderWidth: 1,
    borderColor: tokens.danger.light,
    backgroundColor: tokens.error.bg,
    overflow: 'hidden',
  },
  msgErrorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: tokens.danger.light,
  },
  msgErrorTitle: {
    fontSize: 12,
    fontWeight: '500',
    color: tokens.error.text,
  },
  msgErrorBody: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    lineHeight: 21,
    color: tokens.error.text,
  },
  msgErrorRetry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginHorizontal: 8,
    marginBottom: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  msgErrorRetryText: {
    fontSize: 12,
    color: tokens.error.text,
  },
  msgText: {
    fontSize: 15,
    lineHeight: 20,
  },
  msgTextUser: {
    color: tokens.brand.ctaForeground,
  },
  msgTextAi: {
    color: tokens.text.primary,
  },
  // ── 消息富内容:图片(点击全屏预览) ──
  msgImageWrap: {
    marginVertical: 4,
    borderRadius: rnRadius.lg,
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
    borderRadius: rnRadius.lg,
    backgroundColor: tokens.gray[800],
    overflow: 'hidden',
  },
  codeBlockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: tokens.gray[700],
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
    color: tokens.gray['200'],
  },
  codeBlockContent: {
    padding: 10,
    fontSize: 12,
    lineHeight: 17,
    color: tokens.gray['200'],
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  // ── 消息富内容:思考过程(推理 reasoning,对齐 ai_index2 thinking-process) ──
  // 用浅灰/中性色区分代码块(深色底):思考过程是半成品,别和最终代码混淆
  thinkingBlock: {
    marginBottom: 6,
    borderRadius: rnRadius.lg,
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
    borderRadius: rnRadius['2xl'],
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ── 素材库弹窗(Modal 内部对话框样式,参考 listDialogContent) ──
  materialPopup: {
    width: '88%',
    maxHeight: '70%',
    backgroundColor: tokens.surface.card,
    borderRadius: rnRadius.lg,
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
    borderRadius: rnRadius.lg,
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
    borderRadius: rnRadius.sm,
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
    borderRadius: rnRadius.md,
    backgroundColor: tokens.surface.card,
  },
  imgsListClose: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: rnRadius.sm,
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
    borderRadius: rnRadius.sm,
    backgroundColor: tokens.surface.card,
    height: 30,
    minWidth: 100,
  },
  modelTypeBtnActive: {
    backgroundColor: tokens.surface.muted,
    borderWidth: 1,
    borderColor: tokens.brandAccent.deep,
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
    backgroundColor: tokens.surface.card,
    marginBottom: BOTTOM_BAR_TOTAL,
  },
  inputIconBtn: {
    width: 36,
    height: 36,
    borderRadius: rnRadius.sm,
    backgroundColor: tokens.surface.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputIconBtnActive: {
    backgroundColor: tokens.brand.cta,
  },
  input: {
    flex: 1,
    minHeight: 36,
    maxHeight: 100,
    paddingHorizontal: rpx(24),
    paddingVertical: rpx(16),
    borderRadius: rnRadius.sm,
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
    backgroundColor: tokens.surface.card,
    borderRadius: rnRadius.xl,
    padding: rpx(40),
    alignItems: 'center',
  },
  qrCodeClose: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 30,
    height: 30,
    borderRadius: rnRadius.lg,
    borderWidth: 1,
    borderColor: tokens.gray.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrCodePlaceholder: {
    width: 280,
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.surface.muted,
    borderRadius: rnRadius.lg,
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
    backgroundColor: tokens.surface.card,
    borderRadius: rnRadius.xl,
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
    borderRadius: rnRadius.sm,
    backgroundColor: tokens.brand.cta,
  },
  shareBtnText: {
    fontSize: 14,
    color: tokens.brand.ctaForeground,
    fontWeight: '500',
  },
  shareBtnSecondary: {
    marginTop: rpx(16),
  },
  // ── 列表弹窗(ModelList / AgentList 共用容器) ──
  listDialogContent: {
    width: '88%',
    maxHeight: '70%',
    backgroundColor: tokens.surface.card,
    borderRadius: rnRadius.xl,
    overflow: 'hidden',
  },
  listDialogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: rpx(32),
    paddingVertical: rpx(24),
    backgroundColor: tokens.surface.card,
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
    borderRadius: rnRadius.sm,
    backgroundColor: tokens.brand.cta,
  },
  detailDialogRetryText: {
    fontSize: 13,
    color: tokens.brand.ctaForeground,
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
    borderRadius: rnRadius.sm,
    backgroundColor: tokens.surface.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 守门 131 改型专用:功能面板取消钮拆「外槽位 + 内可视盒」。panelCancelBtn 另有静态消费点
  // (TTS 弹窗取消钮 [panelCancelBtn, ttsCancelBtn]),原档一字不动;这两档取同值常量。
  panelCancelBtnSlot: {
    marginHorizontal: rpx(32),
    marginTop: rpx(16),
    height: 48,
  },
  panelCancelBtnFace: {
    width: '100%',
    height: '100%',
    borderRadius: rnRadius.lg,
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
    backgroundColor: tokens.brand.cta,
    borderRadius: rnRadius.sm,
    paddingVertical: rpx(24),
    alignItems: 'center',
  },
  fangdaSendBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: tokens.brand.ctaForeground,
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
  // 守门 131 改型:ttsOptionBtn 的 marginHorizontal 搬到外层槽位档,可视盒原样留内层。
  ttsOptionBtnSlot: {
    marginHorizontal: rpx(32),
  },
  ttsOptionBtn: {
    paddingHorizontal: rpx(32),
    paddingVertical: rpx(28),
    backgroundColor: tokens.surface.muted,
    borderRadius: rnRadius.sm,
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
    borderRadius: rnRadius.lg,
    backgroundColor: tokens.surface.muted,
    fontSize: 14,
    color: tokens.text.primary,
  },
  urlInputConfirmBtn: {
    backgroundColor: tokens.brand.cta,
    borderRadius: rnRadius.sm,
    paddingVertical: rpx(24),
    alignItems: 'center',
  },
  urlInputConfirmText: {
    fontSize: 15,
    fontWeight: '500',
    color: tokens.brand.ctaForeground,
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
    borderRadius: rnRadius.md,
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
    backgroundColor: tokens.brand.cta,
    borderRadius: rnRadius.sm,
    paddingVertical: rpx(24),
    alignItems: 'center',
    marginTop: rpx(8),
  },
  fileUploadConfirmText: {
    fontSize: 15,
    fontWeight: '500',
    color: tokens.brand.ctaForeground,
  },
})

export default ChatScreen
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
