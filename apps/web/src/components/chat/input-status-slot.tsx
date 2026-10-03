// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

// A 节 单状态槽(2026-09-30 立,深度对标二轮;对标 Cursor/Trae 输入区状态单槽轮流显示)。
//
// 输入卡上方原本同时挂 6 个互不知情的通知条(断连 / 下行告警 / MCP / 润色保稿 /
// diff 意见 / 额度),同时激活时纵向堆出 5-6 行 chrome,把输入框挤到视野外。
// 本槽把它们的**激活判定**收进来,按优先级只展开一条:
//   断连 > 下行告警 > MCP > 润色保稿 > diff 意见 > 额度
// 其余活跃条折叠成右下角 +N 徽章,点开弹层可手动切换展开哪条(粘性选择:该条
// 再次激活时仍按用户上次的选择展开)。
//
// 纪律:
//  - 激活判定**复用各组件文件导出的唯一判据**(selectVisibleMcpStatuses /
//    isPromptPolishNoticeActive / isAbnormalConnectionState…),不另写第二套;
//  - 展开渲染的是原组件本身,原 testid 逐字保留(connection-status-bar /
//    stream-alert-bar / mcp-status-notice / prompt-polish-notice /
//    diff-comments-bar / context-budget-bar),本槽只新增 input-status-slot /
//    input-status-slot-badge / input-status-slot-panel / input-status-slot-item-*;
//  - 各条根节点自带的 mx-4 / mb-2 已上收(间距由槽统一接管,与统一上下文容器同纪律);
//  - 高风险横幅 / 任务状态条 / 队列交互条不进槽(它们是行动号召,不是被动状态);
//  - ConnectionStatusBar 被折叠(未挂载)期间,它的 isStreaming true→false 清账
//    effect 不在树上 —— 槽内复制同一份清账 effect 兜底(setSignal 等值幂等,双挂无害)。

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { AlertTriangle, Gauge, MessageSquareText, PlugZap, Wand2, WifiOff } from 'lucide-react'

import type { PromptPolishState } from '@ihui/shared/chat/prompt-polish'

import { useChatStore } from '@/stores/chat'
import { useMcpStatusBroadcast } from '@/hooks/use-mcp-status-broadcast'
import {
  getBudgetEvent,
  getBudgetEventServerSnapshot,
  subscribeBudgetEvent,
} from '@/hooks/use-chat/budget-state'
import {
  STREAM_ALERT_KINDS,
  getStreamAlerts,
  getStreamAlertsServerSnapshot,
  subscribeStreamAlerts,
} from '@/hooks/use-chat/stream-alerts'
import { deriveConnectionState, type ConnectionState } from '@/components/ai/progress-sections/connection-status'
import { PortalPanel } from '@/components/feedback/portal-panel'

import {
  clearStreamConnection,
  ConnectionStatusBar,
  isAbnormalConnectionState,
  useStreamConnectionSignal,
} from './connection-status-bar'
import { StreamAlertBar } from './stream-alert-bar'
import { McpStatusNotice, selectVisibleMcpStatuses } from './mcp-status-notice'
import { isPromptPolishNoticeActive, PromptPolishNotice } from './prompt-polish-notice'
import { DiffCommentsBar } from './diff-comments-bar'
import { ContextBudgetBar } from './context-budget-bar'

/** 优先级从高到低(数组序即展示优先序) */
type StatusKind = 'connection' | 'alerts' | 'mcp' | 'polish' | 'diff' | 'budget'

/** 每源固定 lucide 图标(禁止 emoji;弹层行用) */
const STATUS_KIND_ICON: Record<StatusKind, React.ComponentType<{ className?: string }>> = {
  connection: WifiOff,
  alerts: AlertTriangle,
  mcp: PlugZap,
  polish: Wand2,
  diff: MessageSquareText,
  budget: Gauge,
}

/** 弹层行标签一律 switch + 字面量 t() 键(死 key 扫描按字面量对账,禁动态拼键) */
function statusSlotLabelKey(
  kind: StatusKind,
): 'statusSlot.connection' | 'statusSlot.alerts' | 'statusSlot.mcp' | 'statusSlot.polish' | 'statusSlot.diff' | 'statusSlot.budget' {
  switch (kind) {
    case 'connection':
      return 'statusSlot.connection'
    case 'alerts':
      return 'statusSlot.alerts'
    case 'mcp':
      return 'statusSlot.mcp'
    case 'polish':
      return 'statusSlot.polish'
    case 'diff':
      return 'statusSlot.diff'
    case 'budget':
      return 'statusSlot.budget'
  }
}

export interface InputStatusSlotProps {
  /** 主对话流的运行标志(ConnectionStatusBar 同名 prop 透传) */
  isStreaming: boolean
  /** 当前会话标识(null ⇒ 不谈"连着",connection 判 inactive) */
  threadId: string | null
  /** D82 润色状态机(宿主持有;槽只读 + 透传重试) */
  polish: PromptPolishState
  onPolishRetry: () => void
}

export function InputStatusSlot({
  isStreaming,
  threadId,
  polish,
  onPolishRetry,
}: InputStatusSlotProps) {
  const t = useTranslations('chat')
  const [manual, setManual] = React.useState<StatusKind | null>(null)
  const [panelOpen, setPanelOpen] = React.useState(false)
  const badgeRef = React.useRef<HTMLButtonElement>(null)

  // —— 六源激活判定(全部无条件订阅,hooks 顺序稳定) ——
  const connSignal = useStreamConnectionSignal()
  const alerts = React.useSyncExternalStore(
    subscribeStreamAlerts,
    getStreamAlerts,
    getStreamAlertsServerSnapshot,
  )
  const { statuses: mcpStatuses } = useMcpStatusBroadcast()
  const hasDiff = useChatStore((s) => s.pendingDiffComments.length > 0)
  const budgetEvent = React.useSyncExternalStore(
    subscribeBudgetEvent,
    getBudgetEvent,
    getBudgetEventServerSnapshot,
  )

  const connShown: ConnectionState | null = threadId
    ? deriveConnectionState(
        isStreaming,
        connSignal.attempt,
        connSignal.state === 'disconnected' || (connSignal.error !== null && connSignal.error !== undefined),
        threadId,
      )
    : null
  const hasConn = connShown !== null && isAbnormalConnectionState(connShown)
  const hasAlerts = STREAM_ALERT_KINDS.some((kind) => alerts[kind] !== null)
  const hasMcp = selectVisibleMcpStatuses(mcpStatuses).length > 0
  const hasPolish = isPromptPolishNoticeActive(polish)
  const hasBudget = budgetEvent !== null

  const activeKinds: StatusKind[] = []
  if (hasConn) activeKinds.push('connection')
  if (hasAlerts) activeKinds.push('alerts')
  if (hasMcp) activeKinds.push('mcp')
  if (hasPolish) activeKinds.push('polish')
  if (hasDiff) activeKinds.push('diff')
  if (hasBudget) activeKinds.push('budget')

  // 兜底清账:ConnectionStatusBar 被折叠(未挂载)期间它自己的清账 effect 不在树上,
  // 这里复刻同一份判定(断开态不清 —— 它的生产者就是"流以错误结束"这一刻)。
  const wasStreamingRef = React.useRef(isStreaming)
  React.useEffect(() => {
    if (wasStreamingRef.current && !isStreaming && connSignal.state !== 'disconnected') {
      clearStreamConnection()
    }
    wasStreamingRef.current = isStreaming
  }, [isStreaming, connSignal.state])

  if (activeKinds.length === 0) return null

  // 粘性手动选择:manual 指向的条一旦失活自动回落优先级序;再激活时恢复用户选择
  // (?? 'connection' 仅为 noUncheckedIndexedAccess 收窄,上方 length===0 已早退,不会触达)
  const expanded: StatusKind =
    manual !== null && activeKinds.includes(manual) ? manual : (activeKinds[0] ?? 'connection')
  const others = activeKinds.filter((k) => k !== expanded)

  const notice = (() => {
    switch (expanded) {
      case 'connection':
        return <ConnectionStatusBar isStreaming={isStreaming} threadId={threadId} />
      case 'alerts':
        return <StreamAlertBar />
      case 'mcp':
        return <McpStatusNotice />
      case 'polish':
        return <PromptPolishNotice state={polish} onRetry={onPolishRetry} />
      case 'diff':
        return <DiffCommentsBar />
      case 'budget':
        return <ContextBudgetBar />
    }
  })()

  return (
    <div data-testid="input-status-slot" data-expanded={expanded} className="mb-2 flex flex-col gap-1">
      {notice}
      {others.length > 0 && (
        <div className="flex justify-end">
          <button
            type="button"
            ref={badgeRef}
            data-testid="input-status-slot-badge"
            aria-label={t('statusSlot.moreNotices', { count: others.length })}
            onClick={() => setPanelOpen((v) => !v)}
            className="inline-flex h-4 min-w-4 items-center justify-center rounded-sm bg-muted px-1 text-[10px] font-semibold leading-none text-muted-foreground transition-colors hover:text-foreground"
          >
            +{others.length}
          </button>
        </div>
      )}
      <PortalPanel
        open={panelOpen}
        anchorRef={badgeRef}
        onClose={() => setPanelOpen(false)}
        side="bottom"
        align="end"
        gap={6}
        testId="input-status-slot-panel"
        className="flex w-56 flex-col overflow-hidden rounded-xl border border-border bg-popover shadow-md"
      >
        {others.map((kind) => {
          const Icon = STATUS_KIND_ICON[kind]
          return (
            <button
              key={kind}
              type="button"
              data-testid={`input-status-slot-item-${kind}`}
              onClick={() => {
                setManual(kind)
                setPanelOpen(false)
              }}
              className="flex items-center gap-2 px-2.5 py-1.5 text-left text-xs text-popover-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">{t(statusSlotLabelKey(kind))}</span>
            </button>
          )
        })}
      </PortalPanel>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠