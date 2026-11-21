// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 活动行几何单一来源锁定(2026-11-21 立)
//
// 用户实报"图标文字都没对齐 / 七扭八歪"。根因不是某处 1px,而是**几何量挂在"能不能点"上**:
// 可点击行当年走头行档(h-7 + px-1),展示行走普通档(h-6 + 无左内边距)⇒ 同一列表里
// 图标列左右跳 4px、行高 24/28 交替;再叠加全局中文 vcenter 规则只认 button,基线又差 0.3px
// (探针实测:div 行 0、button 行 +0.3)。
//
// 本用例用真实渲染钉住三件事:
//  ① 可点击与展示两个分支渲染出的 className **逐字相同**(几何只能来自同一个常量),且不含旧档 h-7;
//  ② 两个分支的行根都带 data-stream-row —— tokens.css 的行级字形补偿以它为唯一触发面;
//  ③ 行内左内边距/间距/行高在两个分支里一致(同 px-1 ⇒ 图标列与文字列不随可点击性位移)。
//
// i18n:StreamMetric 无条件调用 useTranslations,本用例只关心几何,把 next-intl 打桩即可。
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

import { STREAM_HEADER_ROW_CLASS, StreamRow } from '../stream-ui'

describe('StreamRow 几何单一来源', () => {
  it('可点击与展示两个分支的行几何逐字相同', () => {
    const plain = render(<StreamRow status="success" kind="thinking" title="思考过程" />)
    const clickable = render(
      <StreamRow status="success" kind="terminal" title="执行命令" onClick={() => {}} />,
    )

    const plainRoot = plain.container.firstElementChild as HTMLElement
    const clickableRoot = clickable.container.firstElementChild as HTMLElement

    expect(plainRoot.className).toBe(clickableRoot.className)
    // 几何不允许在分支里各写一份:必须整段等于唯一常量
    expect(plainRoot.className).toContain(STREAM_HEADER_ROW_CLASS)
    // 旧的头行高度档回来就又是 24/28 两档
    expect(plainRoot.className).not.toMatch(/\bh-7\b/)
  })

  it('两个分支的行根都带 data-stream-row(行级字形补偿的唯一触发面)', () => {
    const plain = render(<StreamRow status="success" title="思考过程" />)
    const clickable = render(<StreamRow status="success" title="执行命令" onClick={() => {}} />)
    expect(plain.container.firstElementChild?.getAttribute('data-stream-row')).toBe('true')
    expect(clickable.container.firstElementChild?.getAttribute('data-stream-row')).toBe('true')
  })

  it('图标列/文字列的横向几何不随可点击性变化(左内边距与间距同源)', () => {
    const plain = render(
      <StreamRow status="success" kind="fileRead" title="读取文件内容" subject="a.ts" />,
    )
    const clickable = render(
      <StreamRow
        status="success"
        kind="fileRead"
        title="读取文件内容"
        subject="a.ts"
        onClick={() => {}}
      />,
    )
    const geometry = (container: HTMLElement) => {
      const root = container.firstElementChild as HTMLElement
      const cs = getComputedStyle(root)
      return { paddingLeft: cs.paddingLeft, gap: cs.gap, height: cs.height }
    }
    expect(geometry(plain.container)).toEqual(geometry(clickable.container))
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
