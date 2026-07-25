'use client'

import * as React from 'react'
import { Video, Download } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { GenerationFrame, PromptInput, OptionSelect, useGeneration } from './generation-base'
import type { VideoProvider } from '../ai/types'

interface VideoGeneratorProps {
  onGenerate?: (prompt: string, provider: VideoProvider, duration: number) => Promise<string>
}

const PROVIDERS: VideoProvider[] = ['qwen', 'kling', 'one-click']
const DURATIONS = ['5', '10', '30'] as const

/** i18n 静态映射表 — 用于消除 `t(\`provider.${var}\`)` / `t(\`duration.${var}\`)` 动态拼接 */
const PROVIDER_KEY: Record<VideoProvider, string> = {
  qwen: 'provider.qwen',
  kling: 'provider.kling',
  'one-click': 'provider.one-click',
}
const DURATION_KEY: Record<string, string> = {
  '5': 'duration.5',
  '10': 'duration.10',
  '30': 'duration.30',
}

/** VideoGenerator - 视频生成器 */
export function VideoGenerator({ onGenerate }: VideoGeneratorProps) {
  const t = useTranslations('videoGenerator')
  const [prompt, setPrompt] = React.useState('')
  const [provider, setProvider] = React.useState<VideoProvider>('qwen')
  const [duration, setDuration] = React.useState<string>('5')
  const { result, start } = useGeneration<string>()

  const handleGenerate = () => {
    if (!prompt.trim()) return
    start(() => onGenerate?.(prompt, provider, Number(duration)) ?? Promise.resolve(''))
  }

  return (
    <GenerationFrame
      title={t('title')}
      icon={<Video className="h-4 w-4 text-pink-500" />}
      status={result.status}
      error={result.error}
      onGenerate={handleGenerate}
      canGenerate={!!prompt.trim()}
      generateLabel={t('generate')}
      options={
        <div className="flex flex-wrap items-center gap-3">
          <OptionSelect
            label={t('providerLabel')}
            value={provider}
            onChange={setProvider}
            options={PROVIDERS.map((p) => ({ value: p, label: t(PROVIDER_KEY[p] ?? 'provider.unknown') }))}
          />
          <OptionSelect
            label={t('durationLabel')}
            value={duration}
            onChange={setDuration}
            options={DURATIONS.map((d) => ({ value: d, label: t(DURATION_KEY[d] ?? 'duration.unknown') }))}
          />
        </div>
      }
      result={
        result.status === 'success' && result.data ? (
          <div className="space-y-2">
            <video src={result.data} controls className="max-w-full rounded-md">
              <track kind="captions" />
            </video>
            <a
              href={result.data}
              download="generated-video"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Download className="h-3 w-3" />
              {t('download')}
            </a>
          </div>
        ) : null
      }
    >
      <PromptInput value={prompt} onChange={setPrompt} placeholder={t('placeholder')} />
    </GenerationFrame>
  )
}

export default VideoGenerator
