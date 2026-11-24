// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import type { CSSProperties } from 'react'

/** 彗尾由 N 枚首尾相接的短段拼成:同一描边色,靠宽度与不透明度逐级衰减 ⇒ 连续渐隐而不是几块色斑。
 *  段长按 pathLength=100 归一(按钮周长恒等 100 单位),任何尺寸按钮都成立。 */
const SEGMENT_LEN = 1.25
const TAIL_SEGMENTS = Array.from({ length: 14 }, (_, i) => {
  const t = i / 13
  return {
    key: i,
    offset: i * SEGMENT_LEN,
    width: 2.4 - 1.2 * t,
    opacity: 1 - 0.72 * t,
  }
})

/**
 * LaserHaloRing — 「任务进行中」时套在按钮四周的旋转激光光带(2026-11-21 用户定档)。
 *
 * 挂载点(用户同日校订,只此两处):消息区的「下翻/跳到最新」按钮、底栏流式态的「停止」键。
 * 语义:任务在跑 ⇒ 按钮外沿一圈 2px 激光绕边旋行;任务结束(或停止键消失)⇒ active 变 false
 * 组件卸载,动画随之停止(不靠 JS 定时器,也不留"跑完还在转"的残影)。
 *
 * 形态约束:
 *  - 只画外沿:SVG 描边贴在按钮四边(inset -2px),按钮文案区不吃光、不铺底;
 *  - 圆角跟按钮同档(--radius-sm),不是方形框;
 *  - 不拦截点击:pointer-events: none,光环在按钮之上也不影响下拉展开;
 *  - 不用 mask-image(§4 禁渐变遮罩),光带靠 stroke-dasharray 沿闭合路径流动;
 *  - 配色只取品牌强调档(brand-accent / brand-accent-deep),明暗两套由 tokens.css 供给;
 *  - 柔光来自「一层淡光晕 + 逐级收窄减淡的彗尾 + 0.5px 整体柔化」,不是 blur 糊成色块;
 *  - prefers-reduced-motion 下停转,但保留静态弧光,仍能读出"进行中"。
 *
 * 动画与配色单源在 animations.css 的 `.agent-laser-ring` / `@keyframes agent-laser-sweep`。
 * 宿主按钮必须自带 `relative`,否则绝对定位会贴到最近的定位祖先。
 */
export function LaserHaloRing({ active }: { active: boolean }) {
  if (!active) return null
  return (
    <svg aria-hidden="true" className="agent-laser-ring" data-testid="agent-laser-halo">
      {/* 0 号光晕:一截连续淡光,裹住彗尾起点做扩散,不做大面积铺底 */}
      <rect
        className="agent-laser-ring-glow"
        x={1}
        y={1}
        width="98%"
        height="98%"
        rx={4}
        pathLength={100}
      />
      {/* 1..N 号彗尾段:首尾严格相接(间距为 0),宽度与不透明度沿尾向衰减 */}
      {TAIL_SEGMENTS.map((seg) => (
        <rect
          key={seg.key}
          className="agent-laser-ring-tail"
          style={
            {
              '--laser-offset': String(seg.offset),
              strokeWidth: seg.width,
              opacity: seg.opacity,
            } as CSSProperties
          }
          x={1}
          y={1}
          width="98%"
          height="98%"
          rx={4}
          pathLength={100}
          strokeDasharray={`${SEGMENT_LEN} ${100 - SEGMENT_LEN}`}
        />
      ))}
    </svg>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
