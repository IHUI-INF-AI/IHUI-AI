'use client'

import * as React from 'react'
import { FileText } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { GenerationFrame, PromptInput, OptionSelect, useGeneration } from './generation-base'

interface TextGeneratorProps {
  onGenerate?: (prompt: string, style: string) => Promise<string>
}

/** TextGenerator - 文本生成器 */
export function TextGenerator({ onGenerate }: TextGeneratorProps) {
  const t = useTranslations('aiGeneration')
  const [prompt, setPrompt] = React.useState('')
  const [style, setStyle] = React.useState<string>('normal')
  const { result, start } = useGeneration<string>()

  const STYLES = React.useMemo(
    () => [
      { value: 'normal', label: t('styleNormal') },
      { value: 'formal', label: t('styleFormal') },
      { value: 'creative', label: t('styleCreative') },
      { value: 'academic', label: t('styleAcademic') },
    ],
    [t],
  )

  const handleGenerate = () => {
    if (!prompt.trim()) return
    start(() => onGenerate?.(prompt, style) ?? Promise.resolve(''))
  }

  return (
    <GenerationFrame
      title={t('textTitle')}
      icon={<FileText className="h-4 w-4 text-primary" />}
      status={result.status}
      error={result.error}
      onGenerate={handleGenerate}
      canGenerate={!!prompt.trim()}
      generateLabel={t('generateText')}
      options={
        <OptionSelect label={t('style')} value={style} onChange={setStyle} options={STYLES} />
      }
      result={
        result.status === 'success' && result.data ? (
          <p className="whitespace-pre-wrap text-sm">{result.data}</p>
        ) : null
      }
    >
      <PromptInput value={prompt} onChange={setPrompt} placeholder={t('textPromptPlaceholder')} />
    </GenerationFrame>
  )
}

export default TextGenerator
