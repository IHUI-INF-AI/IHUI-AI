'use client'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@ihui/ui'

import { McpDataStructure } from './mcp-data-structure'

export interface McpResultPreviewProps {
  result: unknown
  mimeType?: string
}

function isTableLike(v: unknown): v is Record<string, unknown>[] {
  return (
    Array.isArray(v) &&
    v.length > 0 &&
    v.every((item) => item !== null && typeof item === 'object' && !Array.isArray(item))
  )
}

function formatCell(v: unknown): string {
  if (v === null) return 'null'
  if (v === undefined) return ''
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

const IMAGE_RE = /^(data:image\/|https?:\/\/.+\.(png|jpe?g|gif|webp|svg))/i

export function McpResultPreview({ result, mimeType }: McpResultPreviewProps) {
  const type = (mimeType ?? '').toLowerCase()

  if (type.startsWith('image/') || (typeof result === 'string' && IMAGE_RE.test(result))) {
    const src = typeof result === 'string' ? result : ''
    return (
      <div className="flex justify-center rounded-lg border p-4">
        <img src={src} alt="result" className="max-h-[400px] object-contain" />
      </div>
    )
  }

  if (typeof result === 'string') {
    try {
      const parsed: unknown = JSON.parse(result)
      return <McpDataStructure data={parsed} />
    } catch {
      return (
        <pre className="max-h-[400px] overflow-auto rounded-lg border bg-muted/30 p-3 text-xs whitespace-pre-wrap">
          {result}
        </pre>
      )
    }
  }

  if (isTableLike(result)) {
    const rows = result
    const headers = Array.from(new Set(rows.flatMap((r) => Object.keys(r))))
    return (
      <div className="overflow-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              {headers.map((h) => (
                <TableHead key={h}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) => (
              <TableRow key={i}>
                {headers.map((h) => (
                  <TableCell key={h}>{formatCell(row[h])}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  return <McpDataStructure data={result} />
}
