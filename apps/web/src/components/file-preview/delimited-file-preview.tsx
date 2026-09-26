// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { CSV_PREVIEW_MAX_ROWS } from '@/lib/csv-preview'
import {
  classifyDelimitedText,
  columnWidthsInCh,
  clipPreviewRows,
  parseDelimited,
  RICH_PREVIEW_MAX_TEXT_BYTES,
  type DelimitedFormat,
} from '@/lib/file-preview-attachment'
import {
  PreviewSourceText,
  PreviewViewSwitch,
  type PreviewSourceAvailability,
  type PreviewViewMode,
} from '@/components/media/preview-view-switch'
import { PreviewErrorCard, type FilePreviewFailure } from './preview-error-card'

/**
 * CSV / TSV 分隔符表格富预览(V3 #70 判据 2)。
 *
 * 三条不可少的可见信息:
 *  - **共 N 行 × M 列**(N 是**数据行**全量,表头不计入被裁剪的行,也不计入 N);
 *  - 截断时**必现**"仅预览前 M 行"(静默变短等于伪造完整性);
 *  - 失败态逐型给错误卡(过大 / 类型不符 / 空 / 网络失败),不落回"一条裸链接"。
 *
 * 表头用 `sticky top-0` 固定;列宽由 `columnWidthsInCh` 按**可见行**最长内容算(CJK 记双宽),
 * 上限夹住后交给 CSS 换行,不裁内容。
 *
 * 与既有 `CsvPreview`(media/message-file-preview.tsx)的差别就是这三条 + TSV:
 * 那边把表头算进裁剪额度、失败时渲染成一条裸链接、并且没有表头粘住。
 */

export interface DelimitedFilePreviewProps {
  readonly src: string
  readonly format: DelimitedFormat
  readonly delimiter: string
  /** 预览行数上限(默认沿用 CSV_PREVIEW_MAX_ROWS,展开态显示全部)。 */
  readonly maxRows?: number
  readonly className?: string
}

/** 从 Content-Length 取字节数;缺失/非法一律返回 null(不得猜大小)。 */
function readContentLength(res: Response): number | null {
  const raw = res.headers.get('content-length')
  if (!raw) return null
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? n : null
}

export function DelimitedFilePreview({
  src,
  format,
  delimiter,
  maxRows = CSV_PREVIEW_MAX_ROWS,
  className,
}: DelimitedFilePreviewProps) {
  const t = useTranslations('chat')
  const [rows, setRows] = React.useState<string[][] | null>(null)
  const [raw, setRaw] = React.useState<string | null>(null)
  const [failure, setFailure] = React.useState<FilePreviewFailure | null>(null)
  const [detail, setDetail] = React.useState<string | undefined>(undefined)
  const [expanded, setExpanded] = React.useState(false)
  const [mode, setMode] = React.useState<PreviewViewMode>('preview')

  React.useEffect(() => {
    let cancelled = false
    setRows(null)
    setRaw(null)
    setFailure(null)
    setDetail(undefined)
    setExpanded(false)
    setMode('preview')

    fetch(src)
      .then(async (res) => {
        if (cancelled) return
        if (!res.ok) {
          setFailure('failed')
          setDetail(String(res.status))
          return
        }
        // 声明体积超上限就先拒,不把 20MB 正文拉进内存再判(那才是真"过大")
        const declared = readContentLength(res)
        if (declared !== null && declared > RICH_PREVIEW_MAX_TEXT_BYTES) {
          setFailure('tooLarge')
          return
        }
        const text = await res.text()
        if (cancelled) return
        const bad = classifyDelimitedText(text, declared)
        if (bad) {
          setFailure(bad === 'binary' ? 'typeMismatch' : bad)
          return
        }
        const parsed = parseDelimited(text, delimiter)
        if (parsed.length === 0) {
          setFailure('empty')
          return
        }
        // 原文留在手里:源码视图直接用它,切视图不再发第二次 fetch
        setRaw(text)
        setRows(parsed)
      })
      .catch(() => {
        if (cancelled) return
        // 网络/解析异常一律可见:错误卡 + 下载出口,不吞异常、不白屏
        setFailure('failed')
      })

    return () => {
      cancelled = true
    }
  }, [src, delimiter])

  if (failure) {
    return (
      <PreviewErrorCard
        failure={failure}
        ext={format}
        href={src}
        detail={detail}
        className={className}
      />
    )
  }

  const all = rows ?? []
  const header = all[0] ?? []
  const bodyAll = all.slice(1)
  const bodyView = clipPreviewRows(
    bodyAll,
    expanded ? Number.MAX_SAFE_INTEGER : maxRows,
  )
  const bodyRows = bodyView.rows
  const widths = columnWidthsInCh([header, ...bodyRows])
  const sourceAvailability: PreviewSourceAvailability =
    rows !== null && raw !== null
      ? { available: true }
      : { available: false, reason: 'previewSourceUnavailableLoad' }

  return (
    <div
      className={cn('my-0 overflow-hidden rounded-md border border-border', className)}
      data-testid="delimited-file-preview"
      data-preview-kind={format}
      data-delimited-total={bodyView.total}
      data-delimited-shown={bodyView.shown}
      data-delimited-truncated={bodyView.truncated ? 'true' : 'false'}
      data-preview-view={mode}
      data-artifact-preview-kind={format}
    >
      <div className="flex items-center justify-between gap-2 bg-muted/40 px-2 py-1">
        <span className="flex min-w-0 shrink items-center gap-2">
          <span className="shrink-0 rounded-xs bg-muted px-1 text-[10px] font-semibold uppercase tabular-nums">
            {format}
          </span>
          <span className="truncate text-[10px] font-medium text-muted-foreground">
            {t('csvPreviewMeta', { rows: bodyView.total, cols: header.length })}
            {bodyView.truncated
              ? ` · ${t('officeRowsTruncated', { rows: bodyView.shown })}`
              : ''}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <PreviewViewSwitch mode={mode} onModeChange={setMode} source={sourceAvailability} />
          {bodyView.truncated ? (
            <button
              type="button"
              onClick={() => setExpanded((p) => !p)}
              className="inline-flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground transition-colors hover:text-foreground"
              data-testid="delimited-expand-toggle"
            >
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              <span>{expanded ? t('csvCollapse') : t('csvExpand')}</span>
            </button>
          ) : null}
        </span>
      </div>

      {mode === 'source' ? (
        <PreviewSourceText
          status="ready"
          text={raw ?? ''}
          truncated={false}
          testId="delimited-source-text"
        />
      ) : rows === null ? (
        <p className="p-3 text-xs text-muted-foreground">{t('csvLoading')}</p>
      ) : (
        <div className="max-h-[360px] overflow-auto">
          <table
            className="min-w-full border-collapse text-xs"
            data-testid="delimited-table"
            style={{ tableLayout: 'fixed' }}
          >
            <thead className="sticky top-0 z-10">
              <tr>
                {header.map((cell, i) => (
                  <th
                    key={`h-${i}`}
                    scope="col"
                    className="break-words bg-muted px-2 py-1 text-left font-medium"
                    style={{ width: `${widths[i] ?? 8}ch` }}
                    data-testid="delimited-header-cell"
                  >
                    {cell}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bodyRows.map((row, ri) => (
                <tr key={`r-${ri}`}>
                  {row.map((cell, ci) => (
                    <td
                      key={`c-${ci}`}
                      className="break-words px-2 py-1 align-top"
                      data-testid="delimited-cell"
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
