'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, Mic, CheckCircle2, History, Wand2, Copy, Check } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Label } from '@ihui/ui'

interface HistoryPayload {
  date?: string
  topic?: string
  filePath?: string
}

interface HistoryItem {
  id: string
  title: string
  status: string
  topicKeyword?: string
  payload?: HistoryPayload
  createdAt?: string
}

interface KouboArticle {
  index: number
  content: string
  topic?: Record<string, unknown>
}

interface RunResult {
  ok: boolean
  stdout?: string
  stderr?: string
  error?: string
  returncode?: number
  displayOutput?: string
  guide?: string
  outputPath?: string
  articlesCount?: number
  articles?: KouboArticle[]
  duration_ms?: number
  date?: string
  status?: string
}

export default function KouboPage() {
  const t = useTranslations('selfMedia.kouboPage')
  const [date, setDate] = React.useState('')
  const [filePath, setFilePath] = React.useState('')
  const [topic, setTopic] = React.useState('')
  const [running, setRunning] = React.useState<'generate' | 'validate' | 'all' | null>(null)
  const [result, setResult] = React.useState<RunResult | null>(null)
  const [history, setHistory] = React.useState<HistoryItem[]>([])
  const [copiedIdx, setCopiedIdx] = React.useState<number | null>(null)

  const loadHistory = React.useCallback(async () => {
    const r = await fetchApi<{ items: HistoryItem[] }>(`/api/self-media/koubo/history?limit=20`)
    if (r.success && r.data) setHistory(r.data.items ?? [])
  }, [])

  const applyHistory = (h: HistoryItem) => {
    // 标题通常是 "koubo-MMDD" 或包含日期,提取 MMDD 回填
    const titleStr = h.title || ''
    const m = titleStr.match(/(\d{4})/)
    if (m && m[1]) setDate(m[1])
    setTopic(h.payload?.topic || h.topicKeyword || '')
    if (h.payload?.filePath) setFilePath(h.payload.filePath)
  }

  React.useEffect(() => {
    void loadHistory()
  }, [loadHistory])

  const run = async (
    op: 'generate' | 'validate',
    endpoint: string,
    body: Record<string, unknown>,
  ) => {
    setRunning(op)
    setResult(null)
    try {
      const r = await fetchApi<RunResult>(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (r.success) {
        setResult(r.data)
        // generate 成功后把 outputPath 同步到 filePath,方便后续 validate
        if (op === 'generate' && r.data.outputPath) {
          setFilePath(r.data.outputPath)
        }
      } else {
        setResult({ ok: false, error: r.error || 'request failed' })
      }
    } catch (e) {
      setResult({ ok: false, error: e instanceof Error ? e.message : 'network error' })
    } finally {
      setRunning(null)
    }
  }

  // 一键完整流水线:generate → validate(用 generate 返回的 outputPath)
  const runAll = async () => {
    if (!date || !/^\d{4}$/.test(date) || running) return
    setRunning('all')
    setResult(null)
    try {
      // Step 1: generate(8 篇生成,耗时较长)
      const r1 = await fetchApi<RunResult>('/api/self-media/koubo/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, topic, dryRun: true }),
      })
      if (!r1.success || !r1.data.ok) {
        setResult(r1.success ? r1.data : { ok: false, error: r1.error })
        return
      }
      const finalPath = r1.data.outputPath || ''
      if (finalPath) setFilePath(finalPath)
      // Step 2: validate(双门禁)
      if (finalPath) {
        const r2 = await fetchApi<RunResult>('/api/self-media/koubo/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filePath: finalPath }),
        })
        // 合并 r1 + r2:保留 r1 的 articles,附加 r2 的 stdout/stderr
        if (r2.success) {
          setResult({
            ...r1.data,
            stdout: r2.data.stdout ?? r1.data.stdout,
            stderr: r2.data.stderr ?? r1.data.stderr,
            returncode: r2.data.returncode ?? r1.data.returncode,
            ok: r1.data.ok && r2.data.ok,
          })
        } else {
          setResult({ ...r1.data, ok: false, error: 'validate 失败:' + (r2.error || '未知错误') })
        }
      } else {
        setResult({ ...r1.data, error: 'generate 未返回 outputPath,无法继续 validate' })
      }
      void loadHistory()
    } catch (e) {
      setResult({ ok: false, error: e instanceof Error ? e.message : 'network error' })
    } finally {
      setRunning(null)
    }
  }

  const copyArticle = async (idx: number, content: string) => {
    try {
      await navigator.clipboard.writeText(content)
      setCopiedIdx(idx)
      setTimeout(() => setCopiedIdx(null), 1500)
    } catch {
      // 静默失败(浏览器拒绝 clipboard 权限)
    }
  }

  const downloadAllArticles = () => {
    if (!result?.articles?.length) return
    const text = result.articles
      .map((a) => `# 第 ${a.index} 篇\n\n${a.content}\n\n---\n`)
      .join('\n')
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `koubo-${result.date || date}-${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="space-y-4 md:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Mic className="h-4 w-4" />
              {t('formTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="date">{t('dateLabel')}</Label>
                <Input
                  id="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  placeholder="0720"
                  maxLength={4}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="topic">{t('topicLabel')}</Label>
                <Input
                  id="topic"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder={t('topicPlaceholder')}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="filePath">{t('filePathLabel')}</Label>
              <Input
                id="filePath"
                value={filePath}
                onChange={(e) => setFilePath(e.target.value)}
                placeholder={t('filePathPlaceholder')}
              />
              {result?.outputPath && (
                <p className="text-xs text-muted-foreground">
                  最新输出: <code className="rounded bg-muted px-1">{result.outputPath}</code>
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                onClick={() =>
                  run('generate', '/api/self-media/koubo/generate', {
                    date,
                    topic,
                    dryRun: true,
                  })
                }
                disabled={!date || !/^\d{4}$/.test(date) || running !== null}
              >
                {running === 'generate' || running === 'all' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
                {t('generate')}
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  run('validate', '/api/self-media/koubo/validate', { filePath })
                }
                disabled={!filePath || running !== null}
              >
                {running === 'validate' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                {t('validate')}
              </Button>
              <Button
                variant="secondary"
                onClick={runAll}
                disabled={!date || !/^\d{4}$/.test(date) || running !== null}
                className="ml-auto"
              >
                {running === 'all' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Wand2 className="h-4 w-4" />
                )}
                一键流水线
              </Button>
            </div>
            {running === 'all' && (
              <p className="text-xs text-muted-foreground">
                正在执行 8 篇口播稿生成 + 双门禁验证,预计 5-10 分钟,请勿离开页面...
              </p>
            )}
          </CardContent>
        </Card>

        {result && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                <span>{t('resultTitle')}</span>
                {result.articles && result.articles.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={downloadAllArticles}
                    className="h-7 px-2 text-xs"
                  >
                    <Copy className="h-3 w-3" />
                    下载全部
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-4">
              <div
                className={
                  result.ok
                    ? 'text-sm font-medium text-emerald-600'
                    : 'text-sm font-medium text-rose-600'
                }
              >
                {result.ok ? '✅ ' + t('runSuccess') : '❌ ' + t('runFailed')}
                {typeof result.returncode === 'number' && ` (rc=${result.returncode})`}
                {typeof result.duration_ms === 'number' && ` · ${result.duration_ms} ms`}
                {result.articlesCount !== undefined && ` · ${result.articlesCount} 篇`}
              </div>
              {result.guide && (
                <p className="rounded-md bg-muted px-2 py-1.5 text-xs text-muted-foreground">
                  {result.guide}
                </p>
              )}
              {result.error && (
                <pre className="thin-scroll max-h-40 overflow-auto rounded-md bg-rose-50 p-2 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                  {result.error}
                </pre>
              )}
              {result.articles && result.articles.length > 0 && (
                <div className="space-y-2">
                  {result.articles.map((a) => (
                    <div
                      key={a.index}
                      className="rounded-md border border-border bg-background p-3"
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <h4 className="text-xs font-semibold">第 {a.index} 篇</h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyArticle(a.index, a.content)}
                          className="h-6 px-2 text-xs"
                        >
                          {copiedIdx === a.index ? (
                            <>
                              <Check className="h-3 w-3" />
                              已复制
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" />
                              复制
                            </>
                          )}
                        </Button>
                      </div>
                      <pre className="thin-scroll max-h-60 overflow-auto whitespace-pre-wrap text-xs leading-relaxed">
                        {a.content}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
              {result.displayOutput && (
                <pre className="thin-scroll max-h-40 overflow-auto rounded-md bg-muted p-2 text-xs">
                  {result.displayOutput}
                </pre>
              )}
              {result.stdout && (
                <pre className="thin-scroll max-h-60 overflow-auto rounded-md bg-muted p-2 text-xs">
                  {result.stdout}
                </pre>
              )}
              {result.stderr && (
                <pre className="thin-scroll max-h-40 overflow-auto rounded-md bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                  {result.stderr}
                </pre>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" />
            {t('historyTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2">
          {history.length === 0 ? (
            <p className="px-2 py-4 text-xs text-muted-foreground">{t('historyEmpty')}</p>
          ) : (
            <div role="list" className="space-y-1">
              {history.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => applyHistory(h)}
                  className="block w-full cursor-pointer rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  title="点击复用此条历史参数"
                >
                  <div className="truncate font-medium">{h.title}</div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-muted-foreground">
                    <span
                      className={
                        h.status === 'published'
                          ? 'text-emerald-600'
                          : h.status === 'failed'
                            ? 'text-rose-600'
                            : 'text-muted-foreground'
                      }
                    >
                      {h.status}
                    </span>
                    {h.createdAt && <span>· {new Date(h.createdAt).toLocaleDateString()}</span>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
