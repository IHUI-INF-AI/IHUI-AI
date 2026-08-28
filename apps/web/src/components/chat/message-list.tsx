'use client'

// 纯重构:把原 message-list.tsx 拆分为语义子组件/hook,本文件作为薄 barrel,
// 保持原公开 API(MessageList 命名导出 + 默认导出)不变,所有旧 importer 不受影响。
export { MessageList, default } from './message-list/MessageList'
