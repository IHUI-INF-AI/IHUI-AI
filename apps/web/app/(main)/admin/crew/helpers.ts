import type { CreateSessionForm, ParsedSseEvent, StreamLogEntry } from './types'
import type { CrewStreamEvent } from '@/lib/crew-api'

export const EMPTY_FORM: CreateSessionForm = {
  userId: '',
  title: '',
  inputMessage: '',
  collectionName: 'default',
  modelId: '',
  maxRetries: 2,
}

/** 状态徽章样式 */
export function statusBadgeClass(status: string): string {
  switch (status) {
    case 'completed':
    case 'success':
    case 'ok':
      return 'bg-emerald-500/10 text-emerald-600'
    case 'running':
    case 'pending':
      return 'bg-amber-500/10 text-amber-600'
    case 'failed':
    case 'error':
      return 'bg-rose-500/10 text-rose-600'
    default:
      return 'bg-muted text-muted-foreground'
  }
}

/** 把 StreamEvent 转为日志文本 */
export function eventToLogText(evt: CrewStreamEvent): string {
  switch (evt.type) {
    case 'start':
      return `会话启动 (${evt.sessionId ?? ''})`
    case 'planning':
      return '规划阶段:正在生成任务计划...'
    case 'plan':
      return `计划已生成,共 ${evt.tasks?.length ?? 0} 个任务`
    case 'task_start':
      return `[任务 ${evt.taskIndex}] ${evt.role} 开始执行`
    case 'task_complete':
      return `[任务 ${evt.taskIndex}] ${evt.role} 完成`
    case 'task_error':
      return `[任务 ${evt.taskIndex}] ${evt.role} 出错: ${evt.content ?? ''}`
    case 'complete':
      return '✅ 会话执行完成'
    case 'error':
      return `❌ 执行失败: ${evt.content ?? ''}`
    default:
      return evt.content ?? JSON.stringify(evt)
  }
}

/**
 * 解析 SSE 流文本块,返回完整的 event 块(以空行分隔)。
 * 调用方需要自己维护 buffer,把新数据追加后调用本函数。
 */
export function parseSseChunk(buffer: string): { events: ParsedSseEvent[]; rest: string } {
  const events: ParsedSseEvent[] = []
  let rest = buffer
  const sep = '\n\n'
  while (true) {
    const idx = rest.indexOf(sep)
    if (idx === -1) break
    const block = rest.slice(0, idx)
    rest = rest.slice(idx + sep.length)
    if (!block.trim()) continue
    let event = 'message'
    let data = ''
    for (const line of block.split('\n')) {
      if (line.startsWith(':')) continue
      if (line.startsWith('event:')) {
        event = line.slice(6).trim()
      } else if (line.startsWith('data:')) {
        data += (data ? '\n' : '') + line.slice(5).replace(/^\s/, '')
      }
    }
    if (data) events.push({ event, data })
  }
  return { events, rest }
}

/** 把 ParsedSseEvent 转成 StreamLogEntry */
export function sseToLogEntry(parsed: ParsedSseEvent): StreamLogEntry | null {
  try {
    const evt = JSON.parse(parsed.data) as CrewStreamEvent
    return { type: evt.type, text: eventToLogText(evt), ts: Date.now() }
  } catch {
    return null
  }
}

/** 时间格式化 */
export function fmtTime(s: string | null | undefined): string {
  if (!s) return '-'
  try {
    const d = new Date(s)
    return d.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return s
  }
}
