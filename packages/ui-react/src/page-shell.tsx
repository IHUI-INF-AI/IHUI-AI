/**
 * PageShell — Web 系三端(web + extension + desktop)共用页面级布局外壳
 * (2026-08-01 抽取到共享包,P3-2.3)
 *
 * 背景: 此前 web/extension/desktop 三端各自的页面级布局(header + sidebar +
 * main + footer)在端内分散实现,结构相似但 padding/滚动行为/暗色 token 不一致,
 * 维护时需要三端同步改动,且易漂移。
 *
 * 本组件为单一来源(single source of truth),提供标准 app shell 结构:
 *   - 外层 h-screen flex flex-col overflow-hidden(锁定视口,内部滚动)
 *   - header(顶部,shrink-0):title(h1) + header slot(工具栏/操作)
 *   - 中段 flex-1 overflow-hidden:sidebar(左,shrink-0,独立滚动)+ main(主体,flex-1 overflow-y-auto)
 *   - footer(底部,shrink-0)
 *
 * 视觉规范(AGENTS.md §4 配套):
 *   - 紧凑(compact)、优雅(elegant),hover 用 subtle 颜色变化
 *   - 无分割线(§4):header/sidebar/footer 之间用背景色对比(bg-card vs bg-background)分隔,禁止 border-t/divide-y
 *   - 无蓝色发光边框:仅用语义 token(bg-background / text-foreground / bg-card)
 *   - 无纯圆形容器:不使用 rounded-full(§4 圆角守门)
 *   - main 内边距:p-4 min-[768px]:p-6(移动/桌面响应式)
 *   - 暗色模式:语义 token 自动适配(bg-background / text-foreground / bg-card)
 *
 * 用法:
 *   <PageShell title="设置" header={<Button>保存</Button>} sidebar={<Nav />} footer={<Status />}>
 *     <SettingsContent />
 *   </PageShell>
 *
 * 平台差异:
 *   - 外层高度默认 h-screen(锁定视口),extension popup 等固定高度场景可 className 覆盖
 *   - sidebar 默认 w-56 min-[768px]:w-64,如需其他宽度可在 sidebar 内容外层包 div 设宽度(aside shrink-0)
 *   - className 通过 cn() 合并(twMerge 支持冲突覆盖,如 min-h/h/w 等)
 */
import * as React from 'react'
import { cn } from './lib/utils'

export interface PageShellProps {
  /** 页面标题(渲染为 h1,semibold tracking-tight);与 header 可同时使用 */
  title?: React.ReactNode
  /** 顶部工具栏/操作区 slot(渲染在 title 右侧,flex-1 占满剩余空间) */
  header?: React.ReactNode
  /** 左侧导航 slot(渲染为 aside,shrink-0,独立 overflow-y-auto) */
  sidebar?: React.ReactNode
  /** 底部 slot(渲染为 footer,shrink-0) */
  footer?: React.ReactNode
  /** 主体内容(渲染在 main 内,flex-1 overflow-y-auto + p-4 min-[768px]:p-6) */
  children: React.ReactNode
  /** 外层容器 className(通过 cn() 合并,可覆盖 h-screen 等默认值) */
  className?: string
}

/**
 * 页面级布局外壳 — Web 系三端共用。
 *
 * 结构:header(顶) → [sidebar(左) + main(主体)] → footer(底)
 * 滚动:外层 h-screen overflow-hidden 锁定视口,sidebar/main 各自独立 overflow-y-auto
 * 分隔:用 bg-card(header/sidebar/footer)vs bg-background(主体)背景色对比,无分割线
 */
export function PageShell({
  title,
  header,
  sidebar,
  footer,
  children,
  className,
}: PageShellProps) {
  const hasHeader = Boolean(title || header)
  return (
    <div
      className={cn(
        'flex h-screen flex-col overflow-hidden bg-background text-foreground',
        className,
      )}
    >
      {hasHeader && (
        <header className="flex shrink-0 items-center gap-3 bg-card px-4 py-3 min-[768px]:px-6">
          {title && (
            <h1 className="shrink-0 text-lg font-semibold leading-none tracking-tight">
              {title}
            </h1>
          )}
          {header && <div className="flex flex-1 items-center gap-2">{header}</div>}
        </header>
      )}
      <div className="flex flex-1 overflow-hidden">
        {sidebar && (
          <aside className="w-56 shrink-0 overflow-y-auto bg-card min-[768px]:w-64">{sidebar}</aside>
        )}
        <main className="flex-1 overflow-y-auto p-4 min-[768px]:p-6">{children}</main>
      </div>
      {footer && (
        <footer className="shrink-0 bg-card px-4 py-3 min-[768px]:px-6">{footer}</footer>
      )}
    </div>
  )
}
