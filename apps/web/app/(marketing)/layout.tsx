import * as React from 'react'
import type { Metadata } from 'next'

/**
 * Marketing 路由组布局
 *
 * - Server Component(含 metadata export)
 * - Sidebar + AISidePanel 由根 layout.tsx 的 GlobalShell 全局提供(全站统一导航)
 * - 与 (main) 路由组 MainShell 同款卡片容器结构:rounded-xl + bg-shell-panel + my-2 mr-2
 * - 已移除 MarketingHeader(2026-07-20):sidebar 已含全部 6 个路由
 *   (enterprise/learn/agents/news/ai-world/dashboard)+ 登录入口 + 品牌 logo,
 *   MarketingHeader 是纯冗余,违反"左侧侧边栏统一导航"项目设定
 * - SiteFooter 由各子页面自行渲染(首页放在 main 滚动流末尾,作为最后一个 snap section,
 *   跟随 main 滚动可见,避免 layout 中悬浮不可达)
 *
 * 路由组 (marketing) 不影响 URL 路径:
 *   /(marketing)/page.tsx          → /
 *
 * 结构(填充在 GlobalShell 内容槽内):
 *   div rounded-xl bg-shell-panel my-2 mr-2 overflow-hidden
 *     children          (首页 main 用 height: calc(100vh - 1rem) 独立滚动,
 *                        SiteFooter 在 main 内部末尾,跟随 main 滚动可见)
 *   /div
 *
 * 高度策略:
 * - flex-1 min-h-0:在 GlobalShell 内容槽(flex 容器)中正确填充
 * - overflow-hidden:裁剪子元素溢出 + 保持圆角不被覆盖
 * - my-2 mr-2:与 GlobalShell 的 Sidebar 之间留 8px 间距,与视口顶部/底部留 8px 间距
 */
export const metadata: Metadata = {
  title: {
    default: '智汇 AI 社区 — 8 端全覆盖 · 100+ LLM · 自研 CLI 对标 Claude Code · 省 ¥18 万/年',
    template: '%s | 智汇 AI',
  },
  description:
    '行业唯一 8 端全覆盖(Web/桌面/移动/小程序/CLI/扩展/API/AI-Service)企业级 AI 平台。100+ LLM 大模型一个 API Key 全访问(国际 30+/国产 15+/云 40+),LangGraph+MCP+A2A 三栈合一,11 MCP 工具+5 A2A 端点+6 ACP 扩展,17 项 pre-commit 守门+122+ migrations 工业级严谨。5 大决策者场景(降本/提效/学习/创新/决策)· 8 项可量化 ROI(省 ¥18-30 万/年 · 10× 加速 · 60% 降本 · 99.9% SLA)· 8 行竞品对比全维度超越 Claude Code/Cursor/ChatGPT。限 18 席决策者 · 早鸟价 ¥6000/年(3.3 折)· 不满意全额退款 · 1v1 AI 顾问 + AI 文化落地陪跑。',
  keywords: [
    'AI 平台', '8 端全覆盖', '100+ LLM', 'LangGraph', 'MCP', 'A2A', 'ACP Server',
    '自研 CLI', 'Claude Code 替代', 'Cursor 替代', 'ChatGPT 替代', '企业 AI',
    '决策者社群', 'AI 文化落地', '人机协同', 'Qwen', 'DeepSeek', 'GLM', 'Llama',
    'AI 降本', 'AI 提效', 'ROI', 'AI 教育', 'AI 培训', 'AI 课程', 'AI 直播',
    '企业 AI 平台', '决策者 AI 顾问', '18 席决策者', 'AI 工作流', '智能体',
  ],
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    siteName: '智汇 AI 社区',
    title: '智汇 AI 社区 — 8 端全覆盖 · 100+ LLM · 自研 CLI · 省 ¥18 万/年',
    description: '行业唯一 8 端全覆盖企业级 AI 平台 · 5 大决策者场景 · 8 项可量化 ROI · 8 行竞品对比全维度超越 · 限 18 席 · 早鸟价 ¥6000/年 · 不满意全额退款',
  },
}

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-shell-panel my-2 mr-2">
      {children}
    </div>
  )
}
