import type { ChatMessage } from '@/stores/chat'

export function TypingIndicator({
  reasoning,
  toolCalls,
}: {
  reasoning?: string
  toolCalls?: ChatMessage['toolCalls']
}) {
  const runningTool = toolCalls?.find((tc) => tc.status === 'running')

  let label: string
  if (runningTool) {
    label = `正在调用工具:${runningTool.toolName}`
  } else if (reasoning && reasoning.length > 0) {
    const preview = reasoning.length > 40 ? `${reasoning.slice(0, 40)}…` : reasoning
    label = `正在思考: ${preview}`
  } else {
    label = '正在等待模型响应…'
  }

  return (
    <div className="flex items-center gap-2 py-1">
      {/* 2026-08-29:文字光线扫描动效(.text-shimmer),流式等待态视觉反馈 */}
      <span className="text-shimmer text-xs font-medium">{label}</span>
    </div>
  )
}

/** 把消息 createdAt 格式化为"今天 HH:MM / MM-DD HH:MM" 风格 footer 时间戳(2026-07-28 立)
 *  - hover 消息气泡时在 footer 显示完整时间,便于用户回溯精确时刻
 *  - 与 timeline-event.tsx 内的 formatRelativeTime 互为补充:相对时间用于时间线,绝对时间用于消息气泡 */
export function formatMessageTimestamp(createdAt: number): string {
  const d = new Date(createdAt)
  if (Number.isNaN(d.getTime())) return ''
  const now = new Date()
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  if (sameDay) return `${hh}:${mm}`
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${mo}-${dd} ${hh}:${mm}`
}

/** 元数据 usage 展开面板(2026-08-02 立,原项目 toggleMetadata 展开内容)
 *  展示 promptTokens / completionTokens / totalTokens 细分,类型安全读取 unknown 字段 */
export function UsageBreakdown({ usage }: { usage: unknown }) {
  if (typeof usage !== 'object' || usage === null) return null
  const u = usage as Record<string, unknown>
  const prompt = typeof u.promptTokens === 'number' ? u.promptTokens : null
  const completion = typeof u.completionTokens === 'number' ? u.completionTokens : null
  const total = typeof u.totalTokens === 'number' ? u.totalTokens : null
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {prompt !== null && (
        <span className="text-muted-foreground">
          Prompt: <span className="font-medium text-foreground">{prompt}</span>
        </span>
      )}
      {completion !== null && (
        <span className="text-muted-foreground">
          Completion: <span className="font-medium text-foreground">{completion}</span>
        </span>
      )}
      {total !== null && (
        <span className="text-muted-foreground">
          Total: <span className="font-medium text-foreground">{total}</span>
        </span>
      )}
    </div>
  )
}

// 2026-08-02:消息交互按钮基础样式(完全复用原项目 AIChat.vue 统一按钮系统)
// --fcd-btn-size:28px → h-7 w-7 | --fcd-btn-radius:6px → rounded-md | --fcd-btn-icon-size:16px → h-4 w-4
// _message-list.scss .message-actions: display:flex; gap:8px; opacity:1(始终显示)
export const ACTION_BTN_CLASS =
  'inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-primary hover:bg-muted/60 transition-all duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
