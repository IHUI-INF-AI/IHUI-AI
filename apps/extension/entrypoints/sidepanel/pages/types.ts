/**
 * Sidepanel 聊天消息类型。
 *
 * 统一从 @ihui/shared 导入基础 ChatMessage 类型(2026-07-27 立,跨端类型一致性)。
 * 共享基类字段:id / role('user' | 'assistant' | 'system') / content / createdAt? / model? / error? / reasoning? / toolCalls? / meta?。
 * 与原本地定义的差异:role 类型新增 'system' 字面量(基类支持 system 角色);新增可选字段(model/error/reasoning/toolCalls/meta/createdAt)。
 */
export type { ChatMessage } from '@ihui/shared'
