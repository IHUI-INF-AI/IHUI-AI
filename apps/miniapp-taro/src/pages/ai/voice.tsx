import { logger } from '@/utils/logger'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useShareAppMessage } from '@tarojs/taro'
import { useState, useEffect, useRef, useCallback } from 'react'
import { voiceChat, type ChatMessage } from '@/api'
import { useI18n } from '@/i18n'
import './voice.css'

type RecorderManager = ReturnType<typeof Taro.getRecorderManager>
type Speed = 'normal' | 'fast' | 'slow'
type Timbre = 'female' | 'male'

interface VoiceMessage extends ChatMessage {
  audio?: string
  duration?: number
  isVoice?: boolean
}

const SPEEDS: Speed[] = ['normal', 'fast', 'slow']
const TIMBRES: Timbre[] = ['female', 'male']

const speedLabel: Record<Speed, string> = { normal: '标准', fast: '快速', slow: '慢速' }
const timbreLabel: Record<Timbre, string> = { female: '女声', male: '男声' }

export default function VoicePage() {
  const { t } = useI18n()
  const tt = useCallback(
    (k: string, fb: string) => (t(k) === k ? fb : t(k)),
    [t],
  )

  const [messages, setMessages] = useState<VoiceMessage[]>([
    { role: 'assistant', content: t('ai.voice.welcome') },
  ])
  const [recording, setRecording] = useState(false)
  const [loading, setLoading] = useState(false)
  const [displayDuration, setDisplayDuration] = useState(0)
  const [speed, setSpeed] = useState<Speed>('normal')
  const [timbre, setTimbre] = useState<Timbre>('female')
  const [playingIdx, setPlayingIdx] = useState(-1)
  const [scrollTop, setScrollTop] = useState(0)

  const recorderRef = useRef<RecorderManager | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const durationRef = useRef(0)

  useEffect(() => {
    const recorder = Taro.getRecorderManager()
    recorderRef.current = recorder

    const onStop = (res: { tempFilePath: string }) => {
      const dur = durationRef.current
      setLoading(true)
      setMessages((prev) => [
        ...prev,
        {
          role: 'user',
          content: tt('ai.voice.voiceMessage', '[语音消息]'),
          isVoice: true,
          duration: dur,
        },
      ])
      Taro.getFileSystemManager().readFile({
        filePath: res.tempFilePath,
        encoding: 'base64',
        success: (fileRes) => {
          voiceChat({ audio: fileRes.data as string })
            .then((apiRes) => {
              setMessages((prev) => [
                ...prev,
                {
                  role: 'assistant',
                  content: apiRes.reply,
                  audio: apiRes.audio,
                  isVoice: !!apiRes.audio,
                },
              ])
            })
            .catch((e) => {
              logger.error('ai/voice', '语音对话', e)
              Taro.showToast({
                title: tt('ai.voice.chatFailed', '对话失败,请重试'),
                icon: 'none',
              })
            })
            .finally(() => setLoading(false))
        },
        fail: () => {
          Taro.showToast({
            title: tt('ai.voice.recordFailed', '录音失败,请重试'),
            icon: 'none',
          })
          setLoading(false)
        },
      })
    }

    const onError = () => {
      Taro.showToast({
        title: tt('ai.voice.recordFailed', '录音失败,请重试'),
        icon: 'none',
      })
      setRecording(false)
      setLoading(false)
      stopTimer()
    }

    recorder.onStop(onStop)
    recorder.onError(onError)

    return () => {
      stopTimer()
      recorderRef.current = null
    }
  }, [tt])

  useEffect(() => {
    setScrollTop((s) => s + 100000)
  }, [messages.length, loading])

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const startTimer = useCallback(() => {
    durationRef.current = 0
    setDisplayDuration(0)
    timerRef.current = setInterval(() => {
      durationRef.current += 1
      setDisplayDuration(durationRef.current)
    }, 1000)
  }, [])

  const onStartRecord = useCallback(() => {
    const recorder = recorderRef.current
    if (!recorder || loading) return
    setRecording(true)
    startTimer()
    recorder.start({
      duration: 60000,
      sampleRate: 16000,
      numberOfChannels: 1,
      format: 'mp3',
    })
  }, [loading, startTimer])

  const onStopRecord = useCallback(() => {
    if (!recording) return
    setRecording(false)
    stopTimer()
    recorderRef.current?.stop()
  }, [recording, stopTimer])

  const onPlayAudio = useCallback((msg: VoiceMessage, idx: number) => {
    if (!msg.audio || playingIdx === idx) {
      setPlayingIdx(-1)
      return
    }
    const audio = Taro.createInnerAudioContext()
    audio.src = msg.audio
    setPlayingIdx(idx)
    audio.onEnded(() => setPlayingIdx(-1))
    audio.onError(() => setPlayingIdx(-1))
    audio.play()
  }, [playingIdx])

  const onClear = useCallback(() => {
    Taro.showModal({
      title: tt('ai.voice.clearChat', '清空对话'),
      content: tt('ai.voice.clearConfirm', '确定要清空当前对话吗?'),
      confirmText: t('common.confirm'),
      cancelText: t('common.cancel'),
      success: (res) => {
        if (!res.confirm) return
        setMessages([{ role: 'assistant', content: t('ai.voice.welcome') }])
        Taro.showToast({ title: tt('ai.voice.cleared', '对话已清空'), icon: 'none' })
      },
    })
  }, [t, tt])

  useShareAppMessage(() => ({
    title: tt('ai.voice.title', 'AI 语音对话'),
    path: '/pages/ai/voice',
  }))

  const fmtDuration = (sec: number) => `${sec}"`

  return (
    <View className="page">
      <View className="header">
        <Text className="header-title">{tt('ai.voice.title', 'AI 语音对话')}</Text>
        <Text className="header-clear" onClick={onClear}>
          {tt('ai.voice.clearChat', '清空对话')}
        </Text>
      </View>

      <ScrollView
        className="chat-area"
        scrollY
        scrollTop={scrollTop}
      >
        {messages.map((m, i) => (
          <View key={i} className={`msg ${m.role}`}>
            <View className="avatar">{m.role === 'user' ? '我' : 'AI'}</View>
            <View className="bubble">
              {m.isVoice ? (
                <View className="voice-bubble" onClick={() => onPlayAudio(m, i)}>
                  <Text className="voice-icon">{playingIdx === i ? '⏸' : '▶'}</Text>
                  <Text className="voice-duration">{fmtDuration(m.duration || 0)}</Text>
                  <View className="wave-anim">
                    {[0, 1, 2, 3, 4].map((n) => (
                      <View key={n} className={`wave-bar wave-bar-${n + 1}`} />
                    ))}
                  </View>
                </View>
              ) : (
                <Text className="bubble-text">{m.content}</Text>
              )}
            </View>
          </View>
        ))}
        {loading ? (
          <View className="msg assistant">
            <View className="avatar">AI</View>
            <View className="bubble">
              <View className="thinking">
                <Text className="thinking-dot">·</Text>
                <Text className="thinking-dot">·</Text>
                <Text className="thinking-dot">·</Text>
              </View>
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View className="settings">
        <View className="setting-row">
          <Text className="setting-label">{tt('ai.voice.speed', '语速')}</Text>
          {SPEEDS.map((s) => (
            <Text
              key={s}
              className={`chip${speed === s ? ' active' : ''}`}
              onClick={() => setSpeed(s)}
            >
              {tt(`ai.voice.speed.${s}`, speedLabel[s])}
            </Text>
          ))}
        </View>
        <View className="setting-row">
          <Text className="setting-label">{tt('ai.voice.timbre', '音色')}</Text>
          {TIMBRES.map((tb) => (
            <Text
              key={tb}
              className={`chip${timbre === tb ? ' active' : ''}`}
              onClick={() => setTimbre(tb)}
            >
              {tt(`ai.voice.timbre.${tb}`, timbreLabel[tb])}
            </Text>
          ))}
        </View>
      </View>

      <View className="input-bar">
        <View
          className={`voice-btn${recording ? ' recording' : ''}`}
          onTouchStart={onStartRecord}
          onTouchEnd={onStopRecord}
          onTouchCancel={onStopRecord}
        >
          {recording ? (
            <View className="voice-btn-wave">
              {[0, 1, 2, 3, 4, 5, 6].map((n) => (
                <View key={n} className={`wave-bar wave-bar-${n + 1}`} />
              ))}
            </View>
          ) : null}
          <Text className="voice-btn-text">
            {recording
              ? `${tt('ai.voice.releaseToSend', '松开发送')} · ${fmtDuration(displayDuration)}`
              : tt('ai.voice.holdToSpeak', '按住说话')}
          </Text>
        </View>
      </View>
    </View>
  )
}
