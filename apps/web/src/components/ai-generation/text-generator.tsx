'use client'

import * as React from 'react'
import { FileText } from 'lucide-react'

import { GenerationFrame, PromptInput, OptionSelect, useGeneration } from './generation-base'

interface TextGeneratorProps {
  onGenerate?: (prompt: string, style: string) => Promise<string>
}

const STYLES = [
  { value: 'normal', label: '普通' },
  { value: 'formal', label: '正式' },
  { value: 'creative', label: '创意' },
  { value: 'academic', label: '学术' },
] as const

/** TextGenerator - 文本生成器 */
export function TextGenerator({ onGenerate }: TextGeneratorProps) {
  const [prompt, setPrompt] = React.useState('')
  const [style, setStyle] = React.useState<string>('normal')
  const { result, start } = useGeneration<string>()

  const handleGenerate = () => {
    if (!prompt.trim()) return
    start(() => onGenerate?.(prompt, style) ?? Promise.resolve(''))
  }

  return (
    <GenerationFrame
      title="文本生成"
      icon={<FileText className="h-4 w-4 text-primary" />}
      status={result.status}
      error={result.error}
      onGenerate={handleGenerate}
      canGenerate={!!prompt.trim()}
      options={<OptionSelect label="风格" value={style} onChange={setStyle} options={STYLES} />}
      result={
        result.status === 'success' && result.data ? (
          <p className="whitespace-pre-wrap text-sm">{result.data}</p>
        ) : null
      }
    >
      <PromptInput value={prompt} onChange={setPrompt} placeholder="描述要生成的文本..." />
    </GenerationFrame>
  )
}

export default TextGenerator
