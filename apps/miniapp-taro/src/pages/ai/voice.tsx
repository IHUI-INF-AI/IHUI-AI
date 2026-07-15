import { logger } from '@/utils/logger'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { voiceChat, type ChatMessage } from '@/api'
import { useI18n } from '@/i18n'
import './voice.css'

export default function VoicePage() {
  const { t } = useI18n()
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: t('ai.voice.welcome') },
  ])
  const [recording, setRecording] = useState(false)
  const [loading, setLoading] = useState(false)

  const onVoice = useCallback(() => {
    if (recording) {
      setRecording(false)
      setLoading(true)
      setMessages((prev) => [...prev, { role: 'user', content: t('ai.voice.voiceMessage') }])
      voiceChat({ audio: 'demo' })
        .then((res) => {
          setMessages((prev) => [...prev, { role: 'assistant', content: res.reply }])
        })
        .catch((e) => {
          logger.error('unknown', '语音对话', e)
          Taro.showToast({ title: t('ai.voice.chatFailed'), icon: 'none' })
        })
        .finally(() => {
          setLoading(false)
        })
    } else {
      setRecording(true)
      Taro.showToast({ title: t('ai.voice.startRecord'), icon: 'none' })
    }
  }, [recording, t])

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
            <Text className="msg-text">{t('ai.voice.thinking')}</Text>
          </View>
        ) : null}
      </View>
      <View className="input-bar">
        <View className={`voice-btn${recording ? ' recording' : ''}`} onClick={onVoice}>
          <Text>{recording ? t('ai.voice.releaseToSend') : t('ai.voice.holdToSpeak')}</Text>
        </View>
      </View>
    </View>
  )
}
