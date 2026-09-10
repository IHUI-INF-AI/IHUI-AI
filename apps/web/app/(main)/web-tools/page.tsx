// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Braces, Copy, Check, ExternalLink, Globe, Link2, FileText, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fetchApi } from '@/lib/api'
import { Button } from '@ihui/ui-react'

/** 网页工具中心(2026-09-09 立):Firecrawl 四件套融合的只读网页抓取操作页。
 *  贴 URL → 选工具(读正文 / 站点地图 / 结构化抽取)→ 展示结果。
 *  走 POST /api/web-tools/call(next rewrites 直连 ai-service 8803),
 *  crawl_site(递归爬取,管理员工具)不在本页开放。 */

type ToolKey = 'fetch_readable' | 'map_site' | 'extract_web'

interface ToolResult {
  ok?: boolean
  url?: string
  title?: string
  content?: string
  chars?: number
  truncated?: boolean
  rendered?: boolean
  link_count?: number
  links?: { url: string; text?: string }[]
  source?: string
  fields?: Record<string, unknown>
  confidence?: Record<string, number>
  llm_usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
  llm_model?: string
  message?: string
}

async function api<T>(url: string, options: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error || 'Request failed')
  return r.data
}

function parseFields(text: string): Record<string, string> | null {
  const out: Record<string, string> = {}
  for (const line of text.split('\n')) {
    const s = line.trim()
    if (!s) continue
    const i = s.indexOf(':')
    if (i <= 0) return null
    out[s.slice(0, i).trim()] = s.slice(i + 1).trim() || 'string'
  }
  return Object.keys(out).length ? out : null
}

const TOOL_ICONS: Record<ToolKey, typeof Globe> = {
  fetch_readable: FileText,
  map_site: Link2,
  extract_web: Braces,
}

export default function WebToolsPage() {
  const t = useTranslations('webToolsPage')
  const [tool, setTool] = React.useState<ToolKey>('fetch_readable')
  const [url, setUrl] = React.useState('')
  const [maxChars, setMaxChars] = React.useState('8000')
  const [includeLinks, setIncludeLinks] = React.useState(false)
  const [maxLinks, setMaxLinks] = React.useState('200')
  const [sameDomain, setSameDomain] = React.useState(true)
  const [fieldsText, setFieldsText] = React.useState('title: string\nauthor: string')
  const [running, setRunning] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [result, setResult] = React.useState<ToolResult | null>(null)
  const [elapsed, setElapsed] = React.useState(0)
  const [copied, setCopied] = React.useState(false)

  const run = async () => {
    if (!url.trim()) {
      setError(t('errorRequired'))
      return
    }
    const body: Record<string, unknown> = { tool, url: url.trim() }
    if (tool !== 'map_site') {
      const n = parseInt(maxChars, 10)
      if (Number.isFinite(n)) body.max_chars = n
    }
    if (tool === 'fetch_readable') body.include_links = includeLinks
    if (tool === 'map_site') {
      const n = parseInt(maxLinks, 10)
      if (Number.isFinite(n)) body.max_links = n
      body.same_domain_only = sameDomain
    }
    if (tool === 'extract_web') {
      const fields = parseFields(fieldsText)
      if (!fields) {
        setError(t('errorFields'))
        return
      }
      body.fields = fields
    }
    setRunning(true)
    setError(null)
    setResult(null)
    setCopied(false)
    const t0 = performance.now()
    try {
      const res = await api<{ ok: boolean; result: ToolResult }>('/web-tools/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      setResult(res.result)
      setElapsed(Math.round(performance.now() - t0))
      if (res.result?.ok === false) setError(res.result.message || t('errorFailed'))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setRunning(false)
    }
  }

  const copyContent = async () => {
    if (!result?.content) return
    await navigator.clipboard.writeText(result.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const tools: ToolKey[] = ['fetch_readable', 'map_site', 'extract_web']
  const usage = result?.llm_usage

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-4 py-4">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Globe className="h-6 w-6 text-primary" />
          {t('title')}
        </h1>
        <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
      </header>

      <section className="space-y-3 rounded-lg border border-border bg-card p-3">
        <div className="flex flex-wrap gap-1.5">
          {tools.map((k) => {
            const Icon = TOOL_ICONS[k]
            return (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setTool(k)
                  setError(null)
                }}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium',
                  tool === k
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-accent',
                )}
              >
                <Icon className="h-4 w-4" />
                {t(`tool_${k}`)}
              </button>
            )
          })}
        </div>

        <div className="flex gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !running) void run()
            }}
            placeholder={t('urlPlaceholder')}
            className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <Button size="default" disabled={running} onClick={() => void run()}>
            {running ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Globe className="mr-1 h-4 w-4" />
            )}
            {running ? t('running') : t('run')}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          {tool !== 'map_site' && (
            <label className="flex items-center gap-1.5">
              {t('maxChars')}
              <input
                value={maxChars}
                onChange={(e) => setMaxChars(e.target.value)}
                inputMode="numeric"
                className="h-7 w-20 rounded-md border border-input bg-background px-2 text-xs"
              />
            </label>
          )}
          {tool === 'fetch_readable' && (
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={includeLinks}
                onChange={(e) => setIncludeLinks(e.target.checked)}
                className="h-3.5 w-3.5"
              />
              {t('includeLinks')}
            </label>
          )}
          {tool === 'map_site' && (
            <>
              <label className="flex items-center gap-1.5">
                {t('maxLinks')}
                <input
                  value={maxLinks}
                  onChange={(e) => setMaxLinks(e.target.value)}
                  inputMode="numeric"
                  className="h-7 w-20 rounded-md border border-input bg-background px-2 text-xs"
                />
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={sameDomain}
                  onChange={(e) => setSameDomain(e.target.checked)}
                  className="h-3.5 w-3.5"
                />
                {t('sameDomainOnly')}
              </label>
            </>
          )}
        </div>

        {tool === 'extract_web' && (
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">{t('fieldsLabel')}</label>
            <textarea
              value={fieldsText}
              onChange={(e) => setFieldsText(e.target.value)}
              rows={4}
              placeholder={t('fieldsPlaceholder')}
              className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <p className="text-[10px] text-muted-foreground">{t('fieldsHint')}</p>
          </div>
        )}
      </section>

      {error && (
        <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {result?.ok && (
        <section className="space-y-3 rounded-lg border border-border bg-card p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              {result.title && <h2 className="truncate text-sm font-semibold">{result.title}</h2>}
              <a
                href={result.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 truncate text-xs text-muted-foreground hover:text-foreground"
              >
                <ExternalLink className="h-3 w-3 shrink-0" />
                {result.url}
              </a>
            </div>
            {result.content && (
              <Button variant="outline" size="sm" onClick={() => void copyContent()}>
                {copied ? <Check className="mr-1 h-4 w-4" /> : <Copy className="mr-1 h-4 w-4" />}
                {copied ? t('copied') : t('copy')}
              </Button>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {result.message}
            {elapsed > 0 && ` · ${elapsed}ms`}
            {result.rendered && ` · ${t('metaRendered')}`}
            {typeof result.chars === 'number' && result.truncated && ` · ${t('metaTruncated')}`}
            {tool === 'extract_web' &&
              ` · ${result.source === 'llm' ? t('metaSourceLlm') : t('metaSourceHeuristic')}`}
            {usage &&
              typeof usage.total_tokens === 'number' &&
              ` · ${t('metaTokens', { total: usage.total_tokens, prompt: usage.prompt_tokens ?? 0, completion: usage.completion_tokens ?? 0 })}`}
            {result.llm_model && ` · ${result.llm_model}`}
          </p>

          {result.content && (
            <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-xs leading-relaxed">
              {result.content}
            </pre>
          )}

          {result.links && result.links.length > 0 && (
            <ul className="max-h-[420px] space-y-1 overflow-auto">
              {result.links.map((l, i) => (
                <li key={`${l.url}-${i}`} className="flex items-baseline gap-2 text-xs">
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 text-primary hover:underline"
                  >
                    {l.url}
                  </a>
                  {l.text && <span className="truncate text-muted-foreground">{l.text}</span>}
                </li>
              ))}
            </ul>
          )}

          {result.fields && Object.keys(result.fields).length > 0 && (
            <div className="overflow-hidden rounded-md border border-border">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 text-left text-muted-foreground">
                  <tr>
                    <th className="px-3 py-1.5 font-medium">{t('field')}</th>
                    <th className="px-3 py-1.5 font-medium">{t('value')}</th>
                    <th className="px-3 py-1.5 font-medium">{t('confidence')}</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(result.fields).map(([k, v]) => (
                    <tr key={k} className="border-t border-border/60">
                      <td className="px-3 py-1.5 font-medium">{k}</td>
                      <td className="px-3 py-1.5 break-all">{String(v)}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">
                        {((result.confidence?.[k] ?? 0) * 100).toFixed(0)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
