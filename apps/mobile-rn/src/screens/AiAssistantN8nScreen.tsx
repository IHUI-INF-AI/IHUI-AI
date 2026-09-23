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
  Keyboard,
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
import * as ImagePicker from 'expo-image-picker'
import * as DocumentPicker from 'expo-document-picker'
import {
  AlertTriangle,
  Bot,
  Brain,
  Camera,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  Eye,
  EyeOff,
  Folder,
  Image as ImageIcon,
  MessageCircle,
  RefreshCw,
  Settings,
  Share2,
} from 'lucide-react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { navigateDrawerTab } from '../navigation/tab-utils'
import { AddPanel } from '../components/AddPanel'
import {
  deleteConversation,
  fetchModels,
  formatSSEError,
  getMessages,
  getTokenBalance,
  getWorkspacePermissionDefault,
  listConversations,
  resolveFileUrl,
  streamChat,
  uploadFileMultipart,
  type ConversationDetail,
  type LlmModel,
} from '@ihui/api-client'
import {
  FALLBACK_MODELS,
  humanizeToolText,
  describeToolCall,
  type ToolCallView,
} from '@ihui/shared'
import {
  applyStreamError,
  isErrorTurn,
  permissionTierWordKeys,
  resendTargetText,
} from '@ihui/shared/chat'
import { rnLightTokens as tokens, rnRadius } from '@ihui/design-tokens'
import { CitationList, InjectionDisclosure, SteerNoticeList } from '../components/ChatDisclosure'
import { NavBar } from '../components/NavBar'
import { InputArea } from '../components/InputArea'
import { TaskStatusBar } from '../components/ai/TaskStatusBar'
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
import { uiControlToolsFor } from '../lib/ui-control-tools'
import { rpx } from '../utils/rpx'
import { FREE_RESOURCE_URL } from '../constants/links'
import {
  applyPlanUpdate,
  applyTerminalEnd,
  applyInjectionFrame,
  appendCitationFrames,
  appendSteerFrames,
  applyTerminalStart,
  applyToolCallEvent,
  formatDurationMs,
  formatStructured,
  type MessageInjection,
  type MessageCitation,
  type SteerNotice,
  type PlanStepItem,
  type TerminalTaskItem,
  type ToolCallItem,
} from '../utils/chat-render-model'

/**
 * 操控本端界面的工具族闸门(2026-09-21 立,agent-control RN 侧)。
 * 族名与本端映射在 `../lib/ui-control-tools`(关键词判定在 @ihui/shared 单一事实源)。
 *
 * 为什么必须在这里按需带:`apps/ai-service/app/routers/llm.py` 的 tool loop 只在请求带
 * 非空 agentTools 时才进入,而本端为保打字机流式,普通问答刻意不带工具(web 端
 * use-chat/send-message.ts 2026-08-29 同因)。不带 → 端侧桥接在对话里就是死代码。
 */

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
  /** 失败轮标记(词汇与共享层 ChatMessage.error 同一份,不另立字段):
   *  有此标记的回复渲染错误卡片 + 重试,且不算内容(不给分享)。 */
  error?: boolean
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
  /** 工具调用可视化(W7):onToolCall 事件折叠后的消息级列表(对齐 web Message.toolCalls)。 */
  toolCalls?: ToolCallItem[]
  /** 计划步骤可视化(W7):onPlanUpdate 权威快照整体替换后的步骤列表(对齐 web Message.planSteps)。 */
  planSteps?: PlanStepItem[]
  /** 计划整体解释(W7):PlanUpdateEvent.explanation。 */
  planExplanation?: string
  /** 终端任务可视化(W7):onTerminalStart/onTerminalEnd 折叠后的列表(对齐 web Message.terminalTasks)。 */
  terminalTasks?: TerminalTaskItem[]
  /** D34 本轮上下文注入交代(第 45 轮):对齐 web message.injections。 */
  injections?: MessageInjection[]
  /** #11 引用溯源(第 51 轮):答案带了哪些知识来源,对齐 web message.citations。 */
  citations?: MessageCitation[]
  /** D106 Steer(中途引导):本轮被用户注入的引导交代,对齐 web steerNoticesByMessageId。
   *  执行期瞬时态不落库(web 同口径),故历史水合不还原。 */
  steerNotices?: SteerNotice[]
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
    favorited: c.favorite === true,
  }
}

// ── W7:对话可视化原生渲染(工具调用 / 计划步骤 / 终端任务) ──
// 说明:路径 B(原生)补齐与路径 A(WebView 复用 web 全量能力)对等的能力。
// W6 计划抽出的共享「消息 → 可渲染模型」纯函数尚未落地,数据折叠逻辑见
// ../utils/chat-render-model(W7 独立实现);本区块只负责原生渲染。

/** 状态徽标语义四态(工具/计划/终端共用):pending=待开始 / active=进行中 / done=已完成 / failed=失败 */
type BadgeKind = 'pending' | 'active' | 'done' | 'failed'

/** 状态徽标(pending/active/done/failed 四态配色,工具调用/计划步骤/终端任务共用) */
function StatusBadge({ kind, label }: { kind: BadgeKind; label: string }): React.JSX.Element {
  const tone =
    kind === 'pending'
      ? { badge: bubbleStyles.badgePending, text: bubbleStyles.badgePendingText }
      : kind === 'active'
        ? { badge: bubbleStyles.badgeActive, text: bubbleStyles.badgeActiveText }
        : kind === 'done'
          ? { badge: bubbleStyles.badgeDone, text: bubbleStyles.badgeDoneText }
          : { badge: bubbleStyles.badgeFailed, text: bubbleStyles.badgeFailedText }
  return (
    <View style={[bubbleStyles.badge, tone.badge]}>
      <Text style={[bubbleStyles.badgeText, tone.text]}>{label}</Text>
    </View>
  )
}

/** 工具结果度量行:写类文件 "+18 -4";读/检索 "128 行" / "5 个结果" / "3 个文件";无度量 '' */
function formatToolMetricLine(
  view: ToolCallView,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  if (view.writesFile) {
    if (view.added < 0 && view.removed < 0) return ''
    const plus = t('taskStatus.addedCount', { n: Math.max(0, view.added) })
    const minus = t('taskStatus.removedCount', { n: Math.max(0, view.removed) })
    return `${plus} ${minus}`
  }
  if (view.metricValue === null) return ''
  const unitKey =
    view.metricKind === 'lines'
      ? 'taskStatus.unitLines'
      : view.metricKind === 'files'
        ? 'taskStatus.unitFiles'
        : view.metricKind === 'results'
          ? 'taskStatus.unitResults'
          : ''
  if (!unitKey) return ''
  return t(unitKey, { n: view.metricValue })
}

/** 工具调用列表(W7):功能名 · 对象 · 度量 + 状态徽标 + 耗时;点击卡片行折叠查看参数/输出 */
function ToolCallList({ items }: { items: readonly ToolCallItem[] }): React.JSX.Element {
  const { t } = useI18n()
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({})
  return (
    <View style={bubbleStyles.block}>
      <Text style={bubbleStyles.blockTitle}>{t('aiAssistantN8n.toolCalls')}</Text>
      {items.map((item) => {
        // 活动行语言:状态 · 功能名 · 对象 · 结果度量(单一真相源 describeToolCall,禁端内自行挖 args/result)
        const view = describeToolCall({
          toolName: item.name,
          args: item.args,
          result: item.result,
          status: item.status,
        })
        const displayName = view.nameKey ? t(`taskStatus.${view.nameKey}`) : item.name
        const metricLine = formatToolMetricLine(view, t)
        const showSubject = view.subject !== ''
        const statusLabel =
          item.status === 'running'
            ? t('aiAssistantN8n.toolStatusRunning')
            : item.status === 'success'
              ? t('aiAssistantN8n.toolStatusSuccess')
              : t('aiAssistantN8n.toolStatusError')
        const toneKind: BadgeKind =
          item.status === 'running' ? 'active' : item.status === 'success' ? 'done' : 'failed'
        const duration = formatDurationMs(item.durationMs)
        const argsText = formatStructured(item.args)
        const resultText = formatStructured(item.result)
        const expandable = Boolean(argsText) || Boolean(resultText)
        const open = expandable && openIds[item.id] === true
        return (
          <View key={item.id} style={bubbleStyles.card}>
            <Pressable
              style={bubbleStyles.cardHead}
              onPress={() => setOpenIds((prev) => ({ ...prev, [item.id]: !open }))}
              accessibilityRole="button"
              accessibilityLabel={[displayName, view.subject, statusLabel]
                .filter(Boolean)
                .join(' · ')}
            >
              {expandable ? (
                open ? (
                  <ChevronDown size={10} color={tokens.text.tertiary} />
                ) : (
                  <ChevronRight size={10} color={tokens.text.tertiary} />
                )
              ) : null}
              <Text style={bubbleStyles.cardTitle} numberOfLines={1}>
                {displayName}
              </Text>
              {showSubject ? (
                <Text style={bubbleStyles.cardSubject} numberOfLines={1}>
                  {view.subject}
                </Text>
              ) : null}
              {metricLine ? <Text style={bubbleStyles.cardMeta}>{metricLine}</Text> : null}
              <StatusBadge kind={toneKind} label={statusLabel} />
              {duration ? <Text style={bubbleStyles.cardMeta}>{duration}</Text> : null}
            </Pressable>
            {open ? (
              <View style={bubbleStyles.cardBody}>
                {argsText ? (
                  <View>
                    <Text style={bubbleStyles.sectionLabel}>{t('aiAssistantN8n.toolArgs')}</Text>
                    <Text style={bubbleStyles.monoText}>{argsText}</Text>
                  </View>
                ) : null}
                {resultText ? (
                  <View style={argsText ? bubbleStyles.sectionGap : null}>
                    <Text style={bubbleStyles.sectionLabel}>{t('aiAssistantN8n.toolResult')}</Text>
                    <Text style={bubbleStyles.monoText}>{resultText}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        )
      })}
    </View>
  )
}

/** 计划步骤列表(W7):序号 + 步骤文本 + 状态徽标 + 耗时,顶部可选整体 explanation */
function PlanStepList({
  steps,
  explanation,
}: {
  steps: readonly PlanStepItem[]
  explanation?: string
}): React.JSX.Element {
  const { t } = useI18n()
  return (
    <View style={bubbleStyles.block}>
      <Text style={bubbleStyles.blockTitle}>{t('aiAssistantN8n.planSteps')}</Text>
      {explanation ? <Text style={bubbleStyles.blockHint}>{explanation}</Text> : null}
      {steps.map((step, index) => {
        const statusLabel =
          step.status === 'completed'
            ? t('aiAssistantN8n.planStatusCompleted')
            : step.status === 'in_progress'
              ? t('aiAssistantN8n.planStatusInProgress')
              : t('aiAssistantN8n.planStatusPending')
        const toneKind: BadgeKind =
          step.status === 'completed'
            ? 'done'
            : step.status === 'in_progress'
              ? 'active'
              : 'pending'
        const duration = formatDurationMs(step.durationMs)
        return (
          <View key={step.id} style={bubbleStyles.planRow}>
            <Text style={bubbleStyles.planIndex}>{index + 1}</Text>
            <Text style={bubbleStyles.planText}>
              {humanizeToolText(step.step, (key) => t(`taskStatus.${key}`))}
            </Text>
            <StatusBadge kind={toneKind} label={statusLabel} />
            {duration ? <Text style={bubbleStyles.cardMeta}>{duration}</Text> : null}
          </View>
        )
      })}
    </View>
  )
}

/** 终端任务列表(W7):命令 + 状态徽标 + 耗时;点击折叠查看等宽输出 + 退出码 */
function TerminalTaskList({ tasks }: { tasks: readonly TerminalTaskItem[] }): React.JSX.Element {
  const { t } = useI18n()
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({})
  return (
    <View style={bubbleStyles.block}>
      <Text style={bubbleStyles.blockTitle}>{t('aiAssistantN8n.terminalTasks')}</Text>
      {/* 与 web/extension/小程序同一句执行环境交代(os_sandbox allow_network 默认 False) */}
      <Text style={bubbleStyles.blockHint} testID="terminal-isolation">
        {t('aiAssistantN8n.terminalIsolation')}
      </Text>
      {tasks.map((task) => {
        const statusLabel =
          task.status === 'completed'
            ? t('aiAssistantN8n.terminalStatusCompleted')
            : task.status === 'failed'
              ? t('aiAssistantN8n.terminalStatusFailed')
              : t('aiAssistantN8n.terminalStatusRunning')
        const toneKind: BadgeKind =
          task.status === 'completed' ? 'done' : task.status === 'failed' ? 'failed' : 'active'
        const duration = formatDurationMs(task.durationMs)
        const open = openIds[task.id] === true
        return (
          <View key={task.id} style={bubbleStyles.card}>
            <Pressable
              style={bubbleStyles.cardHead}
              onPress={() => setOpenIds((prev) => ({ ...prev, [task.id]: !open }))}
              accessibilityRole="button"
              accessibilityLabel={task.command}
            >
              {open ? (
                <ChevronDown size={10} color={tokens.text.tertiary} />
              ) : (
                <ChevronRight size={10} color={tokens.text.tertiary} />
              )}
              <Text style={bubbleStyles.terminalCommand} numberOfLines={1}>
                {task.command}
              </Text>
              <StatusBadge kind={toneKind} label={statusLabel} />
              {duration ? <Text style={bubbleStyles.cardMeta}>{duration}</Text> : null}
            </Pressable>
            {open ? (
              <View style={bubbleStyles.cardBody}>
                {task.exitCode !== undefined ? (
                  <Text style={bubbleStyles.sectionLabel}>
                    {t('aiAssistantN8n.terminalExitCode')}: {task.exitCode}
                  </Text>
                ) : null}
                {task.output ? (
                  <View style={task.exitCode !== undefined ? bubbleStyles.sectionGap : null}>
                    <Text style={bubbleStyles.sectionLabel}>
                      {t('aiAssistantN8n.terminalOutput')}
                    </Text>
                    <Text style={bubbleStyles.monoText}>{task.output}</Text>
                    {/* 后端只下发截断文本:不交代总长就等于让用户把截断当完整 */}
                    {task.truncated ? (
                      <Text style={bubbleStyles.sectionLabel}>
                        {t('aiAssistantN8n.terminalTruncated', {
                          total: task.totalChars ?? task.output.length,
                        })}
                      </Text>
                    ) : null}
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        )
      })}
    </View>
  )
}

interface MessageBubbleProps {
  message: N8nMessage
  onPreviewImage: (url: string) => void
  /** 浮层提示(复用屏幕 showToast,对齐 Uniapp uni.showToast) */
  onToast: (type: FloatBoxType, message: string) => void
  /** 失败轮重试:仅当该轮确实可重发时由父级传入;缺失即不渲染重试按钮 */
  onRetry?: () => void
}

function MessageBubble({
  message,
  onPreviewImage,
  onToast,
  onRetry,
}: MessageBubbleProps): React.JSX.Element {
  const { t } = useI18n()
  const isUser = message.role === 'user'
  const hasImages = !isUser && (message.images?.length ?? 0) > 0
  // 失败轮:渲染错误卡片而非正文(与 web D22 / ChatScreen 同一形态)
  const isFailed = !isUser && isErrorTurn(message)
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
            {isFailed ? (
              <View style={bubbleStyles.errorCard}>
                <View style={bubbleStyles.errorHeader}>
                  <AlertTriangle size={14} color={tokens.error.text} />
                  <Text style={bubbleStyles.errorTitle}>{t('chatAlert.errorTitle')}</Text>
                </View>
                <Text style={bubbleStyles.errorBody} selectable>
                  {message.content}
                </Text>
                {onRetry ? (
                  <TouchableOpacity
                    style={bubbleStyles.errorRetry}
                    hitSlop={8}
                    onPress={onRetry}
                    accessibilityRole="button"
                    accessibilityLabel={t('chatAlert.errorRetry')}
                  >
                    <RefreshCw size={14} color={tokens.error.text} />
                    <Text style={bubbleStyles.errorRetryText}>{t('chatAlert.errorRetry')}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : answerVisible && message.content ? (
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
          {/* 工具调用可视化(W7:原生卡片,点击折叠查看参数/输出) */}
          {answerVisible && message.toolCalls && message.toolCalls.length > 0 ? (
            <ToolCallList items={message.toolCalls} />
          ) : null}
          {/* 计划步骤可视化(W7:步骤 + 状态徽标 + 可选 explanation) */}
          {answerVisible && message.planSteps && message.planSteps.length > 0 ? (
            <PlanStepList steps={message.planSteps} explanation={message.planExplanation} />
          ) : null}
          {/* 终端任务可视化(W7:命令 + 等宽输出 + 退出码) */}
          {answerVisible && message.terminalTasks && message.terminalTasks.length > 0 ? (
            <TerminalTaskList tasks={message.terminalTasks} />
          ) : null}
          {/* D34 本轮上下文注入交代(第 45 轮补齐该端,此前该帧在本端 0 命中) */}
          {answerVisible && message.injections && message.injections.length > 0 ? (
            <InjectionDisclosure items={message.injections} />
          ) : null}
          {answerVisible && message.citations && message.citations.length > 0 ? (
            <CitationList items={message.citations} />
          ) : null}
          {/* D106 Steer(中途引导)交代:本轮被注入了哪些引导文本 */}
          {answerVisible && message.steerNotices && message.steerNotices.length > 0 ? (
            <SteerNoticeList items={message.steerNotices} />
          ) : null}
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
              {/* 分享(对齐 Uniapp share,RN 用 Share API 分享 content)
                  失败轮不给分享(它不是内容);复制保留 —— 报错排查要用那段文字 */}
              {isFailed ? null : (
                <TouchableOpacity
                  style={bubbleStyles.actionBtn}
                  hitSlop={6}
                  onPress={handleShare}
                  accessibilityRole="button"
                  accessibilityLabel="分享"
                >
                  <Share2 size={16} color={tokens.text.secondary} />
                </TouchableOpacity>
              )}
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

  // ── 输入区「+」添加面板(统一 AddPanel:相机/相册/本地文件/微信文件;
  //    上传链路与 HomeScreen/ChatScreen 同源:选择 → uploadFileMultipart → 拼入 prompt) ──
  const [addPanelVisible, setAddPanelVisible] = useState(false)
  const [addUploading, setAddUploading] = useState(false)
  const handleAddPanelToggle = (): void => {
    if (!addPanelVisible) Keyboard.dismiss()
    setAddPanelVisible(!addPanelVisible)
  }
  /** 相机(对齐 ChatScreen handleIconClick('camera'):相机拍摄待接入,占位提示) */
  const handleAddCamera = (): void => {
    setAddPanelVisible(false)
    showToast('warning', '相机拍摄待接入,请先用相册上传图片')
  }
  /** 相册选图 → 上传 → 拼入输入框 */
  const handleAddAlbum = async (): Promise<void> => {
    setAddPanelVisible(false)
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: false,
        quality: 0.8,
      })
      if (result.canceled) return
      const asset = result.assets?.[0]
      if (!asset?.uri) return
      setAddUploading(true)
      const up = await uploadFileMultipart({
        uri: asset.uri,
        type: asset.mimeType ?? 'image/jpeg',
        name: asset.fileName ?? `image-${Date.now()}.jpg`,
      })
      if (up.success && up.data?.path) {
        setInput((p) => `${p ? `${p}\n` : ''}[图片] ${resolveFileUrl(up.data!.path)}`)
        showToast('success', '图片已上传,发送后可在对话中使用')
      } else {
        showToast('warning', '图片上传失败')
      }
    } catch {
      showToast('warning', '图片选择失败,请重试')
    } finally {
      setAddUploading(false)
    }
  }
  /** 本地文件 / 微信文件选择 → 上传 → 拼入输入框(对齐 ChatScreen handleFileUpload:
   *  wxfile 与 file 走同一 DocumentPicker 链路) */
  const handleAddFile = async (): Promise<void> => {
    setAddPanelVisible(false)
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
      setAddUploading(true)
      const up = await uploadFileMultipart({
        uri: asset.uri,
        type: asset.mimeType ?? 'application/octet-stream',
        name: asset.name ?? `file-${Date.now()}`,
      })
      if (up.success && up.data?.path) {
        const fileName = asset.name ?? '文件'
        setInput((p) => `${p ? `${p}\n` : ''}[文件] ${fileName} ${resolveFileUrl(up.data!.path)}`)
        showToast('success', `已上传:${fileName}`)
      } else {
        showToast('warning', '文件上传失败')
      }
    } catch {
      showToast('warning', '文件选择失败,请重试')
    } finally {
      setAddUploading(false)
    }
  }
  // 当前对话 ID(从路由传入或后续选择历史对话时更新,用于 streamChat metadata)
  const [currentConversationId, setCurrentConversationId] = useState<string | undefined>(
    routeConversationId,
  )

  // 剩余智汇值(对齐 Uniapp 顶部 intelligent-assistant tokenQuantity,接 getTokenBalance 真实余额)
  const [tokenBalance, setTokenBalance] = useState(0)

  // D111:工作区权限档(null = 尚未取到/取数失败 → 整行隐藏,不假装知道档位)。
  // 此前移动端对"当前处于哪一档、该档会导致什么"零可见,而本端对话能让 AI 改文件/跑命令。
  const [workspaceTier, setWorkspaceTier] = useState<string | null>(null)
  // G-165①:消息级盖章档位(服务端从 workspace_permissions 反查后写入消息 metadata,
  // 不采信客户端自报)。undefined = 尚未见到已盖章消息;null = 明确无;string = 盖章值。
  const [stampedTier, setStampedTier] = useState<string | null | undefined>(undefined)

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

  // D111:首屏交代当前权限档(档名 + 后果)。取词走共享 permissionTierWordKeys(unknown 兜底)。
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

  // 任务进度状态条数据源(对齐 web task-status-bar):plan_updated 权威快照写在
  // "那一条 assistant 消息"上,取最后一条带 planSteps 的 assistant 消息(倒序扫描)。
  const planMessage = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i]
      if (message?.role === 'assistant' && (message.planSteps?.length ?? 0) > 0) return message
    }
    return null
  }, [messages])

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
    const res = await getMessages(id, { direction: 'initial', pageSize: 100 })
    if (res.success) {
      // G-165①:档位行数据源换挡 —— 取最近一条已盖章助手消息的 metadata.permissionMode
      // (服务端从 workspace_permissions 反查盖章,不采信客户端自报)。盖章服务对
      // "不知道"不写 key,所以这里只有 string 才算数,绝不编造 default。
      const stampedMeta = [...res.data.messages]
        .reverse()
        .find(
          (m) =>
            m.role === 'assistant' &&
            typeof (m.metadata as { permissionMode?: unknown } | null)?.permissionMode === 'string',
        )
      if (stampedMeta) {
        setStampedTier(
          (stampedMeta.metadata as { permissionMode: string }).permissionMode,
        )
      }
      // 历史消息回放:后端把工具调用 / plan 步骤持久化在消息 metadata(D24,toolCalls 已落库;
      // planSteps 随 #15 持久化上线后自动生效)。映射回端内 N8nMessage.toolCalls / planSteps,
      // 使历史会话与实时流走同一活动行渲染口径(状态 · 功能名 · 对象 · 度量)。
      const loaded: N8nMessage[] = res.data.messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m, idx) => {
          const meta = m.metadata as {
            toolCalls?: unknown
            planSteps?: unknown
            citations?: unknown
            injections?: unknown
          } | null
          const planSteps = Array.isArray(meta?.planSteps)
            ? (meta?.planSteps as Array<Record<string, unknown>>).flatMap((s, i) =>
                typeof s?.step === 'string'
                  ? [
                      {
                        id: typeof s.id === 'string' ? s.id : `plan-${idx}-${i}`,
                        step: s.step,
                        status: (s.status as PlanStepItem['status']) ?? 'pending',
                        ...(typeof s.durationMs === 'number' ? { durationMs: s.durationMs } : {}),
                        ...(typeof s.tokenUsage === 'number' ? { tokenUsage: s.tokenUsage } : {}),
                      },
                    ]
                  : [],
              )
            : undefined
          const toolCalls = Array.isArray(meta?.toolCalls)
            ? (meta?.toolCalls as Array<Record<string, unknown>>).flatMap((c) =>
                typeof c?.id === 'string' && typeof c.toolName === 'string'
                  ? [
                      {
                        id: c.id,
                        name: c.toolName,
                        status:
                          c.status === 'error' || c.error
                            ? ('error' as const)
                            : c.status === 'success'
                              ? ('success' as const)
                              : ('running' as const),
                        ...(c.args && typeof c.args === 'object'
                          ? { args: c.args as Record<string, unknown> }
                          : {}),
                        ...(c.result !== undefined ? { result: c.result } : {}),
                        ...(typeof c.durationMs === 'number' ? { durationMs: c.durationMs } : {}),
                      },
                    ]
                  : [],
              )
            : undefined
          // G-166:交代帧同样从 metadata 读回 —— 服务端已把"引用了哪些来源 / 本轮带了哪些
          // 上下文"随回调落库(与 SSE 帧同一真相源),此前重进历史会话这两段交代整段看不见。
          // 逐条类型守卫:脏条目单条丢弃,缺 url 不造"点不动的假链接"。
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
          return {
            id: `${m.id}-${idx}`,
            role: m.role as 'user' | 'assistant',
            content: m.content,
            ...(planSteps && planSteps.length > 0 ? { planSteps } : {}),
            ...(toolCalls && toolCalls.length > 0 ? { toolCalls } : {}),
            ...(citations && citations.length > 0 ? { citations } : {}),
            ...(injections && injections.length > 0 ? { injections } : {}),
          }
        })
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

    // agentTools 闸门:意图判定对象是"本次要发出去的最后一条 user 消息"(即上面的 text,
    // system 提示词不参与判定,否则提示词里的"打开/进入"等字样会让每次请求都带工具)
    const agentTools = uiControlToolsFor(text)

    // 2026-09-04 吞错修复(Fix B):streamChat 未传 onError 时对流内 error 事件耗尽重试后会 throw(reject,
    // 见 client.ts catch 块)。本屏虽传了 onError,但请求构造/网络层在进入重试循环前抛出的异常仍会 reject,
    // 此前无 try/catch 会导致 unhandled rejection 且 sending 永远不复位。补 try/catch 把错误路由到
    // 本屏既有错误状态处理(sending 复位 + 空回复填充错误提示 + toast),对齐 ChatScreen 错误处理写法。
    try {
      await streamChat({
        model: selectedModelId,
        messages: apiMessages,
        agentId,
        // 不命中意图时连字段都不出现,请求体与改造前逐字节一致(api-client 另有 length>0 守卫)
        ...(agentTools.length > 0 ? { agentTools } : {}),
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
        // 工具调用可视化(W7):tool-call-start/tool-result 折叠进最后一条 assistant 消息
        onToolCall: (event) => {
          setMessages((prev) => {
            const next = [...prev]
            const last = next[next.length - 1]
            if (last && last.role === 'assistant') {
              next[next.length - 1] = {
                ...last,
                toolCalls: applyToolCallEvent(last.toolCalls, event),
              }
            }
            return next
          })
          scrollToEnd()
        },
        // 计划步骤可视化(W7):plan 为权威快照,整体替换(不可与现有步骤增量合并)
        onPlanUpdate: (event) => {
          const reduced = applyPlanUpdate(event)
          setMessages((prev) => {
            const next = [...prev]
            const last = next[next.length - 1]
            if (last && last.role === 'assistant') {
              next[next.length - 1] = {
                ...last,
                planSteps: reduced.steps,
                planExplanation: reduced.explanation,
              }
            }
            return next
          })
          scrollToEnd()
        },
        // 终端任务可视化(W7):terminal_start 按 terminalId 新增/重置为 running
        onTerminalStart: (event) => {
          setMessages((prev) => {
            const next = [...prev]
            const last = next[next.length - 1]
            if (last && last.role === 'assistant') {
              next[next.length - 1] = {
                ...last,
                terminalTasks: applyTerminalStart(last.terminalTasks, event),
              }
            }
            return next
          })
          scrollToEnd()
        },
        // 终端任务可视化(W7):terminal_end 更新终态/输出/退出码/耗时
        onTerminalEnd: (event) => {
          setMessages((prev) => {
            const next = [...prev]
            const last = next[next.length - 1]
            if (last && last.role === 'assistant') {
              next[next.length - 1] = {
                ...last,
                terminalTasks: applyTerminalEnd(last.terminalTasks, event),
              }
            }
            return next
          })
          scrollToEnd()
        },
        // #11 引用溯源(第 51 轮):引用进消息,答案下方出来源列表
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
          scrollToEnd()
        },
        // D34 上下文注入交代(第 45 轮):本轮回答真正带上了哪些注入(对齐 web / 小程序口径)
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
          scrollToEnd()
        },
        // D106 Steer(中途引导):ai-service 在 tool loop 边界注入引导后下发 steer 事件,
        // 这里逐字段承接(phase/text/timestamp/messageId)累积到最后一条 assistant 消息;
        // 空文本帧由 appendSteerFrames 整帧丢弃,不渲染空交代。
        onSteer: (event) => {
          setMessages((prev) => {
            const next = [...prev]
            const last = next[next.length - 1]
            if (last && last.role === 'assistant') {
              const notices = appendSteerFrames(last.steerNotices, event)
              if (notices.length > 0) {
                next[next.length - 1] = { ...last, steerNotices: notices }
              }
            }
            return next
          })
          scrollToEnd()
        },
        // D39 重试交代:网关换 key / 退避重试时提示,否则用户在流上只看到"卡住"
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
        // 上下文自动压缩提示(W7):后端达阈值自动压缩时提示用户(对齐 onCompaction 契约)
        onCompaction: (info) => {
          showToast(
            'info',
            t('aiAssistantN8n.compactionToast', {
              before: info.tokensBefore,
              after: info.tokensAfter,
            }),
          )
        },
        onError: (err, info) => {
          // info 透传:errorCode 是"厂商账号额度耗尽"等稳定码的唯一判据(HTTP 仍回落默认 502)
          const formatted = formatSSEError(new Error(err), info)
          setSending(false)
          abortRef.current = null
          // 失败轮:标 error + 仅在正文为空时写错误文案(共享层同一标记规则,与 ChatScreen / web 一致)。
          // 此前只填文案不打标 → 数据上与一次真回答同形,界面也只有一句普通文本、没有任何出口。
          setMessages((prev) =>
            applyStreamError(prev, formatted.message || t('aiAssistantN8n.callFailed')),
          )
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
      setMessages((prev) =>
        applyStreamError(prev, formatted.message || t('aiAssistantN8n.callFailed')),
      )
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
  /** 失败轮重试:重发最后一条用户提问,并把失败气泡从视图撤掉。
   *  本屏 send 只带"本轮 + systemPrompt"(不回放历史),所以无需像 ChatScreen 那样截断历史。 */
  const retryLastTurn = (): void => {
    const text = resendTargetText(messages)
    if (!text) return
    setMessages((prev) => prev.filter((m) => !isErrorTurn(m)))
    void onSend(text)
  }

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
    navigateDrawerTab(rootNav, tab)
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
    <MessageBubble
      message={item}
      onPreviewImage={handlePreviewImage}
      onToast={showToast}
      onRetry={isErrorTurn(item) && resendTargetText(messages) !== null ? retryLastTurn : undefined}
    />
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
      {/* D111/G-165①:权限档交代行 —— 数据源优先级:消息盖章值 > 工作区默认档;
          两者皆缺(盖章不存在且取数失败)整行隐藏,不假装知道档位。 */}
      {(() => {
        const tierValue = stampedTier ?? workspaceTier
        if (tierValue === null || tierValue === undefined) return null
        return (
          <View style={{ paddingHorizontal: 16, paddingVertical: 4 }}>
            <Text style={{ fontSize: 11, color: tokens.text.tertiary }}>
              {`${t('permissionTier.label')}: ${t(permissionTierWordKeys(tierValue).title)} · ${t(
                permissionTierWordKeys(tierValue).desc,
              )}`}
            </Text>
          </View>
        )
      })()}
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
        {/* 任务进度状态条(对齐 web task-status-bar):plan_updated 驱动自动刷新,
            空闲(无步骤/无变更/非流式)时内部返回 null 不占高度 */}
        <TaskStatusBar
          planSteps={planMessage?.planSteps ?? []}
          toolCalls={planMessage?.toolCalls}
          isStreaming={sending}
        />
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
          onImageAdd={handleAddPanelToggle}
        />
        {/* 「+」底部滑出添加面板(统一 AddPanel,与 HomeScreen/ChatScreen 同源) */}
        <AddPanel
          visible={addPanelVisible}
          onClose={() => setAddPanelVisible(false)}
          items={[
            {
              key: 'camera',
              label: '相机',
              icon: <Camera size={24} color={tokens.text.secondary} />,
              onPress: handleAddCamera,
            },
            {
              key: 'album',
              label: '相册',
              icon: addUploading ? (
                <ActivityIndicator size="small" color={tokens.text.secondary} />
              ) : (
                <ImageIcon size={24} color={tokens.text.secondary} />
              ),
              onPress: () => void handleAddAlbum(),
            },
            {
              key: 'file',
              label: '本地文件',
              icon: <Folder size={24} color={tokens.text.secondary} />,
              onPress: () => void handleAddFile(),
            },
            {
              key: 'wxfile',
              label: '微信文件',
              icon: <MessageCircle size={24} color={tokens.text.secondary} />,
              onPress: () => void handleAddFile(),
            },
          ]}
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
    borderRadius: rnRadius.md,
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
    borderRadius: rnRadius['2xl'],
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
    borderRadius: rnRadius.lg,
  },
  bubbleUser: { backgroundColor: tokens.brand.DEFAULT },
  bubbleAi: { backgroundColor: tokens.surface.card },
  text: { fontSize: 14, lineHeight: 20 },
  textUser: { color: tokens.surface.light },
  textAi: { color: tokens.text.primary },
  // 回复内图片网格(对齐 Uniapp agent-content-item-img)
  // 失败轮错误卡片(与 web D22 / ChatScreen 同一形态:警示头 + 正文 + 重试出口)
  errorCard: {
    width: '100%',
    borderRadius: rnRadius.lg,
    borderWidth: 1,
    borderColor: tokens.danger.light,
    backgroundColor: tokens.error.bg,
    overflow: 'hidden',
  },
  errorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: tokens.danger.light,
  },
  errorTitle: { fontSize: 12, fontWeight: '500', color: tokens.error.text },
  errorBody: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    lineHeight: 20,
    color: tokens.error.text,
  },
  errorRetry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginHorizontal: 8,
    marginBottom: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  errorRetryText: { fontSize: 12, color: tokens.error.text },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: rpx(12),
    marginTop: rpx(16),
  },
  chatImage: {
    width: 120,
    height: 120,
    borderRadius: rnRadius.md,
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
    borderRadius: rnRadius.lg,
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
  // ── W7:对话可视化区块样式(工具调用 / 计划步骤 / 终端任务) ──
  // 区块容器(标题 + 卡片/行列表),与 assistant 气泡同宽上限
  block: {
    maxWidth: '78%',
    marginTop: rpx(8),
    gap: rpx(6),
  },
  blockTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: tokens.text.tertiary,
  },
  blockHint: {
    fontSize: 12,
    lineHeight: 18,
    color: tokens.text.secondary,
  },
  // 卡片(工具调用 / 终端任务共用外壳)
  card: {
    borderRadius: rnRadius.md,
    borderWidth: 1,
    borderColor: tokens.border.light,
    backgroundColor: tokens.surface.muted,
    overflow: 'hidden',
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rpx(8),
    paddingHorizontal: rpx(12),
    paddingVertical: rpx(8),
  },
  cardTitle: { flexShrink: 0, fontSize: 12, color: tokens.text.primary },
  cardSubject: {
    flex: 1,
    fontSize: 11,
    color: tokens.text.tertiary,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  cardMeta: { fontSize: 10, color: tokens.text.tertiary },
  cardBody: {
    paddingHorizontal: rpx(12),
    paddingBottom: rpx(10),
    gap: rpx(6),
  },
  sectionLabel: { fontSize: 10, fontWeight: '600', color: tokens.text.tertiary },
  sectionGap: { marginTop: rpx(6) },
  // 等宽文本(工具参数/输出、终端命令与输出)
  monoText: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontSize: 11,
    lineHeight: 16,
    color: tokens.text.medium,
  },
  terminalCommand: {
    flex: 1,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontSize: 11,
    color: tokens.text.primary,
  },
  // 计划步骤行(序号 + 步骤文本 + 状态徽标 + 耗时)
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rpx(8),
  },
  planIndex: {
    width: 16,
    fontSize: 11,
    color: tokens.text.tertiary,
  },
  planText: { flex: 1, fontSize: 12, lineHeight: 18, color: tokens.text.primary },
  // 状态徽标(pending/active/done/failed 四态:底色 + 文字色成对)
  badge: {
    paddingHorizontal: rpx(8),
    paddingVertical: rpx(2),
    borderRadius: rnRadius.sm,
  },
  badgeText: { fontSize: 10, fontWeight: '600' },
  badgePending: { backgroundColor: tokens.gray[200] },
  badgePendingText: { color: tokens.text.secondary },
  badgeActive: { backgroundColor: tokens.warning.amberLight },
  badgeActiveText: { color: tokens.warning.amberText },
  badgeDone: { backgroundColor: tokens.success.lighter },
  badgeDoneText: { color: tokens.success.deepText },
  badgeFailed: { backgroundColor: tokens.error.bg },
  badgeFailedText: { color: tokens.danger.DEFAULT },
})

const pickerStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: tokens.surface.light,
    borderTopLeftRadius: rnRadius['2xl'],
    borderTopRightRadius: rnRadius['2xl'],
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
