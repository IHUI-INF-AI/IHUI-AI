'use client'

import * as React from 'react'
import { Video, Download } from 'lucide-react'

import { GenerationFrame, PromptInput, OptionSelect, useGeneration } from './generation-base'
import type { VideoProvider } from '../ai/types'

interface VideoGeneratorProps {
  onGenerate?: (prompt: string, provider: VideoProvider, duration: number) => Promise<string>
}

const PROVIDERS: Array<{ value: VideoProvider; label: string }> = [
  { value: 'qwen', label: '通义千问' },
  { value: 'kling', label: '可灵' },
  { value: 'one-click', label: '一键生成' },
]

const DURATIONS = [
  { value: '5', label: '5 秒' },
  { value: '10', label: '10 秒' },
  { value: '30', label: '30 秒' },
] as const

/** VideoGenerator - 视频生成器 */
export function VideoGenerator({ onGenerate }: VideoGeneratorProps) {
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
      title="视频生成"
      icon={<Video className="h-4 w-4 text-pink-500" />}
      status={result.status}
      error={result.error}
      onGenerate={handleGenerate}
      canGenerate={!!prompt.trim()}
      generateLabel="生成视频"
      options={
        <div className="flex flex-wrap items-center gap-3">
          <OptionSelect label="服务商" value={provider} onChange={setProvider} options={PROVIDERS} />
          <OptionSelect label="时长" value={duration} onChange={setDuration} options={DURATIONS} />
        </div>
      }
      result={
        result.status === 'success' && result.data ? (
          <div className="space-y-2">
            <video src={result.data} controls className="max-w-full rounded-md" />
            <a
              href={result.data}
              download="generated-video"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Download className="h-3 w-3" />
              下载
            </a>
          </div>
        ) : null
      }
    >
      <PromptInput value={prompt} onChange={setPrompt} placeholder="描述要生成的视频..." />
    </GenerationFrame>
  )
}

export default VideoGenerator
