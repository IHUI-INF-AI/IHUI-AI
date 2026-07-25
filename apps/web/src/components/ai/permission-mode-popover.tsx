'use client'

import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import {
  Check,
  ExternalLink,
  Hand,
  Loader2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  type LucideIcon,
} from 'lucide-react'
import {
  setWorkspacePermission,
  type WorkspacePermissionMode,
} from '@ihui/api-client/endpoints/workspace'

import { Popover } from '@/components/feedback'
import { useAiPanelStore } from '@/stores/ai-panel'
import { cn } from '@/lib/utils'

/** 工作区权限模式选择器(2026-07-25 立,深度对标 OpenAI Codex CLI approvalMode)
 *
 * 触发器:盾牌图标 + 当前模式短名(如"完全访问" / "请求批准" / "替我审批")
 * 点击 → 弹 Codex 风格 popover:
 *   - 顶部:"应如何批准 AI 操作?" + 右侧"了解更多" 链接
 *   - 三个单选卡片(每卡 = 图标 + 标题 + 描述),右侧 ✓ 标识当前模式
 *   - 底部"完全访问"快捷链接(深色卡片风格,提醒高风险)
 *
 * 数据流:
 *   - 读:useAiPanelStore.activeWorkspace.mode
 *   - 写:setWorkspacePermission API → 同步更新 store + 触发 toast
 *
 * 若用户尚未绑定工作区,触发器点击 → 直接弹出"为新工作区选择权限"提示
 *   (用户规则:选择项目文件后需要让用户确认同意是否可完全访问)
 */
export function PermissionModePopover({ disabled }: { disabled?: boolean }) {
  const t = useTranslations('chat.permission')
  const tCommon = useTranslations('common')

  const activeWorkspace = useAiPanelStore((s) => s.activeWorkspace)
  const setActiveWorkspace = useAiPanelStore((s) => s.setActiveWorkspace)
  const queryClient = useQueryClient()

  const currentMode: WorkspacePermissionMode = activeWorkspace?.mode ?? 'default'

  // 三种模式配置(对齐 WorkspacePermissionDialog 的 MODE_OPTIONS,做加法扩展 + 短描述)
  // titleKey/descKey 已是字面量联合,直接预计算完整 i18n key 避免动态拼接
  const MODE_OPTIONS: Array<{
    value: WorkspacePermissionMode
    icon: LucideIcon
    titleKey: 'mode.ask' | 'mode.auto' | 'mode.full'
    descKey: 'mode.askDesc' | 'mode.autoDesc' | 'mode.fullDesc'
    risk: 'low' | 'medium' | 'high'
  }> = [
    { value: 'default', icon: Hand, titleKey: 'mode.ask', descKey: 'mode.askDesc', risk: 'low' },
    {
      value: 'accept-edits',
      icon: ShieldCheck,
      titleKey: 'mode.auto',
      descKey: 'mode.autoDesc',
      risk: 'medium',
    },
    {
      value: 'bypass-permissions',
      icon: ShieldAlert,
      titleKey: 'mode.full',
      descKey: 'mode.fullDesc',
      risk: 'high',
    },
  ]

  const updateMode = useMutation({
    mutationFn: async (mode: WorkspacePermissionMode) => {
      // 未绑定工作区时无需落库(只更新 store,等用户绑定时由 picker 同步给后端)
      if (!activeWorkspace) return null
      const res = await setWorkspacePermission({
        workspacePath: activeWorkspace.path,
        name: activeWorkspace.name,
        techStack: activeWorkspace.techStack?.join(','),
        mode,
        // accept-edits 模式 + 首次设置 → 初始化预置安全模板
        initializeDefaults: mode === 'accept-edits' && !activeWorkspace.mode,
      })
      if (!res.success) throw new Error(res.error)
      return res.data.permission
    },
    onSuccess: (perm) => {
      if (perm) {
        queryClient.invalidateQueries({ queryKey: ['workspace', 'permissions'] })
        queryClient.invalidateQueries({
          queryKey: ['workspace', 'permission', perm.workspacePath],
        })
      }
      if (activeWorkspace) {
        setActiveWorkspace({ ...activeWorkspace, mode: currentMode })
      }
    },
  })

  const handleSelect = (mode: WorkspacePermissionMode) => {
    if (mode === currentMode) return
    // 乐观更新:立即写 store,失败回滚
    const previousMode = activeWorkspace?.mode
    if (activeWorkspace) {
      setActiveWorkspace({ ...activeWorkspace, mode })
    } else {
      // 未绑定工作区:写到 useModeStore 风格的"未绑定期望模式",等绑定时由 picker 接管
      // 这里简化:用 sessionStorage 暂存
      try {
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem('ihui-pending-permission-mode', mode)
        }
      } catch {
        // sessionStorage 不可用(隐私模式)静默忽略
      }
    }
    updateMode.mutate(mode, {
      onError: () => {
        if (activeWorkspace && previousMode !== undefined) {
          setActiveWorkspace({ ...activeWorkspace, mode: previousMode })
        }
      },
    })
  }

  const currentOption = MODE_OPTIONS.find((opt) => opt.value === currentMode) ?? MODE_OPTIONS[0]!
  const CurrentIcon = currentOption.icon
  const currentTitle = t(currentOption.titleKey)
  const hasWorkspace = !!activeWorkspace

  return (
    <Popover
      content={
        <div className="w-[360px] space-y-2">
          {/* 顶部标题 + 了解更多链接(Codex 风格:左标题,右链接) */}
          <div className="flex items-start justify-between gap-2 px-1 pb-1">
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-foreground">
                {t('popoverTitle')}
              </span>
              {!hasWorkspace && (
                <span className="text-[11px] text-muted-foreground">
                  {t('popoverHintNoWorkspace')}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.open('/docs/SECURITY', '_blank', 'noopener,noreferrer')
                }
              }}
              className="inline-flex shrink-0 items-center gap-0.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <span className="underline-offset-2 hover:underline">{t('learnMore')}</span>
              <ExternalLink className="h-3 w-3" />
            </button>
          </div>

          {/* 三个模式单选卡片 */}
          <div className="space-y-1.5">
            {MODE_OPTIONS.map((opt) => {
              const Icon = opt.icon
              const isSel = opt.value === currentMode
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleSelect(opt.value)}
                  disabled={updateMode.isPending}
                  className={cn(
                    'group flex w-full items-start gap-2.5 rounded-lg border p-2.5 text-left transition-colors',
                    'disabled:cursor-not-allowed disabled:opacity-60',
                    isSel
                      ? 'border-primary/60 bg-primary/5'
                      : 'border-border hover:border-foreground/20 hover:bg-muted/30',
                  )}
                >
                  <Icon
                    className={cn(
                      'mt-0.5 h-4 w-4 shrink-0',
                      isSel
                        ? 'text-primary'
                        : opt.risk === 'high'
                          ? 'text-amber-500'
                          : opt.risk === 'medium'
                            ? 'text-emerald-500'
                            : 'text-muted-foreground',
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          'text-xs font-medium',
                          opt.risk === 'high' && isSel && 'text-amber-600 dark:text-amber-400',
                        )}
                      >
                        {t(opt.titleKey)}
                      </span>
                      {opt.risk === 'high' && (
                        <span className="rounded-sm bg-amber-500/10 px-1 py-px text-[9px] font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400">
                          {t('highRisk')}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                      {t(opt.descKey)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center self-center">
                    {updateMode.isPending && isSel ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    ) : isSel ? (
                      <Check className="h-3.5 w-3.5 text-primary" />
                    ) : null}
                  </div>
                </button>
              )
            })}
          </div>

          {/* 底部"完全访问"快捷链接(对标 Codex 顶部展开的深色卡片) */}
          <button
            type="button"
            onClick={() => handleSelect('bypass-permissions')}
            disabled={updateMode.isPending}
            className={cn(
              'mt-1 flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left transition-colors',
              currentMode === 'bypass-permissions'
                ? 'border-amber-500/40 bg-amber-500/5'
                : 'border-border/60 hover:border-amber-500/30 hover:bg-amber-500/5',
              'disabled:cursor-not-allowed disabled:opacity-60',
            )}
          >
            <ShieldX className="h-3.5 w-3.5 shrink-0 text-amber-500" />
            <span className="flex-1 text-xs font-medium text-amber-700 dark:text-amber-400">
              {t('quickFullAccess')}
            </span>
            {currentMode === 'bypass-permissions' && (
              <Check className="h-3 w-3 text-amber-500" />
            )}
          </button>

          {updateMode.isError && (
            <p className="px-1 text-[11px] text-destructive">
              {(updateMode.error as Error)?.message || tCommon('error')}
            </p>
          )}
        </div>
      }
      position="top"
      align="start"
      trigger="click"
      portal
    >
      <button
        type="button"
        disabled={disabled}
        aria-label={t('buttonLabel')}
        title={t('buttonLabel')}
        className={cn(
          'inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors',
          // 模式风险色:default=中性 / accept-edits=绿 / bypass=琥珀
          currentMode === 'bypass-permissions'
            ? 'bg-amber-500/10 text-amber-700 hover:bg-amber-500/15 dark:text-amber-400'
            : currentMode === 'accept-edits'
              ? 'bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-400'
              : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
      >
        <CurrentIcon
          className={cn(
            'h-3.5 w-3.5 shrink-0',
            currentMode === 'bypass-permissions' && 'text-amber-500',
            currentMode === 'accept-edits' && 'text-emerald-500',
            currentMode === 'default' && 'text-muted-foreground',
          )}
        />
        <span className="whitespace-nowrap">{currentTitle}</span>
        <Shield
          className="h-3 w-3 shrink-0 opacity-50"
          aria-hidden="true"
        />
      </button>
    </Popover>
  )
}
