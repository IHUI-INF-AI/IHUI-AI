// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// Spec 模式面板:展示型子组件(从 spec-panel.tsx 抽取的头部/导航/工具区)
// 仅负责渲染,状态与事件来自 useSpecPanel 返回的 SpecPanelApi。

import * as React from 'react'
import { History, Download, GitCompare, Loader2, Eye, EyeOff, Play, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/feedback'
import { SCOPE_OPTIONS, TAB_OPTIONS } from './constants'
import type { SpecPanelApi } from './useSpecPanel'

export function SpecScopeSelector({ p }: { p: SpecPanelApi }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">范围</span>
      <div
        role="group"
        aria-label="spec 生成范围"
        className="flex items-center border border-border rounded-md overflow-hidden"
      >
        {SCOPE_OPTIONS.map((opt, idx) => {
          const isActive = opt.type === p.scopeType
          const Icon = opt.icon
          return (
            <Tooltip key={opt.type} content={opt.label}>
              <button
                type="button"
                onClick={() => p.setScopeType(opt.type)}
                aria-pressed={isActive}
                className={cn(
                  'flex h-7 items-center gap-1 px-2 text-xs font-medium transition-colors',
                  idx < SCOPE_OPTIONS.length - 1 && 'border-border',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80',
                )}
              >
                <Icon className="h-3 w-3" />
                <span>{opt.label}</span>
              </button>
            </Tooltip>
          )
        })}
      </div>
      {p.showPathInput && (
        <input
          type="text"
          value={p.scopePath}
          onChange={(e) => p.setScopePath(e.target.value)}
          placeholder={
            p.scopeType === 'file'
              ? '相对路径,如 apps/api/src/server.ts'
              : '相对路径,如 apps/api/src'
          }
          className="h-7 flex-1 rounded-md border border-border bg-background px-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-foreground/20 focus:outline-none"
        />
      )}
      <button
        type="button"
        onClick={p.handleGenerate}
        disabled={p.loading}
        className={cn(
          'flex shrink-0 whitespace-nowrap h-7 items-center gap-1 rounded-md px-3 text-xs font-medium transition-colors',
          'bg-primary text-primary-foreground hover:bg-primary/90',
          p.loading && 'cursor-not-allowed opacity-60',
        )}
      >
        {p.loading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Sparkles className="h-3 w-3" />
        )}
        <span>{p.loading ? '生成中' : '生成'}</span>
      </button>
    </div>
  )
}

export function SpecResultHeader({ p }: { p: SpecPanelApi }) {
  const { t } = p
  return (
    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
      <span>文件 {p.result!.stats.files}</span>
      <span>符号 {p.result!.stats.symbols}</span>
      <span>API {p.result!.stats.endpoints}</span>
      <span>模型 {p.result!.stats.schemas}</span>
      <span>耗时 {p.result!.durationMs}ms</span>
      {/* 历史版本下拉 */}
      {p.history.length > 0 && (
        <div className="flex items-center gap-1">
          <History className="h-3 w-3" />
          <Tooltip content={t('historyVersion')}>
            <select
              value={p.selectedVersion}
              onChange={(e) => void p.handleLoadVersion(e.target.value)}
              className="h-6 rounded-md border border-border bg-background px-1 text-xs text-foreground focus:outline-none"
            >
              <option value="latest">最新</option>
              {p.history.map((h) => (
                <option key={h.timestamp} value={h.timestamp}>
                  {h.timestamp}
                </option>
              ))}
            </select>
          </Tooltip>
        </div>
      )}
      {/* 对比当前 */}
      <Tooltip content={t('regenCompare')}>
        <button
          type="button"
          onClick={p.handleDiff}
          disabled={p.diffLoading}
          className={cn(
            'flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground hover:bg-muted/60',
            p.diffLoading && 'cursor-not-allowed opacity-60',
          )}
        >
          {p.diffLoading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <GitCompare className="h-3 w-3" />
          )}
          <span>对比当前</span>
        </button>
      </Tooltip>
      {/* 导出 */}
      <button
        type="button"
        onClick={p.handleDownload}
        className="ml-auto flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground hover:bg-muted/60"
      >
        <Download className="h-3 w-3" />
        <span>导出</span>
      </button>
    </div>
  )
}

export function SpecTabNav({ p }: { p: SpecPanelApi }) {
  return (
    <div className="mt-2 flex items-center gap-1 pb-1">
      {TAB_OPTIONS.map((tab) => {
        const isActive = p.tabMode === tab.mode
        const Icon = tab.icon
        return (
          <button
            key={tab.mode}
            type="button"
            onClick={() => p.setTabMode(tab.mode)}
            className={cn(
              'flex h-6 items-center gap-1 rounded-md px-2 text-xs font-medium transition-colors',
              isActive
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
            )}
          >
            <Icon className="h-3 w-3" />
            <span>{tab.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export function DiffView({
  diff,
  className,
  simple = false,
}: {
  diff: string
  className?: string
  simple?: boolean
}) {
  return (
    <pre className={cn('font-mono', className)}>
      {diff.split('\n').map((line, idx) => {
        const isAdd = line.startsWith('+') && !line.startsWith('+++')
        const isDel = line.startsWith('-') && !line.startsWith('---')
        const isHunk = line.startsWith('@@')
        const isHeader = line.startsWith('---') || line.startsWith('+++')
        return (
          <div
            key={idx}
            className={cn(
              'px-2 whitespace-pre-wrap break-all',
              isAdd && 'bg-green-500/10 text-green-700 dark:text-green-400',
              isDel && 'bg-red-500/10 text-red-700 dark:text-red-400',
              !simple && isHunk && 'text-cyan-600 dark:text-cyan-400',
              !simple && isHeader && 'text-muted-foreground',
              !isAdd && !isDel && !isHunk && !isHeader && 'text-muted-foreground',
              simple && !isAdd && !isDel && 'text-muted-foreground',
            )}
          >
            {line || ' '}
          </div>
        )
      })}
    </pre>
  )
}

export function SpecWatchControl({ p }: { p: SpecPanelApi }) {
  const { t } = p
  return (
    <div className="mt-3 flex items-center gap-2 pt-2">
      <Eye className="h-3 w-3 text-muted-foreground" />
      <span className="text-xs text-muted-foreground">文件监听</span>
      <button
        type="button"
        onClick={p.handleStartWatch}
        disabled={p.watchLoading || !p.activeWorkspacePath}
        className={cn(
          'flex shrink-0 whitespace-nowrap h-6 items-center gap-1 rounded-md border border-border bg-background px-2 text-xs text-foreground hover:bg-muted/60',
          (p.watchLoading || !p.activeWorkspacePath) && 'cursor-not-allowed opacity-60',
        )}
      >
        <Play className="h-3 w-3" />
        <span>启动</span>
      </button>
      <button
        type="button"
        onClick={p.refreshWatchStatus}
        disabled={p.watchLoading}
        className="flex shrink-0 whitespace-nowrap h-6 items-center gap-1 rounded-md border border-border bg-background px-2 text-xs text-foreground hover:bg-muted/60 disabled:opacity-60"
      >
        <EyeOff className="h-3 w-3" />
        <span>刷新</span>
      </button>
      {p.watchStatus?.watchers.length ? (
        <div className="flex flex-wrap items-center gap-1">
          {p.watchStatus.watchers.map((w) => (
            <Tooltip key={w.watchId} content={`监听路径: ${w.watchPath}\n启动时间: ${w.startedAt}`}>
              <span className="flex items-center gap-1 rounded-md bg-muted/60 px-2 py-0.5 text-[10px] text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                <span>{w.watchId.slice(0, 8)}</span>
                <Tooltip content={t('stopListening')}>
                  <button
                    type="button"
                    onClick={() => void p.handleStopWatch(w.watchId)}
                    className="text-red-500 hover:text-red-600"
                  >
                    ×
                  </button>
                </Tooltip>
              </span>
            </Tooltip>
          ))}
        </div>
      ) : (
        <span className="text-[10px] text-muted-foreground">无活跃监听</span>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
