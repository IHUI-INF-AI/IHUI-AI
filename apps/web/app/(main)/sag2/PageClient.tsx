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
  sag2Fuse,
  sag2RemoveDocument,
  sag2Retrieve,
  sag2Search,
  sag2Status,
  type Sag2FuseResult,
  type Sag2RetrieveResult,
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

  const refresh = useCallback(async () => {
    try {
      setStatus(await sag2Status())
    } catch (e) {
      setError(errorMessage(e))
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const run = useCallback(
    async (action: () => Promise<void>) => {
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
    },
    [],
  )

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

  const rows = mode === 'quick' ? quick?.items ?? [] : deep?.results ?? []

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-4">
      <header className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-background px-4 py-3">
        <div className="mr-auto">
          <h1 className="text-base font-semibold text-foreground">{t('title')}</h1>
          <p className="font-[weight:inherit] text-label text-muted-foreground">{t('subtitle')}</p>
        </div>
        <span
          className={`font-[weight:inherit] rounded-md border px-2 py-1 text-label transition-colors ${
            status?.ready
              ? 'border-foreground bg-primary text-primary-foreground'
              : 'border-border bg-muted text-muted-foreground'
          }`}
        >
          {status?.ready ? t('ready') : t('empty')}
        </span>
        <span className={META_CLASS}>{t('version')} {status?.version ?? '—'}</span>
        <span className={META_CLASS}>{t('documents')} {status?.documents ?? '—'}</span>
        <span className={META_CLASS}>{t('chunks')} {status?.chunks ?? '—'}</span>
        <span className={META_CLASS}>{t('terms')} {status?.terms ?? '—'}</span>
        <span className={META_CLASS}>{t('judgeProvider')} {status?.judge_provider ?? '—'}</span>
      </header>

      {error ? (
        <div role="alert" className="font-[weight:inherit] rounded-md border border-border bg-muted px-3 py-2 text-body text-foreground">
          {t('error')}: {error}
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(280px,1fr)_minmax(0,2fr)]">
        <section className={`${CARD_CLASS} gap-3 p-4`}>
          <h2 className="text-body font-semibold text-foreground">{t('docsTitle')}</h2>

          <label className="font-[weight:inherit] flex flex-col gap-1 text-label text-muted-foreground">
            {t('docsPath')}
            <Input
              value={docPath}
              onChange={(e) => setDocPath(e.target.value)}
              placeholder={t('pathPlaceholder')}
              className={FIELD_CLASS}
            />
          </label>

          <label className="font-[weight:inherit] flex min-h-0 flex-1 flex-col gap-1 text-label text-muted-foreground">
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
              className="font-[weight:inherit] rounded-md px-3 py-2 text-body"
            >
              {t('add')}
            </Button>
            <Button
              variant="outline"
              disabled={busy || !docPath.trim()}
              onClick={() => void removeDocument()}
              className="font-[weight:inherit] rounded-md px-3 py-2 text-body transition-colors hover:bg-accent"
            >
              {t('remove')}
            </Button>
          </div>

          {notice ? (
            <p className="font-[weight:inherit] rounded-md border border-border bg-muted px-3 py-2 text-label text-foreground">
              {notice} · {t('modelCalls')}
            </p>
          ) : null}

          <p className="font-[weight:inherit] text-label text-muted-foreground">
            {t('documents')}: {status?.documents ?? 0} · {t('chunks')}: {status?.chunks ?? 0}
          </p>
        </section>

        <section className={`${CARD_CLASS} gap-3 p-4`}>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="mr-auto text-body font-semibold text-foreground">{t('queryTitle')}</h2>
            <Button
              variant={mode === 'quick' ? 'primary' : 'outline'}
              disabled={busy || !query.trim()}
              onClick={() => void runQuick()}
              className="font-[weight:inherit] rounded-md px-3 py-1.5 text-body transition-colors hover:bg-accent"
            >
              {t('quick')}
            </Button>
            <Button
              variant={mode === 'deep' ? 'primary' : 'outline'}
              disabled={busy || !query.trim()}
              onClick={() => void runDeep()}
              className="font-[weight:inherit] rounded-md px-3 py-1.5 text-body transition-colors hover:bg-accent"
            >
              {t('deep')}
            </Button>
            <Button
              variant="outline"
              disabled={busy || !deep?.results.length}
              onClick={() => void runFuse()}
              className="font-[weight:inherit] rounded-md px-3 py-1.5 text-body transition-colors hover:bg-accent"
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
            <p className="font-[weight:inherit] rounded-md border border-border bg-muted px-3 py-2 text-label text-foreground">
              {t('judgeOff')} · {deep.judge.reason}
            </p>
          ) : null}

          {fused ? (
            <p className="font-[weight:inherit] rounded-md border border-border bg-muted px-3 py-2 text-label text-foreground">
              {fused.channels.join(' + ')} · {fused.results.length} · k={fused.rrf_k}
            </p>
          ) : null}

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {rows.length === 0 ? (
              <div className="font-[weight:inherit] flex h-full items-center justify-center rounded-lg border border-dashed border-border text-body text-muted-foreground">
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
                      <span className="text-body font-medium text-foreground">{item.path}</span>
                      <span className={META_CLASS}>{t('bm25')} {item.bm25}</span>
                      <span className={META_CLASS}>{item.citation.doc_hash.slice(0, 12)}</span>
                    </div>
                    <p className="font-[weight:inherit] mt-1 text-label leading-relaxed text-muted-foreground">{item.snippet}</p>
                  </article>
                ))
              : deep?.results.map((row) => (
                  <article
                    key={row.key}
                    className="rounded-lg border border-border bg-background p-3 transition-colors hover:bg-accent/50"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-body font-medium text-foreground">{row.path}</span>
                      <span className={META_CLASS}>{t('score')} {row.score}</span>
                      <span className={META_CLASS}>{t('bm25')} {row.bm25}</span>
                      <span className={META_CLASS}>{t('hop')} {row.hop}</span>
                    </div>
                    <p className="font-[weight:inherit] mt-1 text-label leading-relaxed text-muted-foreground">{row.content}</p>
                  </article>
                ))}
          </div>

          {deep ? (
            <div className="font-[weight:inherit] max-h-40 shrink-0 space-y-1 overflow-y-auto rounded-md border border-border bg-muted px-3 py-2 text-label text-foreground">
              <p className="font-medium">{t('trace')} · {deep.status} · {deep.duration_ms}ms</p>
              {deep.trace.map((hop) => (
                <p key={hop.hop} className="text-muted-foreground">
                  #{hop.hop} · {t('tracePool')} {hop.pool_size} · {t('traceTerms')}{' '}
                  {hop.terms.map((term) => term.term).join(' / ') || '—'} ·{' '}
                  {hop.judge_executed ? hop.judge_mode : t('judgeOff')}
                </p>
              ))}
              {deep.citations.length ? (
                <p className="text-muted-foreground">
                  {t('citations')}: {deep.citations.slice(0, 3).map((c) => `${c.path} [${c.byte_range.join('-')}]`).join(' · ')}
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
