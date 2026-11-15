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
import { onToast } from '@/host/on-toast'

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
  normal: 'aiVoice.q1',
  fast: 'aiVoice.q2',
  slow: 'aiVoice.q3',
}

const TIMBRE_KEY: Record<string, string> = {
  female: 'aiVoice.q4',
  male: 'aiVoice.q5',
}

const WAVE_DELAYS = [0, 0.1, 0.2, 0.3, 0.4]

// 滚到底用的固定"远值":每次直接赋它(非累加),长会话里 scrollTop 不再无界增长。
// 取一个远超任何单屏内容高度、又远小于 ScrollView 数值可靠性上限的值。
const RELATIVE_JUMP_PX = 100000

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
  const audioRef = useRef<Taro.InnerAudioContext | null>(null)

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

  // recorder 监听只在挂载时绑一次:getRecorderManager 返回全局单例,若随 tt/t 重跑会反复 onStop/onError
  // 累积监听(旧闭包持废弃 tt 不释放)。文案/回调经 ref 间接取,保证绑定的 onStop/onError 永远读最新值。
  const ttRef = useRef(tt)
  ttRef.current = tt
  const stopTimerRef = useRef(stopTimer)
  stopTimerRef.current = stopTimer

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
          content: ttRef.current('ai.voice.voiceMessage', '[语音消息]'),
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
              onToast(ttRef.current('ai.voice.chatFailed', '对话失败,请重试'), { kind: 'error' })
            })
            .finally(() => setLoading(false))
        },
        fail: () => {
          onToast(ttRef.current('ai.voice.recordFailed', '录音失败,请重试'), { kind: 'error' })
          setLoading(false)
        },
      })
    }

    const onError = () => {
      onToast(ttRef.current('ai.voice.recordFailed', '录音失败,请重试'), { kind: 'error' })
      setRecording(false)
      setLoading(false)
      stopTimerRef.current()
    }

    recorder.onStop(onStop)
    recorder.onError(onError)

    return () => {
      stopTimerRef.current()
      // RecorderManager 是全局单例且无 offStop/offError:这里只清 timer 与引用。
      // 依赖为 [] ⇒ onStop/onError 全生命周期只挂一次,不存在累积监听。
      recorderRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 滚到底:每次赋一个固定远值而非累加。累加会在长会话里把 scrollTop 顶到千万级
  // (超出 ScrollView 可靠范围并触发整页重排);固定值每次都触发一次"跳到底",无累积。
  useEffect(() => {
    setScrollTop(RELATIVE_JUMP_PX)
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

  const destroyCurrentAudio = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    try {
      audio.stop()
      audio.destroy()
    } catch (e) {
      logger.error('ai/voice', 'destroy audio failed', e)
    }
    audioRef.current = null
  }, [])

  const onPlayAudio = useCallback(
    (msg: VoiceMessage, idx: number) => {
      if (!msg.audio || playingIdx === idx) {
        destroyCurrentAudio()
        setPlayingIdx(-1)
        return
      }
      destroyCurrentAudio()
      const audio = Taro.createInnerAudioContext()
      audioRef.current = audio
      audio.src = msg.audio
      setPlayingIdx(idx)
      audio.onEnded(() => {
        // 迟到事件不得误杀已切换的新 context
        if (audioRef.current !== audio) return
        destroyCurrentAudio()
        setPlayingIdx(-1)
      })
      audio.onError(() => {
        if (audioRef.current !== audio) return
        destroyCurrentAudio()
        setPlayingIdx(-1)
      })
      audio.play()
    },
    [playingIdx, destroyCurrentAudio],
  )

  useEffect(() => {
    return () => {
      destroyCurrentAudio()
    }
  }, [destroyCurrentAudio])

  const onClear = useCallback(() => {
    Taro.showModal({
      title: tt('ai.voice.clearChat', '清空对话'),
      content: tt('ai.voice.clearConfirm', '确定要清空当前对话吗?'),
      confirmText: t('common.confirm'),
      cancelText: t('common.cancel'),
      success: (res) => {
        if (!res.confirm) return
        setMessages([{ role: 'assistant', content: t('ai.voice.welcome') }])
        onToast(tt('ai.voice.cleared', '对话已清空'), { kind: 'info' })
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
        <Text className="text-title-lg text-foreground">{tt('ai.voice.title', 'AI 语音对话')}</Text>
        <View
          className="text-body-sm leading-[normal] text-muted-foreground"
          hoverClass="opacity-60"
          onClick={onClear}
        >
          <Text>{tt('ai.voice.clearChat', '清空对话')}</Text>
        </View>
      </View>

      <ScrollView className="flex-1 py-[24rpx] px-[32rpx]" scrollY scrollTop={scrollTop}>
        {messages.map((m, i) => (
          <View
            key={i}
            className={`flex mb-[20rpx] items-start ${m.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <View
              className={`max-w-[78%] mx-[20rpx] py-[20rpx] px-[28rpx] rounded-2xl ${m.role === 'user' ? 'bg-[var(--color-brand)]' : 'bg-card'}`}
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
                  <Text className="text-label text-foreground">{fmtDuration(m.duration || 0)}</Text>
                  <View className="flex items-center gap-[4rpx] h-[40rpx]">
                    {WAVE_DELAYS.map((delay, n) => (
                      <View
                        key={n}
                        className="w-[6rpx] h-[12rpx] bg-foreground rounded-xs animate-pulse"
                        style={{ animationDelay: `${delay}s` }}
                      />
                    ))}
                  </View>
                </View>
              ) : (
                <Text
                  className={`text-strong leading-[40rpx] ${m.role === 'user' ? 'text-[var(--color-surface-light)]' : 'text-foreground'}`}
                >
                  {m.content}
                </Text>
              )}
            </View>
          </View>
        ))}
        {loading ? (
          <View className="flex mb-[20rpx] items-start">
            <View className="max-w-[78%] mx-[20rpx] py-[20rpx] px-[28rpx] ui-bubble rounded-2xl bg-card">
              <View className="flex gap-[8rpx] items-center">
                <Text className="text-heading text-muted-foreground animate-pulse">·</Text>
                <Text
                  className="text-heading text-muted-foreground animate-pulse"
                  style={{ animationDelay: '0.2s' }}
                >
                  ·
                </Text>
                <Text
                  className="text-heading text-muted-foreground animate-pulse"
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
          <Text className="text-label text-muted-foreground w-[64rpx]">
            {tt('ai.voice.speed', '语速')}
          </Text>
          {SPEEDS.map((s) => (
            <View
              key={s}
              className={`py-[12rpx] px-[20rpx] rounded-lg text-label ${speed === s ? 'bg-[var(--color-surface-light)] border-[length:2rpx] border-brand-accent-deep text-primary font-medium' : 'bg-card text-muted-foreground'}`}
              onClick={() => setSpeed(s)}
              hoverClass="opacity-60"
            >
              <Text>{tt(SPEED_KEY[s] ?? 'aiVoice.q1', speedLabel[s])}</Text>
            </View>
          ))}
        </View>
        <View className="flex items-center gap-[12rpx] mb-[12rpx] last:mb-0">
          <Text className="text-label text-muted-foreground w-[64rpx]">
            {tt('ai.voice.timbre', '音色')}
          </Text>
          {TIMBRES.map((tb) => (
            <View
              key={tb}
              className={`py-[12rpx] px-[20rpx] rounded-lg text-label ${timbre === tb ? 'bg-[var(--color-surface-light)] border-[length:2rpx] border-brand-accent-deep text-primary font-medium' : 'bg-card text-muted-foreground'}`}
              onClick={() => setTimbre(tb)}
              hoverClass="opacity-60"
            >
              <Text>{tt(TIMBRE_KEY[tb] ?? 'aiVoice.q4', timbreLabel[tb])}</Text>
            </View>
          ))}
        </View>
      </View>

      <View className="py-[24rpx] px-[32rpx] pb-[calc(24rpx+env(safe-area-inset-bottom))] bg-card">
        <View
          className={`h-[120rpx] flex items-center justify-center gap-[16rpx] rounded-md ${recording ? 'bg-destructive' : 'bg-card'}`}
          onTouchStart={onStartRecord}
          onTouchEnd={onStopRecord}
          onTouchCancel={onStopRecord}
        >
          {recording ? (
            <View className="flex items-center gap-[6rpx] h-[48rpx]">
              {[0, 0.1, 0.2, 0.3, 0.4, 0.15, 0.25].map((delay, n) => (
                <View
                  key={n}
                  className="w-[6rpx] h-[12rpx] bg-foreground rounded-xs animate-pulse"
                  style={{ animationDelay: `${delay}s` }}
                />
              ))}
            </View>
          ) : null}
          <Text
            className={`text-body ${recording ? 'text-[var(--color-danger-foreground)]' : 'text-foreground'}`}
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
