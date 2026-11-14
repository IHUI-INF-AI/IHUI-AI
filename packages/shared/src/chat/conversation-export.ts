// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 会话导出纯函数(Web / API / CLI 共用)。
 *
 * 为什么下沉到 shared:
 * - Web 端「导出 Markdown / 复制为 Markdown」与服务端「导出 ZIP」必须是同一份序列化
 *   规则,否则同一次导出会得到两份内容不一致的 markdown(历史上各类"导出用另一套格式"
 *   的分叉都由此产生);
 * - 本文件**只做字符串拼接与 JSON 序列化**,不读 DOM、不读 Node API、不取当前时间(时间
 *   由调用方传入),因此可被浏览器与 Node 同时引用,也便于钉死确定性测试。
 */

/**
 * 导出包格式版本:字段增删必须升版,消费方按版本判断能否解析。
 * v2(2026-11-14):messages.json 增加 reasoning / toolCalls(DSH 会话日志导出对等面)。
 */
export const CONVERSATION_EXPORT_SCHEMA_VERSION = 2 as const

/** 导出器署名(manifest 里如实记录,便于追溯由哪个端生成)。 */
export const CONVERSATION_EXPORT_GENERATOR = 'IHUI-AI' as const

/** 导出工具调用:从落库 metadata.toolCalls(persistedToolCallSchema loose 形态)收敛而来。 */
export interface ConversationExportToolCall {
  name: string
  status?: string
  isError?: boolean
  durationMs?: number
  args?: unknown
  result?: unknown
}

export interface ConversationExportMessage {
  id: string
  role: string
  content: string
  createdAt?: string
  model?: string | null
  /** 推理过程原文(assistant 消息;缺失=该轮没有或未落库)。 */
  reasoning?: string | null
  /** 工具调用及其结果(assistant 消息;已由落库侧做过体积护栏)。 */
  toolCalls?: ConversationExportToolCall[]
}

export type ConversationExportRole = 'user' | 'assistant'

export type ConversationExportRoleLabel = Record<ConversationExportRole, string> & {
  /** 工具调用小节的标题文案;缺省「工具调用」。 */
  toolCalls?: string
}

/** 单次导出最多携带的工具调用条数(防异常 metadata 把导出包撑爆)。 */
const MAX_EXPORT_TOOL_CALLS = 200
/** Markdown 里单个工具结果的预览上限(完整结果在 messages.json)。 */
const EXPORT_MARKDOWN_TOOL_RESULT_MAX_CHARS = 500
/** Markdown 里单个工具参数的预览上限。 */
const EXPORT_MARKDOWN_TOOL_ARGS_MAX_CHARS = 200

/**
 * 把落库的 metadata.toolCalls(loose JSON)收敛为导出结构。
 * 畸形输入一律跳过而不是抛错 —— 导出是只读旁路,不能因一条脏记录整包失败。
 */
export function normalizeExportToolCalls(value: unknown): ConversationExportToolCall[] {
  if (!Array.isArray(value)) return []
  const calls: ConversationExportToolCall[] = []
  for (const item of value) {
    if (calls.length >= MAX_EXPORT_TOOL_CALLS) break
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    const name =
      typeof record.toolName === 'string'
        ? record.toolName
        : typeof record.name === 'string'
          ? record.name
          : ''
    if (!name) continue
    calls.push({
      name,
      ...(typeof record.status === 'string' ? { status: record.status } : {}),
      ...(record.isError === true ? { isError: true } : {}),
      ...(typeof record.durationMs === 'number' && Number.isFinite(record.durationMs)
        ? { durationMs: record.durationMs }
        : {}),
      ...(record.args !== undefined ? { args: record.args } : {}),
      ...(record.result !== undefined ? { result: record.result } : {}),
    })
  }
  return calls
}

/** 导出 manifest:ZIP 里机器可读的"这包是什么"清单。 */
export interface ConversationExportManifest {
  schemaVersion: number
  generator: typeof CONVERSATION_EXPORT_GENERATOR
  conversationId: string
  title: string
  model: string | null
  createdAt: string | null
  updatedAt: string | null
  exportedAt: string
  messageCount: number
  userMessageCount: number
  assistantMessageCount: number
  firstMessageAt: string | null
  lastMessageAt: string | null
  files: string[]
}

export interface BuildExportManifestInput {
  conversationId: string
  title: string
  messages: ConversationExportMessage[]
  exportedAt: string
  model?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

/**
 * 可导出消息:user / assistant 且有正文;assistant 另外接受「只有推理或工具调用」
 * 的轮次(纯工具轮没有正文,但它承载了这轮发生过什么,丢掉等于篡改日志)。
 */
export function isExportableMessage(
  message: Pick<ConversationExportMessage, 'role' | 'content' | 'reasoning' | 'toolCalls'>,
): boolean {
  if (message.role !== 'user' && message.role !== 'assistant') return false
  if (message.content.trim().length > 0) return true
  if (message.role !== 'assistant') return false
  return (message.reasoning?.trim().length ?? 0) > 0 || (message.toolCalls?.length ?? 0) > 0
}

/** 标题安全化:去控制字符 + 截断;空标题回落 `ai-chat`(下载文件名与 Markdown 一级标题共用)。 */
export function sanitizeExportTitle(title: string): string {
  const safe = title
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, 200)
  return safe || 'ai-chat'
}

/** 任意工具值 → 可读文本;字符串原样,其余 JSON 序列化(失败降级 String)。 */
function stringifyExportValue(value: unknown): string {
  if (value === undefined || value === null) return ''
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

/** 截断并标注精确省略字符数(不四舍五入、不假装完整)。 */
function clipExportText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text
  return `${text.slice(0, maxChars)}…[省略 ${text.length - maxChars} 字符]`
}

/** 工具调用小节:一行调用 + 结果预览围栏(完整结果在 messages.json)。 */
function buildToolCallMarkdown(
  calls: ConversationExportToolCall[] | undefined,
  label: string,
): string[] {
  if (!calls || calls.length === 0) return []
  const lines: string[] = [`### ${label}`, '']
  for (const call of calls) {
    const status = call.status ? ` (${call.status})` : ''
    const failed = call.isError ? '（失败）' : ''
    const args = stringifyExportValue(call.args).replace(/`/g, "'")
    const argsPart = args
      ? ` · 参数: \`${clipExportText(args, EXPORT_MARKDOWN_TOOL_ARGS_MAX_CHARS)}\``
      : ''
    lines.push(`- \`${call.name}\`${status}${failed}${argsPart}`)
    const result = stringifyExportValue(call.result)
    if (result) {
      const clipped = clipExportText(result, EXPORT_MARKDOWN_TOOL_RESULT_MAX_CHARS)
      lines.push('  ```text', ...clipped.split('\n').map((line) => `  ${line}`), '  ```')
    }
  }
  lines.push('')
  return lines
}

/** 序列化为 Markdown:`## <角色>` 分节 + 正文;assistant 追加工具调用小节。 */
export function buildConversationMarkdown(
  title: string,
  messages: ConversationExportMessage[],
  roleLabel: ConversationExportRoleLabel,
): string {
  const lines: string[] = [`# ${sanitizeExportTitle(title)}`, '']
  for (const message of messages) {
    if (!isExportableMessage(message)) continue
    const role = message.role as ConversationExportRole
    lines.push(`## ${roleLabel[role]}`, '', message.content.trimEnd(), '')
    if (role === 'assistant') {
      lines.push(...buildToolCallMarkdown(message.toolCalls, roleLabel.toolCalls ?? '工具调用'))
    }
  }
  return lines.join('\n')
}

/** 序列化为 JSON(逐字段白名单,不把内部字段漏进导出包)。 */
export function buildConversationMessagesJson(
  title: string,
  messages: ConversationExportMessage[],
  exportedAt: string,
): string {
  const exportable = messages.filter(isExportableMessage)
  return JSON.stringify(
    {
      schemaVersion: CONVERSATION_EXPORT_SCHEMA_VERSION,
      generator: CONVERSATION_EXPORT_GENERATOR,
      title: sanitizeExportTitle(title),
      exportedAt,
      messageCount: exportable.length,
      messages: exportable.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        createdAt: message.createdAt ?? null,
        model: message.model ?? null,
        ...(message.reasoning ? { reasoning: message.reasoning } : {}),
        ...(message.toolCalls && message.toolCalls.length > 0
          ? { toolCalls: message.toolCalls }
          : {}),
      })),
    },
    null,
    2,
  )
}

/**
 * 生成 manifest。
 * 统计口径与 messages.json 完全一致(都先过 `isExportableMessage`),
 * 避免出现"manifest 说有 10 条、包里只有 8 条"的对不上账。
 */
export function buildConversationExportManifest(
  input: BuildExportManifestInput,
): ConversationExportManifest {
  const exportable = input.messages.filter(isExportableMessage)
  const times = exportable
    .map((message) => message.createdAt)
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .sort()
  const models = exportable
    .map((message) => message.model)
    .filter((value): value is string => typeof value === 'string' && value.length > 0)

  return {
    schemaVersion: CONVERSATION_EXPORT_SCHEMA_VERSION,
    generator: CONVERSATION_EXPORT_GENERATOR,
    conversationId: input.conversationId,
    title: sanitizeExportTitle(input.title),
    model: input.model ?? models[0] ?? null,
    createdAt: input.createdAt ?? null,
    updatedAt: input.updatedAt ?? null,
    exportedAt: input.exportedAt,
    messageCount: exportable.length,
    userMessageCount: exportable.filter((message) => message.role === 'user').length,
    assistantMessageCount: exportable.filter((message) => message.role === 'assistant').length,
    firstMessageAt: times[0] ?? null,
    lastMessageAt: times[times.length - 1] ?? null,
    files: ['conversation.md', 'messages.json', 'manifest.json'],
  }
}

/** manifest 的字符串形态(JSON 格式化后的稳定输出)。 */
export function buildConversationExportManifestJson(input: BuildExportManifestInput): string {
  return JSON.stringify(buildConversationExportManifest(input), null, 2)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
