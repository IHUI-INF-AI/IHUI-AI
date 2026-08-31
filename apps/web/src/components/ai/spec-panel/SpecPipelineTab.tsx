// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// Spec 模式面板:全流程标签页(2026-07-23 超越创新)
import { Loader2, Workflow, History, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SpecPanelApi } from './useSpecPanel'
import { STAGE_STATUS_BADGE } from './constants'

export function SpecPipelineTab({ p }: { p: SpecPanelApi }) {
  const { t } = p
  const stages = p.pipelineStatus?.stages || p.pipelineResult?.stages || []
  const overallStatus =
    p.pipelineStatus?.overallStatus || p.pipelineResult?.overallStatus || 'pending'

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={p.handleRunPipeline}
          disabled={p.pipelineLoading || !p.result?.spec}
          className={cn(
            'flex shrink-0 whitespace-nowrap h-7 items-center gap-1 rounded-md px-3 text-xs font-medium transition-colors',
            'bg-primary text-primary-foreground hover:bg-primary/90',
            (p.pipelineLoading || !p.result?.spec) && 'cursor-not-allowed opacity-60',
          )}
        >
          {p.pipelineLoading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Workflow className="h-3 w-3" />
          )}
          <span>{p.pipelineLoading ? '执行中' : '启动全流程'}</span>
        </button>
        <label className="flex items-center gap-1 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={p.autoCommit}
            onChange={(e) => p.setAutoCommit(e.target.checked)}
            className="h-3 w-3"
          />
          <span>{t('autoCommit')}</span>
        </label>
        <input
          type="text"
          value={p.pipelineIdInput}
          onChange={(e) => p.setPipelineIdInput(e.target.value)}
          placeholder="pipeline ID(查询用)"
          className="h-7 rounded-md border border-border bg-background px-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-foreground/20 focus:outline-none"
        />
        <button
          type="button"
          onClick={p.handleRefreshPipelineStatus}
          className="flex shrink-0 whitespace-nowrap h-7 items-center gap-1 rounded-md border border-border bg-background px-2 text-xs text-foreground hover:bg-muted/60"
        >
          <History className="h-3 w-3" />
          <span>刷新状态</span>
        </button>
        {(p.pipelineResult?.backupDir || p.pipelineStatus?.backupDir) && (
          <button
            type="button"
            onClick={p.handleRollback}
            disabled={p.pipelineLoading}
            className="flex shrink-0 whitespace-nowrap h-7 items-center gap-1 rounded-md border border-border bg-background px-2 text-xs text-red-600 hover:bg-red-500/10 disabled:opacity-60"
          >
            <RotateCcw className="h-3 w-3" />
            <span>回滚</span>
          </button>
        )}
      </div>
      {/* 5 阶段进度条 */}
      {stages.length === 0 ? (
        <p className="text-xs text-muted-foreground p-2">
          点击「启动全流程」执行 apply_spec → apply_patch → typecheck → test → commit,
          失败时自动备份可回滚
        </p>
      ) : (
        <div className="space-y-1 rounded-md border border-border bg-background p-2">
          {stages.map((stage, idx) => (
            <div key={idx} className="rounded-md bg-muted/40 p-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-foreground">
                  {idx + 1}. {p.stageLabel[stage.name] || stage.name}
                </span>
                <span
                  className={cn(
                    'rounded px-1.5 py-0.5 text-[10px] font-bold',
                    STAGE_STATUS_BADGE[stage.status] || STAGE_STATUS_BADGE.pending,
                  )}
                >
                  {p.stageStatusLabel[stage.status] || stage.status}
                </span>
                {stage.finishedAt && stage.startedAt && (
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(stage.finishedAt).getTime() - new Date(stage.startedAt).getTime()}ms
                  </span>
                )}
              </div>
              {stage.log && (
                <pre className="mt-1 max-h-20 overflow-auto whitespace-pre-wrap break-all text-[10px] text-muted-foreground">
                  {stage.log.slice(0, 800)}
                </pre>
              )}
            </div>
          ))}
          <div className="flex items-center gap-2 pt-1">
            <span className="text-xs text-muted-foreground">整体:</span>
            <span
              className={cn(
                'rounded px-1.5 py-0.5 text-[10px] font-bold',
                STAGE_STATUS_BADGE[overallStatus as string] || STAGE_STATUS_BADGE.pending,
              )}
            >
              {p.stageStatusLabel[overallStatus as string] ||
                p.pipelineStatus?.overallStatus ||
                p.pipelineResult?.overallStatus}
            </span>
            {p.pipelineResult?.commitSha && (
              <span className="text-[10px] text-muted-foreground">
                commit: {p.pipelineResult.commitSha.slice(0, 8)}
              </span>
            )}
          </div>
          {/* 日志区域 */}
          {(p.pipelineStatus?.logs?.length || 0) > 0 && (
            <pre className="mt-2 max-h-32 overflow-auto rounded bg-muted/30 p-2 text-[10px] text-muted-foreground">
              {p.pipelineStatus?.logs?.join('\n')}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
