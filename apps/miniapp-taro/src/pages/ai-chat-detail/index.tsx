import { logger } from '@/utils/logger'
import { View, Text, ScrollView, Input } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback, useRef, useEffect } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import './index.css'

interface DisplayMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export default function AiChatDetail() {
  const { t } = useI18n()
  const tt = (k: string, fb: string, params?: Record<string, string | number>) => {
    const v = params ? t(k, params) : t(k)
    if (v !== k) return v
    if (!params) return fb
    return fb.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? ''))
  }
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [sending, setSending] = useState(false)
  const [sessionId, setSessionId] = useState('')
  const [scrollTop, setScrollTop] = useState(0)
  const inputRef = useRef('')

  const scrollToBottom = useCallback(() => {
    setTimeout(() => setScrollTop((s) => (s === 99998 ? 99999 : 99998)), 50)
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await api.getChatHistory({ page: 1, pageSize: 1 })
      const sessions = res?.list || []
      const firstSession = sessions[0]
      if (firstSession && firstSession.messages?.length) {
        const msgs = firstSession.messages.map((m, idx) => ({
          id: `${firstSession.id}_${idx}`,
          role: m.role || 'assistant',
          content: String(m.content || ''),
          timestamp: Number(m.timestamp || Date.now()),
        }))
        setMessages(msgs)
        setSessionId(String(firstSession.id || ''))
        scrollToBottom()
      }
    } catch (e) {
      logger.error('unknown', '加载聊天记录', e)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [scrollToBottom])

  useDidShow(() => {
    loadData()
  })

  const handleInputChange = useCallback((e: { detail: { value: string } }) => {
    const val = e.detail.value
    setInputValue(val)
    inputRef.current = val
  }, [])

  const sendMessage = useCallback(async () => {
    const text = inputRef.current.trim()
    if (!text || sending) return
    const userMsg: DisplayMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    }
    const aiMsg: DisplayMessage = {
      id: `ai_${Date.now()}`,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    }
    setMessages((prev) => [...prev, userMsg, aiMsg])
    setInputValue('')
    inputRef.current = ''
    setSending(true)
    scrollToBottom()
    try {
      const chatMessages = [
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user' as const, content: text },
      ]
      const result = await api.chat(chatMessages, sessionId || undefined)
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiMsg.id ? { ...m, content: result?.reply || tt('aiChatDetail.noReply', '暂无回复') } : m,
        ),
      )
      if (result?.sessionId) setSessionId(result.sessionId)
      scrollToBottom()
    } catch (e) {
      logger.error('unknown', '发送消息', e)
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiMsg.id
            ? { ...m, content: tt('aiChatDetail.sendFailed', '发送失败,请重试') }
            : m,
        ),
      )
      Taro.showToast({ title: tt('aiChatDetail.sendFailed', '发送失败,请重试'), icon: 'none' })
    } finally {
      setSending(false)
    }
  }, [sending, sessionId, messages, scrollToBottom, tt])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  return (
    <View className="page-container">
      <View className="page-header">
        <Text className="page-title">{t('aiChatDetail.title')}</Text>
      </View>
      <ScrollView scrollY className="msg-list" scrollTop={scrollTop} scrollWithAnimation>
        {loading ? (
          <View className="state-box">
            <Text className="state-text">{t('common.loading')}</Text>
          </View>
        ) : error ? (
          <View className="state-box">
            <Text className="state-text">{tt('aiChatDetail.loadFailed', '加载失败')}</Text>
            <View className="retry-btn" onClick={loadData}>
              <Text>{t('common.retry')}</Text>
            </View>
          </View>
        ) : messages.length ? (
          <View className="msg-list-inner">
            {messages.map((msg) => (
              <View key={msg.id} className={`msg-item ${msg.role}`}>
                <View className={`bubble ${msg.role}`}>
                  <Text className="bubble-text">
                    {msg.content || (msg.role === 'assistant' && sending ? tt('aiChatDetail.thinking', '思考中…') : '')}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View className="state-box">
            <Text className="state-text">{t('aiChatDetail.empty')}</Text>
          </View>
        )}
      </ScrollView>
      <View className="input-bar">
        <Input
          className="input"
          type="text"
          value={inputValue}
          placeholder={tt('aiChatDetail.inputPlaceholder', '输入消息…')}
          onInput={handleInputChange}
          confirmType="send"
          onConfirm={sendMessage}
          disabled={sending}
        />
        <View
          className={`send-btn${!inputValue.trim() || sending ? ' disabled' : ''}`}
          onClick={sendMessage}
        >
          <Text className="send-text">{t('chat.send')}</Text>
        </View>
      </View>
    </View>
  )
}
