'use client'

import * as React from 'react'
import {
  Bot,
  ChevronRight,
  Loader2,
  Check,
  AlertCircle,
  Clock,
  Wrench,
  Hash,
  AtSign,
  User,
  FileText,
  Check as CheckIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Checklist, type ChecklistItemData } from './checklist'
import {
  SUBAGENT_COLOR_CLASS,
  type Subagent,
  type SubagentStatus,
} from '@/hooks/use-agent-progress'
import { formatDuration } from './foldable-section'

const STATUS_ICON: Record<SubagentStatus, React.ComponentType<{ className?: string }>> = {
  spawned: Clock,
  running: Loader2,
  done: Check,
  failed: AlertCircle,
  dead: AlertCircle,
}

const STATUS_CLS: Record<SubagentStatus, string> = {
  spawned: 'text-amber-400',
  running: 'text-primary',
  done: 'text-emerald-500',
  failed: 'text-destructive',
  dead: 'text-muted-foreground/50',
}

// ─── Phase 20 P1-4:右键菜单(复制 threadId / handle / nickname / 详情) ──

/** 复制结果状态(用于菜单内"已复制"反馈) */
type CopyFlashKey = 'threadId' | 'handle' | 'nickname' | 'details' | null

interface SubAgentContextMenuState {
  visible: boolean
  x: number
  y: number
}

/** 导出供单测使用的纯函数:把 Subagent 序列化为可粘贴的详情文本 */
export function buildSubagentDetailsText(sub: Subagent): string {
  const lines: string[] = [
    `${sub.nickname} (${sub.handle})`,
    `id: ${sub.id}`,
    `threadId: ${sub.threadId}`,
    `status: ${sub.status}`,
  ]
  if (sub.role) lines.push(`role: ${sub.role}`)
  if (sub.currentTask) lines.push(`currentTask: ${sub.currentTask}`)
  if (sub.durationMs !== undefined) lines.push(`durationMs: ${sub.durationMs}`)
  if (sub.tokenUsage !== undefined) lines.push(`tokenUsage: ${sub.tokenUsage}`)
  if (sub.toolCalls !== undefined) lines.push(`toolCalls: ${sub.toolCalls}`)
  if (sub.failureReason) lines.push(`failureReason: ${sub.failureReason}`)
  return lines.join('\n')
}

/** 工具:尝试写入剪贴板(权限失败/无 API 时返回 false) */
async function tryCopyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator === 'undefined') return false
  if (!navigator.clipboard) return false
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

interface SubAgentTaskTreeProps {
  subagent: Subagent
  defaultCollapsed?: boolean
  className?: string
  'data-testid'?: string
  /** Phase 20 P1-4:是否禁用右键菜单(默认 true)— 只读场景可关闭 */
  enableContextMenu?: boolean
}

export const SubAgentTaskTree = React.memo(function SubAgentTaskTree({
  subagent,
  defaultCollapsed = false,
  className,
  'data-testid': testId,
  enableContextMenu = true,
}: SubAgentTaskTreeProps) {
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed)
  const [menu, setMenu] = React.useState<SubAgentContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
  })
  const [menuPos, setMenuPos] = React.useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [copied, setCopied] = React.useState<CopyFlashKey>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const menuRef = React.useRef<HTMLDivElement>(null)
  const flashTimerRef = React.useRef<number | null>(null)

  const StatusIcon = STATUS_ICON[subagent.status] ?? Clock
  const colorCls = SUBAGENT_COLOR_CLASS[subagent.color]

  const tools = subagent.tools ?? []
  const checklistItems: ChecklistItemData[] = tools.map((tool) => ({
    id: tool.id,
    label: tool.toolName,
    status:
      tool.status === 'success' ? 'completed' : tool.status === 'error' ? 'failed' : 'in_progress',
    meta: tool.durationMs !== undefined ? formatDuration(tool.durationMs) : undefined,
    description: tool.error ? `失败: ${tool.error}` : undefined,
  }))

  // 关闭菜单(并清除 flash 定时器)
  const closeMenu = React.useCallback(() => {
    setMenu({ visible: false, x: 0, y: 0 })
  }, [])

  // 复制并显示反馈
  const flashCopy = React.useCallback((key: Exclude<CopyFlashKey, null>) => {
    setCopied(key)
    if (flashTimerRef.current !== null) {
      window.clearTimeout(flashTimerRef.current)
    }
    flashTimerRef.current = window.setTimeout(() => {
      setCopied(null)
      flashTimerRef.current = null
    }, 1500)
  }, [])

  React.useEffect(() => {
    return () => {
      if (flashTimerRef.current !== null) {
        window.clearTimeout(flashTimerRef.current)
      }
    }
  }, [])

  // 右键打开菜单
  const onContextMenu = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!enableContextMenu) return
      e.preventDefault()
      e.stopPropagation()
      setMenu({ visible: true, x: e.clientX, y: e.clientY })
    },
    [enableContextMenu],
  )

  // 菜单内点击(事件代理)— 复制 4 种内容之一
  const onMenuClick = React.useCallback(
    async (action: Exclude<CopyFlashKey, null>) => {
      let text = ''
      if (action === 'threadId') text = subagent.threadId
      else if (action === 'handle') text = subagent.handle
      else if (action === 'nickname') text = subagent.nickname
      else text = buildSubagentDetailsText(subagent)
      const ok = await tryCopyToClipboard(text)
      if (ok) {
        flashCopy(action)
        // 复制成功后自动关闭菜单,避免误触多次
        closeMenu()
      }
    },
    [subagent, flashCopy, closeMenu],
  )

  // 菜单键盘事件:Enter / Space 触发当前聚焦项
  const onMenuKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        closeMenu()
      }
    },
    [closeMenu],
  )

  // 边界检测:菜单渲染后调整到视口内
  React.useEffect(() => {
    if (!menu.visible) return
    const el = menuRef.current
    if (!el) {
      setMenuPos({ x: menu.x, y: menu.y })
      return
    }
    const rect = el.getBoundingClientRect()
    let x = menu.x
    let y = menu.y
    if (typeof window !== 'undefined') {
      const vw = window.innerWidth
      const vh = window.innerHeight
      if (x + rect.width > vw) x = Math.max(8, vw - rect.width - 8)
      if (y + rect.height > vh) y = Math.max(8, vh - rect.height - 8)
    }
    setMenuPos({ x, y })
  }, [menu])

  // 点击外部 / 右键其他位置 关闭菜单
  React.useEffect(() => {
    if (!menu.visible) return
    const onMouseDown = (e: MouseEvent) => {
      const el = menuRef.current
      if (el && !el.contains(e.target as Node)) closeMenu()
    }
    const onContextMenu = (e: MouseEvent) => {
      const el = containerRef.current
      if (el && !el.contains(e.target as Node)) closeMenu()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu()
    }
    const id = window.setTimeout(() => {
      document.addEventListener('mousedown', onMouseDown)
      document.addEventListener('contextmenu', onContextMenu)
    }, 0)
    document.addEventListener('keydown', onKey)
    return () => {
      window.clearTimeout(id)
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('contextmenu', onContextMenu)
      document.removeEventListener('keydown', onKey)
    }
  }, [menu.visible, closeMenu])

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative space-y-0.5 rounded-md border border-border/40 bg-card/30 p-1.5',
        className,
      )}
      data-testid={testId ?? 'subagent-task-tree'}
      data-subagent-id={subagent.id}
      data-subagent-thread-id={subagent.threadId}
      data-subagent-status={subagent.status}
      onContextMenu={onContextMenu}
    >
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        aria-expanded={!collapsed}
        className="flex w-full items-center gap-1.5 rounded-sm px-1 py-0.5 text-left transition-colors hover:bg-accent/30"
      >
        <ChevronRight
          className={cn(
            'h-2.5 w-2.5 shrink-0 text-muted-foreground/60 transition-transform duration-150',
            !collapsed && 'rotate-90',
          )}
          aria-hidden
        />
        <StatusIcon
          className={cn(
            'h-3 w-3 shrink-0',
            STATUS_CLS[subagent.status],
            subagent.status === 'running' && 'animate-spin',
          )}
          aria-hidden
        />
        <Bot className={cn('h-3 w-3 shrink-0', colorCls)} aria-hidden />
        <span className="shrink-0 text-[11px] font-medium text-foreground/90">
          {subagent.nickname}
        </span>
        <span className="shrink-0 text-[10px] text-muted-foreground/60">{subagent.handle}</span>
        <span className="flex-1" />
        {subagent.currentTask && (
          <span className="hidden truncate text-[10px] text-muted-foreground/60 min-[1024px]:inline">
            {subagent.currentTask}
          </span>
        )}
        {subagent.durationMs !== undefined && (
          <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/60">
            {formatDuration(subagent.durationMs)}
          </span>
        )}
        {subagent.tokenUsage !== undefined && subagent.tokenUsage > 0 && (
          <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/60">
            {Math.round(subagent.tokenUsage / 1000)}k tok
          </span>
        )}
      </button>

      {subagent.failureReason && (
        <div className="ml-4 flex items-start gap-1 text-[10px] text-destructive/80">
          <AlertCircle className="mt-0.5 h-2.5 w-2.5 shrink-0" aria-hidden />
          <span className="break-all">{subagent.failureReason}</span>
        </div>
      )}

      {!collapsed && checklistItems.length > 0 && (
        <div className="ml-4 border-l border-border/40 pl-2 pt-1">
          <div className="mb-1 inline-flex items-center gap-1 text-[10px] text-muted-foreground/60">
            <Wrench className="h-2.5 w-2.5" aria-hidden />
            工具调用 ({checklistItems.length})
          </div>
          <Checklist items={checklistItems} dense />
        </div>
      )}

      {!collapsed && subagent.currentTask && (
        <div className="ml-4 flex items-start gap-1 border-l border-border/40 pl-2 text-[10px] text-muted-foreground/70">
          <span className="shrink-0">→</span>
          <span className="break-all">{subagent.currentTask}</span>
        </div>
      )}

      {/* Phase 20 P1-4: 右键菜单浮层 */}
      {menu.visible && (
        <div
          ref={menuRef}
          role="menu"
          tabIndex={-1}
          aria-label={`子代理 ${subagent.nickname} 操作菜单`}
          onKeyDown={onMenuKeyDown}
          data-testid={`${testId ?? 'subagent-task-tree'}-context-menu`}
          className={cn(
            'fixed z-[1100] min-w-[180px] rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md',
            'animate-in fade-in-0 zoom-in-95',
          )}
          style={{ left: menuPos.x, top: menuPos.y }}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => void onMenuClick('threadId')}
            data-testid="subagent-context-menu-copy-threadId"
            className="flex w-full items-center gap-1.5 rounded-sm px-2 py-1 text-left text-[11px] text-foreground/90 transition-colors hover:bg-accent/50 hover:text-foreground focus-visible:bg-accent/50 focus-visible:outline-none"
          >
            <Hash className="h-3 w-3 shrink-0 text-muted-foreground/70" aria-hidden />
            <span className="flex-1 truncate">复制 Thread ID</span>
            {copied === 'threadId' && (
              <CheckIcon className="h-3 w-3 shrink-0 text-emerald-500" aria-hidden />
            )}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => void onMenuClick('handle')}
            data-testid="subagent-context-menu-copy-handle"
            className="flex w-full items-center gap-1.5 rounded-sm px-2 py-1 text-left text-[11px] text-foreground/90 transition-colors hover:bg-accent/50 hover:text-foreground focus-visible:bg-accent/50 focus-visible:outline-none"
          >
            <AtSign className="h-3 w-3 shrink-0 text-muted-foreground/70" aria-hidden />
            <span className="flex-1 truncate">复制 Handle</span>
            {copied === 'handle' && (
              <CheckIcon className="h-3 w-3 shrink-0 text-emerald-500" aria-hidden />
            )}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => void onMenuClick('nickname')}
            data-testid="subagent-context-menu-copy-nickname"
            className="flex w-full items-center gap-1.5 rounded-sm px-2 py-1 text-left text-[11px] text-foreground/90 transition-colors hover:bg-accent/50 hover:text-foreground focus-visible:bg-accent/50 focus-visible:outline-none"
          >
            <User className="h-3 w-3 shrink-0 text-muted-foreground/70" aria-hidden />
            <span className="flex-1 truncate">复制 Nickname</span>
            {copied === 'nickname' && (
              <CheckIcon className="h-3 w-3 shrink-0 text-emerald-500" aria-hidden />
            )}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => void onMenuClick('details')}
            data-testid="subagent-context-menu-copy-details"
            className="flex w-full items-center gap-1.5 rounded-sm px-2 py-1 text-left text-[11px] text-foreground/90 transition-colors hover:bg-accent/50 hover:text-foreground focus-visible:bg-accent/50 focus-visible:outline-none"
          >
            <FileText className="h-3 w-3 shrink-0 text-muted-foreground/70" aria-hidden />
            <span className="flex-1 truncate">复制详情</span>
            {copied === 'details' && (
              <CheckIcon className="h-3 w-3 shrink-0 text-emerald-500" aria-hidden />
            )}
          </button>
        </div>
      )}
    </div>
  )
})

export default SubAgentTaskTree
