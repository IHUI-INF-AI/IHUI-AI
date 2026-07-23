import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useRouter, useDidShow, useShareAppMessage } from '@tarojs/taro'
import { useState, useCallback, useRef, useEffect } from 'react'
import {
  chatStream,
  type ChatMessage,
  fetchModels,
  getAigcList,
  getAgentDetail,
  getAgentList,
} from '@/api'
import { formatSSEError, getModelContextCapacity, formatTokenCount } from '@ihui/api-client'
import {
  type ModelItem,
  InputArea,
  SkillsPopup,
  MaterialPopup,
  IntelligentAssistant,
  type AgentItem,
  type MaterialTab,
} from '@/components'
import { useI18n } from '@/i18n'
import { useUserStore } from '@/stores/user'
import ChatMessageItem from './ChatMessageItem'
import { ModelDrawer, AgentDrawer, HistoryDrawer, type ChatHistoryEntry } from './ChatDrawers'
import './chat.css'

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
interface AgentInfo {
  id: string
  name: string
  desc: string
  avatar?: string
  prompt: string
  /** 智能体开场白(对标原 ai_assistant.vue prologue,引导说明内容) */
  prologue?: string
}

const MATERIAL_PAGE_SIZE = 20

export default function ChatPage() {
  const router = useRouter()
  const { t, tList } = useI18n()
  const suggestions = tList('ai.suggestions')
  const user = useUserStore((s) => s.user)
  const routeAgentId = router.params.agentId || ''
  const [currentAgentId, setCurrentAgentId] = useState(routeAgentId)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [thinking, setThinking] = useState(false)
  // 思考进度条(对标原 ai_assistant.vue thinkingProgress:120ms 定时器 +Math.random()*1,上限 99,完成时设 100)
  const [thinkingProgress, setThinkingProgress] = useState(0)
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [sessionId, setSessionId] = useState('')
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
  const [inputKey, setInputKey] = useState(0)
  // 收藏消息(对标原 ai_assistant.vue 收藏 AI 回复,用消息 timestamp 作为 id)
  const [favoritedMsgs, setFavoritedMsgs] = useState<Set<string>>(new Set())
  // 历史对话(对标原 ai_assistant.vue 历史抽屉)
  const [chatHistories, setChatHistories] = useState<ChatHistoryEntry[]>([])
  const [historyDrawerVisible, setHistoryDrawerVisible] = useState(false)

  const activeAgentId = currentAgentId || routeAgentId

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
      const res = (await getAgentList()) as { list?: AgentItem[] }
      setAgents(res?.list || [])
    } catch {
      Taro.showToast({ title: t('ai.agentLoadFailed'), icon: 'none' })
    } finally {
      setAgentsLoading(false)
    }
  }, [t])

  const loadAgent = useCallback(async () => {
    if (!activeAgentId) return
    try {
      setAgent(await getAgentDetail(activeAgentId))
    } catch {
      Taro.showToast({ title: t('ai.agentLoadFailed'), icon: 'none' })
    }
  }, [activeAgentId, t])

  useDidShow(() => {
    if (routeAgentId) loadAgent()
    Taro.showShareMenu({ withShareTicket: true })
    // 加载历史对话(对标原 ai_assistant.vue 加载历史)
    try {
      const savedHistory = Taro.getStorageSync(HISTORY_STORAGE_KEY)
      if (Array.isArray(savedHistory)) setChatHistories(savedHistory)
    } catch {
      // 存储读取失败忽略
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
    title: shareMsgRef.current ? (shareMsgRef.current.content || '').slice(0, 50) || t('ai.share.title') : t('ai.share.title'),
    path: '/pages/ai/chat',
  }))

  const checkSpecialModel = useCallback(
    (text: string): boolean => {
      if (/画|生成图|画图|绘图|画一个|画张|画幅/.test(text)) {
        Taro.showModal({
          title: t('ai.specialModel.hint'),
          content: t('ai.specialModel.confirm'),
          success: (res) => {
            if (res.confirm) {
              Taro.navigateTo({ url: '/pages/ai/image?prompt=' + encodeURIComponent(text) })
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
              Taro.navigateTo({ url: '/pages/ai/voice?text=' + encodeURIComponent(text) })
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
              Taro.navigateTo({ url: '/pages/ai/video?prompt=' + encodeURIComponent(text) })
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
    async (overrideText?: string) => {
      const text = (overrideText ?? '').trim()
      if (!text || thinking) return
      if (checkSpecialModel(text)) return
      const userMsg: ChatMessage = { role: 'user', content: text, timestamp: Date.now() }
      const assistantMsg: ChatMessage = { role: 'assistant', content: '', timestamp: Date.now() }
      setMessages((prev) => [...prev, userMsg, assistantMsg])
      setThinking(true)
      startThinkingProgress()
      scrollToBottom()
      const controller = new AbortController()
      abortRef.current = controller
      try {
        await chatStream(
          [...messages, userMsg],
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
            Taro.showToast({
              title: `上下文已压缩 ${formatTokenCount(info.tokensBefore)} → ${formatTokenCount(info.tokensAfter)}`,
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
        )
      } catch (e) {
        if ((e as Error)?.name !== 'AbortError') {
          const formatted = formatSSEError(e, t('ai.serviceUnavailable') || 'AI 服务异常')
          setMessages((prev) =>
            prev.map((m, i) => {
              if (i !== prev.length - 1) return m
              return m.content ? m : { ...m, content: formatted.message }
            }),
          )
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
          if (messages.length > 0) {
            const firstUserMsg = messages.find((m) => m.role === 'user')
            const lastMsg = messages[messages.length - 1]
            const title = (firstUserMsg?.content || '').slice(0, 20) || t('ai.history.title')
            const preview = (lastMsg?.content || '').slice(0, 30)
            const entry: ChatHistoryEntry = {
              id: `hist_${Date.now()}`,
              title,
              preview,
              timestamp: Date.now(),
              messages: [...messages],
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
        }
      },
    })
  }, [t, messages])

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
            setCurrentAgentId(a.id)
            setSkillsPopupVisible(false)
            setAgent({
              id: a.id,
              name: a.name,
              desc: a.desc || '',
              avatar: a.avatar,
              prompt: '',
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
        desc: a.desc || '',
        avatar: a.avatar,
        prompt: '',
      })
      loadAgent()
    },
    [loadAgent, messages.length, activeAgentId, t],
  )

  const openSkillsPopup = useCallback(() => {
    setSkillsPopupVisible(true)
    if (!agents.length) loadAgents()
  }, [agents.length, loadAgents])

  const handleUpload = useCallback((files: string[]) => {
    Taro.showToast({ title: `已选 ${files.length} 个文件`, icon: 'none' })
  }, [])

  const handleVoicePress = useCallback(() => {
    Taro.vibrateShort({ type: 'light' })
  }, [])

  const handleVoiceRelease = useCallback(
    (filePath: string) => {
      if (!filePath) return
      sendMessage(t('ai.voice.voiceMessage'))
    },
    [sendMessage, t],
  )

  const handleMaterialUpload = useCallback((tab: MaterialTab) => {
    Taro.showToast({ title: `上传 Tab${tab} 素材`, icon: 'none' })
  }, [])

  /** 复用问题到输入框(对标原 ai_assistant.vue copyToInput) */
  const handleReuse = useCallback((question: string) => {
    if (!question) return
    setInputValue(question)
    setInputKey((k) => k + 1)
    Taro.pageScrollTo({ scrollTop: 100000, duration: 300 })
  }, [])

  const handleRecharge = useCallback(() => {
    Taro.navigateTo({ url: '/pages/wallet/recharge/index' })
  }, [])

  /** TTS 朗读(对标原 ai_assistant.vue 朗读,简化实现:跳转 voice 页传 text 参数) */
  const handleSpeak = useCallback((content: string) => {
    if (!content) return
    Taro.navigateTo({ url: '/pages/ai/voice?text=' + encodeURIComponent(content) })
  }, [])

  const handleRegenerate = useCallback(() => {
    const lastUserIdx = messages.map((m) => m.role).lastIndexOf('user')
    if (lastUserIdx < 0) return
    const lastUserMsg = messages[lastUserIdx]
    if (!lastUserMsg?.content) return
    setMessages((prev) => prev.slice(0, lastUserIdx))
    setTimeout(() => sendMessage(lastUserMsg.content), 100)
  }, [messages, sendMessage])

  const handleLongPress = useCallback(
    (msg: ChatMessage, idx: number) => {
      Taro.showActionSheet({
        itemList: [
          t('ai.messageAction.copy'),
          t('ai.messageAction.reuse'),
          t('ai.messageAction.delete'),
          t('ai.chatMessageItem.share'),
        ],
        success: (res) => {
          if (res.tapIndex === 0) {
            Taro.setClipboardData({ data: msg.content })
          } else if (res.tapIndex === 1) {
            if (msg.role === 'user') handleReuse(msg.content)
          } else if (res.tapIndex === 2) {
            setMessages((prev) => prev.filter((_, i) => i !== idx))
          } else if (res.tapIndex === 3) {
            // 分享对话(对标原 ai_assistant.vue 分享):存入待分享消息,显示分享菜单,用户点右上角···分享
            shareMsgRef.current = msg
            Taro.showShareMenu({ withShareTicket: true })
            Taro.showToast({ title: t('ai.chatMessageItem.share'), icon: 'none' })
          }
        },
      })
    },
    [t, handleReuse],
  )

  const handleEdit = useCallback((msg: ChatMessage, idx: number) => {
    if (msg.role !== 'user') return
    setInputValue(msg.content)
    setInputKey((k) => k + 1)
    setMessages((prev) => prev.slice(0, idx))
    Taro.pageScrollTo({ scrollTop: 100000, duration: 300 })
  }, [])

  /** 恢复选中的历史对话(对标原 ai_assistant.vue 恢复历史) */
  const handleSelectHistory = useCallback(
    (h: ChatHistoryEntry) => {
      setMessages(h.messages || [])
      setSessionId('')
      setHistoryDrawerVisible(false)
      scrollToBottom()
    },
    [scrollToBottom],
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

  return (
    <View className="page">
      <View className="nav-bar safe-area-bottom">
        <View className="nav-left" onClick={openModelDrawer}>
          <Text className="nav-title">{currentModelName || t('ai.title')}</Text>
          <Text className="nav-arrow">▾</Text>
        </View>
        <View className="nav-right">
          {agent ? (
            <Text className="nav-agent" onClick={() => setAgentDrawerVisible(true)}>
              {agent.name}
            </Text>
          ) : null}
          <Text className="nav-history" onClick={() => setHistoryDrawerVisible(true)}>
            📜
          </Text>
          {messages.length ? (
            <Text className="nav-clear" onClick={clearChat}>
              {t('ai.clear')}
            </Text>
          ) : null}
        </View>
      </View>

      <ScrollView className="msg-list" scrollY scrollTop={scrollTop} scrollWithAnimation>
        {/* 智能体引导说明(对标原 ai_assistant.vue tishi_block + tishi_box,仅选中智能体时显示) */}
        {agent ? (
          <View className="tishi-block" onClick={() => setTishiShow((v) => !v)}>
            <Text className="tishi-block-icon">{tishiShow ? '✕' : '💡'}</Text>
            <Text className="tishi-block-text">
              {tishiShow ? t('ai.tishi.close') : t('ai.tishi.view')} {t('ai.tishi.title')}
            </Text>
          </View>
        ) : null}
        {agent && tishiShow && agent.prologue ? (
          <View className="tishi-box">
            <View className="tishi-title">
              <Text className="tishi-title-icon">📋</Text>
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
            {!agent ? (
              <IntelligentAssistant
                tokenBalance={(user as Record<string, unknown>)?.tokenBalance as number | undefined}
                isLoggedIn={!!user}
                onRecharge={handleRecharge}
              />
            ) : null}
            <Text className="welcome-title">{t('ai.welcomeTitle')}</Text>
            <Text className="welcome-desc">{t('ai.welcomeDesc')}</Text>
            <View className="suggest-list">
              {suggestions.map((s, i) => (
                <View key={i} className="suggest-item" onClick={() => handleSuggestion(s)}>
                  <Text>{s}</Text>
                </View>
              ))}
            </View>
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
            isFavorited={msg.role === 'assistant' && msg.timestamp ? favoritedMsgs.has(String(msg.timestamp)) : undefined}
            onToggleFavorite={msg.role === 'assistant' && msg.timestamp ? () => toggleFavorite(msg) : undefined}
            onSpeak={msg.role === 'assistant' ? handleSpeak : undefined}
          />
        ))}

        {thinking && messages[messages.length - 1]?.role !== 'assistant' ? (
          <View className="msg-item assistant">
            <View className="avatar assistant">AI</View>
            <View className="bubble">
              <Text className="bubble-text">{t('ai.thinking')}</Text>
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
                    background: 'linear-gradient(90deg, #00f2ff, #8b5cf6)',
                    borderRadius: '4rpx',
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
                    color: '#000',
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
          <Text className="material-tag-close" onClick={() => setSelectedMaterial(null)}>
            ×
          </Text>
        </View>
      ) : null}

      <View className="input-bar safe-area-bottom">
        <View className="tool-icons">
          <Text className="tool-icon" onClick={openMaterialDrawer}>
            📁
          </Text>
          <Text className="tool-icon" onClick={openSkillsPopup}>
            ⚡
          </Text>
        </View>
        <InputArea
          key={inputKey}
          value={inputValue}
          placeholder={t('ai.inputPlaceholder')}
          disabled={thinking}
          onSend={(text) => sendMessage(text)}
          onUpload={handleUpload}
          onVoicePress={handleVoicePress}
          onVoiceRelease={handleVoiceRelease}
        />
        {thinking ? (
          <View className="send-btn" onClick={stopGeneration}>
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
    </View>
  )
}
