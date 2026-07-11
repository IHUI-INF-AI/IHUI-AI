'use client'

import * as React from 'react'
import { Code2, Copy, Check } from 'lucide-react'
import SyntaxHighlighter from '@/components/media/SyntaxHighlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'

import { GenerationFrame, PromptInput, OptionSelect, useGeneration } from './generation-base'

interface CodeGeneratorProps {
  onGenerate?: (prompt: string, language: string) => Promise<string>
}

const LANGUAGES = [
  { value: 'typescript', label: 'TypeScript' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'python', label: 'Python' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'java', label: 'Java' },
] as const

/** CodeGenerator - 代码生成器 */
export function CodeGenerator({ onGenerate }: CodeGeneratorProps) {
  const [prompt, setPrompt] = React.useState('')
  const [language, setLanguage] = React.useState<string>('typescript')
  const [copied, setCopied] = React.useState(false)
  const { result, start } = useGeneration<string>()

  const handleGenerate = () => {
    if (!prompt.trim()) return
    start(() => onGenerate?.(prompt, language) ?? Promise.resolve(''))
  }

  const handleCopy = async () => {
    if (!result.data) return
    try {
      await navigator.clipboard.writeText(result.data)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore
    }
  }

  return (
    <GenerationFrame
      title="代码生成"
      icon={<Code2 className="h-4 w-4 text-emerald-500" />}
      status={result.status}
      error={result.error}
      onGenerate={handleGenerate}
      canGenerate={!!prompt.trim()}
      generateLabel="生成代码"
      options={
        <OptionSelect label="语言" value={language} onChange={setLanguage} options={LANGUAGES} />
      }
      result={
        result.status === 'success' && result.data ? (
          <div className="relative">
            <button
              type="button"
              onClick={handleCopy}
              className="absolute right-2 top-2 z-10 inline-flex h-7 w-7 items-center justify-center rounded-md bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
            <SyntaxHighlighter
              language={language}
              style={oneDark}
              PreTag="div"
              customStyle={{ margin: 0, borderRadius: '0.375rem', fontSize: '0.8rem' }}
            >
              {result.data}
            </SyntaxHighlighter>
          </div>
        ) : null
      }
    >
      <PromptInput value={prompt} onChange={setPrompt} placeholder="描述要生成的代码功能..." />
    </GenerationFrame>
  )
}

export default CodeGenerator
