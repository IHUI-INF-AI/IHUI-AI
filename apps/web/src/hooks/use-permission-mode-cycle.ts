'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'

import { switchPermissionMode } from '@/components/ai/permission-mode-popover'
import { isFullAccessConfirmSuppressed } from '@/components/ai/full-access-confirm-dialog'
import { recordModeChange, updateLatestRecordSource } from '@/lib/permission-mode-history'
import { useAiPanelStore } from '@/stores/ai-panel'
import type { WorkspacePermissionMode } from '@ihui/api-client/endpoints/workspace'

/** 模式循环顺序(2026-07-25 深化,深度对标 Codex CLI Shift+Tab 循环切换)
 * default(请求批准) → accept-edits(替我审批) → bypass-permissions(完全访问) → default
 * 注意:bypass-permissions 是高风险,放在最后便于"按 3 次回正" */
const PERMISSION_CYCLE: WorkspacePermissionMode[] = [
  'default',
  'accept-edits',
  'bypass-permissions',
]

/** localStorage 键(2026-07-25 深化,跨刷新记忆用户上次主动选择的权限模式)
 * 仅记忆非默认模式;首次绑定工作区时如果 store 没指定,优先用这个值 */
const PERMISSION_MEMORY_KEY = 'ihui:preferred-permission-mode'

/**
 * 权限模式循环切换 hook(2026-07-29 提取自 message-input.tsx,深度对标 Codex CLI Shift+Tab 循环)
 *
 * 职责:
 * - ? 键唤起/关闭 PermissionShortcutsModal(短按 ? 切换)
 * - 监听 activeWorkspaceMode 变化 → 同步到 localStorage(仅记忆非默认)
 * - 监听 activeWorkspaceMode 变化 → 写入历史记录
 * - 暴露 cyclePermissionMode 给 Shift+Tab 调用
 * - 全访问确认:切到 bypass-permissions + 未静默 → 弹 FullAccessConfirmDialog
 *
 * 数据流:
 * - 输入:useAiPanelStore.activeWorkspace / setActiveWorkspace / setPendingFullAccess
 * - 输出:{ shortcutsOpen, openShortcuts, closeShortcuts, cyclePermissionMode }
 *
 * 持久化:
 * - PERMISSION_MEMORY_KEY:记忆用户上次主动选择的权限模式
 * - recordModeChange:写入模式变更历史(供 PermissionHistoryPanel 展示)
 *
 * 关键边界:
 * - 切到 bypass-permissions 时:若 isFullAccessConfirmSuppressed()=false,只 setPendingFullAccess(true)
 *   返回,不做实际切换;FullAccessConfirmBridge 确认后会自行调 switchPermissionMode
 * - 切完模式:把刚被 useEffect 占位为 'popover' 的最新一条记录 source 改为 'shift-tab'
 */
export function usePermissionModeCycle(): {
  shortcutsOpen: boolean
  openShortcuts: () => void
  closeShortcuts: () => void
  cyclePermissionMode: () => Promise<void>
} {
  const t = useTranslations('chat.permission')
  // 当前工作区权限模式 + 切换 store
  const activeWorkspace = useAiPanelStore((s) => s.activeWorkspace)
  const setActiveWorkspace = useAiPanelStore((s) => s.setActiveWorkspace)
  const setPendingFullAccess = useAiPanelStore((s) => s.setPendingFullAccess)
  const activeWorkspaceMode = activeWorkspace?.mode

  // 权限模式可发现性增强(2026-07-25 深化,深度对标 Codex CLI /help):
  // - shortcutsOpen: ? 键唤起/关闭 PermissionShortcutsModal
  const [shortcutsOpen, setShortcutsOpen] = React.useState(false)

  // 全局 ? 键监听(2026-07-25 深化,Codex CLI 风格):
  // - Shift+/ 也算,避免不同键盘布局下 ? 在不同位置
  // - 排除 textarea/input/contenteditable 内,用户打字时不应该误触
  // - 再按一次关闭(toggle),与常见 ? 文档快捷键行为一致
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.isContentEditable)
      ) {
        return
      }
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault()
        setShortcutsOpen((v) => !v)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // 权限模式快捷切换(2026-07-25 深化,深度对标 Codex CLI Shift+Tab 循环):
  // - 模式改变时同步到 localStorage(只记忆非默认,避免污染用户)
  // - Shift+Tab 在 3 个模式间循环切,跳过斜杠面板/提及面板打开时
  // - 切到 bypass-permissions 复用 PermissionModePopover 同一撤销 toast
  // 监听 mode 变化 → localStorage
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      if (activeWorkspaceMode) {
        window.localStorage.setItem(PERMISSION_MEMORY_KEY, activeWorkspaceMode)
      } else {
        // 解除绑定时清掉记忆(避免下次自动套用过时模式)
        window.localStorage.removeItem(PERMISSION_MEMORY_KEY)
      }
    } catch {
      // 隐私模式/localStorage 不可用静默
    }
  }, [activeWorkspaceMode])

  // 权限模式切换历史记录(2026-07-25 立,深度对标 Codex CLI 审计能力):
  // - activeWorkspaceMode 变化时追加 1 条记录到 localStorage
  // - source 暂用 'popover' 作为默认,具体来源由调用方通过 __IHUI_RECORD_MODE_CHANGE__ 句柄覆盖
  // - 不在 hook 内做来源判断(避免 popover/Shift+Tab/slash 三处分别改 1 个 if)
  // - 主动撤销 1h 计时器归零 → auto-revert 来源,由 use-permission-auto-revert 内 hook 句柄写入
  React.useEffect(() => {
    if (!activeWorkspaceMode) return
    // 首次 mount 时不记录(用户可能刚打开页面看到默认 default,记录无意义)
    // 只在 mode 真正变化时记录 —— 通过 ref 缓存上次值判断
    const w = window as unknown as {
      __IHUI_LAST_RECORDED_MODE__?: WorkspacePermissionMode | null
    }
    const last = w.__IHUI_LAST_RECORDED_MODE__
    if (last === activeWorkspaceMode) return
    w.__IHUI_LAST_RECORDED_MODE__ = activeWorkspaceMode
    recordModeChange({
      mode: activeWorkspaceMode,
      workspacePath: activeWorkspace?.path ?? '',
      timestamp: Date.now(),
      // 默认识别为 popover 来源;popover/shift-tab/slash 各自的代码路径在切完模式后会
      // 通过 __IHUI_RECORD_MODE_CHANGE__ 句柄覆盖最近一条的 source(见下)
      source: 'popover',
    })
  }, [activeWorkspaceMode, activeWorkspace?.path])

  // 切到下一个模式(Shift+Tab 循环)
  const cyclePermissionMode = React.useCallback(async () => {
    const current = (activeWorkspaceMode ?? 'default') as WorkspacePermissionMode
    const idx = PERMISSION_CYCLE.indexOf(current)
    const next = PERMISSION_CYCLE[(idx + 1) % PERMISSION_CYCLE.length] ?? 'default'
    if (next === current) return
    // 切到 bypass-permissions + 首次启用 + 未静默 → 弹确认弹窗(2026-07-25 深化)
    // 与 popover 走同一条 FullAccessConfirmDialog(共享 store.pendingFullAccess)
    if (next === 'bypass-permissions' && !isFullAccessConfirmSuppressed()) {
      setPendingFullAccess(true)
      return
    }
    const previousMode = current
    // 乐观更新 store
    if (activeWorkspace) {
      setActiveWorkspace({ ...activeWorkspace, mode: next })
    }
    const result = await switchPermissionMode(next)
    if (!result.ok) {
      // 回滚
      if (activeWorkspace && previousMode) {
        setActiveWorkspace({ ...activeWorkspace, mode: previousMode })
      }
      toast.error(t('cycleError', { error: result.error ?? '未知错误' }))
      return
    }
    // 切完模式 → 把刚被 useEffect 占位为 'popover' 的最新一条记录 source 改为 'shift-tab'
    // 避免在 useEffect 内的 source 写死 'popover' 让历史面板误把 Shift+Tab 记成 popover
    updateLatestRecordSource('shift-tab', (e) => e.mode === next)
    // 切到完全访问 → 5s 撤销 toast(与 popover 一致体验)
    if (next === 'bypass-permissions') {
      toast(t('switchedToFull'), {
        description: t('switchedToFullDesc', { prev: previousMode }),
        duration: 5000,
        action: {
          label: t('undo'),
          onClick: () => void cyclePermissionMode(),
        },
      })
    } else {
      // default / accept-edits → 短提示
      const labelKey = next === 'default' ? 'mode.ask' : 'mode.auto'
      toast.success(t('cycledTo', { mode: t(labelKey) }), {
        duration: 2000,
      })
    }
  }, [activeWorkspace, activeWorkspaceMode, setActiveWorkspace, setPendingFullAccess, t])

  const openShortcuts = React.useCallback(() => setShortcutsOpen(true), [])
  const closeShortcuts = React.useCallback(() => setShortcutsOpen(false), [])

  return {
    shortcutsOpen,
    openShortcuts,
    closeShortcuts,
    cyclePermissionMode,
  }
}
