// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * AiAssistantN8nScreen AI 助手对话(mobile-rn 端,流式版)
 *
 * 对齐历史 Uniapp pages/tools/ai_assistant_n8n.vue 的对话核心:
 * - NavBar「AI 助手」+ 返回 + 菜单入口(打开 Drawer)
 *   (对齐 Uniapp page_title:路由 title/modelName 参数优先,缺省 i18n;
 *    对齐 Uniapp onLoad options.agentId / modelNamea)
 * - 消息列表:FlatList 渲染气泡(user 右 / assistant 左)
 * - 输入区:InputArea(共享组件)+ 发送/停止按钮(对齐 Uniapp BottomActionBar 输入部分)
 * - 流式输出:复用 streamChat(@ihui/api-client)SSE 端点 + agentId 绑定 N8n 工作流;
 *   onDelta 累积实时更新最后一条 assistant 消息(对齐 Uniapp onMessage 累积 data.content)
 * - 模型选择器:ModelList(共享组件)底部弹出,单选切换模型(对齐 Uniapp ModelList + pitchHandle);
 *   InputArea 上方 modelBar 展示当前模型名,点击展开选择器;
 *   路由参数 modelId 优先初始化选中模型(对齐 Uniapp onLoad options.modelNamea)
 * - 模型配置:ModelConfigDialog 弹层(温度/top_p/maxTokens/系统提示词等),
 *   入口在模型选择旁的"配置"按钮(对齐 Uniapp InputArea showModelaConfig 习惯),
 *   参数在发送时透传 streamChat(temperature/topP/maxTokens/systemPrompt)
 * - 快捷操作:无消息时输入区上方横向 suggestedQuestions chip,点击直接发送
 *   (对齐 Uniapp ai_assistant_n8n quick-actions-container + handleQuickActionClick)
 * - 图片预览:assistant 回复中提取图片 URL(对齐 Uniapp processContent + imgUrlList),
 *   渲染缩略图,点击 ImagePreviewModal 全屏预览(对齐 Uniapp previewImage)
 * - 无 agentId → 不伪造回复:移除刚加入的消息 + FloatBox 提示选择智能体
 *   (对齐 Uniapp onLoad 无 agentId 不调 processN8nAgent,2026-08-21 注释修正:
 *   原注释"模拟响应"为过时描述,实际实现已是防伪造提示)
 * - Drawer 集成:历史对话入口(对齐任务要求"Drawer 集成:历史对话入口"),
 *   复用 @ihui/rn-app Drawer 组件 + listConversations/getMessages/deleteConversation API;
 *   NavBar 右侧菜单按钮打开 Drawer,Drawer 内选择历史对话 → 加载消息,
 *   创建新对话 → 清空当前消息(对齐 ChatScreen Drawer 集成模式)
 * - 路由参数:{ agentId?: string; title?: string; conversationId?: string; modelName?: string; modelId?: string }
 *   (对齐 Uniapp onLoad options: agentId / modelNamea / pitcha / type)
 *
 * 平台独占:仅 mobile-rn 端。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import IntelligentAssistant from '../components/IntelligentAssistant'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
  type ImageSourcePropType,
  type ListRenderItem,
} from 'react-native'
import Clipboard from '@react-native-clipboard/clipboard'
import * as FileSystem from 'expo-file-system'
import * as MediaLibrary from 'expo-media-library'
import { Bot, Brain, Copy, Download, Eye, EyeOff, Settings, Share2 } from 'lucide-react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { DRAWER_TAB_TO_RN_TAB, mainScreenForTab } from '../navigation/tab-utils'
import {
  deleteConversation,
  fetchModels,
  formatSSEError,
  getMessages,
  getTokenBalance,
  listConversations,
  streamChat,
  type ConversationDetail,
  type LlmModel,
} from '@ihui/api-client'
import { FALLBACK_MODELS } from '@ihui/shared'
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { NavBar } from '../components/NavBar'
import { InputArea } from '../components/InputArea'
import { VoiceInput } from '../components/VoiceInput'
import { ModelConfigDialog, type ModelConfig } from '../components/ModelConfigDialog'
import ModelPickerList, { type ModelListItem } from '../components/ModelPickerList'
import ImagePreviewModal from '../components/ImagePreviewModal'
import Drawer, {
  type DrawerConversationItem,
  type DrawerExtraMenu,
  type DrawerTab,
} from '../components/Drawer'
import Empty from '../components/common/Empty'
import { FloatBox, type FloatBoxType } from '../components/FloatBox'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { rpx } from '../utils/rpx'

type LocalParamList = RootStackParamList & {
  AiAssistantN8n: {
    agentId?: string
    title?: string
    conversationId?: string
    modelName?: string
    modelId?: string
  }
}
type N8nRouteProp = RouteProp<LocalParamList, 'AiAssistantN8n'>
type NavigationProp = NativeStackNavigationProp<LocalParamList>
type RootNav = NativeStackNavigationProp<RootStackParamList>

interface N8nMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  /** assistant 回复中提取的图片 URL 列表(对齐 Uniapp imgUrlList) */
  images?: string[]
  /** 对齐 Uniapp agent_content_list.total_tokens:回复消耗智汇值。
   *  RN 数据无此字段时保持 undefined,操作区不渲染消耗文案(降级,不伪造)。 */
  totalTokens?: number
  /** 对齐 Uniapp agent_content_list.isHaveSikao:回复是否含思考过程。
   *  仅 streamChat onReasoning 收到增量时置 true。 */
  isHaveSikao?: boolean
  /** 对齐 Uniapp agent_content_list.agent_content1:思考过程全文(流式累积)。 */
  thinkingContent?: string
  /** 对齐 Uniapp copyContent:复制按钮优先复制的内容,缺失时降级复制 content。 */
  copyContent?: string
}

/**
 * 快捷问题兜底(对齐 Uniapp ai_assistant_n8n.vue suggestedQuestionsList):
 * 无消息时输入区上方横向 chip,点击直接发送。RN Agent 契约暂无 suggestedQuestions
 * 字段,使用与 miniapp-taro ai.suggestions 一致的通用兜底文案。
 */
const QUICK_SUGGESTIONS: readonly string[] = [
  '帮我写一首诗',
  '解释量子力学',
  '写一段代码',
  '翻译这段话',
]

/** 免费资料飞书链接(Drawer 领取免费资料 → 复制到剪贴板,对齐 Uniapp lingqu → setClipboardData) */
const FREE_RESOURCE_URL =
  'https://aizhihuishe.feishu.cn/wiki/GPs7wff9PiDekQkKvBncryrmnIh?from=from_copylink'

// ── 图片 URL 提取(对齐 Uniapp processContent + isValidImageUrl)──

const IMAGE_EXT_RE = /\.(jpg|jpeg|png|gif|bmp|webp|svg)(\?.*)?$/i

function isValidImageUrl(url: string): boolean {
  if (!/^https?:\/\/.+/.test(url)) return false
  // noUncheckedIndexedAccess:数组下标访问需兜底
  const path = (url.split('#')[0] ?? '').split('?')[0] ?? ''
  return IMAGE_EXT_RE.test(path) || /volces\.com|fyshark\.com|tos-cn-beijing/i.test(url)
}

/** 从文本内容提取图片 URL(markdown ![](url) + 裸 URL,对齐 Uniapp processContent) */
function extractImageUrls(content: string): string[] {
  if (!content) return []
  const urls = new Set<string>()
  // 1. Markdown 图片:![alt](url)
  const mdRe = /!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/g
  let m: RegExpExecArray | null
  while ((m = mdRe.exec(content)) !== null) {
    const u = m[1]
    if (u && isValidImageUrl(u)) urls.add(u)
  }
  // 2. 裸 URL(带图片扩展名)
  const urlRe = /https?:\/\/[^\s)<>]+\.(?:jpg|jpeg|png|gif|bmp|webp|svg)(?:\?[^\s)]*)?/gi
  while ((m = urlRe.exec(content)) !== null) {
    const u = m[0]
    if (u && isValidImageUrl(u)) urls.add(u)
  }
  return Array.from(urls)
}

/** 消耗智汇值格式化(对齐 Uniapp total_tokens >= 1000 显示 K 值) */
function formatTotalTokens(totalTokens: number): string {
  return totalTokens >= 1000 ? `${(totalTokens / 1000).toFixed(1)}K` : String(totalTokens)
}

/** 从图片 URL 提取扩展名(保存相册时使用,对齐 Uniapp downloadImages 的本地文件命名) */
function imageExtFromUrl(url: string): string {
  const m = /\.(jpg|jpeg|png|gif|bmp|webp|svg)(?:\?|$)/i.exec(url)
  return m?.[1]?.toLowerCase() ?? 'jpg'
}

/** 把 API 返回的 ConversationDetail 映射为 DrawerConversationItem(对齐 ChatScreen) */
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

interface MessageBubbleProps {
  message: N8nMessage
  onPreviewImage: (url: string) => void
  /** 浮层提示(复用屏幕 showToast,对齐 Uniapp uni.showToast) */
  onToast: (type: FloatBoxType, message: string) => void
}

function MessageBubble({
  message,
  onPreviewImage,
  onToast,
}: MessageBubbleProps): React.JSX.Element {
  const isUser = message.role === 'user'
  const hasImages = !isUser && (message.images?.length ?? 0) > 0
  // 显示/隐藏回答(对齐 Uniapp answerVisibilityStates,默认可见)
  const [answerVisible, setAnswerVisible] = useState(true)
  // 思考过程展开/收起(对齐 Uniapp agent_con1)
  const [sikaoOpen, setSikaoOpen] = useState(false)
  // 图片下载中(防重复点击,对齐 Uniapp uni.showLoading)
  const [downloading, setDownloading] = useState(false)

  // 复制回答(对齐 Uniapp copyHandle:copyContent 优先,缺失降级 content)
  const handleCopy = (): void => {
    const text = message.copyContent ?? message.content
    if (!text) return
    try {
      Clipboard.setString(text)
      onToast('success', '复制成功')
    } catch {
      onToast('error', '复制失败')
    }
  }

  // 下载图片(对齐 Uniapp downloadImages:下载第一张图片保存到相册)
  const handleDownloadImages = async (): Promise<void> => {
    if (downloading) return
    const url = message.images?.[0]
    if (!url) return
    setDownloading(true)
    try {
      const perm = await MediaLibrary.requestPermissionsAsync()
      if (!perm.granted) {
        onToast('warning', '需要相册权限才能保存图片')
        return
      }
      const filename = `ai_image_${Date.now()}.${imageExtFromUrl(url)}`
      const destFile = new FileSystem.File(FileSystem.Paths.cache, filename)
      const downloaded = await FileSystem.File.downloadFileAsync(url, destFile, {
        idempotent: true,
      })
      await MediaLibrary.saveToLibraryAsync(downloaded.uri)
      onToast('success', '图片已保存到相册')
    } catch {
      onToast('error', '下载失败,请重试')
    } finally {
      setDownloading(false)
    }
  }

  // 分享回答(对齐 Uniapp share + onShareAppMessage,RN 用 Share API 分享 content)
  const handleShare = (): void => {
    if (!message.content) return
    void Share.share({ message: message.content }).catch(() => onToast('error', '分享失败'))
  }

  const hasTokens = message.totalTokens !== undefined
  const tokensText =
    message.totalTokens !== undefined ? formatTotalTokens(message.totalTokens) : undefined

  return (
    <View style={[bubbleStyles.row, isUser ? bubbleStyles.rowUser : bubbleStyles.rowAi]}>
      {isUser ? (
        <View style={[bubbleStyles.bubble, bubbleStyles.bubbleUser]}>
          {message.content ? (
            <Text style={[bubbleStyles.text, bubbleStyles.textUser]}>{message.content}</Text>
          ) : null}
        </View>
      ) : (
        <View style={bubbleStyles.msgCol}>
          <View style={[bubbleStyles.bubble, bubbleStyles.bubbleAi]}>
            {answerVisible && message.content ? (
              <Text style={[bubbleStyles.text, bubbleStyles.textAi]}>{message.content}</Text>
            ) : null}
            {answerVisible && hasImages ? (
              <View style={bubbleStyles.imageGrid}>
                {message.images!.map((url, i) => (
                  <TouchableOpacity
                    key={`${url}-${i}`}
                    activeOpacity={0.85}
                    onPress={() => onPreviewImage(url)}
                  >
                    <Image
                      source={{ uri: url }}
                      style={bubbleStyles.chatImage}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
          </View>
          {/* 思考过程展开区(仅 isHaveSikao 时显示按钮,展开后渲染思考内容) */}
          {sikaoOpen && message.thinkingContent ? (
            <View style={bubbleStyles.thinkingBox}>
              <Text style={bubbleStyles.thinkingText}>{message.thinkingContent}</Text>
            </View>
          ) : null}
          {/* 操作按钮行(对齐 Uniapp action-buttons:左消耗文案 + 右按钮组) */}
          <View style={[bubbleStyles.actionRow, hasTokens ? null : bubbleStyles.actionRowNoLabel]}>
            {answerVisible && tokensText ? (
              <Text style={bubbleStyles.tokensText} numberOfLines={1}>
                {'智汇AI生成 消耗智汇值:'}
                {tokensText}
              </Text>
            ) : null}
            <View style={bubbleStyles.actionBtns}>
              {/* 显示/隐藏回答(对齐 Uniapp toggleAnswerVisibility:可见时显示"隐藏"图标) */}
              <TouchableOpacity
                style={bubbleStyles.actionBtn}
                hitSlop={6}
                onPress={() => setAnswerVisible((v) => !v)}
                accessibilityRole="button"
                accessibilityLabel={answerVisible ? '隐藏回答' : '显示回答'}
              >
                {answerVisible ? (
                  <EyeOff size={16} color={tokens.text.secondary} />
                ) : (
                  <Eye size={16} color={tokens.text.secondary} />
                )}
              </TouchableOpacity>
              {/* 思考过程展开/收起(仅 isHaveSikao 时显示,对齐 Uniapp toggleAgentCon1) */}
              {message.isHaveSikao ? (
                <TouchableOpacity
                  style={bubbleStyles.actionBtn}
                  hitSlop={6}
                  onPress={() => setSikaoOpen((v) => !v)}
                  accessibilityRole="button"
                  accessibilityLabel="思考过程"
                >
                  <Brain
                    size={16}
                    color={sikaoOpen ? tokens.brand.DEFAULT : tokens.text.secondary}
                  />
                </TouchableOpacity>
              ) : null}
              {/* 复制回答(对齐 Uniapp copyHandle) */}
              <TouchableOpacity
                style={bubbleStyles.actionBtn}
                hitSlop={6}
                onPress={handleCopy}
                accessibilityRole="button"
                accessibilityLabel="复制回答"
              >
                <Copy size={16} color={tokens.text.secondary} />
              </TouchableOpacity>
              {/* 下载图片(仅消息含图片时显示,对齐 Uniapp downloadImages) */}
              {hasImages ? (
                <TouchableOpacity
                  style={bubbleStyles.actionBtn}
                  hitSlop={6}
                  onPress={() => void handleDownloadImages()}
                  disabled={downloading}
                  accessibilityRole="button"
                  accessibilityLabel="下载图片"
                >
                  <Download size={16} color={tokens.text.secondary} />
                </TouchableOpacity>
              ) : null}
              {/* 分享(对齐 Uniapp share,RN 用 Share API 分享 content) */}
              <TouchableOpacity
                style={bubbleStyles.actionBtn}
                hitSlop={6}
                onPress={handleShare}
                accessibilityRole="button"
                accessibilityLabel="分享"
              >
                <Share2 size={16} color={tokens.text.secondary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}

export default function AiAssistantN8nScreen() {
  const { t } = useI18n()
  const { user: authUser } = useAuth()
  const navigation = useNavigation<NavigationProp>()
  const rootNav = navigation.getParent<RootNav>()
  const route = useRoute<N8nRouteProp>()
  const agentId = route.params?.agentId
  // 路由 title 参数优先(对齐 Uniapp page_title:matchedAgent.agentName / modelNamea)
  const navTitle = route.params?.title ?? route.params?.modelName ?? t('aiAssistantN8n.title')
  const routeConversationId = route.params?.conversationId

  const listRef = useRef<FlatList<N8nMessage> | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const idCounter = useRef(0)
  const nextId = (): string => `n8n-${++idCounter.current}`

  const [messages, setMessages] = useState<N8nMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  // 当前对话 ID(从路由传入或后续选择历史对话时更新,用于 streamChat metadata)
  const [currentConversationId, setCurrentConversationId] = useState<string | undefined>(
    routeConversationId,
  )

  // 剩余智汇值(对齐 Uniapp 顶部 intelligent-assistant tokenQuantity,接 getTokenBalance 真实余额)
  const [tokenBalance, setTokenBalance] = useState(0)

  // 加载智汇值余额:失败静默保持 0(不阻塞页面,充值入口仍可用)
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await getTokenBalance()
        if (!cancelled && res.success) {
          setTokenBalance(res.data.balance)
        }
      } catch {
        // 失败保持 0
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // 模型选择器(对齐 Uniapp modelList + pitch + pitchHandle)
  // 路由参数 modelId 优先初始化(对齐 Uniapp onLoad options.modelNamea)
  const [selectedModelId, setSelectedModelId] = useState<string>(
    route.params?.modelId ?? FALLBACK_MODELS[0]?.value ?? 'stepfun/step-router-v1',
  )
  // 2026-08-27 修复:模型选择列表只展示后端 /llm/models 过滤后的可用模型
  // (可用性+配额由后端保证);null=加载中/失败 → 降级 FALLBACK_MODELS(真实可用主力)
  const [modelList, setModelList] = useState<LlmModel[] | null>(null)
  const [showModelPicker, setShowModelPicker] = useState(false)

  // 模型列表加载(后端 /llm/models 已按可用性+配额过滤,与 ChatScreen 同源)
  useEffect(() => {
    let cancelled = false
    fetchModels()
      .then((res) => {
        if (cancelled) return
        if (res?.models?.length) setModelList(res.models)
      })
      .catch(() => {
        // 静默:保持 null,展示 FALLBACK_MODELS 降级
      })
    return () => {
      cancelled = true
    }
  }, [])

  // 模型配置弹层(对齐 Uniapp ModelConfigDialog:模型选择旁"配置"入口,
  // 温度/top_p/maxTokens 等参数设置,发送时透传给 streamChat)
  const [modelConfigVisible, setModelConfigVisible] = useState(false)
  const [modelConfig, setModelConfig] = useState<ModelConfig>({
    temperature: 0.7,
    maxTokens: 2048,
    topP: 0.9,
    systemPrompt: '',
    streamEnabled: true,
  })

  // 图片预览(对齐 Uniapp previewImage)
  const [previewImage, setPreviewImage] = useState<string | null>(null)

  // FloatBox 浮层提示状态(替代单按钮 Alert.alert 的非阻塞反馈,对齐 ChatScreen showToast 模式)
  const [toastVisible, setToastVisible] = useState(false)
  const [toastType, setToastType] = useState<FloatBoxType>('info')
  const [toastMessage, setToastMessage] = useState('')
  const showToast = useCallback((type: FloatBoxType, message: string): void => {
    setToastType(type)
    setToastMessage(message)
    setToastVisible(true)
  }, [])
  const hideToast = useCallback((): void => setToastVisible(false), [])

  // Drawer 历史对话(对齐任务要求"Drawer 集成:历史对话入口")
  const [drawerVisible, setDrawerVisible] = useState(false)
  const [drawerConversations, setDrawerConversations] = useState<DrawerConversationItem[]>([])
  const [drawerConversationsLoaded, setDrawerConversationsLoaded] = useState(false)

  // 模型选择器条目:优先后端过滤模型(fetchModels),失败/加载中降级 FALLBACK_MODELS。
  // category / modelTier 原样透传给 ModelPickerList 做「默认列表 / 历史模型折叠区」分区;
  // 降级模型没有这两个字段,由共享层兜底为 latest+chat,保证降级态不会被藏起来。
  const modelListItems: ModelListItem[] = useMemo(() => {
    if (modelList && modelList.length > 0) {
      return modelList.map((m) => ({
        id: m.id,
        name: m.name || m.id,
        description: m.provider,
        icon: Bot,
        // 免费模型标记:zero_cost provider 前缀(与后端 free_provider_registry 对齐)
        isFree: /^@cf\/|^pollinations\/|^llm7\/|^aihorde\//.test(m.id),
        category: m.category,
        modelTier: m.model_tier,
      }))
    }
    return FALLBACK_MODELS.map((m) => ({
      id: m.value,
      name: m.label,
      description: m.vendor,
      icon: Bot,
      isFree: (m.pointsMultiplier ?? 1) === 0,
    }))
  }, [modelList])

  // RN 0.86 Fabric:内部列表需要确定高度才能滚动。0.55 是给 sheet 自身 maxHeight:'70%'
  // 留出头部高度的余量,避免列表被 overflow 裁掉。
  const { height: windowHeight } = useWindowDimensions()
  const modelPickerHeight = Math.round(windowHeight * 0.55)

  const selectedModelLabel = useMemo(() => {
    const m = modelListItems.find((item) => item.id === selectedModelId)
    return m?.name ?? selectedModelId
  }, [modelListItems, selectedModelId])

  const previewSource: ImageSourcePropType | null = previewImage ? { uri: previewImage } : null

  const scrollToEnd = (): void => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true })
    })
  }

  // ── Drawer 历史对话加载(懒加载,首次打开 Drawer 时拉取) ──
  const loadDrawerConversations = useCallback(async (): Promise<void> => {
    const res = await listConversations({ page: 1, pageSize: 50 })
    if (res.success) {
      setDrawerConversations(res.data.conversations.map(mapConversationToDrawer))
    } else {
      setDrawerConversations([])
    }
    setDrawerConversationsLoaded(true)
  }, [])

  useEffect(() => {
    if (drawerVisible && !drawerConversationsLoaded && authUser) {
      void loadDrawerConversations()
    }
  }, [drawerVisible, drawerConversationsLoaded, authUser, loadDrawerConversations])

  // ── 加载历史对话消息(对齐 ChatScreen loadConversationMessages) ──
  const loadConversationMessages = useCallback(async (id: string): Promise<void> => {
    const res = await getMessages(id, { page: 1, pageSize: 100 })
    if (res.success) {
      const loaded: N8nMessage[] = res.data.messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m, idx) => ({
          id: `${m.id}-${idx}`,
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }))
      setMessages(loaded)
      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd({ animated: true })
      })
    }
  }, [])

  // 从路由 conversationId 加载历史对话(对齐 Uniapp onLoad 有 agentId 时拉取历史)
  useEffect(() => {
    if (routeConversationId) {
      void loadConversationMessages(routeConversationId)
    }
  }, [routeConversationId, loadConversationMessages])

  const onSend = async (text: string): Promise<void> => {
    if (!text || sending) return
    setInput('')
    const userMsg: N8nMessage = { id: nextId(), role: 'user', content: text }
    const aiMsg: N8nMessage = { id: nextId(), role: 'assistant', content: '' }
    setMessages((prev) => [...prev, userMsg, aiMsg])
    setSending(true)
    scrollToEnd()

    // 没有绑定工作流时不能生成伪造回复,移除刚加入的消息并提示用户选择智能体。
    if (!agentId) {
      setMessages((prev) =>
        prev.filter((message) => message.id !== userMsg.id && message.id !== aiMsg.id),
      )
      setSending(false)
      showToast('warning', t('aiAssistantN8n.emptyNoAgent'))
      return
    }

    // 有 agentId:复用 streamChat SSE 流式(对齐 Uniapp connectSocket + onMessage 累积)
    const controller = new AbortController()
    abortRef.current = controller

    // 模型配置参数透传(对齐 Uniapp ModelConfigDialog 调节请求参数)
    const apiMessages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = []
    if (modelConfig.systemPrompt.trim()) {
      apiMessages.push({ role: 'system', content: modelConfig.systemPrompt.trim() })
    }
    apiMessages.push({ role: 'user', content: text })

    // 2026-09-04 吞错修复(Fix B):streamChat 未传 onError 时对流内 error 事件耗尽重试后会 throw(reject,
    // 见 client.ts catch 块)。本屏虽传了 onError,但请求构造/网络层在进入重试循环前抛出的异常仍会 reject,
    // 此前无 try/catch 会导致 unhandled rejection 且 sending 永远不复位。补 try/catch 把错误路由到
    // 本屏既有错误状态处理(sending 复位 + 空回复填充错误提示 + toast),对齐 ChatScreen 错误处理写法。
    try {
      await streamChat({
        model: selectedModelId,
        messages: apiMessages,
        agentId,
        signal: controller.signal,
        // 2026-08-16 修复:显式声明流式,避免后端/中间件对 request.stream 做严格字段检测时关闭 SSE。
        stream: true,
        temperature: modelConfig.temperature,
        topP: modelConfig.topP,
        maxTokens: modelConfig.maxTokens,
        metadata: currentConversationId ? { conversationId: currentConversationId } : undefined,
        onDelta: (delta) => {
          setMessages((prev) => {
            const next = [...prev]
            const last = next[next.length - 1]
            if (last && last.role === 'assistant') {
              next[next.length - 1] = { ...last, content: last.content + delta }
            }
            return next
          })
          scrollToEnd()
        },
        // 思考过程增量(对齐 Uniapp onMessage 累积 agent_content1 + isHaveSikao)
        onReasoning: (delta) => {
          setMessages((prev) => {
            const next = [...prev]
            const last = next[next.length - 1]
            if (last && last.role === 'assistant') {
              next[next.length - 1] = {
                ...last,
                isHaveSikao: true,
                thinkingContent: (last.thinkingContent ?? '') + delta,
              }
            }
            return next
          })
          scrollToEnd()
        },
        // 消耗智汇值(对齐 Uniapp total_tokens,SSE usage chunk 映射)
        onUsage: (usage) => {
          if (usage.totalTokens <= 0) return
          setMessages((prev) => {
            const next = [...prev]
            const last = next[next.length - 1]
            if (last && last.role === 'assistant') {
              next[next.length - 1] = { ...last, totalTokens: usage.totalTokens }
            }
            return next
          })
        },
        onError: (err) => {
          const formatted = formatSSEError(new Error(err))
          setSending(false)
          abortRef.current = null
          // 空回复时填充错误提示
          setMessages((prev) => {
            const next = [...prev]
            const last = next[next.length - 1]
            if (last && last.role === 'assistant' && !last.content) {
              next[next.length - 1] = { ...last, content: t('aiAssistantN8n.callFailed') }
            }
            return next
          })
          // 对齐 Uniapp uni.showToast + 任务要求 #2(error toast 用 FloatBox 替代 Alert.alert)
          const errMsg = formatted.message
            ? `${formatted.title}: ${formatted.message}`
            : formatted.title
          showToast('error', errMsg)
        },
        onDone: () => {
          setSending(false)
          abortRef.current = null
          // 流结束后提取回复中的图片 URL(对齐 Uniapp imgUrlList + processContent)
          setMessages((prev) => {
            const next = [...prev]
            const last = next[next.length - 1]
            if (last && last.role === 'assistant') {
              const imgs = extractImageUrls(last.content)
              if (imgs.length > 0) {
                next[next.length - 1] = { ...last, images: imgs }
              }
            }
            return next
          })
        },
      })
    } catch (err) {
      // 与上方 onError 同款错误状态处理(2026-09-04 吞错修复 Fix B 兜底)
      const formatted = formatSSEError(err)
      setSending(false)
      abortRef.current = null
      setMessages((prev) => {
        const next = [...prev]
        const last = next[next.length - 1]
        if (last && last.role === 'assistant' && !last.content) {
          next[next.length - 1] = { ...last, content: t('aiAssistantN8n.callFailed') }
        }
        return next
      })
      const errMsg = formatted.message
        ? `${formatted.title}: ${formatted.message}`
        : formatted.title
      showToast('error', errMsg)
    }
  }

  const onStop = (): void => {
    abortRef.current?.abort()
    abortRef.current = null
    setSending(false)
  }

  // 模型切换(对齐 Uniapp pitchHandle:index → modelName)
  const handleModelSelect = (ids: string[]): void => {
    const id = ids[0]
    if (id) {
      setSelectedModelId(id)
    }
    setShowModelPicker(false)
  }

  const handlePreviewImage = (url: string): void => {
    setPreviewImage(url)
  }

  // ── Drawer 回调(对齐 ChatScreen Drawer 集成模式) ──
  const closeDrawer = (): void => setDrawerVisible(false)
  const handleDrawerNavigate = (tab: DrawerTab): void => {
    if (tab === 'square') {
      navigation.navigate('Plaza')
      return
    }
    if (tab === 'share') {
      navigation.navigate('News')
      return
    }
    // DrawerTab('mine'等)必须先映射成 RN Tab 路由名('ProfileMain'),直接 cast 会静默跳转失败
    rootNav?.navigate('Main', { screen: mainScreenForTab(DRAWER_TAB_TO_RN_TAB[tab]) })
  }
  const handleDrawerNavigateCompany = (): void => {
    navigation.navigate('Distribution')
  }
  const handleDrawerClaimFree = (): void => {
    // 领取免费资料:复制飞书链接 + FloatBox 提示(对齐 Uniapp lingqu → setClipboardData)
    try {
      Clipboard.setString(FREE_RESOURCE_URL)
      showToast('success', '链接已复制,请在浏览器中打开')
    } catch {
      showToast('error', '复制失败,请重试')
    }
  }
  const handleDrawerCreateNewChat = (): void => {
    setMessages([])
    setInput('')
    setCurrentConversationId(undefined)
  }
  const handleDrawerSelectConversation = (id: string): void => {
    setDrawerVisible(false)
    setCurrentConversationId(id)
    void loadConversationMessages(id)
  }
  const handleDrawerDeleteConversation = (id: string): void => {
    Alert.alert('删除对话', '确认删除此对话?', [
      { text: '取消', style: 'cancel' },
      {
        text: '确认',
        style: 'destructive',
        onPress: () => {
          const snapshot = drawerConversations
          setDrawerConversations((prev) => prev.filter((c) => c.id !== id))
          void (async () => {
            const res = await deleteConversation(id)
            if (!res.success) {
              setDrawerConversations(snapshot)
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
      case 'assistant':
        navigation?.navigate('Assistant')

        break

      case 'tools':
        // 对齐 Uniapp tools/index(AI应用商店)由 HomeScreen 承载
        navigation.navigate('Home')
        break
      case 'company':
        navigation.navigate('Distribution')
        break
    }
  }

  // Drawer user 映射(AuthUser → Drawer user)
  const drawerUser = {
    avatar: authUser?.avatar,
    nickname: authUser?.nickname ?? authUser?.username ?? '未登录',
    level: (authUser?.isVip === 1 ? 'vip' : 'normal') as 'vip' | 'normal',
  }

  const renderItem: ListRenderItem<N8nMessage> = ({ item }) => (
    <MessageBubble message={item} onPreviewImage={handlePreviewImage} onToast={showToast} />
  )

  return (
    <View style={styles.root}>
      <NavBar
        title={navTitle}
        onBack={() => navigation.goBack()}
        rightActions={[{ icon: '≡', label: '', onPress: () => setDrawerVisible(true) }]}
      />
      {/* 智汇值卡(对齐 Uniapp ai_assistant_n8n.vue 顶部 intelligent-assistant:
          小方欢迎卡 + 剩余智汇值 + 充值;余额接 getTokenBalance,加载失败保持 0,充值入口可用) */}
      <View style={styles.valueCardWrap}>
        <IntelligentAssistant
          tokenQuantity={tokenBalance}
          onRecharge={() => navigation.navigate('AppTopup')}
        />
      </View>
      <KeyboardAvoidingView
        style={styles.body}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={scrollToEnd}
          onLayout={scrollToEnd}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Empty text={agentId ? t('aiAssistantN8n.empty') : t('aiAssistantN8n.emptyNoAgent')} />
          }
        />
        {/* 快捷操作区(对齐 Uniapp ai_assistant_n8n quick-actions-container:
            无消息时输入区上方横向 suggestedQuestions chip,点击直接发送) */}
        {messages.length === 0 && QUICK_SUGGESTIONS.length > 0 ? (
          <View style={styles.quickWrap}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.quickScrollContent}
            >
              {QUICK_SUGGESTIONS.map((question) => (
                <TouchableOpacity
                  key={question}
                  style={styles.quickChip}
                  activeOpacity={0.75}
                  onPress={() => void onSend(question)}
                  accessibilityRole="button"
                  accessibilityLabel={question}
                >
                  <Text style={styles.quickChipText} numberOfLines={1}>
                    {question}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        ) : null}
        {/* 模型选择条(对齐 Uniapp ModelList + modelName 展示,位于输入区上方;
            配置按钮在模型选择旁打开 ModelConfigDialog,对齐 Uniapp 入口习惯) */}
        <TouchableOpacity
          style={styles.modelBar}
          onPress={() => setShowModelPicker(true)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t('chat.selectModel')}
        >
          <Text style={styles.modelBarLabel} numberOfLines={1}>
            {t('chat.modelLabel')}: {selectedModelLabel}
          </Text>
          <TouchableOpacity
            style={styles.modelConfigBtn}
            onPress={() => setModelConfigVisible(true)}
            activeOpacity={0.7}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel={t('agent.config')}
          >
            <Settings size={12} color={tokens.text.secondary} />
            <Text style={styles.modelConfigBtnLabel}>{t('agent.config')}</Text>
          </TouchableOpacity>
          <Text style={styles.modelBarArrow}>{'›'}</Text>
        </TouchableOpacity>
        {/* VoiceInput 语音输入(对齐 Uniapp ai_assistant_n8n.vue 行 285/302 BottomActionBar
            :isVoiceInput + @toggle-voice-input:语音转文字回填输入框,随发送提交) */}
        <View style={styles.voiceInputWrap}>
          <VoiceInput
            placeholder="按住说出你的问题"
            onComplete={(text) => {
              if (text) setInput(text)
            }}
          />
        </View>
        <InputArea
          value={input}
          onChangeText={setInput}
          placeholder={t('aiAssistantN8n.placeholder')}
          maxLength={2000}
          onSubmit={(text) => void onSend(text)}
          disabled={sending}
          loading={sending}
          onStop={onStop}
          stopLabel={t('chat.stop')}
          sendLabel={t('aiAssistantN8n.send')}
        />
        {sending ? (
          <View style={styles.streamingBar}>
            <ActivityIndicator color={tokens.brand.DEFAULT} size="small" />
            <Text style={styles.streamingText}>{t('aiAssistantN8n.streaming')}</Text>
          </View>
        ) : null}
      </KeyboardAvoidingView>

      {/* 模型选择器底部弹层(对齐 Uniapp ModelList sourceIs 弹出) */}
      <Modal
        visible={showModelPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowModelPicker(false)}
      >
        <View style={pickerStyles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowModelPicker(false)} />
          <View style={pickerStyles.sheet}>
            <View style={pickerStyles.header}>
              <Text style={pickerStyles.title}>{t('chat.selectModel')}</Text>
              <TouchableOpacity
                onPress={() => setShowModelPicker(false)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="关闭"
              >
                <Text style={pickerStyles.close}>{'×'}</Text>
              </TouchableOpacity>
            </View>
            <View style={[pickerStyles.listWrap, { height: modelPickerHeight }]}>
              <ModelPickerList
                items={modelListItems}
                selectedIds={selectedModelId ? [selectedModelId] : []}
                onSelectChange={handleModelSelect}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* 图片全屏预览(对齐 Uniapp previewImage,使用共享 ImagePreviewModal) */}
      <ImagePreviewModal
        visible={previewImage !== null}
        source={previewSource}
        onClose={() => setPreviewImage(null)}
      />

      {/* 模型配置弹层(对齐 Uniapp ModelConfigDialog:温度/top_p/maxTokens 等
          参数设置,入口在模型选择旁,与 uniapp InputArea showModelaConfig 一致) */}
      <ModelConfigDialog
        visible={modelConfigVisible}
        modelType="text"
        config={modelConfig}
        onChange={setModelConfig}
        onClose={() => setModelConfigVisible(false)}
      />

      {/* Drawer 历史对话入口(对齐任务要求"Drawer 集成:历史对话入口") */}
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

      {/* FloatBox 浮层提示(对齐 Uniapp uni.showToast + 任务要求 #2) */}
      <FloatBox visible={toastVisible} type={toastType} message={toastMessage} onHide={hideToast} />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.surface.bg },
  valueCardWrap: { paddingHorizontal: rpx(16), marginTop: rpx(8) },
  body: { flex: 1 },
  listContent: { paddingHorizontal: rpx(32), paddingVertical: rpx(16), paddingBottom: rpx(32) },
  // 语音输入行(对齐 Uniapp ai_assistant_n8n.vue 输入区语音模式,置于 InputArea 上方)
  voiceInputWrap: {
    paddingHorizontal: rpx(24),
    paddingVertical: rpx(12),
    backgroundColor: tokens.surface.card,
  },
  // 模型选择条(对齐 Uniapp ModelList 位置:输入区上方)
  modelBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: rpx(24),
    paddingVertical: rpx(16),
    backgroundColor: tokens.surface.card,
    borderTopWidth: 1,
    borderTopColor: tokens.border.light,
  },
  modelBarLabel: {
    flex: 1,
    fontSize: 13,
    color: tokens.text.secondary,
  },
  // 模型配置按钮(模型选择旁,对齐 Uniapp InputArea 配置入口)
  modelConfigBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rpx(4),
    paddingHorizontal: rpx(16),
    paddingVertical: rpx(6),
    borderRadius: 6,
    backgroundColor: tokens.surface.muted,
  },
  modelConfigBtnText: {
    fontSize: 12,
    color: tokens.text.secondary,
  },
  modelConfigBtnLabel: {
    fontSize: 12,
    color: tokens.text.secondary,
  },
  modelBarArrow: {
    fontSize: 18,
    color: tokens.text.tertiary,
    marginLeft: rpx(16),
  },
  // 快捷操作区(对齐 Uniapp quick-actions-container)
  quickWrap: {
    backgroundColor: tokens.surface.bg,
    borderTopWidth: 1,
    borderTopColor: tokens.border.light,
  },
  quickScrollContent: {
    paddingHorizontal: rpx(24),
    paddingVertical: rpx(16),
    gap: rpx(16),
  },
  quickChip: {
    paddingHorizontal: rpx(24),
    paddingVertical: rpx(12),
    borderRadius: 16,
    backgroundColor: tokens.surface.card,
    borderWidth: 1,
    borderColor: tokens.border.light,
  },
  quickChipText: {
    fontSize: 12,
    color: tokens.text.secondary,
  },
  streamingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: rpx(12),
    paddingVertical: rpx(12),
    backgroundColor: tokens.surface.card,
  },
  streamingText: { fontSize: 12, color: tokens.text.tertiary },
})

const bubbleStyles = StyleSheet.create({
  row: { flexDirection: 'row', marginVertical: rpx(8) },
  rowUser: { justifyContent: 'flex-end' },
  rowAi: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: rpx(24),
    paddingVertical: rpx(16),
    borderRadius: 8,
  },
  bubbleUser: { backgroundColor: tokens.brand.DEFAULT },
  bubbleAi: { backgroundColor: tokens.surface.card },
  text: { fontSize: 14, lineHeight: 20 },
  textUser: { color: tokens.surface.light },
  textAi: { color: tokens.text.primary },
  // 回复内图片网格(对齐 Uniapp agent-content-item-img)
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: rpx(12),
    marginTop: rpx(16),
  },
  chatImage: {
    width: 120,
    height: 120,
    borderRadius: 6,
    backgroundColor: tokens.surface.muted,
  },
  // assistant 消息纵向容器:气泡 + 思考过程区 + 操作按钮行
  msgCol: {
    alignItems: 'flex-start',
  },
  // 思考过程展开区(对齐 Uniapp agent_content_con 思考内容展示)
  thinkingBox: {
    maxWidth: '78%',
    marginTop: rpx(8),
    paddingHorizontal: rpx(16),
    paddingVertical: rpx(12),
    borderRadius: 8,
    backgroundColor: tokens.surface.muted,
  },
  thinkingText: {
    fontSize: 12,
    lineHeight: 18,
    color: tokens.text.secondary,
  },
  // 操作按钮行(对齐 Uniapp action-buttons:左消耗文案 + 右按钮组)
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    maxWidth: '78%',
    marginTop: rpx(8),
  },
  // 无消耗文案时按钮组右对齐(对齐 Uniapp justify-content: flex-end)
  actionRowNoLabel: {
    justifyContent: 'flex-end',
  },
  tokensText: {
    flex: 1,
    marginRight: rpx(16),
    fontSize: 11,
    color: tokens.text.tertiary,
  },
  actionBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rpx(20),
  },
  actionBtn: {
    padding: rpx(4),
  },
})

const pickerStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: tokens.surface.light,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%',
    minHeight: '40%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: rpx(32),
    paddingVertical: rpx(24),
    borderBottomWidth: 1,
    borderBottomColor: tokens.border.light,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: tokens.text.primary,
  },
  close: {
    fontSize: 24,
    color: tokens.text.tertiary,
    lineHeight: 26,
  },
  // 高度由 useWindowDimensions 内联传入(modelPickerHeight),此处只保留布局语义
  listWrap: {
    width: '100%',
  },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
