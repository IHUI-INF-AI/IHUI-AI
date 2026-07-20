'use client'

import * as React from 'react'
import { Copy, Check } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

export interface QuickStartStep {
  title: string
  desc?: string
  code?: string
  language?: string
}

export interface QuickStartProps {
  steps?: QuickStartStep[]
  className?: string
}

const DEFAULT_STEPS: QuickStartStep[] = [
  {
    title: '1. 获取 API Key',
    desc: '在开发者中心创建应用，获取 AppKey 与 Secret。',
  },
  {
    title: '2. 安装 SDK',
    desc: '使用 npm 安装官方 SDK。',
    code: 'npm install @ihui/api-client',
    language: 'bash',
  },
  {
    title: '3. 发起调用',
    desc: '使用 AppKey 鉴权后即可发起请求。',
    code: `import { fetchApi } from '@ihui/api-client'\n\nconst res = await fetchApi('/v1/chat', { apiKey: 'YOUR_KEY' })\nconsole.log(res)`,
    language: 'ts',
  },
]

export default function QuickStart({
  steps = DEFAULT_STEPS,
  className,
}: QuickStartProps): React.JSX.Element {
  return (
    <ol className={cn('space-y-4', className)}>
      {steps.map((s, i) => (
        <li key={i} className="rounded-xl border bg-card p-4 shadow">
          <div className="text-sm font-medium">{s.title}</div>
          {s.desc && <p className="mt-1 text-xs text-muted-foreground">{s.desc}</p>}
          {s.code && <CodeBlock code={s.code} language={s.language} />}
        </li>
      ))}
    </ol>
  )
}

function CodeBlock({ code, language }: { code: string; language?: string }) {
  const t = useTranslations('a11y')
  const [copied, setCopied] = React.useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore
    }
  }
  return (
    <div className="relative mt-2 overflow-hidden rounded-md bg-muted">
      <button
        type="button"
        onClick={copy}
        className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
        aria-label={t('copy')}
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-emerald-500" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </button>
      {language && (
        <div className="border-b border-border/50 px-3 py-1 text-xs text-muted-foreground">
          {language}
        </div>
      )}
      <pre className="overflow-auto p-3 text-xs">
        <code>{code}</code>
      </pre>
    </div>
  )
}
