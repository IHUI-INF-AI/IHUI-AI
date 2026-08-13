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
import { useEffect, useRef, useState } from 'react'
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
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import {
  Bot,
  Clapperboard,
  Cpu,
  Image as ImageIcon,
  Library,
  type LucideIcon,
  Menu,
  MessageCircle,
  Mic,
  Music,
  QrCode,
  Share2,
  Sparkles,
  Video,
  X,
} from 'lucide-react-native'
import {
  fetchModels,
  formatSSEError,
  getModelContextCapacity,
  streamChat,
  type LlmModel,
} from '@ihui/api-client'
import { FALLBACK_MODELS as SHARED_FALLBACK_MODELS } from '@ihui/shared'
import type { ChatMessage } from '@ihui/shared'
import type { ModelConfigType } from '@ihui/ui-native'
import { NavBar } from '../components/NavBar'
import { BottomActionBar, type BottomActionBarAction } from '../components/BottomActionBar'
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
import {
  ToggleButtonGroup,
  type ToggleButtonItem,
} from '../components/ToggleButtonGroup'
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

// DrawerTab 中 home/ai/mine 是 Tab 路由(走 Tabs navigator);
// square/share 是 RootStack 路由(直接 navigate,见 handleDrawerNavigate)。

// ── ChatScreen 组件 ──

export function ChatScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Chat'>) {
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

  const abortRef = useRef<AbortController | null>(null)
  const idCounter = useRef(0)
  const listRef = useRef<FlatList<ChatMessage> | null>(null)
  const materialCardIdCounter = useRef(0)
  const nextId = (): string => `msg-${++idCounter.current}`
  const nextMaterialCardId = (): string => `card-${++materialCardIdCounter.current}`

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

  // ── 发送消息(send-message 事件) ──
  const send = async (): Promise<void> => {
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
    const text = prompt.trim()
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
          Alert.alert(formatted.title, formatted.message)
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

  /** function-handle:打开功能面板(占位,真实功能面板是后续任务) */
  const handleFunctionHandle = (): void => {
    setFunctionPanelVisible(true)
  }

  /** source-handle:打开来源面板(占位) */
  const handleSourceHandle = (): void => {
    setSourcePanelVisible(true)
  }

  /**
   * icon-click:图标按钮点击(相机/相册/文件)。
   * 注:BottomActionBar onIconClick 签名为 () => void,组件未传 type 参数;
   * 三个图标按钮(相机/相册/文件)共用同一回调,无法区分具体点击的图标。
   * TODO: 待 BottomActionBar 支持 type 参数后,按 type 分发:
   *   type='camera' → expo-image-picker launchCameraAsync(依赖已安装)
   *   type='album' → expo-image-picker launchImageLibraryAsync(依赖已安装)
   *   type='file' → expo-document-picker getDocumentAsync(依赖未安装)
   */
  const handleIconClick = (): void => {
    Alert.alert('提示', '图片/文件选择功能开发中')
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
  const handleLongPressQrCode = (): void => {
    // TODO: 对接 expo-media-library 保存二维码到相册(需相机相册权限),当前仅提示
    Alert.alert('提示', '长按二维码图片可保存到相册')
  }

  // ── 分享领智汇值弹窗(对齐 Uniapp showSharePointsPopup) ──
  const showSharePoints = (): void => setShareValueVisible(true)
  const hideSharePoints = (): void => setShareValueVisible(false)
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
    // 一人公司:跳 Distribution 路由(已在 RootNavigator 注册)
    navigation.navigate('Distribution')
  }
  const handleDrawerClaimFree = (): void => {
    // 复制飞书免费资料链接到剪贴板 + Alert 提示
    const feishuUrl = 'https://ihui.feishu.cn/wiki/'
    Clipboard.setString(feishuUrl)
    Alert.alert('领取免费资料', '链接已复制到剪贴板,可在浏览器粘贴打开')
  }
  const handleDrawerCreateNewChat = (): void => {
    setMessages([])
    setPrompt('')
    setMaterialCards([])
  }
  const handleDrawerSelectConversation = (_id: string): void => {
    // TODO: Chat 路由当前 params 为 undefined,需 RootNavigator 增加 chatId 参数后对接
    Alert.alert('提示', '历史对话加载功能开发中')
  }
  const handleDrawerDeleteConversation = (_id: string): void => {
    // TODO: 对接 removeModelChat API 真实删除对话(需后端接口),成功后刷新 conversations 列表
    Alert.alert('删除对话', '确认删除此对话?', [
      { text: '取消', style: 'cancel' },
      {
        text: '确认',
        style: 'destructive',
        onPress: () => {
          // TODO: 调用 removeModelChat(_id) 删除后端对话,刷新 conversations 列表
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

  // ── ToggleButtonGroup items(对齐 Uniapp ToggleButtonGroup 多开关按钮组) ──
  const toggleItems: ToggleButtonItem[] = [
    { key: 'super-agent', label: '智能体', icon: '🤖', enabled: superAgentEnabled },
    { key: 'mcp', label: 'MCP', icon: '🔌', enabled: mcpEnabled },
    { key: 'knowledge-base', label: '知识库', icon: '📚', enabled: knowledgeBaseEnabled },
    { key: 'permanent-memory', label: '记忆', icon: '🧠', enabled: permanentMemoryEnabled },
  ]
  const handleToggle = (key: string): void => {
    switch (key) {
      case 'super-agent':
        toggleSuperAgent()
        break
      case 'mcp':
        toggleMCP()
        break
      case 'knowledge-base':
        toggleKnowledgeBase()
        break
      case 'permanent-memory':
        togglePermanentMemory()
        break
      default:
        break
    }
  }

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

  // ── AgentList items(占位 mock,后续对接 getAgents API) ──
  const agentListItems: AgentListItem[] = []

  // ── AgentList 选中回调 ──
  const handleAgentSelect = (id: string): void => {
    setAgentListVisible(false)
    // 跳 Agent 详情页(AgentDetail 路由接受 { id: string },已在 RootNavigator 注册)
    // 注:AiAssistant 路由 params 为 undefined 无法传 code,故用 AgentDetail 承载 agent.id
    navigation.navigate('AgentDetail', { id })
  }

  // ── BottomActionBar actions(模型列表 + 模型配置 + 发送,对齐 Uniapp show-model-list / showModelConfig / send-message) ──
  const bottomActions: ReadonlyArray<BottomActionBarAction> = [
    {
      key: 'model',
      label: models.find((m) => m.id === model)?.name ?? '选择模型',
      onPress: showModelList,
    },
    {
      key: 'config',
      icon: '⚙️',
      onPress: showModelConfig,
    },
    {
      key: 'send',
      label: isStreaming ? '停止' : '发送',
      primary: true,
      onPress: isStreaming ? stop : send,
      loading: isStreaming,
    },
  ]

  return (
    <View style={styles.root}>
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
            {/* 分享按钮:显示分享领智汇值弹窗(对齐 Uniapp showSharePointsPopup) */}
            <Pressable
              hitSlop={8}
              onPress={showSharePoints}
              accessibilityLabel="分享领智汇值"
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

        {/* 素材库弹窗(sck 点击,对齐 Uniapp showMaterialList + MaterialList 组件) */}
        {showMaterialList ? (
          <View style={styles.materialPopup}>
            <View style={styles.materialPopupHeader}>
              <Text style={styles.materialPopupTitle}>我的创作</Text>
              <Pressable hitSlop={8} onPress={() => { setShowMaterialList(false); setCurrentModelType('') }}>
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
          </View>
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
                <Icon size={16} color={active ? tokens.brand.DEFAULT : tokens.text.secondary} />
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

        {/* 功能开关组(对齐 Uniapp ToggleButtonGroup,使用 ToggleButtonGroup 组件) */}
        <View style={styles.toggleGroupWrap}>
          <ToggleButtonGroup items={toggleItems} onToggle={handleToggle} />
        </View>

        {/* 输入框区域(对齐 Uniapp InputArea:update:prompt / toggle-voice-input / remove-image) */}
        <View style={styles.inputRow}>
          <Pressable
            hitSlop={8}
            onPress={toggleVoiceInput}
            style={[styles.inputIconBtn, isVoiceMode ? styles.inputIconBtnActive : null]}
            accessibilityLabel="语音输入"
          >
            <Mic size={20} color={isVoiceMode ? tokens.surface.light : tokens.text.secondary} />
          </Pressable>
          <TextInput
            style={styles.input}
            value={prompt}
            onChangeText={updatePrompt}
            placeholder="请输入描述"
            placeholderTextColor={tokens.text.tertiary}
            multiline
            maxLength={2000}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            onContentSizeChange={textareaHeightChange}
          />
          <Pressable
            hitSlop={8}
            onPress={onInputAddImage}
            style={styles.inputIconBtn}
            accessibilityLabel="添加图片"
          >
            <ImageIcon size={20} color={tokens.text.secondary} />
          </Pressable>
        </View>

        {/* BottomActionBar(发送 + 模型,承载 send-message / show-model-list) */}
        <BottomActionBar
          actions={bottomActions}
          onToggleSuperAgentfu={toggleSuperAgentfu}
          onFunctionHandle={handleFunctionHandle}
          onSourceHandle={handleSourceHandle}
          onIconClick={handleIconClick}
          onFangda={handleFangda}
        />
      </KeyboardAvoidingView>

      {/* 二维码弹窗(对齐 Uniapp qr-code-modal) */}
      <Modal visible={qrCodeVisible} transparent animationType="fade" onRequestClose={hideQrCode}>
        <Pressable style={styles.modalMask} onPress={hideQrCode}>
          <Pressable style={styles.qrCodeContent} onPress={(e) => e.stopPropagation()}>
            <Pressable hitSlop={8} onPress={hideQrCode} style={styles.qrCodeClose}>
              <X size={20} color={tokens.text.primary} />
            </Pressable>
            <View style={styles.qrCodePlaceholder}>
              <QrCode size={240} color={tokens.text.primary} />
            </View>
            <Text style={styles.qrCodeTitle}>扫描二维码加入社区</Text>
            <Pressable onPress={handleLongPressQrCode} style={styles.qrCodeHint}>
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

      {/* 功能面板弹窗(占位,后续任务对接真实功能面板) */}
      <Modal visible={functionPanelVisible} transparent animationType="fade" onRequestClose={() => setFunctionPanelVisible(false)}>
        <Pressable style={styles.modalMask} onPress={() => setFunctionPanelVisible(false)}>
          <Pressable style={styles.simplePanelContent} onPress={(e) => e.stopPropagation()}>
            <Pressable hitSlop={8} onPress={() => setFunctionPanelVisible(false)} style={styles.simplePanelClose}>
              <X size={20} color={tokens.text.primary} />
            </Pressable>
            <Text style={styles.simplePanelText}>功能面板(开发中)</Text>
          </Pressable>
        </Pressable>
      </Modal>

      {/* 来源面板弹窗(占位,后续任务对接真实来源面板) */}
      <Modal visible={sourcePanelVisible} transparent animationType="fade" onRequestClose={() => setSourcePanelVisible(false)}>
        <Pressable style={styles.modalMask} onPress={() => setSourcePanelVisible(false)}>
          <Pressable style={styles.simplePanelContent} onPress={(e) => e.stopPropagation()}>
            <Pressable hitSlop={8} onPress={() => setSourcePanelVisible(false)} style={styles.simplePanelClose}>
              <X size={20} color={tokens.text.primary} />
            </Pressable>
            <Text style={styles.simplePanelText}>来源面板(开发中)</Text>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Drawer(H3 重建版,管理 visible 状态) */}
      <Drawer
        visible={drawerVisible}
        onClose={closeDrawer}
        user={drawerUser}
        conversations={[] as DrawerConversationItem[]}
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
  // ── 素材库弹窗 ──
  materialPopup: {
    marginHorizontal: 12,
    marginBottom: 8,
    backgroundColor: tokens.surface.light,
    borderRadius: 8,
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
    height: 32,
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
    top: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrCodePlaceholder: {
    width: 256,
    height: 256,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.surface.muted,
    borderRadius: 8,
    marginBottom: 12,
  },
  qrCodeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: tokens.text.primary,
    marginBottom: 8,
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
  // ── 功能面板/来源面板占位弹窗 ──
  simplePanelContent: {
    width: 260,
    backgroundColor: tokens.surface.light,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  simplePanelClose: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  simplePanelText: {
    fontSize: 14,
    color: tokens.text.secondary,
  },
})

export default ChatScreen
