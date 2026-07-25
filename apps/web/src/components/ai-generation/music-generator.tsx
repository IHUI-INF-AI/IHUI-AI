'use client'

import * as React from 'react'
import { Music4, Download } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { GenerationFrame, PromptInput, OptionSelect, useGeneration } from './generation-base'

interface MusicGeneratorProps {
  onGenerate?: (prompt: string, genre: string, duration: number) => Promise<string>
}

const GENRES = ['pop', 'classical', 'electronic', 'jazz', 'rock'] as const
const DURATIONS = ['15', '30', '60'] as const

/** i18n 静态映射表 — 用于消除 `t(\`genre.${var}\`)` / `t(\`duration.${var}\`)` 动态拼接 */
const GENRE_KEY: Record<string, string> = {
  pop: 'genre.pop',
  classical: 'genre.classical',
  electronic: 'genre.electronic',
  jazz: 'genre.jazz',
  rock: 'genre.rock',
}
const DURATION_KEY: Record<string, string> = {
  '15': 'duration.15',
  '30': 'duration.30',
  '60': 'duration.60',
}

/** MusicGenerator - 音乐生成器 */
export function MusicGenerator({ onGenerate }: MusicGeneratorProps) {
  const t = useTranslations('musicGenerator')
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
      title={t('title')}
      icon={<Music4 className="h-4 w-4 text-fuchsia-500" />}
      status={result.status}
      error={result.error}
      onGenerate={handleGenerate}
      canGenerate={!!prompt.trim()}
      generateLabel={t('generate')}
      options={
        <div className="flex flex-wrap items-center gap-3">
          <OptionSelect
            label={t('genreLabel')}
            value={genre}
            onChange={setGenre}
            options={GENRES.map((g) => ({ value: g, label: t(GENRE_KEY[g] ?? 'genre.unknown') }))}
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
            <audio src={result.data} controls className="w-full">
              <track kind="captions" />
            </audio>
            <a
              href={result.data}
              download="generated-music"
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

export default MusicGenerator
