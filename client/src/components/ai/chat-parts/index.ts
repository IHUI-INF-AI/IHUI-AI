/**
 * AIChat 子组件统一导出
 *
 * 将 AIChat.vue 中职责清晰的 UI 区域拆分为独立子组件：
 * - ChatHeaderBar：标题栏（模型/模式标签、搜索、菜单、最小化、关闭、客服状态）
 * - ChatSearchBar：消息搜索栏及搜索结果列表
 * - ChatSessionPanel：已移除（会话历史入口统一走 Sidebar.vue 的 SidebarChatHistory）
 *
 * 样式统一通过 AIChat.vue 中的 @use '@/styles/ai-chat/xxx' 引入，
 * 子组件本身不携带 scoped 样式，以保持样式集中管理。
 */
export { default as ChatHeaderBar } from './ChatHeaderBar.vue'
export { default as ChatSearchBar } from './ChatSearchBar.vue'
