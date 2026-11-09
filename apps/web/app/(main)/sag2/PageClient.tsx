// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * SAG2 词法多跳检索工作台（本仓自有实现）。
 *
 * 把后端 /api/v1/ai/sag2/* 的六类能力做成可直接操作的界面：
 * 索引状态、文档登记/移除、离线快速搜索、查询时多跳检索、引用锚点、RRF 融合。
 * 判定器未执行时显式展示「纯词法判定」，绝不把 BM25 分数伪装成模型证据。
 */

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button, Input } from '@ihui/ui-react'

import {
  sag2AddDocument,
  sag2AddFolder,
  sag2Fuse,
  sag2ListFolders,
  sag2RemoveDocument,
  sag2RemoveFolder,
  sag2Retrieve,
  sag2ScanFolders,
  sag2Search,
  sag2Status,
  sag2WatchFolder,
  type Sag2FolderList,
  type Sag2FuseResult,
  type Sag2RetrieveResult,
  type Sag2ScanStats,
  type Sag2SearchResult,
  type Sag2Status as Sag2StatusData,
} from '@/api/sag2-lexical'

type Mode = 'quick' | 'deep'

const FIELD_CLASS =
  'w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-foreground'

const CARD_CLASS = 'flex min-h-0 flex-col rounded-lg border border-border bg-background'

const META_CLASS = 'rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground'

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

export default function PageClient() {
  const t = useTranslations('sag2Lexical')
  const [status, setStatus] = useState<Sag2StatusData | null>(null)
  const [docPath, setDocPath] = useState('')
  const [docContent, setDocContent] = useState('')
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<Mode>('deep')
  const [quick, setQuick] = useState<Sag2SearchResult | null>(null)
  const [deep, setDeep] = useState<Sag2RetrieveResult | null>(null)
  const [fused, setFused] = useState<Sag2FuseResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  // 文件夹面板默认折叠：展开时才拉列表，避免首屏多发一个请求。
  const [foldersOpen, setFoldersOpen] = useState(false)
  const [folderRoot, setFolderRoot] = useState('')
  const [folders, setFolders] = useState<Sag2FolderList | null>(null)
  const [scanStats, setScanStats] = useState<Sag2ScanStats | null>(null)

  const refresh = useCallback(async () => {
    try {
      setStatus(await sag2Status())
    } catch (e) {
      setError(errorMessage(e))
    }
  }, [])

  const refreshFolders = useCallback(async () => {
    try {
      setFolders(await sag2ListFolders())
    } catch (e) {
      setError(errorMessage(e))
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // 折叠面板展开时才拉文件夹列表：首屏不多发请求，展开前后数据一致。
  useEffect(() => {
    if (foldersOpen) void refreshFolders()
  }, [foldersOpen, refreshFolders])

  const run = useCallback(async (action: () => Promise<void>) => {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await action()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }, [])

  const addDocument = () =>
    run(async () => {
      const outcome = await sag2AddDocument({ path: docPath.trim(), content: docContent })
      setNotice(outcome.changed ? t('added') : t('unchanged'))
      setDocContent('')
      await refresh()
    })

  const removeDocument = () =>
    run(async () => {
      const outcome = await sag2RemoveDocument(docPath.trim())
      setNotice(`${t('removed')} ${outcome.removed}`)
      await refresh()
    })

  // -- 本地文件夹：登记 / 扫描 / 监听 / 注销 ---------------------------------

  const summaryOf = (stats: Sag2ScanStats | null): string =>
    stats
      ? t('scanSummary', {
          changed: stats.changed,
          unchanged: stats.unchanged,
          unsupported: stats.unsupported,
          failed: stats.failed,
        })
      : ''

  const addFolder = () =>
    run(async () => {
      const outcome = await sag2AddFolder({ root: folderRoot.trim(), scan: true })
      if (!outcome.registered) {
        setError(outcome.reason ?? t('error'))
        return
      }
      setScanStats(outcome.scan ?? null)
      setNotice(summaryOf(outcome.scan ?? null))
      setFolderRoot('')
      await refresh()
      await refreshFolders()
    })

  const scanAllFolders = () =>
    run(async () => {
      const stats = await sag2ScanFolders()
      setScanStats(stats)
      setNotice(stats.reason ?? summaryOf(stats))
      await refresh()
      await refreshFolders()
    })

  const removeFolder = (root: string) =>
    run(async () => {
      const outcome = await sag2RemoveFolder(root)
      setNotice(`${t('removeFolder')} ${outcome.removed}`)
      await refresh()
      await refreshFolders()
    })

  const toggleWatch = (root: string, enabled: boolean) =>
    run(async () => {
      await sag2WatchFolder(root, enabled)
      await refreshFolders()
    })

  const runQuick = () =>
    run(async () => {
      setMode('quick')
      setDeep(null)
      setFused(null)
      setQuick(await sag2Search(query.trim()))
    })

  const runDeep = () =>
    run(async () => {
      setMode('deep')
      setQuick(null)
      setFused(null)
      setDeep(await sag2Retrieve(query.trim()))
    })

  const runFuse = () =>
    run(async () => {
      if (!deep?.results.length) return
      setFused(await sag2Fuse(deep.results))
    })

  const rows = mode === 'quick' ? (quick?.items ?? []) : (deep?.results ?? [])

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-4">
      <header className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-background px-4 py-3">
        <div className="mr-auto">
          <h1 className="text-base font-semibold text-foreground">{t('title')}</h1>
          <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
        </div>
        <span
          className={`rounded-md border px-2 py-1 text-xs transition-colors ${
            status?.ready
              ? 'border-foreground bg-primary text-primary-foreground'
              : 'border-border bg-muted text-muted-foreground'
          }`}
        >
          {status?.ready ? t('ready') : t('empty')}
        </span>
        <span className={META_CLASS}>
          {t('version')} {status?.version ?? '—'}
        </span>
        <span className={META_CLASS}>
          {t('documents')} {status?.documents ?? '—'}
        </span>
        <span className={META_CLASS}>
          {t('chunks')} {status?.chunks ?? '—'}
        </span>
        <span className={META_CLASS}>
          {t('terms')} {status?.terms ?? '—'}
        </span>
        <span className={META_CLASS}>
          {t('judgeProvider')} {status?.judge_provider ?? '—'}
        </span>
      </header>

      {error ? (
        <div
          role="alert"
          className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground"
        >
          {t('error')}: {error}
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(280px,1fr)_minmax(0,2fr)]">
        <section className={`${CARD_CLASS} gap-3 p-4`}>
          <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/30 p-3">
            <button
              type="button"
              onClick={() => setFoldersOpen((value) => !value)}
              className="flex items-center justify-between text-sm font-semibold text-foreground transition-colors hover:text-foreground/80"
            >
              <span>{t('foldersTitle')}</span>
              <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground">
                {folders?.folders.length ?? 0}
              </span>
            </button>

            {foldersOpen ? (
              <div className="flex flex-col gap-2">
                <Input
                  value={folderRoot}
                  onChange={(e) => setFolderRoot(e.target.value)}
                  placeholder={t('folderPlaceholder')}
                  aria-label={t('folderPath')}
                  className={FIELD_CLASS}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="primary"
                    disabled={busy || !folderRoot.trim()}
                    onClick={() => void addFolder()}
                    className="rounded-md px-3 py-2 text-sm"
                  >
                    {t('registerFolder')}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy || !(folders?.folders.length ?? 0)}
                    onClick={() => void scanAllFolders()}
                    className="rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent"
                  >
                    {t('scanFolders')}
                  </Button>
                </div>

                {scanStats ? (
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {summaryOf(scanStats)} · {scanStats.duration_ms}ms
                  </p>
                ) : null}

                <p className="text-xs text-muted-foreground">{t('foldersList')}</p>
                <div className="max-h-40 space-y-1 overflow-y-auto pr-1">
                  {(folders?.folders ?? []).length === 0 ? (
                    <p className="rounded border border-dashed border-border px-2 py-1.5 text-xs text-muted-foreground">
                      {t('noFolders')}
                    </p>
                  ) : null}
                  {(folders?.folders ?? []).map((folder) => {
                    const watching = (folders?.watching ?? []).includes(folder.root)
                    return (
                      <div
                        key={folder.root}
                        className="flex flex-wrap items-center gap-1.5 rounded border border-border bg-background px-2 py-1.5"
                      >
                        <span
                          className="mr-auto truncate text-xs text-foreground"
                          title={folder.root}
                        >
                          {folder.root}
                        </span>
                        <span className={META_CLASS}>
                          {folder.last_scan.changed ?? 0}/{folder.last_scan.scanned ?? 0}
                        </span>
                        <Button
                          variant={watching ? 'primary' : 'outline'}
                          disabled={busy}
                          onClick={() => void toggleWatch(folder.root, !watching)}
                          className="rounded px-2 py-0.5 text-xs transition-colors hover:bg-accent"
                        >
                          {t('watchFolder')}
                        </Button>
                        <Button
                          variant="outline"
                          disabled={busy}
                          onClick={() => void removeFolder(folder.root)}
                          className="rounded px-2 py-0.5 text-xs transition-colors hover:bg-accent"
                        >
                          {t('removeFolder')}
                        </Button>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : null}
          </div>

          <h2 className="text-sm font-semibold text-foreground">{t('docsTitle')}</h2>

          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            {t('docsPath')}
            <Input
              value={docPath}
              onChange={(e) => setDocPath(e.target.value)}
              placeholder={t('pathPlaceholder')}
              className={FIELD_CLASS}
            />
          </label>

          <label className="flex min-h-0 flex-1 flex-col gap-1 text-xs text-muted-foreground">
            {t('docsContent')}
            <textarea
              value={docContent}
              onChange={(e) => setDocContent(e.target.value)}
              placeholder={t('contentPlaceholder')}
              className={`${FIELD_CLASS} min-h-0 flex-1 resize-none leading-relaxed`}
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="primary"
              disabled={busy || !docPath.trim() || !docContent.trim()}
              onClick={() => void addDocument()}
              className="rounded-md px-3 py-2 text-sm"
            >
              {t('add')}
            </Button>
            <Button
              variant="outline"
              disabled={busy || !docPath.trim()}
              onClick={() => void removeDocument()}
              className="rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent"
            >
              {t('remove')}
            </Button>
          </div>

          {notice ? (
            <p className="rounded-md border border-border bg-muted px-3 py-2 text-xs text-foreground">
              {notice} · {t('modelCalls')}
            </p>
          ) : null}

          <p className="text-xs text-muted-foreground">
            {t('documents')}: {status?.documents ?? 0} · {t('chunks')}: {status?.chunks ?? 0}
          </p>
        </section>

        <section className={`${CARD_CLASS} gap-3 p-4`}>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="mr-auto text-sm font-semibold text-foreground">{t('queryTitle')}</h2>
            <Button
              variant={mode === 'quick' ? 'primary' : 'outline'}
              disabled={busy || !query.trim()}
              onClick={() => void runQuick()}
              className="rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-accent"
            >
              {t('quick')}
            </Button>
            <Button
              variant={mode === 'deep' ? 'primary' : 'outline'}
              disabled={busy || !query.trim()}
              onClick={() => void runDeep()}
              className="rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-accent"
            >
              {t('deep')}
            </Button>
            <Button
              variant="outline"
              disabled={busy || !deep?.results.length}
              onClick={() => void runFuse()}
              className="rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-accent"
            >
              {t('fuse')}
            </Button>
          </div>

          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('queryPlaceholder')}
            className={FIELD_CLASS}
          />

          {deep && !deep.judge.executed ? (
            <p className="rounded-md border border-border bg-muted px-3 py-2 text-xs text-foreground">
              {t('judgeOff')} · {deep.judge.mode} · {deep.judge.reason}
            </p>
          ) : null}

          {fused ? (
            <p className="rounded-md border border-border bg-muted px-3 py-2 text-xs text-foreground">
              {fused.channels.join(' + ')} · {fused.results.length} · k={fused.rrf_k}
            </p>
          ) : null}

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {rows.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
                {busy ? t('loading') : t('emptyResult')}
              </div>
            ) : null}

            {mode === 'quick'
              ? quick?.items.map((item) => (
                  <article
                    key={`${item.path}-${item.citation.byte_range[0]}`}
                    className="rounded-lg border border-border bg-background p-3 transition-colors hover:bg-accent/50"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{item.path}</span>
                      <span className={META_CLASS}>
                        {t('bm25')} {item.bm25}
                      </span>
                      <span className={META_CLASS}>{item.citation.doc_hash.slice(0, 12)}</span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {item.snippet}
                    </p>
                  </article>
                ))
              : deep?.results.map((row) => (
                  <article
                    key={row.key}
                    className="rounded-lg border border-border bg-background p-3 transition-colors hover:bg-accent/50"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{row.path}</span>
                      <span className={META_CLASS}>
                        {t('score')} {row.score}
                      </span>
                      <span className={META_CLASS}>
                        {t('bm25')} {row.bm25}
                      </span>
                      <span className={META_CLASS}>
                        {t('hop')} {row.hop}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {row.content}
                    </p>
                  </article>
                ))}
          </div>

          {deep ? (
            <div className="max-h-40 shrink-0 space-y-1 overflow-y-auto rounded-md border border-border bg-muted px-3 py-2 text-xs text-foreground">
              <p className="font-medium">
                {t('trace')} · {deep.status} · {deep.duration_ms}ms
              </p>
              {deep.trace.map((hop) => (
                <p key={hop.hop} className="text-muted-foreground">
                  #{hop.hop} · {t('tracePool')} {hop.pool_size} · {t('traceTerms')}{' '}
                  {hop.terms.map((term) => term.term).join(' / ') || '—'} ·{' '}
                  {hop.judge_executed ? hop.judge_mode : t('judgeOff')}
                </p>
              ))}
              {deep.citations.length ? (
                <p className="text-muted-foreground">
                  {t('citations')}:{' '}
                  {deep.citations
                    .slice(0, 3)
                    .map((c) => `${c.path} [${c.byte_range.join('-')}]`)
                    .join(' · ')}
                </p>
              ) : null}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
