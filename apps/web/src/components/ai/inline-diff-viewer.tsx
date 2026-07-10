'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface InlineDiffViewerProps {
  content: string
  filename?: string
}

interface DiffLine {
  type: 'add' | 'del' | 'context'
  text: string
  num: number
}

export function InlineDiffViewer({ content, filename }: InlineDiffViewerProps) {
  const lines = React.useMemo<DiffLine[]>(() => {
    const rawLines = content.split('\n')
    let num = 0
    return rawLines.map((line) => {
      const first = line[0] ?? ''
      if (first === '+') {
        num++
        return { type: 'add' as const, text: line.slice(1), num }
      }
      if (first === '-') {
        return { type: 'del' as const, text: line.slice(1), num }
      }
      num++
      return { type: 'context' as const, text: line, num }
    })
  }, [content])

  return (
    <div className="overflow-hidden rounded-lg border bg-zinc-950">
      {filename && (
        <div className="border-b border-zinc-800 px-3 py-2">
          <span className="text-xs font-medium text-zinc-300">{filename}</span>
        </div>
      )}
      <div className="overflow-x-auto font-mono text-xs">
        {lines.map((line, idx) => (
          <div
            key={idx}
            className={cn(
              'flex',
              line.type === 'add' && 'bg-green-500/15',
              line.type === 'del' && 'bg-red-500/15',
            )}
          >
            <span className="w-10 shrink-0 select-none px-2 text-right text-zinc-600">{line.num}</span>
            <span
              className={cn(
                'w-4 shrink-0 text-center',
                line.type === 'add' && 'text-green-400',
                line.type === 'del' && 'text-red-400',
                line.type === 'context' && 'text-zinc-600',
              )}
            >
              {line.type === 'add' ? '+' : line.type === 'del' ? '-' : ''}
            </span>
            <span className="whitespace-pre pr-2 text-zinc-300">{line.text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default InlineDiffViewer
