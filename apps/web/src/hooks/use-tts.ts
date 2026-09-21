// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useLocale, useTranslations } from 'next-intl'

import { fetchRaw } from '@/lib/api'
import { toast } from '@/components/common'
import { plainTextForClipboard } from '@/components/ai/progress-sections/message-context-menu'

/** 与 apps/ai-service /api/voice/tts 的 MAX_TEXT_CHARS 对齐 */
const MAX_CHARS = 2000

/** 音色按界面语言选(均在 ai-service edge-tts 白名单内) */
const VOICE_BY_LOCALE: Record<string, string> = {
  'zh-CN': 'zh-CN-XiaoxiaoNeural',
  'zh-TW': 'zh-TW-HsiaoChenNeural',
  en: 'en-US-AriaNeural',
  ja: 'ja-JP-NanamiNeural',
  ko: 'ko-KR-SunHiNeural',
}

/** 全局当前朗读:开始新朗读前停掉上一条,避免多条消息同时出声 */
let activeStop: (() => void) | null = null

export interface UseTtsReturn {
  speaking: boolean
  /** 朗读(markdown 转纯文本;超 MAX_CHARS 截断并 toast 提示) */
  speak: (markdown: string) => Promise<void>
  stop: () => void
}

/** AI 回复朗读:调 ai-service /api/voice/tts(edge-tts,零 key)取 MP3 播放。 */
export function useTts(): UseTtsReturn {
  const t = useTranslations('chat')
  const locale = useLocale()
  const audioRef = React.useRef<HTMLAudioElement | null>(null)
  const urlRef = React.useRef<string | null>(null)
  const [speaking, setSpeaking] = React.useState(false)

  const release = React.useCallback(() => {
    audioRef.current?.pause()
    audioRef.current = null
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current)
      urlRef.current = null
    }
  }, [])

  const stop = React.useCallback(() => {
    release()
    setSpeaking(false)
    if (activeStop === stop) activeStop = null
  }, [release])

  const speak = React.useCallback(
    async (markdown: string) => {
      const text = plainTextForClipboard(markdown)
      if (!text) return
      activeStop?.()
      stop()
      activeStop = stop
      if (text.length > MAX_CHARS) {
        toast.info(t('message.readAloudTruncated', { max: MAX_CHARS }))
      }
      try {
        const blob = await fetchRaw('/api/voice/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: text.slice(0, MAX_CHARS),
            engine: 'edge',
            voice: VOICE_BY_LOCALE[locale] ?? VOICE_BY_LOCALE['zh-CN'],
          }),
        })
        const url = URL.createObjectURL(blob)
        urlRef.current = url
        const audio = new Audio(url)
        audio.onended = stop
        audio.onerror = stop
        audioRef.current = audio
        setSpeaking(true)
        await audio.play()
      } catch {
        release()
        setSpeaking(false)
        toast.error(t('message.readAloudFailed'))
      }
    },
    [locale, release, stop, t],
  )

  React.useEffect(() => () => release(), [release])

  return { speaking, speak, stop }
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
