// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from '@/components/common'
import {
  Check,
  Compass,
  ExternalLink,
  Hand,
  Loader2,
  Pin,
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
// 权限档读侧归一(G-161/G-164):跨界拼写多套,显示与比较前先归一到 wire 拼写
import { permissionModeWire } from '@ihui/types/permission-mode'
// 权限档取词(G-166):档位归一与词表键的共享真相源,见 packages/shared/src/chat/permission-tier.ts

import {
  useSetWorkspacePermissionDefault,
  useWorkspacePermissionDefault,
} from '@/hooks/use-workspace-permissions'

import { Tooltip } from '@/components/feedback'
// 2026-09-15 治理:定位/portal/外点关闭逻辑统一收敛到 PortalPanel(此前手写一套
// createPortal + 坐标 + scroll/resize/RO 监听 + 外点关闭;Escape 关闭因需归还
// 焦点到 trigger 的特殊语义,仍由本组件自理)
import { PortalPanel } from '@/components/feedback/portal-panel'
import { useAiPanelStore } from '@/stores/ai-panel'
import { cn } from '@/lib/utils'
import { isTopOverlay, popOverlay, pushOverlay } from '@/lib/overlay-stack'
import { isFullAccessConfirmSuppressed } from './full-access-confirm-dialog'
import { permissionTierText } from '@/lib/permission-tier-text'

/** 层栈 id(见 @/lib/overlay-stack):本弹层的 Esc 只在栈顶时被消费 */
const PERMISSION_MODE_OVERLAY_ID = 'permission-mode-popover'

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

interface ModeOption {
  value: ModeValue
  icon: LucideIcon
  risk: 'low' | 'medium' | 'high'
}

// 移到组件外避免每次 render 重新创建(2026-07-25 深化)
//
// G-164 补 `plan` 档:共享类型 `WorkspacePermissionMode` 一直声明 4 档,而这里只给 3 档
// 入口、服务端 z.enum 又只收 3 档 —— 于是"只读计划"这一档**类型里有、界面上选不出、
// 接口也发不进**。而它恰好是竞品当主打的那个档位。现在按"由严到松"排序补在最前,
// 服务端 agent_loop_v2 / checkWorkspace 对 plan 已是硬只读(拒绝而非询问)。
// 档位名/说明不在此表(G-166):一律经 permissionTierText() 走共享词表,
// 以免端内再长出一套与 taro/extension 平行的键。
const MODE_OPTIONS_LIST: ModeOption[] = [
  { value: 'plan', icon: Compass, risk: 'low' },
  { value: 'default', icon: Hand, risk: 'low' },
  { value: 'accept-edits', icon: ShieldCheck, risk: 'medium' },
  { value: 'bypass-permissions', icon: ShieldAlert, risk: 'high' },
]

/** 撤销 toast 持续时间(ms)。给用户足够的"哎呀我点错了"反悔窗口 */
const UNDO_TOAST_DURATION = 5000

/** 普通提示 toast 持续时间(ms) */
const INFO_TOAST_DURATION = 3000

export function PermissionModePopover({ disabled }: { disabled?: boolean }) {
  const t = useTranslations('chat.permission')
  // G-166:档位名与说明改走跨端共享词表(permissionTier),端内私有键已退役
  const tTier = useTranslations()
  const tCommon = useTranslations('common')

  const activeWorkspace = useAiPanelStore((s) => s.activeWorkspace)
  // 未绑定工作区时暂存的权限模式(2026-08-31 修复按钮不响应 bug 的响应式数据源)
  const pendingPermissionMode = useAiPanelStore((s) => s.pendingPermissionMode)
  const queryClient = useQueryClient()

  // 当前生效模式:已绑定 → activeWorkspace.mode;未绑定 → 暂存模式;都没有 → default
  // (2026-08-31 修复:以前未绑定工作区时永远显示"请求批准",切换后按钮文字/样式不变)
  // P3 3-3 权限继承(2026-09-17 立):会话/暂存 → 用户全局默认 → 系统默认
  const userDefaultMode = useWorkspacePermissionDefault()
  // 读侧归一(G-164):三个来源里任何一个都可能送来非 kebab 拼写(用户全局默认走的是
  // 另一条接口,暂存值是本地状态)。不归一就是"当前档显示不出来"+ 焦点落错卡片。
  const currentMode: WorkspacePermissionMode =
    permissionModeWire(activeWorkspace?.mode ?? pendingPermissionMode ?? userDefaultMode) ??
    'default'

  // 弹层开关状态(由自定义 portal 接管,不再使用 Popover)
  const [isOpen, setIsOpen] = React.useState(false)
  // 键盘焦点索引(用于 ↑/↓ 循环切换焦点)。初始指向当前模式。
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
  // popover 只负责写 store.setPendingFullAccess(true) 触发弹窗(通过 getState 实时读,
  // 避免闭包陈旧),不需要在闭包外捕获这个 action。
  const focusedMode = MODE_OPTIONS_LIST[focusedIndex]?.value ?? currentMode
  const triggerRef = React.useRef<HTMLButtonElement | null>(null)

  React.useEffect(() => {
    if (!isOpen) return
    // 层栈:打开即入栈为栈顶;Esc 只由栈顶消费(与 context-usage / mention / 斜杠面板
    // 等多层同时打开时,一次 Esc 不再把所有层一起关掉)
    pushOverlay(PERMISSION_MODE_OVERLAY_ID)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!isTopOverlay(PERMISSION_MODE_OVERLAY_ID)) return
        // Escape 关闭后归还焦点到 trigger，符合 A11y 预期（2026-08-31 P2 修复）
        triggerRef.current?.focus()
        setIsOpen(false)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      popOverlay(PERMISSION_MODE_OVERLAY_ID)
      document.removeEventListener('keydown', onKey)
    }
  }, [isOpen])

  const updateMode = useMutation({
    mutationFn: async (mode: WorkspacePermissionMode) => {
      // 始终从 store 实时读取工作区,避免闭包陈旧导致落库信息错误(2026-08-17 修复)
      const store = useAiPanelStore.getState()
      const currentWs = store.activeWorkspace
      if (!currentWs) return null
      const res = await setWorkspacePermission({
        workspacePath: currentWs.path,
        name: currentWs.name,
        techStack: currentWs.techStack?.join(','),
        mode,
        // accept-edits 模式 + 首次设置 → 初始化预置安全模板
        initializeDefaults: mode === 'accept-edits' && !currentWs.mode,
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

  // P3 3-3 权限继承:把当前模式设为用户全局默认(未显式配置的工作区将沿用)
  const setDefault = useSetWorkspacePermissionDefault()

  /** 切换模式(核心逻辑,2026-07-25 深化)
   * 1. 同模式 → noop
   * 2. 乐观更新 store(立即反馈)
   * 3. mutation 落库,失败回滚
   * 4. 切到 bypass-permissions → 弹 5s 撤销 toast
   * 5. 切到 accept-edits → 弹持久化视觉警告横幅(toast 较轻,只提醒一次)
   */
  const handleSelect = React.useCallback(
    (mode: WorkspacePermissionMode) => {
      // 始终从 store 实时读取最新模式,避免闭包陈旧导致切换失效(2026-08-17 修复)
      // 2026-08-31:未绑定工作区时也读取暂存模式(pendingPermissionMode),否则无法切回 default
      const store = useAiPanelStore.getState()
      const currentMode =
        permissionModeWire(store.activeWorkspace?.mode ?? store.pendingPermissionMode) ?? 'default'
      if (mode === currentMode) return
      if (updateMode.isPending) return // 防止快速连点
      // 切到 bypass-permissions + 首次启用 + 未静默 → 弹确认弹窗(2026-07-25 深化)
      // 用户必须勾选"我了解"才能点"继续启用",防止误操作
      // 通过 ai-panel store 共享状态,message-input 监听并渲染 FullAccessConfirmDialog
      if (mode === 'bypass-permissions' && !isFullAccessConfirmSuppressed()) {
        setIsOpen(false) // 关闭 popover，避免与二次确认窗重叠(2026-08-31 修复)
        store.setPendingFullAccess(true)
        return
      }
      const previousMode: WorkspacePermissionMode | undefined =
        store.activeWorkspace?.mode ?? store.pendingPermissionMode ?? undefined
      const previousPath = store.activeWorkspace?.path
      // 乐观更新:立即写 store,失败回滚
      if (store.activeWorkspace) {
        store.setActiveWorkspace({ ...store.activeWorkspace, mode })
      } else {
        // 未绑定工作区:写入 store 响应式暂存(2026-08-31 修复)
        // 以前写 sessionStorage,但按钮不读它 → 切换后按钮永远显示"请求批准"
        store.setPendingPermissionMode(mode)
      }
      updateMode.mutate(mode, {
        onError: (err) => {
          const current = useAiPanelStore.getState().activeWorkspace
          // 回滚保护:仅当工作区未切换时才回滚,避免把旧工作区模式写到新工作区(2026-08-31 修复)
          if (current && previousMode !== undefined && current.path === previousPath) {
            useAiPanelStore.getState().setActiveWorkspace({ ...current, mode: previousMode })
          }
          // 切模式失败 → 错误 toast(2026-07-25 深化,与 cyclePermissionMode 行为一致)
          // 复用 cycleError key,避免再增 1 个仅 popover 用的 key 引起 i18n 噪声
          toast.error(t('cycleError', { error: err instanceof Error ? err.message : String(err) }))
        },
        onSuccess: () => {
          // 切到完全访问(bypass-permissions)→ 弹 5s 撤销 toast,防误操作
          if (mode === 'bypass-permissions' && previousMode) {
            toast(t('switchedToFull'), {
              description: t('switchedToFullDesc', { prev: previousMode }),
              duration: UNDO_TOAST_DURATION,
              action: {
                label: t('undo'),
                onClick: async () => {
                  // 实时读取 store 避免 stale closure(2026-08-31 修复)
                  // 仅当仍是完全访问(含未绑定工作区的暂存模式)时才撤销
                  const currentStore = useAiPanelStore.getState()
                  const nowMode =
                    currentStore.activeWorkspace?.mode ?? currentStore.pendingPermissionMode
                  if (nowMode === 'bypass-permissions') {
                    await switchPermissionMode(previousMode ?? 'default')
                  }
                },
              },
            })
          } else if (mode === 'accept-edits') {
            // 切到 accept-edits → 普通提示(无撤销,误操作风险低)
            toast.success(t('switchedToAuto'), {
              description: t('switchedToAutoDesc'),
              duration: INFO_TOAST_DURATION,
            })
          } else if (mode === 'default' && previousMode === 'bypass-permissions') {
            // 从高风险切回默认 → 确认反馈
            toast.success(t('switchedToAsk'), {
              description: t('switchedToAskDesc'),
              duration: INFO_TOAST_DURATION,
            })
          }
        },
      })
    },
    // 不依赖 activeWorkspace/currentMode,全部实时从 store 读取,避免陈旧闭包
    // (setPendingFullAccess 通过 getState() 实时调用,不在 deps 中)
    [updateMode, t],
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
  const currentTitle = permissionTierText(currentMode, tTier).title
  const hasWorkspace = !!activeWorkspace

  return (
    <div className="flex min-w-0">
      <Tooltip content={currentTitle}>
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          aria-label={`${t('buttonLabel')} · ${t('buttonHintShortcut')}`}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          // 与 Radix trigger 行为对齐(2026-09-02):本组件自写 popover 而非 Radix,
          // 需手动加 data-state 才能命中 globals.css:1090 的
          // `button[data-state='closed']:focus-visible { box-shadow: none }` 抑制规则,
          // 否则 Esc 关闭后 triggerRef.current?.focus() 触发 focus-visible ring(本组件
          // 无显式 focus-visible:ring,但 globals.css 规则对未来扩展可主动失效 ring)。
          data-state={isOpen ? 'open' : 'closed'}
          className={cn(
            'inline-flex h-8 min-w-0 items-center gap-1.5 rounded-md px-2 text-xs font-medium leading-none',
            'duration-150 ease-out',
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
          )}
          onClick={() => setIsOpen((prev) => !prev)}
        >
          <CurrentIcon
            className={cn(
              'h-3.5 w-3.5 shrink-0 transition-colors duration-200',
              currentMode === 'bypass-permissions' && 'text-amber-500',
              currentMode === 'accept-edits' && 'text-emerald-500',
              currentMode === 'default' && 'text-muted-foreground',
            )}
          />
          <span className="min-w-0 truncate">{currentTitle}</span>
          {currentMode === 'bypass-permissions' && (
            <TriangleAlert className="h-3 w-3 shrink-0 text-amber-500" aria-hidden="true" />
          )}
          <Shield className="h-3 w-3 shrink-0 opacity-50" aria-hidden="true" />
        </button>
      </Tooltip>
      {/* 首次启用高风险模式确认弹窗(2026-07-25 深化,深度对标 Codex CLI safety guard)
          - 统一由 message-input 渲染 FullAccessConfirmDialog(共享 store,Slash/Popover/Shift+Tab 共用)
          - 本组件只负责 setPendingFullAccess(true) 触发弹窗 */}
      <PortalPanel
        open={isOpen}
        anchorRef={triggerRef}
        onClose={() => setIsOpen(false)}
        side="top"
        align="end"
        gap={8}
        className="w-[min(360px,calc(100vw-2rem))] rounded-md border bg-popover p-3 text-popover-foreground shadow-md"
      >
        {/* dialog 语义与焦点属性保留在内容层(PortalPanel 容器只负责定位,
            不透传 aria 属性与 tabIndex;与原 panel div 属性一致,行为等价) */}
        <div
          role="dialog"
          aria-label={t('popoverTitle')}
          aria-modal="true"
          tabIndex={-1}
          className="space-y-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
              const tierText = permissionTierText(opt.value, tTier)
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
                    'group relative flex w-full items-start gap-2.5 rounded-lg p-2.5 text-left transition-colors',
                    'disabled:cursor-not-allowed disabled:opacity-60',
                    // 当前选中:实心高亮
                    isSel
                      ? cn(
                          'bg-primary/5',
                          // 高风险:琥珀色 outline(替代普通 border,避免双层边框)
                          opt.risk === 'high'
                            ? 'outline outline-1 outline-amber-500/60 dark:outline-amber-500/60 bg-amber-500/5'
                            : 'border border-primary/60',
                        )
                      : cn(
                          'border border-border',
                          isFocused && 'border-ring/60',
                          opt.risk === 'high'
                            ? 'hover:border-red-500/80 hover:bg-red-500/5'
                            : 'hover:border-foreground/20 hover:bg-muted/30',
                        ),
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
                        {tierText.title}
                      </span>
                      {opt.risk === 'high' && (
                        <span className="rounded-sm bg-amber-500/10 px-1 py-px text-[9px] font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400">
                          {t('highRisk')}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                      {tierText.desc}
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
            <span className="flex-1 min-w-0 text-xs font-medium text-amber-700 dark:text-amber-400">
              {t('quickFullAccess')}
            </span>
            {currentMode === 'bypass-permissions' && <Check className="h-3 w-3 text-amber-500" />}
          </button>

          {/* P3 3-3 权限继承:把当前模式设为用户全局默认(未显式配置的工作区沿用) */}
          <Tooltip content={t('setDefaultHint')}>
            <span className="inline-flex w-full">
              <button
                type="button"
                onClick={() => {
                  setDefault.mutate(currentMode, {
                    onSuccess: () =>
                      toast.success(t('setDefaultDone'), { duration: INFO_TOAST_DURATION }),
                    onError: () =>
                      toast.error(t('setDefaultFailed'), { duration: INFO_TOAST_DURATION }),
                  })
                }}
                disabled={setDefault.isPending || activeWorkspace?.mode === currentMode}
                data-testid="permission-set-default"
                className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-[11px] text-muted-foreground transition-colors hover:bg-muted/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {setDefault.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Pin className="h-3 w-3 shrink-0" />
                )}
                {t('setAsDefault')}
              </button>
            </span>
          </Tooltip>

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
      </PortalPanel>
    </div>
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
  // 并发锁：防止快速连点导致状态竞态(2026-08-31 修复)
  if (switchPermissionMode._pending) {
    const store = useAiPanelStore.getState()
    return { ok: true, previousMode: store.activeWorkspace?.mode }
  }
  switchPermissionMode._pending = true
  try {
    const store = useAiPanelStore.getState()
    // 2026-08-31:未绑定工作区时从暂存模式读取,否则误判"模式未变"直接跳过切换
    const previousMode: WorkspacePermissionMode | undefined =
      store.activeWorkspace?.mode ?? store.pendingPermissionMode ?? undefined
    const previousPath = store.activeWorkspace?.path
    if (mode === previousMode) {
      return { ok: true, previousMode }
    }
    // 乐观更新
    if (store.activeWorkspace) {
      store.setActiveWorkspace({ ...store.activeWorkspace, mode })
    } else {
      // 未绑定工作区:写入 store 响应式暂存(2026-08-31 修复,替代非响应式的 sessionStorage)
      store.setPendingPermissionMode(mode)
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
        if (res.success === false) {
          // 回滚：仅当工作区未切换时才回滚，避免把新模式覆盖到用户刚切到的新工作区
          const current = useAiPanelStore.getState()
          if (current.activeWorkspace?.path === previousPath && previousMode !== undefined) {
            current.setActiveWorkspace({ ...current.activeWorkspace!, mode: previousMode })
          } else if (!current.activeWorkspace) {
            // 未绑定工作区:回滚暂存模式(2026-08-31 修复)
            current.setPendingPermissionMode(previousMode ?? null)
          }
          return { ok: false, previousMode, error: res.error }
        }
      } catch (e: unknown) {
        const current = useAiPanelStore.getState()
        if (current.activeWorkspace?.path === previousPath && previousMode !== undefined) {
          current.setActiveWorkspace({ ...current.activeWorkspace!, mode: previousMode })
        } else if (!current.activeWorkspace) {
          // 未绑定工作区:回滚暂存模式(2026-08-31 修复)
          current.setPendingPermissionMode(previousMode ?? null)
        }
        const error = e instanceof Error ? e.message : String(e)
        return { ok: false, previousMode, error }
      }
    }
    return { ok: true, previousMode }
  } finally {
    switchPermissionMode._pending = false
  }
}
// 并发锁状态
switchPermissionMode._pending = false as boolean
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
