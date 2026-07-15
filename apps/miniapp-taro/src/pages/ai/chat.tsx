import { View, Text, Input, ScrollView } from '@tarojs/components'
import Taro, { useRouter, useDidShow } from '@tarojs/taro'
import { useState, useCallback, useRef } from 'react'
import { chatStream, type ChatMessage, getModelPlazaList, getAigcList, getAgentDetail } from '@/api'
import { type ModelItem } from '@/components'
import { useI18n } from '@/i18n'
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

export default function ChatPage() {
  const router = useRouter()
  const { t, tList } = useI18n()
  const suggestions = tList('ai.suggestions')
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
      Taro.showToast({ title: t('ai.modelLoadFailed'), icon: 'none' })
    } finally {
      setModelsLoading(false)
    }
  }, [t])

  const loadMaterials = useCallback(async () => {
    setMaterialsLoading(true)
    try {
      const res = (await getAigcList()) as { list?: MaterialItem[] }
      setMaterials(res?.list || [])
    } catch {
      Taro.showToast({ title: t('ai.materialLoadFailed'), icon: 'none' })
    } finally {
      setMaterialsLoading(false)
    }
  }, [t])

  const loadAgent = useCallback(async () => {
    if (!agentId) return
    try {
      setAgent(await getAgentDetail(agentId))
    } catch {
      Taro.showToast({ title: t('ai.agentLoadFailed'), icon: 'none' })
    }
  }, [agentId, t])

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
              return m.content ? m : { ...m, content: t('ai.serviceUnavailable') }
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
      t,
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
      title: t('common.hint'),
      content: t('ai.clearConfirm'),
      success: (res) => {
        if (res.confirm) {
          setMessages([])
          setSessionId('')
        }
      },
    })
  }, [t])

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
          <Text className="nav-title">{currentModelName || t('ai.title')}</Text>
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
              {t('ai.clear')}
            </Text>
          ) : null}
        </View>
      </View>

      <ScrollView className="msg-list" scrollY scrollTop={scrollTop} scrollWithAnimation>
        {!messages.length ? (
          <View className="welcome">
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
          <ChatMessageItem key={idx} msg={msg} />
        ))}

        {thinking && messages[messages.length - 1]?.role !== 'assistant' ? (
          <View className="msg-item assistant">
            <View className="avatar assistant">AI</View>
            <View className="bubble">
              <Text className="bubble-text">{t('ai.thinking')}</Text>
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
          placeholder={t('ai.inputPlaceholder')}
          confirmType="send"
          onConfirm={() => sendMessage()}
          onInput={(e) => setInputText(e.detail.value)}
          adjustPosition
        />
        {thinking ? (
          <View className="send-btn" onClick={stopGeneration}>
            <Text>{t('ai.stop')}</Text>
          </View>
        ) : (
          <View
            className={`send-btn${!inputText.trim() ? ' disabled' : ''}`}
            onClick={() => sendMessage()}
          >
            <Text>{t('ai.send')}</Text>
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
