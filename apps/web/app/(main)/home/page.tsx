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
 * 保持两处完全一致(分页结构 + 右侧 PageIndicator + 底部 ScrollDownButton)。
 *
 * 与营销首页 (/) 的差异:
 * - 路由在 (main) 路由组下,自动套用 MainShell(左侧 sidebar + 右侧工作区卡片)
 * - scroll 容器用 calc(100dvh - 180px) 适配工作区高度
 *   (180px = sidebar 60~180px + 顶栏 32px + 顶部分隔 8px + 底部 8px + main padding 32px 估值)
 * - 不显示 SiteFooter(由 HomeSections showFooter={false} 控制)
 * - 不再自动展开 AI 对话面板(避免遮挡分页内容)
 */
export default function WorkAreaHomePage() {
  const { section, scrollTo, next } = useFullPageScroll(TOTAL_PAGES)

  return (
    <>
      {/* 抵消 MainShell main 的 padding,让 scroll 容器撑满工作区卡片可视区 */}
      <div className="-mx-4 -my-4 md:-mx-6 md:-my-6 lg:-mx-8 lg:-my-8">
        <div
          id="home-scroll-container"
          className="snap-y snap-proximity overflow-x-hidden overflow-y-scroll"
          style={{ height: 'calc(100dvh - 180px)' }}
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

