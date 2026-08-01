'use client'

import * as React from 'react'
import { HomeSections, TOTAL_PAGES } from '@/components/marketing/HomeSections'
import { getEnabledSectionCount } from '@/components/marketing/home-schema'
import { PageIndicator } from '@/components/marketing/PageIndicator'
import { PreviewBanner } from '@/components/marketing/PreviewBanner'
import { ScrollDownButton } from '@/components/marketing/ScrollDownButton'
import { useFullPageScroll } from '@/hooks/use-full-page-scroll'
import { useHomeSchema } from '@/hooks/use-home-schema'

/**
 * 营销首页(/)
 *
 * 2026-07-28 改造:7-section 主体抽到 HomeSections 共享组件,工作区版首页 /home 也复用
 * 同一份内容,保证两处完全一致(分页结构 + 右侧 PageIndicator + 底部 ScrollDownButton)。
 * 2026-08-01 P3-4.3:接入 Server-Driven UI,通过 useHomeSchema 加载后端 schema 配置,
 * section 顺序/显隐可由 admin 在 system_configs(category='home_schema')调整。
 *
 * - 外壳:scroll 容器(全屏 100vh - 58px) + useFullPageScroll hook
 * - 内容:HomeSections(schema 驱动,showFooter=true 渲染 SiteFooter)
 * - 控件:PageIndicator(右侧分页指示器)+ ScrollDownButton(底部向下按钮)
 */
export default function HomePage() {
  const schema = useHomeSchema()
  const { section, total, setTotal, scrollTo, next } = useFullPageScroll(TOTAL_PAGES)

  // schema 加载后同步更新分页总数(enabled section 数量)
  React.useEffect(() => {
    setTotal(getEnabledSectionCount(schema))
  }, [schema, setTotal])

  return (
    <>
      <PreviewBanner />
      {/* 全屏分页滚动容器
          - 显式 overflow-x-hidden 防止 Marquee/TypewriterHero/跑马灯等内容因
            transform/子元素宽度溢出产生横向滚动
          - 高度:calc(100vh - 58px) = 视口 - GlobalTopBar(50px) - marketing layout pb-2(8px)
            2026-07-31 修复:原 calc(100vh - 1rem)=100vh-16px 匹配旧布局 my-2 mr-2(上下 16px margin);
            marketing layout 改 pb-2 pr-2 后(顶部间距由 GlobalTopBar 50px 提供 + 底部 8px padding),
            main 比容器大 42px 导致内容溢出被 overflow-hidden 裁剪。
       */}
      <main
        id="home-scroll-container"
        className="snap-y snap-proximity overflow-x-hidden overflow-y-scroll"
        style={{ height: 'calc(100vh - 58px)' }}
      >
        <HomeSections schema={schema} />
      </main>

      {/* 右侧分页指示器 */}
      <PageIndicator current={section} total={total} onClick={scrollTo} />

      {/* 底部向下滚动按钮 */}
      <ScrollDownButton current={section} total={total} onNext={next} />
    </>
  )
}
