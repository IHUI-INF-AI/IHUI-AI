'use client'

import * as React from 'react'

export interface SpeechConfig {
  lang: string
  rate: number
  pitch: number
  volume: number
  voiceURI: string | null
}

export interface UseSpeechConfigReturn {
  config: SpeechConfig
  voices: SpeechSynthesisVoice[]
  supported: boolean
  update: (patch: Partial<SpeechConfig>) => void
  reset: () => void
}

const DEFAULT_CONFIG: SpeechConfig = {
  lang: 'zh-CN',
  rate: 1,
  pitch: 1,
  volume: 1,
  voiceURI: null,
}

/** 语音配置 Hook，加载可用声音列表并管理配置 */
export function useSpeechConfig(): UseSpeechConfigReturn {
  const [config, setConfig] = React.useState<SpeechConfig>(DEFAULT_CONFIG)
  const [voices, setVoices] = React.useState<SpeechSynthesisVoice[]>([])

  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window

  React.useEffect(() => {
    if (!supported) return
    const loadVoices = () => {
      const list = window.speechSynthesis.getVoices()
      setVoices(list)
      setConfig((prev) =>
        prev.voiceURI
          ? prev
          : { ...prev, voiceURI: list.find((v) => v.lang.startsWith(prev.lang))?.voiceURI ?? null },
      )
    }
    loadVoices()
    window.speechSynthesis.onvoiceschanged = loadVoices
    return () => {
      window.speechSynthesis.onvoiceschanged = null
    }
  }, [supported])

  const update = React.useCallback((patch: Partial<SpeechConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }))
  }, [])

  const reset = React.useCallback(() => setConfig(DEFAULT_CONFIG), [])

  return { config, voices, supported, update, reset }
}
