'use client'

import * as React from 'react'
import { Loader2, Radio } from 'lucide-react'
import { cn } from '@ihui/ui-react'
import type { TokenEvent } from '@/hooks/use-agent-runtime'

interface Props {
  tokens: TokenEvent[]
  connected?: boolean
  running?: boolean
}

const MAX_TOKENS = 1000

const TYPE_COLOR: Record<TokenEvent['type'], string> = {
  content: 'text-foreground',
  tool_call: 'text-sky-600 dark:text-sky-400',
  tool_result: 'text-emerald-600 dark:text-emerald-500',
}

export function TokenStream({ tokens, connected, running }: Props) {
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const visible =
    tokens.length > MAX_TOKENS ? tokens.slice(tokens.length - MAX_TOKENS) : tokens

  React.useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [visible.length])

  return (
    <div className="flex h-full flex-col rounded-lg border bg-card">
      <div className="flex items-center gap-2 px-3 py-2 text-sm">
        {connected ? (
          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-500">
            <Radio className="h-3.5 w-3.5 animate-pulse" /> 实时流
          </span>
        ) : running ? (
          <span className="flex items-center gap-1 text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> 连接中...
          </span>
        ) : (
          <span className="flex items-center gap-1 text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-sm bg-muted-foreground/50" /> 未运行
          </span>
        )}
        <span className="text-xs text-muted-foreground">{tokens.length} tokens</span>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-auto px-3 py-2">
        {visible.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">暂无 token 流</div>
        ) : (
          <div className="flex flex-wrap gap-x-1 gap-y-0.5 text-xs leading-relaxed">
            {visible.map((t) => (
              <span
                key={t.id}
                className={cn('whitespace-pre-wrap break-words', TYPE_COLOR[t.type])}
              >
                {t.value}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
