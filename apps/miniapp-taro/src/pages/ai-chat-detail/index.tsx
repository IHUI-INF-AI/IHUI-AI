import { logger } from '@/utils/logger'
import { View, Text, ScrollView, Input } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback, useRef, useEffect } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'

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
    <View className="flex flex-col h-screen bg-background">
      <View className="p-[24rpx] bg-card flex-shrink-0">
        <Text className="text-[36rpx] font-semibold text-foreground">{t('aiChatDetail.title')}</Text>
      </View>
      <ScrollView scrollY className="flex-1 min-h-0" scrollTop={scrollTop} scrollWithAnimation>
        {loading ? (
          <View className="flex flex-col items-center py-[80rpx]">
            <Text className="text-center text-muted-foreground text-[26rpx]">{t('common.loading')}</Text>
          </View>
        ) : error ? (
          <View className="flex flex-col items-center py-[80rpx]">
            <Text className="text-center text-muted-foreground text-[26rpx]">{tt('aiChatDetail.loadFailed', '加载失败')}</Text>
            <View className="mt-[24rpx] px-[48rpx] py-[16rpx] bg-primary text-foreground text-center rounded-[12rpx] text-[26rpx]" onClick={loadData}>
              <Text>{t('common.retry')}</Text>
            </View>
          </View>
        ) : messages.length ? (
          <View className="p-[24rpx]">
            {messages.map((msg) => (
              <View key={msg.id} className={`flex mb-[24rpx] ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <View className={`max-w-[70%] py-[20rpx] px-[24rpx] rounded-[12rpx] ${msg.role === 'user' ? 'bg-primary' : 'bg-card'}`}>
                  <Text className="text-[28rpx] leading-[1.5] break-words text-foreground">
                    {msg.content || (msg.role === 'assistant' && sending ? tt('aiChatDetail.thinking', '思考中…') : '')}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View className="flex flex-col items-center py-[80rpx]">
            <Text className="text-center text-muted-foreground text-[26rpx]">{t('aiChatDetail.empty')}</Text>
          </View>
        )}
      </ScrollView>
      <View className="flex items-center px-[24rpx] py-[16rpx] bg-card flex-shrink-0 gap-[16rpx]">
        <Input
          className="flex-1 h-[72rpx] px-[24rpx] text-[28rpx] bg-background rounded-[12rpx]"
          type="text"
          value={inputValue}
          placeholder={tt('aiChatDetail.inputPlaceholder', '输入消息…')}
          onInput={handleInputChange}
          confirmType="send"
          onConfirm={sendMessage}
          disabled={sending}
        />
        <View
          className={`px-[32rpx] py-[16rpx] bg-primary rounded-[12rpx] flex-shrink-0${!inputValue.trim() || sending ? ' opacity-50' : ''}`}
          onClick={sendMessage}
        >
          <Text className="text-[28rpx] text-foreground">{t('chat.send')}</Text>
        </View>
      </View>
    </View>
  )
}
