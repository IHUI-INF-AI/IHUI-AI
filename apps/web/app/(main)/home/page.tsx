'use client'

import * as React from 'react'
import { HomeSections, TOTAL_PAGES } from '@/components/marketing/HomeSections'
import { getEnabledSectionCount } from '@/components/marketing/home-schema'
import { PageIndicator } from '@/components/marketing/PageIndicator'
import { PreviewBanner } from '@/components/marketing/PreviewBanner'
import { useFullPageScroll } from '@/hooks/use-full-page-scroll'
import { useHomeSchema } from '@/hooks/use-home-schema'

/**
 * 工作区版首页(/home)
 *
 * 2026-07-28 改造:与营销首页 (/) 共用 HomeSections 7-section 内容,
 * 保持两处完全一致(分页结构 + 右侧 PageIndicator + 7 section 内容)。
 * 2026-08-01 P3-4.3:接入 Server-Driven UI,通过 useHomeSchema 加载后端 schema 配置。
 *
 * 与营销首页 (/) 的差异:
 * - 路由在 (main) 路由组下,自动套用 MainShell(左侧 sidebar + 右侧工作区卡片)
 * - scroll 容器高度统一用 calc(100vh - 58px),与 (marketing)/page.tsx 完全一致
 *   (2026-07-31 修复:原 calc(100dvh - 180px) 是错误硬编码,导致 /home 与 // 首页高度不一致;
 *    统一基准 = 视口 - GlobalTopBar(50px) - MainShell pb-2(8px) = 100vh - 58px)
 * - 外层 div 包裹 scroll 容器(2026-08-02:删除原负 margin抵消,因 MainShell main 已无 padding)
 *   让 scroll 容器撑满工作区卡片可视区(高度等于工作区卡片高度 = 100vh - 58px)
 * - 不渲染 SiteFooter(由 HomeSections showFooter={false} 控制,工作区不需要 footer)
 * - 不再自动展开 AI 对话面板(避免遮挡分页内容)
 */
export default function WorkAreaHomePage() {
  const schema = useHomeSchema()
  const { section, total, setTotal, scrollTo } = useFullPageScroll(TOTAL_PAGES)

  // schema 加载后同步更新分页总数(enabled section 数量)
  React.useEffect(() => {
    setTotal(getEnabledSectionCount(schema))
  }, [schema, setTotal])

  return (
    <>
      <PreviewBanner />
      {/* 2026-08-02 修复:删除 -mx-4/-my-4 md:-mx-6/-my-6 lg:-mx-8/-my-8 负 margin
          根因:MainShell main 在 2026-08-01 已去掉 padding(原 p-3 laptop:p-8),
          负 margin 无 padding 可抵消 → home-scroll-container 左右各超出 #main 32px(共 64px),
          被工作区卡片 overflow-hidden 裁剪,视觉上右侧内容超出容器。
          高度仍统一为 calc(100vh - 58px),与 (marketing)/page.tsx 一致。 */}
      <div>
        <div
          id="home-scroll-container"
          className="snap-y snap-proximity overflow-x-hidden overflow-y-scroll"
          style={{ height: 'calc(100vh - 58px)' }}
        >
          <HomeSections showFooter={false} schema={schema} />
        </div>
      </div>

      {/* 右侧分页指示器 */}
      <PageIndicator current={section} total={total} onClick={scrollTo} />
    </>
  )
}
