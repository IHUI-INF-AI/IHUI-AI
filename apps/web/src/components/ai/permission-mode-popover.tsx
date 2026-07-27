'use client'

import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import {
  Check,
  ExternalLink,
  Hand,
  Loader2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react'
import {
  setWorkspacePermission,
  type WorkspacePermissionMode,
} from '@ihui/api-client/endpoints/workspace'

import { Popover } from '@/components/feedback'
import { useAiPanelStore } from '@/stores/ai-panel'
import { cn } from '@/lib/utils'
import { isFullAccessConfirmSuppressed } from './full-access-confirm-dialog'

/** 工作区权限模式选择器(2026-07-25 深化,深度对标 OpenAI Codex CLI approvalMode)
 *
 * 触发器:盾牌图标 + 当前模式短名(如"完全访问" / "请求批准" / "替我审批")
 * 点击 → 弹 Codex 风格 popover:
 *   - 顶部:"应如何批准 AI 操作?" + 右侧"了解更多" 链接
 *   - 三个单选卡片(每卡 = 图标 + 标题 + 描述 + 数字快捷键 1/2/3),右侧 ✓ 标识当前模式
 *   - 底部"完全访问"快捷链接(深色卡片风格,提醒高风险)
 *
 * 数据流:
 *   - 读:useAiPanelStore.activeWorkspace.mode
 *   - 写:setWorkspacePermission API → 同步更新 store + 触发 toast
 *
 * 键盘交互(2026-07-25 深化,Codex CLI 风格):
 *   - ↑/↓ 在三个模式间循环切换焦点
 *   - Enter 选中当前聚焦的模式
 *   - 1/2/3 数字键直接选 ask/auto/full
 *   - Esc 关闭(由 Popover 组件处理)
 *
 * 高风险切换撤销(2026-07-25 深化,防误操作):
 *   - 切到 bypass-permissions 后,5s 内 toast 显示"已切换到完全访问" + 撤销按钮
 *   - 点撤销 → 切回上一个模式
 *   - 5s 倒计时由 sonner duration 控制
 *
 * 持久化视觉警告(2026-07-25 深化,高风险模式醒目):
 *   - 触发器按钮:bypass-permissions 模式显示琥珀底色 + 琥珀图标
 *   - 弹层打开时:三卡片焦点模式额外加 1px ring 突出
 *   - 外层 message-input 容器:见 message-input 自身根据 mode 加警告边框
 *
 * 若用户尚未绑定工作区,触发器点击 → 直接弹出"为新工作区选择权限"提示
 *   (用户规则:选择项目文件后需要让用户确认同意是否可完全访问)
 */
type ModeValue = WorkspacePermissionMode
type ModeKey = 'mode.ask' | 'mode.auto' | 'mode.full'
type ModeDescKey = 'mode.askDesc' | 'mode.autoDesc' | 'mode.fullDesc'

interface ModeOption {
  value: ModeValue
  icon: LucideIcon
  titleKey: ModeKey
  descKey: ModeDescKey
  risk: 'low' | 'medium' | 'high'
}

// 移到组件外避免每次 render 重新创建(2026-07-25 深化)
const MODE_OPTIONS_LIST: ModeOption[] = [
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

/** 撤销 toast 持续时间(ms)。给用户足够的"哎呀我点错了"反悔窗口 */
const UNDO_TOAST_DURATION = 5000

export function PermissionModePopover({ disabled }: { disabled?: boolean }) {
  const t = useTranslations('chat.permission')
  const tCommon = useTranslations('common')

  const activeWorkspace = useAiPanelStore((s) => s.activeWorkspace)
  const setActiveWorkspace = useAiPanelStore((s) => s.setActiveWorkspace)
  const queryClient = useQueryClient()

  const currentMode: WorkspacePermissionMode = activeWorkspace?.mode ?? 'default'

  // 弹层开关状态(2026-07-25 深化,onOpenChange 上抛):用于启用键盘监听 + 打开时重置焦点
  const [isOpen, setIsOpen] = React.useState(false)
  // 键盘焦点索引(用于 ↑/↓ 循环切换)。初始指向当前模式。
  const [focusedIndex, setFocusedIndex] = React.useState(() => {
    const idx = MODE_OPTIONS_LIST.findIndex((o) => o.value === currentMode)
    return idx >= 0 ? idx : 0
  })
  // Radio DOM 引用(2026-07-25 深化,A11y):popover 打开时覆盖默认初始焦点,
  // 把焦点放到 currentMode 对应的 radio 卡片(而非首个 focusable=learnMore),
  // 让屏幕阅读器/键盘用户从最有意义的元素开始浏览
  const radioRefs = React.useRef<(HTMLButtonElement | null)[]>([])
  // 首次启用高风险模式确认弹窗(2026-07-25 深化,深度对标 Codex CLI safety guard):
  // 通过 ai-panel store 共享状态,popover / Shift+Tab / /permission full 三处触发共用
  // 同一个 FullAccessConfirmDialog(由 message-input 渲染)
  // popover 只负责写 setPendingFullAccess(true) 触发弹窗,不需要读这个状态
  const setPendingFullAccess = useAiPanelStore((s) => s.setPendingFullAccess)

  const focusedMode = MODE_OPTIONS_LIST[focusedIndex]?.value ?? currentMode

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
      // 注:activeWorkspace.mode 已在 onMutate 乐观更新,这里不需要再 setActiveWorkspace
    },
  })

  /** 切换模式(核心逻辑,2026-07-25 深化)
   * 1. 同模式 → noop
   * 2. 乐观更新 store(立即反馈)
   * 3. mutation 落库,失败回滚
   * 4. 切到 bypass-permissions → 弹 5s 撤销 toast
   * 5. 切到 accept-edits → 弹持久化视觉警告横幅(toast 较轻,只提醒一次)
   */
  const handleSelect = React.useCallback(
    (mode: WorkspacePermissionMode) => {
      if (mode === currentMode) return
      if (updateMode.isPending) return // 防止快速连点
      // 切到 bypass-permissions + 首次启用 + 未静默 → 弹确认弹窗(2026-07-25 深化)
      // 用户必须勾选"我了解"才能点"继续启用",防止误操作
      // 通过 ai-panel store 共享状态,message-input 监听并渲染 FullAccessConfirmDialog
      if (mode === 'bypass-permissions' && !isFullAccessConfirmSuppressed()) {
        setPendingFullAccess(true)
        return
      }
      const previousMode = activeWorkspace?.mode
      // 乐观更新:立即写 store,失败回滚
      if (activeWorkspace) {
        setActiveWorkspace({ ...activeWorkspace, mode })
      } else {
        // 未绑定工作区:写到 sessionStorage 暂存,绑定时由 picker 接管
        try {
          if (typeof window !== 'undefined') {
            window.sessionStorage.setItem('ihui-pending-permission-mode', mode)
          }
        } catch {
          // sessionStorage 不可用(隐私模式)静默忽略
        }
      }
      updateMode.mutate(mode, {
        onError: (err) => {
          if (activeWorkspace && previousMode !== undefined) {
            setActiveWorkspace({ ...activeWorkspace, mode: previousMode })
          }
          // 切模式失败 → 错误 toast(2026-07-25 深化,与 cyclePermissionMode 行为一致)
          // 复用 cycleError key,避免再增 1 个仅 popover 用的 key 引起 i18n 噪声
          toast.error(
            t('cycleError', { error: err instanceof Error ? err.message : String(err) }),
          )
        },
        onSuccess: () => {
          // 切到完全访问(bypass-permissions)→ 弹 5s 撤销 toast,防误操作
          // (2026-07-25 深化)双 action:撤销 + 再保持 1h(防"刚切完就觉得不够"场景)
          if (mode === 'bypass-permissions' && previousMode) {
            const extendOneHour = () => {
              if (typeof window !== 'undefined') {
                const w = window as unknown as {
                  __IHUI_EXTEND_AUTO_REVERT__?: (ms?: number) => void
                }
                w.__IHUI_EXTEND_AUTO_REVERT__?.()
              }
            }
            toast(t('switchedToFull'), {
              description: t('switchedToFullDesc', { prev: previousMode }),
              duration: UNDO_TOAST_DURATION,
              action: {
                label: t('undo'),
                onClick: () => {
                  handleSelect(previousMode)
                },
              },
              cancel: {
                label: t('extendOneHour'),
                onClick: extendOneHour,
              },
            })
          } else if (mode === 'accept-edits') {
            // 切到 accept-edits → 普通提示(无撤销,误操作风险低)
            toast.success(t('switchedToAuto'), {
              description: t('switchedToAutoDesc'),
              duration: 3000,
            })
          } else if (mode === 'default' && previousMode === 'bypass-permissions') {
            // 从高风险切回默认 → 确认反馈
            toast.success(t('switchedToAsk'), {
              description: t('switchedToAskDesc'),
              duration: 3000,
            })
          }
        },
      })
    },
    // handleSelect 自身递归调用,useMutation 自带 isPending 闭包,无需在 deps 中重复
    [activeWorkspace, currentMode, updateMode, setActiveWorkspace, t],
  )

  // 键盘处理(↑/↓/Enter/1/2/3):只在 popover 打开时启用
  React.useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      // 数字键 1/2/3 直接选对应模式(Codex CLI 风格)
      if (e.key === '1' || e.key === '2' || e.key === '3') {
        e.preventDefault()
        e.stopPropagation()
        const idx = Number(e.key) - 1
        const target = MODE_OPTIONS_LIST[idx]
        if (target) {
          handleSelect(target.value)
        }
        return
      }
      // ↑/↓ 循环切换焦点 + 同步 DOM focus(2026-07-25 深化:视觉 ring 移动时键盘焦点也跟过去)
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        e.stopPropagation()
        const len = MODE_OPTIONS_LIST.length
        setFocusedIndex((prev) => {
          const next = e.key === 'ArrowDown' ? (prev + 1) % len : (prev - 1 + len) % len
          // 同步 DOM focus 到下一个 radio,避免视觉 ring 和实际 DOM 焦点脱节
          requestAnimationFrame(() => {
            radioRefs.current[next]?.focus()
          })
          return next
        })
        return
      }
      // Enter 选中当前聚焦
      if (e.key === 'Enter') {
        e.preventDefault()
        e.stopPropagation()
        handleSelect(focusedMode)
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
    }
  }, [isOpen, focusedMode, handleSelect])

  // 确认弹窗逻辑(2026-07-25 深化,深度对标 Codex CLI safety guard):
  // - popover 只负责 setPendingFullAccess(true) 触发弹窗
  // - 弹窗本体由 message-input 渲染 FullAccessConfirmDialog(共享 ai-panel store)
  // - 弹窗确认回调内:FullAccessConfirmDialog 写 localStorage(markFullAccessSuppressed)
  //   + message-input 内部 handleConfirm 重新调 switchPermissionMode('bypass-permissions')
  // - 此处不需要 handler 闭包,统一由 message-input 处理

  // 弹层打开时重置焦点到当前模式(避免上次关闭时的残留 index)
  React.useEffect(() => {
    if (isOpen) {
      const idx = MODE_OPTIONS_LIST.findIndex((o) => o.value === currentMode)
      setFocusedIndex(idx >= 0 ? idx : 0)
    }
  }, [isOpen, currentMode])

  // Popover 打开时(2026-07-25 深化,A11y):
  // 1. 覆盖 popover.tsx 默认初始焦点(首个 focusable=learnMore 链接)→
  //    改为 currentMode 对应的 radio 卡片,符合用户视觉预期
  //    (popover.tsx 已有 focus trap,只需覆盖 initial focus)
  // 2. 给 dialog 补 aria-modal="true",告诉 AT 弹层是模态
  //    (popover.tsx 有 role="dialog" + focus trap 但缺 aria-modal;
  //    按规则不能改 popover.tsx,在此上层补 A11y 语义,
  //    弹层关闭时 dialog div 被 unmount 自动清理 aria-modal)
  React.useEffect(() => {
    if (!isOpen) return
    const idx = MODE_OPTIONS_LIST.findIndex((o) => o.value === currentMode)
    radioRefs.current[idx]?.focus()
    // popover content 在 portal 里,用 querySelectorAll 找到 role=dialog 的节点
    // 由于此组件独占一个 popover,document 内 role=dialog 唯一,querySelectorAll 安全
    document.querySelectorAll('[role="dialog"]').forEach((d) => {
      d.setAttribute('aria-modal', 'true')
    })
  }, [isOpen, currentMode])

  const currentOption =
    MODE_OPTIONS_LIST.find((o) => o.value === currentMode) ?? MODE_OPTIONS_LIST[0]!
  const CurrentIcon = currentOption.icon
  const currentTitle = t(currentOption.titleKey)
  const hasWorkspace = !!activeWorkspace

  return (
    <Popover
      content={
        <div
          className="w-[360px] space-y-2"
          // 阻止 popover 内部 click 冒泡到 document(onKey 监听器在 document 上,
          // 若用户点击卡片,卡片自身 onClick 触发 handleSelect,不需要 document 再次处理)
        >
          {/* 顶部标题 + 了解更多链接(Codex 风格:左标题,右链接) */}
          <div className="flex items-start justify-between gap-2 px-1 pb-1">
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-foreground">{t('popoverTitle')}</span>
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

          {/* 三个模式单选卡片(键盘可聚焦) */}
          <div className="space-y-1.5" role="radiogroup" aria-label={t('popoverTitle')}>
            {MODE_OPTIONS_LIST.map((opt, idx) => {
              const Icon = opt.icon
              const isSel = opt.value === currentMode
              const isFocused = idx === focusedIndex
              return (
                <button
                  key={opt.value}
                  ref={(el) => {
                    radioRefs.current[idx] = el
                  }}
                  type="button"
                  role="radio"
                  aria-checked={isSel}
                  onClick={() => handleSelect(opt.value)}
                  onMouseEnter={() => setFocusedIndex(idx)}
                  disabled={updateMode.isPending}
                  className={cn(
                    'group relative flex w-full items-start gap-2.5 rounded-lg border p-2.5 text-left transition-colors',
                    'disabled:cursor-not-allowed disabled:opacity-60',
                    // 当前选中:实心高亮
                    isSel
                      ? 'border-primary/60 bg-primary/5'
                      : 'border-border hover:border-foreground/20 hover:bg-muted/30',
                    // 键盘聚焦但未选中:虚线 ring 提示(双重高亮:选中 + 聚焦)
                    isFocused &&
                      !isSel &&
                      'ring-1 ring-primary/40 ring-offset-1 ring-offset-popover',
                    // 高风险 + 选中:琥珀色边框强化警告
                    isSel && opt.risk === 'high' && 'border-amber-500/60 bg-amber-500/5',
                  )}
                >
                  <Icon
                    className={cn(
                      'mt-0.5 h-4 w-4 shrink-0',
                      isSel
                        ? opt.risk === 'high'
                          ? 'text-amber-500'
                          : 'text-primary'
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
                      {/* 数字快捷键徽章(Codex 风格:右侧 1/2/3) */}
                      <span
                        className="ml-auto inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-border bg-muted text-[9px] font-medium text-muted-foreground"
                        aria-hidden="true"
                      >
                        {idx + 1}
                      </span>
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
            {currentMode === 'bypass-permissions' && <Check className="h-3 w-3 text-amber-500" />}
          </button>

          {/* 键盘提示(2026-07-25 深化):底部小字,提醒用户可用 ↑/↓/Enter/1-3 键盘操作 */}
          <div className="flex items-center gap-1.5 px-1 pt-0.5 text-[10px] text-muted-foreground">
            <kbd className="rounded-sm border border-border bg-muted px-1 py-px font-mono text-[9px]">
              ↑
            </kbd>
            <kbd className="rounded-sm border border-border bg-muted px-1 py-px font-mono text-[9px]">
              ↓
            </kbd>
            <span>{t('kbdNavigate')}</span>
            <span className="ml-auto inline-flex items-center gap-0.5">
              <kbd className="rounded-sm border border-border bg-muted px-1 py-px font-mono text-[9px]">
                1
              </kbd>
              <kbd className="rounded-sm border border-border bg-muted px-1 py-px font-mono text-[9px]">
                2
              </kbd>
              <kbd className="rounded-sm border border-border bg-muted px-1 py-px font-mono text-[9px]">
                3
              </kbd>
            </span>
          </div>

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
      onOpenChange={setIsOpen}
    >
      <button
        type="button"
        disabled={disabled}
        aria-label={t('buttonLabel')}
        title={`${t('buttonLabel')} · ${t('buttonHintShortcut')}`}
        className={cn(
          // 2026-07-25 深化:加 duration-150 ease-out 让 bypass ↔ default ↔ accept-edits
          // 模式切换时背景色平滑过渡(原 transition-colors 无 duration 是瞬变)
          'inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors duration-150 ease-out',
          // 模式风险色:default=中性 / accept-edits=绿 / bypass=琥珀
          // 2026-07-25 深化:disabled 时(streaming)不应用 hover 类,防止 hover 变背景色
          currentMode === 'bypass-permissions'
            ? cn(
                'bg-amber-500/10 text-amber-700 dark:text-amber-400',
                !disabled && 'hover:bg-amber-500/15',
              )
            : currentMode === 'accept-edits'
              ? cn(
                  'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
                  !disabled && 'hover:bg-emerald-500/15',
                )
              : cn(
                  'bg-muted text-muted-foreground',
                  !disabled && 'hover:bg-accent hover:text-accent-foreground',
                ),
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
      >
        <CurrentIcon
          // 2026-07-25 深化:加 transition-colors duration-200 让图标颜色
          // 随 mode 切换平滑过渡(避免图标瞬变)
          className={cn(
            'h-3.5 w-3.5 shrink-0 transition-colors duration-200',
            currentMode === 'bypass-permissions' && 'text-amber-500',
            currentMode === 'accept-edits' && 'text-emerald-500',
            currentMode === 'default' && 'text-muted-foreground',
          )}
        />
        <span className="whitespace-nowrap">{currentTitle}</span>
        {/* 屏幕阅读器公告 mode 变化(2026-07-25 深化,A11y):
            trigger button 的 aria-label 是静态的(buttonLabel),聚焦时听不到 mode 变化;
            aria-live="polite" + aria-atomic="true" 的 sr-only span 在 currentTitle 变化时
            重新宣告完整 mode 名(不依赖新增 i18n 键,直接复用 t(mode.ask/auto/full)) */}
        <span className="sr-only" aria-live="polite" aria-atomic="true">
          {currentTitle}
        </span>
        {/* 高风险模式追加醒目的三角警告图标(2026-07-25 深化) */}
        {currentMode === 'bypass-permissions' && (
          <TriangleAlert className="h-3 w-3 shrink-0 text-amber-500" aria-hidden="true" />
        )}
        <Shield className="h-3 w-3 shrink-0 opacity-50" aria-hidden="true" />
      </button>
      {/* 首次启用高风险模式确认弹窗(2026-07-25 深化,深度对标 Codex CLI safety guard)
          - 统一由 message-input 渲染 FullAccessConfirmDialog(共享 store,Slash/Popover/Shift+Tab 共用)
          - 本组件只负责 setPendingFullAccess(true) 触发弹窗 */}
    </Popover>
  )
}

/** 暴露给 message-input / use-chat 等外部组件的高风险模式判断函数
 * 用于在 message-input 顶部加视觉警告横幅(顶性警告) + 输入框边框变色 */
export function isHighRiskPermissionMode(mode: WorkspacePermissionMode | undefined): boolean {
  return mode === 'bypass-permissions'
}

/** 切换并广播模式变更(2026-07-25 深化,/permission 斜杠命令专用)
 * - 复用 useAiPanelStore 的乐观更新逻辑
 * - 调用方负责 toast 反馈(因为斜杠命令上下文与 popover 上下文不同)
 * - 落库失败时回滚(由 useMutation 内部处理)
 *
 * 之所以单独导出此函数:permission-mode-popover.tsx 内的 handleSelect 是
 * 闭包闭包内部,无法被 use-chat.ts 复用;而 /permission 斜杠命令需要在
 * use-chat.ts 内触发模式切换(在用户已点发送后拦截)。
 */
export async function switchPermissionMode(
  mode: WorkspacePermissionMode,
): Promise<{ ok: boolean; previousMode: WorkspacePermissionMode | undefined; error?: string }> {
  const store = useAiPanelStore.getState()
  const previousMode = store.activeWorkspace?.mode
  if (mode === previousMode) {
    return { ok: true, previousMode }
  }
  // 乐观更新
  if (store.activeWorkspace) {
    store.setActiveWorkspace({ ...store.activeWorkspace, mode })
  } else {
    try {
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem('ihui-pending-permission-mode', mode)
      }
    } catch {
      // 静默
    }
  }
  // 落库
  if (store.activeWorkspace) {
    try {
      const res = await setWorkspacePermission({
        workspacePath: store.activeWorkspace.path,
        name: store.activeWorkspace.name,
        techStack: store.activeWorkspace.techStack?.join(','),
        mode,
        initializeDefaults: mode === 'accept-edits' && !store.activeWorkspace.mode,
      })
      if (!res.success) {
        // 回滚
        if (store.activeWorkspace && previousMode !== undefined) {
          store.setActiveWorkspace({ ...store.activeWorkspace, mode: previousMode })
        }
        return { ok: false, previousMode, error: res.error }
      }
    } catch (e: unknown) {
      if (store.activeWorkspace && previousMode !== undefined) {
        store.setActiveWorkspace({ ...store.activeWorkspace, mode: previousMode })
      }
      return {
        ok: false,
        previousMode,
        error: e instanceof Error ? e.message : String(e),
      }
    }
  }
  return { ok: true, previousMode }
}
