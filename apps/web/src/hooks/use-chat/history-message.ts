// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 平台特有:web 端会话历史水合(依赖 web chat store 的 ChatMessage 形状),
// 各端 store 结构不同,不适合下沉共享层。
import type { PlanStep } from '@ihui/types'
// 权限档读侧归一(G-161/G-165):历史行拼写可能是 kebab/camel/别名
import { permissionModeWire } from '@ihui/types/permission-mode'
import type { ChatMessage } from '@/stores/chat'

/**
 * 后端 chat_messages 行的水合输入(结构最小集)。
 *
 * 与 @ihui/api-client 的 ConversationMessage 结构兼容(metadata 带索引签名,
 * 可直接把 getMessages 返回的行传进来),便于单测构造 fixture。
 */
export interface HistoryMessageRecord {
  id: string
  role: ChatMessage['role']
  content: string
  reasoning?: string
  createdAt: string
  metadata?: Record<string, unknown> | null
}

/**
 * 从 metadata.planSteps 还原权威计划快照。
 *
 * 向后兼容:老消息(2026-09-21 之前落库)没有该 key → 返回 undefined,
 * 消息不挂 planSteps,任务状态条与 PlanStepsCard 安静缺席(不渲染空态垃圾)。
 * 结构校验:DB 可能被其他端/历史链路写入非法形状,逐条守卫后才采信,
 * 避免脏数据把 PlanStepsCard 渲染成 undefined 文字。
 */
function readPlanStepsFromMetadata(raw: unknown): PlanStep[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const steps = raw.filter(
    (item): item is PlanStep =>
      !!item &&
      typeof item === 'object' &&
      typeof (item as { id?: unknown }).id === 'string' &&
      typeof (item as { step?: unknown }).step === 'string' &&
      typeof (item as { status?: unknown }).status === 'string',
  )
  return steps.length > 0 ? steps : undefined
}

/**
 * 单条历史消息 → web store ChatMessage(D24 工具卡/终端区 + planSteps 计划快照)。
 *
 * 2026-09-21 立:plan_updated SSE 事件此前只写前端内存,刷新页面即丢。
 * ai-service 已把同一份快照经 /api/ai/callback 落到 chat_messages.metadata
 * (jsonb 已有列,零 schema 迁移),这里负责读回 message.planSteps。
 */
export function hydrateHistoryMessage(row: HistoryMessageRecord): ChatMessage {
  const meta = row.metadata ?? undefined
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    createdAt: new Date(row.createdAt).getTime(),
    model: (meta?.model as string | null | undefined) ?? '',
    reasoning: row.reasoning,
    // D24(2026-09-19 立):恢复工具卡与终端区(metadata 强制落库)
    toolCalls: (meta?.toolCalls ?? undefined) as ChatMessage['toolCalls'],
    terminalTasks: (meta?.terminalTasks ?? undefined) as ChatMessage['terminalTasks'],
    // planSteps 回放(2026-09-21 立):缺失时 undefined,不得造出空数组
    planSteps: readPlanStepsFromMetadata(meta?.planSteps),
    // G-165:档位徽章的数据源从"只在内存里"换成服务端盖章的 metadata.permissionMode。
    // 经注册表归一后再落 store:库里历史行是 kebab,新链路可能送 camel/别名,
    // 不归一就是"刷新后徽章安静消失"(与 D111 三端不可见是同一个根因)。
    // 取不到就不写字段 —— 写 'default' 等于把"不知道"伪造成"当时是默认档"。
    permissionMode: permissionModeWire(meta?.permissionMode) ?? undefined,
  }
}

/** 批量水合(getMessages 分页结果 → store messages) */
export function hydrateHistoryMessages(rows: readonly HistoryMessageRecord[]): ChatMessage[] {
  return rows.map(hydrateHistoryMessage)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
