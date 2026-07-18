'use client'

import * as React from 'react'
import { Code2, Copy, Check } from 'lucide-react'
import { useTheme } from 'next-themes'
import SyntaxHighlighter from '@/components/media/SyntaxHighlighter'
// P2 中期增强:按主题切换语法高亮样式(dark → oneDark,其他 → oneLight)
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'

import { GenerationFrame, PromptInput, OptionSelect, useGeneration } from './generation-base'

/**
 * 代码块展示层(React.memo 包裹)。
 * 接收已解析的 syntaxStyle 作为 prop,避免每次主题切换都重渲染整块代码块。
 * 与 markdown-stream 同款方案,确保增量解析场景下不必要的重渲染被跳过。
 */
function CodeBlockImpl({
  code,
  language,
  syntaxStyle,
  onCopy,
  copied,
}: {
  code: string
  language: string
  syntaxStyle: Record<string, React.CSSProperties>
  onCopy: () => void
  copied: boolean
}): React.ReactElement {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onCopy}
        className="absolute right-2 top-2 z-10 inline-flex h-7 w-7 items-center justify-center rounded-md bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
      <SyntaxHighlighter
        language={language}
        style={syntaxStyle}
        PreTag="div"
        customStyle={{ margin: 0, borderRadius: '0.375rem', fontSize: '0.8rem' }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  )
}

// React.memo 包裹:code/language/syntaxStyle/copied 不变时跳过重渲染
// P2 中期增强:与 markdown-stream 同款方案,防止主题切换时整块代码块重渲染
const CodeBlock = React.memo(CodeBlockImpl)

/**
 * 主题感知包装层:在 useTheme hook 中读取 resolvedTheme,转成 syntaxStyle 注入 CodeBlock。
 * 不放在 CodeBlockImpl 内部:React.memo 会因 props 未变而跳过重渲染,
 * 导致主题切换时样式不更新。提升 syntaxStyle 为 prop 后,memo 能在引用变化时正常触发更新。
 */
function ThemedCodeBlock(props: {
  code: string
  language: string
  onCopy: () => void
  copied: boolean
}): React.ReactElement {
  const { resolvedTheme } = useTheme()
  const syntaxStyle = resolvedTheme === 'dark' ? oneDark : oneLight
  return <CodeBlock {...props} syntaxStyle={syntaxStyle} />
}

interface CodeGeneratorProps {
  onGenerate?: (prompt: string, language: string) => Promise<string>
}

// 单一来源:与顶部 LANGUAGES 元组同源(顶层 12 项的子集),避免两处定义不同步
const LANGUAGE_OPTIONS = [
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
        <OptionSelect
          label="语言"
          value={language}
          onChange={setLanguage}
          options={LANGUAGE_OPTIONS}
        />
      }
      result={
        result.status === 'success' && result.data ? (
          <ThemedCodeBlock
            code={result.data}
            language={language}
            onCopy={handleCopy}
            copied={copied}
          />
        ) : null
      }
    >
      <PromptInput value={prompt} onChange={setPrompt} placeholder="描述要生成的代码功能..." />
    </GenerationFrame>
  )
}

export default CodeGenerator
