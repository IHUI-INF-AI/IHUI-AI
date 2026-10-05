// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { Check, Copy, Download, Maximize2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@ihui/ui-react'
import { Tooltip } from '@/components/feedback'
// G-824:单元格可携 assistant 生成的不可信文本,CSV 落盘前必须过既有唯一出口
// (apps/web/src/lib/export-utils.ts neutralizeFormulaCell, G-823 落地),不得在本文件
// 另写一份前缀中和 —— 那正是 G-823 判定"第四份转义实现"的形态。
import { neutralizeFormulaCell } from '@/lib/export-utils'
// G-827:横向溢出的方向线索。判据与外观都只有一份实现,接线处只负责"把滚动容器的 ref 交出去"。
import { HorizontalEdgeCue } from '@/components/ai/horizontal-edge-cue'
import { useHorizontalEdgeCue } from '@/hooks/use-horizontal-edge-cue'

/**
 * G-824 内联表格工具栏 —— DOM 回读 → 复制 GFM / 下载 CSV / 全屏(sticky 表头)。
 *
 * 结构对标上游 ai-elements/markdown-table.tsx:116-128(readRowsFromTable)、
 * :93-107(buildMarkdownTableText)、:1105-1148(copy/CSV 与能力缺失分支)、
 * :1299-1318(Dialog 内 [&_th]:sticky);词条为我方自拟,非上游文案。
 *
 * **为什么必须从真实 DOM 回读**:本组件拿到的是 ReactMarkdown 已经渲染完的
 * <table>。表格里的文本经过了 inline code 拆段、del 拆段、链接拆 <a>、
 * 任务列表 checkbox 等一整套 components 改写 —— 此刻 DOM 上的 textContent
 * 才是"用户眼睛看到的那张表"。若改为从 markdown 源码二次解析,或用
 * innerHTML 拼 GFM(守门禁止),复制出去的东西就会与眼前的表不一致,
 * 这一族工具栏的全部意义随之消失。流式半成品表(还在追加行)也天然由此可读。
 */

/** 从渲染后的 <table> 真实 DOM 取文。thead 的 th 作表头,tbody 的 tr/td 作数据行。 */
export function readRowsFromTable(table: HTMLTableElement | null): string[][] {
  if (!table) return []
  const headerCells = Array.from(table.querySelectorAll('thead th'))
  const rows: string[][] = []
  if (headerCells.length > 0) {
    rows.push(headerCells.map((cell) => (cell.textContent ?? '').trim()))
  }
  // tbody 可能不存在(流式半成品表 react-markdown 尚未闭合),退回全表 tr 扫描并
  // 去掉已计入表头的那一行,避免表头出现两次。
  const bodyRows = Array.from(table.querySelectorAll('tbody tr'))
  const fallbackRows = bodyRows.length > 0 ? bodyRows : Array.from(table.querySelectorAll('tr'))
  for (const tr of fallbackRows) {
    if (headerCells.length > 0 && tr.querySelector('th')) continue
    const cells = Array.from(tr.querySelectorAll('td'))
    if (cells.length === 0) continue
    rows.push(cells.map((cell) => (cell.textContent ?? '').trim()))
  }
  return rows
}

/**
 * 由回读得到的行文本拼 GFM 表格文本。
 * 形态对标上游 :93-107 —— 按 max 列数补空(流式半成品表列数不齐)、表头后插
 * `---` 分隔行、单元格内 `|` 与 `\` 转义、换行折成 <br>
 * (GFM 表格单元格不支持裸换行,折行即丢字)。
 */
export function buildMarkdownTableText(rows: string[][]): string {
  if (rows.length === 0) return ''
  const columnCount = rows.reduce((max, row) => Math.max(max, row.length), 0)
  if (columnCount === 0) return ''
  const escapeCell = (text: string) =>
    text.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>').trim()
  const toLine = (row: string[]) => {
    const padded = Array.from({ length: columnCount }, (_, i) => escapeCell(row[i] ?? ''))
    return `| ${padded.join(' | ')} |`
  }
  const [header = [], ...body] = rows
  // 无表头时 GFM 仍要求首行当表头,故分隔行永远落在第一行之后
  const separator = `| ${Array.from({ length: columnCount }, () => '---').join(' | ')} |`
  return [toLine(header), separator, ...body.map(toLine)].join('\n')
}

/** 由回读得到的行文本拼 CSV(带 BOM 的 UTF-8,Excel 直开不乱码)。 */
export function buildCsvText(rows: string[][]): string {
  if (rows.length === 0) return ''
  const columnCount = rows.reduce((max, row) => Math.max(max, row.length), 0)
  const escapeCsv = (text: string) => {
    const safe = neutralizeFormulaCell(text)
    return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
  }
  return (
    '\uFEFF' +
    rows
      .map((row) =>
        Array.from({ length: columnCount }, (_, i) => escapeCsv(row[i] ?? '')).join(','),
      )
      .join('\n')
  )
}

const ICON_BUTTON_BASE =
  'inline-flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring'

/** 工具栏按钮:文案走 §19 五语言词表 chat.markdownTable.*,hover 提示用项目 Tooltip(禁原生 title) */
function ToolbarButton({
  label,
  onClick,
  children,
  testId,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
  testId: string
}) {
  return (
    <Tooltip content={label}>
      <button
        type="button"
        aria-label={label}
        data-testid={testId}
        onClick={onClick}
        className={ICON_BUTTON_BASE}
      >
        {children}
      </button>
    </Tooltip>
  )
}

/**
 * 表格块容器:工具栏 + 可横向滚动的 <table>。
 * 存在理由:ReactMarkdown 的 components.table 是普通函数(不是组件),拿不到
 * useRef;而工具栏必须拿到**同一个**真实 <table> 才能回读。拆成组件后
 * markdown-stream.tsx 的 table() 只剩一行接线,爆炸半径仍限表格节点。
 */
export function MarkdownTableBlock({ children }: { children: React.ReactNode }) {
  const tableRef = React.useRef<HTMLTableElement | null>(null)
  // G-827:线索挂在**滚动容器**上(不是 <table>),因为它才是 scrollLeft/clientWidth 的主人。
  // ref 交给 hook,本组件不参与任何溢出判断 —— 判据只住在 horizontal-edge-cue 那一处。
  const scrollRef = React.useRef<HTMLDivElement | null>(null)
  const edges = useHorizontalEdgeCue(scrollRef)
  return (
    <div className="my-0">
      <MarkdownTableToolbar tableRef={tableRef} />
      <div className="relative">
        <div ref={scrollRef} className="overflow-x-auto">
          {/* 2026-08-02:表格字号同步放大 14px → 15px */}
          <table ref={tableRef} className="my-0 w-full border-collapse text-[15px]">
            {children}
          </table>
        </div>
        {/* 覆盖层必须是滚动容器的兄弟:放在容器**内部**会随内容一起滚走,线索就跟着跑了。
            直接父级不是圆角容器 ⇒ 用 flush 档(§4 圆角避让那一档留给代码块外框)。 */}
        <HorizontalEdgeCue edges={edges} />
      </div>
    </div>
  )
}

export interface MarkdownTableToolbarProps {
  /** 渲染后的真实 <table> 元素;复制/CSV 一律从它回读,不走 markdown 源码 */
  tableRef: React.RefObject<HTMLTableElement | null>
}

export function MarkdownTableToolbar({ tableRef }: MarkdownTableToolbarProps) {
  const t = useTranslations('chat')
  const [copied, setCopied] = React.useState(false)
  const [notice, setNotice] = React.useState('')
  const [fullscreen, setFullscreen] = React.useState(false)
  const copyTimerRef = React.useRef<number | null>(null)
  const noticeTimerRef = React.useRef<number | null>(null)
  const [dialogTable, setDialogTable] = React.useState<HTMLTableElement | null>(null)

  React.useEffect(() => {
    const timers = [copyTimerRef, noticeTimerRef]
    return () => {
      for (const ref of timers) {
        if (ref.current !== null) {
          window.clearTimeout(ref.current)
          ref.current = null
        }
      }
    }
  }, [])

  const flash = React.useCallback(
    (setter: (v: boolean) => void, timerRef: React.RefObject<number | null>) => {
      setter(true)
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
      timerRef.current = window.setTimeout(() => setter(false), 1500)
    },
    [],
  )

  const flashNotice = React.useCallback((key: string) => {
    setNotice(key)
    if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current)
    noticeTimerRef.current = window.setTimeout(() => setNotice(''), 1500)
  }, [])

  const handleCopy = React.useCallback(() => {
    const rows = readRowsFromTable(tableRef.current)
    const markdown = buildMarkdownTableText(rows)
    if (markdown === '') {
      flashNotice('markdownTable.empty')
      return
    }
    // 能力缺失分支:非安全上下文(navigator.clipboard 整个不存在)时如实报失败,
    // 不静默无响应、也不谎报成功
    const clipboard = typeof navigator === 'undefined' ? undefined : navigator.clipboard
    if (!clipboard || typeof clipboard.writeText !== 'function') {
      flashNotice('markdownTable.unsupported')
      return
    }
    clipboard.writeText(markdown).then(
      () => flash(setCopied, copyTimerRef),
      () => flashNotice('markdownTable.copyFailed'),
    )
  }, [flash, flashNotice, tableRef])

  const handleDownload = React.useCallback(() => {
    const rows = readRowsFromTable(tableRef.current)
    const csv = buildCsvText(rows)
    if (csv === '') {
      flashNotice('markdownTable.empty')
      return
    }
    // 能力缺失分支:无 Blob / 无 createObjectURL 时不抛未捕获异常,如实报失败
    if (
      typeof Blob === 'undefined' ||
      typeof URL === 'undefined' ||
      typeof URL.createObjectURL !== 'function'
    ) {
      flashNotice('markdownTable.unsupported')
      return
    }
    try {
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = 'table.csv'
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      URL.revokeObjectURL(url)
    } catch {
      flashNotice('markdownTable.csvFailed')
    }
  }, [flashNotice, tableRef])

  const handleFullscreen = React.useCallback(() => {
    const table = tableRef.current
    if (!table) {
      flashNotice('markdownTable.empty')
      return
    }
    setDialogTable(table)
    setFullscreen(true)
  }, [flashNotice, tableRef])

  const noticeText = notice === '' ? '' : t(notice)

  return (
    <div
      data-testid="markdown-table-toolbar"
      className="my-0 flex items-center justify-end gap-0.5 pb-0.5"
    >
      {noticeText !== '' && (
        <span
          role="status"
          data-testid="markdown-table-notice"
          className="mr-1 text-[10px] text-muted-foreground"
        >
          {noticeText}
        </span>
      )}
      <ToolbarButton
        label={t('markdownTable.copy')}
        onClick={handleCopy}
        testId="markdown-table-copy"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </ToolbarButton>
      <ToolbarButton
        label={t('markdownTable.downloadCsv')}
        onClick={handleDownload}
        testId="markdown-table-download"
      >
        <Download className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label={t('markdownTable.fullscreen')}
        onClick={handleFullscreen}
        testId="markdown-table-fullscreen"
      >
        <Maximize2 className="h-3.5 w-3.5" />
      </ToolbarButton>

      <Dialog open={fullscreen} onOpenChange={setFullscreen}>
        <DialogContent
          hideCloseButton={false}
          data-testid="markdown-table-dialog"
          className="max-w-[95vw] [&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-muted"
        >
          <DialogHeader>
            <DialogTitle className="text-sm">{t('markdownTable.fullscreenTitle')}</DialogTitle>
          </DialogHeader>
          {/* 2026-09-25:全屏里放同一张表的克隆(appendChild 会把原节点搬走,
              工具栏随即失去回读源)。克隆发生在点击那一刻,用户点击前对表做的
              任何改动都在克隆里,与"眼前看到的一致"这一条不冲突。 */}
          <div className="max-h-[70vh] overflow-auto">
            {dialogTable ? <MarkdownTablePortal table={dialogTable} /> : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** 把真实 <table> 克隆一份渲染进 Dialog(React 不能直接渲染已存在的 DOM 节点) */
function MarkdownTablePortal({ table }: { table: HTMLTableElement }) {
  const hostRef = React.useRef<HTMLDivElement | null>(null)
  React.useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const clone = table.cloneNode(true) as HTMLTableElement
    clone.className = table.className
    host.replaceChildren(clone)
    return () => {
      host.replaceChildren()
    }
  }, [table])
  return <div ref={hostRef} data-testid="markdown-table-fullscreen-body" />
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
