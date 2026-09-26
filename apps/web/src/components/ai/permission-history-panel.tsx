// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 权限模式历史面板(2026-07-25 立,深度对标 OpenAI Codex CLI 审计能力)
 *
 * 触发场景:
 * - 用户点击 PermissionModePopover 内的"查看历史"按钮 → window.__IHUI_OPEN_HISTORY__?.()
 * - 也可点击面板自身触发器按钮直接打开
 *
 * UI 组成:
 * - Popover 风格(用统一 PortalPanel 浮层,挂到 message-input 末尾,默认不显示)
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
 *   → 内部手动调用 triggerRef.current?.click() 复用面板内部 open 状态
 *
 * 边界:
 * - 隐私模式 / quota 超出:readAll() 内部 try/catch 返回 [],面板显示"暂无历史"
 * - 跨标签页:本面板打开时主动 readAll 一次,关闭时不监听 storage(用户重开再读最新)
 * - 不持久化 React 状态(防 SSR hydration mismatch)
 */

import * as React from 'react'
import {
  BellRing,
  Clock4,
  Compass,
  Hand,
  History,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { toast } from '@/components/common'

import { Tooltip } from '@/components/feedback'
import { IconButton } from '@ihui/ui-react'
// 浮层治理(2026-09-15):迁移到统一 PortalPanel(内置 portal/定位/clamp/翻转/外点与 Escape 关闭)
import { PortalPanel } from '@/components/feedback/portal-panel'
import { cn } from '@/lib/utils'
import {
  getRecentHistory,
  getTotalDurationByMode,
  clearHistory,
  formatDuration,
  formatRelativeTime,
  type ModeChangeEntry,
} from '@/lib/permission-mode-history'
import {
  isFullAccessConfirmSuppressed,
  resetFullAccessAcknowledgement,
} from '@/components/ai/full-access-confirm-dialog'
import type { WorkspacePermissionMode } from '@ihui/api-client/endpoints/workspace'
// 权限档读侧归一(G-161/G-164):跨界拼写多套,查表/比较前先归一到 wire 拼写
import { PERMISSION_MODE_WIRE_VALUES, permissionModeWire } from '@ihui/types/permission-mode'
// 权限档取词(G-166):档位归一与词表键的共享真相源,见 packages/shared/src/chat/permission-tier.ts
import { useConfirm } from '@/hooks/use-confirm'
import { permissionTierText } from '@/lib/permission-tier-text'

/** 历史面板最大展示条数 */
const HISTORY_DISPLAY_LIMIT = 10

/**
 * 档位图标表(G-164:补 `plan` 一档)。
 *
 * 键类型就是 `WorkspacePermissionMode` 本身 —— 上一版共享类型里声明了 `plan` 而这里只列
 * 3 档,tsc 会直接把"新增档位没补图标"报成编译错。
 * 档名不在这里(G-166):一律经 permissionTierText() 走跨端共享词表,查表前先
 * permissionModeWire() 归一 —— 历史上落库是 kebab,新链路可能送 camel/别名。
 */
const MODE_ICON: Record<WorkspacePermissionMode, React.ComponentType<{ className?: string }>> = {
  default: Hand,
  plan: Compass,
  'accept-edits': ShieldCheck,
  'bypass-permissions': ShieldAlert,
}


/** i18n 静态映射表 — 用于消除 `t(`historySource.${sourceKey}`)` 单变量动态拼接 */
type HistorySourceKey = 'popover' | 'shift-tab' | 'slash' | 'confirm-dialog' | 'auto-revert'
const HISTORY_SOURCE_KEY: Record<HistorySourceKey, string> = {
  popover: 'historySource.popover',
  'shift-tab': 'historySource.shift-tab',
  slash: 'historySource.slash',
  'confirm-dialog': 'historySource.confirm-dialog',
  // auto-revert 来源已废弃(1h 自动降级功能移除),仅保留用于兼容旧 localStorage 历史数据
  'auto-revert': 'historySource.auto-revert',
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
  /** Phase 24(2026-07-29):允许 null(SSR 时 panel 未打开,now 尚未注入 Date.now()),
   *  列表渲染时 null 会 fallback 到 entries.timestamp(0 相对时间) */
  now: number | null
}

function HistoryList({ entries, now }: HistoryListProps) {
  const t = useTranslations('chat.permission')
  const tTier = useTranslations()
  if (entries.length === 0) {
    return <div className="py-6 text-center text-xs text-muted-foreground">{t('historyEmpty')}</div>
  }
  return (
    <ul className="space-y-1.5">
      {entries.map((entry, idx) => {
        // 读侧归一(G-164):落库历史上是 kebab,新链路(v1 网关 / cli)可能送 camel 或
        // 历史别名。不归一就是"徽章与档名静默错位" —— 高风险档显示成普通档。
        const wire = permissionModeWire(entry.mode)
        const Icon = wire ? (MODE_ICON[wire] ?? Hand) : Hand
        const isHighRisk = wire === 'bypass-permissions'
        const sourceKey =
          entry.source === 'popover'
            ? 'popover'
            : entry.source === 'shift-tab'
              ? 'shift-tab'
              : entry.source === 'slash'
                ? 'slash'
                : entry.source === 'confirm-dialog'
                  ? 'confirm-dialog'
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
                  {/* 认不出的档位显示共享词表的 unknown 档("未知模式")—— 既不套某个已列
                      档位的中文名,也不再回显后端英文拼写(G-166) */}
                  {permissionTierText(entry.mode, tTier).title}
                </span>
                <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                  <span aria-hidden="true">·</span>
                  <span>{t(HISTORY_SOURCE_KEY[sourceKey] ?? 'historySource.unknown')}</span>
                </span>
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span suppressHydrationWarning>
                  {formatRelativeTime(entry.timestamp, now ?? entry.timestamp)}
                </span>
                {entry.workspacePath && (
                  <>
                    <span aria-hidden="true">·</span>
                    <Tooltip content={entry.workspacePath}>
                      <span className="truncate font-mono">{shortenPath(entry.workspacePath)}</span>
                    </Tooltip>
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
  const tTier = useTranslations()
  // 档名一律经 permissionTierText() 走共享词表(G-166),这里只留档位本身。
  // 清单从注册表派生(G-164:端内不得抄第二份完整档清单)—— 可见后果:页脚行序由
  // "plan 优先"改为注册表的规范序(default / plan / accept-edits / bypass-permissions)。
  const stats = [...PERMISSION_MODE_WIRE_VALUES] as WorkspacePermissionMode[]
  return (
    <div className="border-t pt-1.5">
      <div className="mb-1 px-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {t('historyStatsTitle')}
      </div>
      <div className="space-y-0.5">
        {stats.map((mode) => {
          const ms = getTotalDurationByMode(mode)
          const formatted = formatDuration(ms)
          return (
            <div
              key={mode}
              className="flex items-center justify-between gap-2 px-1 text-[10px] text-muted-foreground"
            >
              <span>{permissionTierText(mode, tTier).title}</span>
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
  const { confirm, ConfirmDialogRenderer } = useConfirm()
  const [open, setOpen] = React.useState(false)
  const [entries, setEntries] = React.useState<ModeChangeEntry[]>([])
  const [now, setNow] = React.useState<number | null>(null)
  /** 是否已"不再提醒"静默(仅 mount + 打开时读,不实时监听;用户主动重置后联动隐藏按钮) */
  const [isSuppressed, setIsSuppressed] = React.useState(false)
  /** Popover 触发器按钮 ref(2026-07-25 立):供 window.__IHUI_OPEN_HISTORY__ 编程式触发 */
  const triggerRef = React.useRef<HTMLButtonElement | null>(null)

  // 打开时主动拉取最新数据 + 刷新"现在"锚点(用于相对时间显示)
  React.useEffect(() => {
    if (!open) return
    setEntries(getRecentHistory(undefined, HISTORY_DISPLAY_LIMIT))
    setNow(Date.now())
    setIsSuppressed(isFullAccessConfirmSuppressed())
  }, [open])

  // "不再提醒"静默状态:mount 时读一次(打开时也会刷新,见上;不监听 storage)
  React.useEffect(() => {
    setIsSuppressed(isFullAccessConfirmSuppressed())
  }, [])

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
  // 实现:编程式 click 触发器按钮(复用面板内部 open 状态,避免改 PortalPanel 组件)
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

  const handleClear = async () => {
    const ok = await confirm({
      title: t('historyClearConfirmTitle'),
      description: t('historyClearConfirmDesc'),
      variant: 'destructive',
    })
    if (!ok) return
    clearHistory()
    setEntries([])
  }

  // 重新启用高风险确认弹窗(用户此前勾了"不再提醒",此处清除静默标志恢复提醒)
  const handleResetSuppressed = async () => {
    const ok = await confirm({
      title: t('resetSuppressedConfirmTitle'),
      description: t('resetSuppressedConfirmDesc'),
    })
    if (!ok) return
    resetFullAccessAcknowledgement()
    setIsSuppressed(false)
    toast.success(t('resetSuppressedToast'))
  }

  // 面板内容层 ref:供下方 focus trap 的 querySelectorAll 使用(透传给 PortalPanel 挂载)
  const panelRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!open) {
      triggerRef.current?.focus()
      return
    }
    if (!panelRef.current) return
    const focusable = Array.from(
      panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    )
    if (focusable.length === 0) return

    const first = focusable[0]!
    const last = focusable[focusable.length - 1]!

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [open])

  return (
    <>
      <IconButton
        ref={triggerRef}
        aria-label={t('historyOpenExternal')}
        data-testid="permission-history-trigger"
        // 与 Radix trigger 行为对齐(2026-09-02):本组件自写 popover 而非 Radix,
        // 需手动加 data-state 才能命中 globals.css:1090 的
        // `button[data-state='closed']:focus-visible { box-shadow: none }` 抑制规则,
        // 否则面板关闭后 useEffect 把焦点归还到 trigger,焦点环会常驻显示。
        data-state={open ? 'open' : 'closed'}
        className="focus-visible:ring-2"
        onClick={() => setOpen(!open)}
      >
        <Clock4 aria-hidden="true" />
      </IconButton>
      <PortalPanel
        open={open}
        anchorRef={triggerRef}
        onClose={() => setOpen(false)}
        side="top"
        align="end"
        gap={8}
        testId="permission-history-panel"
        panelRef={panelRef}
        className="w-[min(320px,calc(100vw-2rem))] rounded-md border bg-popover p-3 text-popover-foreground shadow-md"
      >
        {/* dialog 语义保留在内容层(PortalPanel 不透传 aria 属性与 tabIndex) */}
        <div
          role="dialog"
          aria-label={t('historyOpenExternal')}
          tabIndex={-1}
          className="space-y-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
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
          {/* 重新提醒高风险(仅当用户已勾"不再提醒"时显示,供恢复确认弹窗) */}
          {isSuppressed && (
            <div className="px-1">
              <button
                type="button"
                onClick={handleResetSuppressed}
                aria-label={t('resetSuppressedButton')}
                data-testid="reset-full-access-suppressed"
                className={cn(
                  'inline-flex items-center gap-0.5 text-[10px] font-medium',
                  'text-muted-foreground transition-colors hover:text-amber-600',
                )}
              >
                <BellRing className="h-3 w-3" aria-hidden="true" />
                <span>{t('resetSuppressedButton')}</span>
              </button>
            </div>
          )}
          {/* 屏幕阅读器宣告:打开 + 空状态时宣告"暂无历史" */}
          <span className="sr-only" aria-live="polite">
            {entries.length === 0 ? t('historyEmpty') : ''}
          </span>
        </div>
      </PortalPanel>
      <ConfirmDialogRenderer />
    </>
  )
}

export default PermissionHistoryPanel
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
