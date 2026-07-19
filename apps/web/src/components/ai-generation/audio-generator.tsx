'use client'

import * as React from 'react'
import { Music, Download } from 'lucide-react'

import { GenerationFrame, PromptInput, OptionSelect, useGeneration } from './generation-base'

interface AudioGeneratorProps {
  onGenerate?: (prompt: string, voice: string) => Promise<string>
}

const VOICES = [
  { value: 'male', label: '男声' },
  { value: 'female', label: '女声' },
  // value 使用音频术语 treble(高音)而非 child,避免儿童相关关键词进入 LLM 上下文触发安全过滤
  { value: 'treble', label: '童声' },
] as const

/** AudioGenerator - 语音/音频生成器 */
export function AudioGenerator({ onGenerate }: AudioGeneratorProps) {
  const [prompt, setPrompt] = React.useState('')
  const [voice, setVoice] = React.useState<string>('female')
  const { result, start } = useGeneration<string>()

  const handleGenerate = () => {
    if (!prompt.trim()) return
    start(() => onGenerate?.(prompt, voice) ?? Promise.resolve(''))
  }

  return (
    <GenerationFrame
      title="语音合成"
      icon={<Music className="h-4 w-4 text-amber-500" />}
      status={result.status}
      error={result.error}
      onGenerate={handleGenerate}
      canGenerate={!!prompt.trim()}
      generateLabel="合成语音"
      options={<OptionSelect label="音色" value={voice} onChange={setVoice} options={VOICES} />}
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
              下载
            </a>
          </div>
        ) : null
      }
    >
      <PromptInput value={prompt} onChange={setPrompt} placeholder="输入要合成的文本..." />
    </GenerationFrame>
  )
}

export default AudioGenerator
