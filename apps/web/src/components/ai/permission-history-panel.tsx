'use client'

/**
 * 权限模式历史面板(2026-07-25 立,深度对标 OpenAI Codex CLI 审计能力)
 *
 * 触发场景:
 * - 用户点击 PermissionModePopover 内的"查看历史"按钮 → window.__IHUI_OPEN_HISTORY__?.()
 * - 也可点击面板自身触发器按钮直接打开
 *
 * UI 组成:
 * - Popover 风格(用项目内 Popover 组件,挂到 message-input 末尾,默认不显示)
 * - 触发器:Clock4 / History 图标按钮
 * - 内容:
 *   1. 顶部"清空历史"按钮(确认后调 clearHistory)
 *   2. 列表(每条显示模式名 + 切换源 + 相对时间 + 工作区简称)
 *   3. 底部"累计统计:完全访问 X 小时,请求批准 Y 小时"汇总
 *
 * 数据流:
 * - 读取:useEffect 内调 getRecentHistory() + getTotalDurationByMode(),写入 useState
 * - 写入:用户点"清空历史" → clearHistory() → 重新读一次刷新列表
 * - 触发:PermissionModePopover 调 window.__IHUI_OPEN_HISTORY__?.()
 *   → 内部手动调用 triggerRef.current?.click() 复用 Popover 内部 open 状态
 *
 * 边界:
 * - 隐私模式 / quota 超出:readAll() 内部 try/catch 返回 [],面板显示"暂无历史"
 * - 跨标签页:本面板打开时主动 readAll 一次,关闭时不监听 storage(用户重开再读最新)
 * - 不持久化 React 状态(防 SSR hydration mismatch)
 */

import * as React from 'react'
import { Clock4, History, Trash2, ShieldAlert, ShieldCheck, Hand } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Popover } from '@/components/feedback'
import { cn } from '@/lib/utils'
import {
  getRecentHistory,
  getTotalDurationByMode,
  clearHistory,
  formatDuration,
  formatRelativeTime,
  type ModeChangeEntry,
} from '@/lib/permission-mode-history'
import type { WorkspacePermissionMode } from '@ihui/api-client/endpoints/workspace'

/** 历史面板最大展示条数 */
const HISTORY_DISPLAY_LIMIT = 10

const MODE_ICON: Record<WorkspacePermissionMode, React.ComponentType<{ className?: string }>> = {
  default: Hand,
  'accept-edits': ShieldCheck,
  'bypass-permissions': ShieldAlert,
}

/** 把 mode 字符串映射到 i18n key 路径(用于显示"请求批准"等本地化名) */
const MODE_KEY_MAP: Record<WorkspacePermissionMode, 'mode.ask' | 'mode.auto' | 'mode.full'> = {
  default: 'mode.ask',
  'accept-edits': 'mode.auto',
  'bypass-permissions': 'mode.full',
}

/** 把绝对路径简化为"父目录/末级"用于紧凑展示(避免长路径占满 UI) */
function shortenPath(path: string): string {
  if (!path) return ''
  const norm = path.replace(/\\/g, '/')
  const parts = norm.split('/').filter(Boolean)
  if (parts.length <= 1) return norm
  return `${parts[parts.length - 2]}/${parts[parts.length - 1]}`
}

interface HistoryListProps {
  entries: ModeChangeEntry[]
  now: number
}

function HistoryList({ entries, now }: HistoryListProps) {
  const t = useTranslations('chat.permission')
  if (entries.length === 0) {
    return <div className="py-6 text-center text-xs text-muted-foreground">{t('historyEmpty')}</div>
  }
  return (
    <ul className="space-y-1.5">
      {entries.map((entry, idx) => {
        const Icon = MODE_ICON[entry.mode] ?? Hand
        const isHighRisk = entry.mode === 'bypass-permissions'
        const sourceKey =
          entry.source === 'popover'
            ? 'popover'
            : entry.source === 'shift-tab'
              ? 'shift-tab'
              : entry.source === 'slash'
                ? 'slash'
                : 'auto-revert'
        return (
          <li
            key={`${entry.timestamp}-${idx}`}
            className="flex items-start gap-2 rounded-md border border-border/60 bg-card/40 px-2 py-1.5"
          >
            <Icon
              className={cn(
                'mt-0.5 h-3.5 w-3.5 shrink-0',
                isHighRisk ? 'text-amber-500' : 'text-muted-foreground',
              )}
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    'text-xs font-medium',
                    isHighRisk && 'text-amber-700 dark:text-amber-400',
                  )}
                >
                  {t(MODE_KEY_MAP[entry.mode])}
                </span>
                <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                  <span aria-hidden="true">·</span>
                  <span>{t(`historySource.${sourceKey}`)}</span>
                </span>
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span>{formatRelativeTime(entry.timestamp, now)}</span>
                {entry.workspacePath && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="truncate font-mono" title={entry.workspacePath}>
                      {shortenPath(entry.workspacePath)}
                    </span>
                  </>
                )}
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function StatsFooter() {
  const t = useTranslations('chat.permission')
  const stats: {
    mode: WorkspacePermissionMode
    labelKey: 'mode.ask' | 'mode.auto' | 'mode.full'
  }[] = [
    { mode: 'default', labelKey: 'mode.ask' },
    { mode: 'accept-edits', labelKey: 'mode.auto' },
    { mode: 'bypass-permissions', labelKey: 'mode.full' },
  ]
  return (
    <div className="border-t pt-1.5">
      <div className="mb-1 px-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {t('historyStatsTitle')}
      </div>
      <div className="space-y-0.5">
        {stats.map((s) => {
          const ms = getTotalDurationByMode(s.mode)
          const formatted = formatDuration(ms)
          return (
            <div
              key={s.mode}
              className="flex items-center justify-between gap-2 px-1 text-[10px] text-muted-foreground"
            >
              <span>{t(s.labelKey)}</span>
              <span className="font-mono tabular-nums text-foreground/80">{formatted}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function PermissionHistoryPanel() {
  const t = useTranslations('chat.permission')
  const [open, setOpen] = React.useState(false)
  const [entries, setEntries] = React.useState<ModeChangeEntry[]>([])
  const [now, setNow] = React.useState<number>(() => Date.now())
  /** Popover 触发器按钮 ref(2026-07-25 立):供 window.__IHUI_OPEN_HISTORY__ 编程式触发 */
  const triggerRef = React.useRef<HTMLButtonElement | null>(null)

  // 打开时主动拉取最新数据 + 刷新"现在"锚点(用于相对时间显示)
  React.useEffect(() => {
    if (!open) return
    setEntries(getRecentHistory(undefined, HISTORY_DISPLAY_LIMIT))
    setNow(Date.now())
  }, [open])

  // 跨标签页同步:监听 storage,另一标签页清空历史时本标签页也更新
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const onStorage = (e: StorageEvent) => {
      if (e.key !== 'ihui:permission-mode-history') return
      setEntries(getRecentHistory(undefined, HISTORY_DISPLAY_LIMIT))
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // 全局句柄(2026-07-25 立):PermissionModePopover 通过 window.__IHUI_OPEN_HISTORY__?.() 触发
  // 实现:编程式 click 触发器按钮(复用 Popover 内部 open 状态,避免改 Popover 组件)
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const w = window as unknown as {
      __IHUI_OPEN_HISTORY__?: () => void
    }
    w.__IHUI_OPEN_HISTORY__ = () => {
      triggerRef.current?.click()
    }
    return () => {
      w.__IHUI_OPEN_HISTORY__ = undefined
    }
  }, [])

  // 1min tick 强制重渲染"相对时间"(避免 1 小时前 → 1 小时 1 分钟前 不更新)
  React.useEffect(() => {
    if (!open) return
    const id = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(id)
  }, [open])

  const handleClear = () => {
    if (typeof window === 'undefined') return
    const ok = window.confirm(`${t('historyClearConfirmTitle')}\n\n${t('historyClearConfirmDesc')}`)
    if (!ok) return
    clearHistory()
    setEntries([])
  }

  return (
    <Popover
      content={
        <div className="w-[320px] space-y-2" data-testid="permission-history-panel">
          {/* 顶部标题 + 清空按钮 */}
          <div className="flex items-center justify-between gap-2 px-1 pb-1">
            <div className="flex items-center gap-1.5">
              <History className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              <span className="text-sm font-semibold text-foreground">{t('historyTitle')}</span>
            </div>
            {entries.length > 0 && (
              <button
                type="button"
                onClick={handleClear}
                aria-label={t('historyClearConfirm')}
                className={cn(
                  'inline-flex items-center gap-0.5 text-[10px] font-medium',
                  'text-muted-foreground transition-colors hover:text-destructive',
                )}
              >
                <Trash2 className="h-3 w-3" aria-hidden="true" />
                <span>{t('historyClearConfirm')}</span>
              </button>
            )}
          </div>
          {/* 列表 */}
          <div className="max-h-[260px] overflow-y-auto">
            <HistoryList entries={entries} now={now} />
          </div>
          {/* 统计汇总 */}
          <StatsFooter />
          {/* 屏幕阅读器宣告:打开 + 空状态时宣告"暂无历史" */}
          <span className="sr-only" aria-live="polite">
            {open && entries.length === 0 ? t('historyEmpty') : ''}
          </span>
        </div>
      }
      position="top"
      align="end"
      trigger="click"
      portal
      onOpenChange={setOpen}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-label={t('historyOpenButton')}
        title={t('historyOpenExternal')}
        data-testid="permission-history-trigger"
        className={cn(
          'inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors',
          'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        )}
      >
        <Clock4 className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </Popover>
  )
}

export default PermissionHistoryPanel
