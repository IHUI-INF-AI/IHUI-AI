'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'

interface PageIndicatorProps {
  /** 当前页索引(0-based) */
  current: number
  /** 总页数 */
  total: number
  /** 点击跳转到指定页(0-based) */
  onClick: (index: number) => void
}

/**
 * 右侧固定分页指示器 — 现代圆点风
 *
 * 2026-07-21 v7 缩窄精致化:用户反馈"容器太宽了 请缩窄 精致点"。
 *   - 容器内边距 px-1 (4px) → px-0.5 (2px),总宽 28px → 20px (-29%)
 *   - button 命中区 h-5 w-5 (20×20) → h-4 w-4 (16×16),点保持原大小
 *   - active 竖向胶囊 h-5 w-2 (20×2) → h-4 w-2 (16×8),宽度与非激活态直径统一为 8px
 *   - gap 6px (1.5) → 4px (1),更紧凑
 *   - py-2 (8px) → py-1.5 (6px),上下更贴圆点
 *   - 整体精致度提升,点与点间节奏更紧凑
 * 2026-08-13 v10 等比例:用户三轮反馈最终确认"宽度跟下面圆统一为 8 没毛病啊,
 *   高度你要调整大咯" — 明确设计:
 *   - 宽度 = 8(与非激活态直径一致,w-2)
 *   - 高度 = 24(3x 直径,h-6,放大)
 *   - 激活态 = 24x8 竖向胶囊(3:1 比例),保持"竖向拉长"激活态视觉特征
 *   - 非激活态 = 8x8 圆点(h-2 w-2,1x 直径)
 *   - hover 态 = 10x10 圆点(h-2.5 w-2.5,1.25x 直径,作为可点击视觉反馈)
 *   - button 命中区同步调整为 h-6 w-2 (24x8) 容下激活态,非激活/hover 态居中
 *   - 激活态通过"宽度 = 直径 + 高度 = 3x 直径"形成竖向胶囊,与非激活圆点形成强对比
 *
 * 2026-07-20 v6 毛玻璃容器:用户反馈"圆点裸浮在内容上缺少承载感"。
 *   - 容器加 rounded-md + bg-background/65 + backdrop-blur-md
 *   - 极轻 border-foreground/8 + shadow-sm
 *   - group/indicator 命名空间避免与按钮内 group 冲突
 */
export function PageIndicator({ current, total, onClick }: PageIndicatorProps) {
  const t = useTranslations('marketing.indicator')
  if (total <= 1) return null
  return (
    <div
      // 2026-07-21 v7:缩窄精致化 - px-1→px-0.5,py-2→py-1.5,gap-1.5→gap-1
      // 2026-07-28 修复:位置跑偏根因是旧公式把左侧的 sidebar/ai-panel 算进了 right
      //   - sidebar / ai-panel 都在 viewport 左侧(GlobalShell flex 流),不影响工作区右边
      //   - 工作区右边距 viewport 右边固定 8px(由 (marketing)/layout.tsx 与 MainShell.tsx 的 mr-2 决定)
      //   - 指示器贴工作区右边 24px → right = 8 + 24 = 32px(距 viewport 右边)
      //   - 与 sidebar 折叠/展开、ai-panel 开/关 全部无关(它们只影响工作区左边)
      // 2026-07-28 v9.3:卡片内边距感 — 10px → 12px(完全在卡片内)
      //   - 用户反馈"我就是要卡片内边距感 刚才你应该是弄错了"
      //   - v9.1 10px:指示器右边距工作区卡片右边 = 10 - 8 = 2px,探出卡片外,违反"卡片内"约束
      //   - v9.2 12px:指示器右边距工作区卡片右边 = 12 - 8 = 4px,完全在卡片内
      //   - 容器宽 20px,左边距 viewport 边 32px,工作区内从容不悬空
      //   - 容器完全在卡片内,不被卡片右边缘裁切,符合"卡片内边距感"
      // 2026-07-28 v9.2 卡片内边距感初版:10px → 12px
      // 2026-07-28 v9.1:贴屏幕右 32px → 10px(用户原要求"更贴近屏幕右侧")
      // 2026-07-28 v9 根因修复:旧公式把左侧 sidebar/ai-panel 算进 right,
      //   实则工作区右边距 viewport 固定 8px(mr-2),与 sidebar/ai-panel 开关无关
      style={{ right: '12px' }}
      className="group/indicator fixed top-1/2 z-sticky hidden -translate-y-1/2 flex-col gap-1 rounded-md border border-foreground/8 bg-background/65 px-0.5 py-1.5 shadow-sm backdrop-blur-md transition-all duration-300 hover:border-foreground/15 hover:bg-background/85 hover:shadow-md min-[768px]:flex"
      aria-label={t('label')}
    >
      {Array.from({ length: total }).map((_, idx) => {
        const isActive = idx === current
        return (
          // 2026-07-21 v7:button 命中区 h-5 w-5 → h-4 w-4,缩窄但不损失点击
          <button
            key={idx}
            type="button"
            onClick={() => onClick(idx)}
            aria-label={t('switchTo', { index: idx + 1 })}
            aria-current={isActive ? 'true' : undefined}
            // 2026-08-13 v10:button 命中区 h-4 w-4 (16x16) → h-6 w-6 (24x24),容下 24x8 激活态胶囊
            // 正方形命中区让激活态(24x8)/非激活态(8x8)/hover态(10x10)都能在中心完美居中
            className="group flex h-6 w-6 items-center justify-center"
          >
            <span
              // 2026-07-21 v8:拆分 isActive 两套完整 className — 修 bug
              // 旧实现模板字符串拼接导致 h-4 / h-2、w-1.5 / w-2 同元素冲突,Tailwind 源序后值获胜
              // → 非激活态被拉成 16x8 竖向胶囊,所有点都成椭圆。修复后非激活 8x8 圆点、激活 16x8 胶囊(等宽)。
              // 2026-08-13 v10:激活态改为 24x8 (h-6 w-2) 竖向胶囊,宽度=非激活态直径 8,高度=3x 直径放大
              // 2026-07-21 v7:active 竖向胶囊 h-5 w-2 → h-4 w-2,激活态宽度对齐非激活态直径(8px)
              // 豁免 5b:竖向装饰指示器(width<=8px height>=12px rounded-full),分页指示器胶囊
              className={
                isActive
                  ? 'block h-6 w-2 rounded-full bg-foreground transition-all duration-300'
                  : 'block h-2 w-2 rounded-full bg-foreground/30 transition-all duration-300 group-hover:h-2.5 group-hover:w-2.5 group-hover:bg-foreground/60'
              }
            />
          </button>
        )
      })}
    </div>
  )
}
