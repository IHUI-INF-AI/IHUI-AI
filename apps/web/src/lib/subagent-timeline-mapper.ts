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
 * - i18n(Phase 22,2026-07-29 立):meta 中新增 i18nKey + i18nParams,
 *   description 仍保留中文 fallback(向后兼容),渲染层优先用 i18n,失败时 fallback
 */

import type { SubagentSpawnEvent, SubagentEndEvent, SubagentProgressEvent } from '@ihui/api-client'
import type { TimelineEvent } from '@/stores/timeline-store'

/** description 最大长度(避免 Timeline 行溢出) */
const MAX_DESC_LEN = 80

/** i18n key 命名空间前缀(渲染层 strip 后传给 useTranslations('ai.pane')) */
const I18N_NS = 'ai.pane.'

/** 把字符串截断到 maxLen,超出加省略号 */
function truncate(text: string, maxLen: number = MAX_DESC_LEN): string {
  if (text.length <= maxLen) return text
  return `${text.slice(0, maxLen - 1)}…`
}

/**
 * Timeline 描述的 i18n 元信息(2026-07-29 立,Phase 22)
 *
 * - key:完整 i18n key(如 'ai.pane.timelineSubagentThinking'),渲染层 strip 命名空间前缀
 * - params:next-intl ICU 占位符参数(如 { iteration: 3 })
 *
 * 序列化到 TimelineEvent.meta.i18nKey / meta.i18nParams,
 * TimelineEventRow 读取后用 t(key.replace('ai.pane.', ''), params) 翻译。
 */
export interface TimelineDescription {
  /** 完整 i18n key(如 'ai.pane.timelineSubagentThinking') */
  key: string
  /** i18n 参数(如 { iteration: 3 }) */
  params?: Record<string, string | number>
}

/**
 * 将 subagent_spawn SSE 事件映射为 TimelineEvent
 * - type='subagent', status='running'
 * - title=role(如 "code-reviewer")
 * - description=task(如 "审查 auth 模块安全性",动态内容不需要 i18n)
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
 * 将 subagent_progress SSE 事件映射为 timeline store 更新(Phase 22 i18n 化)
 *
 * 4 种 phase 的 i18n key 映射:
 * - thinking     → timelineSubagentThinking      { iteration }
 * - tool_call    → timelineSubagentToolCall       { tool, iteration }
 * - tool_result  → ok=true  → timelineSubagentToolResultSuccess { tool }
 *                  ok=false → timelineSubagentToolResultFailed  { tool }
 * - output_ready → timelineSubagentOutputReady    {}
 *
 * description 仍存中文 fallback(向后兼容:无 i18nProvider 时仍可读),
 * meta 中新增 i18nKey + i18nParams,渲染层优先用 i18n。
 *
 * 返回 null 表示不需要更新(如缺少必要字段)。
 */
export function mapProgressToTimelineUpdate(
  event: SubagentProgressEvent,
): { id: string; updates: Partial<TimelineEvent> } | null {
  switch (event.phase) {
    case 'thinking': {
      const iter = event.iteration ?? 0
      const desc: TimelineDescription = {
        key: `${I18N_NS}timelineSubagentThinking`,
        params: { iteration: iter },
      }
      return {
        id: event.id,
        updates: {
          status: 'running',
          description: truncate(`思考中…(第 ${iter} 轮)`),
          meta: {
            phase: 'thinking',
            iteration: iter,
            i18nKey: desc.key,
            i18nParams: desc.params,
          },
        },
      }
    }
    case 'tool_call': {
      if (!event.tool) return null
      const iter = event.iteration ?? 0
      const desc: TimelineDescription = {
        key: `${I18N_NS}timelineSubagentToolCall`,
        params: { tool: event.tool, iteration: iter },
      }
      return {
        id: event.id,
        updates: {
          status: 'running',
          description: truncate(`调用工具:${event.tool}(第 ${iter} 轮)`),
          meta: {
            phase: 'tool_call',
            tool: event.tool,
            iteration: iter,
            i18nKey: desc.key,
            i18nParams: desc.params,
          },
        },
      }
    }
    case 'tool_result': {
      if (!event.tool) return null
      const ok = event.ok !== false
      const desc: TimelineDescription = {
        key: ok
          ? `${I18N_NS}timelineSubagentToolResultSuccess`
          : `${I18N_NS}timelineSubagentToolResultFailed`,
        params: { tool: event.tool },
      }
      const okLabel = ok ? '成功' : '失败'
      return {
        id: event.id,
        updates: {
          status: 'running',
          description: truncate(`工具返回:${event.tool} ${okLabel}`),
          meta: {
            phase: 'tool_result',
            tool: event.tool,
            ok: event.ok,
            i18nKey: desc.key,
            i18nParams: desc.params,
          },
        },
      }
    }
    case 'output_ready': {
      const preview = event.outputPreview ?? ''
      const previewShort = preview.length > 60 ? `${preview.slice(0, 60)}…` : preview
      const desc: TimelineDescription = {
        key: `${I18N_NS}timelineSubagentOutputReady`,
      }
      return {
        id: event.id,
        updates: {
          status: 'running',
          description: truncate(`输出就绪:${previewShort}`),
          meta: {
            phase: 'output_ready',
            outputPreview: preview,
            i18nKey: desc.key,
            i18nParams: desc.params,
          },
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
