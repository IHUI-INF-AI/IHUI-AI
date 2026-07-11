'use client'

import * as React from 'react'
import Image from 'next/image'
import { Image as ImageIcon, Download } from 'lucide-react'

import { GenerationFrame, PromptInput, OptionSelect, useGeneration } from './generation-base'
import type { ImageProvider } from '../ai/types'

interface ImageGeneratorProps {
  onGenerate?: (prompt: string, provider: ImageProvider, size: string) => Promise<string>
}

const PROVIDERS: Array<{ value: ImageProvider; label: string }> = [
  { value: 'qwen', label: '通义千问' },
  { value: 'doubao', label: '豆包' },
  { value: 'jimeng', label: '即梦' },
]

const SIZES = [
  { value: '512x512', label: '512×512' },
  { value: '1024x1024', label: '1024×1024' },
  { value: '1024x576', label: '1024×576' },
] as const

/** ImageGenerator - 图像生成器 */
export function ImageGenerator({ onGenerate }: ImageGeneratorProps) {
  const [prompt, setPrompt] = React.useState('')
  const [provider, setProvider] = React.useState<ImageProvider>('qwen')
  const [size, setSize] = React.useState<string>('1024x1024')
  const { result, start } = useGeneration<string>()

  const handleGenerate = () => {
    if (!prompt.trim()) return
    start(() => onGenerate?.(prompt, provider, size) ?? Promise.resolve(''))
  }

  return (
    <GenerationFrame
      title="图像生成"
      icon={<ImageIcon className="h-4 w-4 text-violet-500" />}
      status={result.status}
      error={result.error}
      onGenerate={handleGenerate}
      canGenerate={!!prompt.trim()}
      generateLabel="生成图像"
      options={
        <div className="flex flex-wrap items-center gap-3">
          <OptionSelect
            label="服务商"
            value={provider}
            onChange={setProvider}
            options={PROVIDERS}
          />
          <OptionSelect label="尺寸" value={size} onChange={setSize} options={SIZES} />
        </div>
      }
      result={
        result.status === 'success' && result.data ? (
          <div className="space-y-2">
            <Image
              src={result.data}
              alt={prompt}
              width={800}
              height={600}
              unoptimized
              className="h-auto max-w-full rounded-md"
            />
            <a
              href={result.data}
              download="generated-image"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Download className="h-3 w-3" />
              下载
            </a>
          </div>
        ) : null
      }
    >
      <PromptInput value={prompt} onChange={setPrompt} placeholder="描述要生成的图像..." />
    </GenerationFrame>
  )
}

export default ImageGenerator
