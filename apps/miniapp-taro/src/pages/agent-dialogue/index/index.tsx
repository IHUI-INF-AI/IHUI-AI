import { logger } from '@/utils/logger'
import { View, Text, Image, ScrollView, Input } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback, useRef, useEffect } from 'react'
import * as api from '@/api'
import type { ChatMessage } from '@/api'
import { useI18n } from '@/i18n'
import './index.css'

interface AgentOption {
  id: string
  name: string
  avatar?: string
  desc?: string
}

interface DisplayMessage extends ChatMessage {
  uid: string
}

export default function AgentDialogue() {
  const { t } = useI18n()
  const tt = useCallback(
    (k: string, fb: string) => {
      const v = t(k)
      return v === k ? fb : v
    },
    [t],
  )
  const [agents, setAgents] = useState<AgentOption[]>([])
  const [currentAgentId, setCurrentAgentId] = useState<string>('')
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingAgents, setLoadingAgents] = useState(false)
  const [error, setError] = useState(false)
  const [scrollIntoView, setScrollIntoView] = useState('')
  const sessionIdRef = useRef<string>('')

  const currentAgent = agents.find((a) => a.id === currentAgentId)

  const loadAgents = useCallback(async () => {
    setLoadingAgents(true)
    setError(false)
    try {
      const res = await api.getAgentList()
      const mapped: AgentOption[] = (res.list || []).map((a) => ({
        id: a.id,
        name: a.name,
        avatar: a.avatar,
        desc: a.desc,
      }))
      setAgents(mapped)
      const firstAgent = mapped[0]
      if (firstAgent && !currentAgentId) {
        setCurrentAgentId(firstAgent.id)
      }
    } catch (e) {
      logger.error('agentDialogue', '加载智能体', e)
      setError(true)
    } finally {
      setLoadingAgents(false)
    }
  }, [currentAgentId])

  useDidShow(() => {
    loadAgents()
  })

  // 切换智能体时重置对话
  const onAgentChange = useCallback((id: string) => {
    setCurrentAgentId(id)
    setMessages([])
    sessionIdRef.current = ''
  }, [])

  // 自动滚动到底部
  useEffect(() => {
    if (messages.length > 0) {
      setScrollIntoView(`msg-${messages.length - 1}`)
    }
  }, [messages])

  const onSend = useCallback(async () => {
    const content = input.trim()
    if (!content || sending) return
    const userMsg: DisplayMessage = {
      uid: `msg-${messages.length}`,
      role: 'user',
      content,
      timestamp: Date.now(),
    }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setSending(true)
    try {
      const apiMessages: ChatMessage[] = newMessages.map(({ role, content: c, timestamp }) => ({
        role,
        content: c,
        timestamp,
      }))
      const res = await api.chat(apiMessages, sessionIdRef.current || undefined, {
        agentId: currentAgentId || undefined,
      })
      sessionIdRef.current = res.sessionId
      setMessages([
        ...newMessages,
        {
          uid: `msg-${newMessages.length}`,
          role: 'assistant',
          content: res.reply,
          timestamp: Date.now(),
        },
      ])
    } catch (e) {
      logger.error('agentDialogue', '发送消息', e)
      Taro.showToast({
        title: tt('agentDialogue.sendFailed', '发送失败,请重试'),
        icon: 'none',
      })
    } finally {
      setSending(false)
    }
  }, [input, sending, messages, currentAgentId, tt])

  const onInputChange = useCallback((e: { detail: { value: string } }) => {
    setInput(e.detail.value)
  }, [])

  const onGoHistory = useCallback(() => {
    Taro.navigateTo({ url: '/pages/ai/history' })
  }, [])

  if (loadingAgents && agents.length === 0) {
    return (
      <View className="page-container">
        <View className="page-header">
          <Text className="page-title">{t('agentDialogue.title')}</Text>
        </View>
        <View className="chat-body">
          <Text className="loading-text">{t('common.loading')}</Text>
        </View>
      </View>
    )
  }

  if (error && agents.length === 0) {
    return (
      <View className="page-container">
        <View className="page-header">
          <Text className="page-title">{t('agentDialogue.title')}</Text>
        </View>
        <View className="chat-body">
          <Text className="empty-text">{tt('agentDialogue.loadFailed', '加载失败')}</Text>
          <Text className="btn" onClick={loadAgents}>
            {t('common.retry')}
          </Text>
        </View>
      </View>
    )
  }

  return (
    <View className="page-container">
      <View className="page-header">
        <Text className="page-title">{t('agentDialogue.title')}</Text>
        <Text className="history-entry" onClick={onGoHistory}>
          {tt('agentDialogue.historyEntry', '历史对话')}
        </Text>
      </View>
      {agents.length > 0 && (
        <ScrollView scrollX className="agent-bar">
          {agents.map((agent) => (
            <View
              key={agent.id}
              className={`agent-chip ${currentAgentId === agent.id ? 'active' : ''}`}
              onClick={() => onAgentChange(agent.id)}
            >
              {agent.avatar ? (
                <Image className="agent-chip-avatar" src={agent.avatar} mode="aspectFill" />
              ) : (
                <View className="agent-chip-avatar placeholder">
                  <Text className="agent-chip-icon">🤖</Text>
                </View>
              )}
              <Text className="agent-chip-name">{agent.name}</Text>
            </View>
          ))}
        </ScrollView>
      )}
      <ScrollView
        scrollY
        className="chat-body"
        scrollIntoView={scrollIntoView}
        scrollWithAnimation
      >
        {messages.length === 0 ? (
          <View className="welcome-wrapper">
            <Text className="welcome-icon">💬</Text>
            <Text className="welcome-text">
              {currentAgent
                ? tt('agentDialogue.welcome', '你好,我是 {{name}},有什么可以帮你?').replace(
                    '{{name}}',
                    currentAgent.name,
                  )
                : tt('agentDialogue.messageEmpty', '发送消息开始对话')}
            </Text>
          </View>
        ) : (
          messages.map((msg, idx) => (
            <View key={msg.uid} id={`msg-${idx}`} className={`message-row ${msg.role}`}>
              {msg.role === 'assistant' ? (
                <View className="message-avatar">
                  <Text className="message-avatar-icon">🤖</Text>
                </View>
              ) : null}
              <View className={`message-bubble ${msg.role}`}>
                <Text className="message-content">{msg.content}</Text>
              </View>
              {msg.role === 'user' ? (
                <View className="message-avatar user">
                  <Text className="message-avatar-icon">👤</Text>
                </View>
              ) : null}
            </View>
          ))
        )}
        {sending ? (
          <View className="message-row assistant">
            <View className="message-avatar">
              <Text className="message-avatar-icon">🤖</Text>
            </View>
            <View className="message-bubble assistant">
              <Text className="message-content thinking">{tt('agentDialogue.thinking', '思考中…')}</Text>
            </View>
          </View>
        ) : null}
      </ScrollView>
      <View className="chat-input-bar">
        <Input
          className="chat-input"
          value={input}
          placeholder={tt('agentDialogue.inputPlaceholder', '输入消息…')}
          onInput={onInputChange}
          confirmType="send"
          onConfirm={onSend}
        />
        <Text
          className={`send-btn ${!input.trim() || sending ? 'disabled' : ''}`}
          onClick={onSend}
        >
          {t('chat.send')}
        </Text>
      </View>
    </View>
  )
}
