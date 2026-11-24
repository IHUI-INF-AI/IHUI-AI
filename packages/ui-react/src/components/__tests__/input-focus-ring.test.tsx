// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Input 聚焦环不变量(2026-11-23 立)
 *
 * 立因:机主实报"输入框挂着黑色边框",取证发现两件事都不是样式的"看起来",是写法缺陷:
 *   ① Tailwind v4 的 `.outline-2` 自带 `outline-style: var(--tw-outline-style)`,而该变量
 *      @property 初值是 solid ⇒ 裸写 `outline-2` + 裸 `outline-stroke-focus` 会在**静息态**
 *      就画一圈 2px 墨环(实测未聚焦 input:ow=2px os=solid oc=rgb(0,0,0));
 *   ② 聚焦时 `.focus-visible\:outline`(0,2,0)把宽度压成 1px,大于裸 `.outline-2`(0,1,0)
 *      ⇒ 静息浓框、聚焦反而变细。
 * 处置:四件套整体上状态作用域。本文件钉住这条写法,防止有人"顺手"把宽度/颜色改回裸写。
 */
import { describe, expect, it } from 'vitest'
import * as React from 'react'
import { createRoot } from 'react-dom/client'

import { Input } from '../input'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function renderClass(node: React.ReactElement): string {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  React.act(() => {
    root.render(node)
  })
  const el = host.querySelector('input') as HTMLInputElement
  expect(el, '必须渲染出原生 input').not.toBeNull()
  return el.className
}

describe('Input 的聚焦环写法', () => {
  it('四件套全部按 focus-visible 作用域,静息态不得有描边声明', () => {
    const cls = renderClass(<Input />)

    // 四件套必须逐条带变体 —— 少一条就会把环漏到静息态或把宽度压回 1px
    expect(cls, '宽度必须按状态作用域').toContain('focus-visible:outline-2')
    expect(cls, '偏移必须按状态作用域').toContain('focus-visible:outline-offset-0')
    expect(cls, '颜色必须按状态作用域').toContain('focus-visible:outline-stroke-focus')
    expect(cls, '样式开关必须按状态作用域').toContain('focus-visible:outline')

    // 裸写形态必须为 0:裸 outline-2 / outline-stroke-focus / outline-offset-0 都会漏到静息态
    const bare = cls.split(/\s+/).filter((t) => /^outline-(2|offset-0|stroke-focus)$/.test(t))
    expect(bare, `禁止裸写描边档(实测静息态会真画出来): ${bare.join(', ')}`).toEqual([])

    // outline-none 会写 --tw-outline-style:none,把整条环解析成 none(等于没有聚焦反馈)
    expect(cls, 'Input 不得带 outline-none').not.toContain('outline-none')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
