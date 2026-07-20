'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, FileText, CheckCircle2, Send, History, Upload, Wand2, Copy, Check, Download } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Label } from '@ihui/ui'

interface HistoryPayload {
  title?: string
  digest?: string
  mdPath?: string
  cover?: string
  topic?: string
}

interface HistoryItem {
  id: string
  title: string
  status: string
  draftId?: string
  topicKeyword?: string
  payload?: HistoryPayload
  createdAt?: string
}

interface RunResult {
  ok: boolean
  stdout?: string
  stderr?: string
  error?: string
  returncode?: number
  mdPath?: string
}

export default function WechatPage() {
  const t = useTranslations('selfMedia.wechatPage')
  const [title, setTitle] = React.useState('')
  const [digest, setDigest] = React.useState('')
  const [mdPath, setMdPath] = React.useState('')
  const [mdContent, setMdContent] = React.useState('')
  const [cover, setCover] = React.useState('')
  const [running, setRunning] = React.useState<'generate' | 'validate' | 'publish' | 'all' | null>(null)
  const [result, setResult] = React.useState<RunResult | null>(null)
  const [history, setHistory] = React.useState<HistoryItem[]>([])
  const [copied, setCopied] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const loadHistory = React.useCallback(async () => {
    const r = await fetchApi<{ items: HistoryItem[] }>(`/api/self-media/wechat/history?limit=20`)
    if (r.success && r.data) setHistory(r.data.items ?? [])
  }, [])

  const applyHistory = (h: HistoryItem) => {
    setTitle(h.payload?.title || h.title || '')
    setDigest(h.payload?.digest || '')
    setMdPath(h.payload?.mdPath || '')
    setCover(h.payload?.cover || '')
    if (h.payload?.topic) setMdContent('')
  }

  React.useEffect(() => {
    void loadHistory()
  }, [loadHistory])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    setMdContent(text)
    if (!title) {
      // 用文件名(去 .md)作标题兜底
      const baseName = file.name.replace(/\.md$/i, '')
      setTitle(baseName)
    }
    e.target.value = ''
  }

  const copyMd = async () => {
    if (!mdContent) return
    try {
      await navigator.clipboard.writeText(mdContent)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // 静默失败(浏览器拒绝 clipboard 权限)
    }
  }

  const downloadMd = () => {
    if (!mdContent) return
    const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${title || 'wechat-article'}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const run = async (
    op: 'generate' | 'validate' | 'publish',
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
      if (r.success && r.data) {
        setResult(r.data)
        // 如果 generate 返回了 mdPath,同步到 mdPath 字段
        if (op === 'generate' && r.data.mdPath) {
          setMdPath(r.data.mdPath)
        }
        if (op === 'publish' && r.data.ok) void loadHistory()
      } else {
        setResult({ ok: false, error: r.error || 'request failed' })
      }
    } catch (e) {
      setResult({ ok: false, error: e instanceof Error ? e.message : 'network error' })
    } finally {
      setRunning(null)
    }
  }

  // 一键完整流水线:generate → validate → publish(全 dry-run)
  const runAll = async () => {
    if (!title || running) return
    setRunning('all')
    setResult(null)
    try {
      // Step 1: generate
      const r1 = await fetchApi<RunResult>('/api/self-media/wechat/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, digest, topic: '', mdPath, mdContent, dryRun: true }),
      })
      if (!r1.success || !r1.data.ok) {
        setResult(r1.success ? r1.data : { ok: false, error: r1.error })
        return
      }
      const finalMdPath = r1.data.mdPath || mdPath
      setMdPath(finalMdPath)
      // Step 2: validate
      const r2 = await fetchApi<RunResult>('/api/self-media/wechat/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mdPath: finalMdPath }),
      })
      if (!r2.success || !r2.data.ok) {
        setResult({
          ok: false,
          error: 'validate 失败:' + (r2.success ? r2.data.error : r2.error),
        })
        return
      }
      // Step 3: publish (dry-run)
      const r3 = await fetchApi<RunResult>('/api/self-media/wechat/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mdPath: finalMdPath, title, digest, cover, dryRun: true }),
      })
      setResult(r3.success ? r3.data : { ok: false, error: r3.error })
      if (r3.success && r3.data.ok) void loadHistory()
    } catch (e) {
      setResult({ ok: false, error: e instanceof Error ? e.message : 'network error' })
    } finally {
      setRunning(null)
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="space-y-4 md:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" />
              {t('formTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-4">
            <div className="space-y-1.5">
              <Label htmlFor="title">{t('titleLabel')}</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('titlePlaceholder')}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="digest">{t('digestLabel')}</Label>
              <Input
                id="digest"
                value={digest}
                onChange={(e) => setDigest(e.target.value)}
                placeholder={t('digestPlaceholder')}
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="mdContent">{t('mdPathLabel')}</Label>
                <div className="flex gap-1.5">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".md,.markdown,text/markdown,text/plain"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-6 px-2 text-xs"
                  >
                    <Upload className="h-3 w-3" />
                    上传 md
                  </Button>
                  {mdContent && (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={copyMd}
                        className="h-6 px-2 text-xs"
                      >
                        {copied ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                        {copied ? '已复制' : '复制'}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={downloadMd}
                        className="h-6 px-2 text-xs"
                      >
                        <Download className="h-3 w-3" />
                        下载
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setMdContent('')}
                        className="h-6 px-2 text-xs"
                      >
                        清空
                      </Button>
                    </>
                  )}
                </div>
              </div>
              <textarea
                id="mdContent"
                value={mdContent}
                onChange={(e) => setMdContent(e.target.value)}
                placeholder={t('mdPathPlaceholder') + ' (可上传 md 或在线编辑;留空则用 LLM 自动生成)'}
                className="thin-scroll min-h-[180px] w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs leading-relaxed"
              />
              {mdPath && (
                <p className="text-xs text-muted-foreground">已用 md 路径: <code className="rounded bg-muted px-1">{mdPath}</code></p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cover">{t('coverLabel')}</Label>
              <Input
                id="cover"
                value={cover}
                onChange={(e) => setCover(e.target.value)}
                placeholder={t('coverPlaceholder')}
              />
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                onClick={() =>
                  run('generate', '/api/self-media/wechat/generate', {
                    title,
                    digest,
                    topic: '',
                    mdPath,
                    mdContent,
                    dryRun: true,
                  })
                }
                disabled={!title || running !== null}
              >
                {running === 'generate' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
                {t('generate')}
              </Button>
              <Button
                variant="outline"
                onClick={() => run('validate', '/api/self-media/wechat/validate', { mdPath })}
                disabled={!mdPath || running !== null}
              >
                {running === 'validate' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                {t('validate')}
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  run('publish', '/api/self-media/wechat/publish', {
                    mdPath,
                    title,
                    digest,
                    cover,
                    dryRun: true,
                  })
                }
                disabled={!mdPath || !title || running !== null}
              >
                {running === 'publish' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {t('publishDryRun')}
              </Button>
              <Button
                variant="secondary"
                onClick={runAll}
                disabled={!title || running !== null}
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
          </CardContent>
        </Card>

        {result && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('resultTitle')}</CardTitle>
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
              </div>
              {result.error && (
                <pre className="thin-scroll max-h-40 overflow-auto rounded-md bg-rose-50 p-2 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                  {result.error}
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
