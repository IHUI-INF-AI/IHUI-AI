import { logger } from '@/utils/logger'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useEffect, useRef, useCallback } from 'react'
import { voiceChat, type ChatMessage } from '@/api'
import { useI18n } from '@/i18n'
import './voice.css'

type RecorderManager = ReturnType<typeof Taro.getRecorderManager>

export default function VoicePage() {
  const { t } = useI18n()
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: t('ai.voice.welcome') },
  ])
  const [recording, setRecording] = useState(false)
  const [loading, setLoading] = useState(false)
  const [audioUrl, setAudioUrl] = useState('')
  const recorderRef = useRef<RecorderManager | null>(null)

  useEffect(() => {
    const recorder = Taro.getRecorderManager()
    recorderRef.current = recorder

    recorder.onStop((res) => {
      setLoading(true)
      setMessages((prev) => [...prev, { role: 'user', content: t('ai.voice.voiceMessage') }])
      Taro.getFileSystemManager().readFile({
        filePath: res.tempFilePath,
        encoding: 'base64',
        success: (fileRes) => {
          voiceChat({ audio: fileRes.data as string })
            .then((apiRes) => {
              setMessages((prev) => [...prev, { role: 'assistant', content: apiRes.reply }])
              if (apiRes.audio) setAudioUrl(apiRes.audio)
            })
            .catch((e) => {
              logger.error('ai/voice', '语音对话', e)
              Taro.showToast({ title: t('ai.voice.chatFailed'), icon: 'none' })
            })
            .finally(() => setLoading(false))
        },
        fail: () => {
          Taro.showToast({ title: t('ai.voice.recordFailed'), icon: 'none' })
          setLoading(false)
        },
      })
    })

    recorder.onError(() => {
      Taro.showToast({ title: t('ai.voice.recordFailed'), icon: 'none' })
      setRecording(false)
      setLoading(false)
    })

    return () => {
      recorderRef.current = null
    }
  }, [t])

  const onVoice = useCallback(() => {
    const recorder = recorderRef.current
    if (!recorder) return
    if (recording) {
      setRecording(false)
      recorder.stop()
    } else {
      setRecording(true)
      recorder.start({ duration: 60000, sampleRate: 16000, numberOfChannels: 1, format: 'mp3' })
    }
  }, [recording])

  const onPlayAudio = useCallback(() => {
    if (!audioUrl) return
    const audio = Taro.createInnerAudioContext()
    audio.src = audioUrl
    audio.play()
  }, [audioUrl])

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
        {audioUrl ? (
          <View className="msg assistant">
            <Text className="msg-text" onClick={onPlayAudio}>{t('ai.voice.voiceMessage')} ▶</Text>
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
