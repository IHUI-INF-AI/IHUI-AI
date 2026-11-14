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

/** 导出包格式版本:字段增删必须升版,消费方按版本判断能否解析。 */
export const CONVERSATION_EXPORT_SCHEMA_VERSION = 1 as const

/** 导出器署名(manifest 里如实记录,便于追溯由哪个端生成)。 */
export const CONVERSATION_EXPORT_GENERATOR = 'IHUI-AI' as const

export interface ConversationExportMessage {
  id: string
  role: string
  content: string
  createdAt?: string
  model?: string | null
}

export type ConversationExportRole = 'user' | 'assistant'

export type ConversationExportRoleLabel = Record<ConversationExportRole, string>

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

/** 可导出消息:仅 user / assistant 且有正文(空白消息导出后是空标题分节,没有信息量)。 */
export function isExportableMessage(
  message: Pick<ConversationExportMessage, 'role' | 'content'>,
): boolean {
  return (
    (message.role === 'user' || message.role === 'assistant') &&
    message.content.trim().length > 0
  )
}

/** 标题安全化:去控制字符 + 截断;空标题回落 `ai-chat`(下载文件名与 Markdown 一级标题共用)。 */
export function sanitizeExportTitle(title: string): string {
  const safe = title
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, 200)
  return safe || 'ai-chat'
}

/** 序列化为 Markdown:`## <角色>` 分节 + 正文;角色文案由调用方按语言传入。 */
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
