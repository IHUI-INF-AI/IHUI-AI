// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'

/**
 * 浮动圆点指示条 — 全局单一来源(2026-09-17)
 *
 * 背景:PageIndicator(首页分页)与 QueryThumbRail(对话流导航)各自维护样式,
 * 出现"选中态拉伸/尺寸/容器参数不一致"的漂移问题。用户要求:
 *   "要做到同一个 token 组件样式 共同统一引用 不然就会出现这种问题"
 *
 * 规则:
 *   - 所有竖向圆点指示条(分页器/消息地图/后续同类)的容器与节点样式,
 *     必须从本文件引用(floatIndicatorRailCls / FloatIndicatorDot),禁止自行拼接同类样式
 *   - 颜色语义:激活胶囊色由调用方传入 colorCls(如 bg-foreground / bg-primary / bg-amber-500),
 *     非激活点统一 bg-muted-foreground 实色中灰(2026-09-17 用户反馈"未激活圆点太深":
 *     bg-foreground op=1 近黑远深于原 opacity-50 视觉,改实色中灰还原浅灰层级)
 *   - 容器背景色统一走 design-tokens 的 --color-float-indicator-bg
 *     (亮色 hsl(0 0% 100%) / 暗色 hsl(0 0% 11%),纯色不透明)
 *
 * 最终视觉参数(承 PageIndicator v13-v15 定稿 + 2026-09-17 去透明化):
 *   - 非激活节点:8x8 圆点(h-2 w-2),bg-zinc-400 实色浅灰(亮色 rgb 161),
 *     hover 放大 1.25x 并加深一档(bg-zinc-500,还原原版 hover 变清晰手感)
 *     (2026-09-17 用户对照原版截图:"原来的点哪有这么大 + 颜色太深了 稍微有点颜色就行"
 *     —— 10x10/rgb(102) 回归原版小点浅灰,实色无 alpha 不违去透明化原则)
 *   - 激活节点:16x8 竖向拉伸胶囊(h-4 w-2,宽 = 非激活直径),
 *     100% 不透明,colorCls 语义色
 *   - 容器:gap-2 (8px) + rounded-md + px-1 py-1 (4px) + shadow-sm + 实色 border-border,
 *     hover 时 shadow 增强,duration-300
 *   - 全链路无 alpha:用户要求"怎么还有透明色" —— 节点 opacity 半透明、
 *     border-foreground/8 半透明边框全部废除,纯色实色体系
 */

/** 指示条容器统一 className(竖向)。定位类(fixed/absolute、right、top、z、响应式显隐)由调用方追加
 *  2026-09-17 内边距 2px→4px(px-1 py-1):非激活点 hover 放大 1.25x 会视觉溢出 1.25px,
 *  原 py-0.5 (2px) 缓冲不足,放大点贴/超容器边框;4px 内边距留 2.75px 余量 */
export const floatIndicatorRailCls =
  'flex flex-col items-center gap-2 rounded-md border border-border bg-float-indicator-bg px-1 py-1 shadow-sm transition-all duration-300 hover:shadow-md'

/** 非激活节点尺寸:8x8 圆点(2026-09-17 10x10 → 8x8:用户对照原版截图反馈
 *  "原来的未激活态的点哪有这么大",回归原 PageIndicator v10 定稿直径 8) */
export const INDICATOR_DOT_SIZE = 'h-2 w-2'

/** 激活节点尺寸:16x8 竖向拉伸胶囊(宽 8 = 非激活直径,高 16 = 2x 直径;
 *  宽=点径是 v10 定稿时用户拍板"宽度跟下面圆统一为 8 没毛病",
 *  随点缩小同步回归,比例调整为 8x16(用户最终选定) */
export const INDICATOR_PILL_SIZE = 'h-4 w-2'

/** 豁免 5:≤8px 装饰指示点 — 圆形默认 shapeCls(指示条节点纯装饰,不承载内容,AGENTS.md 第 4 节豁免项) */
const DEFAULT_SHAPE_CLS = 'rounded-full'

interface FloatIndicatorDotProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** 是否选中(选中 = 竖向拉伸胶囊) */
  active?: boolean
  /** 节点激活胶囊语义色类(bg-*),如 bg-foreground / bg-primary / bg-amber-500;
   *  仅作用于激活态,非激活点统一 bg-muted-foreground(见文件头注释) */
  colorCls: string
  /** 圆角形状类,默认 rounded-full;方形节点(如工具卡)传 rounded-[2px] */
  shapeCls?: string
}

/**
 * 浮动指示条节点按钮(button 即圆点)。
 * - 选中态:16x8 竖向胶囊(宽 = 非激活直径),100% 不透明,colorCls 语义色
 * - 非激活态:8x8 圆点,bg-zinc-400 实色浅灰(2026-09-17 用户对照原版截图反馈
 *   "点太大 + 颜色太深,稍微有点颜色就行" —— 尺寸回归原版 8,中灰改浅灰;
 *   此前 bg-foreground op=1 近黑 / bg-muted-foreground rgb(102) 均被判定过深);
 *   hover 放大 1.25x 并加深一档 bg-zinc-500(原版 hover 变清晰手感的实色还原)
 * - children 透传(如 QueryThumbRail 的 hover tooltip)
 * 豁免 5:≤8px 装饰指示点(AGENTS.md 第 4 节"装饰点"豁免项,守门脚本应放行)
 */
export function FloatIndicatorDot({
  active,
  colorCls,
  /** rounded-full 豁免:≤8px 装饰指示点 */
  shapeCls = DEFAULT_SHAPE_CLS,
  className = '',
  children,
  ...rest
}: FloatIndicatorDotProps) {
  return (
    <button
      type="button"
      {...rest}
      className={`group relative flex items-center justify-center ${shapeCls} transition-all duration-300 ${
        active
          ? `${INDICATOR_PILL_SIZE} ${colorCls}`
          : `origin-center hover:scale-125 bg-zinc-400 hover:bg-zinc-500 ${INDICATOR_DOT_SIZE}`
      } ${className}`}
    >
      {children}
    </button>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
