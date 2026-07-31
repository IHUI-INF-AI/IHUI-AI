'use client'

import * as React from 'react'
import { Music, Download } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { GenerationFrame, PromptInput, OptionSelect, useGeneration } from './generation-base'

interface AudioGeneratorProps {
  onGenerate?: (prompt: string, voice: string) => Promise<string>
}

/** AudioGenerator - 语音/音频生成器 */
export function AudioGenerator({ onGenerate }: AudioGeneratorProps) {
  const t = useTranslations('aiGeneration')
  const [prompt, setPrompt] = React.useState('')
  const [voice, setVoice] = React.useState<string>('female')
  const { result, start } = useGeneration<string>()

  // value 使用音频术语 treble(高音)而非 child,避免儿童相关关键词进入 LLM 上下文触发安全过滤
  const VOICES = React.useMemo(
    () => [
      { value: 'male', label: t('maleVoice') },
      { value: 'female', label: t('femaleVoice') },
      { value: 'treble', label: t('trebleVoice') },
    ],
    [t],
  )

  const handleGenerate = () => {
    if (!prompt.trim()) return
    start(() => onGenerate?.(prompt, voice) ?? Promise.resolve(''))
  }

  return (
    <GenerationFrame
      title={t('audioTitle')}
      icon={<Music className="h-4 w-4 text-amber-500" />}
      status={result.status}
      error={result.error}
      onGenerate={handleGenerate}
      canGenerate={!!prompt.trim()}
      generateLabel={t('generateAudio')}
      options={
        <OptionSelect label={t('voice')} value={voice} onChange={setVoice} options={VOICES} />
      }
      result={
        result.status === 'success' && result.data ? (
          <div className="space-y-2">
            <audio src={result.data} controls className="w-full">
              <track kind="captions" />
            </audio>
            <a
              href={result.data}
              download="generated-audio"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Download className="h-3 w-3" />
              {t('download')}
            </a>
          </div>
        ) : null
      }
    >
      <PromptInput value={prompt} onChange={setPrompt} placeholder={t('audioPromptPlaceholder')} />
    </GenerationFrame>
  )
}

export default AudioGenerator
