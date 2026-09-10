// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useI18n, t } from '@/i18n'
import { logger } from '@/utils/logger'
import { View, Text, ScrollView } from '@tarojs/components'
import LineIcon from '@/components/LineIcon'
import Taro, { useShareAppMessage } from '@tarojs/taro'
import { useState, useEffect, useRef, useCallback } from 'react'
import { voiceChat, type ChatMessage } from '@/api'
import ThemeRoot from '@/components/ThemeRoot'

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

const speedLabel: Record<Speed, string> = {
  normal: t('aiVoice.q1'),
  fast: t('aiVoice.q2'),
  slow: t('aiVoice.q3'),
}
const timbreLabel: Record<Timbre, string> = { female: t('aiVoice.q4'), male: t('aiVoice.q5') }

const SPEED_KEY: Record<string, string> = {
  normal: 'ai.voice.speed.normal',
  fast: 'ai.voice.speed.fast',
  slow: 'ai.voice.speed.slow',
}

const TIMBRE_KEY: Record<string, string> = {
  female: 'ai.voice.timbre.female',
  male: 'ai.voice.timbre.male',
}

const WAVE_DELAYS = [0, 0.1, 0.2, 0.3, 0.4]

export default function VoicePage() {
  const { t } = useI18n()
  const tt = useCallback((k: string, fb: string) => (t(k) === k ? fb : t(k)), [t])

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
              logger.error('ai/voice', t('aiVoice.q6'), e)
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
  }, [tt, stopTimer, t])

  useEffect(() => {
    setScrollTop((s) => s + 100000)
  }, [messages.length, loading])

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

  const onPlayAudio = useCallback(
    (msg: VoiceMessage, idx: number) => {
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
    },
    [playingIdx],
  )

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
    path: '/pkg-ai/ai/voice',
  }))

  const fmtDuration = (sec: number) => `${sec}"`

  return (
    <ThemeRoot className="flex flex-col h-screen bg-background">
      <View className="flex items-center justify-between pt-[120rpx] px-[32rpx] pb-[24rpx] bg-card">
        <Text className="text-[34rpx] font-semibold text-foreground">
          {tt('ai.voice.title', 'AI 语音对话')}
        </Text>
        <Text className="text-[26rpx] text-muted-foreground" onClick={onClear}>
          {tt('ai.voice.clearChat', '清空对话')}
        </Text>
      </View>

      <ScrollView className="flex-1 py-[24rpx] px-[32rpx]" scrollY scrollTop={scrollTop}>
        {messages.map((m, i) => (
          <View
            key={i}
            className={`flex mb-[20rpx] items-start ${m.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <View
              className={`max-w-[78%] mx-[20rpx] py-[20rpx] px-[28rpx] rounded-[32rpx] ${m.role === 'user' ? 'bg-[var(--color-brand)]' : 'bg-card'}`}
            >
              {m.isVoice ? (
                <View
                  className="flex items-center gap-[12rpx]"
                  onClick={() => onPlayAudio(m, i)}
                  hoverClass="opacity-60"
                >
                  <LineIcon
                    name={playingIdx === i ? 'pause' : 'play'}
                    size={32}
                    color="var(--color-muted-foreground)"
                  />
                  <Text className="text-[24rpx] text-foreground">
                    {fmtDuration(m.duration || 0)}
                  </Text>
                  <View className="flex items-center gap-[4rpx] h-[40rpx]">
                    {WAVE_DELAYS.map((delay, n) => (
                      <View
                        key={n}
                        className="w-[6rpx] h-[12rpx] bg-foreground rounded-[3rpx] animate-pulse"
                        style={{ animationDelay: `${delay}s` }}
                      />
                    ))}
                  </View>
                </View>
              ) : (
                <Text
                  className={`text-[30rpx] leading-[40rpx] ${m.role === 'user' ? 'text-[var(--color-surface-light)]' : 'text-foreground'}`}
                >
                  {m.content}
                </Text>
              )}
            </View>
          </View>
        ))}
        {loading ? (
          <View className="flex mb-[20rpx] items-start">
            <View className="max-w-[78%] mx-[20rpx] py-[20rpx] px-[28rpx] rounded-[32rpx] bg-card">
              <View className="flex gap-[8rpx] items-center">
                <Text className="text-[40rpx] text-muted-foreground animate-pulse">·</Text>
                <Text
                  className="text-[40rpx] text-muted-foreground animate-pulse"
                  style={{ animationDelay: '0.2s' }}
                >
                  ·
                </Text>
                <Text
                  className="text-[40rpx] text-muted-foreground animate-pulse"
                  style={{ animationDelay: '0.4s' }}
                >
                  ·
                </Text>
              </View>
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View className="py-[16rpx] px-[32rpx] bg-card">
        <View className="flex items-center gap-[12rpx] mb-[12rpx] last:mb-0">
          <Text className="text-[24rpx] text-muted-foreground w-[64rpx]">
            {tt('ai.voice.speed', '语速')}
          </Text>
          {SPEEDS.map((s) => (
            <Text
              key={s}
              className={`py-[12rpx] px-[20rpx] rounded-[16rpx] text-[24rpx] ${speed === s ? 'bg-[var(--color-surface-light)] border-[2rpx] border-primary text-primary font-medium' : 'bg-card text-muted-foreground'}`}
              onClick={() => setSpeed(s)}
            >
              {tt(SPEED_KEY[s] ?? 'ai.voice.speed.normal', speedLabel[s])}
            </Text>
          ))}
        </View>
        <View className="flex items-center gap-[12rpx] mb-[12rpx] last:mb-0">
          <Text className="text-[24rpx] text-muted-foreground w-[64rpx]">
            {tt('ai.voice.timbre', '音色')}
          </Text>
          {TIMBRES.map((tb) => (
            <Text
              key={tb}
              className={`py-[12rpx] px-[20rpx] rounded-[16rpx] text-[24rpx] ${timbre === tb ? 'bg-[var(--color-surface-light)] border-[2rpx] border-primary text-primary font-medium' : 'bg-card text-muted-foreground'}`}
              onClick={() => setTimbre(tb)}
            >
              {tt(TIMBRE_KEY[tb] ?? 'ai.voice.timbre.female', timbreLabel[tb])}
            </Text>
          ))}
        </View>
      </View>

      <View className="py-[24rpx] px-[32rpx] pb-[calc(24rpx+env(safe-area-inset-bottom))] bg-card">
        <View
          className={`h-[120rpx] flex items-center justify-center gap-[16rpx] rounded-[12rpx] ${recording ? 'bg-destructive' : 'bg-card'}`}
          onTouchStart={onStartRecord}
          onTouchEnd={onStopRecord}
          onTouchCancel={onStopRecord}
        >
          {recording ? (
            <View className="flex items-center gap-[6rpx] h-[48rpx]">
              {[0, 0.1, 0.2, 0.3, 0.4, 0.15, 0.25].map((delay, n) => (
                <View
                  key={n}
                  className="w-[6rpx] h-[12rpx] bg-foreground rounded-[3rpx] animate-pulse"
                  style={{ animationDelay: `${delay}s` }}
                />
              ))}
            </View>
          ) : null}
          <Text
            className={`text-[28rpx] ${recording ? 'text-[var(--color-danger-foreground)]' : 'text-foreground'}`}
          >
            {recording
              ? `${tt('ai.voice.releaseToSend', '松开发送')} · ${fmtDuration(displayDuration)}`
              : tt('ai.voice.holdToSpeak', '按住说话')}
          </Text>
        </View>
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
