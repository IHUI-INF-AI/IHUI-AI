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
      // 2026-08-13 v12:左右内边距压缩 + 上下留白增大
      //   根因(button w-6 24px):button 命中区与内容(active 8w / inactive 8w)宽度严重不匹配,
      //     容器宽度 = 24 + 2*2 = 28px,但内容仅 8px → 左右各 8px 空白"漂浮",用户反馈"内边距那么大 上下都快贴上"
      //   修复(button w-2.5 10px):
      //     - 适配 active 8w 留 1px / inactive 8w 留 1px / hover 10w 填满(刚好命中)
      //     - 容器宽度 = 10 + 2*2 = 14px(原 28px,减 50%)
      //   同步修复容器 py-0.5 (2px) → py-1 (4px),首尾圆点离容器边缘有 4px 留白,不再"贴上"
      //   gap 保持 gap-0,相邻点间距仍 16px(2x 非激活态直径,垂直节奏不变)
      // 2026-08-13 v13:间距再压缩 — gap-0 (0px) → gap-1 (4px),启用 4px 间隙作为点间距,
      //   配合非激活态 button h-2 (8px),视觉间距从 16px 降到 4px(-75%),极致紧凑
      className="group/indicator fixed top-1/2 z-sticky hidden -translate-y-1/2 flex-col gap-2 rounded-md border border-foreground/8 bg-background/65 px-0.5 py-1 shadow-sm backdrop-blur-md transition-all duration-300 hover:border-foreground/15 hover:bg-background/85 hover:shadow-md min-[768px]:flex"
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
            //   正方形命中区让激活态(24x8)/非激活态(8x8)/hover态(10x10)都能在中心完美居中
            // 2026-08-13 v12:button w-6 (24px) → w-2.5 (10px) — 与内容宽度适配
            //   原因:button 24px 宽 vs 内容 8px → 容器左右 8px 空白"漂浮",视觉比例失衡
            //   修复:button 10px 宽,active 8w (留 1px) / inactive 8w (留 1px) / hover 10w (填满)
            //   容器宽度 28px → 14px (-50%),视觉紧凑
            // 2026-08-13 v13:非激活态 button h-6 (24px) → h-2 (8px),只装 8x8 圆点,砍掉 16px 上空
            //   激活态 button 保持 h-6 (24px) 容下 24x8 竖向胶囊
            //   HTML 上 button 高度独立(active=24 / inactive=8),flex 容器自动按各自高度堆叠
            //   视觉:激活态"竖向拉长棒" + 非激活态"小圆点"对比,高度差本身就是激活 vs 非激活视觉对比
            className={
              isActive
                ? 'group flex h-6 w-2.5 items-stretch justify-center'
                : 'group flex h-2 w-2.5 items-stretch justify-center'
            }
          >
            <span
              // 2026-07-21 v8:拆分 isActive 两套完整 className — 修 bug
              // 旧实现模板字符串拼接导致 h-4 / h-2、w-1.5 / w-2 同元素冲突,Tailwind 源序后值获胜
              // → 非激活态被拉成 16x8 竖向胶囊,所有点都成椭圆。修复后非激活 8x8 圆点、激活 16x8 胶囊(等宽)。
              // 2026-08-13 v10:激活态改为 24x8 (h-6 w-2) 竖向胶囊,宽度=非激活态直径 8,高度=3x 直径放大
              // 2026-07-21 v7:active 竖向胶囊 h-5 w-2 → h-4 w-2,激活态宽度对齐非激活态直径(8px)
              // 2026-08-13 v13:hover 态实现调整 — 原 group-hover:h-2.5 w-2.5 改 transform scale-125
              //   原因:非激活 button 高 8px 装不下 10x10 hover 态,改用 transform 让 8x8 圆点视觉上 10x10
              //   scale 中心点默认 button 中心,溢出 ±1px 在 4px gap 内,不影响相邻
              // 豁免 5b:竖向装饰指示器(width<=8px height>=12px rounded-full),分页指示器胶囊
              className={
                isActive
                  ? 'block h-6 w-2 rounded-full bg-foreground transition-all duration-300'
                  : 'block h-2 w-2 origin-center rounded-full bg-foreground/30 transition-all duration-300 group-hover:scale-125 group-hover:bg-foreground/60'
              }
            />
          </button>
        )
      })}
    </div>
  )
}
