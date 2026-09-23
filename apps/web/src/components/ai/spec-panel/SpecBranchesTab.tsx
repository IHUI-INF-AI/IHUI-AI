// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// Spec 模式面板:版本树标签页(2026-07-23 超越创新)
import { GitBranch, GitMerge, GitCompare, Square, Loader2, History } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/feedback'
import type { SpecPanelApi } from './useSpecPanel'
import { BRANCH_STATUS_BADGE, BRANCH_STATUS_LABEL } from './constants'
import { DiffView } from './components'

export function SpecBranchesTab({ p }: { p: SpecPanelApi }) {
  const { t } = p
  return (
    <div className="space-y-2">
      {/* 创建分支表单 */}
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-background p-2">
        <GitBranch className="h-3 w-3 text-muted-foreground" />
        <input
          type="text"
          value={p.newBranchName}
          onChange={(e) => p.setNewBranchName(e.target.value)}
          placeholder={t('branchNamePlaceholder')}
          className="h-7 flex-1 rounded-md border border-border bg-background px-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-foreground/20 focus:outline-none"
        />
        <Tooltip content={t('baselineVersion')}>
          <select
            value={p.branchBaseVersion}
            onChange={(e) => p.setBranchBaseVersion(e.target.value)}
            className="h-7 rounded-md border border-border bg-background px-1 text-xs text-foreground focus:outline-none"
          >
            <option value="latest">最新</option>
            {p.history.map((h) => (
              <option key={h.timestamp} value={h.timestamp}>
                {h.timestamp}
              </option>
            ))}
          </select>
        </Tooltip>
        <button
          type="button"
          onClick={p.handleCreateBranch}
          disabled={p.branchLoading || !p.newBranchName.trim()}
          className={cn(
            'flex shrink-0 whitespace-nowrap h-7 items-center gap-1 rounded-md px-3 text-xs font-medium transition-colors',
            'bg-primary text-primary-foreground hover:bg-primary/90',
            (p.branchLoading || !p.newBranchName.trim()) && 'cursor-not-allowed opacity-60',
          )}
        >
          {p.branchLoading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <GitBranch className="h-3 w-3" />
          )}
          <span>创建分支</span>
        </button>
        <button
          type="button"
          onClick={p.refreshBranches}
          className="flex shrink-0 whitespace-nowrap h-7 items-center gap-1 rounded-md border border-border bg-background px-2 text-xs text-foreground hover:bg-muted/60"
        >
          <History className="h-3 w-3" />
          <span>刷新</span>
        </button>
      </div>

      {/* SVG 分支图 */}
      {p.branchesResult?.branches.length ? (
        <div className="rounded-md border border-border bg-background p-2">
          <svg width="100%" height="80" viewBox="0 0 600 80" className="block">
            {/* main 线 */}
            <line
              x1="20"
              y1="40"
              x2="580"
              y2="40"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-muted-foreground"
            />
            <circle cx="20" cy="40" r="4" className="fill-foreground" />
            <text x="20" y="60" textAnchor="middle" className="fill-muted-foreground text-[10px]">
              main
            </text>
            {p.branchesResult.branches.map((b, idx) => {
              const x = 80 + idx * 80
              const isActive = b.status === 'active'
              return (
                <g key={`${b.specId}-${b.name}`}>
                  <path
                    d={`M 20 40 C ${x - 30} 40, ${x - 30} 15, ${x} 15`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className={isActive ? 'text-green-500' : 'text-muted-foreground'}
                  />
                  <circle
                    cx={x}
                    cy={15}
                    r="4"
                    className={
                      isActive
                        ? 'fill-green-500'
                        : b.status === 'merged'
                          ? 'fill-blue-500'
                          : 'fill-muted-foreground'
                    }
                  />
                  <text
                    x={x}
                    y="8"
                    textAnchor="middle"
                    className="fill-muted-foreground text-[9px]"
                  >
                    {b.name.slice(0, 8)}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>
      ) : null}

      {/* 分支列表 */}
      {p.branchesResult?.branches.length ? (
        <div className="max-h-[35vh] space-y-1 overflow-auto rounded-md border border-border bg-background p-2">
          {p.branchesResult.branches.map((b, idx) => (
            <div key={`${b.specId}-${b.name}-${idx}`} className="rounded-md bg-muted/40 p-2">
              <div className="flex flex-wrap items-center gap-2">
                <GitBranch className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs font-medium text-foreground">{b.name}</span>
                <span
                  className={cn(
                    'rounded px-1.5 py-0.5 text-[10px] font-bold',
                    BRANCH_STATUS_BADGE[b.status] || BRANCH_STATUS_BADGE.active,
                  )}
                >
                  {BRANCH_STATUS_LABEL[b.status] || b.status}
                </span>
                <Tooltip content={b.specId}>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    spec: {b.specId.slice(0, 8)}
                  </span>
                </Tooltip>
                <span className="text-[10px] text-muted-foreground">
                  base: {b.baseVersion === 'latest' ? '最新' : b.baseVersion.slice(0, 8)}
                </span>
                <div className="ml-auto flex items-center gap-1">
                  <Tooltip content={t('mergeToMain')}>
                    <button
                      type="button"
                      onClick={() => void p.handleMergeBranch(b.name)}
                      disabled={p.branchLoading || b.status !== 'active'}
                      className="flex shrink-0 whitespace-nowrap h-6 items-center gap-1 rounded-md border border-border bg-background px-2 text-[10px] text-foreground hover:bg-muted/60 disabled:opacity-60"
                    >
                      <GitMerge className="h-3 w-3" />
                      <span>合并</span>
                    </button>
                  </Tooltip>
                  <Tooltip content={t('compareMain')}>
                    <button
                      type="button"
                      onClick={() => void p.handleDiffBranch(b.name)}
                      disabled={p.branchLoading}
                      className="flex shrink-0 whitespace-nowrap h-6 items-center gap-1 rounded-md border border-border bg-background px-2 text-[10px] text-foreground hover:bg-muted/60 disabled:opacity-60"
                    >
                      <GitCompare className="h-3 w-3" />
                      <span>对比</span>
                    </button>
                  </Tooltip>
                  <Tooltip content={t('abandonBranch')}>
                    <button
                      type="button"
                      onClick={() => void p.handleAbandonBranch(b.name)}
                      disabled={p.branchLoading || b.status !== 'active'}
                      className="flex shrink-0 whitespace-nowrap h-6 items-center gap-1 rounded-md border border-border bg-background px-2 text-[10px] text-red-600 hover:bg-red-500/10 disabled:opacity-60"
                    >
                      <Square className="h-3 w-3" />
                      <span>废弃</span>
                    </button>
                  </Tooltip>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground p-2">
          点击「创建分支」从当前 spec 派生新分支,支持 3-way merge + LLM 冲突解决
        </p>
      )}

      {/* 合并冲突提示 */}
      {p.mergeConflicts && p.mergeConflicts.length > 0 && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-2">
          <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
            合并冲突({p.mergeConflicts.length} 处,已用 LLM 自动解决)
          </p>
          <ul className="mt-1 space-y-0.5">
            {p.mergeConflicts.slice(0, 10).map((c, i) => (
              <li key={i} className="text-[10px] text-amber-700 dark:text-amber-400">
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 分支 diff */}
      {p.branchDiffResult?.diff && (
        <div className="rounded-md border border-border bg-background p-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-foreground">
              {p.branchDiffTarget} vs main
            </span>
            <span className="text-[10px] text-green-600">+{p.branchDiffResult.addedLines}</span>
            <span className="text-[10px] text-red-600">-{p.branchDiffResult.removedLines}</span>
          </div>
          <DiffView
            diff={p.branchDiffResult.diff}
            className="mt-1 max-h-40 overflow-auto text-[10px] leading-4"
            simple
          />
        </div>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
