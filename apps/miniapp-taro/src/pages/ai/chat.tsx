import { View, Text, Input, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { chat, type ChatMessage } from '@/api'
import './chat.css'

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputText, setInputText] = useState('')
  const [thinking, setThinking] = useState(false)
  const [scrollTop, setScrollTop] = useState(0)
  const [sessionId, setSessionId] = useState('')

  const suggestions = [
    '帮我写一段课程推广文案',
    '如何提升学习效率？',
    '推荐几本人工智能入门书',
    '解释一下什么是大模型',
  ]

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      setScrollTop(s => (s === 99998 ? 99999 : 99998))
    }, 50)
  }, [])

  const sendMessage = useCallback(async (overrideText?: string) => {
    const text = (overrideText ?? inputText).trim()
    if (!text || thinking) return

    const userMsg: ChatMessage = { role: 'user', content: text, timestamp: Date.now() }
    setMessages(prev => [...prev, userMsg])
    setInputText('')
    setThinking(true)
    scrollToBottom()

    try {
      const res = await chat([...messages, userMsg], sessionId)
      setSessionId(res.sessionId)
      setMessages(prev => [...prev, { role: 'assistant', content: res.reply, timestamp: Date.now() }])
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '抱歉，服务暂时不可用，请稍后再试。',
        timestamp: Date.now(),
      }])
    } finally {
      setThinking(false)
      scrollToBottom()
    }
  }, [inputText, thinking, sessionId, messages, scrollToBottom])

  const handleSuggestion = useCallback((text: string) => {
    setInputText(text)
    sendMessage(text)
  }, [sendMessage])

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

  return (
    <View className="page">
      <View className="nav-bar safe-area-bottom">
        <Text className="nav-title">AI 对话</Text>
        {messages.length ? <Text className="nav-clear" onClick={clearChat}>清空</Text> : null}
      </View>

      <ScrollView className="msg-list" scrollY scrollTop={scrollTop} scrollWithAnimation>
        {!messages.length ? (
          <View className="welcome">
            <Text className="welcome-title">你好，我是智汇AI助手</Text>
            <Text className="welcome-desc">有什么问题请尽管问我</Text>
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
          <View key={idx} className={`msg-item ${msg.role}`}>
            <View className={`avatar ${msg.role}`}>{msg.role === 'user' ? '我' : 'AI'}</View>
            <View className="bubble">
              <Text className="bubble-text">{msg.content}</Text>
            </View>
          </View>
        ))}

        {thinking ? (
          <View className="msg-item assistant">
            <View className="avatar assistant">AI</View>
            <View className="bubble"><Text className="bubble-text">思考中...</Text></View>
          </View>
        ) : null}
      </ScrollView>

      <View className="input-bar safe-area-bottom">
        <Input
          className="input"
          type="text"
          value={inputText}
          placeholder="请输入问题"
          confirmType="send"
          onConfirm={() => sendMessage()}
          onInput={e => setInputText(e.detail.value)}
          adjustPosition
        />
        <View
          className={`send-btn${!inputText.trim() || thinking ? ' disabled' : ''}`}
          onClick={() => sendMessage()}
        >
          <Text>发送</Text>
        </View>
      </View>
    </View>
  )
}
