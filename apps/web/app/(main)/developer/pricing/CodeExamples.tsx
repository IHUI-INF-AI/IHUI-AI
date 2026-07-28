'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Code2, Copy, Terminal, Check } from 'lucide-react'
import { toast } from 'sonner'

import { Card, CardContent, Button } from '@ihui/ui-react'
import { cn } from '@/lib/utils'

type LangKey = 'curl' | 'node' | 'python'

interface LangConfig {
  key: LangKey
  labelKey: string
  icon: typeof Terminal
}

const LANGS: LangConfig[] = [
  { key: 'curl', labelKey: 'langCurl', icon: Terminal },
  { key: 'node', labelKey: 'langNode', icon: Code2 },
  { key: 'python', labelKey: 'langPython', icon: Code2 },
]

export function CodeExamples(): React.JSX.Element {
  const t = useTranslations('developerPricingPage')
  const [active, setActive] = React.useState<LangKey>('curl')
  const [copied, setCopied] = React.useState<LangKey | null>(null)

  const codeKeys: Record<LangKey, string> = {
    curl: 'codeCurl',
    node: 'codeNode',
    python: 'codePython',
  }

  function copyCode(lang: LangKey) {
    const code = t(codeKeys[lang])
    navigator.clipboard?.writeText(code).then(
      () => {
        setCopied(lang)
        toast.success(t('toastCopied'))
        setTimeout(() => setCopied(null), 1500)
      },
      () => toast.error(t('toastCopyFailed')),
    )
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <Code2 className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold">{t('examplesTitle')}</p>
        </div>

        <p className="text-xs text-muted-foreground">{t('examplesSubtitle')}</p>

        <div className="flex flex-wrap gap-1.5">
          {LANGS.map((l) => {
            const Icon = l.icon
            return (
              <Button
                key={l.key}
                size="sm"
                variant={active === l.key ? 'default' : 'outline'}
                onClick={() => setActive(l.key)}
                className="h-7"
              >
                <Icon className="h-3.5 w-3.5" />
                {t(l.labelKey)}
              </Button>
            )
          })}
        </div>

        <div className="relative">
          <pre
            className={cn(
              'overflow-x-auto rounded-md bg-zinc-950 p-3 text-xs leading-relaxed text-zinc-100',
              'dark:bg-zinc-900',
            )}
          >
            <code className="font-mono">{t(codeKeys[active])}</code>
          </pre>
          <button
            onClick={() => copyCode(active)}
            className="absolute right-2 top-2 rounded-md bg-zinc-800 p-1.5 text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-zinc-100"
            aria-label={t('copyAria')}
          >
            {copied === active ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        </div>

        <p className="text-xs text-muted-foreground">
          {t('examplesTip')}
        </p>
      </CardContent>
    </Card>
  )
}
