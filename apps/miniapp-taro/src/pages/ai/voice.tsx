import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { voiceChat, type ChatMessage } from '@/api'
import './voice.css'

export default function VoicePage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: '您好，我是AI语音助手，按住下方按钮开始对话' }
  ])
  const [recording, setRecording] = useState(false)
  const [loading, setLoading] = useState(false)

  const onVoice = useCallback(() => {
    if (recording) {
      setRecording(false)
      setLoading(true)
      setMessages(prev => [...prev, { role: 'user', content: '[语音消息]' }])
      voiceChat({ audio: 'demo' })
        .then(res => {
          setMessages(prev => [...prev, { role: 'assistant', content: res.reply }])
        })
        .catch(() => {})
        .finally(() => { setLoading(false) })
    } else {
      setRecording(true)
      Taro.showToast({ title: '开始录音', icon: 'none' })
    }
  }, [recording])

  return (
    <View className="page">
      <View className="chat-area">
        {messages.map((m, i) => (
          <View key={i} className={`msg ${m.role}`}>
            <Text className="msg-text">{m.content}</Text>
          </View>
        ))}
        {loading ? (
          <View className="msg assistant">
            <Text className="msg-text">正在思考...</Text>
          </View>
        ) : null}
      </View>
      <View className="input-bar">
        <View className={`voice-btn${recording ? ' recording' : ''}`} onClick={onVoice}>
          <Text>{recording ? '松开发送' : '🎤 按住说话'}</Text>
        </View>
      </View>
    </View>
  )
}
