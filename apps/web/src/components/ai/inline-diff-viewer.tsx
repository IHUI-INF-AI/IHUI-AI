// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * Diff 渲染套件(V3 #66 重写,2026-09-26)。
 *
 * 本文件是**唯一的 diff 排版实现**,三个消费面共用:
 *  - `InlineDiffViewer`  —— 独立单栏查看器(IDE 面板 unified 档 / 旧调用方)
 *  - `SplitDiffBody`     —— 左右两栏并排(`diff-preview.tsx` 与 chat 卡片共用)
 *  - `ThreeWayMergeView` —— base / ours / theirs 三方落差 + 逐块选择来源
 *
 * 为什么收在这里而不是各面各写:旧写法下 chat 卡片自己 map rows、IDE split 面自己两列
 * grid、IDE unified 面还拿 `旧行[i] vs 新行[i]` 的假 diff 出文本 —— 三份排版互不对齐,
 * 同一改动在两处看到的行序都不一样。排版收敛为 `@/lib/diff-split-rows` 的纯投影,
 * 组件只负责把投影画出来。
 *
 * 判据落点:行配对 / 空侧占位 / 跨 hunk 折叠的正确性由 `lib/__tests__/diff-split-rows.test.ts`
 * 在纯函数层逐形态钉死;组件层只测"投影是否如实落到 DOM",不在两处重复断言同一件事。
 */

import * as React from 'react'
import { Copy, MessageSquarePlus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { useClipboard } from '@/hooks/use-clipboard'
import { useToast } from '@/hooks/use-toast'
import { computeHunkDiff } from '@/lib/hunk-diff'
import type { DiffLine } from '@/lib/hunk-diff'
import {
  DEFAULT_CONTEXT_LINES,
  toSplitEntries,
  toUnifiedEntries,
  unifiedRowLineNo,
  unifiedRowText,
  type FoldInfo,
  type SplitCell,
  type SplitEntry,
  type UnifiedEntry,
} from '@/lib/diff-split-rows'
import {
  buildMergedContent,
  chooseAllConflicts,
  computeThreeWay,
  mergeResolutions,
  summarizeMerge,
  type MergeChoice,
  type ThreeWayBlock,
  type ThreeWayMerge,
} from '@/lib/diff-three-way'

// ============================================================================
// 共用行原语
// ============================================================================

const GUTTER_CLS = 'w-10 shrink-0 select-none px-2 text-right tabular-nums text-muted-foreground/70'
const TEXT_CLS = 'min-w-0 flex-1 whitespace-pre text-foreground'
/** 与既有 diff 面同色档(新增绿 / 删除红),不引入新色值 */
const ADD_BG = 'bg-green-500/15'
const DEL_BG = 'bg-red-500/15'

/** 折叠条:必须可就地展开 —— 折叠不给出口等于静默隐藏内容 */
function FoldBar({ fold, testId }: { fold: FoldInfo; testId: string }): React.JSX.Element {
  const t = useTranslations('ide')
  const [open, setOpen] = React.useState(false)
  if (open) {
    return (
      <div data-testid={`${testId}-expanded`}>
        {fold.elided.map((row, idx) => (
          <div key={`el-${idx}`} className="flex">
            <span className={GUTTER_CLS}>{row.oldNum ?? ''}</span>
            <span className={GUTTER_CLS}>{row.newNum ?? ''}</span>
            <span className={TEXT_CLS}>{unifiedRowText(row)}</span>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="w-full bg-muted/40 px-2 py-0.5 text-left text-[10px] text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
          data-testid={`${testId}-collapse`}
        >
          <span>{t('diffViewer.collapseContext')}</span>
        </button>
      </div>
    )
  }
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="w-full bg-muted/40 px-2 py-0.5 text-left text-[10px] text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
      data-testid={testId}
    >
      <span>{t('diffViewer.foldedLines', { count: fold.skipped })}</span>
    </button>
  )
}

/** 行级评论入口(锚定新文件侧行号,与 chat 卡片既有语义一致) */
function RowCommentButton({
  lineNo,
  text,
  onComment,
  label,
}: {
  lineNo: number
  text: string
  onComment: (line: number, lineText: string) => void
  label: string
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={() => onComment(lineNo, text)}
      aria-label={label}
      className="ml-auto mr-1 shrink-0 self-center rounded-sm p-0.5 text-muted-foreground/60 opacity-0 transition-opacity hover:bg-muted/70 hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100"
      data-testid={`diff-row-comment-${lineNo}`}
    >
      <MessageSquarePlus className="h-3 w-3" aria-hidden />
    </button>
  )
}

// ============================================================================
// unified(单栏)渲染体
// ============================================================================

export interface UnifiedDiffBodyProps {
  entries: UnifiedEntry[]
  /** 变更段小标题注入(hunkId 变化时调用一次);返回 undefined 即不渲染 */
  renderHunkHeader?: (hunkId: number) => React.ReactNode
  onRowComment?: (line: number, lineText: string) => void
  commentLabel?: string
  /** 当前定位行(评论锚定高亮) */
  activeLine?: number
}

/** 单栏主体:被 chat 卡片与独立查看器共用,行序/折叠全部来自 `entries` */
export function UnifiedDiffBody({
  entries,
  renderHunkHeader,
  onRowComment,
  commentLabel,
  activeLine,
}: UnifiedDiffBodyProps): React.JSX.Element {
  let prevHunkId: number | null = null
  const rendered = entries.map((entry, idx) => {
    if (entry.kind === 'fold') {
      prevHunkId = null
      return <FoldBar key={`fold-${idx}`} fold={entry.fold} testId={`diff-fold-${idx}`} />
    }
    const { row } = entry
    const header =
      entry.hunkId !== null && entry.hunkId !== prevHunkId ? renderHunkHeader?.(entry.hunkId) : undefined
    prevHunkId = entry.hunkId
    const isAdd = row.op === 'insert'
    const isDel = row.op === 'delete'
    const lineNo = unifiedRowLineNo(row)
    const text = unifiedRowText(row)
    const isActive = activeLine !== undefined && activeLine === lineNo
    return (
      <React.Fragment key={`row-${idx}`}>
        {header}
        <div
          className={cn(
            'group flex',
            isAdd && ADD_BG,
            isDel && DEL_BG,
            isActive && 'ring-1 ring-inset ring-primary/60',
          )}
          data-testid={`diff-urow-${idx}`}
        >
          <span className={GUTTER_CLS}>{row.oldNum ?? ''}</span>
          <span className={GUTTER_CLS}>{row.newNum ?? ''}</span>
          <span
            className={cn(
              'w-4 shrink-0 text-center',
              isAdd && 'text-green-600 dark:text-green-400',
              isDel && 'text-red-600 dark:text-red-400',
            )}
          >
            {isAdd ? '+' : isDel ? '-' : ''}
          </span>
          <span className={TEXT_CLS}>{text}</span>
          {onRowComment && lineNo !== undefined && (
            <RowCommentButton
              lineNo={lineNo}
              text={text}
              onComment={onRowComment}
              label={commentLabel ?? ''}
            />
          )}
        </div>
      </React.Fragment>
    )
  })
  return <div data-testid="diff-unified-body">{rendered}</div>
}

// ============================================================================
// split(左右两栏)渲染体
// ============================================================================

type CellOp = 'add' | 'del' | 'equal' | 'empty'

function SplitCellView({
  cell,
  op,
  side,
  activeLine,
  comment,
}: {
  cell: SplitCell | null
  op: CellOp
  side: 'left' | 'right'
  activeLine?: number
  comment: { onComment: (line: number, text: string) => void; label: string } | null
}): React.JSX.Element {
  if (!cell) {
    // 空侧占位:必须产出一格等高空白,否则两栏行高逐行错开(对齐判据的一半)
    return (
      <div aria-hidden className="flex bg-muted/25" data-testid={`diff-empty-${side}`}>
        <span className={GUTTER_CLS} />
        <span className={TEXT_CLS} />
      </div>
    )
  }
  const isActive = activeLine !== undefined && activeLine === cell.num
  return (
    <div
      className={cn(
        'group flex',
        op === 'add' && ADD_BG,
        op === 'del' && DEL_BG,
        isActive && 'ring-1 ring-inset ring-primary/60',
      )}
      data-testid={`diff-scell-${side}`}
    >
      <span className={GUTTER_CLS} data-testid={`diff-snum-${side}`}>
        {cell.num}
      </span>
      <span className={TEXT_CLS} data-testid={`diff-stext-${side}`}>
        {cell.text}
      </span>
      {comment && (
        <RowCommentButton
          lineNo={cell.num}
          text={cell.text}
          onComment={comment.onComment}
          label={comment.label}
        />
      )}
    </div>
  )
}

export interface SplitDiffBodyProps {
  entries: SplitEntry[]
  renderHunkHeader?: (hunkId: number) => React.ReactNode
  onRowComment?: (line: number, lineText: string) => void
  commentLabel?: string
  activeLine?: number
  /** 两侧列头文案;缺省不渲染列头 */
  columnLabels?: { left: string; right: string }
}

/** 两栏并排主体:grid 两列 ⇒ 左右两格由**同一条 entry** 产出,天然对齐 */
export function SplitDiffBody({
  entries,
  renderHunkHeader,
  onRowComment,
  commentLabel,
  activeLine,
  columnLabels,
}: SplitDiffBodyProps): React.JSX.Element {
  const rendered: React.ReactNode[] = []
  if (columnLabels) {
    rendered.push(
      <div
        key="label-left"
        className="bg-muted/50 px-2 py-0.5 text-center text-[10px] text-muted-foreground"
        data-testid="diff-split-label-left"
      >
        <span>{columnLabels.left}</span>
      </div>,
      <div
        key="label-right"
        className="bg-muted/50 px-2 py-0.5 text-center text-[10px] text-muted-foreground"
        data-testid="diff-split-label-right"
      >
        <span>{columnLabels.right}</span>
      </div>,
    )
  }
  let prevHunkId: number | null = null
  entries.forEach((entry, idx) => {
    if (entry.kind === 'fold') {
      prevHunkId = null
      rendered.push(
        <div key={`fold-${idx}`} className="col-span-2">
          <FoldBar fold={entry.fold} testId={`diff-fold-${idx}`} />
        </div>,
      )
      return
    }
    const header =
      entry.hunkId !== null && entry.hunkId !== prevHunkId ? renderHunkHeader?.(entry.hunkId) : undefined
    prevHunkId = entry.hunkId
    if (header) {
      rendered.push(
        <div key={`hunk-${idx}`} className="col-span-2">
          {header}
        </div>,
      )
    }
    const { left, right } = entry
    const leftOp: CellOp = left === null ? 'empty' : right === null ? 'del' : 'equal'
    const rightOp: CellOp = right === null ? 'empty' : left === null ? 'add' : 'equal'
    // 每行**只出一个**评论入口:优先新文件侧(与 unified 的锚定口径一致),
    // 纯删除行(右侧为空)退回左侧 —— 两个都出会让 data-testid 撞车。
    const comment = onRowComment ? { onComment: onRowComment, label: commentLabel ?? '' } : null
    rendered.push(
      <SplitCellView
        key={`left-${idx}`}
        cell={left}
        op={leftOp}
        side="left"
        activeLine={activeLine}
        comment={right === null ? comment : null}
      />,
      <SplitCellView
        key={`right-${idx}`}
        cell={right}
        op={rightOp}
        side="right"
        activeLine={activeLine}
        comment={right !== null ? comment : null}
      />,
    )
  })
  return (
    <div className="grid grid-cols-2 items-start gap-x-3" data-testid="diff-split-body">
      {rendered}
    </div>
  )
}

/** 双侧内容 → 两栏投影(唯一入口,免得各面自己算) */
export function buildSplitEntries(
  oldContent: string,
  newContent: string,
  contextLines: number = DEFAULT_CONTEXT_LINES,
): SplitEntry[] {
  return toSplitEntries(computeHunkDiff(oldContent, newContent), { contextLines })
}

/** 双侧内容 → 单栏投影 */
export function buildUnifiedEntries(
  oldContent: string,
  newContent: string,
  contextLines: number = DEFAULT_CONTEXT_LINES,
): UnifiedEntry[] {
  return toUnifiedEntries(computeHunkDiff(oldContent, newContent), { contextLines })
}

// ============================================================================
// 独立查看器(容器):unified 单栏
// ============================================================================

interface InlineDiffViewerProps {
  /** 真实双侧内容(优先):走 `@/lib/hunk-diff` 的 LCS,与 chat 面 / patch 导出同源 */
  oldContent?: string
  newContent?: string
  /**
   * 兼容旧调用:直接给 unified 文本(按 `+`/`-` 前缀着色,不做 LCS)。
   * 新代码一律传 old/new —— 本入口只为不打破既有调用方而留。
   */
  content?: string
  filename?: string
  contextLines?: number
  renderHunkHeader?: (hunkId: number) => React.ReactNode
  onRowComment?: (line: number, lineText: string) => void
  commentLabel?: string
  activeLine?: number
}

/** 把 `+`/`-` 文本行解析成单栏 entries(兼容路径,不做二次 diff) */
function entriesFromPatchText(patch: string): UnifiedEntry[] {
  const lines = patch === '' ? [] : patch.split('\n')
  let num = 0
  return lines.map((line) => {
    const first = line[0] ?? ''
    if (first === '+') {
      num += 1
      return {
        kind: 'row' as const,
        hunkId: null,
        row: { op: 'insert' as const, newLine: { text: line.slice(1), eol: '\n' }, newNum: num },
      }
    }
    if (first === '-') {
      return {
        kind: 'row' as const,
        hunkId: null,
        row: { op: 'delete' as const, oldLine: { text: line.slice(1), eol: '\n' }, oldNum: num },
      }
    }
    num += 1
    return {
      kind: 'row' as const,
      hunkId: null,
      row: {
        op: 'equal' as const,
        oldLine: { text: line, eol: '\n' },
        newLine: { text: line, eol: '\n' },
        oldNum: num,
        newNum: num,
      },
    }
  })
}

/** 单栏 diff 查看器(unified 档的独立容器) */
export function InlineDiffViewer({
  oldContent,
  newContent,
  content,
  filename,
  contextLines = DEFAULT_CONTEXT_LINES,
  renderHunkHeader,
  onRowComment,
  commentLabel,
  activeLine,
}: InlineDiffViewerProps) {
  const entries = React.useMemo<UnifiedEntry[]>(() => {
    if (typeof oldContent === 'string' && typeof newContent === 'string') {
      return buildUnifiedEntries(oldContent, newContent, contextLines)
    }
    return entriesFromPatchText(content ?? '')
  }, [oldContent, newContent, content, contextLines])

  return (
    <div className="overflow-hidden rounded-md border border-border bg-background">
      {filename && (
        <div className="bg-muted/40 px-3 py-1.5">
          <span className="text-xs font-medium text-muted-foreground">{filename}</span>
        </div>
      )}
      <div className="overflow-x-auto font-mono text-xs">
        <UnifiedDiffBody
          entries={entries}
          renderHunkHeader={renderHunkHeader}
          onRowComment={onRowComment}
          commentLabel={commentLabel}
          activeLine={activeLine}
        />
      </div>
    </div>
  )
}

// ============================================================================
// 三方合并视图
// ============================================================================

function sideText(lines: DiffLine[]): string[] {
  return lines.map((l) => l.text)
}

const SOURCE_CHOICES: readonly MergeChoice[] = ['ours', 'theirs', 'both']
const CHOICE_LABEL_KEY: Record<MergeChoice, 'useOurs' | 'useTheirs' | 'useBoth'> = {
  ours: 'useOurs',
  theirs: 'useTheirs',
  both: 'useBoth',
}

interface ThreeWayLabels {
  base: string
  ours: string
  theirs: string
  bothSame: string
  useOurs: string
  useTheirs: string
  useBoth: string
  taken: string
  title: string
  empty: string
}

/** 冲突块:三段落差 + 逐来源选择(未选 ⇒ 不产出合并结果,不偏向任一侧) */
function ConflictPanel({
  block,
  index,
  total,
  choice,
  labels,
  onChoose,
}: {
  block: ThreeWayBlock
  index: number
  total: number
  choice?: MergeChoice
  labels: ThreeWayLabels
  onChoose: (blockId: number, choice: MergeChoice) => void
}): React.JSX.Element {
  const sections: Array<{ key: 'base' | 'ours' | 'theirs'; label: string; lines: string[]; cls: string }> = [
    { key: 'base', label: labels.base, lines: sideText(block.base), cls: 'bg-muted/30' },
    { key: 'ours', label: labels.ours, lines: sideText(block.ours), cls: ADD_BG },
    { key: 'theirs', label: labels.theirs, lines: sideText(block.theirs), cls: DEL_BG },
  ]
  return (
    <div
      className="rounded-md bg-muted/20 p-2"
      data-testid="diff-3way-conflict"
      data-block={block.id}
    >
      <div className="mb-1 flex items-center gap-2 text-[10px] text-muted-foreground">
        <span className="tabular-nums" data-testid={`diff-3way-index-${block.id}`}>
          {index + 1}/{total}
        </span>
        <span className="text-amber-600 dark:text-amber-400">
          <span>{labels.title}</span>
        </span>
      </div>
      <div className="flex flex-col gap-1">
        {sections.map((sec) => (
          <div key={sec.key} className={cn('rounded-sm px-2 py-1 text-[11px]', sec.cls)}>
            <div className="mb-0.5 text-[10px] text-muted-foreground">
              <span>{sec.label}</span>
            </div>
            {sec.lines.length === 0 ? (
              <div className="text-[11px] text-muted-foreground/60" data-testid={`diff-3way-${sec.key}-empty-${block.id}`}>
                <span>{labels.empty}</span>
              </div>
            ) : (
              sec.lines.map((line, i) => (
                <div
                  key={i}
                  className="whitespace-pre text-foreground"
                  data-testid={`diff-3way-${sec.key}-${block.id}-${i}`}
                >
                  {line}
                </div>
              ))
            )}
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        {SOURCE_CHOICES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChoose(block.id, c)}
            aria-pressed={choice === c}
            className={cn(
              'rounded-sm px-1.5 py-0.5 text-[10px] transition-colors',
              choice === c
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
            )}
            data-testid={`diff-3way-choose-${c}-${block.id}`}
          >
            <span>{labels[CHOICE_LABEL_KEY[c]]}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/** 自动可解块:标出取了哪一侧 */
function AutoBlock({
  block,
  labels,
}: {
  block: ThreeWayBlock
  labels: ThreeWayLabels
}): React.JSX.Element {
  const side =
    block.kind === 'ours' ? labels.ours : block.kind === 'theirs' ? labels.theirs : labels.bothSame
  return (
    <div className="px-2 py-0.5" data-testid={`diff-3way-auto-${block.id}`}>
      <div className="mb-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <span>{labels.taken}</span>
        <span className="text-foreground">{side}</span>
      </div>
      {sideText(block.ours).map((line, i) => (
        <div key={i} className={cn('whitespace-pre text-[11px]', ADD_BG)}>
          {line}
        </div>
      ))}
    </div>
  )
}

export interface ThreeWayMergeViewProps {
  base: string
  ours: string
  theirs: string
  /** 合并结果变化回调(供宿主接"写回 / 复制");有未决冲突时回传 null */
  onMergedChange?: (merged: string | null) => void
  /** 外部受控选择;缺省组件自持 */
  choices?: ReadonlyMap<number, MergeChoice>
  onChoicesChange?: (next: ReadonlyMap<number, MergeChoice>) => void
}

/**
 * 三方合并视图:base/ours/theirs 逐块落差 + 逐块选择来源。
 *
 * 出块全部走 `@/lib/diff-three-way`(其内部只调 `computeHunkDiff`)——
 * 本组件不含任何行级 diff 逻辑,也不自己算合并结果。
 */
export function ThreeWayMergeView({
  base,
  ours,
  theirs,
  onMergedChange,
  choices: controlledChoices,
  onChoicesChange,
}: ThreeWayMergeViewProps): React.JSX.Element {
  const t = useTranslations('ide')
  const clipboard = useClipboard()
  const { success: toastSuccess, error: toastError } = useToast()
  const [innerChoices, setInnerChoices] = React.useState<Map<number, MergeChoice>>(new Map())
  const choices = controlledChoices ?? innerChoices
  const setChoices = React.useCallback(
    (next: Map<number, MergeChoice>): void => {
      if (onChoicesChange) onChoicesChange(next)
      else setInnerChoices(next)
    },
    [onChoicesChange],
  )

  const merge = React.useMemo<ThreeWayMerge>(() => computeThreeWay(base, ours, theirs), [base, ours, theirs])
  const summary = React.useMemo(() => summarizeMerge(merge), [merge])
  const unresolvedCount = React.useMemo(
    () => mergeResolutions(merge, choices).unresolvedIds.length,
    [merge, choices],
  )
  const conflictTotal = merge.conflictIds.length

  const handleChoose = React.useCallback(
    (blockId: number, choice: MergeChoice): void => {
      const next = new Map(choices)
      next.set(blockId, choice)
      setChoices(next)
    },
    [choices, setChoices],
  )
  const handleChooseAll = React.useCallback(
    (choice: MergeChoice): void => {
      setChoices(chooseAllConflicts(merge, choices, choice))
    },
    [merge, choices, setChoices],
  )

  const labels: ThreeWayLabels = {
    base: t('diffViewer.baseLabel'),
    ours: t('diffViewer.oursLabel'),
    theirs: t('diffViewer.theirsLabel'),
    bothSame: t('diffViewer.bothSameLabel'),
    useOurs: t('diffViewer.useOurs'),
    useTheirs: t('diffViewer.useTheirs'),
    useBoth: t('diffViewer.useBoth'),
    taken: t('diffViewer.autoTaken'),
    title: t('diffViewer.conflictTitle'),
    empty: t('diffViewer.sideEmpty'),
  }

  const merged = unresolvedCount > 0 ? null : buildMergedContent(base, merge, choices)
  React.useEffect(() => {
    onMergedChange?.(merged)
  }, [merged, onMergedChange])
  const handleCopyMerged = React.useCallback(() => {
    if (merged === null) return
    void clipboard.copy(merged).then((ok) => {
      if (ok) toastSuccess(t('diffViewer.copyMergedToast'))
      else toastError(t('diffViewer.copyMergedFailed'))
    })
  }, [merged, clipboard, toastSuccess, toastError, t])

  return (
    <div className="flex flex-col gap-1 p-2 font-mono text-xs" data-testid="diff-3way-view">
      <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
        <span data-testid="diff-3way-conflict-count">
          {t('diffViewer.conflictCount', { count: conflictTotal })}
        </span>
        <span data-testid="diff-3way-ours-count">{t('diffViewer.oursOnlyCount', { count: summary.ours })}</span>
        <span data-testid="diff-3way-theirs-count">
          {t('diffViewer.theirsOnlyCount', { count: summary.theirs })}
        </span>
        {conflictTotal > 0 && (
          <>
            <button
              type="button"
              onClick={() => handleChooseAll('ours')}
              className="rounded-sm px-1.5 py-0.5 transition-colors hover:bg-muted/60 hover:text-foreground"
              data-testid="diff-3way-all-ours"
            >
              <span>{labels.useOurs}</span>
            </button>
            <button
              type="button"
              onClick={() => handleChooseAll('theirs')}
              className="rounded-sm px-1.5 py-0.5 transition-colors hover:bg-muted/60 hover:text-foreground"
              data-testid="diff-3way-all-theirs"
            >
              <span>{labels.useTheirs}</span>
            </button>
          </>
        )}
      </div>
      {merge.blocks.map((block) => {
        if (block.kind === 'stable') {
          return (
            <div key={block.id} data-testid={`diff-3way-stable-${block.id}`}>
              {sideText(block.base).map((line, i) => (
                <div key={i} className="whitespace-pre text-[11px] text-muted-foreground">
                  {line}
                </div>
              ))}
            </div>
          )
        }
        if (block.kind === 'conflict') {
          return (
            <ConflictPanel
              key={block.id}
              block={block}
              index={merge.conflictIds.indexOf(block.id)}
              total={conflictTotal}
              choice={choices.get(block.id)}
              labels={labels}
              onChoose={handleChoose}
            />
          )
        }
        return <AutoBlock key={block.id} block={block} labels={labels} />
      })}
      {merged === null ? (
        <div
          className="bg-amber-500/10 px-2 py-1 text-[10px] text-amber-700 dark:text-amber-400"
          data-testid="diff-3way-unresolved"
        >
          <span>{t('diffViewer.unresolvedConflicts', { count: unresolvedCount })}</span>
        </div>
      ) : (
        <div className="rounded-md bg-muted/20 p-2" data-testid="diff-3way-result">
          <div className="mb-0.5 flex items-center gap-2">
            <span className="flex-1 text-[10px] text-muted-foreground">
              {t('diffViewer.mergedResult')}
            </span>
            <button
              type="button"
              onClick={handleCopyMerged}
              className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
              data-testid="diff-3way-copy"
            >
              <Copy className="h-3 w-3" aria-hidden />
              <span>{t('diffViewer.copyMerged')}</span>
            </button>
          </div>
          <pre className="overflow-x-auto whitespace-pre text-[11px] text-foreground">{merged}</pre>
        </div>
      )}
    </div>
  )
}

export default InlineDiffViewer
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
