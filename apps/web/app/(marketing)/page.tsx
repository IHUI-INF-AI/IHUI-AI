'use client'

import * as React from 'react'
import { HomeSections, TOTAL_PAGES } from '@/components/marketing/HomeSections'
import { PageIndicator } from '@/components/marketing/PageIndicator'
import { ScrollDownButton } from '@/components/marketing/ScrollDownButton'
import { useFullPageScroll } from '@/hooks/use-full-page-scroll'

/**
 * 营销首页(/)
 *
 * 2026-07-28 改造:7-section 主体抽到 HomeSections 共享组件,工作区版首页 /home 也复用
 * 同一份内容,保证两处完全一致(分页结构 + 右侧 PageIndicator + 底部 ScrollDownButton)。
 *
 * - 外壳:scroll 容器(全屏 100vh - 1rem) + useFullPageScroll hook
 * - 内容:HomeSections(showFooter=true 渲染 SiteFooter)
 * - 控件:PageIndicator(右侧分页指示器)+ ScrollDownButton(底部向下按钮)
 */
export default function HomePage() {
  const { section, scrollTo, next } = useFullPageScroll(TOTAL_PAGES)

  return (
    <>
      {/* 全屏分页滚动容器
          - 显式 overflow-x-hidden 防止 Marquee/TypewriterHero/跑马灯等内容因
            transform/子元素宽度溢出产生横向滚动
       */}
      <main
        id="home-scroll-container"
        className="snap-y snap-proximity overflow-x-hidden overflow-y-scroll"
        style={{ height: 'calc(100vh - 1rem)' }}
      >
        <HomeSections />
      </main>

      {/* 右侧分页指示器 */}
      <PageIndicator current={section} total={TOTAL_PAGES} onClick={scrollTo} />

      {/* 底部向下滚动按钮 */}
      <ScrollDownButton current={section} total={TOTAL_PAGES} onNext={next} />
    </>
  )
}
