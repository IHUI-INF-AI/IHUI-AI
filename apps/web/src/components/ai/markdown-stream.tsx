'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface MarkdownStreamProps {
  content: string
  isStreaming?: boolean
}

const INLINE_REGEX =
  /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(\[[^\]]+\]\([^)]+\))|(\[[^\]]+\]\[[^\]]*\))/g

function parseInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  let lastIndex = 0
  let key = 0
  let match: RegExpExecArray | null
  INLINE_REGEX.lastIndex = 0

  while ((match = INLINE_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index))
    }
    const token = match[0]
    const k = `${keyPrefix}-${key++}`

    if (token.startsWith('`')) {
      nodes.push(
        <code key={k} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em]">
          {token.slice(1, -1)}
        </code>,
      )
    } else if (token.startsWith('**')) {
      nodes.push(
        <strong key={k} className="font-semibold">
          {token.slice(2, -2)}
        </strong>,
      )
    } else if (token.startsWith('*')) {
      nodes.push(<em key={k}>{token.slice(1, -1)}</em>)
    } else if (token.startsWith('[')) {
      const linkMatch = /\[([^\]]+)\]\(([^)]+)\)/.exec(token)
      if (linkMatch && linkMatch[1] && linkMatch[2]) {
        const href = linkMatch[2]
        const isSafeUrl = /^(https?:|mailto:|\/|#)/.test(href)
        if (!isSafeUrl) {
          nodes.push(token)
        } else {
          nodes.push(
            <a
              key={k}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2"
            >
              {linkMatch[1]}
            </a>,
          )
        }
      } else {
        nodes.push(token)
      }
    }
    lastIndex = INLINE_REGEX.lastIndex
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex))
  }
  return nodes
}

function CodeBlock({ language, code }: { language?: string; code: string }) {
  return (
    <pre className="my-2 overflow-x-auto rounded-lg bg-zinc-950 p-3 text-sm">
      <code className={cn('font-mono text-zinc-100', language && `language-${language}`)}>
        {code}
      </code>
    </pre>
  )
}

function parseTableRow(line: string): string[] {
  return line
    .split('|')
    .map((c) => c.trim())
    .filter((_, i, arr) => i > 0 && i < arr.length - 1)
}

function parseLineBlocks(segment: string, keyBase: string): React.ReactNode[] {
  const lines = segment.split('\n')
  const blocks: React.ReactNode[] = []
  let i = 0
  let key = 0

  while (i < lines.length) {
    const line = lines[i] ?? ''
    const trimmed = line.trim()

    if (trimmed === '') {
      i++
      continue
    }

    const headingMatch = /^(#{1,6})\s+(.*)$/.exec(trimmed)
    if (headingMatch && headingMatch[1] && headingMatch[2] !== undefined) {
      const level = headingMatch[1].length
      const sizes = ['text-2xl', 'text-xl', 'text-lg', 'text-base', 'text-sm', 'text-sm']
      const size = sizes[level - 1] ?? 'text-base'
      blocks.push(
        React.createElement(
          `h${level}`,
          { key: `${keyBase}-${key++}`, className: cn('my-2 font-semibold', size) },
          parseInline(headingMatch[2], `${keyBase}-${key}`),
        ),
      )
      i++
      continue
    }

    if (trimmed.startsWith('> ')) {
      const quoteLines: string[] = []
      while (i < lines.length && (lines[i] ?? '').trim().startsWith('> ')) {
        quoteLines.push((lines[i] ?? '').trim().slice(2))
        i++
      }
      blocks.push(
        <blockquote
          key={`${keyBase}-${key++}`}
          className="my-2 border-l-2 border-border pl-3 text-muted-foreground italic"
        >
          {parseInline(quoteLines.join(' '), `${keyBase}-${key}`)}
        </blockquote>,
      )
      continue
    }

    if (
      /^\||^\|.*\|$/.test(trimmed) &&
      i + 1 < lines.length &&
      /^\|?[\s-:]+\|/.test((lines[i + 1] ?? '').trim())
    ) {
      const headerCells = parseTableRow(trimmed)
      i += 2
      const rows: string[][] = []
      while (i < lines.length && (lines[i] ?? '').trim().startsWith('|')) {
        rows.push(parseTableRow((lines[i] ?? '').trim()))
        i++
      }
      blocks.push(
        <div key={`${keyBase}-${key++}`} className="my-2 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {headerCells.map((c, ci) => (
                  <th
                    key={ci}
                    className="border border-border bg-muted px-3 py-1.5 text-left font-medium"
                  >
                    {parseInline(c, `${keyBase}-th-${ci}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((c, ci) => (
                    <td key={ci} className="border border-border px-3 py-1.5">
                      {parseInline(c, `${keyBase}-td-${ri}-${ci}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      )
      continue
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = []
      while (i < lines.length && /^[-*]\s+/.test((lines[i] ?? '').trim())) {
        items.push((lines[i] ?? '').trim().replace(/^[-*]\s+/, ''))
        i++
      }
      blocks.push(
        <ul key={`${keyBase}-${key++}`} className="my-2 list-disc space-y-1 pl-6">
          {items.map((item, ii) => (
            <li key={ii}>{parseInline(item, `${keyBase}-li-${ii}`)}</li>
          ))}
        </ul>,
      )
      continue
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = []
      while (i < lines.length && /^\d+\.\s+/.test((lines[i] ?? '').trim())) {
        items.push((lines[i] ?? '').trim().replace(/^\d+\.\s+/, ''))
        i++
      }
      blocks.push(
        <ol key={`${keyBase}-${key++}`} className="my-2 list-decimal space-y-1 pl-6">
          {items.map((item, ii) => (
            <li key={ii}>{parseInline(item, `${keyBase}-ol-${ii}`)}</li>
          ))}
        </ol>,
      )
      continue
    }

    const paraLines: string[] = []
    while (
      i < lines.length &&
      (lines[i] ?? '').trim() !== '' &&
      !/^(#{1,6})\s+/.test((lines[i] ?? '').trim()) &&
      !/^[-*]\s+/.test((lines[i] ?? '').trim()) &&
      !/^\d+\.\s+/.test((lines[i] ?? '').trim()) &&
      !(lines[i] ?? '').trim().startsWith('> ')
    ) {
      paraLines.push((lines[i] ?? '').trim())
      i++
    }
    if (paraLines.length > 0) {
      blocks.push(
        <p key={`${keyBase}-${key++}`} className="my-2 leading-relaxed">
          {parseInline(paraLines.join(' '), `${keyBase}-p-${key}`)}
        </p>,
      )
    }
  }

  return blocks
}

function parseMarkdown(content: string): React.ReactNode[] {
  const blocks: React.ReactNode[] = []
  const segments = content.split(/(```[\s\S]*?```)/g)
  let key = 0

  segments.forEach((seg, idx) => {
    if (seg.startsWith('```')) {
      const match = /^```(\w*)\n?([\s\S]*?)```$/.exec(seg)
      if (match) {
        const lang = match[1] || undefined
        const code = match[2] ?? ''
        blocks.push(<CodeBlock key={`code-${key++}`} language={lang} code={code} />)
      }
    } else if (seg) {
      parseLineBlocks(seg, `blk-${idx}`).forEach((b) => {
        blocks.push(b)
        key++
      })
    }
  })

  return blocks
}

export function MarkdownStream({ content, isStreaming }: MarkdownStreamProps) {
  const nodes = React.useMemo(() => parseMarkdown(content), [content])

  return (
    <div className="text-sm">
      {nodes}
      {isStreaming && (
        <span
          className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-primary align-middle"
          aria-hidden
        />
      )}
    </div>
  )
}

export default MarkdownStream
