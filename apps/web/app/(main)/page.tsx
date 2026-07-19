/**
 * 工作台首页(/)
 *
 * 直接复用 /home 的实现(同组件,避免代码重复)。
 * - 路由在 (main) 路由组下,自动套用 MainShell(左侧 Sidebar + 右侧 AISidePanel)
 * - 首次进入时自动展开 AI 对话面板(由 /home 实现内的 useEffect 处理)
 * - 未登录用户由 middleware 拦截重定向到 /landing(营销落地页)
 *
 * /home 路由保留,兼容 sidebar/conversation-list 等已有链接。
 *
 * 营销落地页已迁移至 /landing(app/(marketing)/landing/page.tsx)。
 */
export { default } from './home/page'
