import * as React from 'react'
import type { ChatMessage } from '@/stores/chat'
import type { SubAgentActivity } from '@/components/ai/types'
import type { PlanStep } from '@/hooks/use-agent-progress'
import { useChatStore } from '@/stores/chat'
import { useTimelineStore, type TimelineEvent } from '@/stores/timeline-store'
import { useProgressJumpStore } from '@/stores/progress-jump-store'

export interface MessageListDerivationsOptions {
  messages: ChatMessage[]
  isStreaming: boolean
  subAgentActivitiesProp?: SubAgentActivity[]
  t: (key: string) => string
}

/** 派生 planSteps / timeline events(2026-07-28 ~ 2026-07-31 立)。
 *  - 不返回任何被 render 直接消费的值(planSteps 仅用于写入 ProgressJumpStore,
 *    timeline events 仅用于同步到 timeline store),故本 hook 无需返回值。
 *  - messages.length === 0 时清空 planSteps 缓存(避免旧会话条目累积)。 */
export function useMessageListDerivations({
  messages,
  isStreaming,
  subAgentActivitiesProp,
  t,
}: MessageListDerivationsOptions): void {
  // TimelineStore:事件列表(2026-07-28 立;2026-07-31 立,移除 tab 切换,单一对话流视图)
  // - tab 切换已移除(对标 Trae/Codex 单一对话流),保留 events 供其他组件共享
  const timelineEvents = useTimelineStore((s) => s.events)
  const setTimelineEvents = useTimelineStore((s) => s.setEvents)

  // ChatStore:subAgentActivities(2026-07-28 立)用于派生 TimelineEvent + SubAgentTaskTree
  // 优先用 prop 传入的 subAgentActivities(由 ai-side-panel 派生),
  // 兜底从 useChatStore 内部读取(独立使用 MessageList 的场景)
  const subAgentActivitiesFromStore = useChatStore((s) => s.subAgentActivities)
  const subAgentActivities = subAgentActivitiesProp ?? subAgentActivitiesFromStore

  // 最后一条 assistant 消息 ID(用于 planSteps 状态判定 + subagent 关联)
  const lastAssistantMessageId = React.useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i]
      if (m && m.role === 'assistant') return m.id
    }
    return null
  }, [messages])

  // P0 流式性能优化(2026-08-02):缓存"已完成" assistant 消息的 planSteps
  // - 每个 token 到达 → messages 引用变化 → planSteps useMemo 重算 + linkPlanStepToMessage effect 触发写 store
  // - 已完成消息(非最后一条 / 非流式中)的 planSteps 不会变,缓存命中跳过 O(stepsPerMessage) 重算
  // - key 用 msg.id,切换会话(messages.length===0)时清空(见下方 cleanup effect)
  // - 语言切换时 next-intl 返回新 t 引用 → 触发 useMemo 重算 → prevTRef 检测到变化清空缓存,避免旧翻译残留
  const completedPlanStepsRef = React.useRef<Map<string, PlanStep[]>>(new Map())
  const prevTRef = React.useRef<typeof t | null>(null)

  // PlanStepsCard 数据源(2026-07-31 深度优化,对标 Codex /plan + Trae Thinking Process):
  // 普通对话走 streamChat → /api/ai/chat/stream → /api/llm/complete/stream,
  // 不经过 LangGraph agent,因此 useAgentProgress.start() 即使接通也得不到 plan events
  // (且 graph 未注册时返回 503)。改为基于 messages 派生 planSteps,覆盖 3 类步骤:
  //   ① reasoning(推理模型思考过程)→ "思考" 步骤(完整保留 explanation,不截断)
  //   ② toolCalls(工具调用)→ 每个工具一个步骤(带 error 标记 + 完整 duration)
  //   ③ content(最终回答)→ "回答" 步骤
  // 深度优化字段:
  //   - error: toolCalls status=error 时为 true,PlanStepsCard 显示红色错误样式
  //   - sourceMessageId: 关联消息 ID,用于点击步骤跳转消息 + hover 联动
  //   - groupIndex: 同一条 assistant 消息的步骤同组,组间视觉分隔
  const planSteps = React.useMemo<PlanStep[]>(() => {
    // 语言切换时清空缓存(避免缓存中保留旧翻译,t 加入 deps 确保 useMemo 在 t 变化时重算)
    if (prevTRef.current !== t) {
      completedPlanStepsRef.current.clear()
      prevTRef.current = t
    }
    const steps: PlanStep[] = []
    const assistantMsgs = messages.filter((m) => m.role === 'assistant')
    assistantMsgs.forEach((msg, idx) => {
      const groupIndex = idx
      const isLast = msg.id === lastAssistantMessageId
      const isStreamingThis = isLast && isStreaming

      // P0 优化:已完成消息(非最后一条 或 非流式中)的 planSteps 不会变,优先读缓存
      // - 流式中:只有最后一条 assistant 消息每次重算(token 变化),其余命中缓存
      // - 流式结束:最后一条消息也变为已完成,首次重算后缓存,后续渲染命中缓存
      const isCompleted = !isLast || !isStreaming
      if (isCompleted) {
        const cached = completedPlanStepsRef.current.get(msg.id)
        if (cached) {
          steps.push(...cached)
          return
        }
      }

      const msgSteps: PlanStep[] = []

      // ① reasoning → "思考" 步骤(reasoning 模型输出,如 o1/R1)
      //    explanation 完整保留(不截断),PlanStepsCard 内部用 MarkdownViewer 渲染
      if (msg.reasoning && msg.reasoning.trim().length > 0) {
        msgSteps.push({
          id: `${msg.id}-reasoning`,
          step: t('stepThinking'),
          status: isStreamingThis && !msg.content ? 'in_progress' : 'completed',
          explanation: msg.reasoning,
          sourceMessageId: msg.id,
          groupIndex,
        })
      }

      // ② toolCalls → 每个工具调用一个步骤(带 error 标记)
      if (msg.toolCalls?.length) {
        for (const tc of msg.toolCalls) {
          const isError = tc.status === 'error'
          msgSteps.push({
            id: tc.id,
            step: tc.toolName,
            status: tc.status === 'running' ? 'in_progress' : 'completed',
            durationMs: tc.duration,
            error: isError,
            explanation: tc.error || (tc.repeated ? t('toolCallSkipped') : undefined),
            sourceMessageId: msg.id,
            groupIndex,
          })
        }
      }

      // ③ content → "回答" 步骤(只有当有 content 时才显示)
      if (msg.content && msg.content.trim().length > 0) {
        msgSteps.push({
          id: `${msg.id}-answer`,
          step: t('stepAnswer'),
          status: isStreamingThis ? 'in_progress' : 'completed',
          sourceMessageId: msg.id,
          groupIndex,
        })
      }

      // 缓存已完成消息的 planSteps(下次 token 到达时直接命中,跳过重算)
      if (isCompleted) {
        completedPlanStepsRef.current.set(msg.id, msgSteps)
      }

      steps.push(...msgSteps)
    })
    return steps
  }, [messages, lastAssistantMessageId, isStreaming, t])

  // Phase 19 集成(2026-07-31 立):把 planStep → message 映射写入 ProgressJumpStore
  // 供 PlanStepsCard 点击步骤跳转 + hover 联动 + message-list 反向高亮
  const linkPlanStepToMessage = useProgressJumpStore((s) => s.linkPlanStepToMessage)
  React.useEffect(() => {
    for (const step of planSteps) {
      if (step.sourceMessageId) {
        linkPlanStepToMessage(step.id, step.sourceMessageId)
      }
    }
  }, [planSteps, linkPlanStepToMessage])

  // 从 messages + subAgentActivities 派生 TimelineEvent 列表
  // 上游没传 events 时,本地基于 messages 派生供右侧时间线 tab 渲染
  // P0 流式性能优化(2026-08-02):useDeferredValue 延迟 derivedEvents 的可见更新,
  // 流式 token 到达时(useMemo 仍重算,但 deferred 返回旧值)避免 effect 频繁写 store
  // → store 订阅组件(plan-steps-card / timeline-tab)不会每个 token 都 re-render
  const derivedEventsValue = React.useMemo<TimelineEvent[]>(() => {
    const events: TimelineEvent[] = []
    for (const m of messages) {
      events.push({
        id: `msg-${m.id}`,
        type: m.role === 'user' ? 'reference' : 'thinking',
        timestamp: new Date(m.createdAt).toISOString(),
        title: m.role === 'user' ? t('timelineUserMessage') : t('timelineAiReply'),
        description: m.content.slice(0, 80),
        status: m.error ? 'failed' : 'done',
        messageId: m.id,
      })
      for (const tc of m.toolCalls ?? []) {
        events.push({
          id: `tc-${tc.id}`,
          type: 'tool',
          timestamp: new Date(m.createdAt).toISOString(),
          title: tc.toolName,
          status: tc.status === 'success' ? 'done' : tc.status === 'error' ? 'failed' : 'running',
          messageId: m.id,
          toolCallId: tc.id,
        })
      }
    }
    for (const sa of subAgentActivities) {
      events.push({
        id: `sub-${sa.agentId}`,
        type: 'subagent',
        timestamp: new Date().toISOString(),
        title: sa.name,
        description: sa.currentStep,
        status: sa.status === 'completed' ? 'done' : sa.status === 'failed' ? 'failed' : 'running',
        meta: { agentId: sa.agentId },
      })
    }
    return events
  }, [messages, subAgentActivities, t])
  // deferred 值:urgent render 返回旧值,空闲时再更新 → 减少 effect 写 store 频率
  const derivedEvents = React.useDeferredValue(derivedEventsValue)

  // 上游无 events 时,同步派生 events 到 store(供外部组件共享)
  React.useEffect(() => {
    if (timelineEvents.length === 0 && derivedEvents.length > 0) {
      setTimelineEvents(derivedEvents)
    }
  }, [derivedEvents, timelineEvents.length, setTimelineEvents])

  // 消息列表重置(切换会话)时清空 planSteps 缓存(避免旧会话条目累积)
  React.useEffect(() => {
    if (messages.length === 0) {
      completedPlanStepsRef.current.clear()
    }
  }, [messages.length])
}
