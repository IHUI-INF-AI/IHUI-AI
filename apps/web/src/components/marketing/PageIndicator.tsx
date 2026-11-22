// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { floatIndicatorRailCls, FloatIndicatorDot } from '@/components/ui/float-indicator'

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
 *   - button 命中区同步调整为 h-6 w-6 (24x24) 容下激活态,非激活/hover 态底部对齐
 *   - 激活态通过"宽度 = 直径 + 高度 = 3x 直径"形成竖向胶囊,与非激活圆点形成强对比
 * 2026-08-13 v11 间距一致化:用户反馈"椭圆形底部到下面圆形的间距 跟下面圆形跟圆形的
 *   间距不一致 而且间距现在太大了"。
 *   根因:button 用 items-center(垂直居中)→ 非激活态 8x8 居中在 button 24x24 内
 *   (顶 8 底 16),激活态 24x8 填满 button(顶 0 底 24)。
 *   间距计算(items-center):
 *     - 激活态底 24 → 下一非激活态顶 (24+gap+8) = gap+32
 *     - 非激活态底 16 → 下一非激活态顶 (16+gap+8) = gap+24
 *     - 差 8px,不一致
 *   修复:
 *     - button items-center → items-end(底部对齐):所有态底部都对齐 button 底部
 *     - 间距 = gap + 16(非激活态 8x8 顶部距 button 底部 16px),所有态一致
 *     - 容器 gap-1 (4px) → gap-0 (0px),py-1.5 (6px) → py-0.5 (2px)
 *     - 最终间距:16px(2x 非激活态直径,紧凑但清晰)
 * 2026-08-13 v12 左右压缩 + 上下留白:用户反馈"左右两侧内边距那么大 上下都快贴上了"。
 *   根因(button w-6 24px):button 命中区宽 24px 但内容(active 8w / inactive 8w)仅 8px
 *     容器宽度 28px,内容占比 28%,左右各 8px 空白"漂浮",比例严重失衡
 *   修复:
 *     - button w-6 (24px) → w-2.5 (10px):与内容宽度匹配
 *       - active 8w 留 1px / inactive 8w 留 1px / hover 10w 填满(刚好命中)
 *       - 容器宽度 28px → 14px(-50%),视觉紧凑
 *     - 容器 py-0.5 (2px) → py-1 (4px):首尾圆点离容器边缘有 4px 留白,不再"贴上"
 *     - gap 保持 gap-0,相邻点间距仍 16px(2x 非激活态直径,垂直节奏不变)
 * 2026-08-13 v13 间距再压缩:用户反馈"每个按钮之间的间距还是太大了"。
 *   根因(v12):所有 button 命中区统一 h-6 (24px),button 内只有非激活态 8x8 圆点
 *     → button 内上空 16px,加上非激活态 8x8 + 下一 button 内上空 16px = 32px 视觉间距
 *     (实际测得 16px 是因为 items-end 底部对齐,顶部 16px 空白全部"折叠"到 button 边界外,
 *      但 button 本身 24px 仍然让整体指示器总高 168px 太长,看起来"按钮间空隙大")
 *   修复:
 *     - 激活态 button 保持 h-6 (24px):需要容下 24x8 竖向胶囊(不能砍)
 *     - 非激活态 button h-6 (24px) → h-2 (8px):只装 8x8 圆点,砍掉 16px 上空
 *       - HTML 结构上 button 高度独立(active=24 / inactive=8),flex 容器自动按各自高度堆叠
 *       - 视觉上:激活态是"竖向拉长棒",非激活态是"小圆点",高度差本身就是激活 vs 非激活的视觉对比
 *     - 容器 gap-0 (0px) → gap-1 (4px):点与点之间用 4px 间隙分隔
 *       - 间距计算(假设激活态在 idx=0):激活 24 + gap 4 + 非激活 8 + gap 4 + 非激活 8 + ... = 24 + 4 + 6*(8+4) = 24+4+72 = 100px
 *       - 不算 py:96px,比 v12 的 168px 减 43%
 *       - 视觉间距(非激活态底 8 → 下一非激活态顶 12) = 4px(1/2 非激活态直径,极致紧凑)
 *     - hover 态实现调整(原 10x10 圆点改为 transform scale-125):button 高 8px 装不下 10x10,
 *       改用 transform scale-125 让 8x8 圆点视觉上 10x10,溢出 button 1px(在 4px gap 内,不影响相邻)
 *     - items-end → items-stretch:active 24x8 填满 button,非激活态 8x8 填满 button,
 *       flex 自然撑满,无需 items-* 修饰
 *
 * 2026-07-20 v6 毛玻璃容器:用户反馈"圆点裸浮在内容上缺少承载感"。
 *   - 容器加 rounded-md + bg-background/65 + backdrop-blur-md
 *   - 极轻 border-foreground/8 + shadow-sm
 *   - group/indicator 命名空间避免与按钮内 group 冲突
 *
 * 2026-09-17 统一设计 token:用户要求"纯色不透明背景 + 全局设计 token 统一引用/统一修改管理"。
 *   - v6 的 bg-background/65 + backdrop-blur-md 毛玻璃废除
 *   - 改用 bg-float-indicator-bg(源自 design-tokens tokens.css 的 --color-float-indicator-bg,
 *     亮色纯白 hsl(0 0% 100%) / 暗色 hsl(0 0% 11%),均不透明纯色)
 *   - 与 query-thumb-rail、MessageList 跳转按钮、终端工具栏等全项目浮动指示条统一引用同一 token
 * 2026-09-17 单一来源组件化:用户要求"要做到同一个 token 组件样式 共同统一引用 不然就会出现这种问题"
 *   (此前 QueryThumbRail 未跟进 v10-v15 的选中拉伸体系,出现样式漂移)。
 *   - 容器与节点样式整体迁移到共享组件 ui/float-indicator.tsx
 *     (floatIndicatorRailCls / FloatIndicatorDot / INDICATOR_DOT_SIZE / INDICATOR_PILL_SIZE)
 *   - QueryThumbRail 与本组件共同引用同一单一来源,今后改样式只动 float-indicator.tsx 一处
 * 2026-09-17 去透明化:用户指出"怎么还有透明色" —— 共享组件层面废除节点 opacity-50/hover 0.8
 *   与容器 border-foreground/8 半透明边框,全部改纯色实色(节点实色、border-border 实色) */
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
      className={`fixed top-1/2 z-sticky hidden -translate-y-1/2 min-[768px]:flex ${floatIndicatorRailCls}`}
      aria-label={t('label')}
    >
      {Array.from({ length: total }).map((_, idx) => (
        <FloatIndicatorDot
          key={idx}
          active={idx === current}
          colorCls="bg-foreground"
          onClick={() => onClick(idx)}
          aria-label={t('switchTo', { index: idx + 1 })}
          aria-current={idx === current ? 'true' : undefined}
        />
      ))}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
