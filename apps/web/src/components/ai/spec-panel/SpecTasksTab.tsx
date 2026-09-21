// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// Spec 模式面板:任务拆分标签页
import { Loader2, ListTree, Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SpecPanelApi } from './useSpecPanel'
import { PRIORITY_BADGE } from './constants'

export function SpecTasksTab({ p }: { p: SpecPanelApi }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={p.handleSplitTasks}
          disabled={p.tasksLoading}
          className={cn(
            'flex shrink-0 whitespace-nowrap h-7 items-center gap-1 rounded-md px-3 text-xs font-medium transition-colors',
            'bg-primary text-primary-foreground hover:bg-primary/90',
            p.tasksLoading && 'cursor-not-allowed opacity-60',
          )}
        >
          {p.tasksLoading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <ListTree className="h-3 w-3" />
          )}
          <span>{p.tasksLoading ? '拆分中' : '拆分任务'}</span>
        </button>
        {p.tasksResult?.tasks.length ? (
          <button
            type="button"
            onClick={p.handleExportTasks}
            className="flex shrink-0 whitespace-nowrap h-7 items-center gap-1 rounded-md border border-border bg-background px-3 text-xs text-foreground hover:bg-muted/60"
          >
            <Download className="h-3 w-3" />
            <span>导出到 PROJECT_PLAN</span>
          </button>
        ) : null}
        {p.tasksResult?.fallback && (
          <span className="text-xs text-amber-600 dark:text-amber-400">降级模式</span>
        )}
      </div>
      {p.tasksResult?.tasks.length ? (
        <div className="max-h-[50vh] space-y-1 overflow-auto rounded-md border border-border bg-background p-2">
          {p.tasksResult.tasks.map((task, idx) => (
            <div key={idx} className="rounded-md bg-muted/40 p-2">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'rounded px-1.5 py-0.5 text-[10px] font-bold',
                    PRIORITY_BADGE[task.priority] || PRIORITY_BADGE.P2,
                  )}
                >
                  {task.priority}
                </span>
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {task.estimated_complexity}
                </span>
                <span className="text-xs font-medium text-foreground">{task.title}</span>
              </div>
              {task.description && (
                <p className="mt-1 text-xs text-muted-foreground">{task.description}</p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground p-2">
          点击「拆分任务」从 spec 章节自动生成任务列表
        </p>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
