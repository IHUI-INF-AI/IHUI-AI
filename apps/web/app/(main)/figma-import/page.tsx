// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Palette, Copy, Check, Loader2, AlertTriangle, Code2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fetchApi } from '@/lib/api'
import { Button } from '@ihui/ui-react'

/** D31 设计稿转码(2026-09-26 立):Figma Frame/组件 → 可运行前端代码。
 *  贴 fileKey + nodeId → 选 target(React+Tailwind / Taro)→ 展示生成代码。
 *  走 POST /api/figma/import(next rewrites 直连 ai-service 8803),
 *  后端 LLM 失败时确定性降级为 HTML+内联样式骨架(degraded=true),永不白屏。 */

type TranscodeTarget = 'react' | 'taro'

interface FigmaImportResult {
  code: string
  language: string
  irSummary?: {
    name?: string
    type?: string
    width?: number
    height?: number
    nodeCount?: number
    textCount?: number
    imageRefCount?: number
    maxDepthReached?: number
  }
  warnings?: string[]
  degraded?: boolean
}

async function api<T>(url: string, options: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error || 'Request failed')
  return r.data
}

const TARGETS: TranscodeTarget[] = ['react', 'taro']

export default function FigmaImportPage() {
  const t = useTranslations('figmaImportPage')
  const [fileKey, setFileKey] = React.useState('')
  const [nodeId, setNodeId] = React.useState('')
  const [target, setTarget] = React.useState<TranscodeTarget>('react')
  const [running, setRunning] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [result, setResult] = React.useState<FigmaImportResult | null>(null)
  const [copied, setCopied] = React.useState(false)

  const run = async () => {
    if (!fileKey.trim() || !nodeId.trim()) {
      setError(t('errorRequired'))
      return
    }
    setRunning(true)
    setError(null)
    setResult(null)
    setCopied(false)
    try {
      const res = await api<FigmaImportResult>('/figma/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileKey: fileKey.trim(), nodeId: nodeId.trim(), target }),
      })
      setResult(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setRunning(false)
    }
  }

  const copyCode = async () => {
    if (!result?.code) return
    await navigator.clipboard.writeText(result.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const summary = result?.irSummary

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-4 py-4">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Palette className="h-6 w-6 text-primary" />
          {t('title')}
        </h1>
        <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
      </header>

      <section className="space-y-3 rounded-lg border border-border bg-card p-3">
        <div className="flex flex-wrap gap-1.5">
          {TARGETS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setTarget(k)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium',
                target === k
                  ? 'bg-cta text-cta-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-accent',
              )}
            >
              {k === 'react' ? t('targetReact') : t('targetTaro')}
            </button>
          ))}
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <input
            value={fileKey}
            onChange={(e) => setFileKey(e.target.value)}
            placeholder={t('fileKeyPlaceholder')}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <input
            value={nodeId}
            onChange={(e) => setNodeId(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !running) void run()
            }}
            placeholder={t('nodeIdPlaceholder')}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>

        <div className="flex items-center gap-2">
          <Button size="default" disabled={running} onClick={() => void run()}>
            {running ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Palette className="mr-1 h-4 w-4" />
            )}
            {running ? t('running') : t('run')}
          </Button>
          <p className="text-[11px] text-muted-foreground">{t('tokenHint')}</p>
        </div>
      </section>

      {error && (
        <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {result && (
        <section className="space-y-3 rounded-lg border border-border bg-card p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <Code2 className="h-4 w-4 shrink-0 text-primary" />
              <h2 className="truncate text-sm font-semibold">
                {summary?.name || t('resultTitle')}
                {typeof summary?.width === 'number' && typeof summary?.height === 'number' && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {Math.round(summary.width)}×{Math.round(summary.height)}
                  </span>
                )}
                <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                  {result.language}
                </span>
              </h2>
            </div>
            <Button variant="outline" size="sm" onClick={() => void copyCode()}>
              {copied ? <Check className="mr-1 h-4 w-4" /> : <Copy className="mr-1 h-4 w-4" />}
              {copied ? t('copied') : t('copy')}
            </Button>
          </div>

          {result.degraded && (
            <p className="flex items-center gap-1.5 rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {t('degradedNotice')}
            </p>
          )}

          {result.warnings && result.warnings.length > 0 && (
            <ul className="space-y-1 rounded-md bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
              {result.warnings.map((w, i) => (
                <li key={i}>· {w}</li>
              ))}
            </ul>
          )}

          {summary && (
            <p className="text-[11px] text-muted-foreground">
              {t('metaNodes', {
                nodes: summary.nodeCount ?? 0,
                texts: summary.textCount ?? 0,
                images: summary.imageRefCount ?? 0,
              })}
            </p>
          )}

          <pre className="max-h-[480px] overflow-auto whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-xs leading-relaxed">
            {result.code}
          </pre>
        </section>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
