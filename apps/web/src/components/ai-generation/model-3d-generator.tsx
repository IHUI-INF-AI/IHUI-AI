'use client'

import * as React from 'react'
import { Box, Download } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { GenerationFrame, PromptInput, OptionSelect, useGeneration } from './generation-base'

interface Model3DGeneratorProps {
  onGenerate?: (prompt: string, format: string) => Promise<string>
}

const FORMATS = [
  { value: 'glb', label: 'GLB' },
  { value: 'obj', label: 'OBJ' },
  { value: 'fbx', label: 'FBX' },
  { value: 'stl', label: 'STL' },
] as const

/** Model3DGenerator - 3D 模型生成器 */
export function Model3DGenerator({ onGenerate }: Model3DGeneratorProps) {
  const t = useTranslations('aiGeneration')
  const [prompt, setPrompt] = React.useState('')
  const [format, setFormat] = React.useState<string>('glb')
  const { result, start } = useGeneration<string>()

  const handleGenerate = () => {
    if (!prompt.trim()) return
    start(() => onGenerate?.(prompt, format) ?? Promise.resolve(''))
  }

  return (
    <GenerationFrame
      title={t('model3dTitle')}
      icon={<Box className="h-4 w-4 text-orange-500" />}
      status={result.status}
      error={result.error}
      onGenerate={handleGenerate}
      canGenerate={!!prompt.trim()}
      generateLabel={t('generateModel3d')}
      options={
        <OptionSelect label={t('format')} value={format} onChange={setFormat} options={FORMATS} />
      }
      result={
        result.status === 'success' && result.data ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 rounded-md bg-muted/30 p-2 text-xs">
              <Box className="h-4 w-4 text-orange-500" />
              <span className="font-mono">{result.data}</span>
            </div>
            <a
              href={result.data}
              download={`model.${format}`}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Download className="h-3 w-3" />
              {t('downloadModel')}
            </a>
          </div>
        ) : null
      }
    >
      <PromptInput
        value={prompt}
        onChange={setPrompt}
        placeholder={t('model3dPromptPlaceholder')}
      />
    </GenerationFrame>
  )
}

export default Model3DGenerator
