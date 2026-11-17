// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
import { MENU_ITEM_CLASS, MENU_ITEM_ICON_CLASS } from '@/lib/menu-item'
import { isTopOverlay, popOverlay, pushOverlay } from '@/lib/overlay-stack'
import { Checklist, type ChecklistItemData } from './checklist'
import { FAILURE_KIND_META, FAILURE_SOURCE_LABEL } from './failure-kind-meta'
import { toolArgsSummary } from './tool-args-summary'
import {
  SUBAGENT_COLOR_CLASS,
  type Subagent,
  type SubagentStatus,
} from '@/hooks/use-agent-progress'
import { formatDuration } from './foldable-section'
import { formatTokenCount } from '@ihui/shared/utils'
import { useLiveElapsed } from '@/components/chat/stream/stream-ui'

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

// ─── 深化D/J(2026-11-17):失败归因分类可视化 ──
// 元数据抽到共享模块 failure-kind-meta.ts(单一真相源),活跃渲染与批次聚合层共用,防两处文案漂移。

// ─── 深化K(2026-11-17):失败来源标签 ──
// failureSource 是**独立维度**(与 failureKind 正交):
//   failureSource = 失败发生在哪个环节(provider/runtime/network/tool)
//   failureKind   = 失败的具体类型(rate_limited/credentials_rejected/...)
// 标签表已抽到共享模块 failure-kind-meta.ts(单一真相源,与聚合层共用),本组件 import 使用。

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
  // 层栈身份:同组件多实例互不相同
  const autoId = React.useId()
  const stackId = `sub-agent-task-tree-menu:${autoId}`

  const StatusIcon = STATUS_ICON[subagent.status] ?? Clock
  const colorCls = SUBAGENT_COLOR_CLASS[subagent.color]

  const tools = subagent.tools ?? []

  // 改进A(2026-11-17):运行时实时秒表(useLiveElapsed),结束后由后端权威 durationMs 接管。
  const isRunning = subagent.status === 'running' || subagent.status === 'spawned'
  const liveElapsedMs = useLiveElapsed(isRunning, subagent.durationMs ?? null)

  // 改进B(2026-11-17):细粒度阶段进度 —— 消费 Subagent.progressPhase/progressIteration/progressTool
  // (由 use-agent-progress.ts extractSubagentsFromEvents 从 subagent_progress SSE 帧实时写入)。
  const PHASE_LABEL: Record<NonNullable<Subagent['progressPhase']>, string> = {
    thinking: '思考中',
    tool_call: '调用工具',
    tool_result: '工具结果',
    output_ready: '输出就绪',
  }
  // 深化D:失败归因分类(已知桶才出徽章+处置提示;unknown/缺席为 undefined)
  const failureMeta =
    subagent.failureKind && subagent.failureKind in FAILURE_KIND_META
      ? FAILURE_KIND_META[subagent.failureKind]
      : undefined
  // 深化E:工具调用累计次数 —— 优先用后端权威 toolCalls,缺省回退嵌套 tools 列表长度
  const toolCallCount = subagent.toolCalls ?? subagent.tools?.length ?? 0
  // 深化F:弱证据失败标记 —— failureAttributionStrong=false 表示归因来自弱文案(猜测),
  // 真相源存疑,提示用户"待确认",不让猜测伪装成确定结论。
  const weakAttribution =
    subagent.failureReason !== undefined && subagent.failureAttributionStrong === false
  // 深化H:工具调用成功率 —— 从嵌套 tools 列表按 status 统计(成功/失败/总数)。
  // 注意:只统计有终态的(success/error),running/cancelled 不计入分母,避免把进行中当失败。
  const toolStats = React.useMemo(() => {
    const tools = subagent.tools ?? []
    const total = tools.length
    if (total === 0) return null
    const success = tools.filter((t) => t.status === 'success').length
    const error = tools.filter((t) => t.status === 'error').length
    const finished = success + error // 有终态的才进分母
    if (finished === 0) return { total, success, error, rate: null }
    return { total, success, error, rate: Math.round((success / finished) * 100) }
  }, [subagent.tools])
  const checklistItems: ChecklistItemData[] = tools.map((tool) => {
    // 深化P(2026-11-17):参数一句话摘要 —— 折叠态即可见"读哪个文件/跑什么命令/搜什么词"。
    // 摘要缺席(取不到有意义参数)时回退纯耗时,不造残标。
    const summary = toolArgsSummary(tool.toolName, tool.args)
    const metaParts: string[] = []
    if (summary) metaParts.push(summary)
    if (tool.durationMs !== undefined) metaParts.push(formatDuration(tool.durationMs))
    return {
      id: tool.id,
      label: tool.toolName,
      status:
        tool.status === 'success'
          ? 'completed'
          : tool.status === 'error'
            ? 'failed'
            : 'in_progress',
      meta: metaParts.length > 0 ? metaParts.join(' · ') : undefined,
      description: tool.error ? `失败: ${tool.error}` : undefined,
    }
  })

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
    // 层栈注册:menu.visible → 入栈(成为栈顶);close/unmount → 出栈。
    pushOverlay(stackId)
    const onMouseDown = (e: MouseEvent) => {
      const el = menuRef.current
      if (el && !el.contains(e.target as Node)) closeMenu()
    }
    const onContextMenu = (e: MouseEvent) => {
      const el = containerRef.current
      if (el && !el.contains(e.target as Node)) closeMenu()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // 只让栈顶那一层消费 Esc:多层同时打开时,一次 Esc 关最上层
        if (!isTopOverlay(stackId)) return
        closeMenu()
      }
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
      popOverlay(stackId)
    }
  }, [menu.visible, closeMenu, stackId])

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative space-y-0.5 rounded-md border border-stroke-subtle bg-card/30 p-1.5',
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
        className="flex w-full items-center gap-1.5 rounded-sm px-2 py-1 text-left transition-colors hover:bg-accent/30"
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
        {/* 深化C:角色徽章 —— 子代理类型/职责一眼可辨(mcp 层只给角色名时尤其有用) */}
        {subagent.role && (
          <span className="shrink-0 rounded-sm bg-muted/60 px-1 py-0.5 text-[10px] text-muted-foreground/70">
            {subagent.role}
          </span>
        )}
        {/* 深化C:待审批高亮 —— 子代理卡在等人工批准时,折叠行立刻显性提示,不用展开才发现 */}
        {subagent.pendingApproval && (
          <span className="shrink-0 animate-pulse rounded-sm bg-amber-500/15 px-1 py-0.5 text-[10px] text-amber-600">
            待审批
          </span>
        )}
        <span className="flex-1" />
        {subagent.currentTask && (
          <span className="hidden truncate text-[10px] text-muted-foreground/60 min-[1024px]:inline">
            {subagent.currentTask}
          </span>
        )}
        {/* 深化L(2026-11-17):折叠行内联阶段徽章 —— 运行中子代理不展开也能看到"当前在哪个阶段"。
            多子代理并行时扫一眼即知各自进度;与折叠区内的详细进度行同源(PHASE_LABEL),不重复造文案。
            progressPhase 缺席(后端未发 progress 帧)时不造残标。 */}
        {isRunning && subagent.progressPhase && (
          <span className="shrink-0 rounded-sm bg-primary/10 px-1 py-0.5 text-[10px] font-medium text-primary/90">
            {PHASE_LABEL[subagent.progressPhase]}
          </span>
        )}
        {/* 改进A:运行时显示实时秒表(liveElapsedMs),结束后显示后端权威 durationMs */}
        {liveElapsedMs !== null && (
          <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/60">
            {formatDuration(liveElapsedMs)}
          </span>
        )}
        {subagent.tokenUsage !== undefined && subagent.tokenUsage > 0 && (
          <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/60">
            {formatTokenCount(subagent.tokenUsage)} tok
          </span>
        )}
        {/* 深化E:工具调用累计次数 —— 一眼看出子代理做了多少轮工具调用(与 tools.length 同步) */}
        {toolCallCount > 0 && (
          <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/60">
            {toolCallCount}次
          </span>
        )}
        {/* 深化S(2026-11-17):工具失败预警徽章 —— 折叠行直接预警"工具有失败",免展开。
            深化H 的成功率只在展开后可见;有失败(error>0)时折叠行就亮红色预警,
            用户扫一眼折叠列表就知道哪个子代理的工具调用大面积出错。仅 error>0 时造标。 */}
        {toolStats !== null && toolStats.error > 0 && (
          <span
            className="shrink-0 rounded-sm bg-red-500/10 px-1 py-0.5 text-[10px] font-medium tabular-nums text-red-500/90"
            data-testid={`subagent-tool-fail-flag-${subagent.id}`}
          >
            工具 {toolStats.error}/{toolStats.total} 失败
          </span>
        )}
      </button>

      {subagent.failureReason && (
        <div className="ml-4 space-y-0.5 text-[10px] text-destructive/80">
          <div className="flex items-start gap-1">
            <AlertCircle className="mt-0.5 h-2.5 w-2.5 shrink-0" aria-hidden />
            <span className="break-all">{subagent.failureReason}</span>
          </div>
          {/* 深化D:失败归因分类 + 处置提示 —— 告诉用户"该等还是该改",这是失败时最想知道的。
              failureKind 缺席或 unknown(不在已知桶)时不造残标。 */}
          {/* 深化D+K:失败来源(failureSource)—— 用户失败第一想知道"哪一环出的问题",
              与 failureKind 正交,两维并存。缺席时不造残标。 */}
          {failureMeta && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 pl-3.5">
              {/* 深化K:failureSource 标签 —— 独立于 failureKind,回答"是上游/网络/本地?" */}
              {subagent.failureSource && FAILURE_SOURCE_LABEL[subagent.failureSource] && (
                <span className="shrink-0 rounded-sm border border-stroke-subtle px-1 py-0.5 text-muted-foreground">
                  {FAILURE_SOURCE_LABEL[subagent.failureSource]}
                </span>
              )}
              <span
                className={cn(
                  'shrink-0 rounded-sm bg-muted/60 px-1 py-0.5 font-medium',
                  failureMeta.tone,
                )}
              >
                {failureMeta.label}
              </span>
              <span className={failureMeta.tone}>→ {failureMeta.advice}</span>
            </div>
          )}
          {/* 深化F:弱证据标记 —— 归因来自弱文案(非状态码/稳定错误码)时标"待确认",
              不让猜测伪装成确定结论(真相源存疑就该说出来)。 */}
          {weakAttribution && (
            <div className="pl-3.5 text-amber-500/80">ⓘ 归因来自间接线索,仅供参考(待确认)</div>
          )}
        </div>
      )}

      {!collapsed && checklistItems.length > 0 && (
        <div className="ml-4 border-l border-stroke-subtle pl-2 pt-1">
          <div className="mb-1 inline-flex items-center gap-1.5 text-[10px] text-muted-foreground/60">
            <Wrench className="h-2.5 w-2.5" aria-hidden />
            工具调用 ({checklistItems.length})
            {/* 深化H:工具调用成功率 —— 只在有终态(success/error)的工具时显示,全 running 不造残标 */}
            {toolStats?.rate !== null && toolStats?.rate !== undefined && (
              <span
                className={cn(
                  'shrink-0 rounded-sm px-1 py-0.5 font-medium tabular-nums',
                  toolStats.error > 0
                    ? 'bg-red-500/10 text-red-500/90'
                    : 'bg-emerald-500/10 text-emerald-600',
                )}
                data-testid={`subagent-tool-success-rate-${subagent.id}`}
              >
                成功率 {toolStats.rate}%
              </span>
            )}
          </div>
          <Checklist items={checklistItems} dense />
        </div>
      )}

      {!collapsed && subagent.currentTask && (
        <div className="ml-4 flex items-start gap-1 border-l border-stroke-subtle pl-2 text-[10px] text-muted-foreground/70">
          <span className="shrink-0">→</span>
          <span className="break-all">{subagent.currentTask}</span>
        </div>
      )}

      {/* 改进B:细粒度进度行 —— 运行中显示 阶段 + 轮次 + 工具名,与折叠行 currentTask 摘要不重复 */}
      {!collapsed && subagent.progressPhase && isRunning && (
        <div className="ml-4 flex flex-wrap items-center gap-x-3 gap-y-0.5 border-l border-stroke-subtle pl-2 pt-0.5 text-[10px] text-muted-foreground/70">
          <span>
            <span className="shrink-0">阶段 </span>
            <span className="text-primary/80">{PHASE_LABEL[subagent.progressPhase]}</span>
          </span>
          {subagent.progressIteration !== undefined && (
            <span>
              <span className="shrink-0">轮次 </span>
              <span className="tabular-nums">{subagent.progressIteration}</span>
            </span>
          )}
          {subagent.progressTool && (
            <span>
              <span className="shrink-0">工具 </span>
              <span className="break-all font-mono">{subagent.progressTool}</span>
            </span>
          )}
        </div>
      )}

      {/* 深化C:实时输出预览 —— 子代理阶段性输出片段(后端 output_preview 截断 200 字符)。
          运行中渐进补全,让用户不展开别的面板也能看到子代理此刻在产出什么。 */}
      {!collapsed && subagent.outputPreview && subagent.outputPreview.length > 0 && (
        <div className="ml-4 rounded-sm bg-background/60 p-1.5">
          <pre className="max-h-24 overflow-auto whitespace-pre-wrap break-all font-mono text-[10px] leading-relaxed text-muted-foreground/80">
            {subagent.outputPreview}
          </pre>
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
            'fixed z-popover min-w-[180px] rounded-md border border-stroke-strong bg-popover p-1 text-popover-foreground shadow-elevation-md',
            'animate-in fade-in-0 zoom-in-95 duration-(--duration-unified) ease-unified',
          )}
          style={{ left: menuPos.x, top: menuPos.y }}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => void onMenuClick('threadId')}
            data-testid="subagent-context-menu-copy-threadId"
            className={MENU_ITEM_CLASS}
          >
            <Hash className={MENU_ITEM_ICON_CLASS} aria-hidden />
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
            className={MENU_ITEM_CLASS}
          >
            <AtSign className={MENU_ITEM_ICON_CLASS} aria-hidden />
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
            className={MENU_ITEM_CLASS}
          >
            <User className={MENU_ITEM_ICON_CLASS} aria-hidden />
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
            className={MENU_ITEM_CLASS}
          >
            <FileText className={MENU_ITEM_ICON_CLASS} aria-hidden />
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

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
