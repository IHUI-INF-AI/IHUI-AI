'use client'

import * as React from 'react'
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ihui/ui'
import { Check, Copy, Download } from 'lucide-react'
import type { GenResult } from '@ihui/api-client'

interface GenResultViewerProps {
  result: GenResult
}

export function GenResultViewer({ result }: GenResultViewerProps) {
  const [copied, setCopied] = React.useState(false)
  const [activePath, setActivePath] = React.useState(result.files[0]?.path ?? '')

  React.useEffect(() => {
    setActivePath(result.files[0]?.path ?? '')
  }, [result])

  const active = result.files.find((f) => f.path === activePath) ?? result.files[0]

  async function copy() {
    if (!active) return
    try {
      await navigator.clipboard.writeText(active.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore
    }
  }

  function download() {
    if (!active) return
    const blob = new Blob([active.content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = active.path.split('/').pop() ?? 'generated.txt'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (!active) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>生成结果</CardTitle>
        <CardDescription>共 {result.files.length} 个文件,模块: {result.moduleName}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {result.files.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {result.files.map((f) => (
              <Button
                key={f.path}
                type="button"
                size="sm"
                variant={f.path === activePath ? 'default' : 'outline'}
                onClick={() => setActivePath(f.path)}
              >
                {f.path}
              </Button>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={copy}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            <span>{copied ? '已复制' : '复制'}</span>
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={download}>
            <Download className="h-4 w-4" />
            <span>下载</span>
          </Button>
        </div>
        <div className="rounded-md border bg-muted/50">
          <div className="border-b px-3 py-1 text-xs text-muted-foreground">{active.path}</div>
          <pre className="max-h-[480px] overflow-auto p-3 text-xs leading-relaxed">
            <code>{active.content}</code>
          </pre>
        </div>
      </CardContent>
    </Card>
  )
}
