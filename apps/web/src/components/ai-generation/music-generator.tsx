'use client'

import * as React from 'react'
import { Music4, Download } from 'lucide-react'

import { GenerationFrame, PromptInput, OptionSelect, useGeneration } from './generation-base'

interface MusicGeneratorProps {
  onGenerate?: (prompt: string, genre: string, duration: number) => Promise<string>
}

const GENRES = [
  { value: 'pop', label: '流行' },
  { value: 'classical', label: '古典' },
  { value: 'electronic', label: '电子' },
  { value: 'jazz', label: '爵士' },
  { value: 'rock', label: '摇滚' },
] as const

const DURATIONS = [
  { value: '15', label: '15 秒' },
  { value: '30', label: '30 秒' },
  { value: '60', label: '60 秒' },
] as const

/** MusicGenerator - 音乐生成器 */
export function MusicGenerator({ onGenerate }: MusicGeneratorProps) {
  const [prompt, setPrompt] = React.useState('')
  const [genre, setGenre] = React.useState<string>('pop')
  const [duration, setDuration] = React.useState<string>('30')
  const { result, start } = useGeneration<string>()

  const handleGenerate = () => {
    if (!prompt.trim()) return
    start(() => onGenerate?.(prompt, genre, Number(duration)) ?? Promise.resolve(''))
  }

  return (
    <GenerationFrame
      title="音乐生成"
      icon={<Music4 className="h-4 w-4 text-fuchsia-500" />}
      status={result.status}
      error={result.error}
      onGenerate={handleGenerate}
      canGenerate={!!prompt.trim()}
      generateLabel="生成音乐"
      options={
        <div className="flex flex-wrap items-center gap-3">
          <OptionSelect label="风格" value={genre} onChange={setGenre} options={GENRES} />
          <OptionSelect label="时长" value={duration} onChange={setDuration} options={DURATIONS} />
        </div>
      }
      result={
        result.status === 'success' && result.data ? (
          <div className="space-y-2">
            <audio src={result.data} controls className="w-full" />
            <a
              href={result.data}
              download="generated-music"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Download className="h-3 w-3" />
              下载
            </a>
          </div>
        ) : null
      }
    >
      <PromptInput value={prompt} onChange={setPrompt} placeholder="描述要生成的音乐..." />
    </GenerationFrame>
  )
}

export default MusicGenerator
