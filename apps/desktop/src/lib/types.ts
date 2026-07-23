/**
 * 桌面前端 UI 消息状态类型(本地保留,不复用 @ihui/types 的 ChatMessage)。
 *
 * 原因:@ihui/types 的 ChatMessage 是 LLM API 调用消息格式(role + content 简版,无 id),
 * 此处是桌面前端 UI 状态消息(必含 id 字段用于 React key 与状态更新,role 收窄为 user/assistant)。
 * 两者语义不同:LLM API 消息格式 vs 前端 UI 状态类型,强行合并会让 packages/types ChatMessage
 * 变成大杂烩(LLM API 格式 + UI 状态格式),污染共享类型包。
 *
 * 命名保留 ChatMessage 是因为桌面端仅此一种 chat 消息类型,无命名冲突风险(桌面端未引用 @ihui/types ChatMessage)。
 */
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  /** 用户消息可携带附件(图片 base64 / 文本内容),AI 回复无附件。 */
  attachments?: ChatAttachment[]
}

export interface ChatAttachment {
  /** 文件名(显示用)。 */
  name: string
  /** MIME 类型(image/png / text/plain 等)。 */
  mime: string
  /** 文件大小(字节)。 */
  size: number
  /** 文件内容:图片用 base64 data URL,文本用纯文本内容,其他二进制用 base64。 */
  data: string
  /** 是否为图片(用于 UI 渲染判断)。 */
  isImage: boolean
}
