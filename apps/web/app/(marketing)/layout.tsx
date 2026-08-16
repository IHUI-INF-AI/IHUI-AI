import * as React from 'react'
import type { Metadata } from 'next'

/**
 * Marketing 路由组布局
 *
 * - Server Component(含 metadata export)
 * - Sidebar + AISidePanel 由根 layout.tsx 的 GlobalShell 全局提供(全站统一导航)
 * - 与 (main) 路由组 MainShell 同款 wrapper + 卡片双层结构:
 *     wrapper: pb-2 pl-2 pr-2    ← 给卡片跟 work-area 四边各 8px 呼吸空
 *     card:    rounded-xl bg-shell-panel overflow-hidden
 *   2026-07-31 第十六次微调(用户反馈"内容展示区左侧贴屏边 / 右侧有间距,应该统一"):
 *   之前单层 div 既是 wrapper 又是卡片(卡片全宽,pl-2/pr-2 只是卡片内部 padding,
 *   卡片本身仍贴屏),现在拆成 wrapper + 卡片双层,卡片本身有 8px 边距跟 work-area 隔开,
 *   移动端 sidebar 隐藏时卡片左右都有 8px 呼吸空(跟桌面端 sidebar 130px 右侧的视觉一致)。
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
 *   div pb-2 pl-2 pr-2              ← wrapper(给卡片 8px 边距)
 *     div rounded-xl bg-shell-panel overflow-hidden
 *       children                    (首页 main 用 height: calc(100vh - 58px) 独立滚动,
 *                                    SiteFooter 在 main 内部末尾,跟随 main 滚动可见)
 *   /div
 *
 * 高度策略:
 * - wrapper flex-1 min-h-0:在 GlobalShell 内容槽(flex 容器)中正确填充
 * - card flex-1 min-h-0:在 wrapper 中填充(扣除 pb-2 后的剩余高度)
 * - overflow-hidden:裁剪子元素溢出 + 保持圆角不被覆盖
 * - pb-2 pl-2 pr-2:跟 MainShell 完全一致(顶部间距由 GlobalTopBar 的 pt-2+h-9+pb-1.5=50px 提供,
 *   底部 8px + 左侧 8px + 右侧 8px 用 wrapper padding),确保 WebWorkPanel 的 mt-[50px] 在所有路由组都对齐
 *   工作区卡片顶部
 */
export const metadata: Metadata = {
  title: {
    default: '智汇 AI 社区 — 8 端全覆盖 · 100+ LLM · 自研 CLI 对标 Claude Code · 省 ¥18 万/年',
    template: '%s | 智汇 AI',
  },
  description:
    '8 端全覆盖(Web/桌面/移动/小程序/CLI/扩展/API/AI-Service)企业级 AI 平台,覆盖范围较广。100+ LLM 大模型一个 API Key 全访问(国际 30+/国产 15+/云 40+),LangGraph+MCP+A2A 三栈合一,11 MCP 工具+5 A2A 端点+6 ACP 扩展,17 项 pre-commit 守门+122+ migrations 工业级严谨。5 大决策者场景(降本/提效/学习/创新/决策)· 8 项可量化 ROI(省 ¥18-30 万/年 · 10× 加速 · 60% 降本 · 99.9% SLA)· 8 行竞品对比多维度可对标 Claude Code/Cursor/ChatGPT。限 18 席决策者 · 早鸟价 ¥6000/年(3.3 折)· 不满意全额退款 · 1v1 AI 顾问 + AI 文化落地陪跑。',
  keywords: [
    'AI 平台',
    '8 端全覆盖',
    '100+ LLM',
    'LangGraph',
    'MCP',
    'A2A',
    'ACP Server',
    '自研 CLI',
    'Claude Code 替代',
    'Cursor 替代',
    'ChatGPT 替代',
    '企业 AI',
    '决策者社群',
    'AI 文化落地',
    '人机协同',
    'Qwen',
    'DeepSeek',
    'GLM',
    'Llama',
    'AI 降本',
    'AI 提效',
    'ROI',
    'AI 教育',
    'AI 培训',
    'AI 课程',
    'AI 直播',
    '企业 AI 平台',
    '决策者 AI 顾问',
    '18 席决策者',
    'AI 工作流',
    '智能体',
  ],
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    siteName: '智汇 AI 社区',
    title: '智汇 AI 社区 — 8 端全覆盖 · 100+ LLM · 自研 CLI · 省 ¥18 万/年',
    description:
      '8 端全覆盖企业级 AI 平台 · 5 大决策者场景 · 8 项可量化 ROI · 8 行竞品对比多维度可对标 · 限 18 席 · 早鸟价 ¥6000/年 · 不满意全额退款',
  },
}

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    // 2026-07-31 第十六次微调(用户反馈"内容展示区左侧贴屏边 / 右侧有间距,应该统一"):
    // 拆成 wrapper + 卡片双层,跟 MainShell 完全对齐:
    // - wrapper: pb-2 pl-[var(--topbar-content-left)] pr-2  ← 左侧对齐顶栏搜索按钮,右侧底部 8px 边距
    // - card:    rounded-xl bg-shell-panel overflow-hidden  ← 卡片视觉
    // 移动端 sidebar 隐藏 → wrapper 占满 work-area → 卡片有正确左侧偏移(=mobileMenu宽度)+右侧 8px 呼吸空
    // 桌面端 sidebar 130px → wrapper 在 sidebar 右侧 → 卡片左侧对齐搜索按钮(pl=0)+右侧 8px 呼吸空
    //
    // ⚠️ 2026-08-01 修复:pl-2 硬编码 8px → pl-[var(--topbar-content-left)] 与 MainShell 对齐,
    // 消除 8px 错位。与 MainShell 统一:
    // - 桌面端(≥1024px):--topbar-content-left=0px,无左侧 padding
    // - 移动端(<1024px):--topbar-content-left=46px(动态测量),对齐搜索按钮
    // - pl-2 去掉:MainShell wrapper 也没有单独的 pl-2
    // 2026-08-12 回退:pb-0 → pb-2(用户反馈"工作展示区不应贴屏底,应保留 8px 呼吸空";
    // 上一版改 pb-0 是为了强行让 footer 贴屏底,破坏了卡片底部 8px 呼吸空。
    // 正确策略:让 footer 在 page-7 内部自然紧跟内容,外层 8px padding 保留视觉舒适度)
    <div className="flex min-h-0 flex-1 flex-col pb-2 pl-[var(--topbar-content-left)] pr-2">
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-shell-panel">
        {children}
      </div>
    </div>
  )
}
