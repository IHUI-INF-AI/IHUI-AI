// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { Check, Loader2, Lock, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import type { DiffHunk } from '@/lib/hunk-diff'
import { computeHunkDiff } from '@/lib/hunk-diff'

/**
 * Hunk 级 diff 控制条(2026-09-18 立,W5:hunk 级接受/拒绝/部分应用)。
 *
 * 交互模型「先选择、再一次应用」:逐个 hunk 勾选/取消,点「应用所选」时以原始内容为基线
 * 重组出最终内容再落盘。不做逐 hunk 立即写盘 —— 逐次写盘会让后续 hunk 的基线失效。
 */

interface HunkHeaderProps {
  hunk: DiffHunk
  /** 全部 hunk 数,用于「改动 i/N」展示 */
  total: number
  accepted: boolean
  /** 是否已暂存进交付批次(锁定,不再参与 accepted 切换) */
  staged?: boolean
  /** 外部禁用(应用中等),与 staged 叠加 */
  disabled?: boolean
  onToggle: () => void
  onStage: () => void
  onUnstage: () => void
}

/** 单个 hunk 的小标题:勾选框 + 行号区间 + 增删统计 + 暂存按钮 + 状态 */
export function HunkHeader({
  hunk,
  total,
  accepted,
  staged = false,
  disabled,
  onToggle,
  onStage,
  onUnstage,
}: HunkHeaderProps) {
  const t = useTranslations('ai.pane')
  const rangeLabel =
    hunk.removed > 0
      ? `-${hunk.oldStartLine},${hunk.oldEndLine} +${hunk.newStartLine},${hunk.newEndLine}`
      : `+${hunk.newStartLine}`
  // staged 或外部禁用 → 勾选框锁定(与 Codex staged 语义一致:已暂存即锁定)
  const locked = Boolean(disabled) || staged
  return (
    <div
      className={cn(
        'flex items-center gap-2 px-2 py-1 text-[10px]',
        accepted ? 'bg-zinc-900 text-zinc-400' : 'bg-zinc-900/60 text-zinc-600',
        staged && 'opacity-60',
      )}
      data-testid={`diff-hunk-header-${hunk.id}`}
    >
      <input
        type="checkbox"
        checked={accepted}
        disabled={locked}
        onChange={onToggle}
        aria-label={accepted ? t('diffHunk.rejectBlock') : t('diffHunk.acceptBlock')}
        className={cn(
          'h-3 w-3 shrink-0 accent-green-600 disabled:cursor-not-allowed',
          staged && 'opacity-40 grayscale',
        )}
        data-testid={`diff-hunk-toggle-${hunk.id}`}
      />
      <span className="shrink-0 tabular-nums">
        {t('diffHunk.changeBlock', { index: hunk.id + 1, total })}
      </span>
      <span className="shrink-0 font-mono tabular-nums text-zinc-500">{rangeLabel}</span>
      <span className="shrink-0 tabular-nums text-green-500">+{hunk.added}</span>
      <span className="shrink-0 tabular-nums text-red-500">-{hunk.removed}</span>
      {/* D88:暂存 / 取消暂存 按钮(staged 后切换为还原) */}
      <button
        type="button"
        onClick={staged ? onUnstage : onStage}
        disabled={disabled}
        aria-label={staged ? t('diffHunk.unstageHunk') : t('diffHunk.stageHunk')}
        className={cn(
          'shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] transition-colors',
          staged
            ? 'text-amber-500 hover:bg-amber-500/15'
            : 'text-muted-foreground hover:bg-accent/40 hover:text-foreground',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
        data-testid={`diff-hunk-stage-${hunk.id}`}
      >
        {staged ? t('diffHunk.unstageHunk') : t('diffHunk.stageHunk')}
      </button>
      <span
        className={cn(
          'ml-auto inline-flex shrink-0 items-center gap-1',
          staged ? 'text-amber-500' : accepted ? 'text-green-500' : 'text-zinc-500',
        )}
      >
        {staged ? (
          <Lock className="h-3 w-3" />
        ) : accepted ? (
          <Check className="h-3 w-3" />
        ) : (
          <X className="h-3 w-3" />
        )}
        <span>
          {staged
            ? t('diffHunk.staged')
            : accepted
              ? t('diffHunk.accepted')
              : t('diffHunk.rejected')}
        </span>
      </span>
    </div>
  )
}

interface HunkToolbarProps {
  acceptedCount: number
  total: number
  disabled?: boolean
  applying?: boolean
  onApplySelected: () => void
  onClearSelection: () => void
  onReset: () => void
}

/** hunk 选择工具条:「应用所选」为部分应用的唯一落盘入口;全量接受/拒绝仍在卡片 footer */
export function HunkToolbar({
  acceptedCount,
  total,
  disabled,
  applying,
  onApplySelected,
  onClearSelection,
  onReset,
}: HunkToolbarProps) {
  const t = useTranslations('ai.pane')
  const canApply = acceptedCount > 0 && acceptedCount < total && !disabled && !applying
  const linkCls =
    'shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50'
  return (
    <div
      className="flex flex-wrap items-center gap-2 bg-muted/30 px-3 py-2"
      data-testid="diff-hunk-toolbar"
    >
      <button
        type="button"
        onClick={onApplySelected}
        disabled={!canApply}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[10px] font-medium',
          canApply
            ? 'bg-green-600 text-white hover:bg-green-700'
            : 'bg-muted text-muted-foreground/60',
          'disabled:cursor-not-allowed',
        )}
        data-testid="diff-hunk-apply-selected"
      >
        {applying ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
        <span>
          {applying
            ? t('diffHunk.applyingSelected')
            : t('diffHunk.applySelected', { count: acceptedCount })}
        </span>
      </button>
      <span className="shrink-0 text-[10px] text-muted-foreground/70">
        {t('diffHunk.selectedSummary', { accepted: acceptedCount, total })}
      </span>
      <button type="button" onClick={onClearSelection} disabled={disabled} className={linkCls}>
        {t('diffHunk.clearSelection')}
      </button>
      <button type="button" onClick={onReset} disabled={disabled} className={linkCls}>
        {t('diffHunk.resetSelection')}
      </button>
    </div>
  )
}

export default HunkToolbar

// ============================================================================
// D98(G-135):可执行的 git apply 迁移命令构建器(2026-09-23 立)。
//
// 目标:把"看到 diff"升级为"搬到别处仍可 apply" —— 调用方(IDE 代码变更 tab、
// InlineDiffCard 单文件卡片、交付审查面板)用同一套构建器产出命令串,复制后在
// 任意仓库粘贴执行即可迁移改动。命令内嵌 heredoc patch,本地可执行性由
// `git apply --check` 断言(见 d98-git-apply.test.ts + 交付验证脚本)。
//
// 实现说明:
//  - 行级对齐复用 `@/lib/hunk-diff` 的 computeHunkDiff(LCS,与 UI hunk 同源),
//    本模块只做"rows → unified patch 文本"投影,不另起一套 diff 算法。
//  - 新文件(old 为空)/删除文件(new 为空)走 /dev/null 头;内容相等返回 null
//    (调用方据此禁用导出按钮,不得复制空 patch)。
//  - 文件名含空格/引号时按 git C 风格加引号转义,保证 `git apply` 可解析。
// ============================================================================

/** 单文件 patch 输入 */
export interface PatchFileInput {
  filename: string
  oldContent: string
  newContent: string
}

/** patch 上下文行数(与 git diff 默认一致) */
export const PATCH_CONTEXT_LINES = 3

/** heredoc 分隔符基底(patch 内若出现则自动加后缀,见 buildGitApplyCommand) */
export const PATCH_HEREDOC_BASE = 'IHUI_DIFF_PATCH'

/** 按行拆分(保留空行语义;末尾换行不产生幽灵空行;`\r\n`/`\r` 归一) */
export function splitPatchLines(text: string): string[] {
  if (text === '') return []
  const parts = text.split(/\r\n|\r|\n/)
  if (parts.length > 0 && parts[parts.length - 1] === '') parts.pop()
  return parts
}

/** git C 风格路径引用(含空格/引号/反斜杠时加引号) */
export function quotePatchPath(path: string): string {
  if (/[ "\t\\]/.test(path) || path.includes('\n')) {
    return `"${path.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\t/g, '\\t')}"`
  }
  return path
}

/** hunk 区间格式化(单行省略 `,1`,与 git diff 输出一致) */
export function formatHunkRange(start: number, count: number): string {
  return count === 1 ? `${start}` : `${start},${count}`
}

/**
 * 单文件 unified patch(含 `diff --git` + `---`/`+++` + `@@` 段)。
 * 内容相等返回 null(调用方禁用导出);行尾缺失追加 `\ No newline` 标记。
 */
export function buildFilePatch(input: PatchFileInput): string | null {
  const { filename, oldContent, newContent } = input
  if (oldContent === newContent) return null
  const isNewFile = oldContent === ''
  const isDeletedFile = newContent === ''
  const aPath = isNewFile ? '/dev/null' : quotePatchPath(`a/${filename}`)
  const bPath = isDeletedFile ? '/dev/null' : quotePatchPath(`b/${filename}`)
  const header: string[] = [
    `diff --git ${quotePatchPath(`a/${filename}`)} ${quotePatchPath(`b/${filename}`)}`,
    ...(isNewFile ? ['new file mode 100644'] : []),
    ...(isDeletedFile ? ['deleted file mode 100644'] : []),
    `--- ${aPath}`,
    `+++ ${bPath}`,
  ]

  const diff = computeHunkDiff(oldContent, newContent)
  const rows = diff.rows
  const oldEndsNewline = oldContent.endsWith('\n')
  const newEndsNewline = newContent.endsWith('\n')
  const oldTotal = rows.reduce((m, r) => Math.max(m, r.oldNum ?? 0), 0)
  const newTotal = rows.reduce((m, r) => Math.max(m, r.newNum ?? 0), 0)

  // 变更行下标;仅行尾换行差异时 rows 全 equal,此时退化为"末行 -/+ 对"
  const changeIdx: number[] = []
  for (let i = 0; i < rows.length; i++) {
    if (rows[i]?.op !== 'equal') changeIdx.push(i)
  }
  const trailingNewlineOnly =
    changeIdx.length === 0 && oldEndsNewline !== newEndsNewline && rows.length > 0

  interface Block {
    start: number
    end: number
  }
  const blocks: Block[] = []
  if (trailingNewlineOnly) {
    // 仅末行参与:末行 + 前 PATCH_CONTEXT_LINES 行上下文
    const last = rows.length - 1
    blocks.push({ start: Math.max(0, last - PATCH_CONTEXT_LINES), end: rows.length })
  } else {
    const covered = new Array<boolean>(rows.length).fill(false)
    for (const ci of changeIdx) {
      const s = Math.max(0, ci - PATCH_CONTEXT_LINES)
      const e = Math.min(rows.length, ci + PATCH_CONTEXT_LINES + 1)
      for (let i = s; i < e; i++) covered[i] = true
    }
    let s = -1
    for (let i = 0; i <= rows.length; i++) {
      if (i < rows.length && covered[i]) {
        if (s === -1) s = i
      } else if (s !== -1) {
        blocks.push({ start: s, end: i })
        s = -1
      }
    }
  }

  const body: string[] = []
  for (const b of blocks) {
    let oldStart = -1
    let newStart = -1
    let oldCount = 0
    let newCount = 0
    for (let i = b.start; i < b.end; i++) {
      const r = rows[i]
      if (!r) continue
      if (r.oldNum !== undefined) {
        if (oldStart === -1) oldStart = r.oldNum
        oldCount++
      }
      if (r.newNum !== undefined) {
        if (newStart === -1) newStart = r.newNum
        newCount++
      }
    }
    // 纯插入块在文件头:起点为 0(对应 `-0,0` 形态)
    if (oldStart === -1) {
      let prev = 0
      for (let i = b.start - 1; i >= 0; i--) {
        const pn = rows[i]?.oldNum
        if (pn !== undefined) {
          prev = pn
          break
        }
      }
      oldStart = prev
    }
    if (newStart === -1) {
      let prev = 0
      for (let i = b.start - 1; i >= 0; i--) {
        const pn = rows[i]?.newNum
        if (pn !== undefined) {
          prev = pn
          break
        }
      }
      newStart = prev
    }
    // 仅行尾换行差异:把块内末行改写为 -/+ 对(其余为上下文)
    const rewriteLast = trailingNewlineOnly ? b.end - 1 : -1
    body.push(
      `@@ -${formatHunkRange(oldStart, oldCount)} +${formatHunkRange(newStart, newCount)} @@`,
    )
    for (let i = b.start; i < b.end; i++) {
      const r = rows[i]
      if (!r) continue
      if (i === rewriteLast) {
        const text = r.oldLine?.text ?? r.newLine?.text ?? ''
        body.push(`-${text}`)
        if (!oldEndsNewline && (r.oldNum ?? 0) === oldTotal)
          body.push('\\ No newline at end of file')
        body.push(`+${text}`)
        if (!newEndsNewline && (r.newNum ?? 0) === newTotal)
          body.push('\\ No newline at end of file')
        continue
      }
      if (r.op === 'equal') {
        const text = r.oldLine?.text ?? r.newLine?.text ?? ''
        body.push(` ${text}`)
        if (!oldEndsNewline && (r.oldNum ?? 0) === oldTotal && oldTotal > 0)
          body.push('\\ No newline at end of file')
        else if (!newEndsNewline && (r.newNum ?? 0) === newTotal && newTotal > 0 && oldTotal === 0)
          body.push('\\ No newline at end of file')
      } else if (r.op === 'delete') {
        body.push(`-${r.oldLine?.text ?? ''}`)
        if (!oldEndsNewline && (r.oldNum ?? 0) === oldTotal)
          body.push('\\ No newline at end of file')
      } else {
        body.push(`+${r.newLine?.text ?? ''}`)
        if (!newEndsNewline && (r.newNum ?? 0) === newTotal)
          body.push('\\ No newline at end of file')
      }
    }
  }

  return `${header.join('\n')}\n${body.join('\n')}\n`
}

/** 多文件 unified patch(跳过无改动文件;全部无改动返回 '') */
export function buildUnifiedPatch(files: PatchFileInput[]): string {
  const parts: string[] = []
  for (const f of files) {
    const p = buildFilePatch(f)
    if (p !== null) parts.push(p)
  }
  return parts.join('')
}

/**
 * 由 patch 拼出可直接粘贴执行的 shell 命令(heredoc 内嵌 patch,无外部依赖)。
 * 分隔符若与 patch 内容冲突则自动加后缀(确定性,可用 extractPatchFromCommand 回取)。
 */
export function buildGitApplyCommand(patch: string): string {
  let delim = PATCH_HEREDOC_BASE
  while (patch.includes(delim)) delim += '_'
  const normalized = patch.endsWith('\n') ? patch : `${patch}\n`
  return `git apply --check <<'${delim}' && git apply <<'${delim}'\n${normalized}${delim}`
}

/** 从 buildGitApplyCommand 产物中回取内嵌 patch(供测试与 `git apply --check` 验证) */
export function extractPatchFromCommand(command: string): string | null {
  const m = command.match(/<<'([^']+)'/)
  if (!m || !m[1]) return null
  const delim = m[1]
  const idx = command.indexOf('\n')
  if (idx === -1) return null
  const rest = command.slice(idx + 1)
  const end = rest.lastIndexOf(delim)
  if (end === -1) return null
  return rest.slice(0, end)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
