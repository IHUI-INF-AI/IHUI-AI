'use client'

import type { SpecDiff, SpecDiffSection } from '@ihui/shared/spec/index'

interface SpecDiffViewProps {
  diff: SpecDiff | null
  loading?: boolean
}

function changeStyle(
  ct: SpecDiffSection['changeType'],
): { label: string; cls: string } {
  switch (ct) {
    case 'added':
      return {
        label: '新增',
        cls: 'bg-emerald-50 text-emerald-700 border-l-2 border-emerald-500',
      }
    case 'removed':
      return {
        label: '删除',
        cls: 'bg-rose-50 text-rose-700 border-l-2 border-rose-500',
      }
    case 'modified':
      return {
        label: '修改',
        cls: 'bg-amber-50 text-amber-700 border-l-2 border-amber-500',
      }
    case 'unchanged':
      return { label: '不变', cls: 'bg-slate-50 text-slate-500' }
  }
}

/** Spec Diff 可视化组件:按 sections 显示变更类型 */
export function SpecDiffView({ diff, loading }: SpecDiffViewProps) {
  if (loading) {
    return <div className="text-sm text-muted-foreground">正在生成 diff…</div>
  }
  if (!diff) {
    return (
      <div className="text-sm text-muted-foreground">
        点击「对比变更」查看与上一版本的差异
      </div>
    )
  }

  const { summary } = diff

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-emerald-700">
          新增 {summary.added}
        </span>
        <span className="rounded-md bg-rose-100 px-2 py-0.5 text-rose-700">
          删除 {summary.removed}
        </span>
        <span className="rounded-md bg-amber-100 px-2 py-0.5 text-amber-700">
          修改 {summary.modified}
        </span>
        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-500">
          不变 {summary.unchanged}
        </span>
      </div>

      {diff.sections.map((section, i) => {
        const style = changeStyle(section.changeType)
        return (
          <div key={i} className={`rounded-md p-3 ${style.cls}`}>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-sm font-medium">{section.title}</span>
              <span className="text-xs opacity-80">{style.label}</span>
            </div>
            {section.before !== undefined && (
              <pre className="mb-1 overflow-x-auto rounded bg-background/50 p-2 text-xs whitespace-pre-wrap break-words">
                <code>- {section.before}</code>
              </pre>
            )}
            {section.after !== undefined && (
              <pre className="overflow-x-auto rounded bg-background/50 p-2 text-xs whitespace-pre-wrap break-words">
                <code>+ {section.after}</code>
              </pre>
            )}
          </div>
        )
      })}
    </div>
  )
}
