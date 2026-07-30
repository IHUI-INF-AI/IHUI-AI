'use client'

import * as React from 'react'
import { HomeSections, TOTAL_PAGES } from '@/components/marketing/HomeSections'
import { PageIndicator } from '@/components/marketing/PageIndicator'
import { ScrollDownButton } from '@/components/marketing/ScrollDownButton'
import { useFullPageScroll } from '@/hooks/use-full-page-scroll'

/**
 * 工作区版首页(/home)
 *
 * 2026-07-28 改造:与营销首页 (/) 共用 HomeSections 7-section 内容,
 * 保持两处完全一致(分页结构 + 右侧 PageIndicator + 底部 ScrollDownButton + 7 section 内容)。
 *
 * 与营销首页 (/) 的差异:
 * - 路由在 (main) 路由组下,自动套用 MainShell(左侧 sidebar + 右侧工作区卡片)
 * - scroll 容器高度统一用 calc(100vh - 58px),与 (marketing)/page.tsx 完全一致
 *   (2026-07-31 修复:原 calc(100dvh - 180px) 是错误硬编码,导致 /home 与 // 首页高度不一致;
 *    统一基准 = 视口 - GlobalTopBar(50px) - MainShell pb-2(8px) = 100vh - 58px)
 * - 外层 -mx-4/-my-4 md:-mx-6/-my-6 lg:-mx-8/-my-8 抵消 MainShell main 的 padding,
 *   让 scroll 容器撑满工作区卡片可视区(高度等于工作区卡片高度 = 100vh - 58px)
 * - 不渲染 SiteFooter(由 HomeSections showFooter={false} 控制,工作区不需要 footer)
 * - 不再自动展开 AI 对话面板(避免遮挡分页内容)
 */
export default function WorkAreaHomePage() {
  const { section, scrollTo, next } = useFullPageScroll(TOTAL_PAGES)

  return (
    <>
      {/* 抵消 MainShell main 的 padding,让 scroll 容器撑满工作区卡片可视区
          - 高度统一为 calc(100vh - 58px),与 (marketing)/page.tsx 一致
          - 负 margin 抵消 main 的 p-4/p-6/p-8,让容器在 padding 区延伸(不改变高度) */}
      <div className="-mx-4 -my-4 md:-mx-6 md:-my-6 lg:-mx-8 lg:-my-8">
        <div
          id="home-scroll-container"
          className="snap-y snap-proximity overflow-x-hidden overflow-y-scroll"
          style={{ height: 'calc(100vh - 58px)' }}
        >
          <HomeSections showFooter={false} />
        </div>
      </div>

      {/* 右侧分页指示器 */}
      <PageIndicator current={section} total={TOTAL_PAGES} onClick={scrollTo} />

      {/* 底部向下滚动按钮 */}
      <ScrollDownButton current={section} total={TOTAL_PAGES} onNext={next} />
    </>
  )
}
