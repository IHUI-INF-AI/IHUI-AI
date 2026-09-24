// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  executeAgentRuntimeStream,
  getWorkspacePermissionDefault,
  sendToolApprovalResponse,
} from '@ihui/api-client'
import {
  parsePlanText,
  permissionDecisionWord,
  permissionTierWordKeys,
  type RenderPlanStep,
} from '@ihui/shared'
// D64④ 后台子任务态色档判定唯一真相源(element-pack):端内不得再手写状态→色 switch
import {
  backgroundTaskView,
  fromAgentStatus,
  type ElementPackTone,
} from '@ihui/shared/chat/element-pack'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@ihui/ui-react'
import { useI18n } from '../../../src/i18n'
import { PlanStepsView, enumLabel, makeToolTranslate, toolDisplayName } from './MessageContent'

type AgentStatus = 'idle' | 'running' | 'completed' | 'failed'

/** 语义色档 → Tailwind 类(仅样式映射;状态→色档的判定在共享层 backgroundTaskView) */
const TONE_DOT_CLASS: Record<ElementPackTone, string> = {
  neutral: 'bg-muted-foreground',
  info: 'bg-primary',
  success: 'bg-success',
  // 本端 AgentStatus 四态经 fromAgentStatus 归并后不产生 warning 档(无 timeout),
  // 结构上不可达;兜底同 info,避免自造第二色源。
  warning: 'bg-primary',
  danger: 'bg-destructive',
}

/**
 * D64④ 状态点色档唯一出口(导出供回归)。
 * 判据派发自真相源:backgroundTaskView(fromAgentStatus(status)).tone。
 */
export function agentStatusDotClass(status: AgentStatus): string {
  return TONE_DOT_CLASS[backgroundTaskView(fromAgentStatus(status)).tone]
}

interface PermissionEvent {
  mode: string
  toolName?: string
  dangerLevel?: string
  decision: string
  /** W6:审批 ID。当前 /agent-runtime 通道的 onPermission 载荷未提供该字段,
   *  后端补齐后「允许/拒绝」按钮即可直接走 sendToolApprovalResponse 生效。 */
  approvalId?: string
}

// 权限事件的 dangerLevel / mode 两个枚举字段(契约层均为 string,取值见
// apps/ai-service/app/routers/agent_runtime.py::_check_permission)。
// 只登记**已核实**的字面量;映射不到一律原样显示,不猜语义(理由见 MessageContent.enumLabel)
// —— 审批面板上把 deny 误译成"已放行"会直接误导用户的授权决定。
// (decision 字段不在此列:D55② 起走共享唯一取词入口 permissionDecisionWord,
//  同时覆盖 allow/ask/deny 权限矩阵与 15 值步骤决策集,见下方 PermissionDecisionBadge。)
export const DANGER_LEVEL_KEY: Readonly<Record<string, string>> = {
  read: 'agent.levelRead',
  write: 'agent.levelWrite',
  dangerous: 'agent.levelDangerous',
  high: 'agent.levelHigh',
  medium: 'agent.levelMedium',
  low: 'agent.levelLow',
}
export const MODE_KEY: Readonly<Record<string, string>> = {
  default: 'agent.modeDefault',
  plan: 'agent.modePlan',
  acceptEdits: 'agent.modeAcceptEdits',
  bypassPermissions: 'agent.modeBypassPermissions',
  manual: 'agent.modeManual',
}

interface AgentRuntimePanelProps {
  agentId: string
}

/**
 * D111:工作区权限档交代行(档名 + 后果)。
 * 独立成组件以便无 effect 环境下直接测试(renderToStaticMarkup 不跑 useEffect)。
 * tier=null(尚未取到/取数失败)时整行不渲染 —— 不假装知道档位。
 */
export function WorkspacePermissionTierRow({ tier }: { tier: string | null }) {
  const { t } = useI18n()
  if (tier === null) return null
  const tierText = permissionTierWordKeys(tier)
  return (
    <div
      className="px-2.5 py-1 text-xs text-muted-foreground"
      data-testid="workspace-permission-tier"
    >
      <span className="font-medium">{t('permissionTier.label')}: </span>
      <span>{t(tierText.title)}</span>
      <span> · {t(tierText.desc)}</span>
    </div>
  )
}

/**
 * D55②:权限决策取值的徽章文案。与 WorkspacePermissionTierRow 同因独立成组件
 * (renderToStaticMarkup 不跑 useEffect,permission 状态无法在纯 SSR 下注入)。
 * 取词一律走共享唯一入口 permissionDecisionWord(先认 15 值步骤决策集,再认
 * allow/ask/deny 权限矩阵),两条都不中 → 原样显示;绝不猜语义、绝不喷键名 ——
 * 端内曾自挂 DECISION_KEY 第二映射(与共享 stepDecision 词包同义不同词,
 * 如 deny 端内「已拦截」/ 共享「已拒绝」),即本票收口的对象。
 */
export function PermissionDecisionBadge({ decision }: { decision: string }) {
  const { t } = useI18n()
  return (
    <span data-testid="permission-decision">
      {permissionDecisionWord(decision, (k) => t(`stepDecision.${k}`))}
    </span>
  )
}

export function AgentRuntimePanel({ agentId }: AgentRuntimePanelProps) {
  const { t } = useI18n()
  const getStatusText = (status: AgentStatus) => {
    const map: Record<AgentStatus, string> = {
      idle: t('agent.statusIdle'),
      running: t('agent.statusRunning'),
      completed: t('agent.statusCompleted'),
      failed: t('agent.statusFailed'),
    }
    return map[status]
  }
  const [status, setStatus] = useState<AgentStatus>('idle')
  const [input, setInput] = useState('')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [plan, setPlan] = useState<string | null>(null)
  const [output, setOutput] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [permission, setPermission] = useState<PermissionEvent | null>(null)
  // W6:审批提交状态(提交中 / 已提交 / 失败),无 approvalId 时保持 idle。
  const [approvalState, setApprovalState] = useState<'idle' | 'submitting' | 'sent' | 'failed'>(
    'idle',
  )
  // D111:工作区权限档(null = 尚未取到/取数失败 → 整行隐藏,不假装知道档位)。
  const [workspaceTier, setWorkspaceTier] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // D111:首屏交代当前权限档(档名 + 后果)。此前 extension 只有审批结果展示,
  // 用户看不到自己处于哪一档、也不知道那一档会导致什么。
  useEffect(() => {
    let cancelled = false
    getWorkspacePermissionDefault()
      .then((res) => {
        if (!cancelled && res.success && res.data) setWorkspaceTier(res.data.mode)
      })
      .catch(() => {
        /* 取数失败:保持 null,该行隐藏 */
      })
    return () => {
      cancelled = true
    }
  }, [])

  // W6:链路 B 的 onPlan 只给纯文本,用共享纯函数 parsePlanText 降级解析为结构化步骤,
  // 与 ChatPage 的 plan 渲染共用同一套数据模型(parsePlanText 位于 @ihui/shared)。
  const planSteps = useMemo<RenderPlanStep[]>(() => (plan ? parsePlanText(plan) : []), [plan])

  const handleSend = useCallback(async () => {
    const message = input.trim()
    if (!message || status === 'running') return

    setStatus('running')
    setPlan(null)
    setOutput('')
    setError(null)
    setPermission(null)
    setApprovalState('idle')

    const controller = new AbortController()
    abortRef.current = controller

    try {
      await executeAgentRuntimeStream(
        { message, mode: 'default', sessionId: sessionId ?? undefined, botId: agentId },
        {
          onSession: (data) => setSessionId(data.sessionId),
          onPlan: (data) => setPlan(data.plan),
          onDelta: (data) => setOutput((prev) => prev + data.content),
          onPermission: (data) => setPermission(data),
          onDone: (data) => {
            setStatus('completed')
            if (data.summary) setOutput(data.summary)
          },
          onError: (data) => {
            setError(data.message)
            setStatus('failed')
          },
        },
        { signal: controller.signal },
      )
    } catch (err) {
      if (controller.signal.aborted) {
        setStatus('idle')
      } else {
        setError(String(err))
        setStatus('failed')
      }
    } finally {
      abortRef.current = null
    }
  }, [input, status, sessionId, agentId])

  const handleStop = useCallback(() => {
    abortRef.current?.abort()
    setStatus('idle')
  }, [])

  const handleClear = useCallback(() => {
    setStatus('idle')
    setInput('')
    setSessionId(null)
    setPlan(null)
    setOutput('')
    setError(null)
    setPermission(null)
    setApprovalState('idle')
  }, [])

  // W6:提交审批决策。当前 /agent-runtime 通道的 onPermission 载荷未带 approvalId,
  // 此时按钮禁用(降级只读);后端补齐后即可直接生效。
  const handleApproval = useCallback(
    async (decision: 'approve' | 'reject') => {
      const approvalId = permission?.approvalId
      if (!approvalId) return
      setApprovalState('submitting')
      try {
        await sendToolApprovalResponse({ approvalId, decision })
        setApprovalState('sent')
      } catch {
        setApprovalState('failed')
      }
    },
    [permission],
  )

  // D64④ 色档派发自共享判据(端内不再手写状态→色 switch);回归见 tests/agent-runtime-panel-element-pack.test.tsx
  const statusDotClass = TONE_DOT_CLASS[backgroundTaskView(fromAgentStatus(status)).tone]

  return (
    <div className="flex flex-col gap-2" data-testid="agent-runtime-panel">
      <div className="flex items-center gap-1.5 px-2 py-1.5 border border-border rounded-md bg-card text-xs">
        <span className="font-semibold text-xs">{t('nav.tabRuntime')}</span>
        {sessionId && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className="text-muted-foreground text-xs font-mono overflow-hidden text-ellipsis whitespace-nowrap max-w-[80px]"
                  data-testid="session-id"
                >
                  #{sessionId.slice(0, 8)}
                </span>
              </TooltipTrigger>
              <TooltipContent>{sessionId}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <span
            className={`inline-block w-2 h-2 rounded-full shrink-0 ${statusDotClass}`}
            aria-hidden
          />
          <span>{getStatusText(status)}</span>
        </span>
        <span className="flex-1" />
        <button
          type="button"
          className="bg-transparent border border-border rounded-md px-2 py-1 text-xs cursor-pointer text-muted-foreground shrink-0"
          onClick={handleClear}
          disabled={status === 'running'}
        >
          {t('agent.clear')}
        </button>
      </div>

      <WorkspacePermissionTierRow tier={workspaceTier} />

      <div className="flex flex-col gap-2 min-h-[100px]">
        {plan && (
          <section className="px-2.5 py-2 border border-border rounded-md text-xs bg-muted">
            <div className="text-xs text-muted-foreground mb-1 font-medium">
              {t('agent.executePlan')}
            </div>
            {/* W6:plan 由 <pre> 纯文本改为结构化步骤列表(共用 MessageContent 的 PlanStepsView) */}
            {planSteps.length > 0 ? (
              <PlanStepsView steps={planSteps} />
            ) : (
              <pre className="m-0 whitespace-pre-wrap text-xs leading-normal">{plan}</pre>
            )}
          </section>
        )}

        {permission && (
          <section className="px-2.5 py-2 border border-warning rounded-md text-xs bg-warning/10">
            <div className="text-xs text-muted-foreground mb-1 font-medium">
              <span>{t('agent.permissionDecision') + ': '}</span>
              {/* decision 取值经共享 permissionDecisionWord 取词(D55②):
                  矩阵 + 步骤决策两条都不中时原样显示,不猜语义 */}
              <PermissionDecisionBadge decision={permission.decision} />
            </div>
            <div className="text-xs text-muted-foreground">
              <span>{t('agent.tool') + ': '}</span>
              {/* 界面禁止直显英文工具码名:已登记的内置工具显示本地化功能名 */}
              <span>{toolDisplayName(permission.toolName, makeToolTranslate(t))}</span>
              <span> · {t('agent.level') + ':'}</span>
              <span>{enumLabel(permission.dangerLevel ?? 'read', DANGER_LEVEL_KEY, t)}</span>
              <span> · {t('agent.mode') + ': '}</span>
              <span>{enumLabel(permission.mode, MODE_KEY, t)}</span>
            </div>
            {/* W6:审批按钮。缺 approvalId 时降级只读并给出提示 */}
            <div className="flex items-center gap-1.5 mt-2">
              <button
                type="button"
                className="bg-cta text-cta-foreground border-none rounded-md px-2.5 py-1 text-xs font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => void handleApproval('approve')}
                disabled={
                  !permission.approvalId ||
                  approvalState === 'submitting' ||
                  approvalState === 'sent'
                }
                data-testid="agent-approval-approve"
              >
                {t('agent.approve')}
              </button>
              <button
                type="button"
                className="bg-destructive text-white border-none rounded-md px-2.5 py-1 text-xs font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => void handleApproval('reject')}
                disabled={
                  !permission.approvalId ||
                  approvalState === 'submitting' ||
                  approvalState === 'sent'
                }
                data-testid="agent-approval-reject"
              >
                {t('agent.reject')}
              </button>
              <span className="text-[10px] text-muted-foreground">
                {approvalState === 'submitting'
                  ? t('agent.approvalSubmitting')
                  : approvalState === 'sent'
                    ? t('agent.approvalSent')
                    : approvalState === 'failed'
                      ? t('agent.approvalFailed')
                      : !permission.approvalId
                        ? t('agent.approvalUnavailable')
                        : ''}
              </span>
            </div>
          </section>
        )}

        {output && (
          <section>
            <div className="text-xs text-muted-foreground mb-1 font-medium">
              {t('agent.output')}
            </div>
            <div className="px-2.5 py-2 text-sm leading-normal whitespace-pre-wrap break-words">
              {output}
            </div>
          </section>
        )}

        {error && (
          <section className="px-2.5 py-2 border border-destructive rounded-md text-xs bg-destructive/10 text-destructive">
            <div className="text-xs font-medium">{t('agent.error')}</div>
            <div className="mt-1 text-xs">{error}</div>
          </section>
        )}

        {!plan && !output && !error && !permission && (
          <div className="text-center text-muted-foreground text-xs px-2 py-5">
            {t('agent.inputTaskHint')}
          </div>
        )}
      </div>

      <div className="flex gap-1.5 items-stretch">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void handleSend()
            }
          }}
          placeholder={t('agent.inputTaskPlaceholder')}
          disabled={status === 'running'}
          rows={2}
          className="flex-1 resize-none min-h-12 text-sm"
          data-testid="agent-runtime-input"
        />
        {status === 'running' ? (
          <button
            type="button"
            className="bg-destructive text-white border-none rounded-md px-3.5 py-1.5 text-xs font-medium cursor-pointer shrink-0 self-stretch"
            onClick={handleStop}
            data-testid="agent-runtime-stop"
          >
            {t('agent.stop')}
          </button>
        ) : (
          <button
            type="button"
            className="bg-cta text-cta-foreground border-none rounded-md px-3.5 py-1.5 text-xs font-medium cursor-pointer shrink-0 self-stretch"
            onClick={handleSend}
            disabled={!input.trim()}
            data-testid="agent-runtime-send"
          >
            {t('agent.execute')}
          </button>
        )}
      </div>
    </div>
  )
}

export default AgentRuntimePanel
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
