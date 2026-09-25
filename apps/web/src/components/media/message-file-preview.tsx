// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { clipCsvRows, CSV_PREVIEW_MAX_ROWS, parseCsv } from '@/lib/csv-preview'

/**
 * MessageFilePreview — PDF/CSV 消息内富预览(P3 #32,2026-09-16 立)。
 *
 * 由 markdown-stream 的 MarkdownLink 在**非流式**时挂载(流式中渲染下载卡,
 * 完成后升级为富预览,与既有 INLINE_PREVIEW_RE 的"流式中不抖 iframe"守卫同思路):
 *  - PdfEmbed:浏览器原生 PDF 查看器 iframe(零解析成本),含"新窗口打开"外链;
 *    D41(2026-09-24)升级:页码显示 + 页码跳转(pdfjs 仅取 numPages,取不到
 *    时降级为只显示当前页,#page= 锚由浏览器原生查看器处理)
 *  - CsvPreview:fetch 文本 → 状态机解析(RFC 4180 引号语义)→ 表格渲染,
 *    默认前 50 行可展开全部;首行按表头加粗
 */

/** PDF 内嵌预览(浏览器原生查看器)。高度固定 420px,滚动由查看器内部处理。 */
export function PdfEmbed({ src, className }: { src: string; className?: string }) {
  const t = useTranslations('chat')
  const [page, setPage] = React.useState(1)
  const [total, setTotal] = React.useState<number | null>(null)
  const [jumpValue, setJumpValue] = React.useState('')

  // 仅取 numPages(总页数);worker/网络不可用时静默降级,不影响 iframe 预览
  React.useEffect(() => {
    let cancelled = false
    import('pdfjs-dist')
      .then(async (pdfjs) => {
        try {
          if (!pdfjs.GlobalWorkerOptions.workerSrc) {
            pdfjs.GlobalWorkerOptions.workerSrc = new URL(
              'pdfjs-dist/build/pdf.worker.min.mjs',
              import.meta.url,
            ).toString()
          }
          const doc = await pdfjs.getDocument({ url: src }).promise
          if (!cancelled) setTotal(doc.numPages)
        } catch {
          /* 降级:无总页数 */
        }
      })
      .catch(() => {
        /* 模块加载失败:降级 */
      })
    return () => {
      cancelled = true
    }
  }, [src])

  const applyJump = () => {
    const n = Math.floor(Number(jumpValue))
    if (!Number.isFinite(n) || n < 1) return
    setPage(total ? Math.min(n, total) : n)
    setJumpValue('')
  }

  return (
    <div
      className={cn('my-0 overflow-hidden rounded-md border border-border', className)}
      data-testid="pdf-embed"
      data-artifact-preview-kind="pdf"
    >
      <div className="flex items-center justify-between gap-2 bg-muted/40 px-2 py-1">
        <span className="truncate text-[10px] font-medium text-muted-foreground">
          {total !== null ? t('pdfPageIndicator', { page, total }) : t('pdfPageOnly', { page })}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="flex items-center gap-1">
            <input
              type="number"
              min={1}
              value={jumpValue}
              onChange={(e) => setJumpValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') applyJump()
              }}
              aria-label={t('pdfPageJumpLabel')}
              data-testid="pdf-page-input"
              className="h-5 w-12 rounded border border-border bg-background px-1 text-[10px] tabular-nums outline-none focus:ring-1 focus:ring-ring"
            />
            <button
              type="button"
              onClick={applyJump}
              data-testid="pdf-page-jump"
              className="text-[10px] text-muted-foreground transition-colors hover:text-foreground"
            >
              {t('pdfPageJump')}
            </button>
          </span>
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground transition-colors hover:text-foreground"
            data-testid="pdf-open-external"
          >
            <ExternalLink className="h-3 w-3" />
            {t('pdfOpenExternal')}
          </a>
        </span>
      </div>
      <iframe
        title="pdf-preview"
        src={`${src}#page=${page}`}
        className="h-[420px] w-full bg-white"
      />
    </div>
  )
}

/** CSV 表格预览:懒加载(fetch 在挂载后),失败降级为原始链接。 */
export function CsvPreview({ src }: { src: string }) {
  const t = useTranslations('chat')
  const [rows, setRows] = React.useState<string[][] | null>(null)
  const [failed, setFailed] = React.useState(false)
  const [expanded, setExpanded] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    setRows(null)
    setFailed(false)
    fetch(src)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status))
        return r.text()
      })
      .then((text) => {
        if (!cancelled) setRows(parseCsv(text))
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [src])

  if (failed) {
    return (
      <a
        href={src}
        target="_blank"
        rel="noopener noreferrer"
        className="my-0 inline-flex items-center gap-1.5 rounded-md border border-border bg-streamed-container-bg px-2.5 py-1 text-sm transition-colors hover:bg-streamed-container-bg-hover"
        data-testid="csv-preview-fallback"
      >
        {src.split('/').pop()?.split('?')[0] || 'CSV'}
      </a>
    )
  }

  const parsed = rows ?? []
  const view = clipCsvRows(parsed, expanded ? Number.MAX_SAFE_INTEGER : CSV_PREVIEW_MAX_ROWS)
  const header = view.rows[0] ?? []
  const bodyRows = view.rows.slice(1)

  return (
    <div
      className="my-0 overflow-hidden rounded-md border border-border"
      data-testid="csv-preview"
      data-csv-total={view.total}
      data-artifact-preview-kind="csv"
    >
      <div className="flex items-center justify-between gap-2 bg-muted/40 px-2 py-1">
        <span className="truncate text-[10px] font-medium text-muted-foreground">
          {t('csvPreviewMeta', { rows: view.total, cols: header.length })}
        </span>
        {view.truncated && (
          <button
            type="button"
            onClick={() => setExpanded((p) => !p)}
            className="inline-flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground transition-colors hover:text-foreground"
            data-testid="csv-expand-toggle"
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            <span>{expanded ? t('csvCollapse') : t('csvExpand')}</span>
          </button>
        )}
      </div>
      <div className="max-h-[360px] overflow-auto">
        {rows === null ? (
          <p className="p-3 text-xs text-muted-foreground">{t('csvLoading')}</p>
        ) : (
          <table className="w-full border-collapse text-xs" data-testid="csv-table">
            <thead>
              <tr>
                {header.map((h, i) => (
                  <th
                    key={`h-${i}`}
                    className="border border-border bg-muted/50 px-2 py-1 text-left font-medium"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bodyRows.map((r, ri) => (
                <tr key={`r-${ri}`}>
                  {r.map((c, ci) => (
                    <td key={`c-${ci}`} className="border border-border px-2 py-1">
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
