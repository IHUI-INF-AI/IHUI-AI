// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { aizhsUrl } from '@/constants/icon-urls'
import { useI18n, useTt } from '@/i18n'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import LineIcon from '@/components/LineIcon'
const tishiIcon = aizhsUrl('remote-images/tishi_icon.png')
const floderInputIcon = aizhsUrl('remote-images/floder_input.png')
const fileIcon = aizhsUrl('remote-images/file.png')
// record_back.png 5.2MB 大图,用字符串路径让 Taro copy 到 dist/static/ 而非打包进 common.js(对齐原项目 aigc/index.vue)
const recordBackIcon = '/static/images/record_back.png'
import Taro, { useRouter, useDidHide, useDidShow, useShareAppMessage } from '@tarojs/taro'
import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { rnRadius } from '@ihui/design-tokens'
import {
  chatStream,
  type ChatMessage,
  fetchModels,
  getAigcList,
  getAgentDetail,
  getAgentList,
} from '@/api'
import {
  formatSSEError,
  getModelContextCapacity,
  getWorkspacePermissionDefault,
  // D20 服务端会话回放:消息体唯一出口(端内不得裸 Taro.request,守门 73)
  getMessages,
} from '@ihui/api-client'
import { formatTokenCount } from '@ihui/shared/utils'
import { applyStreamError, isErrorTurn, resendTargetText } from '@ihui/shared/chat'
import type { Agent } from '@ihui/api-client'
import {
  type ModelItem,
  InputArea,
  SkillsPopup,
  MaterialPopup,
  IntelligentAssistant,
  type AgentItem,
  type MaterialTab,
  type InputFileItem,
} from '@/components'
import { useUserStore } from '@/stores/user'
import { AI_AGENT_TIP_SHOWN_KEY } from '@/constants/storage'
import ChatMessageItem from './ChatMessageItem'
import ContextUsageStrip from './context-usage-strip'
import { resolvePermissionTierText } from './permission-tier-text'
import TaskStatusBar from './task-status-bar'
import {
  appendCitations,
  appendSteerNotice,
  appendTerminalDelta,
  backfillSteerNoticesFromMetadata,
  toSteerNotice,
  type AICardsData,
} from './cards/types'
import { toolActivityText } from './cards/tool-line'
import { ModelDrawer, AgentDrawer, HistoryDrawer, type ChatHistoryEntry } from './ChatDrawers'
import {
  replayServerConversation,
  fetchEarlierPage,
  prependEarlierMessages,
} from './server-chat-replay'
import AgentTipDialog from './AgentTipDialog'
import './chat.css'
import ThemeRoot from '@/components/ThemeRoot'

const HISTORY_STORAGE_KEY = 'ai_chat_history'
const FAVORITE_STORAGE_KEY = 'ai_favorite_messages'
const MAX_HISTORY_COUNT = 50

interface MaterialItem {
  id: string
  title: string
  coverUrl?: string
  content?: string
  createdAt?: string
}
type AgentInfo = Pick<Agent, 'id' | 'name' | 'description' | 'systemPrompt'> & {
  avatar?: string
  /** 智能体开场白(对标原 ai_assistant.vue prologue,引导说明内容) */
  prologue?: string
}

const MATERIAL_PAGE_SIZE = 20

export default function ChatPage() {
  const router = useRouter()
  const { t, tList } = useI18n()
  const tt = useTt()
  const suggestions = tList('ai.suggestions')
  const user = useUserStore((s) => s.user)
  const routeAgentId = router.params.agentId || ''
  // 支持从历史页(/pkg-ai/ai/history?sessionId=)与首页抽屉(/pkg-ai/ai/chat?id=)跳转恢复会话
  const routeSessionId = router.params.sessionId || router.params.id || ''
  const [currentAgentId, setCurrentAgentId] = useState(routeAgentId)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [thinking, setThinking] = useState(false)
  // 思考进度条(对标原 ai_assistant.vue thinkingProgress:120ms 定时器 +Math.random()*1,上限 99,完成时设 100)
  const [thinkingProgress, setThinkingProgress] = useState(0)
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [sessionId, setSessionId] = useState('')
  // D20 留尾2:超长会话向前翻页。cursor 走 ref(不驱动渲染);hasMore/loading 走 state(驱动顶部入口)
  const [earlierHasMore, setEarlierHasMore] = useState(false)
  const [loadingEarlier, setLoadingEarlier] = useState(false)
  const earlierCursorRef = useRef<string | null>(null)
  /** 会话切换/清空/本机快照恢复时重置向前翻页态 —— 防旧会话游标把别的会话的消息前插进来 */
  const resetEarlierPaging = useCallback(() => {
    setEarlierHasMore(false)
    setLoadingEarlier(false)
    earlierCursorRef.current = null
  }, [])
  const [currentModel, setCurrentModel] = useState('')
  const [currentModelName, setCurrentModelName] = useState('')
  const [modelDrawerVisible, setModelDrawerVisible] = useState(false)
  const [models, setModels] = useState<ModelItem[]>([])
  const [modelsLoading, setModelsLoading] = useState(false)
  const [materialDrawerVisible, setMaterialDrawerVisible] = useState(false)
  const [materials, setMaterials] = useState<MaterialItem[]>([])
  const [materialsLoading, setMaterialsLoading] = useState(false)
  const [materialPage, setMaterialPage] = useState(1)
  const [materialHasMore, setMaterialHasMore] = useState(true)
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialItem | null>(null)
  const [materialTab, setMaterialTab] = useState<MaterialTab>(1)
  const [agentDrawerVisible, setAgentDrawerVisible] = useState(false)
  const [agent, setAgent] = useState<AgentInfo | null>(null)
  // 智能体引导说明(对标原 ai_assistant.vue tishi_show + tishi_content)
  const [tishiShow, setTishiShow] = useState(false)
  const [skillsPopupVisible, setSkillsPopupVisible] = useState(false)
  const [agents, setAgents] = useState<AgentItem[]>([])
  const [agentsLoading, setAgentsLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  // 待分享消息(对标原 ai_assistant.vue 分享对话,长按消息后存入,useShareAppMessage 动态读取)
  const shareMsgRef = useRef<ChatMessage | null>(null)
  // 复用问题到输入框(对标原 ai_assistant.vue copyToInput)
  const [inputValue, setInputValue] = useState('')
  // 附件列表(受控模式由父组件管理,对标原项目 imgs_list)
  const [imgsList, setImgsList] = useState<InputFileItem[]>([])
  // 全屏放大态(隐藏导航栏,对标原项目 InputArea.vue fangda)
  const [navBarHidden, setNavBarHidden] = useState(false)
  // 收藏消息(对标原 ai_assistant.vue 收藏 AI 回复,用消息 timestamp 作为 id)
  const [favoritedMsgs, setFavoritedMsgs] = useState<Set<string>>(new Set())
  // 历史对话(对标原 ai_assistant.vue 历史抽屉)
  const [chatHistories, setChatHistories] = useState<ChatHistoryEntry[]>([])
  const [historyDrawerVisible, setHistoryDrawerVisible] = useState(false)
  // 智能体提示说明弹窗(对标原 ai_index.vue,首次进入自动弹 + "?" 手动触发)
  const [agentTipVisible, setAgentTipVisible] = useState(false)
  // 思考过程独立浮层(对标原项目 .agent-content1-overlay,点击 AI 气泡"思考过程"按钮打开)
  const [reasoningPopupVisible, setReasoningPopupVisible] = useState<boolean>(false)
  const [reasoningPopupContent, setReasoningPopupContent] = useState<string>('')
  // D111:工作区权限档(null = 尚未取到/取数失败 → 整行隐藏,不假装知道档位)。
  // 此前移动端对"当前处于哪一档、该档会导致什么"零可见,而本端对话能让 AI 改文件/跑命令。
  const [workspaceTier, setWorkspaceTier] = useState<string | null>(null)

  // D111:首屏交代当前权限档(档名 + 后果)。取词走共享 permissionTierWordKeys(unknown 兜底)。
  useEffect(() => {
    let cancelled = false
    getWorkspacePermissionDefault()
      .then((res) => {
        if (!cancelled && res.success && res.data) setWorkspaceTier(res.data.mode)
      })
      .catch(() => {
        /* 取数失败:保持 null,该行隐藏 */
      })
    return () => {
      cancelled = true
    }
  }, [])
  // W5:流式执行事件(工具调用 / subagent / 计划 / 终端 / 用量等)的最小可视化列表
  const [streamActivities, setStreamActivities] = useState<{ id: string; text: string }[]>([])
  const [streamActivityExpanded, setStreamActivityExpanded] = useState(true)
  const activitySeqRef = useRef(0)
  const pushStreamActivity = useCallback((text: string) => {
    activitySeqRef.current += 1
    const id = `act_${activitySeqRef.current}`
    // 仅保留最近 20 条,避免长会话列表无限增长
    setStreamActivities((prev) => [...prev, { id, text }].slice(-20))
  }, [])

  /**
   * #12 小程序 AI 增强:把 SSE 工具事件(计划 / 工具 / 终端)累积写入最后一条 assistant 消息的
   * aiCards 字段,使其随消息气泡渲染并随历史持久化;对齐 web 端 message.planSteps/toolCalls/terminalTasks。
   */
  const upsertCard = useCallback((mutate: (cards: AICardsData) => AICardsData) => {
    setMessages((prev) => {
      const idx = prev.length - 1
      if (idx < 0) return prev
      const m = prev[idx]
      if (!m || m.role !== 'assistant') return prev
      const cur: AICardsData = m.aiCards ?? {
        planSteps: [],
        toolCalls: [],
        terminalTasks: [],
        injections: [],
        citations: [],
      }
      const next = mutate(cur)
      const copy = prev.slice()
      copy[idx] = { ...m, aiCards: next }
      return copy
    })
  }, [])

  const activeAgentId = currentAgentId || routeAgentId

  // 任务进度状态条数据源:最后一条 assistant 消息的 aiCards(plan_updated / 工具事件由 upsertCard 累积写入)
  const lastAssistantCards = useMemo<AICardsData | undefined>(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i]
      if (m && m.role === 'assistant') return m.aiCards
    }
    return undefined
  }, [messages])

  const scrollToBottom = useCallback(() => {
    setTimeout(() => setScrollTop((s) => (s === 99998 ? 99999 : 99998)), 50)
  }, [])

  /** 启动思考进度定时器(对标原 ai_assistant.vue:120ms +Math.random()*1,上限 99) */
  const startThinkingProgress = useCallback(() => {
    setThinkingProgress(0)
    if (progressTimerRef.current) clearInterval(progressTimerRef.current)
    progressTimerRef.current = setInterval(() => {
      setThinkingProgress((p) => (p < 99 ? p + Math.random() * 1 : p))
    }, 120)
  }, [])

  /** 停止思考进度定时器(对标原 ai_assistant.vue:完成时设 100,然后清理) */
  const stopThinkingProgress = useCallback(() => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current)
      progressTimerRef.current = null
    }
    setThinkingProgress(100)
    setTimeout(() => setThinkingProgress(0), 500)
  }, [])

  // 组件卸载时清理定时器,避免内存泄漏
  useEffect(() => {
    return () => {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current)
        progressTimerRef.current = null
      }
    }
  }, [])

  // 首次进入页面自动弹出智能体提示说明(对标原 ai_index.vue,localStorage 标记 ai_agent_tip_shown)
  useEffect(() => {
    try {
      const shown = Taro.getStorageSync(AI_AGENT_TIP_SHOWN_KEY)
      if (!shown) setAgentTipVisible(true)
    } catch {
      // 存储读取失败忽略
    }
  }, [])

  const loadModels = useCallback(async () => {
    setModelsLoading(true)
    try {
      const res = await fetchModels()
      setModels(res?.models || [])
    } catch {
      Taro.showToast({ title: t('ai.modelLoadFailed'), icon: 'none' })
    } finally {
      setModelsLoading(false)
    }
  }, [t])

  const loadMaterials = useCallback(
    async (page = 1, append = false) => {
      setMaterialsLoading(true)
      try {
        const res = (await getAigcList({ page, pageSize: MATERIAL_PAGE_SIZE })) as {
          list?: MaterialItem[]
          total?: number
        }
        const list = res?.list || []
        const total = res?.total ?? 0
        setMaterials((prev) => (append ? [...prev, ...list] : list))
        setMaterialPage(page)
        setMaterialHasMore(page * MATERIAL_PAGE_SIZE < total)
      } catch {
        Taro.showToast({ title: t('ai.materialLoadFailed'), icon: 'none' })
      } finally {
        setMaterialsLoading(false)
      }
    },
    [t],
  )

  const handleLoadMore = useCallback(async () => {
    if (materialsLoading || !materialHasMore) return
    await loadMaterials(materialPage + 1, true)
  }, [materialsLoading, materialHasMore, materialPage, loadMaterials])

  const loadAgents = useCallback(async () => {
    setAgentsLoading(true)
    try {
      const res = await getAgentList()
      setAgents(
        (res.list || []).map((a) => ({
          id: a.id,
          name: a.name,
          description: a.desc,
          avatar: a.avatar,
          useCount: a.uses,
        })),
      )
    } catch {
      Taro.showToast({ title: t('ai.agentLoadFailed'), icon: 'none' })
    } finally {
      setAgentsLoading(false)
    }
  }, [t])

  const loadAgent = useCallback(async () => {
    if (!activeAgentId) return
    try {
      const a = await getAgentDetail(activeAgentId)
      setAgent({
        id: a.id,
        name: a.name,
        description: a.desc,
        avatar: a.avatar,
        systemPrompt: a.prompt,
        prologue: a.prologue,
      })
    } catch {
      Taro.showToast({ title: t('ai.agentLoadFailed'), icon: 'none' })
    }
  }, [activeAgentId, t])

  const captureScreenHandlerRef = useRef<(() => void) | null>(null)

  /**
   * D20 服务端会话回放(小程序端剩下的三格之一)。
   *
   * 历史页 86ef4ab06e3 起,`?sessionId=` 带的是 chat_conversations 主键;本机快照的 id
   * 形如 hist_<ts>,结构上匹配不到 ⇒ 点进去是新会话。这里在本机快照没命中时改走服务端。
   *
   * 判序与提示:
   * - 只按 routeSessionId 跑一次(replayedSessionRef)—— 页面每次 didShow 都重放会把
   *   用户正在输入的这一屏抹掉;
   * - 失败**不动消息区**(取不到就显示"没有消息"等于把故障洗成空数据),
   *   改为弹窗点名原因 + 给「重试」出口 —— 与历史页兜底条同一条 fail-closed 规矩。
   */
  const replayedSessionRef = useRef('')
  const runServerReplay = useCallback(() => {
    if (!routeSessionId || replayedSessionRef.current === routeSessionId) return
    replayedSessionRef.current = routeSessionId
    // 新会话回放前先清掉上一会话的翻页游标(防串会话前插)
    resetEarlierPaging()
    void replayServerConversation({
      fetchMessages: () => getMessages(routeSessionId, { direction: 'initial', pageSize: 100 }),
    }).then((outcome) => {
      if (outcome.ok) {
        setMessages(outcome.messages)
        // D20 留尾2:首页响应自带头部分页游标 —— hasMore=true 才亮「加载更早消息」入口
        setEarlierHasMore(outcome.hasMore)
        earlierCursorRef.current = outcome.nextCursor
        setImgsList([])
        setInputValue('')
        setSelectedMaterial(null)
        scrollToBottom()
        return
      }
      // 半个租约都比没有更危险 —— 允许下一次 didShow 重新尝试前先清掉"已试"标记
      replayedSessionRef.current = ''
      Taro.showModal({
        title: t('common.hint'),
        content: t('ai.chat.replayFailed'),
        confirmText: t('common.retry'),
        cancelText: t('common.cancel'),
        success: (res) => {
          if (res.confirm) runServerReplay()
        },
      })
    })
  }, [routeSessionId, scrollToBottom, t, resetEarlierPaging])

  /**
   * D20 留尾2:加载更早一页(向前翻)。
   *
   * - 只在服务端回放态可用:cursor 由首页响应原样带回,`hist_` 本机快照没有分页;
   * - 成功 → 前插(按 id 去重)+ 推进游标;失败 → **不清已回放内容**,toast 后入口仍在,可点重试;
   * - 刻意**不调用 scrollToBottom**:前插发生在视口上方,强制滚底会把用户的阅读位置拽走。
   *   (像素级锚点保持需要量内容高度,Taro ScrollView 无可靠测量口,本票如实不做。)
   */
  const handleLoadEarlier = useCallback(async () => {
    if (loadingEarlier || !earlierHasMore) return
    const cursor = earlierCursorRef.current
    if (!cursor || !routeSessionId || routeSessionId.startsWith('hist_')) return
    setLoadingEarlier(true)
    const outcome = await fetchEarlierPage({
      fetchMessages: () =>
        getMessages(routeSessionId, { cursor, direction: 'older', pageSize: 100 }),
    })
    setLoadingEarlier(false)
    if (!outcome.ok) {
      Taro.showToast({ title: t('ai.chat.earlierLoadFailed'), icon: 'none' })
      return
    }
    setMessages((prev) => prependEarlierMessages(prev, outcome.messages))
    earlierCursorRef.current = outcome.nextCursor
    setEarlierHasMore(outcome.hasMore)
  }, [loadingEarlier, earlierHasMore, routeSessionId, t])

  useDidHide(() => {
    try {
      if (captureScreenHandlerRef.current) {
        Taro.offUserCaptureScreen(captureScreenHandlerRef.current)
        captureScreenHandlerRef.current = null
      }
    } catch {
      // ignore
    }
  })

  useDidShow(() => {
    if (routeAgentId) loadAgent()
    Taro.showShareMenu({ withShareTicket: true })
    // P3 #46 阶段3-b 截屏理解引导(2026-09-17 立):微信平台不在截屏事件里
    // 提供截图文件,标准做法是监听动作后引导用户从相册选择发送(聊天页已
    // 支持图片选择走视觉模型链路);离开页面时解除监听防重复提示。
    try {
      captureScreenHandlerRef.current = () => {
        Taro.showToast({ title: t('ai.screenshotHint'), icon: 'none', duration: 3000 })
      }
      Taro.onUserCaptureScreen(captureScreenHandlerRef.current)
    } catch {
      // 部分平台不支持截屏监听,静默跳过
    }
    // 加载历史对话(对标原 ai_assistant.vue 加载历史)
    let restoredFromLocal = false
    try {
      const savedHistory = Taro.getStorageSync(HISTORY_STORAGE_KEY)
      if (Array.isArray(savedHistory)) {
        setChatHistories(savedHistory)
        // 带 sessionId/id 参数进入时恢复对应会话(参照 history.tsx:146 / index.tsx:207 传参格式)
        if (routeSessionId) {
          const target = (savedHistory as ChatHistoryEntry[]).find(
            (h) => h.id === routeSessionId && Array.isArray(h.messages) && h.messages.length > 0,
          )
          if (target) {
            restoredFromLocal = true
            // D106 收尾:历史恢复时从 metadata.steerApplied 重建 aiCards.steerNotices
            // (live 已写的不覆盖;无 metadata 不写空数组,不渲染空态)
            setMessages(backfillSteerNoticesFromMetadata(target.messages))
            setSessionId('')
            // 本机快照没有服务端分页,旧会话游标必须清掉
            resetEarlierPaging()
            setImgsList([])
            setInputValue('')
            setSelectedMaterial(null)
            scrollToBottom()
          }
        }
      }
    } catch {
      // 存储读取失败忽略
    }
    // D20:本机快照没命中 ⇒ 走服务端回放。`hist_` 前缀是本文件写入快照时自造的 id 命名空间
    // (见 clearChat 的 `hist_${Date.now()}`),它不是 chat_conversations 主键 —— 拿它去问
    // 服务端必 404,那种失败不该弹给用户看。
    if (routeSessionId && !restoredFromLocal && !routeSessionId.startsWith('hist_')) {
      runServerReplay()
    }
    // 加载收藏消息(对标原 ai_assistant.vue 收藏列表)
    try {
      const savedFav = Taro.getStorageSync(FAVORITE_STORAGE_KEY)
      if (Array.isArray(savedFav)) setFavoritedMsgs(new Set(savedFav))
    } catch {
      // 存储读取失败忽略
    }
  })

  useShareAppMessage(() => ({
    // 若有待分享消息(长按消息→分享),用消息内容前 50 字符作为 title(对标原 ai_assistant.vue 分享)
    title: shareMsgRef.current
      ? (shareMsgRef.current.content || '').slice(0, 50) || t('ai.share.title')
      : t('ai.share.title'),
    path: '/pkg-ai/ai/chat',
  }))

  /**
   * 语义匹配:识别用户是否在请求「图片 / 语音 / 视频」类任务,命中后引导跳转对应 AIGC 页面。
   * 注意:下方三个正则中的中文属于「用户输入语义匹配」逻辑,并非 UI 展示文案,
   * 因此刻意不做 i18n;若替换为翻译文本会导致中文提问匹配失效。
   */
  const checkSpecialModel = useCallback(
    (text: string): boolean => {
      if (/画|生成图|画图|绘图|画一个|画张|画幅/.test(text)) {
        Taro.showModal({
          title: t('ai.specialModel.hint'),
          content: t('ai.specialModel.confirm'),
          success: (res) => {
            if (res.confirm) {
              Taro.navigateTo({ url: '/pkg-ai/ai/image?prompt=' + encodeURIComponent(text) })
            }
          },
        })
        return true
      }
      if (/语音|朗读|说一段|读一段|播报/.test(text)) {
        Taro.showModal({
          title: t('ai.specialModel.hint'),
          content: t('ai.specialModel.confirm'),
          success: (res) => {
            if (res.confirm) {
              Taro.navigateTo({ url: '/pkg-ai/ai/voice?text=' + encodeURIComponent(text) })
            }
          },
        })
        return true
      }
      if (/生成视频|做个视频|视频生成/.test(text)) {
        Taro.showModal({
          title: t('ai.specialModel.hint'),
          content: t('ai.specialModel.confirm'),
          success: (res) => {
            if (res.confirm) {
              Taro.navigateTo({ url: '/pkg-ai/ai/video?prompt=' + encodeURIComponent(text) })
            }
          },
        })
        return true
      }
      return false
    },
    [t],
  )

  const sendMessage = useCallback(
    async (overrideText?: string, baseHistory?: readonly ChatMessage[]) => {
      const text = (overrideText ?? '').trim()
      if (!text || thinking) return
      if (checkSpecialModel(text)) return
      const userMsg: ChatMessage = { role: 'user', content: text, timestamp: Date.now() }
      const assistantMsg: ChatMessage = { role: 'assistant', content: '', timestamp: Date.now() }
      // 失败轮不进下一轮上下文(与 web send-message.ts 同规则):否则"请求出错"那句会被
      // 模型当成自己上一轮的回答读进去。baseHistory 供"重发"显式截到上一次提问之前 ——
      // 闭包里的 messages 是点击那一轮的旧值,不截断会把同一个问题带两遍。
      const history: ChatMessage[] = [
        ...(baseHistory ?? messages).filter((m) => !isErrorTurn(m)),
        userMsg,
      ]
      setMessages(
        baseHistory ? [...history, assistantMsg] : (prev) => [...prev, userMsg, assistantMsg],
      )
      setThinking(true)
      // W5:新一轮对话开始,清空上一轮的执行过程列表
      setStreamActivities([])
      startThinkingProgress()
      scrollToBottom()
      const controller = new AbortController()
      abortRef.current = controller
      try {
        await chatStream(
          history,
          sessionId,
          {
            model: currentModel || undefined,
            agentId: activeAgentId || undefined,
            materialContent: selectedMaterial?.content || undefined,
            // 跨端统一 88% 阈值自动压缩:从模型 ID 推断 contextLimit,后端压缩后通过 SSE 回调提示用户
            contextLimit: currentModel ? getModelContextCapacity(currentModel) : 0,
          },
          (delta) => {
            setMessages((prev) =>
              prev.map((m, i) =>
                i === prev.length - 1 ? { ...m, content: m.content + delta } : m,
              ),
            )
            scrollToBottom()
          },
          (reasoningDelta) => {
            setMessages((prev) =>
              prev.map((m, i) =>
                i === prev.length - 1
                  ? { ...m, reasoning: (m.reasoning || '') + reasoningDelta }
                  : m,
              ),
            )
          },
          (meta) => {
            if (meta.sessionId) setSessionId(meta.sessionId)
          },
          controller.signal,
          (info) => {
            // 后端自动压缩完成,toast 提示用户(对标 CLI /compact 命令的可见性)
            // W5:i18n 化,文案与参数映射见 ai.stream.compact
            Taro.showToast({
              title: t('ai.stream.compact', {
                before: formatTokenCount(info.tokensBefore),
                after: formatTokenCount(info.tokensAfter),
              }),
              icon: 'none',
              duration: 2500,
            })
          },
          // done 回调:把 ai-service event:done 下发的 usage.total_tokens 写入最后一条 assistant 消息
          // 对标原 ai_assistant.vue obj.total_tokens → this.$set(agent_content_list[idx], 'total_tokens', obj.total_tokens)
          (doneInfo) => {
            if (typeof doneInfo.totalTokens === 'number') {
              setMessages((prev) =>
                prev.map((m, i) =>
                  i === prev.length - 1 && m.role === 'assistant'
                    ? { ...m, tokenCount: doneInfo.totalTokens! }
                    : m,
                ),
              )
            }
          },
          // W5:新增流式事件回调(第 10 个参数),为 tool-call / subagent / 计划 / 终端 /
          // fallback / usage / 断线重连等事件提供最小可用渲染(统一压入执行过程列表)
          {
            onToolCallStart: (evt) => {
              const startedAt = Date.now()
              upsertCard((c) => ({
                ...c,
                toolCalls: [
                  ...c.toolCalls.filter((x) => x.id !== evt.toolCallId),
                  {
                    id: evt.toolCallId,
                    name: evt.toolName,
                    status: 'running',
                    serverSource: evt.serverSource,
                    // D83:MCP server 名一并落卡,措辞层按 server×tool 查定制表
                    serverName: evt.serverName ?? evt.serverId,
                    // 入参一并落卡:共享层 describeToolCall 靠它取"对象"
                    args: evt.args,
                    startedAt,
                  },
                ],
              }))
              pushStreamActivity(
                toolActivityText(
                  {
                    id: evt.toolCallId,
                    name: evt.toolName,
                    status: 'running',
                    serverSource: evt.serverSource,
                    serverName: evt.serverName ?? evt.serverId,
                    args: evt.args,
                  },
                  t,
                ),
              )
            },
            onToolResult: (evt) => {
              // result / isError 只存在于 tool-result 变体,先收窄再取(另一变体不给结果)
              const resultEvent = evt.type === 'tool-result' ? evt : null
              const isError = resultEvent?.isError === true
              const status = isError ? 'error' : 'done'
              upsertCard((c) => ({
                ...c,
                toolCalls: c.toolCalls.map((x) =>
                  x.id === evt.toolCallId
                    ? {
                        ...x,
                        status,
                        // result 是结果度量(行数 / 命中数)与写类工具 ± 行数的唯一数据源
                        args: evt.args ?? x.args,
                        result: resultEvent?.result ?? x.result,
                        isError,
                        durationMs:
                          typeof x.startedAt === 'number' ? Date.now() - x.startedAt : x.durationMs,
                      }
                    : x,
                ),
              }))
              pushStreamActivity(
                toolActivityText(
                  {
                    id: evt.toolCallId,
                    name: evt.toolName,
                    status,
                    serverSource: evt.serverSource,
                    serverName: evt.serverName ?? evt.serverId,
                    args: evt.args,
                    result: resultEvent?.result,
                  },
                  t,
                  { withMetric: true },
                ),
              )
            },
            onSubagentSpawn: (evt) =>
              pushStreamActivity(t('ai.stream.subagent', { phase: evt.role })),
            onSubagentProgress: (evt) =>
              pushStreamActivity(t('ai.stream.subagent', { phase: evt.phase })),
            onSubagentEnd: (evt) =>
              pushStreamActivity(t('ai.stream.subagent', { phase: evt.status })),
            onToolSummary: (evt) =>
              pushStreamActivity(t('ai.stream.toolSummary', { calls: evt.totalCalls })),
            onToolDelegate: (evt) =>
              pushStreamActivity(
                toolActivityText(
                  { id: '', name: evt.tool_name, status: 'running', args: evt.args },
                  t,
                ),
              ),
            onPlanUpdate: (evt) => {
              upsertCard((c) => ({
                ...c,
                // plan 为权威快照,整体替换(对齐 web 端 message.planSteps 写入方式)
                planSteps: (evt.plan ?? []).map((p, i) => ({
                  id: String(i),
                  step: p.step,
                  status: p.status,
                  explanation: evt.explanation,
                  durationMs: p.durationMs,
                  error: false,
                })),
              }))
              pushStreamActivity(t('ai.stream.planUpdate'))
            },
            onTerminalStart: (evt) => {
              upsertCard((c) => ({
                ...c,
                terminalTasks: [
                  ...c.terminalTasks.filter((x) => x.id !== evt.terminalId),
                  { id: evt.terminalId, command: evt.command, status: 'running' },
                ],
              }))
              pushStreamActivity(t('ai.stream.terminal', { status: evt.command }))
            },
            // D19(本票):terminal_delta 实时增量 —— 共享 parser(D19-A1)早已产出该帧,
            // 端内 dispatch 此前无分支 = 静默丢帧,这是本票补的接线。累加到 running 任务的
            // output(上限与 web 同值 20000 字符,超限保尾部);start 帧缺失时按帧内 command
            // 自建任务(载荷自带 terminalId+command,帧自洽)。
            onTerminalDelta: (evt) => {
              if (!evt.terminalId || !evt.text) return
              upsertCard((c) => ({
                ...c,
                terminalTasks: appendTerminalDelta(c.terminalTasks, evt),
              }))
            },
            onTerminalEnd: (evt) => {
              upsertCard((c) => ({
                ...c,
                terminalTasks: c.terminalTasks.map((x) =>
                  x.id === evt.terminalId
                    ? {
                        ...x,
                        status: evt.status,
                        // terminal_end 的 output 是权威快照整体替换;但 D19 起 running 期
                        // 已有实时累加的 output,终帧缺 output 时不得清空它(否则等于丢增量)。
                        output: evt.output ?? x.output,
                        // 截断交代必须一起承接:小程序没有 live 输出缓冲,只能靠这两个字段
                        truncated: evt.truncated ?? x.truncated,
                        totalChars: evt.totalChars ?? x.totalChars,
                        exitCode: evt.exitCode,
                        durationMs: evt.durationMs,
                      }
                    : x,
                ),
              }))
              pushStreamActivity(t('ai.stream.terminal', { status: evt.status }))
            },
            // D34/D39 第 45 轮:交代帧进 aiCards(随历史持久化)。injections 在旧历史里不存在,
            // 类型上必填但运行时可能为 undefined,故保留 ?? [] 兜底。
            // #11 引用溯源(第 49 轮):parser 与回调表都给了通道,端内不注册 = 静默丢帧
            onCitations: (evt) =>
              upsertCard((c) => ({
                ...c,
                citations: appendCitations(
                  c.citations,
                  evt.citations.map((x) => ({ source: x.source, label: x.label })),
                ),
              })),
            onInjectionApplied: (evt) =>
              upsertCard((c) => {
                const items = c.injections ?? []
                if (items.some((x) => x.kind === evt.kind && x.collapsed === evt.collapsed)) {
                  return { ...c, injections: items }
                }
                return {
                  ...c,
                  injections: [
                    ...items,
                    {
                      kind: evt.kind,
                      collapsed: evt.collapsed,
                      fullText: evt.fullText,
                      count: evt.count,
                    },
                  ],
                }
              }),
            // D106 Steer(中途引导):交代帧进 aiCards.steerNotices(随历史持久化)。
            // 空文本在 toSteerNotice 拦截(不渲染空提示);上限 8 条对齐后端 _STEER_QUEUE_LIMIT。
            onSteer: (evt) => {
              const notice = toSteerNotice(evt)
              if (!notice) return
              upsertCard((c) => ({
                ...c,
                steerNotices: appendSteerNotice(c.steerNotices, notice),
              }))
            },
            onRetryScheduled: (evt) =>
              pushStreamActivity(
                t('ai.stream.gatewayRetry', {
                  attempt: evt.attempt,
                  max: evt.maxRetries,
                  seconds: Math.max(1, Math.round(evt.retryInMs / 1000)),
                }),
              ),
            onFallback: (evt) =>
              pushStreamActivity(t('ai.stream.fallback', { model: evt.backupModel })),
            onUsage: (info) => {
              if (typeof info.totalTokens === 'number') {
                pushStreamActivity(t('ai.stream.usage', { n: info.totalTokens }))
              }
            },
            onReconnect: (attempt, delayMs) =>
              pushStreamActivity(
                t('ai.stream.reconnect', { attempt, seconds: Math.round(delayMs / 1000) }),
              ),
          },
        )
      } catch (e) {
        if ((e as Error)?.name !== 'AbortError') {
          const formatted = formatSSEError(e, t('ai.serviceUnavailable') || 'AI 服务异常')
          // 失败轮要"可辨认":标 error + 保留已产出的部分内容(共享层同一标记规则,与 web 端一致)
          setMessages((prev) => applyStreamError(prev, formatted.message))
          Taro.showToast({ title: formatted.title, icon: 'none', duration: 2500 })
        }
      } finally {
        abortRef.current = null
        setThinking(false)
        stopThinkingProgress()
        scrollToBottom()
      }
    },
    [
      thinking,
      sessionId,
      messages,
      scrollToBottom,
      startThinkingProgress,
      stopThinkingProgress,
      currentModel,
      activeAgentId,
      selectedMaterial,
      t,
      checkSpecialModel,
      pushStreamActivity,
      upsertCard,
    ],
  )

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort()
    stopThinkingProgress()
  }, [stopThinkingProgress])

  const handleSuggestion = useCallback(
    (text: string) => {
      sendMessage(text)
    },
    [sendMessage],
  )

  const clearChat = useCallback(() => {
    Taro.showModal({
      title: t('common.hint'),
      content: t('ai.clearConfirm'),
      success: (res) => {
        if (res.confirm) {
          // 清空前把当前对话存入历史(对标原 ai_assistant.vue 存历史)
          // 失败轮不是内容:排除后再存,否则错误文案会被当回答持久化并出现在历史预览里
          const contentMsgs = messages.filter((m) => !isErrorTurn(m))
          if (contentMsgs.length > 0) {
            const firstUserMsg = contentMsgs.find((m) => m.role === 'user')
            const lastMsg = contentMsgs[contentMsgs.length - 1]
            const title = (firstUserMsg?.content || '').slice(0, 20) || t('ai.history.title')
            const preview = (lastMsg?.content || '').slice(0, 30)
            const entry: ChatHistoryEntry = {
              id: `hist_${Date.now()}`,
              title,
              preview,
              timestamp: Date.now(),
              messages: [...contentMsgs],
            }
            setChatHistories((prev) => {
              const next = [entry, ...prev].slice(0, MAX_HISTORY_COUNT)
              try {
                Taro.setStorageSync(HISTORY_STORAGE_KEY, next)
              } catch {
                // 存储写入失败忽略
              }
              return next
            })
          }
          setMessages([])
          setSessionId('')
          resetEarlierPaging()
        }
      },
    })
  }, [t, messages, resetEarlierPaging])

  const selectModel = useCallback((m: ModelItem) => {
    setCurrentModel(m.id)
    setCurrentModelName(m.name)
    setModelDrawerVisible(false)
  }, [])

  const selectMaterial = useCallback((m: MaterialItem) => {
    setSelectedMaterial(m)
    setMaterialDrawerVisible(false)
  }, [])

  const selectSkill = useCallback(
    (a: AgentItem) => {
      if (messages.length > 0 && a.id !== activeAgentId) {
        Taro.showModal({
          title: t('common.hint'),
          content: t('ai.switchAgent.confirm'),
          success: (res) => {
            if (!res.confirm) return
            setMessages([])
            setSessionId('')
            resetEarlierPaging()
            setCurrentAgentId(a.id)
            setSkillsPopupVisible(false)
            setAgent({
              id: a.id,
              name: a.name,
              description: a.description || '',
              avatar: a.avatar,
              systemPrompt: '',
            })
            loadAgent()
          },
        })
        return
      }
      setCurrentAgentId(a.id)
      setSkillsPopupVisible(false)
      setAgent({
        id: a.id,
        name: a.name,
        description: a.description || '',
        avatar: a.avatar,
        systemPrompt: '',
      })
      loadAgent()
    },
    [loadAgent, messages.length, activeAgentId, t, resetEarlierPaging],
  )

  const openSkillsPopup = useCallback(() => {
    setSkillsPopupVisible(true)
    if (!agents.length) loadAgents()
  }, [agents.length, loadAgents])

  const handleUpload = useCallback(
    (files: string[]) => {
      const newItems: InputFileItem[] = files.map((filePath) => {
        // 根据扩展名判断文件类型
        const ext = filePath.split('.').pop()?.toLowerCase() || ''
        if (['mp4', 'mov', 'avi', 'mkv'].includes(ext)) {
          return { imgUrl: filePath, fileType: 'video', video_url: filePath }
        }
        if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'].includes(ext)) {
          const filename = filePath.split('/').pop() || filePath
          return { imgUrl: filePath, fileType: 'document', filename }
        }
        return { imgUrl: filePath, fileType: 'image' }
      })
      setImgsList((prev) => [...prev, ...newItems])
      Taro.showToast({ title: t('ai.fileSelected', { count: files.length }), icon: 'none' })
    },
    [t],
  )

  const handleRemoveImage = useCallback((index: number) => {
    setImgsList((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const handleVoicePress = useCallback(() => {
    Taro.vibrateShort({ type: 'light' })
  }, [])

  const handleVoiceRelease = useCallback(
    (filePath: string) => {
      if (!filePath) return
      // 简化版:直接用本地路径发送(生产环境应上传服务器获取 URL)
      // sendMessage 当前签名只接受 text 参数,附带 filePath 信息发送
      sendMessage(`[voice]${filePath}`)
    },
    [sendMessage],
  )

  const handleMaterialUpload = useCallback(
    (tab: MaterialTab) => {
      Taro.showToast({ title: t('ai.uploadMaterialTab', { tab }), icon: 'none' })
    },
    [t],
  )

  /** 复用问题到输入框(对标原 ai_assistant.vue copyToInput) */
  const handleReuse = useCallback((question: string) => {
    if (!question) return
    setInputValue(question)
    Taro.pageScrollTo({ scrollTop: 100000, duration: 300 })
  }, [])

  const handleRecharge = useCallback(() => {
    Taro.navigateTo({ url: '/pkg-shop/wallet/recharge/index' })
  }, [])

  /** TTS 朗读(对标原 ai_assistant.vue 朗读,简化实现:跳转 voice 页传 text 参数) */
  const handleSpeak = useCallback((content: string) => {
    if (!content) return
    Taro.navigateTo({ url: '/pkg-ai/ai/voice?text=' + encodeURIComponent(content) })
  }, [])

  const handleRegenerate = useCallback(() => {
    const lastUserIdx = messages.map((m) => m.role).lastIndexOf('user')
    const text = resendTargetText(messages)
    if (lastUserIdx < 0 || !text) return
    // 把截断后的历史显式交给 sendMessage:它闭包里的 messages 是"点击那一轮"的旧值,
    // 只 setMessages 截断再延时重发,旧值里那条 user 会和重发的 userMsg 一起带进上下文(问题发两遍)
    const base = messages.slice(0, lastUserIdx)
    setMessages(base)
    void sendMessage(text, base)
  }, [messages, sendMessage])

  const handleLongPress = useCallback(
    (msg: ChatMessage, idx: number) => {
      // 失败轮不给"分享"(它不是内容),复制保留 —— 报错排查要用那段文字
      const failed = isErrorTurn(msg)
      const actions: { label: string; run: () => void }[] = []
      actions.push({
        label: t('ai.messageAction.copy'),
        run: () => Taro.setClipboardData({ data: msg.content }),
      })
      if (msg.role === 'user') {
        actions.push({ label: t('ai.messageAction.reuse'), run: () => handleReuse(msg.content) })
      }
      actions.push({
        label: t('ai.messageAction.delete'),
        run: () => setMessages((prev) => prev.filter((_, i) => i !== idx)),
      })
      if (!failed) {
        actions.push({
          label: t('ai.chatMessageItem.share'),
          run: () => {
            // 分享对话(对标原 ai_assistant.vue 分享):存入待分享消息,显示分享菜单,用户点右上角···分享
            shareMsgRef.current = msg
            Taro.showShareMenu({ withShareTicket: true })
            Taro.showToast({ title: t('ai.chatMessageItem.share'), icon: 'none' })
          },
        })
      }
      if (failed) {
        actions.unshift({ label: t('ai.chatMessageItem.retry'), run: handleRegenerate })
      }
      Taro.showActionSheet({
        itemList: actions.map((a) => a.label),
        success: (res) => actions[res.tapIndex]?.run(),
      })
    },
    [t, handleReuse, handleRegenerate],
  )

  const handleEdit = useCallback((msg: ChatMessage, idx: number) => {
    if (msg.role !== 'user') return
    setInputValue(msg.content)
    setMessages((prev) => prev.slice(0, idx))
    Taro.pageScrollTo({ scrollTop: 100000, duration: 300 })
  }, [])

  /** 恢复选中的历史对话(对标原 ai_assistant.vue 恢复历史)
   *  恢复时清空当前输入态(附件/输入框/选中素材),开始新对话上下文 */
  const handleSelectHistory = useCallback(
    (h: ChatHistoryEntry) => {
      // D106 收尾:同上,历史恢复链路统一走 metadata.steerApplied 读回
      setMessages(backfillSteerNoticesFromMetadata(h.messages || []))
      setSessionId('')
      // 本机快照没有服务端分页,旧会话游标必须清掉
      resetEarlierPaging()
      setImgsList([])
      setInputValue('')
      setSelectedMaterial(null)
      setHistoryDrawerVisible(false)
      scrollToBottom()
    },
    [scrollToBottom, resetEarlierPaging],
  )

  /** 清空所有历史对话(对标原 ai_assistant.vue clearHistory) */
  const handleClearHistory = useCallback(() => {
    setChatHistories([])
    try {
      Taro.removeStorageSync(HISTORY_STORAGE_KEY)
    } catch {
      // 存储删除失败忽略
    }
  }, [])

  /** 切换收藏状态(对标原 ai_assistant.vue toggleFavorite,持久化到本地) */
  const toggleFavorite = useCallback(
    (msg: ChatMessage) => {
      if (!msg.timestamp) return
      const id = String(msg.timestamp)
      setFavoritedMsgs((prev) => {
        const next = new Set(prev)
        if (next.has(id)) {
          next.delete(id)
        } else {
          next.add(id)
          Taro.showToast({ title: t('ai.chatMessageItem.favorited'), icon: 'none' })
        }
        try {
          Taro.setStorageSync(FAVORITE_STORAGE_KEY, Array.from(next))
        } catch {
          // 存储写入失败忽略
        }
        return next
      })
    },
    [t],
  )

  const openModelDrawer = useCallback(() => {
    setModelDrawerVisible(true)
    if (!models.length) loadModels()
  }, [models.length, loadModels])

  const openMaterialDrawer = useCallback(() => {
    setMaterialDrawerVisible(true)
    if (!materials.length) loadMaterials()
  }, [materials.length, loadMaterials])

  /** 关闭智能体提示说明弹窗(对标原 ai_index.vue,关闭后设置 localStorage 标记 ai_agent_tip_shown=1) */
  const closeAgentTip = useCallback(() => {
    setAgentTipVisible(false)
    try {
      Taro.setStorageSync('ai_agent_tip_shown', '1')
    } catch {
      // 存储写入失败忽略
    }
  }, [])

  // D111:权限档行文案(档名 + 后果,缺键用端内中文兜底,不渲染 raw key)。
  const tierText = resolvePermissionTierText(workspaceTier, tt)

  return (
    <ThemeRoot className="page">
      <View
        className="nav-bar safe-area-bottom"
        style={{ background: 'transparent', display: navBarHidden ? 'none' : 'flex' }}
      >
        <View className="nav-left" onClick={openModelDrawer} hoverClass="opacity-60">
          <Text className="nav-title">{currentModelName || t('ai.title')}</Text>
          <LineIcon
            name="chevron-down"
            size={24}
            color="var(--color-muted-foreground)"
            className="nav-arrow"
          />
        </View>
        <View className="nav-right">
          {agent ? (
            <Text className="nav-agent" onClick={() => setAgentDrawerVisible(true)}>
              {agent.name}
            </Text>
          ) : null}
          <Text
            className="nav-history"
            style={{ fontSize: '30rpx', fontWeight: '600' }}
            onClick={() => setAgentTipVisible(true)}
          >
            ?
          </Text>
          <Image
            src={fileIcon}
            className="nav-history w-[30rpx] h-[30rpx]"
            mode="aspectFit"
            onClick={() => setHistoryDrawerVisible(true)}
          />
          {messages.length ? (
            <Text className="nav-clear" onClick={clearChat}>
              {t('ai.clear')}
            </Text>
          ) : null}
        </View>
      </View>

      {/* D111:权限档交代行(取数失败整行隐藏,不假装知道档位;缺键用端内中文兜底) */}
      {workspaceTier !== null ? (
        <View className="permission-tier" style={{ padding: '8rpx 24rpx' }}>
          <Text style={{ fontSize: '22rpx', color: 'var(--color-muted-foreground)' }}>
            {tierText.label}: {tierText.title} · {tierText.desc}
          </Text>
        </View>
      ) : null}

      {/* 上下文占用归因条(消费共享引擎,tailPreview 语义与 web 端一致) */}
      {messages.length ? (
        <ContextUsageStrip
          messages={messages}
          maxTokens={currentModel ? getModelContextCapacity(currentModel) : 0}
        />
      ) : null}

      <ScrollView className="msg-list" scrollY scrollTop={scrollTop} scrollWithAnimation>
        {/* D20 留尾2:加载更早消息入口(仅服务端回放且首页 hasMore=true 时出现;
            失败不清已回放内容,入口保留可重试;前插后不强制滚底,不拽走阅读位置) */}
        {earlierHasMore ? (
          <View className="load-earlier" onClick={handleLoadEarlier} hoverClass="opacity-60">
            <Text className="load-earlier-text">
              {loadingEarlier ? t('ai.chat.earlierLoading') : t('ai.chat.loadEarlier')}
            </Text>
          </View>
        ) : null}
        {/* 智能体引导说明(对标原 ai_assistant.vue tishi_block + tishi_box,仅选中智能体时显示) */}
        {agent ? (
          <View
            className="tishi-block"
            onClick={() => setTishiShow((v) => !v)}
            hoverClass="opacity-60"
          >
            {tishiShow ? (
              <LineIcon
                name="x"
                size={28}
                color="var(--color-muted-foreground)"
                className="tishi-block-icon"
              />
            ) : (
              <Image
                src={tishiIcon}
                className="tishi-block-icon w-[28rpx] h-[28rpx]"
                mode="aspectFit"
              />
            )}
            <Text className="tishi-block-text">
              {tishiShow ? t('ai.tishi.close') : t('ai.tishi.view')} {t('ai.tishi.title')}
            </Text>
          </View>
        ) : null}
        {agent && tishiShow && agent.prologue ? (
          <View className="tishi-box">
            <View className="tishi-title">
              <Image
                src={recordBackIcon}
                className="tishi-title-icon w-[32rpx] h-[32rpx]"
                mode="aspectFit"
              />
              <Text className="tishi-title-text">{t('ai.tishi.needInput')}</Text>
            </View>
            <View className="tishi-content">
              {/* 对标原 v-html tishi_content,prologue 中的 \n 替换为换行展示 */}
              {agent.prologue
                .replace(/\\n/g, '\n')
                .replace(/<br\s*\/?>/g, '\n')
                .split('\n')
                .map((line, i) => (
                  <Text key={i} className="tishi-content-line">
                    {line}
                    {'\n'}
                  </Text>
                ))}
            </View>
          </View>
        ) : null}

        {!messages.length ? (
          <View className="welcome">
            <Text className="welcome-title">{t('ai.welcomeTitle')}</Text>
            <Text className="welcome-desc">{t('ai.welcomeDesc')}</Text>
            {!agent ? (
              <IntelligentAssistant
                tokenBalance={(user as Record<string, unknown>)?.tokenBalance as number | undefined}
                isLoggedIn={!!user}
                onRecharge={handleRecharge}
              />
            ) : null}
            <View className="suggest-list">
              {suggestions.map((s, i) => (
                <View
                  key={i}
                  className="suggest-item"
                  onClick={() => handleSuggestion(s)}
                  hoverClass="opacity-60"
                >
                  <Text>{s}</Text>
                </View>
              ))}
            </View>
            <Text className="welcome-tip">{t('ai.thinkingTip')}</Text>
          </View>
        ) : null}

        {messages.map((msg, idx) => (
          <ChatMessageItem
            key={idx}
            msg={msg}
            onReuse={handleReuse}
            onRegenerate={msg.role === 'assistant' ? handleRegenerate : undefined}
            onLongPress={() => handleLongPress(msg, idx)}
            onEdit={msg.role === 'user' ? () => handleEdit(msg, idx) : undefined}
            isFavorited={
              msg.role === 'assistant' && !msg.error && msg.timestamp
                ? favoritedMsgs.has(String(msg.timestamp))
                : undefined
            }
            onToggleFavorite={
              msg.role === 'assistant' && !msg.error && msg.timestamp
                ? () => toggleFavorite(msg)
                : undefined
            }
            onSpeak={msg.role === 'assistant' && !msg.error ? handleSpeak : undefined}
            onOpenReasoning={
              msg.role === 'assistant' && msg.reasoning
                ? () => {
                    setReasoningPopupContent(msg.reasoning || '')
                    setReasoningPopupVisible(true)
                  }
                : undefined
            }
          />
        ))}

        {/* W5:流式执行事件最小可视化(工具调用 / subagent / 计划 / 终端等),简化列表 + 可折叠 */}
        {streamActivities.length > 0 ? (
          <View className="msg-item assistant">
            <View className="avatar assistant">{t('ai.chatMessageItem.ai')}</View>
            <View className="bubble">
              <Text
                className="bubble-text"
                style={{ fontSize: '24rpx', color: 'var(--color-muted-foreground)' }}
                onClick={() => setStreamActivityExpanded((v) => !v)}
              >
                {t('ai.stream.title')} ({streamActivities.length}){' '}
                {streamActivityExpanded ? t('ai.chatMessageItem.collapse') : t('ai.tishi.view')}
              </Text>
              {streamActivityExpanded ? (
                <View style={{ marginTop: '8rpx' }}>
                  {streamActivities.map((a) => (
                    <Text
                      key={a.id}
                      className="bubble-text"
                      style={{ display: 'block', fontSize: '22rpx', lineHeight: '1.6' }}
                    >
                      · {a.text}
                    </Text>
                  ))}
                </View>
              ) : null}
            </View>
          </View>
        ) : null}

        {thinking && messages[messages.length - 1]?.role === 'assistant' ? (
          <View className="msg-item assistant">
            <View className="avatar assistant">{t('ai.chatMessageItem.ai')}</View>
            <View className="bubble">
              <Text className="bubble-text">{t('ai.generating')}</Text>
              <Text
                className="bubble-text"
                style={{ fontSize: '22rpx', color: 'var(--color-muted-foreground)' }}
              >
                {t('ai.thinking')}
              </Text>
              {/* 思考进度条(对标原 ai_assistant.vue thinking-progress-container) */}
              <View
                className="thinking-progress-container"
                style={{ position: 'relative', marginTop: '8rpx', height: '36rpx' }}
              >
                <View
                  className="thinking-progress-bar"
                  style={{
                    width: `${Math.floor(thinkingProgress)}%`,
                    height: '100%',
                    background: 'var(--color-primary)',
                    borderRadius: rnRadius.xs,
                    transition: 'width 120ms linear',
                  }}
                />
                <Text
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: '0',
                    lineHeight: '36rpx',
                    transform: 'translateX(-50%)',
                    color: 'var(--color-foreground)',
                    fontSize: '24rpx',
                  }}
                >
                  {Math.floor(thinkingProgress)}%
                </Text>
              </View>
            </View>
          </View>
        ) : null}
      </ScrollView>

      {selectedMaterial ? (
        <View className="material-tag">
          <Text className="material-tag-text">{selectedMaterial.title}</Text>
          <LineIcon
            name="x"
            size={32}
            color="var(--color-muted-foreground)"
            className="material-tag-close"
            onClick={() => setSelectedMaterial(null)}
          />
        </View>
      ) : null}

      {/* 快捷按钮区(对标原 ai_assistant.vue .quick-actions-container,suggestedQuestions 横向滚动)
          仅无消息或当前 Agent 提供 suggestedQuestions 时显示 */}
      {messages.length === 0 && suggestions.length > 0 ? (
        <View className="quick-actions-container">
          <ScrollView scrollX showScrollbar={false} className="quick-actions-scroll">
            <View className="quick-actions-wrapper">
              {suggestions.map((q, i) => (
                <View
                  key={`qa-${i}`}
                  className="quick-action-btn"
                  onClick={() => handleSuggestion(q)}
                  hoverClass="opacity-60"
                >
                  <Text>{q}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      ) : null}

      {/* 任务进度状态条(plan_updated 驱动;共享派生层返回 null 时整体不挂载,零占位) */}
      <TaskStatusBar cards={lastAssistantCards} isStreaming={thinking} />

      <View className="input-box-content safe-area-bottom">
        <View className="tool-icons">
          <Image
            src={floderInputIcon}
            className="tool-icon w-[40rpx] h-[40rpx]"
            mode="aspectFit"
            onClick={openMaterialDrawer}
          />
          <LineIcon
            name="brain"
            size={40}
            color="var(--color-muted-foreground)"
            className="tool-icon w-[40rpx] h-[40rpx]"
            onClick={openSkillsPopup}
          />
        </View>
        <InputArea
          variant="ai-home"
          value={inputValue}
          onInput={(text) => setInputValue(text)}
          placeholder={t('ai.inputPlaceholder')}
          disabled={thinking}
          imgsList={imgsList}
          onSend={(text) => sendMessage(text)}
          onUpload={handleUpload}
          onRemoveImage={handleRemoveImage}
          onVoicePress={handleVoicePress}
          onVoiceRelease={handleVoiceRelease}
          onFangdaChange={(active) => setNavBarHidden(active)}
          onKeyboardHeightChange={(h) => {
            if (h > 0) {
              // 键盘弹起时滚动到底部
              setTimeout(() => scrollToBottom(), 100)
            }
          }}
        />
        {thinking ? (
          <View className="send-btn" onClick={stopGeneration} hoverClass="opacity-60">
            <Text>{t('ai.stop')}</Text>
          </View>
        ) : null}
      </View>

      <ModelDrawer
        visible={modelDrawerVisible}
        onClose={() => setModelDrawerVisible(false)}
        models={models}
        selectedId={currentModel}
        loading={modelsLoading}
        onSelect={selectModel}
      />
      <MaterialPopup
        visible={materialDrawerVisible}
        tab={materialTab}
        items={materials.map((m) => ({
          id: m.id,
          title: m.title,
          thumbnail: m.coverUrl,
          content: m.content,
          createdAt: m.createdAt,
          tab: materialTab,
        }))}
        loading={materialsLoading}
        hasMore={materialHasMore}
        selectedId={selectedMaterial?.id}
        onTabChange={setMaterialTab}
        onSelect={(item) =>
          selectMaterial({
            id: item.id,
            title: item.title,
            coverUrl: item.thumbnail,
            content: item.content,
            createdAt: item.createdAt,
          })
        }
        onClose={() => setMaterialDrawerVisible(false)}
        onUpload={handleMaterialUpload}
        onLoadMore={handleLoadMore}
      />
      <SkillsPopup
        visible={skillsPopupVisible}
        agents={agents}
        loading={agentsLoading}
        selectedId={activeAgentId}
        onSelect={selectSkill}
        onClose={() => setSkillsPopupVisible(false)}
      />
      <AgentDrawer
        visible={agentDrawerVisible}
        onClose={() => setAgentDrawerVisible(false)}
        agent={agent}
      />
      <HistoryDrawer
        visible={historyDrawerVisible}
        onClose={() => setHistoryDrawerVisible(false)}
        histories={chatHistories}
        onSelect={handleSelectHistory}
        onClear={handleClearHistory}
      />
      <AgentTipDialog visible={agentTipVisible} onClose={closeAgentTip} />
      {reasoningPopupVisible ? (
        <View
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'var(--color-black-50)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => setReasoningPopupVisible(false)}
          hoverClass="opacity-60"
        >
          <View
            style={{
              width: 'calc(100% - 80rpx)',
              maxHeight: '50vh',
              background: 'var(--color-card)',
              borderRadius: rnRadius.lg,
              padding: '20rpx',
              overflow: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
            hoverClass="opacity-60"
          >
            <View
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12rpx',
              }}
            >
              <Text
                style={{ fontSize: '28rpx', fontWeight: '600', color: 'var(--color-foreground)' }}
              >
                {t('ai.chatMessageItem.thinkingProcess')}
              </Text>
              <LineIcon
                name="x"
                size={32}
                color="var(--color-muted-foreground)"
                onClick={() => setReasoningPopupVisible(false)}
              />
            </View>
            <Text
              style={{
                fontSize: '24rpx',
                color: 'var(--color-foreground)',
                lineHeight: '1.6',
                whiteSpace: 'pre-wrap',
              }}
            >
              {reasoningPopupContent}
            </Text>
          </View>
        </View>
      ) : null}
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
