// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D45 会话详情聚合档位过滤层(2026-09-24 立,G-53)。
 *
 * 与 fold-policy(D21)语义正交:fold 管单个 section 展开/折叠,本层管信息聚合
 * 粒度(过滤哪些类别的活动条目呈现)。不修改 fold-policy 任何现有行为。
 *
 * 工具类目复用唯一入口 tool-category.ts(不新建第二套分组逻辑)。
 * 纯函数,作用于消息流时间线渲染入口(MessageList 装配处),可单测。
 */
import type { ChatMessage } from '@/stores/chat'
import {
  resolveToolCategory,
  type CategoryKey,
} from '@/components/ai/progress-sections/tool-category'
import type { ConversationDetailMode } from '@/stores/conversation-detail-mode'

export type { ConversationDetailMode }

/** commands 档保留的类目:命令执行 + 文件写入/修改/删除(对标 Codex STEPS_COMMANDS) */
export const COMMAND_CATEGORIES: readonly CategoryKey[] = [
  'command',
  'file_write',
  'file_modify',
  'file_delete',
]

/** 单工具是否属于命令/文件写入类(commands 档保留判据) */
export function isCommandToolCall(toolName: string): boolean {
  return COMMAND_CATEGORIES.includes(resolveToolCategory(toolName))
}

/** commands 档:保留命令类工具调用,隐藏叙述正文;无命令条目且无挂起提问的消息整条隐藏 */
function toCommandsView(messages: readonly ChatMessage[]): ChatMessage[] {
  const kept: ChatMessage[] = []
  for (const m of messages) {
    if (m.role !== 'assistant') {
      kept.push(m)
      continue
    }
    const commands = (m.toolCalls ?? []).filter((tc) => isCommandToolCall(tc.toolName))
    const hasQuestion = m.question != null
    // 错误交代(失败原因文本)属用户必读信息,命令视图保留
    if (commands.length === 0 && !hasQuestion && !m.error) continue
    kept.push({
      ...m,
      // 命令视图只呈现命令与文件写入条目:叙述正文/推理/计划/子代理活动隐藏,
      // 终端任务即命令执行,保留
      content: hasQuestion || m.error ? m.content : '',
      reasoning: undefined,
      planSteps: undefined,
      subagentActivities: undefined,
      toolCalls: commands,
    })
  }
  return kept
}

/** narrative 档:只保留叙述性正文,隐藏全部活动条目;无正文的 assistant 消息整条隐藏 */
function toNarrativeView(messages: readonly ChatMessage[]): ChatMessage[] {
  const kept: ChatMessage[] = []
  for (const m of messages) {
    if (m.role !== 'assistant') {
      kept.push(m)
      continue
    }
    const hasQuestion = m.question != null
    if (!m.content.trim() && !hasQuestion) continue
    kept.push({
      ...m,
      reasoning: undefined,
      toolCalls: undefined,
      planSteps: undefined,
      terminalTasks: undefined,
      subagentActivities: undefined,
    })
  }
  return kept
}

/**
 * 按档位过滤消息流:'steps' 恒返回原数组(零开销直通),
 * 'commands'/'narrative' 返回过滤后的浅拷贝(不改原消息对象)。
 */
export function applyConversationDetailMode(
  messages: readonly ChatMessage[],
  mode: ConversationDetailMode,
): ChatMessage[] {
  if (mode === 'commands') return toCommandsView(messages)
  if (mode === 'narrative') return toNarrativeView(messages)
  return [...messages]
}
