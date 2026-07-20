'use client'

import * as React from 'react'
import { Check, ChevronDown, ChevronRight, Copy } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Button } from '@ihui/ui'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/feedback'

export interface McpDataStructureProps {
  data: unknown
  name?: string
}

function getTypeLabel(v: unknown): string {
  if (v === null) return 'null'
  if (Array.isArray(v)) return 'array'
  return typeof v
}

function typeColor(type: string): string {
  switch (type) {
    case 'string':
      return 'text-emerald-600 dark:text-emerald-400'
    case 'number':
      return 'text-primary'
    case 'boolean':
      return 'text-amber-600 dark:text-amber-400'
    case 'null':
      return 'text-muted-foreground'
    case 'array':
      return 'text-purple-600 dark:text-purple-400'
    case 'object':
      return 'text-fuchsia-600 dark:text-fuchsia-400'
    default:
      return 'text-muted-foreground'
  }
}

interface TreeNodeProps {
  name?: string
  value: unknown
  depth: number
}

function TreeNode({ name, value, depth }: TreeNodeProps) {
  const [expanded, setExpanded] = React.useState(depth < 2)
  const type = getTypeLabel(value)
  const isContainer = type === 'object' || type === 'array'

  const entries: [string, unknown][] = React.useMemo(() => {
    if (type === 'array') return (value as unknown[]).map((v, i) => [String(i), v])
    if (type === 'object') return Object.entries(value as Record<string, unknown>)
    return []
  }, [value, type])

  return (
    <div className="text-sm">
      <div className="flex items-center gap-1 py-0.5">
        {isContainer ? (
          <button
            type="button"
            onClick={() => setExpanded((p) => !p)}
            className="flex items-center text-muted-foreground hover:text-foreground"
          >
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
        ) : (
          <span className="inline-block w-[14px]" />
        )}
        {name !== undefined && <span className="font-medium text-foreground">{name}:</span>}
        {isContainer ? (
          <span className={cn('text-xs', typeColor(type))}>
            {type}
            {entries.length > 0 && ` (${entries.length})`}
          </span>
        ) : (
          <span className={cn('font-mono', typeColor(type))}>
            {type === 'string' ? `"${String(value)}"` : String(value)}
          </span>
        )}
      </div>
      {isContainer && expanded && entries.length > 0 && (
        <div className="ml-4 border-l border-border pl-2">
          {entries.map(([k, v]) => (
            <TreeNode key={k} name={k} value={v} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

export function McpDataStructure({ data, name }: McpDataStructureProps) {
  const t = useTranslations('mcp')
  const [copied, setCopied] = React.useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard unavailable */
    }
  }

  const type = getTypeLabel(data)

  return (
    <div className="rounded-lg border bg-muted/30">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-2">
          {name && <span className="text-sm font-medium">{name}</span>}
          <span className={cn('text-xs', typeColor(type))}>{type}</span>
        </div>
        <Tooltip content={t('copy')}>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleCopy}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
        </Tooltip>
      </div>
      <div className="max-h-[400px] overflow-auto p-3">
        <TreeNode value={data} depth={0} />
      </div>
    </div>
  )
}
