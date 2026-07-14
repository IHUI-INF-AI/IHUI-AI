import { View, Text, Input, ScrollView } from '@tarojs/components'
import Taro, { useRouter, useDidShow } from '@tarojs/taro'
import { useState, useCallback, useRef } from 'react'
import { chatStream, type ChatMessage, getModelPlazaList, getAigcList, getAgentDetail } from '@/api'
import { type ModelItem } from '@/components'
import ChatMessageItem from './ChatMessageItem'
import { ModelDrawer, MaterialDrawer, AgentDrawer } from './ChatDrawers'
import './chat.css'

interface MaterialItem {
  id: string
  title: string
  coverUrl?: string
  content?: string
}
interface AgentInfo {
  id: string
  name: string
  desc: string
  avatar?: string
  prompt: string
}

const SUGGESTIONS = [
  '帮我写一段课程推广文案',
  '如何提升学习效率？',
  '推荐几本人工智能入门书',
  '解释一下什么是大模型',
]

export default function ChatPage() {
  const router = useRouter()
  const agentId = router.params.agentId || ''
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputText, setInputText] = useState('')
  const [thinking, setThinking] = useState(false)
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
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialItem | null>(null)
  const [agentDrawerVisible, setAgentDrawerVisible] = useState(false)
  const [agent, setAgent] = useState<AgentInfo | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const scrollToBottom = useCallback(() => {
    setTimeout(() => setScrollTop((s) => (s === 99998 ? 99999 : 99998)), 50)
  }, [])

  const loadModels = useCallback(async () => {
    setModelsLoading(true)
    try {
      const res = (await getModelPlazaList()) as { list?: ModelItem[] } | ModelItem[]
      setModels(Array.isArray(res) ? res : res?.list || [])
    } catch {
      Taro.showToast({ title: '模型加载失败', icon: 'none' })
    } finally {
      setModelsLoading(false)
    }
  }, [])

  const loadMaterials = useCallback(async () => {
    setMaterialsLoading(true)
    try {
      const res = (await getAigcList()) as { list?: MaterialItem[] }
      setMaterials(res?.list || [])
    } catch {
      Taro.showToast({ title: '素材加载失败', icon: 'none' })
    } finally {
      setMaterialsLoading(false)
    }
  }, [])

  const loadAgent = useCallback(async () => {
    if (!agentId) return
    try {
      setAgent(await getAgentDetail(agentId))
    } catch {
      Taro.showToast({ title: 'Agent加载失败', icon: 'none' })
    }
  }, [agentId])

  useDidShow(() => {
    if (agentId) loadAgent()
  })

  const sendMessage = useCallback(
    async (overrideText?: string) => {
      const text = (overrideText ?? inputText).trim()
      if (!text || thinking) return
      const userMsg: ChatMessage = { role: 'user', content: text, timestamp: Date.now() }
      const assistantMsg: ChatMessage = { role: 'assistant', content: '', timestamp: Date.now() }
      setMessages((prev) => [...prev, userMsg, assistantMsg])
      setInputText('')
      setThinking(true)
      scrollToBottom()
      const controller = new AbortController()
      abortRef.current = controller
      try {
        await chatStream(
          [...messages, userMsg],
          sessionId,
          {
            modelId: currentModel || undefined,
            agentId: agentId || undefined,
            materialContent: selectedMaterial?.content || undefined,
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
        )
      } catch (e) {
        if ((e as Error)?.name !== 'AbortError') {
          setMessages((prev) =>
            prev.map((m, i) => {
              if (i !== prev.length - 1) return m
              return m.content ? m : { ...m, content: '抱歉，服务暂时不可用，请稍后再试。' }
            }),
          )
        }
      } finally {
        abortRef.current = null
        setThinking(false)
        scrollToBottom()
      }
    },
    [
      inputText,
      thinking,
      sessionId,
      messages,
      scrollToBottom,
      currentModel,
      agentId,
      selectedMaterial,
    ],
  )

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const handleSuggestion = useCallback(
    (text: string) => {
      setInputText(text)
      sendMessage(text)
    },
    [sendMessage],
  )

  const clearChat = useCallback(() => {
    Taro.showModal({
      title: '提示',
      content: '确定清空对话记录吗？',
      success: (res) => {
        if (res.confirm) {
          setMessages([])
          setSessionId('')
        }
      },
    })
  }, [])

  const selectModel = useCallback((m: ModelItem) => {
    setCurrentModel(String(m.id))
    setCurrentModelName(m.name)
    setModelDrawerVisible(false)
  }, [])

  const selectMaterial = useCallback((m: MaterialItem) => {
    setSelectedMaterial(m)
    setMaterialDrawerVisible(false)
  }, [])

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
          <Text className="nav-title">{currentModelName || 'AI 对话'}</Text>
          <Text className="nav-arrow">▾</Text>
        </View>
        <View className="nav-right">
          {agent ? (
            <Text className="nav-agent" onClick={() => setAgentDrawerVisible(true)}>
              {agent.name}
            </Text>
          ) : null}
          {messages.length ? (
            <Text className="nav-clear" onClick={clearChat}>
              清空
            </Text>
          ) : null}
        </View>
      </View>

      <ScrollView className="msg-list" scrollY scrollTop={scrollTop} scrollWithAnimation>
        {!messages.length ? (
          <View className="welcome">
            <Text className="welcome-title">你好，我是智汇AI助手</Text>
            <Text className="welcome-desc">有什么问题请尽管问我</Text>
            <View className="suggest-list">
              {SUGGESTIONS.map((s, i) => (
                <View key={i} className="suggest-item" onClick={() => handleSuggestion(s)}>
                  <Text>{s}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {messages.map((msg, idx) => (
          <ChatMessageItem key={idx} msg={msg} />
        ))}

        {thinking && messages[messages.length - 1]?.role !== 'assistant' ? (
          <View className="msg-item assistant">
            <View className="avatar assistant">AI</View>
            <View className="bubble">
              <Text className="bubble-text">思考中...</Text>
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
          {agentId ? (
            <Text className="tool-icon" onClick={() => setAgentDrawerVisible(true)}>
              ⚡
            </Text>
          ) : null}
        </View>
        <Input
          className="input"
          type="text"
          value={inputText}
          placeholder="请输入问题"
          confirmType="send"
          onConfirm={() => sendMessage()}
          onInput={(e) => setInputText(e.detail.value)}
          adjustPosition
        />
        {thinking ? (
          <View className="send-btn" onClick={stopGeneration}>
            <Text>停止</Text>
          </View>
        ) : (
          <View
            className={`send-btn${!inputText.trim() ? ' disabled' : ''}`}
            onClick={() => sendMessage()}
          >
            <Text>发送</Text>
          </View>
        )}
      </View>

      <ModelDrawer
        visible={modelDrawerVisible}
        onClose={() => setModelDrawerVisible(false)}
        models={models}
        selectedId={currentModel}
        loading={modelsLoading}
        onSelect={selectModel}
      />
      <MaterialDrawer
        visible={materialDrawerVisible}
        onClose={() => setMaterialDrawerVisible(false)}
        materials={materials}
        loading={materialsLoading}
        onSelect={selectMaterial}
      />
      <AgentDrawer
        visible={agentDrawerVisible}
        onClose={() => setAgentDrawerVisible(false)}
        agent={agent}
      />
    </View>
  )
}
