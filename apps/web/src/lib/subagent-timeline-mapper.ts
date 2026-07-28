/**
 * subagent-timeline-mapper — Subagent SSE 事件 → TimelineEvent 映射层(2026-07-29 立,Phase 21)
 *
 * 作用:把 ai-service 发来的 subagent_spawn / subagent_progress / subagent_end SSE 事件
 * 转换为 timeline-store 可消费的 TimelineEvent / Partial<TimelineEvent>,
 * 让 Timeline tab 自动响应 subagent 生命周期,消除与 subagent 的割裂。
 *
 * 设计约束:
 * - 纯函数,无副作用,不调用 store
 * - 不引入 any,全部用精确类型
 * - description 截断到 80 字符(避免 Timeline 行溢出)
 * - 临时描述文本用模板字符串拼接(与 timeline-event.tsx formatRelativeTime 直接用中文一致),
 *   如需 i18n 由后续迭代处理
 */

import type { SubagentSpawnEvent, SubagentEndEvent, SubagentProgressEvent } from '@ihui/api-client'
import type { TimelineEvent } from '@/stores/timeline-store'

/** description 最大长度(避免 Timeline 行溢出) */
const MAX_DESC_LEN = 80

/** 把字符串截断到 maxLen,超出加省略号 */
function truncate(text: string, maxLen: number = MAX_DESC_LEN): string {
  if (text.length <= maxLen) return text
  return `${text.slice(0, maxLen - 1)}…`
}

/**
 * 将 subagent_spawn SSE 事件映射为 TimelineEvent
 * - type='subagent', status='running'
 * - title=role(如 "code-reviewer")
 * - description=task(如 "审查 auth 模块安全性")
 * - meta={ subagentId: event.id, phase: 'spawn' }
 */
export function mapSpawnToTimelineEvent(event: SubagentSpawnEvent): TimelineEvent {
  return {
    id: event.id,
    type: 'subagent',
    timestamp: event.timestamp,
    title: event.role,
    description: truncate(event.task),
    status: 'running',
    meta: { subagentId: event.id, phase: 'spawn' },
  }
}

/**
 * 将 subagent_progress SSE 事件映射为 timeline store 更新
 * - thinking → 更新 description="思考中…(第 N 轮)", meta={ phase: 'thinking', iteration }
 * - tool_call → 更新 description="调用工具:{tool}(第 N 轮)", meta={ phase: 'tool_call', tool, iteration }
 * - tool_result → 更新 description="工具返回:{tool} {ok|failed}", meta={ phase: 'tool_result', tool, ok }
 * - output_ready → 更新 description="输出就绪:{outputPreview 前 60 字符}", meta={ phase: 'output_ready', outputPreview }
 *
 * 返回 null 表示不需要更新(如缺少必要字段)。
 */
export function mapProgressToTimelineUpdate(
  event: SubagentProgressEvent,
): { id: string; updates: Partial<TimelineEvent> } | null {
  switch (event.phase) {
    case 'thinking': {
      const iter = event.iteration ?? 0
      return {
        id: event.id,
        updates: {
          status: 'running',
          description: truncate(`思考中…(第 ${iter} 轮)`),
          meta: { phase: 'thinking', iteration: iter },
        },
      }
    }
    case 'tool_call': {
      if (!event.tool) return null
      const iter = event.iteration ?? 0
      return {
        id: event.id,
        updates: {
          status: 'running',
          description: truncate(`调用工具:${event.tool}(第 ${iter} 轮)`),
          meta: { phase: 'tool_call', tool: event.tool, iteration: iter },
        },
      }
    }
    case 'tool_result': {
      if (!event.tool) return null
      const okLabel = event.ok === false ? 'failed' : 'ok'
      return {
        id: event.id,
        updates: {
          status: 'running',
          description: truncate(`工具返回:${event.tool} ${okLabel}`),
          meta: { phase: 'tool_result', tool: event.tool, ok: event.ok },
        },
      }
    }
    case 'output_ready': {
      const preview = event.outputPreview ?? ''
      const previewShort = preview.length > 60 ? `${preview.slice(0, 60)}…` : preview
      return {
        id: event.id,
        updates: {
          status: 'running',
          description: truncate(`输出就绪:${previewShort}`),
          meta: { phase: 'output_ready', outputPreview: preview },
        },
      }
    }
    default:
      return null
  }
}

/**
 * 将 subagent_end SSE 事件映射为 timeline store 更新
 * - status='done' → status='done', description="完成"
 * - status='failed' → status='failed', description="失败:{failureReason 前 100 字符}"
 * - meta 追加 { phase: 'end', status: event.status, failureReason }
 */
export function mapEndToTimelineUpdate(event: SubagentEndEvent): {
  id: string
  updates: Partial<TimelineEvent>
} {
  if (event.status === 'failed') {
    const reason = (event.failureReason ?? '').slice(0, 100)
    return {
      id: event.id,
      updates: {
        status: 'failed',
        description: truncate(`失败:${reason}`),
        meta: { phase: 'end', status: event.status, failureReason: event.failureReason },
      },
    }
  }
  return {
    id: event.id,
    updates: {
      status: 'done',
      description: '完成',
      meta: { phase: 'end', status: event.status },
    },
  }
}
