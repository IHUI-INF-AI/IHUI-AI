/**
 * /chat 路由(2026-07-28 重构):
 * - AI 对话的实际承载组件是全局 docked 的 AISidePanel,通过 useAiPanelStore.open 控制
 * - /chat 路由本身只是 AI 面板的快捷入口,不应在主工作区重复渲染"任务列表"等 AI 相关 UI
 *   (用户反馈:右侧"任务列表"几行文字与 AI 面板完全重复,属于冗余)
 * - 因此 /chat 复用 /home 的工作区首页内容(已自动打开 AI 面板,体验一致)
 *   保持 /chat URL 仍可访问,导航/书签/SEO 都不破坏
 */
export { default } from '../home/page'
