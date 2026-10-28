// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G-815933:hover-only 操作入口在触屏上常驻 —— 覆盖面契约测试。
//
// 判定:桌面 hover 行为逐字不变(类名里仍有 group-hover:opacity-100),触屏(hover:none)
// 常驻由 animations.css 的 `.touch-reveal` 规则承接(与既有 .msg-hover-reveal 同一机制)。
// 覆盖面清单(2026-09-30 现量):入选 4 处(移动端可达的 action + hover-only 揭示);
// 未入选:MessageBubble 时间戳/HomePage4Pricing 装饰线(非操作入口)、ide/* 面板群
// (桌面 IDE chrome,非移动端可达;多处已有 group-focus-within 在位,属已裁决形态)、
// terminal-session-list/TerminalTab 的 opacity-60 系(变暗非隐藏,另一形态)。
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function readWeb(relPath: string): string {
  return readFileSync(resolve(process.cwd(), relPath), 'utf-8')
}

// 每条 = 一个入选站点的源码文件;断言"hover 类与 touch 标记同处一个类名表"。
const SITES: Array<{ name: string; file: string }> = [
  { name: 'TagsView 标签关闭键', file: 'src/components/layout/TagsView.tsx' },
  { name: '会话更多菜单键', file: 'src/components/sidebar-chat-history.tsx' },
  { name: '行内 diff 评论键', file: 'src/components/ai/inline-diff-viewer.tsx' },
  { name: '输入框清空键', file: 'src/components/chat/web-input-core.tsx' },
]

describe('G-815933 触屏常驻:站点接线', () => {
  for (const site of SITES) {
    it(`${site.name} hover 揭示 intact 且挂了 touch-reveal`, () => {
      const lines = readWeb(site.file).split('\n')
      // 标记行 ±2 行窗口内必须同时见到 hover 揭示类与被覆盖的 opacity-0
      // (同属一个 cn()/className 表;行号不钉,挪行不红)。
      const ok = lines.some((_, row) => {
        const window = lines.slice(Math.max(0, row - 2), row + 3).join('\n')
        return (
          window.includes('touch-reveal') &&
          window.includes('group-hover:opacity-100') &&
          window.includes('opacity-0')
        )
      })
      expect(ok, `${site.name} 的 touch-reveal 必须与 group-hover:opacity-100 同表`).toBe(true)
    })
  }
})

describe('G-815933 触屏常驻:CSS 规则', () => {
  const css = readWeb('src/styles/animations.css')

  it('@media (hover: none) 下 .touch-reveal 提 opacity', () => {
    const blocks = css.split('@media (hover: none)')
    const hit = blocks.slice(1).some((block) => {
      const head = block.split('@media')[0] ?? ''
      return block.includes('.touch-reveal') && head.includes('opacity: 1')
    })
    expect(hit, '须有 hover:none → .touch-reveal{opacity:1} 规则').toBe(true)
  })

  it('既有 .msg-hover-reveal 规则未被顶掉', () => {
    expect(css.includes('.msg-hover-reveal'), '既有标记规则须在位').toBe(true)
  })

  it('新规则不用 !important(样式门禁红线)', () => {
    const blocks = css.split('@media (hover: none)')
    for (const block of blocks.slice(1)) {
      if (block.includes('.touch-reveal')) {
        expect(block.split('@media')[0]).not.toContain('!important')
      }
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
